#!/bin/sh
# main 허용 경로 판정 함수. POSIX sh 호환 (husky pre-commit 에서도 source 한다).
# 사용: . .agents/scripts/main_allowlist.sh; is_main_allowed "document/todo.md"

# 호출자가 MAIN_ALLOWLIST_FILE 을 지정하지 않으면 현재 디렉터리의 저장소 루트 기준으로 찾는다.
MAIN_ALLOWLIST_FILE="${MAIN_ALLOWLIST_FILE:-$(git rev-parse --show-toplevel 2>/dev/null)/.agents/main_allowlist}"

is_main_allowed() {
  _rel="$1"
  [ -f "$MAIN_ALLOWLIST_FILE" ] || return 1   # 정책 파일이 없으면 fail-closed
  while IFS= read -r _pat || [ -n "$_pat" ]; do
    case "$_pat" in '' | '#'*) continue ;; esac
    # shellcheck disable=SC2254
    case "$_rel" in $_pat) return 0 ;; esac
  done < "$MAIN_ALLOWLIST_FILE"
  return 1
}
