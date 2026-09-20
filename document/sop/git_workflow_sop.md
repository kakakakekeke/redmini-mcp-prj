---
title: "협업 및 멀티 에이전트 동시 작업을 위한 Git 워크플로우 SOP"
created: 2026-09-19
updated: 2026-09-19
version: 1.0
tags:
  - sop
  - git
  - worktree
  - commit-convention
  - multi-agent
---

# 표준 운영 절차 (SOP): Git 협업 및 워크플로우

## 1. 목적 (Purpose)
본 SOP는 Redmine MCP 프로젝트를 진행함에 있어 일관된 브랜치 관리, 커밋 메시지 컨벤션, 그리고 다중 AI 에이전트 환경에서 충돌 없이 동시 작업을 수행하기 위한 `git worktree` 기반의 격리된 작업 환경 구성 절차를 정의합니다.

## 2. 적용 범위 (Scope)
- 프로젝트에 참여하는 모든 인간 개발자 및 AI 코딩 에이전트
- 단일 Repository 상에서 병렬적으로 여러 기능(Feature)을 개발해야 하는 경우

## 3. 사전 준비 (Prerequisites)
- Git 2.5 이상 버전을 사용할 것 (git worktree 지원)
- 모든 작업은 최신 `main` 브랜치를 기준으로 분기할 것

## 4. 브랜치 및 커밋 규약 (Branch & Commit Conventions)

### 4.1. 브랜치 관리 전략
- **기본 브랜치**: `main` (항상 배포 가능한 상태를 유지)
- **작업 브랜치 네이밍 규칙**: `<타입>/<이슈번호_또는_작업명>`
  - 기능 개발: `feature/` (예: `feature/login-api`)
  - 버그 수정: `bugfix/` (예: `bugfix/fix-null-pointer`)
  - 문서 작업: `docs/` (예: `docs/update-readme`)
- **병합 방식**: 모든 작업은 완료 후 PR(Pull Request) 혹은 직접 병합 시 Fast-forward를 방지하고 커밋 히스토리를 깔끔하게 유지할 것.

### 4.2. 커밋 메시지 컨벤션 (Conventional Commits)
커밋 메시지는 다음 구조를 따릅니다.
```
<타입>(<스코프>): <제목>
<빈 줄>
<본문>
<빈 줄>
<꼬리말 (이슈 번호 등)>
```
- **타입 종류**:
  - `feat`: 새로운 기능 추가
  - `fix`: 버그 수정
  - `docs`: 문서 수정
  - `style`: 코드 포맷팅, 세미콜론 누락 등 (코드 변경 없음)
  - `refactor`: 코드 리팩토링
  - `test`: 테스트 코드, 리팩토링 테스트 코드 추가
  - `chore`: 빌드 업무 수정, 패키지 매니저 설정 등
- **제목 제약**: 영문 기준 50자 이내, 명령문 사용, 끝에 마침표(.) 금지. 한글 작성 시 명사형 종결 사용(예: "로그인 기능 추가").

## 5. 다중 에이전트 동시 작업을 위한 Worktree 절차 (Multi-Agent Worktree Procedure)

단일 저장소에서 여러 에이전트가 동시에 독립적인 태스크를 수행할 경우, 파일 수정 충돌을 방지하기 위해 Git Worktree를 사용하여 물리적으로 격리된 디렉토리를 생성해야 합니다. **본 프로젝트에서는 수동 `git worktree` 명령어 사용을 지양하고, 시스템에서 제공하는 `invoke_subagent` 툴의 `Workspace` 기능을 필수적으로 사용합니다.**

### 단계 1: 격리된 서브에이전트 호출 (Enforced)
새로운 코드 작성 및 기능 개발이 필요할 경우, 메인 에이전트는 직접 코드를 수정하지 말고 반드시 `invoke_subagent` 툴을 호출합니다.
- **필수 인자**: 서브에이전트 호출 시 반드시 `Workspace: "share"` (또는 `"branch"`)로 설정해야 합니다.
- **시스템 가드레일**: `Workspace`를 생략하거나 `inherit`으로 설정할 경우 훅(`subagent-workspace-enforcer`)에 의해 자동 차단됩니다.
- 메인 에이전트는 오직 `document/todo.md`, `index.md`, 설계 문서 등만을 조작합니다.

### 단계 2: 서브에이전트 작업 수행 및 커밋
- 서브에이전트는 자동으로 구성된 `.worktrees/` 하위 격리 환경에서 코드를 수정하고 단위 테스트를 수행합니다.
- **TO-DO 완료 동기화**: 작업 완료 후 서브에이전트는 반드시 `document/todo.md`에서 본인의 작업 항목을 대기열에서 완료 목록으로 이동하고 `[x]`로 완료 처리합니다. (누락 금지)
- **커밋**: 작업 완료 후 서브에이전트는 해당 격리 환경에서 `git add` 및 `git commit`을 수행합니다.

### 단계 3: 메인 에이전트로의 보고 및 병합 대기
- 서브에이전트는 자신의 작업을 마무리하고 메인 에이전트에게 결과를 보고(`send_message`)합니다.
- 수동 Worktree 정리나 삭제는 불필요하며, 시스템이 에이전트 수명주기에 맞춰 Worktree 디렉토리를 자동으로 관리(삭제)합니다.

## 6. 예외 처리 및 복구 (Exception Handling)
- **Worktree 삭제 실패**: 수동으로 디렉토리를 삭제한 경우, Git 내부 설정에 찌꺼기가 남습니다. 이 때는 `git worktree prune` 명령어를 사용하여 정리합니다.
- **Worktree 내에서 브랜치 전환 오류**: Worktree는 이미 특정 브랜치에 체크아웃되어 있습니다. 다른 Worktree에서 이미 체크아웃한 브랜치로는 전환할 수 없음에 주의하십시오.

## 7. 참고 문서 (References)
- [Git Worktree 공식 문서](https://git-scm.com/docs/git-worktree)
- [Conventional Commits](https://www.conventionalcommits.org/)
