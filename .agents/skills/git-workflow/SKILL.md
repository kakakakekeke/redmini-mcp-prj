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

## 2. 격리된 작업 환경 (Git Worktree) 사용법
다른 에이전트나 사람의 작업과 파일이 엉키지 않도록, **현재 저장소 디렉토리 외부**에 Worktree를 만들어 작업해야 합니다.

1. **Worktree 및 브랜치 생성 (샌드박스 우회 권장)**
   ```bash
   # 저장소 루트에서 실행
   git worktree add ../<프로젝트명>-<브랜치명> -b <브랜치명>
   # 예시: git worktree add ../redmini-mcp-prj-feature-login -b feature/login
   ```
2. **이동 및 작업 수행**
   ```bash
   cd ../<프로젝트명>-<브랜치명>
   npm install # 필요한 경우
   # ... 코드 수정 및 테스트 진행 ...
   ```
3. **커밋 및 정리(Cleanup)**
   ```bash
   git add .
   git commit -m "feat(auth): add login api"
   # 푸시 또는 병합 후, 원래 레포지토리로 돌아와서 Worktree 제거
   cd <원래_레포지토리_경로>
   git worktree remove ../<프로젝트명>-<브랜치명>
   git branch -d <브랜치명> # 필요한 경우 브랜치 삭제
   ```

## 3. 서브 에이전트 스폰 시의 팁
에이전트가 직접 `run_command`로 Worktree를 만들지 않고, 서브 에이전트를 스폰(`invoke_subagent`)하여 작업을 위임할 때는 `Workspace` 인자를 `"share"`로 주면 자동으로 부모와 스토리지를 공유하되 격리된 Worktree 환경이 구성됩니다. 적극 활용하십시오.
