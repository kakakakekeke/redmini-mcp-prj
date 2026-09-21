---
title: "DL-0017: Redmine 이슈 검색(search_issues) REST API 전수 필터 지원 설계"
created: 2026-09-21
author: Antigravity
tags:
  - decision-log
  - search-issues
  - filters
  - redmine-api
  - mcp
---

# DL-0017: Redmine 이슈 검색(search_issues) REST API 전수 필터 지원 설계

> **안내**: 본 결정 로그는 Redmine 공식 REST API(`GET /issues.json`)에 노출된 전수 필터를 MCP 도구(`search_issues`) 및 `RedmineClient.getIssues`에서 완전히 지원하기 위한 스키마 확장 및 파라미터 매핑 결정을 기록합니다.

## 1. 주제 (Topic)
기존 `search_issues` 도구는 `project_id`, `status_id`, `tracker_id`, `assigned_to_id`, `query`, `limit` 등 최소한의 필터만 제공하여, Redmine API가 공식적으로 지원하는 다양한 필터(하위 프로젝트, 상위 일감, 카테고리, 버전, 작성자, 우선순위, 날짜 범위 연산자, 수치/진척도, 커스텀 필드, 정렬 및 페이징 등)를 활용할 수 없는 한계가 있었습니다. 이를 해결하기 위해 API에 노출된 모든 필터를 지원하도록 설계를 변경해야 합니다.

## 2. 결정 사항 (Decision)

1. **`RedmineClient.getIssues` 파라미터 확장 (`GetIssuesParams`)**:
   - **식별자/계층**: `project_id`, `subproject_id`(`!*`, `*`, 특정 ID), `issue_id`(단일 또는 콤마 분리), `parent_id`
   - **상태/분류/트래커/버전/우선순위**: `status_id`(`open`, `closed`, `*`, 특정 ID), `tracker_id`, `priority_id`, `category_id`, `fixed_version_id`
   - **담당/작성자**: `assigned_to_id`(`me`, 특정 ID), `author_id`(`me`, 특정 ID)
   - **검색/쿼리**: `query_id`(Saved Query ID), `query`(호환성 유지: `subject: ~query`), `subject`, `description`
   - **날짜 필터**: `created_on`, `updated_on`, `start_date`, `due_date`, `closed_on` (Redmine 공식 연산자 `>=`, `<=`, `><`, `~`, `t`, `w` 등 문자열 허용)
   - **수치/진척도**: `estimated_hours`, `done_ratio`
   - **커스텀 필드**: `custom_fields: Record<string, string | number>` 입력 시 `cf_{id}={value}`로 자동 전개 변환
   - **정렬/페이징/포함**: `sort`, `limit`(1~100), `offset`, `include`

2. **`searchIssuesSchema` (Zod) 확장 및 LLM 가이드**:
   - 각 필터에 친절한 `.describe()`를 명시하여 LLM이 연산자(`>=`, `><` 등) 및 포맷을 쉽게 인지하도록 가이드.
   - `limit` 상한을 기존 50에서 Redmine 기본 권장 상한인 **100**으로 상향.
   - Smart Name Resolver 지원을 확장하여 `status`, `tracker` 외에도 `priority`, `assigned_to`, `author`, `project` 문자열 이름 입력을 허용하고 자동으로 ID로 변환.

3. **Smart Name Resolution 연계**:
   - `SmartNameResolver`의 기존 메서드(`resolveProject`, `resolveTracker`, `resolveStatus`, `resolvePriority`, `resolveUser`)를 활용하여 문자열 이름이 전달된 경우 적절한 `*_id` 필드로 매핑.

## 3. 이유 (Reasoning)
- **API 완전성(Parity)**: 사용자가 Redmine Web UI에서 수행 가능한 모든 조건부 검색 및 복합 필터링을 MCP를 통해 Claude/Cursor LLM 에이전트가 동일하게 수행할 수 있어야 합니다.
- **LLM 사용 편의성**: 숫자 ID를 모르는 상태에서도 자연어 이름(`assigned_to: "홍길동"`, `priority: "높음"`)이나 날짜 범위 연산자(`created_on: ">=2026-09-01"`)를 직접 활용할 수 있어 도구 호출 정확도가 대폭 향상됩니다.
- **하위 호환성 유지**: 기존의 `query`, `status_id`, `tracker_id` 등 기본 파라미터 규격과 완전히 호환되도록 설계하여 기존 클라이언트 코드 및 테스트가 중단 없이 동작합니다.

## 4. 후속 조치 (Action Items)
- [ ] `document/index.md`에 DL-0017 반영
- [ ] `document/mcp_tools_spec.md`에 `search_issues` 도구 전수 필터 명세 최신화
- [ ] `document/todo.md` 대기열 1순위에 `feature/search-issues-full-filters` 등록
- [ ] 서브에이전트를 호출(`Workspace: share`)하여 TDD 구현 및 테스트 검증 수행
