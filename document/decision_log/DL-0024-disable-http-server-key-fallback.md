---
title: "DL-0024: HTTP 모드 REDMINE_API_KEY 서버 키 폴백 완전 차단"
created: 2026-09-21
author: Antigravity
tags:
  - decision-log
  - security
  - auth
  - http
  - fallback
related:
  - "[[security_audit_report]]"
  - "[[DL-0020-http-auth-middleware]]"
  - "[[architecture_design]]"
---

# DL-0024: HTTP 모드 REDMINE_API_KEY 서버 키 폴백 완전 차단

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
HTTP(Streamable HTTP) 모드 구동 시 클라이언트가 요청 헤더(`x-redmine-api-key`)를 누락했을 때 서버에 설정된 전역 `REDMINE_API_KEY` 환경변수로 폴백되는 동작을 원천 차단하고, 기존 `ALLOW_SERVER_KEY_FALLBACK` 환경변수 옵션을 완전히 폐기.

## 2. 결정 사항 (Decision)
- `src/middleware/auth.ts`의 `getAuthClient`에서 `ALLOW_SERVER_KEY_FALLBACK` 환경변수 검사 로직을 완전히 제거한다.
- `process.env.REDMINE_API_KEY`로의 폴백은 오직 로컬 단일 사용자 환경인 `process.env.TRANSPORT === "stdio"`일 때만 허용한다.
- HTTP 모드(`process.env.TRANSPORT !== "stdio"`)에서는 요청 헤더에 `x-redmine-api-key`가 존재하지 않을 경우 어떠한 예외도 없이 즉시 `Authentication failed: Missing Redmine API Key` 에러를 던진다.
- `.env.example`에서 `ALLOW_SERVER_KEY_FALLBACK` 설정 항목을 제거하고, HTTP 모드에서는 클라이언트 요청 헤더가 필수임을 명시한다.
- `tests/unit/auth.test.ts`에 HTTP 모드에서 환경변수 설정 여부와 무관하게 헤더 누락 시 에러가 발생하는지 검증하는 테스트를 반영한다.

## 3. 이유 (Reasoning)
- HTTP 모드는 다수의 사용자가 원격에서 접근할 수 있는 네트워크 서비스 형태이다.
- 만약 서버 환경변수 키로 폴백될 경우, 권한이 없는 일반 사용자나 인증 정보가 누락된 요청이 서버 관리자/마스터 권한을 탈취하여 대리 실행되는 심각한 대리인 문제(Confused Deputy Problem) 및 권한 오남용 취약점이 발생할 수 있다.
- 따라서 HTTP 모드에서는 개별 요청마다 명시적인 사용자 API 키(`x-redmine-api-key`) 전송을 필수로 강제함으로써 완벽한 다중 사용자 격리 및 접근 제어를 달성한다.

## 4. 후속 조치 (Action Items)
- [x] `src/middleware/auth.ts`에서 `ALLOW_SERVER_KEY_FALLBACK` 제거 및 `isStdio` 조건 단일화
- [x] `.env.example` 환경변수 명세 갱신
- [x] `tests/unit/auth.test.ts` 단위 테스트 갱신 및 검증
- [x] `document/index.md` 및 `document/todo.md` 동기화
