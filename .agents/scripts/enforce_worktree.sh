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

# '.'/'..' 세그먼트는 허용 경로 glob(document/*)을 우회할 수 있으므로 거부 (DL-0028)
case "/$target_file/" in
  */../* | */./*)
    echo '{"decision": "deny", "reason": "[SOP Violation] '"'"'.'"'"' 또는 '"'"'..'"'"' 세그먼트가 포함된 경로는 허용되지 않습니다. 정규화된 절대 경로를 사용하세요."}'
    exit 0 ;;
esac

# Check if target_file is outside project
if [[ "$target_file" != "$toplevel/"* ]]; then
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

# Whitelist check (단일 기준: .agents/main_allowlist, DL-0028)
MAIN_ALLOWLIST_FILE="$toplevel/.agents/main_allowlist"   # 환경변수로 교체 불가
. "$(dirname "$0")/main_allowlist.sh"
if is_main_allowed "$rel_path"; then
  echo '{"decision": "allow"}'
  exit 0
fi

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
  "reason": "[SOP Violation] main 저장소에서는 .agents/main_allowlist 에 등록된 경로(문서, .env)만 수정할 수 있습니다. 그 외 파일은 워크트리에서 수정하세요."
}
JSON
