---
title: "DL-0011: 보안 로거(Security Logger) 설계 및 개인정보·API 키 마스킹 정책"
created: 2026-09-20
updated: 2026-09-20
status: Accepted
tags:
  - decision-log
  - dl
  - logger
  - security
  - pii
  - masking
  - stdio
related:
  - "[[index]]"
  - "[[architecture_design]]"
  - "[[vibe_tdd_sop]]"
---

# DL-0011: 보안 로거(Security Logger) 설계 및 개인정보·API 키 마스킹 정책

## 1. 주제 (Topic) 및 배경

Redmine MCP 서버는 Stdio와 SSE(HTTP)의 두 가지 전송 방식을 지원합니다.
Stdio 모드에서 `process.stdout`은 MCP JSON-RPC 프로토콜 전용 데이터 채널로 사용되며, 일반 문자열이나 디버그 로그가 `stdout`으로 누출될 경우 클라이언트(Claude Desktop, Cursor 등)에서 JSON 파싱 에러를 유발하여 연결이 즉시 단절됩니다.

또한, 서버 운영 및 디버깅 과정에서 Redmine API Key(40자리 Hex), 인증 헤더, URL 파라미터, 비밀번호, 개인정보(PII: 이메일, 전화번호) 등이 평문 로그로 출력될 경우 심각한 보안 유출 사고로 이어질 수 있습니다.

이에 따라 표준 입출력 무결성을 보호하고, 모든 민감 정보를 자동으로 마스킹하는 보안 로거(`src/utils/logger.ts`)를 구축하고 표준 로깅 체계를 수립합니다.

## 2. 결정 사항 (Decision)

### 1. Stdio 채널 무결성 보장
- 로거의 모든 출력은 오직 `process.stderr.write`를 사용하여 표준 에러(stderr) 채널로만 전달합니다.
- `stdout`은 절대 오염시키지 않으며, MCP JSON-RPC 메시지와의 충돌을 원천 차단합니다.

### 2. 로그 레벨 및 환경변수 지원
- 레벨 체계: `debug` (0) < `info` (1) < `warn` (2) < `error` (3) < `silent` (4)
- 환경변수 `LOG_LEVEL` (기본값: `'info'`)과 연동되며, 대소문자 무관하게 파싱합니다.
- 런타임에 동적으로 레벨을 변경할 수 있도록 `setLevel(level)` 및 `getLevel()` 메서드를 제공합니다.

### 3. 민감 정보 및 개인식별정보(PII) 마스킹 (`maskSensitiveData`)
- **Redmine API Key 마스킹**: 40자리 Hex 문자열(`\b[0-9a-fA-F]{40}\b`)을 `[REDACTED_API_KEY]`로 변환.
- **URL 쿼리 파라미터 마스킹**: `key`, `api_key`, `password`, `token`, `secret` 등의 쿼리 스트링 값을 `[REDACTED]`로 변환.
- **헤더 마스킹**: `X-Redmine-API-Key: ...`, `Authorization: Bearer ...` 문자열을 `[REDACTED]`로 변환.
- **객체 키 기반 마스킹**: `apiKey`, `password`, `token`, `secret`, `cookie`, `authorization` 등 대소문자 무관 민감 키 값을 `[REDACTED]`로 치환.
- **개인정보(PII) 마스킹**:
  - 이메일: `john.doe@example.com` ➡️ `j***@example.com`
  - 전화번호: 국내외 유무선 전화번호 패턴을 `[PHONE_REDACTED]`로 마스킹.
- **중첩 객체 및 순환 참조 방어**: 재귀 탐색과 `WeakSet`을 적용하여 순환 참조 객체를 `[Circular]`로 안전하게 처리.
- **Error 객체 안전 직렬화**: `name`, `message`, `stack`의 민감 정보를 마스킹하고 커스텀 속성을 보존하여 직렬화.

### 4. 기존 코드 연동
- 서버 엔트리포인트(`src/index.ts`) 및 SSE 전송 계층(`src/server/sse-runner.ts`)의 로그 출력을 `logger` 인스턴스로 일원화.

## 3. 이유 (Reasoning)

1. **MCP 프로토콜 안정성**: `stdout` 오염으로 인한 클라이언트 파싱 실패 및 연결 끊김을 근본적으로 방지합니다.
2. **보안 및 규제 준수**: API Key 탈취 및 개인정보 유출을 방지하여 안전한 기업용 MCP 환경을 제공합니다.
3. **유연한 디버깅**: 프로덕션에서는 `info` 또는 `warn`, 로컬 개발 시에는 `debug` 레벨로 전환하여 유연하게 모니터링할 수 있습니다.

## 4. 후속 조치 (Action Items)

- [x] 보안 로거 단위 테스트(`tests/unit/logger.test.ts`) 작성 및 통과
- [x] 보안 로거 모듈(`src/utils/logger.ts`) 구현
- [x] `src/index.ts` 및 `src/server/sse-runner.ts`의 로거 연동
- [x] `document/index.md`에 DL-0011 색인 추가
- [x] `document/todo.md` 대기열 완료(`[x]`) 처리
