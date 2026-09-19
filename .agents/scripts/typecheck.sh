#!/bin/bash
# Simple hook to run TypeScript type checking on file changes

# Read JSON from stdin (the hook payload)
PAYLOAD=$(cat)

# Extract the workspace path
WORKSPACE_PATH=$(echo "$PAYLOAD" | grep -o '"workspacePaths":\["[^"]*"' | sed 's/"workspacePaths":\["//')

if [ -n "$WORKSPACE_PATH" ]; then
    cd "$WORKSPACE_PATH" || exit 0
fi

# Run fast type check
npx tsc --noEmit > .agents/typecheck.log 2>&1
EXIT_CODE=$?

# If there is an error, we could output it, but for a PostToolUse hook, 
# we just return empty JSON. The agent can read .agents/typecheck.log if needed.
echo "{}"
exit 0
