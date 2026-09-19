---
title: Redmine MCP 프로젝트 문서 인덱스 (Agent Document Registry)
created: 2026-09-18
updated: 2026-09-18
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
| **[[DL-0001-vitest]]** | `DL`, `결정로그`, `운영`, `실무결정` | • 코딩 컨벤션, 라이브러리 교체 등 실무적 결정 기록 시 | DL-0001: TDD 테스트 러너로 Vitest 채택 |
| **[[todo]]** | `todo`, `할일`, `태스크`, `진행현황` | • 다음 개발 목표(Task)를 확인하거나 완료 처리할 때 | 전체 프로젝트의 진행 현황 및 TO-DO 리스트 |
| **[[integration_test_scenarios]]** | `테스트`, `시나리오`, `UAT`, `E2E` | • 서버 구동 후 실 환경 연동 및 통합 테스트 수행 시 | 종단간(E2E) 통합 테스트 및 인수 테스트(UAT) 시나리오 |
| **[[git_workflow_sop\|document/sop/git_workflow_sop.md]]** | `SOP`, `git`, `워크플로우`, `브랜치`, `worktree`, `멀티에이전트` | • 협업, 브랜치 생성, 커밋 작성, 워크트리 구성 시 | 브랜치 관리, 커밋 메시지 컨벤션 및 다중 에이전트 동시 작업을 위한 Git Worktree 절차서 |

---

## 2. 작성 예정 문서 (Planned Documents)

새로운 문서가 작성되면 위 색인표에 행을 추가하고 등록하십시오:

* `document/setup_and_deployment.md`: 클라이언트(Claude Desktop/Cursor) 연동 설정 및 실행 가이드

---

## 3. 인덱스 동기화 강제 훅 (Enforcement Hook)

* **훅 설정**: `.agents/hooks.json` → `.agents/scripts/enforce_document_index.sh`
* **동작 규칙**: `document/` 폴더 내에 `.md` 파일이 추가되거나 삭제되었을 때 위 색인표에 반영하지 않고 작업을 종료하려 하면, 훅이 `decision: "continue"`를 반환하여 작업 종료를 자동 차단합니다.

---

#index #agent-guide #redmine #mcp #documentation
