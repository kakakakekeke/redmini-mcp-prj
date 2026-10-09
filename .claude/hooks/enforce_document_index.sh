#!/bin/bash
# Stop/SubagentStop: document/ 와 document/index.md 불일치 시 종료 차단.
# 판정 로직은 .agents/scripts/enforce_document_index.sh 를 그대로 재사용한다.
input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0  # 연속 차단 방지

cwd=$(jq -r '.cwd // empty' <<<"$input")
root=$(git -C "${cwd:-$PWD}" rev-parse --show-toplevel 2>/dev/null) || root="${CLAUDE_PROJECT_DIR:-.}"
checker="$root/.agents/scripts/enforce_document_index.sh"
[ -x "$checker" ] || checker="${CLAUDE_PROJECT_DIR:-.}/.agents/scripts/enforce_document_index.sh"
[ -x "$checker" ] || exit 0

result=$(cd "$root" && echo '{"terminationReason":"model_stop"}' | "$checker")
if [ "$(jq -r '.decision // ""' <<<"$result" 2>/dev/null)" = "continue" ]; then
  jq -n --arg r "$(jq -r '.reason' <<<"$result")" '{decision:"block",reason:$r}'
fi
exit 0
