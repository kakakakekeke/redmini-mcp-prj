#!/bin/bash
# PreToolUse(Agent|Task): main 저장소 세션이 쓰기 가능한 서브에이전트를 격리 없이 호출하는 것을 차단.
# Antigravity의 enforce_subagent_workspace.sh(Workspace: share|branch 강제)에 대응한다.
# shellcheck source=lib.sh
. "${0%/*}/lib.sh"
read_hook_input
cwd=$(jq -r '.cwd // empty' <<<"$input")
is_main_checkout "${cwd:-$PWD}" || exit 0   # 이미 워크트리 안에서 실행 중이면 허용

isolation=$(jq -r '.tool_input.isolation // ""' <<<"$input")
agent_type=$(jq -r '.tool_input.subagent_type // "general-purpose"' <<<"$input")

case "$isolation" in worktree | remote) exit 0 ;; esac
case "$agent_type" in
  # 파일을 수정하지 않는 읽기 전용 에이전트는 예외
  Explore | Plan | claude-code-guide | statusline-setup | security-code-reviewer | deep-code-reviewer)
    exit 0 ;;
esac

pre_tool_deny "[Guardrail Violation] main 저장소에서 '$agent_type' 서브에이전트를 호출할 때는 isolation: \"worktree\"를 지정해야 합니다. (읽기 전용 Explore/Plan/리뷰어 에이전트는 예외)"
