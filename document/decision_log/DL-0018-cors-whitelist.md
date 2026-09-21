---
title: "DL-0018: CORS 와일드카드 제거 및 환경변수 기반 화이트리스트 도입"
created: 2026-09-21
author: Antigravity
tags:
  - decision-log
  - cors
  - security
  - http
---

# DL-0018: CORS 와일드카드 제거 및 환경변수 기반 화이트리스트 도입

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
보안 감사 보고서([[security_audit_report]] 2-1항) 지적 사항에 따라, 기존 Streamable HTTP 전송 계층의 전역 와일드카드(`cors()`) 설정으로 인한 잠재적 크로스 사이트 요청 위조 및 임의 웹페이지에서의 무단 MCP 도구 호출 취약점 개선.

## 2. 결정 사항 (Decision)
- `cors()`의 전역 와일드카드(`*`) 허용 정책을 제거하고, 동적 origin 검증 콜백을 적용한다.
- `CORS_ALLOWED_ORIGINS` 환경변수를 지원하여 쉼표(,) 구분 목록으로 명시된 신뢰 출처를 허용한다.
- 미설정 시 기본 안전 출처로 `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`, `http://127.0.0.1:5173` 및 정규식을 통한 로컬호스트 임의 포트를 허용한다.
- 브라우저 외 도구(curl, Postman, server-to-server 등 Origin 헤더 부재 요청)는 정상 허용한다.
- 허용되지 않은 비인가 Origin 요청은 명시적으로 거부(`CORS policy: Origin ... not allowed`) 처리한다.

## 3. 이유 (Reasoning)
- 악성 웹사이트에서 사용자의 브라우저를 경유하여 로컬 또는 내부망의 Redmine MCP 서버 엔드포인트에 무단 접속 및 도구를 실행하는 것을 차단하기 위함.
- 개발 환경(Vite 기본 5173, Next/React 기본 3000 등)의 편의성을 유지하면서 프로덕션 배포 시 환경변수를 통해 엄격한 도메인 화이트리스트 관리를 가능하게 함.

## 4. 후속 조치 (Action Items)
- [x] [src/index.ts](file:///Users/kakakakekeke/workspace/redmini-mcp-prj/src/index.ts)에 `getCorsMiddleware` 구현 및 `app.use(getCorsMiddleware())` 적용
- [x] [.env.example](file:///Users/kakakakekeke/workspace/redmini-mcp-prj/.env.example)에 `CORS_ALLOWED_ORIGINS` 설정 항목 및 가이드 추가
- [x] [tests/server/streamable-http-runner.test.ts](file:///Users/kakakakekeke/workspace/redmini-mcp-prj/tests/server/streamable-http-runner.test.ts) 및 [tests/e2e/integration.test.ts](file:///Users/kakakakekeke/workspace/redmini-mcp-prj/tests/e2e/integration.test.ts)에 화이트리스트 검증 테스트 추가 및 통과
