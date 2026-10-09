#!/bin/bash
# Claude Code 훅 공용 헬퍼

# 훅 입력을 읽어 $input 에 저장한다. jq 부재·깨진 JSON이면 exit 2(차단)로 fail-closed 처리.
read_hook_input() {
  command -v jq >/dev/null 2>&1 || { echo "[hook] jq 가 설치되어 있지 않아 가드레일을 검증할 수 없습니다." >&2; exit 2; }
  input=$(cat)
  jq -e 'type == "object"' >/dev/null 2>&1 <<<"$input" || { echo "[hook] 훅 입력이 올바른 JSON 객체가 아닙니다." >&2; exit 2; }
}

# 경로가 아직 없을 수 있으므로(Write 신규 파일) 존재하는 가장 가까운 상위 디렉터리를 찾는다.
nearest_existing_dir() {
  local p="$1"
  [ -d "$p" ] || p=$(dirname "$p")
  while [ ! -d "$p" ] && [ "$p" != "/" ]; do p=$(dirname "$p"); done
  printf '%s' "$p"
}

# 해당 경로가 메인 저장소(워크트리가 아닌) 체크아웃에 속하면 0을 반환한다.
is_main_checkout() {
  local d git_dir common_dir
  d=$(nearest_existing_dir "$1")
  git_dir=$(git -C "$d" rev-parse --absolute-git-dir 2>/dev/null) || return 1
  common_dir=$(cd "$d" && cd "$(git rev-parse --git-common-dir)" && pwd -P)
  [ "$(cd "$git_dir" && pwd -P)" = "$common_dir" ]
}

pre_tool_deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
}
