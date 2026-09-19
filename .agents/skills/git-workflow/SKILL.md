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

## 2. 격리된 작업 환경 (Git Worktree) 사용법 (Manual)
시스템 도구 `invoke_subagent` 사용을 최우선으로 하되, 부득이 수동으로 워크트리를 생성할 경우, 경로 파편화를 막기 위해 반드시 **메인 저장소 내부의 `.worktrees/` 디렉토리 하위**에 생성하십시오.

1. **Worktree 및 브랜치 생성**
   ```bash
   # 저장소 루트에서 실행
   git worktree add .worktrees/<브랜치명> -b <브랜치명>
   # 예시: git worktree add .worktrees/feature-login -b feature/login
   ```
2. **이동 및 작업 수행**
   ```bash
   cd .worktrees/<브랜치명>
   # ... 코드 수정 및 테스트 진행 ...
   ```
3. **커밋 및 정리(Cleanup)**
   ```bash
   git add .
   git commit -m "feat(auth): add login api"
   cd <원래_레포지토리_루트>
   git worktree remove .worktrees/<브랜치명>
   ```

## 3. 서브 에이전트 스폰 제약 사항 (필수 제약)
메인 에이전트는 일반 개발 코드를 직접 수정할 수 없도록 가드레일이 설정되어 있습니다. 따라서 새로운 기능 구현 시 서브 에이전트를 스폰(`invoke_subagent`)하여 작업을 위임해야 합니다.
**[필수 사항]**: `invoke_subagent` 호출 시 `Workspace` 인자를 반드시 `"share"` (또는 `"branch"`)로 설정해야 합니다. (기본값인 `inherit`을 사용할 경우 시스템 훅에 의해 즉시 차단됩니다.) 이를 통해 자동으로 `.worktrees/` 하위에 안전하게 격리된 환경이 구성됩니다.
