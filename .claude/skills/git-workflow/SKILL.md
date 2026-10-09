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
- 코어 파일(`package.json`, `tsconfig.json`, `vitest.config.*`, `document/index.md`, `src/index.ts`, `.agents/`, `AGENTS.md`, `.husky/`, `.claude/`, `CLAUDE.md`, `.mcp.json`, `.shellcheckrc`) 변경 시 본문에 `[Impact-Reviewed]` 포함. 병합 커밋은 병합되는 전체 변경분으로 판정하므로, 코어 파일을 건드린 브랜치를 병합할 때도 태그가 필요하다.
- `--no-verify`, `HUSKY=0`, `core.hooksPath` 변경 절대 금지(Bash 훅이 차단). 훅이 막으면 원인을 고친다.

## 2. 격리 환경
- **서브에이전트 위임 (기본)**: `Agent` 도구에 `isolation: "worktree"` 지정. WorktreeCreate 훅이 메인 체크아웃 HEAD 기준으로 `.worktrees/<name>`에 브랜치 `worktree-<name>`을 생성한다. 작업 시작 시 `git branch -m <타입>/<작업명>`으로 todo.md 항목의 브랜치명과 일치시킨다(타입은 커밋 타입과 동일: `feat/ fix/ docs/ chore/ test/ refactor/`). 서브에이전트는 그 안에서 별도 워크트리를 중첩 생성하지 않는다.
- **수동 생성**: 반드시 저장소 내부 `.worktrees/` 하위에 만든다.
  ```bash
  git worktree add .worktrees/<브랜치명-슬러그> -b <타입>/<작업명>
  ```
- main 저장소에서 직접 편집·커밋 가능한 경로는 `.agents/main_allowlist`(현재 `document/*`, `.env`)뿐이다. 가드레일 파일(`.husky/`, `.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`)을 포함한 그 외는 워크트리에서 커밋.
- 워크트리 커밋은 main의 훅으로 검사된다(`core.hooksPath` 절대 경로). 훅이 안 도는 것 같으면 `npm run prepare`.

## 3. 마무리
- 서브에이전트는 워크트리에서 커밋한 뒤 브랜치명과 커밋 요약을 최종 응답으로 보고한다.
- main 체크아웃에서 `cherry-pick`/`revert`/`am`은 훅을 거치지 않으므로 금지(Bash 훅이 차단). `--squash` 병합도 지원하지 않는다.
- 메인 세션은 `git merge --no-ff <branch>`로 병합한다 (`chore(merge): merge branch '<branch>' into main`). 병합 커밋도 pre-commit(타입·테스트·인덱스) 검사를 거친다.
- 병합 직후 main에서 `document/todo.md` 항목을 `[x]` 처리해 `docs(queue): ...`로 커밋하고, 수동 생성한 워크트리는 `git worktree remove`로 정리한다.
