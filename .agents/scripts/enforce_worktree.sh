#!/bin/bash
# enforce_worktree.sh: Git Worktree SOP 가드레일 훅

# stdin으로 들어오는 JSON 파라미터를 읽지만 여기서는 브랜치명만 확인합니다.
# (추가적인 로직이 필요하다면 jq 등을 활용해 tool 파라미터를 분석할 수 있습니다.)

BRANCH=$(git branch --show-current 2>/dev/null)

if [ "$BRANCH" = "main" ]; then
  cat << 'EOF'
{
  "decision": "deny", 
  "reason": "[SOP Violation] main 브랜치에서 직접 파일(문서/코드)을 수정할 수 없습니다. 반드시 'git worktree add'를 통해 격리된 브랜치에서 작업하세요."
}
EOF
else
  cat << 'EOF'
{
  "decision": "allow"
}
EOF
fi
