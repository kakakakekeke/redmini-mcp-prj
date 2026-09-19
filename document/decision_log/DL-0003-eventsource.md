---
title: "DL-0003: E2E 테스트 시 SSEClientTransport 동작을 위한 eventsource 패키지 도입"
created: "2026-09-19"
author: "E2E-Test-QA-Engineer"
tags:
  - decision-log
  - test
  - sse
---

# DL-0003: E2E 테스트 시 SSEClientTransport 동작을 위한 eventsource 패키지 도입

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
통합 테스트(E2E)에서 Node.js 환경 상의 클라이언트가 MCP 서버의 SSE(Server-Sent Events) 엔드포인트에 접속하기 위한 패키지 도입 결정.

## 2. 결정 사항 (Decision)
개발 의존성(`devDependencies`)으로 `eventsource` 및 `@types/eventsource`를 설치하고 `global.EventSource = EventSource as any;`로 폴리필(polyfill)하여 테스트를 수행한다.

## 3. 이유 (Reasoning)
- `@modelcontextprotocol/sdk/client/sse.js`의 `SSEClientTransport`는 브라우저 네이티브인 `EventSource` 객체를 기반으로 동작합니다.
- Node.js 테스트 환경(`vitest`)에는 기본적으로 `EventSource`가 존재하지 않아 `ReferenceError: EventSource is not defined` 에러가 발생합니다.
- 이에 따라 `eventsource` 라이브러리를 도입하여 E2E 테스트(TC-03 시나리오)가 정상 구동되도록 구성하였습니다.

## 4. 후속 조치 (Action Items)
- [x] E2E 통합 테스트 코드(`tests/e2e/integration.test.ts`) 상단에 `global.EventSource` 할당 추가.
- [x] `integration_test_scenarios.md` 시나리오 검증 및 업데이트.
