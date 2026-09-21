---
title: "DL-0023: express-rate-limit 미들웨어 도입 및 HTTP 엔드포인트 Rate Limiting 적용"
created: 2026-09-21
author: Antigravity
tags:
  - decision-log
  - security
  - rate-limiting
  - express-rate-limit
related:
  - "[[security_audit_report]]"
  - "[[0004-transition-to-streamable-http]]"
---

# DL-0023: express-rate-limit 미들웨어 도입 및 HTTP 엔드포인트 Rate Limiting 적용

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
보안 감사 보고서([[security_audit_report]] 4항)에 따라, Streamable HTTP 전송 계층(`/mcp`) 및 인프라 엔드포인트(`/health`)에 대한 무차별 무제한 호출(Brute-force / DoS 공격)을 방어하기 위해 `express-rate-limit` 패키지를 설치하고 엔드포인트별 요청 속도 제한(Rate Limiting) 정책 적용.

## 2. 결정 사항 (Decision)
- `express-rate-limit` 패키지를 신규 설치한다 (`npm install express-rate-limit`).
- `src/index.ts`에 엔드포인트별 속도 제한 미들웨어 생성 헬퍼를 추가한다:
  - `getMcpRateLimiter()`: `/mcp` 엔드포인트 대상 1분당 최대 120회 제한 (`windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false`).
  - `getHealthRateLimiter()`: `/health` 헬스체크 엔드포인트 대상 1분당 최대 300회 제한 (`windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false`).
- 초과 시 HTTP 429 Too Many Requests 응답과 표준 `RateLimit-*` 헤더를 반환하도록 구성한다.
- `.env.example`에 Rate Limiting 관련 안내를 명시한다.

## 3. 이유 (Reasoning)
- 대량의 악의적 세션 생성 요청이나 과도한 도구 호출로부터 서버 자원(메모리, CPU, 세션 풀) 및 백엔드 Redmine 인스턴스를 보호하기 위함.
- 표준 헤더(`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`)를 제공하여 정상 클라이언트가 적응형으로 호출 빈도를 조절할 수 있도록 지원.

## 4. 후속 조치 (Action Items)
- [x] `package.json`에 `express-rate-limit` 의존성 추가
- [x] `src/index.ts`에 `getMcpRateLimiter` 및 `getHealthRateLimiter` 구현 및 Express 앱 라우터 적용
- [x] `tests/unit/rate_limit.test.ts`에 429 응답 및 헤더 검증 테스트 작성 및 통과
