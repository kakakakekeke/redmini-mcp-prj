#!/bin/bash
# PreToolUse(Edit|Write|MultiEdit|NotebookEdit): main 저장소에서 화이트리스트 외 파일 수정 차단.
# 규칙은 .agents/scripts/enforce_worktree.sh(Antigravity)와 동일하다.
. "${0%/*}/lib.sh"
read_hook_input
target=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
[ -z "$target" ] && exit 0
case "$target" in /*) ;; *) target="$(jq -r '.cwd // empty' <<<"$input")/$target" ;; esac

# 존재하지 않는 디렉터리를 경유한 ../ 는 정규화할 수 없으므로 '.'/'..' 세그먼트 자체를 거부한다.
case "/$target/" in
  */../* | */./*) pre_tool_deny "[SOP Violation] '.' 또는 '..' 세그먼트가 포함된 경로는 허용되지 않습니다. 정규화된 절대 경로를 사용하세요: $target"; exit 0 ;;
  */.git/*) pre_tool_deny "[SOP Violation] .git/ 내부 파일(설정·훅)은 에이전트가 직접 수정할 수 없습니다: $target"; exit 0 ;;
esac

dir=$(nearest_existing_dir "$target")
toplevel=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || exit 0  # git 저장소 밖: 허용

# 이 프로젝트 저장소가 아닌 다른 저장소는 관여하지 않는다.
project_common=$(cd "${CLAUDE_PROJECT_DIR:-.}" && cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)
target_common=$(cd "$dir" && cd "$(git rev-parse --git-common-dir)" && pwd -P)
[ -n "$project_common" ] && [ "$project_common" != "$target_common" ] && exit 0

# 심볼릭 링크는 화이트리스트 경로를 통해 다른 파일로 쓰기를 우회시킬 수 있으므로 거부한다.
if [ -L "$target" ]; then
  pre_tool_deny "[SOP Violation] 심볼릭 링크 파일은 직접 수정할 수 없습니다. 링크 대상 파일을 워크트리에서 수정하세요: $target"
  exit 0
fi

is_main_checkout "$target" || exit 0                                       # 워크트리: 허용

toplevel=$(cd "$toplevel" && pwd -P)
abs="$(cd "$dir" && pwd -P)/${target#"$dir"}"
abs=${abs//\/\//\/}
rel=${abs#"$toplevel/"}

case "$rel" in
  document/todo.md | document/index.md | document/decision_log/* | document/adr/* | .env)
    exit 0 ;;
esac

# 병합 충돌 해결 중인 파일은 허용
git_dir=$(git -C "$toplevel" rev-parse --absolute-git-dir)
if [ -f "$git_dir/MERGE_HEAD" ] && git -C "$toplevel" ls-files --unmerged | cut -f2 | grep -Fxq "$rel"; then
  exit 0
fi

pre_tool_deny "[SOP Violation] main 저장소에서 '$rel' 을(를) 직접 수정할 수 없습니다. 코드는 Agent 도구(isolation: \"worktree\")로 위임하거나 .worktrees/ 워크트리에서 수정하세요. (허용: document/todo.md, document/index.md, document/decision_log/*, document/adr/*, .env)"
