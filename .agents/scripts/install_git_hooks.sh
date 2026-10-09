#!/bin/sh
# husky 설치 후 core.hooksPath 를 메인 저장소 .husky/_ 의 절대 경로로 고정한다. (DL-0028)
# husky 기본값(상대 경로 .husky/_)은 워크트리 루트 기준으로 해석되는데, 워크트리에는 .husky/_ 가
# 없으므로 git 이 훅을 조용히 건너뛴다. 절대 경로로 고정하면 모든 워크트리에서 메인 저장소의
# 훅 스크립트가 실행된다 (브랜치에서 수정한 훅은 병합 후에 적용됨).
warn() { echo "[install_git_hooks] $*" >&2; }

command -v git >/dev/null 2>&1 || { warn "git 이 없어 훅 설치를 건너뜀"; exit 0; }
git rev-parse --git-dir >/dev/null 2>&1 || { warn "git 저장소가 아니어서 훅 설치를 건너뜀 (Docker 빌드 등)"; exit 0; }

# 첫 번째 워크트리 항목 = 메인 체크아웃 (어느 워크트리에서 실행해도 동일)
root=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
if [ -z "$root" ] || [ ! -d "$root/.husky" ]; then
  warn "메인 체크아웃의 .husky 를 찾지 못해 훅 설치를 건너뜀 (root=$root)"
  exit 0
fi
root=$(cd "$root" && pwd -P)
if [ ! -x "$root/node_modules/.bin/husky" ]; then
  warn "메인 체크아웃에 husky 가 설치되어 있지 않아 건너뜀. 메인 저장소에서 npm install 을 실행하세요."
  exit 0
fi
(cd "$root" && node_modules/.bin/husky >/dev/null) || { warn "husky 실행 실패"; exit 1; }
git config core.hooksPath "$root/.husky/_"
