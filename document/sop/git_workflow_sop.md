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

단일 저장소에서 여러 에이전트가 동시에 독립적인 태스크를 수행할 경우, Git Worktree를 사용하여 물리적으로 격리된 디렉토리를 생성해야 파일 수정 충돌을 방지할 수 있습니다.

### 단계 1: 새로운 브랜치 및 Worktree 생성
새로운 작업을 위해 현재 저장소 외부에 Worktree 디렉토리를 생성하고 새 브랜치를 연결합니다.
- **명령어**: 
  ```bash
  # 저장소 루트에서 실행
  git worktree add .worktrees/<브랜치명> -b <브랜치명>
  ```
  *(예: `git worktree add .worktrees/feature-login -b feature/login`)*
- **행동**: 새로운 에이전트를 스폰할 때, 해당 에이전트가 작업할 디렉토리로 생성된 Worktree 경로를 지정합니다.

### 단계 2: Worktree 환경에서 작업 수행
- **명령어**:
  ```bash
  cd .worktrees/<브랜치명>
  # 이후 의존성 설치(필요 시) 및 작업 수행
  npm install
  ```
- **행동**: 에이전트는 격리된 Worktree 디렉토리 안에서 코드를 수정하고, 테스트를 수행하며, 커밋을 진행합니다.

### 단계 3: 작업 완료 및 병합
작업이 완료되면 해당 브랜치를 리모트에 푸시하거나 로컬 `main`에 병합합니다.
- **명령어**:
  ```bash
  git add .
  git commit -m "feat(module): description"
  # PR 생성을 위해 푸시하는 경우:
  git push origin <브랜치명>
  ```

### 단계 4: Worktree 정리 (Cleanup)
작업과 병합이 완전히 끝난 후에는 사용한 Worktree를 삭제합니다.
- **명령어**:
  ```bash
  # 본래 저장소 디렉토리로 이동
  cd <본래_저장소_경로>
  git worktree remove .worktrees/<브랜치명>
  git branch -d <브랜치명>
  ```
- **검증**: `git worktree list`를 실행하여 정리된 목록을 확인합니다.

## 6. 예외 처리 및 복구 (Exception Handling)
- **Worktree 삭제 실패**: 수동으로 디렉토리를 삭제한 경우, Git 내부 설정에 찌꺼기가 남습니다. 이 때는 `git worktree prune` 명령어를 사용하여 정리합니다.
- **Worktree 내에서 브랜치 전환 오류**: Worktree는 이미 특정 브랜치에 체크아웃되어 있습니다. 다른 Worktree에서 이미 체크아웃한 브랜치로는 전환할 수 없음에 주의하십시오.

## 7. 참고 문서 (References)
- [Git Worktree 공식 문서](https://git-scm.com/docs/git-worktree)
- [Conventional Commits](https://www.conventionalcommits.org/)
