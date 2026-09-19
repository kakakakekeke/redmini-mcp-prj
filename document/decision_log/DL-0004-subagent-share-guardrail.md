---
title: "DL-0004: 서브에이전트 격리 환경(share) 강제 및 Git Worktree 가드레일 고도화"
created: 2026-09-20
updated: 2026-09-20
tags:
  - DL
  - guardrail
  - worktree
  - subagent
aliases:
  - DL-0004-subagent-share-guardrail
status: active
related:
  - "[[git_workflow_sop]]"
---

# DL-0004: 서브에이전트 격리 환경(share) 강제 및 Git Worktree 가드레일 고도화

## 1. 결정 사항
서브에이전트(`invoke_subagent`) 호출 시 반드시 `Workspace: "share"` (또는 `"branch"`) 설정을 강제하여 격리된 Git Worktree에서 작업하도록 시스템 훅을 통해 제한합니다. 메인 저장소(Main Repository)에서는 문서(todo, index, DL, ADR 등)와 환경설정만 수정할 수 있도록 접근을 제어하고, 그 외 실제 개발 코드는 워크트리에서만 수정 가능하도록 Git Worktree 가드레일을 고도화합니다.

## 2. 배경 및 문제점
- 멀티 에이전트 환경에서 메인 브랜치 충돌 방지를 위해 `git worktree` 사용을 권장해왔으나, 이를 수동으로 수행하는 절차가 번거롭고 에이전트의 실수로 메인 저장소에서 직접 코드를 수정하는 사례가 발생했습니다.
- `invoke_subagent` 도구의 `Workspace` 인자를 활용하면 자동으로 안전한 워크트리 또는 브랜치 공유 환경이 구축됩니다.
- 따라서 단순 권장이 아닌 시스템적 차단의 "가드레일"을 구축하여 안정성을 보장할 필요가 있습니다.

## 3. 구현 방안
- **서브에이전트 훅 (`enforce_subagent_workspace.sh`)**: `invoke_subagent` 호출 전파 시 `Workspace`가 `share` 또는 `branch`인지 검사하는 `PreToolUse` 훅 구현.
- **워크트리 검사 훅 (`enforce_worktree.sh`)**: 에이전트가 메인 저장소에서 일반 코드 파일(`src`, `test` 등)을 조작하려는 시도를 차단하고 특정 화이트리스트 문서만 허용. Merge Commit은 예외 처리.
- **Git Hook (`.husky/pre-commit`)**: 메인 저장소에서의 커밋 중 화이트리스트 외 파일이 스테이징된 경우 커밋 차단.

## 4. 기대 효과
- 에이전트 간 Git 충돌 원천 차단.
- 메인 저장소의 안전한 환경 유지.
- 자동화된 격리 작업 환경 강제를 통한 생산성 증대 및 오류 방지.
