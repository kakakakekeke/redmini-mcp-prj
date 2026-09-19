#!/bin/bash
input="${1:-$(cat)}"

# extract Workspace values that are NOT share or branch. (If null/omitted, it's inherit)
invalid_workspaces=$(echo "$input" | jq -r '.args.Subagents[] | select(.Workspace != "share" and .Workspace != "branch") | .Workspace // "inherit"')

if [ -n "$invalid_workspaces" ]; then
  cat << 'JSON'
{
  "decision": "deny",
  "reason": "[Guardrail Violation] 서브에이전트 호출 시 반드시 Workspace를 \"share\" 또는 \"branch\"로 설정해야 합니다. (기본값 inherit 사용 불가)"
}
JSON
else
  cat << 'JSON'
{
  "decision": "allow"
}
JSON
fi
