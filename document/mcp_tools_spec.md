---
title: MCP 도구(Tool) 명세서 (MVP - 조회 전용)
created: 2026-09-19
updated: 2026-09-19
tags:
  - mcp
  - tools
  - spec
  - read-only
  - security
aliases:
  - Tool Spec
status: draft
---

# Redmine MCP 서버 도구(Tool) 명세서

> [!important] 보안 최우선 설계 (Security First)
> 본 프로젝트는 보안을 최우선 요구사항으로 삼습니다. 
> 1단계(MVP)는 **비파괴적인 조회(Read-only) 기능**으로만 제한하여 시스템 리스크를 최소화하며, 잠재적인 위협을 차단합니다.

## 1. 1단계(MVP) 도구 목록 요약

LLM(Claude/Cursor)이 불필요하게 많은 도구를 가지지 않도록(Tool Bloat 방지), 가장 활용도가 높은 핵심 조회 기능 3개로 압축합니다.

| 도구 이름 (Tool Name) | 기능 설명 | Redmine API Endpoint |
| :--- | :--- | :--- |
| `search_issues` | 다양한 필터를 사용해 일감 목록을 검색합니다. | `GET /issues.json` |
| `get_issue_details` | 특정 일감의 상세 내용(본문, 이력, 첨부파일 등)을 조회합니다. | `GET /issues/[id].json` |
| `get_projects` | 접근 가능한 프로젝트 목록을 조회합니다. | `GET /projects.json` |

---

## 2. 보안 가이드라인 (Security Guidelines for Tools)

도구 구현 시 다음 보안 원칙을 엄격히 준수합니다.

1. **입력 검증 (Input Validation & Sanitization)**
   - LLM이 전달하는 모든 인자(Arguments)는 `Zod` 라이브러리 등을 통해 엄격한 타입, 포맷, 범위 검사를 거칩니다.
   - 예: `issue_id`는 반드시 양의 정수(Positive Integer)여야 하며, 특수문자나 SQL/NoSQL Injection 시도를 원천 차단합니다.
2. **권한 최소화 및 기능 제한 (Least Privilege)**
   - MVP 단계에서는 서버 측 코드 베이스에 데이터를 변경하는 API(`POST`, `PUT`, `DELETE`) 호출 로직을 아예 포함하지 않습니다. (코드 레벨에서의 보안)
3. **인증 정보 보호 (Credential Protection)**
   - Redmine URL 및 API Key는 소스코드나 설정 파일에 하드코딩하지 않고, 반드시 실행 시 **환경변수(`REDMINE_URL`, `REDMINE_API_KEY`)**를 통해서만 주입받습니다.
   - 터미널이나 파일로 출력되는 애플리케이션 로그에 API Key나 응답 본문의 민감 정보(PII 등)가 노출되지 않도록 철저히 마스킹(Masking) 처리합니다.
4. **통신 암호화 강제**
   - Redmine 서버와의 통신 시 가급적 HTTPS를 강제하고, 증명서 검증을 우회하지 않습니다.

---

## 3. 도구 상세 명세 (JSON Schema)

### 3.1. `search_issues`
일감을 검색하고 필터링합니다. 에이전트가 "내 일감 찾아줘", "진행중인 결함 보여줘" 등의 요청을 처리할 때 사용합니다.

*   **Parameters:**
    *   **식별자 및 계층**:
        *   `project_id` (string, optional): 프로젝트 ID (숫자) 또는 영문 슬러그(identifier).
        *   `project` (string, optional): 프로젝트 이름. Smart Name Resolver가 ID로 자동 매핑.
        *   `subproject_id` (string, optional): 하위 프로젝트 필터 (`!*`: 제외, `*`: 전체 포함, 또는 특정 하위 프로젝트 ID).
        *   `issue_id` (string, optional): 특정 일감 ID (단일 `123` 또는 쉼표 구분 `123,456`).
        *   `parent_id` (string, optional): 상위 일감 숫자 ID.
    *   **상태 / 유형 / 범주 / 버전 / 우선순위**:
        *   `status_id` (string, optional): 일감 상태 (`open`, `closed`, `*`, 또는 숫자 ID).
        *   `status` (string, optional): 일감 상태명 (예: '신규', '진행중', '해결'). Smart Name Resolver 자동 변환.
        *   `tracker_id` (string, optional): 트래커 숫자 ID.
        *   `tracker` (string, optional): 트래커 이름 (예: '결함', '기능', '지원'). Smart Name Resolver 자동 변환.
        *   `priority_id` (string, optional): 우선순위 숫자 ID.
        *   `priority` (string, optional): 우선순위 이름 (예: '낮음', '보통', '높음', '긴급'). Smart Name Resolver 자동 변환.
        *   `category_id` (string, optional): 일감 범주(Category) 숫자 ID.
        *   `fixed_version_id` (string, optional): 목표 버전(Version/Milestone) 숫자 ID.
    *   **담당자 / 작성자**:
        *   `assigned_to_id` (string, optional): 담당자 ID (`me` 또는 숫자 ID).
        *   `assigned_to` (string, optional): 담당자 이름 또는 로그인 계정명. Smart Name Resolver 자동 변환.
        *   `author_id` (string, optional): 작성자 ID (`me` 또는 숫자 ID).
        *   `author` (string, optional): 작성자 이름 또는 로그인 계정명. Smart Name Resolver 자동 변환.
    *   **검색 및 쿼리**:
        *   `query_id` (string, optional): Redmine에 저장된 사용자 정의 검색(Saved Query) 숫자 ID.
        *   `query` (string, optional): 제목/본문 검색 키워드 (최대 100자, `subject: ~query`로 자동 매핑).
        *   `subject` (string, optional): 제목 검색 필터 (예: `~로그인` 또는 `로그인`).
        *   `description` (string, optional): 본문/설명 검색 필터 (예: `~오류`).
    *   **날짜 필터 (연산자 지원)**:
        *   `created_on` (string, optional): 생성 일시 필터 (`>=2026-09-01`, `<=2026-09-20`, `><2026-09-01|2026-09-20`, `t`, `w` 등).
        *   `updated_on` (string, optional): 수정 일시 필터.
        *   `start_date` (string, optional): 시작 일자 필터.
        *   `due_date` (string, optional): 완료 기한(마감일) 필터.
        *   `closed_on` (string, optional): 완료 일시 필터.
    *   **수치 및 진척도**:
        *   `estimated_hours` (string, optional): 추정 시간 필터 (`>=4`, `<=10` 등).
        *   `done_ratio` (string, optional): 진척도(%) 필터 (`>=50`, `=100` 등).
    *   **사용자 정의 필드 (Custom Fields)**:
        *   `custom_fields` (object, optional): 사용자 정의 필드 객체 (`{ "1": "값" }` 입력 시 `cf_1=값`으로 자동 변환).
    *   **정렬, 페이징, 포함**:
        *   `sort` (string, optional): 정렬 기준 (예: `updated_on:desc`, `priority:desc,updated_on:desc`, `id:asc`).
        *   `limit` (integer, optional): 반환할 최대 결과 수 (1~100, 기본값: 10).
        *   `offset` (integer, optional): 페이징 오프셋 (0 이상의 정수).
        *   `include` (string, optional): 추가 포함 리소스 (쉼표 구분: `attachments,relations,journals`).


### 3.2. `get_issue_details`
단일 일감의 전체 정보를 가져옵니다. 에이전트가 일감의 구체적인 내용, 히스토리(Journal) 등을 분석할 때 사용합니다.

*   **Parameters:**
    *   `issue_id` (integer, required): 조회할 일감의 숫자 ID. (엄격한 정수 타입 검사 수행)
    *   `include_journals` (boolean, optional): 변경 이력(댓글 등) 포함 여부 (기본: true).
    *   `include_attachments` (boolean, optional): 첨부파일 메타데이터 포함 여부 (기본: false).

### 3.3. `get_projects`
에이전트가 프로젝트 목록과 ID를 파악하기 위해 사용합니다. 검색 기능(`search_issues`)을 돕는 보조 도구입니다.

*   **Parameters:**
    *   `include_archived` (boolean, optional): 보관된 프로젝트 포함 여부 (기본: false).

---

## 4. 향후 확장 계획
조회(Read-only) 기능이 충분히 안정화되고 보안 검증이 완료된 이후, 점진적으로 추가할 수 있는 도구들입니다.
*   `search_wiki`: 위키 문서 검색 및 조회 (비파괴적)
*   (2단계) `add_issue_note`: 일감 일지에 댓글 달기
