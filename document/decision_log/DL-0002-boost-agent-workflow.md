---
title: "DL-0002: /boost 모드(DeepCoder) 도입 결과 및 다중 에이전트 워크플로우 최적화"
created: 2026-09-19
updated: 2026-09-19
tags:
  - DL
  - boost
  - multi-agent
  - workflow
  - husky
aliases:
  - Boost Agent Lessons
  - DeepCoder Workflow
status: active
related:
  - "[[todo]]"
  - "[[git_workflow_sop|document/sop/git_workflow_sop.md]]"
---

# DL-0002: /boost 모드(DeepCoder) 도입 결과 및 다중 에이전트 워크플로우 최적화

## 1. 배경 (Context)
* Redmine MCP 서버 프로젝트 진행 중, 단순 기능 구현을 넘어 복잡한 아키텍처(예: Express 기반 SSE 전송 계층 설계, 인증 미들웨어)를 해결하기 위해 딥-리서치 특화 자율 에이전트인 `/boost` (DeepCoder) 모드를 시범 도입함.
* 1번 큐(SSE Layer)와 2번 큐(Auth Middleware)를 병렬로 DeepCoder 서브에이전트에게 할당하여 성과와 한계를 측정함.

## 2. 관찰 및 분석 (Observations)

### 2.1. 긍정적 성과 (Pros: Deep-Engineering)
* **아키텍처 통찰력**: SSE 계층 구현 시 단순히 Express 라우터를 붙이는 데 그치지 않고, MCP SDK의 `McpServer` 싱글톤 패턴이 다중 접속 환경에서 갖는 동시성 결함을 스스로 발견함.
* **자율적 패턴 도입**: 문제를 해결하기 위해 `Map` 기반의 Factory Pattern을 도입하여 세션을 분리하고, 메모리 누수 방지를 위한 TTL Heartbeat 로직까지 주도적으로 구현함.
* **SOP 준수**: 에이전트 트랜잭션 로그 분석 결과, `/boost` 서브에이전트는 프로젝트의 `vibe_tdd_sop.md`, `git_workflow_sop.md` 및 관련 Skill 파일들을 정확히 열람하고 TDD(실패하는 테스트 먼저 작성) 원칙을 완벽히 지킴.

### 2.2. 한계점 (Cons: System Guardrail Trap)
* **가드레일 충돌 및 무한 루프**: Auth Middleware 구현 서브에이전트는 코드와 테스트를 완벽히 작성했음에도 불구하고, Husky `pre-commit` 훅의 엄격한 선형 큐 제약(현재 브랜치명이 `todo.md`의 1순위와 다르면 `exit 1`)에 가로막혀 커밋에 실패함.
* **상황 인지 실패**: 서브에이전트는 이 에러를 시스템 정책 위반이 아닌 '자신의 코드 결함'으로 오인하여, 코드를 계속 수정하며 커밋을 재시도하는 무한 대기(Hang) 루프에 빠짐.

## 3. 결정 사항 (Decisions)

1. **대기열 통제 완화 (Strict -> Soft Constraint)**
   * `todo.md`의 선형 진행 강제 훅을 **Warning(경고)** 수준으로 완화함.
   * 이를 통해 핫픽스나 다중 에이전트 동시 작업 시 훅에 가로막혀 작업이 마비되는 현상을 방지함.
2. **SOP 내 무한 루프 방지 지침 추가**
   * `vibe_tdd_sop.md` 최하단에 에이전트가 훅 에러(Queue Error)를 만났을 때 맹목적으로 재시도하지 말고 작업을 중단한 뒤 사용자/부모 에이전트에게 보고하도록 명문화함.
3. **작업 난이도별 에이전트 분할 배치 전략**
   * **일반 모드 (Solo)**: 단순 CRUD, 명세 기반 REST API 연동 도구 등 룰과 정형성이 중요한 태스크에 배치.
   * **`/boost` 모드**: 동시성 설계, 메모리 구조 개선, 대규모 리팩토링 등 깊은 통찰이 필요한 태스크에 배치하되, 시스템 통제 훅과 충돌하지 않도록 메인 에이전트가 큐와 형상관리를 조율하는 "협업 패러다임"을 채택함.

## 4. 파급 효과 (Impact)
* 에이전트가 커스텀 훅에 갇혀 컴퓨팅 리소스를 낭비하는 것을 방지.
* `todo.md`의 계획을 유지하면서도 긴급 대응이 가능한 유연한 형상 관리 체계 확립.
