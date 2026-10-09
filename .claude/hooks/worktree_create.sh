#!/bin/bash
# WorktreeCreate: 서브에이전트 워크트리를 기본 위치(.claude/worktrees/) 대신 .worktrees/<name> 에 생성.
# stdout 마지막 줄 = 워크트리 절대 경로. 그 외 출력은 모두 stderr로 보낸다.
set -e
input=$(cat)
name=$(jq -r '.name // empty' <<<"$input")
[ -n "$name" ] || { echo "WorktreeCreate: name 누락" >&2; exit 1; }
[[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || { echo "WorktreeCreate: 허용되지 않는 이름 '$name'" >&2; exit 1; }

repo=$(cd "${CLAUDE_PROJECT_DIR:-.}" && cd "$(git rev-parse --git-common-dir)/.." && pwd -P)
path="$repo/.worktrees/$name"
branch="worktree-$name"

mkdir -p "$repo/.worktrees"
if [ ! -d "$path" ]; then
  if git -C "$repo" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$repo" worktree add "$path" "$branch" >&2
  else
    # 메인 체크아웃의 현재 HEAD 기준으로 분기한다.
    git -C "$repo" worktree add "$path" -b "$branch" "$(git -C "${CLAUDE_PROJECT_DIR:-$repo}" rev-parse HEAD)" >&2
  fi
fi
# 의존성 재설치 비용을 줄이기 위해 메인 저장소의 node_modules 를 공유한다 (.gitignore 의 `node_modules` 로 무시됨).
[ -e "$path/node_modules" ] || [ ! -d "$repo/node_modules" ] || ln -s ../../node_modules "$path/node_modules"

# 상대 경로 hooksPath(.husky/_)는 워크트리에서 해석되지 않아 훅이 생략되므로 절대 경로로 복구한다. (DL-0028)
if [ -f "$repo/.husky/_/h" ] && [ "$(git -C "$repo" config core.hooksPath)" != "$repo/.husky/_" ]; then
  git -C "$repo" config core.hooksPath "$repo/.husky/_" >&2
fi

echo "$path"
