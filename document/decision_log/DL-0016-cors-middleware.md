---
title: "DL-0016: 웹 클라이언트 및 브라우저 에이전트 연동을 위한 cors 미들웨어 도입"
created: 2026-09-21
author: "Antigravity"
tags:
  - decision-log
  - cors
  - security
  - http
---

# DL-0016: 웹 클라이언트 및 브라우저 에이전트 연동을 위한 cors 미들웨어 도입

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
Streamable HTTP 모드로 운영되는 Express 웹 서버에 브라우저 기반 Web UI, 프론트엔드 에이전트, 개발 환경(`localhost:5173` 등)에서의 교차 출처 리소스 공유(CORS) 요청을 처리하기 위한 미들웨어 패키지 도입.

## 2. 결정 사항 (Decision)
프로덕션 의존성(`dependencies`)으로 `cors` 패키지, 개발 의존성(`devDependencies`)으로 `@types/cors`를 추가하고, Express 애플리케이션 진입점에 `app.use(cors())` 미들웨어를 등록한다.

## 3. 이유 (Reasoning)
- 기존 Express 서버에는 CORS 처리가 누락되어 있어, 브라우저 환경에서 MCP 서버에 접속하려 할 경우 프리플라이트(OPTIONS) 요청 또는 Cross-Origin 차단 에러가 발생함.
- `cors`는 검증된 표준 라이브러리로서 복잡한 헤더 핸들링(`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`)을 안전하고 일관되게 처리함.

## 4. 후속 조치 (Action Items)
- [x] `npm install cors` 및 `npm install -D @types/cors` 실행 (서브에이전트 환경)
- [x] [src/index.ts](file:///Users/kakakakekeke/workspace/redmini-mcp-prj/src/index.ts)에 `cors()` 미들웨어 등록
- [x] CORS 프리플라이트 및 통신 테스트 검증
