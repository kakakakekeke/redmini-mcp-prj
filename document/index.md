---
title: Redmine MCP 프로젝트 문서 인덱스 (Agent Document Registry)
created: 2026-09-18
updated: 2026-09-20
tags:
  - index
  - moc
  - redmine
  - mcp
  - agent-guide
aliases:
  - Document Index
  - 문서 인덱스
status: active
---

# Redmine MCP 프로젝트 문서 인덱스 (Agent Document Registry)

> [!important] AI 에이전트 필독 가이드 (Agent Reading Protocol)
> 이 문서는 **에이전트가 필요한 기술 지식 문서를 빠르게 찾아가기 위한 라우팅 색인표**입니다.
> 1. 전체 파일 검색을 하지 말고, 아래 **[문서 색인표]**의 키워드와 트리거를 확인하여 필요한 문서만 선별 열람(`view_file`)하십시오.
> 2. `document/` 내에 새 문서를 추가하거나 삭제할 때는 **아래 색인표만 최신 상태로 갱신**하십시오. (미갱신 시 프로젝트 훅에 의해 작업 종료가 자동 차단됩니다.)

---

## 1. 프로젝트 문서 색인표 (Document Lookup Table)

| 문서 (경로) | 주요 키워드 (Trigger Keywords) | 언제 읽어야 하는가? (Action Trigger) | 핵심 요약 |
|:---|:---|:---|:---|
| **[[redmine_mcp_research\|document/redmine_mcp_research.md]]** | `오픈소스`, `비교`, `라이선스`, `MIT`, `Apache`, `GPL`, `인증`, `다중사용자`, `Multi-User`, `아키텍처` | • Redmine MCP 구현 방식 및 라이선스 정책 검토 시<br>• 다중 사용자 인증(Per-user API Key, OAuth2) 구조 설계 시<br>• 기존 오픈소스 11종 장단점 벤치마킹 시 | 오픈소스 11종 비교, 라이선스 가이드, 다중 사용자 및 인증 아키텍처 분석 |
| **[[redmine_api_specification\|document/redmine_api_specification.md]]** | `REST API`, `엔드포인트`, `일감`, `이슈`, `상태변경`, `시간기록`, `위키`, `첨부파일`, `allowed_statuses`, `204 No Content` | • Redmine API 호출 클라이언트 구현 시<br>• MCP 도구(Tool) 파라미터 및 스키마 정의 시<br>• API 호출 에러(422, 204 등) 디버깅 시 | Redmine 공식 REST API 21개 전수 명세, 페이로드 스키마, 호출 시 주의사항 |
| **[[mcp_tools_spec]]** | `tools`, `명세`, `보안`, `조회전용`, `MVP`, `security` | • 어떤 Tool을 에이전트에게 노출할지 확인 시<br>• Zod 스키마로 파라미터 유효성 검사 로직 작성 시<br>• 보안(권한, API Key) 관련 요구사항 확인 시 | 1단계(MVP) 조회 전용 기능 3종 스펙 및 보안 준수 가이드라인 |
| **[[architecture_design]]** | `아키텍처`, `설계`, `다중사용자`, `SSE`, `stdio`, `LLM최적화` | • 서버 구동 방식(stdio vs HTTP) 구현 시<br>• 인증 방식(Header 위임 등) 구현 시<br>• 디렉토리 구조 및 내부 모듈 연동 확인 시 | 부서 다중 사용자, 이중 전송 계층(SSE/stdio), LLM 최적화(Resolver) 설계서 |
| **[[sop_template]]** | `템플릿`, `SOP` | • 새로운 SOP 문서 작성 시 | 표준 운영 절차서 템플릿 |
| **[[adr_template]]** | `템플릿`, `ADR` | • 새로운 ADR 문서 작성 시 | 아키텍처 결정 기록(ADR) 템플릿 |
| **[[decision_log_template]]** | `템플릿`, `DL`, `결정로그` | • 새로운 실무 결정 로그(DL) 문서 작성 시 | 일상적 운영/실무 결정 로그 템플릿 |
| **[[vibe_tdd_sop]]** | `SOP`, `TDD`, `바이브코딩`, `프로세스` | • Vibe TDD 기능 개발 및 테스트 사이클 진행 시 | Vibe TDD 워크플로우를 위한 표준 운영 절차서 |
| **[[0001-initial-architecture]]** | `ADR`, `아키텍처결정` | • 시스템 아키텍처, 굵직한 기술 스택 변경 시 | ADR-0001: Redmine MCP 서버 초기 아키텍처 결정 |
| **[[0002-test-architecture\|document/adr/0002-test-architecture.md]]** | `ADR`, `테스트`, `아키텍처`, `TDD`, `Mocking`, `MSW` | • 단위/통합/E2E 테스트 계층 구분 확인 시<br>• 모킹(Mock) 전략 및 피라미드 구조 참조 시 | ADR-0002: 테스트 피라미드 및 Mocking 전략 정의 |
| **[[0003-write-feature-safety-model\|document/adr/0003-write-feature-safety-model.md]]** | `ADR`, `쓰기`, `write`, `보안`, `dry_run`, `guard`, `allowed_statuses` | • 쓰기 기능(add_issue_note, create_issue, update_issue) 보안 모델 확인 시<br>• dry_run 가드 및 allowed_statuses 워크플로우 보호 로직 구현 시 | ADR-0003: 2단계 쓰기 기능 보안 모델 및 dry_run 가드 전략 |
| **[[DL-0001-vitest]]** | `DL`, `결정로그`, `운영`, `실무결정` | • 코딩 컨벤션, 라이브러리 교체 등 실무적 결정 기록 시 | DL-0001: TDD 테스트 러너로 Vitest 채택 |
| **[[DL-0002-boost-agent-workflow|document/decision_log/DL-0002-boost-agent-workflow.md]]** | `DL`, `boost`, `다중에이전트`, `무한루프`, `husky` | • /boost 모드 성과 확인 및 훅(Hook) 정책 완화 배경 참조 시 | DL-0002: /boost 모드 성과 및 다중 에이전트 워크플로우 결정 |
| **[[DL-0003-eventsource|document/decision_log/DL-0003-eventsource.md]]** | `DL`, `테스트`, `SSE`, `eventsource` | • E2E 테스트에서 SSEClientTransport 구성 관련 배경 참조 시 | DL-0003: E2E 테스트 시 SSE 동작을 위한 eventsource 도입 |
| **[[DL-0004-subagent-share-guardrail\|document/decision_log/DL-0004-subagent-share-guardrail.md]]** | `DL`, `서브에이전트`, `격리`, `worktree`, `share` | • 서브에이전트 호출 및 워크트리 가드레일 훅 구현 배경 확인 시 | DL-0004: 서브에이전트 격리 환경(share) 강제 및 Git Worktree 가드레일 고도화 |
| **[[DL-0006-write-tools-design\|document/decision_log/DL-0006-write-tools-design.md]]** | `DL`, `쓰기`, `write`, `도구설계`, `dry_run`, `Zod`, `스키마` | • 쓰기 도구(add_issue_note/create_issue/update_issue) 분리·통합 설계 확인 시<br>• Zod 스키마 파라미터 정의 참조 시 | DL-0006: 2단계 쓰기 도구 설계 결정 (분리 vs 통합) |
| **[[todo]]** | `todo`, `할일`, `태스크`, `진행현황` | • 다음 개발 목표(Task)를 확인하거나 완료 처리할 때 | 전체 프로젝트의 진행 현황 및 TO-DO 리스트 |
| **[[integration_test_scenarios]]** | `테스트`, `시나리오`, `UAT`, `E2E` | • 서버 구동 후 실 환경 연동 및 통합 테스트 수행 시 | 종단간(E2E) 통합 테스트 및 인수 테스트(UAT) 시나리오 |
| **[[setup_and_deployment|document/setup_and_deployment.md]]** | `설정`, `배포`, `연동`, `setup`, `deployment`, `claude`, `cursor`, `stdio`, `sse`, `환경변수` | • Claude Desktop 또는 Cursor IDE에 MCP 서버 연동 설정 시<br>• Stdio 또는 SSE(HTTP) 전송 모드로 서버 배포 시<br>• Redmine REST API 활성화 및 API Key 발급 방법 확인 시 | Claude Desktop 및 Cursor IDE 연동 가이드, 배포 모드(Stdio/SSE) 설정 및 문제 해결 |
| **[[git_workflow_sop|document/sop/git_workflow_sop.md]]** | `SOP`, `git`, `워크플로우`, `브랜치`, `worktree`, `멀티에이전트` | • 협업, 브랜치 생성, 커밋 작성, 워크트리 구성 시 | 브랜치 관리, 커밋 메시지 컨벤션 및 다중 에이전트 동시 작업을 위한 Git Worktree 절차서 |
| **[[DL-0005-live-tool-verification|document/decision_log/DL-0005-live-tool-verification.md]]** | `DL`, `라이브검증`, `테스트`, `ping`, `get_projects`, `search_issues`, `get_issue_details` | • 실제 Redmine 환경 연동 상태 및 도구 4종 검증 결과 확인 시<br>• 1단계(MVP 조회 전용) 완료 판정 및 2단계 작업 인계 시 | DL-0005: Redmine 라이브 MCP 도구 4종 검증 및 1단계 MVP 인수 완료 |
| **[[DL-0007-dry-run-default-true|document/decision_log/DL-0007-dry-run-default-true.md]]** | `DL`, `보안`, `dry_run`, `fail-open` | • dry_run 파라미터 기본값 설정 확인 시 | DL-0007: dry_run 기본값을 true로 변경하여 보안 강화 |
| **[[DL-0008-subagent-todo-completion-enforcement|document/decision_log/DL-0008-subagent-todo-completion-enforcement.md]]** | `DL`, `서브에이전트`, `todo`, `대기열`, `완료동기화`, `SOP` | • 서브에이전트 작업 완료 조건 및 todo.md 갱신 규칙 확인 시 | DL-0008: 서브에이전트 기능 커밋 시 TO-DO 대기열 완료([x]) 동기화 의무화 |
| **[[DL-0009-live-write-tools-verification|document/decision_log/DL-0009-live-write-tools-verification.md]]** | `DL`, `라이브검증`, `쓰기`, `create_issue`, `add_issue_note`, `update_issue`, `dry_run`, `UAT` | • 실제 Redmine 환경에서 2단계 쓰기 도구 3종 검증 결과 확인 시<br>• dry_run 및 Smart Resolver 실측 동작 확인 시 | DL-0009: 2단계 쓰기 도구 3종 라이브 검증 및 안정성 인수 완료 |
| **[[DL-0010-wiki-creation-tool-design|document/decision_log/DL-0010-wiki-creation-tool-design.md]]** | `DL`, `위키`, `wiki`, `쓰기`, `create_or_update_wiki`, `dry_run`, `Zod` | • 위키 등록/수정(create_or_update_wiki) 도구 설계 및 사양 확인 시<br>• 단일 도구 통합 사유 및 dry_run 가드 정책 참조 시 | DL-0010: 위키 등록 및 수정(create_or_update_wiki) 도구 설계 결정 |
| **[[DL-0011-security-logger|document/decision_log/DL-0011-security-logger.md]]** | `DL`, `로거`, `보안`, `logger`, `마스킹`, `masking`, `PII`, `API Key`, `stdio`, `stderr` | • 보안 로거 도입 및 개인정보/API Key 마스킹 정책 확인 시<br>• Stdio 채널 무결성 보장 및 로그 레벨 설정 참조 시 | DL-0011: 보안 로거(Security Logger) 설계 및 개인정보·API 키 마스킹 정책 |
| **[[DL-0012-docker-deployment|document/decision_log/DL-0012-docker-deployment.md]]** | `DL`, `docker`, `도커`, `배포`, `Dockerfile`, `compose`, `SSE`, `healthcheck` | • Docker 컨테이너 빌드 및 배포 환경 구성 시<br>• 멀티 스테이지 빌드 및 보안(비루트) 설정 참조 시 | DL-0012: Dockerfile 멀티 스테이지 빌드 및 SSE 컨테이너 배포 환경 구축 |
| **[[DL-0013-get-my-account-design|document/decision_log/DL-0013-get-my-account-design.md]]** | `DL`, `내계정`, `account`, `get_my_account`, `fallback`, `users_current` | • 내 계정 정보 조회(get_my_account) 도구 설계 및 사양 확인 시<br>• /my/account.json 및 /users/current.json Fallback 전략 참조 시 | DL-0013: 내 계정 정보 조회(get_my_account) 도구 및 Fallback 설계 |
| **[[DL-0014-upload-attachment-tool-design|document/decision_log/DL-0014-upload-attachment-tool-design.md]]** | `DL`, `업로드`, `첨부`, `upload`, `attachment`, `token`, `uploads.json` | • 파일 업로드 및 토큰 발급(upload_attachment) 도구 설계 확인 시<br>• Base64 변환 및 Redmine 2단계 업로드 연동 참조 시 | DL-0014: 파일 업로드 및 첨부 토큰 발급(upload_attachment) 도구 설계 |
| **[[attachment_guide|document/attachment_guide.md]]** | `가이드`, `참고문서`, `첨부`, `upload`, `attachment`, `토큰`, `바인딩`, `2단계업로드`, `uploads`, `파일탭`, `Files` | • Redmine 2단계 파일 처리 원리 및 API 연동 시<br>• 일감 첨부 및 프로젝트 파일 탭 등록/바인딩 참고 시 | Redmine 2단계 파일 처리 기술 참고 가이드 (토큰 발급 ➔ 일감 첨부 / 프로젝트 파일 탭 등록) |
| **[[DL-0015-get-attachment-content-design|document/decision_log/DL-0015-get-attachment-content-design.md]]** | `DL`, `첨부파일`, `본문`, `내용`, `다운로드`, `get_attachment_content`, `attachment` | • 첨부파일 본문 조회(get_attachment_content) 도구 설계 및 사양 확인 시<br>• 텍스트/바이너리 자동 판별 및 Truncation 가드레일 참조 시 | DL-0015: 첨부파일 본문 내용 조회(get_attachment_content) 도구 설계 |
| **[[0004-transition-to-streamable-http|document/adr/0004-transition-to-streamable-http.md]]** | `ADR`, `StreamableHTTP`, `SSE`, `stdio`, `전송계층`, `아키텍처` | • 레거시 SSE 폐기 및 Streamable HTTP 도입 배경 확인 시<br>• 전송 계층 이중화(Streamable HTTP / Stdio) 사양 참조 시 | ADR-0004: 레거시 SSE 전송 계층 폐기 및 Streamable HTTP 전송 계층 채택 |
| **[[DL-0016-cors-middleware|document/decision_log/DL-0016-cors-middleware.md]]** | `DL`, `cors`, `미들웨어`, `웹클라이언트`, `브라우저` | • 웹 클라이언트 및 브라우저 에이전트 연동용 CORS 설정 확인 시<br>• cors 패키지 도입 사유 참조 시 | DL-0016: 웹 클라이언트 및 브라우저 에이전트 연동을 위한 cors 미들웨어 도입 |
| **[[DL-0017-search-issues-full-filters-design|document/decision_log/DL-0017-search-issues-full-filters-design.md]]** | `DL`, `이슈검색`, `필터`, `search_issues`, `전수필터`, `Zod`, `SmartResolver` | • 이슈 검색 전수 필터 지원 사양 및 매핑 정책 확인 시<br>• Zod 스키마 및 RedmineClient 파라미터 확장 참조 시 | DL-0017: Redmine 이슈 검색(search_issues) REST API 전수 필터 지원 설계 |


---

## 2. 작성 예정 문서 (Planned Documents)

새로운 문서가 작성되면 위 색인표에 행을 추가하고 등록하십시오:

* (현재 예정된 문서가 모두 작성되었습니다.)

---

## 3. 인덱스 동기화 강제 훅 (Enforcement Hook)

* **훅 설정**: `.agents/hooks.json` → `.agents/scripts/enforce_document_index.sh`
* **동작 규칙**: `document/` 폴더 내에 `.md` 파일이 추가되거나 삭제되었을 때 위 색인표에 반영하지 않고 작업을 종료하려 하면, 훅이 `decision: "continue"`를 반환하여 작업 종료를 자동 차단합니다.

---

#index #agent-guide #redmine #mcp #documentation
