---
title: "ADR-0002: 테스트 아키텍처 및 Mocking 전략 결정"
created: 2026-09-19
updated: 2026-09-19
status: Accepted
tags:
  - adr
  - architecture
  - test
  - tdd
---

# ADR-0002: 테스트 아키텍처 및 Mocking 전략 결정

## 1. 배경 및 맥락 (Context)
Redmine MCP 프로젝트는 AI 에이전트 주도의 바이브 코딩(Vibe Coding)을 위해 TDD(Test-Driven Development) 방식을 채택했습니다(`DL-0001-vitest`, `vibe_tdd_sop`).
LLM이 코드를 작성하고 즉각적으로 피드백을 받으려면 빠르고 결정론적인(deterministic) 테스트 환경이 필수적입니다. 이를 위해 단위(Unit), 통합(Integration), E2E 테스트의 경계를 정의하고 외부 의존성(Redmine API)을 통제하기 위한 Mocking 전략을 확립해야 합니다.

## 2. 고려한 대안들 (Considered Options)
- **대안 1: `vi.mock`을 사용한 모듈 단위 모킹 (단위 테스트 중심)**
  - 장점: 설정이 매우 간단하고 테스트 실행 속도가 가장 빠름.
  - 단점: 실제 HTTP 요청이 발생하지 않아 네트워크 계층의 에러를 잡기 어려움.
- **대안 2: MSW (Mock Service Worker)를 사용한 네트워크 레벨 모킹**
  - 장점: 실제 Axios/Fetch 호출을 가로채어 모킹하므로 실제 API 통신과 유사한 검증 가능.
  - 단점: 초기 설정 비용이 발생하며, 단위 테스트보다는 약간 무거움.
- **대안 3: 실제 Redmine 테스트 서버를 연동한 E2E 테스트 중심**
  - 장점: 실제 환경과 100% 동일하여 신뢰도가 높음.
  - 단점: 네트워크 지연, 서버 상태에 따라 테스트가 실패하는 등 플래키(Flaky) 테스트 발생 가능성이 높아 TDD 피드백 루프에 부적합함.

## 3. 최종 결정 (Decision)
우리는 **"테스트 피라미드 (Test Pyramid)" 모델**을 채택하고 각 계층별로 다음의 전략을 사용하기로 결정했습니다.

1. **단위 테스트 (Unit Test) - 핵심 로직 검증**
   - **도구**: `vitest`, `vi.mock()`
   - **대상**: Smart Name Resolver 로직, 데이터 변환(Textile ↔ Markdown), Tool 파라미터 유효성 검사 (Zod 스키마).
   - **전략**: 외부 호출이 필요한 클래스(API Client)를 `vi.mock`으로 완전히 대체하여 로직 자체에만 집중합니다.
2. **통합 테스트 (Integration Test) - 통신 계층 검증**
   - **도구**: `vitest`, MSW(Mock Service Worker) 또는 Nock
   - **대상**: Redmine API Client, MCP 서버 Tool 핸들러.
   - **전략**: 실제 HTTP 클라이언트 로직을 실행하되 네트워크 요청을 MSW로 가로채어 미리 정의된 Mock JSON을 반환하게 합니다. 이를 통해 HTTP 상태 코드(200, 404, 422) 및 타임아웃 처리를 검증합니다.
3. **E2E / 인수 테스트 (UAT) - 실제 환경 연동**
   - **도구**: Claude Desktop, 실제 Redmine 테스트 서버
   - **대상**: MCP StdIO/SSE 통신 계층, 다중 사용자 인증, 실제 Redmine DB 상태 변경.
   - **전략**: 자동화된 스크립트 대신 `integration_test_scenarios.md` 문서 기반으로 수동/반자동 검증을 수행합니다.

## 4. 결정 근거 (Rationale)
바이브 코딩 TDD SOP를 완수하려면 에이전트가 단일 명령(`npx vitest run`)으로 전체 테스트를 1초 이내에 검증해야 합니다. 외부 Redmine 서버에 의존하면 속도 지연과 상태 변화로 인해 자동 테스트가 붕괴됩니다. 따라서 자동화된 테스트는 Mock 기반으로 구성하고, E2E는 별도로 분리하는 것이 구조적으로 안전합니다.

## 5. 결과 및 영향 (Consequences)
- **개발 워크플로우**: 에이전트는 기능을 구현할 때 반드시 **1) `vi.mock` 기반의 Unit Test** 또는 **2) MSW 기반의 HTTP Mock Test** 중 하나를 작성해야 합니다.
- **디렉토리 구조**: 
  - `tests/unit/`: 단위 테스트 파일 위치
  - `tests/integration/`: Mock 서버 기반 통합 테스트 파일 위치
  - `tests/fixtures/`: Redmine API Mock JSON 데이터 보관소
- **Mock 데이터 관리**: Redmine 공식 API의 응답 스키마가 변경될 경우 `tests/fixtures/` 데이터를 수동으로 갱신해야 하는 유지보수 비용이 발생합니다. (`document/redmine_api_specification.md` 활용)

## 6. 참고 및 연관 문서 (References)
- `document/sop/vibe_tdd_sop.md`: 바이브 코딩 기반 TDD 워크플로우
- `document/integration_test_scenarios.md`: 통합 테스트(E2E) 시나리오
- `document/decision_log/DL-0001-vitest.md`: Vitest 도입 결정
