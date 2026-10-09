#!/bin/bash
# PreToolUse(Bash): 훅 우회 명령과 main 체크아웃에서 훅을 거치지 않는 커밋 명령을 차단한다. (DL-0028)
# - 모든 위치: --no-verify, HUSKY=0, PRE_MERGE_COMMIT=, core.hooksPath 변경
# - main 체크아웃: git cherry-pick / revert / am (pre-commit·commit-msg 를 거치지 않음)
# 명령 문자열 기반의 최선 노력(best-effort) 검사이며, 최종 방어선은 git 훅이다.
. "${0%/*}/lib.sh"
read_hook_input
cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
[ -z "$cmd" ] && exit 0

deny() { pre_tool_deny "[Guardrail Violation] $1 (AGENTS.md 9장: 훅 우회 금지)"; exit 0; }

grep -Eq -- '(^|[[:space:]])--no-verify([[:space:]=]|$)' <<<"$cmd" && deny "--no-verify 로 git 훅을 우회할 수 없습니다."
grep -Eq '(^|[^A-Za-z0-9_])HUSKY=0' <<<"$cmd" && deny "HUSKY=0 으로 git 훅을 끌 수 없습니다."
grep -Eq '(^|[^A-Za-z0-9_])PRE_MERGE_COMMIT=' <<<"$cmd" && deny "병합 플래그를 위조할 수 없습니다."
if grep -Eiq 'core\.hooksPath' <<<"$cmd" && ! grep -Eq -- '--get|--list|(^|[[:space:]])-l([[:space:]]|$)' <<<"$cmd"; then
  deny "core.hooksPath 를 변경할 수 없습니다. 훅 설치는 npm run prepare 를 사용하세요."
fi

if grep -Eq '(^|[^A-Za-z0-9_-])git([[:space:]]+(-C[[:space:]]+[^[:space:]]+|-c[[:space:]]+[^[:space:]]+))*[[:space:]]+(cherry-pick|revert|am)([[:space:]]|$)' <<<"$cmd"; then
  # 대상 디렉터리: git -C <경로> 가 있으면 그 경로, 없으면 세션 cwd
  target=$(grep -Eo -- '-C[[:space:]]+[^[:space:]]+' <<<"$cmd" | head -n 1 | sed -E 's/^-C[[:space:]]+//')
  case "$target" in "") target="${cwd:-$PWD}" ;; /*) ;; *) target="${cwd:-$PWD}/$target" ;; esac
  if [ -d "$target" ] && is_main_checkout "$target"; then
    deny "main 체크아웃에서 cherry-pick/revert/am 은 pre-commit·commit-msg 훅을 거치지 않으므로 금지됩니다. 워크트리 브랜치에서 수행한 뒤 병합하세요."
  fi
fi
exit 0
