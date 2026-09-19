#!/bin/bash
input="${1:-$(cat)}"
target_file=$(jq -r '.args.TargetFile // .args.AbsolutePath // ""' <<< "$input")

if [ -z "$target_file" ]; then
  echo '{"decision": "allow"}'
  exit 0
fi

toplevel=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -z "$toplevel" ]; then
  echo '{"decision": "allow"}'
  exit 0
fi

# Check if target_file is outside project
if [[ "$target_file" != "$toplevel"* ]]; then
  echo '{"decision": "allow"}'
  exit 0
fi

git_dir=$(git rev-parse --git-dir)
git_common_dir=$(git rev-parse --git-common-dir)

if [ "$git_dir" != "$git_common_dir" ]; then
  # Worktree: allow all
  echo '{"decision": "allow"}'
  exit 0
fi

# Main repo: restrict
rel_path=${target_file#"$toplevel/"}

# Whitelist check
case "$rel_path" in
  document/todo.md | document/index.md | document/decision_log/* | document/adr/* | .env)
    echo '{"decision": "allow"}'
    exit 0
    ;;
esac

# Merge whitelist
if [ -f "$git_dir/MERGE_HEAD" ]; then
  # Find if rel_path is in unmerged files
  if git ls-files --unmerged | cut -f2 | grep -Fxq "$rel_path"; then
    echo '{"decision": "allow"}'
    exit 0
  fi
fi

cat << 'JSON'
{
  "decision": "deny",
  "reason": "[SOP Violation] main 브랜치에서 직접 파일(문서/코드)을 수정할 수 없습니다. 화이트리스트 외 파일은 워크트리에서 수정하세요."
}
JSON
