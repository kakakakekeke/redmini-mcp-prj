#!/bin/bash
set -e

echo "Running test_worktree_guardrail.sh..."

TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null)

# Test enforce_subagent_workspace.sh
echo "1. Testing enforce_subagent_workspace.sh..."
out1=$(./.agents/scripts/enforce_subagent_workspace.sh << 'INPUT'
{"args": {"Subagents": [{"Workspace": "share"}]}}
INPUT
)
if ! echo "$out1" | grep -q '"decision": "allow"'; then
  echo "FAIL: share should be allowed"
  exit 1
fi

out2=$(./.agents/scripts/enforce_subagent_workspace.sh << 'INPUT'
{"args": {"Subagents": [{"Workspace": "inherit"}]}}
INPUT
)
if ! echo "$out2" | grep -q '"decision": "deny"'; then
  echo "FAIL: inherit should be denied"
  exit 1
fi

out3=$(./.agents/scripts/enforce_subagent_workspace.sh << 'INPUT'
{"args": {"Subagents": [{}]}}
INPUT
)
if ! echo "$out3" | grep -q '"decision": "deny"'; then
  echo "FAIL: missing Workspace (defaults to inherit) should be denied"
  exit 1
fi

# Test enforce_worktree.sh
echo "2. Testing enforce_worktree.sh..."

# Artifact path outside project
out4=$(./.agents/scripts/enforce_worktree.sh << INPUT
{"args": {"TargetFile": "/tmp/outside_path.md"}}
INPUT
)
if ! echo "$out4" | grep -q '"decision": "allow"'; then
  echo "FAIL: outside path should be allowed"
  exit 1
fi

# Check if we are currently in a worktree or main repo
git_dir=$(git rev-parse --git-dir)
git_common_dir=$(git rev-parse --git-common-dir)

if [ "$git_dir" != "$git_common_dir" ]; then
  # We are in a worktree
  expected='"decision": "allow"'
  fail_msg="FAIL: src/main.ts in worktree should be allowed"
else
  # We are in main repo
  expected='"decision": "deny"'
  fail_msg="FAIL: src/main.ts in main repo should be denied"
fi

out5=$(./.agents/scripts/enforce_worktree.sh << INPUT
{"args": {"TargetFile": "$TOPLEVEL/src/main.ts"}}
INPUT
)
if ! echo "$out5" | grep -q "$expected"; then
  echo "$fail_msg"
  exit 1
fi
echo "All tests passed!"
