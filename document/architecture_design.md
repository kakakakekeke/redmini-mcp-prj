---
title: 자체 Redmine MCP 서버 아키텍처 설계서 (Multi-User & LLM Optimized)
created: 2026-09-19
updated: 2026-09-21
tags:
  - architecture
  - mcp
  - multi-user
  - streamable-http
  - stdio
aliases:
  - Architecture Design
status: draft
---

# 자체 Redmine MCP 서버 아키텍처 설계서

> [!important] 설계 핵심 목표
> 본 아키텍처는 부서 단위의 다중 사용자(Multi-user) 환경을 지원하고, 기존 오픈소스의 장점(Smart Name Resolver, 서식 변환)을 흡수하여 LLM의 토큰 효율과 정확성을 극대화하는 데 목적이 있습니다.

## 1. 아키텍처 개요 및 기술 스택

*   **언어 및 런타임**: TypeScript / Node.js
*   **핵심 라이브러리**:
    *   `@modelcontextprotocol/sdk`: 공식 MCP 프로토콜 구현체
    *   `express`: HTTP(Streamable HTTP) 전송 방식 지원을 위한 웹 프레임워크
    *   `axios`: Redmine REST API 통신용 HTTP 클라이언트
    *   `zod`: LLM 입력값에 대한 강력한 런타임 타입 검증

---

## 2. 전송 계층 (Transport Layer) 이중화 설계

부서 공용 서버 배포 및 로컬 테스트를 모두 만족시키기 위해 두 가지 전송 방식을 모두 구현(Dual-Transport)합니다.

1.  **Streamable HTTP (`StreamableHTTPServerTransport`) 방식 (주력)**
    *   **용도**: 부서 중앙 서버에 배포하여 여러 사용자가 네트워크를 통해 접근.
    *   **구현**: `express` 웹 서버를 띄우고, `/mcp` 단일 엔드포인트(GET/POST/DELETE)를 통해 클라이언트와 통신. 세션 ID 발급, 메시지 송수신 및 SSE 스트리밍을 통합 처리.
2.  **Stdio (Standard I/O) 방식 (보조)**
    *   **용도**: 로컬 환경에서의 빠른 디버깅, 혹은 특정 사용자가 자신의 PC(Claude Desktop, Cursor)에서 직접 단독 실행할 때 사용.
    *   **구현**: 프로세스의 표준 입출력을 통해 통신 (기본 MCP 방식).

---

## 3. 다중 사용자 및 다중 인증 아키텍처 (Multi-User Auth)

사내 공용 서버로 사용되므로, Audit Trail(감사 기록)과 RBAC(역할 기반 접근 제어)를 위해 **요청별 사용자 식별**이 필수적입니다.

*   **인증 전략 1: Per-User API Key (Streamable HTTP 전용)**
    *   클라이언트(사용자의 LLM 앱)가 HTTP 요청 헤더에 `X-Redmine-API-Key`를 포함하여 전송.
    *   MCP 서버는 이 헤더를 추출하여 Redmine API 호출 시 그대로 위임 전달.
    *   결과적으로 Redmine에는 실제 요청한 부서원의 이름으로 일감 조회 및 활동이 기록됨.
*   **인증 전략 2: 시스템 전역 API Key (Stdio / Fallback)**
    *   환경 변수 `REDMINE_API_KEY`를 통해 주입.
    *   개인 로컬에서 Stdio로 띄울 때나, 공용 봇 계정으로 동작해도 무방한 제한된 환경에서 사용.
*   **인증 전략 3: 확장성 고려 (OAuth2 등)**
    *   인증 로직을 `AuthMiddleware` 형태로 분리하여, 향후 사내 SSO나 OAuth2(Bearer Token) 방식으로 쉽게 교체/확장할 수 있도록 인터페이스화.

---

## 4. LLM 최적화 기능 설계 (오픈소스 벤치마킹)

기존 오픈소스 프로젝트들의 한계를 극복하고 LLM의 성능을 끌어올리기 위한 기능 계층입니다.

1.  **Smart Name Resolver (이름 ↔ 숫자 ID 자동 매핑)**
    *   **문제**: LLM은 "결함 트래커로 만들어줘"라고 할 때 `tracker_id: 1`이라는 내부 숫자를 알기 어려움.
    *   **해결**: 서버 기동 시 또는 주기적으로 Redmine의 메타데이터(프로젝트 목록, 트래커, 상태, 우선순위, 사용자 명단)를 인메모리에 캐싱.
    *   LLM이 문자열(`"status": "진행중"`)을 넘기면 리졸버가 자동으로 숫자 ID(`2`)로 매핑하여 Redmine API에 전달.
2.  **도구 압축 (Tool Compression)**
    *   API 개수만큼 도구를 만들지 않고, MVP 명세서(`mcp_tools_spec.md`)에 정의된 대로 범용적인 도구(예: `search_issues`) 하나가 다양한 파라미터(필터)를 소화하도록 설계하여 프롬프트 토큰 절약.
3.  **마크다운(Markdown) ↔ 텍스타일(Textile) 변환기 (선택/확장)**
    *   LLM은 기본적으로 Markdown 포맷으로 텍스트를 생성.
    *   사내 Redmine이 Textile 포맷을 사용 중이라면, 도구 내부에서 저장 전 변환(Markdown -> Textile), 조회 후 변환(Textile -> Markdown)을 수행하는 유틸리티 파이프라인 추가.

---

## 5. 프로젝트 디렉토리 구조 (Directory Structure)

```text
src/
├── index.ts               # 진입점 (CLI 인자 파싱 및 서버 실행)
├── server/
│   ├── mcp-server.ts      # MCP 서버 인스턴스 초기화 및 도구(Tools) 등록
│   ├── stdio-runner.ts    # Stdio 전송 계층 핸들러
│   └── streamable-http-runner.ts # HTTP(Express) Streamable HTTP 전송 계층 핸들러
├── redmine/
│   ├── client.ts          # Axios 기반 Redmine API 통신 클라이언트 (인증 위임 처리)
│   ├── resolver.ts        # Smart Name Resolver (캐시 및 매핑 로직)
│   └── formatter.ts       # Markdown/Textile 변환 유틸
├── tools/
│   ├── index.ts           # 도구 라우터 (Tool Handler)
│   ├── searchIssues.ts    # 일감 검색 로직 (Zod 스키마 포함)
│   └── getIssueDetails.ts # 일감 상세 조회 로직 (Zod 스키마 포함)
└── utils/
    ├── logger.ts          # 민감정보 마스킹 처리된 로거
    └── config.ts          # 환경변수(Redmine URL 등) 파서
```
