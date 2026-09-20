---
title: "DL-0008: 서브에이전트 기능 커밋 시 TO-DO 대기열 완료([x]) 동기화 의무화"
created: 2026-09-20
author: Antigravity
tags:
  - decision-log
  - todo
  - subagent
  - workflow
---

# DL-0008: 서브에이전트 기능 커밋 시 TO-DO 대기열 완료([x]) 동기화 의무화

> **안내 (ADR과의 구분 규칙)**: 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
다중 에이전트 동시 작업 환경에서 서브에이전트가 코드와 테스트만 커밋하고 `document/todo.md`의 완료 상태를 갱신하지 않아 대기열 상태와 실제 구현 상태 간의 불일치가 발생하는 문제를 방지하기 위한 워크플로우 절차 정립.

## 2. 결정 사항 (Decision)
1. **서브에이전트 SOP 필수 단계 신설**: `vibe_tdd_sop.md` 및 `git_workflow_sop.md`에 'TO-DO 대기열 완료 동기화 및 커밋' 단계를 명시하여, 기능 구현 및 테스트/리뷰 통과 후 반드시 `document/todo.md`의 해당 항목을 `[x]` 처리하고 커밋하도록 의무화한다.
2. **프롬프트 가이드 강화**: 메인 에이전트가 `invoke_subagent`로 작업을 위임할 때 프롬프트의 체크리스트에 `document/todo.md` 완료 처리를 필수 조건으로 전달한다.
3. **엄격한 훅 차단(exit 1) 지양**: 과거 strict queue check로 인해 에이전트 무한 루프 및 충돌 문제가 빈번했으므로, 훅을 통한 강제 에러 차단 대신 SOP 절차 및 위임 프롬프트 수준의 명시적 가이드라인으로 통제한다.

## 3. 이유 (Reasoning)
- 과거 `pre-commit` 훅에서 대기열 순서 위반 시 `exit 1`로 차단했을 때, 병렬 작업이나 순서 조정 시 에이전트가 무한 루프에 빠지는 부작용이 발생하여 완화(Warning only)한 이력이 있음.
- 따라서 훅을 무리하게 강화하기보다는 서브에이전트의 작업 완결 정의(Definition of Done)에 `todo.md` 동기화를 명확히 편입시키는 것이 안전하고 신뢰성 높은 해결책임.

## 4. 후속 조치 (Action Items)
- [x] `document/sop/vibe_tdd_sop.md`에 TO-DO 완료 동기화 단계 추가
- [x] `document/sop/git_workflow_sop.md`에 서브에이전트 커밋 시 todo.md 갱신 규칙 반영
- [x] `document/index.md`에 DL-0008 등록
