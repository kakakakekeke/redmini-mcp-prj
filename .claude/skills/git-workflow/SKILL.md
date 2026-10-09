---
name: git-workflow
description: Redmine MCP 프로젝트의 Git Worktree 기반 작업 절차와 커밋 컨벤션. 브랜치·워크트리를 만들거나 커밋·병합할 때 사용한다.
---

# Git Workflow & Worktree (Claude Code)

상세 규약: `document/sop/git_workflow_sop.md`. 커밋 전에 `.husky/pre-commit`, `.husky/commit-msg` 조건을 미리 반영한다.

## 1. 커밋 컨벤션
```
<타입>(<스코프>): <제목>
```
- 타입: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore` (스코프 필수)
- 제목: 영어 50자 이내 명령문, 마침표 금지. 한글은 명사형 종결.
- 코어 파일(`package.json`, `tsconfig.json`, `document/index.md`, `src/index.ts`, `.agents/`, `AGENTS.md`) 변경 시 본문에 `[Impact-Reviewed]` 포함.
- `--no-verify` 절대 금지. 훅이 막으면 원인을 고친다.

## 2. 격리 환경
- **서브에이전트 위임 (기본)**: `Agent` 도구에 `isolation: "worktree"` 지정. WorktreeCreate 훅이 메인 체크아웃 HEAD 기준으로 `.worktrees/<name>`에 브랜치 `worktree-<name>`을 생성한다. 필요하면 `git branch -m <타입>/<작업명>`으로 컨벤션에 맞게 이름을 바꾼다. 서브에이전트는 그 안에서 별도 워크트리를 중첩 생성하지 않는다.
- **수동 생성**: 반드시 저장소 내부 `.worktrees/` 하위에 만든다.
  ```bash
  git worktree add .worktrees/<브랜치명-슬러그> -b <타입>/<작업명>
  ```
- main 저장소에서 직접 커밋 가능한 파일: `document/**` 문서, `.env`, `.husky/*`. 그 외는 워크트리에서 커밋.

## 3. 마무리
- 서브에이전트는 워크트리에서 커밋한 뒤 브랜치명과 커밋 요약을 최종 응답으로 보고한다.
- 메인 세션은 `git merge --no-ff <branch>`로 병합하고 (`fix(merge): merge branch '<branch>' into main` 형식), 수동 생성한 워크트리는 `git worktree remove`로 정리한다.
