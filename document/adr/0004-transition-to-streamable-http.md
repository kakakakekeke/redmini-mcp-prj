---
title: "ADR-0004: 레거시 SSE 전송 계층 폐기 및 Streamable HTTP 전송 계층 채택"
created: 2026-09-21
updated: 2026-09-21
status: Accepted
tags:
  - adr
  - architecture
  - mcp
  - streamable-http
  - stdio
---

# ADR-0004: 레거시 SSE 전송 계층 폐기 및 Streamable HTTP 전송 계층 채택

## 1. 배경 및 맥락 (Context)
- 초기 MCP 구현에서는 HTTP 기반 통신 방식으로 `SSEServerTransport`를 이용한 SSE(`/mcp/sse` + `/mcp/message`) 방식을 도입하였습니다.
- 그러나 `@modelcontextprotocol/sdk` 최신 사양에서 `SSEServerTransport`가 공식적으로 `@deprecated` 처리되었으며, 2025-03-26 MCP 표준 스펙에 따라 **Streamable HTTP 전송 계층(`StreamableHTTPServerTransport`)**이 공식 표준으로 지정되었습니다.
- 레거시 SSE 방식은 엔드포인트 분리(`/mcp/sse`, `/mcp/message`), 바디 파서 미들웨어 간섭 시 스트림 고갈 문제, 인메모리 세션 바인딩으로 인한 수평 확장 제약 등 여러 기술적 한계를 가지고 있었습니다.
- 이에 따라 레거시 SSE 전송 계층을 제거하고, 최신 표준인 **Streamable HTTP** 및 로컬 단독 실행용 **Stdio**의 이중 전송 체제로 전면 전환하기로 결정하였습니다.

## 2. 고려한 대안들 (Considered Options)
- **대안 1: 레거시 SSE 전송 계층 유지 및 안정화 패치**
  - 기존 `/mcp/sse`, `/mcp/message` 구조를 유지하면서 CORS 및 바디 파서 패치만 적용.
  - 문제점: MCP 공식 SDK에서 이미 deprecated 처리된 기술 부채를 계속 안고 가야 함.
- **대안 2: 레거시 SSE와 Streamable HTTP 동시 서빙 (Dual-Serving)**
  - `/mcp/sse`와 `/mcp`를 동시에 열어 Cursor 등 레거시 클라이언트와 최신 클라이언트를 모두 지원.
  - 문제점: 코드 복잡도 증가 및 동일 목적의 전송 계층 이중 유지보수 비용 발생. 사용자의 명시적 지침("Streamable HTTP & stdio 두 개 지원으로 가자")에 따라 단일화하기로 함.
- **대안 3 (선택안): Streamable HTTP (`StreamableHTTPServerTransport`) & Stdio 이중 체제로 단일화**
  - 레거시 SSE 엔드포인트를 완전히 제거하고 `/mcp` 단일 엔드포인트(Streamable HTTP)와 로컬 `stdio`만 공식 지원.

## 3. 최종 결정 (Decision)
우리는 **최신 MCP 사양 준수, 엔드포인트 단순화, 향후 무상태(Stateless) 수평 확장 가능성 확보**를 위해 레거시 SSE를 폐기하고 **Streamable HTTP(`StreamableHTTPServerTransport`)와 Stdio**의 2개 전송 계층만을 지원하기로 결정했다.

## 4. 결정 근거 (Rationale)
1. **공식 표준 일치**: `@modelcontextprotocol/sdk`의 최신 전송 계층 사양을 충족하여 라이브러리 지원 중단 위험을 제거.
2. **엔드포인트 일원화**: `ALL /mcp` (GET/POST/DELETE) 단일 엔드포인트로 초기화, 도구 호출, 세션 종료를 통일하여 라우팅 구조 단순화.
3. **바디 파서 호환성**: `handleRequest(req, res, req.body)`에서 pre-parsed 바디를 완벽히 지원하여 미들웨어 충돌 방지.
4. **로컬 개발자 지원**: 원격 HTTP 연결이 어려운 클라이언트(예: Cursor IDE)는 고성능 로컬 `stdio` 모드를 통해 온전히 지원 가능.

## 5. 결과 및 영향 (Consequences)
- **긍정적 영향**:
  - SSE 전용 주석 핑(`:\n\n`) 루프 및 복잡한 세션 수명주기 코드 대폭 단순화.
  - 최신 MCP 클라이언트 및 프록시 환경과의 상호 운용성 향상.
  - `/health` 엔드포인트 분리로 컨테이너 헬스체크 오버헤드 및 로그 노이즈 제거.
- **주의 및 트레이드오프**:
  - Cursor IDE에서 원격 HTTP 접속이 불가능해지므로, Cursor 사용자는 `stdio` 연동 가이드를 따라야 함.
  - E2E 통합 테스트 클라이언트를 `StreamableHTTPClientTransport`로 전환 필요.

## 6. 참고 및 연관 문서 (References)
- [[0001-initial-architecture]]
- [[DL-0016-cors-middleware]]
- [[setup_and_deployment]]
