---
title: "통합 테스트(E2E) 시나리오 및 결과서"
created: 2026-09-19
updated: 2026-09-19
tags:
  - test
  - uat
  - qa
---

# 통합 테스트 시나리오 및 결과서 (Integration Test Scenarios)

> **안내**: 단위 테스트(Unit Test)는 Vitest를 통해 코드 레벨에서 수행 및 자동화됩니다. 본 문서는 서버 구동 후 실제 Redmine 환경(또는 Mock)과 LLM 클라이언트(Claude Desktop 등)를 연동하여 수행하는 종단간(E2E) 및 인수 테스트(UAT) 시나리오를 기록합니다.

## 1. 테스트 환경
- **Target Redmine**: [추후 기입 (예: 사내 테스트 서버 URL)]
- **클라이언트**: Claude Desktop / Cursor IDE
- **전송 방식**: [ ] Stdio / [ ] HTTP(SSE)

## 2. 시나리오 목록

### [TC-01] 환경 변수를 통한 단일 인증 접속 (Stdio)
*   **사전 조건**: `.env` 파일에 유효한 `REDMINE_URL`과 `REDMINE_API_KEY` 설정.
*   **테스트 단계**:
    1. 클라이언트(Claude Desktop)에서 Stdio 방식으로 서버 실행.
    2. LLM에게 "접근 가능한 Redmine 프로젝트 목록을 알려줘"라고 프롬프트 입력.
*   **기대 결과**: 에이전트가 `get_projects` 도구를 호출하고 정상적인 프로젝트 목록(배열)을 반환 및 요약함.
*   **테스트 결과**: `[Pass] (Node.js/Express Mock Server와 MCP SDK Client를 이용한 E2E 자동화 스크립트로 검증 완료)` (성공/실패 기입)

### [TC-02] 자연어 필터를 통한 일감 검색 (Smart Name Resolver)
*   **사전 조건**: 서버 정상 구동 및 캐시 리졸버 로드 완료.
*   **테스트 단계**:
    1. LLM에게 "현재 진행중인 결함 일감을 3개만 찾아줘"라고 프롬프트 입력.
*   **기대 결과**: 
    1. 에이전트가 `search_issues` 도구를 호출.
    2. 인자값으로 넘어온 "진행중", "결함" 문자열이 서버 내부에서 Redmine의 상태 ID, 트래커 ID 숫자로 정상 매핑됨.
    3. 최대 3개의 일감 정보가 반환됨.
*   **테스트 결과**: `[Pass] (Node.js/Express Mock Server와 MCP SDK Client를 이용한 E2E 자동화 스크립트로 검증 완료)`

### [TC-03] HTTP (Streamable HTTP) 기반 다중 사용자 접속 및 헤더 인증 (Per-User API Key)
*   **사전 조건**: Express 서버를 특정 포트(예: 3000)로 구동 (`TRANSPORT=http`).
*   **테스트 단계**:
    1. 클라이언트 A가 `X-Redmine-API-Key: Token_A` 헤더를 포함하여 Streamable HTTP 연결 (`POST /mcp`).
    2. `search_issues` 요청.
*   **기대 결과**: 사용자 A에게 할당된 일감("User A Issue")이 정상 반환됨.
*   **테스트 결과**: `[Pass] (Node.js/Express Mock Server와 MCP StreamableHTTPClientTransport를 이용한 E2E 자동화 스크립트로 검증 완료)`

### [TC-04] 존재하지 않는 일감 ID 상세 조회 (예외 처리)
*   **사전 조건**: 서버 구동.
*   **테스트 단계**:
    1. LLM에게 "일감 번호 9999999번 상세 내역 알려줘" 요청.
*   **기대 결과**: 
    1. `get_issue_details` 도구 호출.
    2. Redmine API에서 404 에러 발생 시 서버가 죽지 않음.
    3. LLM에게 "해당 일감을 찾을 수 없습니다"라는 정제된 에러 메시지(content)를 정상 반환함.
*   **테스트 결과**: `[Pass] (Node.js/Express Mock Server와 MCP SDK Client를 이용한 E2E 자동화 스크립트로 검증 완료)`

### [TC-05] 쓰기 도구 안전성 검증 (create_issue dry_run 가드 및 실제 생성)
*   **사전 조건**: 서버 구동 및 Mock Redmine POST /issues.json 핸들러 준비.
*   **테스트 단계**:
    1. `create_issue` 호출 시 기본값(`dry_run: true`)으로 일감 생성 요청.
    2. `create_issue` 호출 시 명시적으로 `dry_run: false`로 일감 생성 요청.
*   **기대 결과**:
    1. `dry_run: true` 호출 시 Mock Redmine으로 POST 요청이 전달되지 않고, `[DRY_RUN 미리보기]` 텍스트 및 시뮬레이션 결과가 반환됨.
    2. `dry_run: false` 호출 시 실제 Mock Redmine으로 POST 요청이 전달되어 일감 ID가 생성되고 정상 완료 응답 반환.
*   **테스트 결과**: `[대기중]`

### [TC-06] 인프라 엔드포인트 검증 (경량 /health 및 CORS 프리플라이트)
*   **사전 조건**: Express 서버 구동 (`TRANSPORT=http`).
*   **테스트 단계**:
    1. HTTP 클라이언트로 `GET /health` 요청.
    2. 브라우저 프리플라이트 시뮬레이션: `OPTIONS /mcp` 요청 (`Origin: http://localhost:5173`, `Access-Control-Request-Method: POST`).
*   **기대 결과**:
    1. `GET /health`는 MCP 핸드셰이크 없이 즉시 200 OK와 `{ status: "ok" }` 반환.
    2. `OPTIONS /mcp`는 204 No Content(또는 200) 및 `Access-Control-Allow-Origin: *` 헤더 반환.
*   **테스트 결과**: `[대기중]`

### [TC-07] 다중 사용자 동시 접속 교차 격리 검증 (User A vs User B)
*   **사전 조건**: 동일한 Streamable HTTP 서버 (:33333) 구동.
*   **테스트 단계**:
    1. 클라이언트 A는 `x-redmine-api-key: Token_A`로 연결하여 `search_issues` 호출.
    2. 클라이언트 B는 `x-redmine-api-key: Token_B`로 연결하여 `search_issues` 호출.
*   **기대 결과**:
    1. 클라이언트 A의 응답에는 "User A Issue"만 포함되고,
    2. 클라이언트 B의 응답에는 "User B Issue"만 포함되어 세션 간 권한 혼선이 발생하지 않음.
*   **테스트 결과**: `[대기중]`

### [TC-08] 2단계 첨부파일 업로드 및 일감 연동 파이프라인
*   **사전 조건**: Mock Redmine `POST /uploads.json` 및 `POST /issues.json` 준비.
*   **테스트 단계**:
    1. `upload_attachment` 도구를 호출하여 텍스트 파일(내용: "sample logs")을 업로드하고 첨부 토큰(`upload_token_123`) 획득.
    2. 획득한 토큰을 `create_issue`의 `uploads` 필드에 전달하여 `dry_run: false`로 일감 생성.
*   **기대 결과**:
    1. `upload_attachment` 호출로 토큰이 정상 발급됨.
    2. 생성된 일감에 해당 토큰의 첨부파일이 바인딩되어 성공 응답 반환.
*   **테스트 결과**: `[대기중]`
