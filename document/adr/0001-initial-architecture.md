---
title: "ADR-0001: Redmine MCP 서버 초기 아키텍처 및 기술 스택 결정"
created: 2026-09-19
updated: 2026-09-19
status: Accepted
tags:
  - adr
  - architecture
  - typescript
---

# ADR-0001: Redmine MCP 서버 초기 아키텍처 및 기술 스택 결정

## 1. 배경 및 맥락 (Context)
Redmine 인스턴스와 AI 에이전트(Claude Desktop 등)를 연동하는 MCP 서버를 사내 부서 공용으로 개발해야 합니다. 기존 여러 오픈소스(Python, Go, Rust 등)를 조사한 결과, LLM 최적화 부족(Tool Bloat, 숫자 ID 강제)과 단일 사용자 권한 한계 등의 문제점을 발견했습니다.

## 2. 고려한 대안들 (Considered Options)
- **대안 1 (오픈소스 포크 및 수정):** 기존의 Python 기반(FastMCP) 프로젝트나 Rust 기반 프로젝트를 포크하여 다중 사용자 기능을 덧붙임.
- **대안 2 (자체 개발 - Python):** Python 언어와 FastMCP 프레임워크를 활용하여 처음부터 작성.
- **대안 3 (자체 개발 - TypeScript/Node.js):** TypeScript와 공식 `@modelcontextprotocol/sdk`를 사용하여 듀얼 트랜스포트(stdio/HTTP) 서버 구축.

## 3. 최종 결정 (Decision)
우리는 **대안 3 (자체 개발 - TypeScript/Node.js)**을 사용하기로 결정했습니다. 또한 다중 사용자를 위한 HTTP(SSE)와 개인용 Stdio를 모두 지원하며, LLM 토큰 절약을 위한 Smart Name Resolver(이름-ID 매핑) 계층을 직접 구현합니다.

## 4. 결정 근거 (Rationale)
- **공식 지원:** TypeScript/Node.js는 MCP 공식 SDK의 업데이트와 문서화가 가장 빠르고 안정적입니다.
- **서버 이중화 용이성:** Express.js와 결합하여 SSE(HTTP) 기반의 중앙 서버 배포와 로컬 CLI(Stdio) 실행을 가장 매끄럽게 통합할 수 있습니다.
- **보안 및 검증:** `zod` 라이브러리를 통한 LLM 프롬프트 인자값의 런타임 타입 검증이 매우 강력합니다.

## 5. 결과 및 영향 (Consequences)
- 긍정적 영향: MCP 최신 스펙을 즉시 반영할 수 있으며, 사내 Node.js 인프라와 배포(Docker 등) 호환성이 높습니다.
- 부정적/주의할 영향: Python 생태계의 다양한 AI 유틸리티 패키지를 직접 사용할 수 없으므로 모든 로직을 TS로 구현해야 합니다.

## 6. 참고 및 연관 문서 (References)
- `document/redmine_mcp_research.md` (오픈소스 생태계 조사)
- `document/architecture_design.md` (아키텍처 설계서)
