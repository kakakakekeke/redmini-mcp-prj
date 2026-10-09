---
name: git-workflow
description: Redmine MCP 프로젝트의 Git Worktree 기반 다중 에이전트 동시 작업 절차 및 커밋 컨벤션 가이드입니다. 브랜치를 생성하거나 커밋을 할 때 반드시 이 스킬을 참고하세요.
---

# Git Workflow & Worktree Skill

이 스킬은 Redmine MCP 프로젝트에서 충돌 없이 안전하게 코드를 개발하고 병합하기 위한 필수 행동 지침입니다. 에이전트가 새로운 기능을 개발하거나 버그를 수정할 때 이 가이드를 엄격히 따르십시오.

## 1. 커밋 컨벤션 (Conventional Commits)
커밋을 수행할 때는 반드시 아래의 형식을 따르세요.
```
<타입>(<스코프>): <제목>
```
* **타입**: `feat` (기능), `fix` (버그), `docs` (문서), `style` (포맷팅), `refactor` (리팩토링), `test` (테스트), `chore` (기타)
* **제목**: 영어 기준 50자 이내, 명령문 사용, 마침표 금지. 한글 사용 시 명사형으로 끝맺음.
* **코어 파일**(`package.json`, `tsconfig.json`, `vitest.config.*`, `document/index.md`, `src/index.ts`, `.agents/`, `AGENTS.md`, `.husky/`, `.claude/`, `CLAUDE.md`, `.mcp.json`) 변경 시 본문에 `[Impact-Reviewed]` 포함. 병합 커밋도 병합되는 전체 변경분 기준으로 판정됩니다.
* **훅 우회 금지**: `--no-verify`, `HUSKY=0`, `core.hooksPath` 변경, main 체크아웃에서의 `cherry-pick`/`revert`/`am` 금지.

## 2. 격리된 작업 환경 (Git Worktree) 사용법 (Manual)
시스템 도구 `invoke_subagent` 사용을 최우선으로 하되, 부득이 수동으로 워크트리를 생성할 경우, 경로 파편화를 막기 위해 반드시 **메인 저장소 내부의 `.worktrees/` 디렉토리 하위**에 생성하십시오.

1. **Worktree 및 브랜치 생성**
   ```bash
   # 저장소 루트에서 실행
   git worktree add .worktrees/<브랜치명> -b <브랜치명>
   # 예시: git worktree add .worktrees/feat-login -b feat/login (타입은 커밋 타입과 동일)
   ```
2. **이동 및 작업 수행**
   ```bash
   cd .worktrees/<브랜치명>
   # ... 코드 수정 및 테스트 진행 ...
   ```
3. **커밋**
   ```bash
   git add .
   git commit -m "feat(auth): add login api"
   ```
   워크트리 커밋도 main 의 husky 훅으로 검사됩니다(`core.hooksPath` 절대 경로). 훅이 실행되지 않으면 메인 저장소에서 `npm run prepare`를 실행하세요.
4. **병합 및 정리 (메인 에이전트)**
   ```bash
   cd <원래_레포지토리_루트>
   git merge --no-ff <브랜치명> -m "chore(merge): merge branch '<브랜치명>' into main"
   # 병합 직후 document/todo.md 항목을 [x] 처리해 docs(queue) 커밋
   git worktree remove .worktrees/<브랜치명>
   ```
   **병합한 뒤에** 워크트리를 제거합니다. `--squash` 병합은 지원하지 않습니다.

## 3. 서브 에이전트 스폰 제약 사항 (필수 제약)
메인 에이전트는 일반 개발 코드를 직접 수정할 수 없도록 가드레일이 설정되어 있습니다. 따라서 새로운 기능 구현 시 서브 에이전트를 스폰(`invoke_subagent`)하여 작업을 위임해야 합니다.
**[main 허용 경로]**: main 저장소에서 직접 편집·커밋할 수 있는 경로는 `.agents/main_allowlist`(현재 `document/*`, `.env`)뿐입니다.
**[todo.md 소유권]**: 서브에이전트는 작업 브랜치에서 `document/todo.md`를 수정하지 않습니다. 완료 처리는 병합 후 메인 에이전트가 합니다. (DL-0028)
**[필수 사항]**: `invoke_subagent` 호출 시 `Workspace` 인자를 반드시 `"share"` (또는 `"branch"`)로 설정해야 합니다. (기본값인 `inherit`을 사용할 경우 시스템 훅에 의해 즉시 차단됩니다.) 이를 통해 자동으로 `.worktrees/` 하위에 안전하게 격리된 환경이 구성됩니다.
