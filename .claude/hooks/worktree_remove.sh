#!/bin/bash
# WorktreeRemove: 커밋하지 않은 변경이 없을 때만 워크트리를 제거하고, main 에 병합된 경우에만 브랜치를 삭제한다(미병합 작업 보존).
input=$(cat)
path=$(jq -r '.worktree_path // empty' <<<"$input")
[ -n "$path" ] || exit 0
[ -d "$path" ] || exit 0

repo=$(cd "${CLAUDE_PROJECT_DIR:-.}" && cd "$(git rev-parse --git-common-dir)/.." && pwd -P)
branch=$(git -C "$path" symbolic-ref --short HEAD 2>/dev/null)

# 커밋하지 않은 작업이 있으면 삭제하지 않고 보존한다 (exit 1 → Claude Code가 제거 실패로 처리).
if [ -n "$(git -C "$path" status --porcelain 2>/dev/null)" ]; then
  echo "WorktreeRemove: '$path' 에 커밋하지 않은 변경이 있어 보존합니다." >&2
  exit 1
fi
git -C "$repo" worktree remove --force "$path" >&2 || exit 1
if [ -n "$branch" ] && [ "$branch" != "main" ]; then
  git -C "$repo" branch -d "$branch" >&2 2>/dev/null || echo "WorktreeRemove: 미병합 브랜치 '$branch' 보존" >&2
fi
exit 0
