#!/bin/bash
# PostToolUse(Edit|Write|MultiEdit): TypeScript 파일 수정 시 tsc --noEmit 실행, 에러를 Claude에게 전달.
. "${0%/*}/lib.sh"
read_hook_input
file=$(jq -r '.tool_input.file_path // ""' <<<"$input")
case "$file" in *.ts | *.tsx | *.mts | *.cts) ;; *) exit 0 ;; esac

root=$(git -C "$(nearest_existing_dir "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
tsc="$root/node_modules/.bin/tsc"
[ -x "$tsc" ] || exit 0

mkdir -p "$root/.claude"
log="$root/.claude/typecheck.log"
(cd "$root" && "$tsc" --noEmit) >"$log" 2>&1 && exit 0

errors=$(grep -m 30 'error TS' "$log")
jq -n --arg c "[typecheck] tsc --noEmit 실패 (전체 로그: $log)
$errors" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$c}}'
