#!/bin/bash
# PreToolUse(Bash): 훅 우회 명령과 main 체크아웃에서 훅을 거치지 않는 커밋 명령을 차단한다. (DL-0028)
# - 모든 위치: --no-verify, HUSKY=0, PRE_MERGE_COMMIT=, core.hooksPath 변경
# - main 체크아웃: git cherry-pick / revert / am (pre-commit·commit-msg 를 거치지 않음)
# 명령 문자열 기반의 최선 노력(best-effort) 검사이며, 최종 방어선은 git 훅이다.
# shellcheck source=lib.sh
. "${0%/*}/lib.sh"
read_hook_input
cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
[ -z "$cmd" ] && exit 0

deny() { pre_tool_deny "[Guardrail Violation] $1 (AGENTS.md 9장: 훅 우회 금지)"; exit 0; }

# core.hooksPath "쓰기"만 감지한다 (DL-0030). 조회(`git config <key>`, --get/--list)나
# 커밋 메시지·heredoc·문자열 속 언급은 허용한다.
#  - 위치와 무관하게 차단: git -c <key>=…, --config-env=<key>=…, GIT_CONFIG_KEY_n/GIT_CONFIG_PARAMETERS 주입,
#    변수에 키를 담아 config 에 넘기는 형태(K=<key>; git config "$K" …). 키 비교 전 따옴표를 제거한다("core.hooks""Path").
#  - 명령을 셸 구분자(; & | ( ) { } ` 개행) 단위 세그먼트로 나누고 리다이렉션을 제거한 뒤,
#    `git [전역옵션] config …` 가 있는 세그먼트를 fail-closed 로 판정한다 (앞에 if/!/eval/timeout 등 무엇이 와도 검사):
#      허용 = 키 뒤에 아무것도 없음(조회) 또는 키 앞에 --get*/--list/-l/get/list (조회)
#      차단 = 키 앞에 --unset*/unset, 키 뒤에 무엇이든(값·=·주석 포함), --remove-section/--rename-section core,
#             xargs 로 값을 넘기는 형태
#  - 산문 예외: git 이 따옴표 문자열 "안"에 있고 따옴표 바로 뒤가 아니면(예: -m "explain git config …") 산문으로 본다.
#    따옴표 직후의 git(sh -c 'git config …', eval "git config …")은 명령으로 본다.
hooks_path_write() {
  local c="$1" seg p args before after t dq sq
  local key='core\.hookspath' nq=${1//[\"\'\\]/}
  local tok="([^[:space:]\"']|\"[^\"]*\"|'[^']*')"
  local gopts="([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--super-prefix)[[:space:]]+${tok}+|[[:space:]]+-${tok}*)*"
  # macOS(BSD) regcomp 는 빈 대안 `(a|)` 을 거부하므로 `(...)?` 만 사용한다
  local git_re="^((.*[[:space:]'\"!])?)([^[:space:]'\"]*/)?git${gopts}[[:space:]]+config([[:space:]].*)?$"
  local rc=1
  shopt -s nocasematch
  if grep -Eiq "GIT_CONFIG_PARAMETERS=.*hookspath|GIT_CONFIG_KEY_[0-9]+=${key}|(^|[^[:alnum:]_-])-c[[:space:]]*${key}=|--config-env[=[:space:]]+${key}=" <<<"$nq" \
     || { grep -Eiq "[A-Za-z_][A-Za-z0-9_]*=${key}([^[:alnum:]_.]|$)" <<<"$nq" && grep -Eq '(^|[[:space:]])config([[:space:]]|$)' <<<"$nq"; }; then
    rc=0
  else
    while IFS= read -r seg; do
      # 리다이렉션(2>/dev/null, > out, <<'EOF')은 값으로 오인하지 않도록 제거
      seg=$(sed -E 's/[0-9]*[<>]+&?[[:space:]]*[^[:space:]]*//g' <<<"$seg")
      # 구조 판정: 따옴표·역슬래시를 지운 사본("git" config, \git, core.hooks\Path) 또는
      # 원본(-C "/a b" 처럼 공백 든 따옴표 인자) 중 하나라도 일치하면 검사 대상
      [[ ${seg//[\"\'\\]/} =~ $git_re ]] || [[ $seg =~ $git_re ]] || continue
      args=" ${BASH_REMATCH[${#BASH_REMATCH[@]}-1]}"
      args=${args//[\"\'\\]/}
      # 산문 예외(원본 기준): git 앞에서 따옴표가 열려 있고(홀수 개) 따옴표 바로 뒤가 아님
      [[ $seg =~ ^((.*[[:space:]\'\"!\\])?)[\'\"\\]*git ]] || continue
      t=${BASH_REMATCH[1]}
      p=$t; t=${p//[^\"]/}; dq=$(( ${#t} % 2 )); t=${p//[^\']/}; sq=$(( ${#t} % 2 ))
      if [ $((dq + sq)) -gt 0 ] && ! [[ $p =~ [\"\'][[:space:]]*$ ]]; then continue; fi
      # 키 자리에 변수·명령 치환($K, $(echo …))이 있고 명령 어딘가에 키가 있으면 차단
      if [[ $args =~ \$ ]] && [[ $nq =~ $key ]]; then rc=0; break; fi
      if [[ $args =~ [[:space:]](--)?(remove|rename)-section([[:space:]]+-[^[:space:]]+)*[[:space:]]+core([[:space:]]|$) ]]; then rc=0; break; fi
      [[ $args =~ ^(.*[[:space:]])core\.hookspath(.*)?$ ]] || continue
      before=${BASH_REMATCH[1]}; after=${BASH_REMATCH[2]}
      if [[ $p =~ (^|[[:space:]])xargs[[:space:]] ]]; then rc=0; break; fi
      if [[ $before =~ [[:space:]](--get(-all|-regexp|-urlmatch)?|--list|-l|get|list)[[:space:]] ]]; then continue; fi
      if [[ $before =~ [[:space:]](--unset(-all)?|unset)[[:space:]] ]]; then rc=0; break; fi
      if [[ $after =~ [^[:space:]] ]]; then rc=0; break; fi
    done < <(tr ';&|(){}`' '[\n*]' <<<"$c")
  fi
  shopt -u nocasematch
  return $rc
}

grep -Eq -- '(^|[[:space:]])--no-verify([[:space:]=]|$)' <<<"$cmd" && deny "--no-verify 로 git 훅을 우회할 수 없습니다."
grep -Eq '(^|[^A-Za-z0-9_])HUSKY=0' <<<"$cmd" && deny "HUSKY=0 으로 git 훅을 끌 수 없습니다."
grep -Eq '(^|[^A-Za-z0-9_])PRE_MERGE_COMMIT=' <<<"$cmd" && deny "병합 플래그를 위조할 수 없습니다."
hooks_path_write "$cmd" && deny "core.hooksPath 를 변경할 수 없습니다. 훅 설치는 npm run prepare 를 사용하세요."

if grep -Eq '(^|[^A-Za-z0-9_-])git([[:space:]]+(-C[[:space:]]+[^[:space:]]+|-c[[:space:]]+[^[:space:]]+))*[[:space:]]+(cherry-pick|revert|am)([[:space:]]|$)' <<<"$cmd"; then
  # 대상 디렉터리: git -C <경로> 가 있으면 그 경로, 없으면 세션 cwd
  target=$(grep -Eo -- '-C[[:space:]]+[^[:space:]]+' <<<"$cmd" | head -n 1 | sed -E 's/^-C[[:space:]]+//')
  case "$target" in "") target="${cwd:-$PWD}" ;; /*) ;; *) target="${cwd:-$PWD}/$target" ;; esac
  if [ -d "$target" ] && is_main_checkout "$target"; then
    deny "main 체크아웃에서 cherry-pick/revert/am 은 pre-commit·commit-msg 훅을 거치지 않으므로 금지됩니다. 워크트리 브랜치에서 수행한 뒤 병합하세요."
  fi
fi
exit 0
