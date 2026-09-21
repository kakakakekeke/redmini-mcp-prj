---
title: "DL-0020: HTTP Bearer 인증 미들웨어 및 서버 키 폴백 제어"
created: 2026-09-21
author: Antigravity
tags:
  - decision-log
  - security
  - auth
  - bearer-token
  - fallback
related:
  - "[[security_audit_report]]"
  - "[[architecture_design]]"
---

# DL-0020: HTTP Bearer 인증 미들웨어 및 서버 키 폴백 제어

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
보안 감사 보고서([[security_audit_report]] 3-2항)에 따라, HTTP 모드 구동 시 `/mcp` 엔드포인트에 대한 임의 접근을 차단하기 위해 Bearer 토큰 인증 미들웨어를 도입하고, 헤더 누락 시 서버 전역 `REDMINE_API_KEY`로 자동 폴백되어 권한이 오남용되는 문제를 방어하기 위해 폴백 동작을 환경변수 플래그로 제어.

## 2. 결정 사항 (Decision)
- `verifyHttpBearerToken` Express 미들웨어를 신설하여 HTTP 모드 `/mcp` 라우터 직전에 배치한다.
  - `process.env.MCP_AUTH_TOKEN`이 설정된 경우 `Authorization: Bearer <token>` 헤더를 검사하여 일치하지 않으면 401 Unauthorized 응답을 반환한다.
  - 브라우저 CORS 프리플라이트 요청(`OPTIONS`) 및 `MCP_AUTH_TOKEN` 미설정 환경(로컬 개발)에서는 인증을 통과시킨다.
- `getAuthClient`에서 `ALLOW_SERVER_KEY_FALLBACK === "true"` 환경변수 플래그가 명시되었거나 `TRANSPORT === "stdio"`(로컬 CLI 단일 사용자)인 경우에만 `process.env.REDMINE_API_KEY` 폴백을 허용하고, 그 외 HTTP 다중 사용자 환경에서는 `x-redmine-api-key` 헤더 누락 시 인증 에러를 발생시킨다.
- `.env.example`에 `MCP_AUTH_TOKEN` 및 `ALLOW_SERVER_KEY_FALLBACK` 설정 가이드를 추가한다.

## 3. 이유 (Reasoning)
- Streamable HTTP 모드로 운영 시 외부에 엔드포인트가 노출되었을 때 인가되지 않은 클라이언트의 무단 도구 호출을 차단하기 위함.
- 다중 사용자 환경에서 호출자가 본인의 API 키를 누락했을 때 서버 관리자 권한의 API 키로 작업이 대리 실행되는 잠재적 권한 탈취 및 오남용 리스크를 차단하기 위함.

## 4. 후속 조치 (Action Items)
- [x] `src/middleware/auth.ts`에 `ALLOW_SERVER_KEY_FALLBACK` 분기 및 `verifyHttpBearerToken` 미들웨어 구현
- [x] `src/index.ts`의 HTTP 모드 라우터에 `verifyHttpBearerToken` 미들웨어 연동
- [x] `tests/unit/auth.test.ts`에 단위 테스트 추가 및 검증 완료
- [x] `.env.example` 환경변수 명세 업데이트
