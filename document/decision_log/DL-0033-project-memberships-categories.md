---
title: "DL-0033: 프로젝트 멤버십·일감 범주 조회를 get_projects include 옵션으로 확장, create_issue 범주 이름 해석"
created: 2026-10-09
author: Claude Code (subagent)
tags:
  - decision-log
  - get-projects
  - memberships
  - issue-categories
  - smart-name-resolution
  - privacy
updated: 2026-10-09
aliases:
  - DL-0033-project-memberships-categories
status: active
related:
  - "[[index]]"
  - "[[DL-0025-project-custom-fields-support]]"
  - "[[DL-0026-get-projects-security-hardening]]"
  - "[[redmine_api_specification]]"
---

# DL-0033: 프로젝트 멤버십·일감 범주 조회 (get_projects include 확장)

## 1. 주제 (Topic)
일감 생성·수정 시 LLM이 담당자 후보(프로젝트 멤버·역할·그룹)와 일감 범주를 정확히 고를 수 있도록
`GET /projects/{id}/memberships.json`, `GET /projects/{id}/issue_categories.json` 조회를 지원해야 한다.
새 도구를 만들지, 기존 도구를 확장할지 결정이 필요했다. (AGENTS.md 4장 Tool Bloat 방지)

## 2. 결정 사항 (Decision)
1. **새 도구 없이 `get_projects` 확장**: `include: ("memberships" | "issue_categories")[]` 파라미터를 추가한다.
   - `project_id` 지정 시에만 유효하며, 없이 쓰면 `{ error }` 를 반환한다.
   - 결과는 기존 `getProject` 응답(`project`, …)에 최상위 필드로 덧붙인다:
     `memberships`, `memberships_total_count`, `memberships_truncated`(잘렸을 때만), `issue_categories`.
   - 하위 API 는 사용자 입력 문자열이 아니라 `getProject` 응답의 **숫자 `project.id`** 로 호출한다(없으면 해석된 ID). 클라이언트는 `encodeURIComponent` 를 적용한다.
   - `include: ["issue_categories"]` 가 성공하면 중복을 피하려고 `project.issue_categories`(id·name 뿐)를 제거하고 최상위 목록만 남긴다. 실패하면 원래 필드를 유지한다.
   - 두 섹션은 서로 독립이므로 병렬(`Promise.all`)로 조회한다.
2. **멤버십 페이지네이션**: `limit=100` 으로 `total_count` 까지 순회하되 **최대 10페이지(1,000건)** 에서 멈춘다. 빈 페이지가 오면 즉시 중단한다(잘못된 `total_count` 방어). 받은 건수가 `total_count` 보다 적으면(상한·조기 종료 모두) `truncated` 를 표시한다.
   - 요청 증폭: `get_projects` 1회가 Redmine 요청 최대 12건(상세 1 + 멤버십 10 + 범주 1)이 된다. HTTP Rate Limit 은 MCP 호출 단위이므로 이 계수를 감안한다.
3. **개인정보 최소화**: 멤버십은 `{ id, user?: {id,name}, group?: {id,name}, roles: [{id,name,inherited?}] }` 만, 범주는 `{ id, name, assigned_to?: {id,name} }` 만 반환한다. `mail`, `login`, 중복되는 `project` 등은 버린다(화이트리스트 방식).
4. **부분 실패**: 섹션별 403/404 는 `memberships_error` / `issue_categories_error` 로 보고하고 프로젝트 상세는 그대로 반환한다(멤버 조회 권한이 없어도 범주는 쓸 수 있음). 그 밖의 오류는 재throw. 프로젝트 자체 조회가 실패하면 섹션 API 는 호출하지 않는다.
5. **create_issue 범주 이름 해석**: `category`(이름, 1~255자 trim) / `category_id`(양의 정수) 파라미터를 추가한다. `category_id` 가 우선이다. 이름은 해당 프로젝트 범주 목록에서 ① 대소문자까지 정확히 일치 ② 없으면 대소문자 무시 일치가 **유일할 때만** 채택하고, 2개 이상이면 `Ambiguous` 에러를 던진다. 범주는 프로젝트 단위 리소스이므로 전역 TTL 캐시인 `SmartNameResolver` 에 넣지 않고 호출 시점에 조회한다.
   - 매칭 실패 에러에는 **Redmine 범주 이름을 넣지 않는다.** 예외 경로는 `processToolResult`(프롬프트 인젝션 탐지)를 거치지 않으므로, 목록은 탐지 레이어가 있는 `get_projects include=["issue_categories"]` 로 확인하라고 안내만 한다.
   - 범주 API 의 403/404 는 `Cannot resolve category ...: project not found or no permission (HTTP n). Use category_id instead.` 로 바꿔 던지고, 그 밖의 오류는 그대로 전파한다.
6. **경로 조작 방어 확장**: `project_id` 가 이제 create_issue 에서도 URL 경로(`/projects/{id}/issue_categories.json`)에 들어가므로, get_projects 의 문자열 검증을 `projectIdentifierStringSchema`(trim, 1~255자, `/`·`\`·`..`·단독 `.` 거부)로 분리해 두 도구가 공유한다. 클라이언트(`getProjectMemberships`, `getIssueCategories`)도 빈 값·`.`·`..` 를 거부한다 — `encodeURIComponent` 는 점을 인코딩하지 않아 axios 가 dot-segment 로 정규화하기 때문이다(이중 방어).

## 3. 이유 (Reasoning)
- 멤버십·범주는 "프로젝트 상세"의 일부로 자연스럽고, 조회 전용이라 `manage_*` 도구를 새로 만들 이유가 없다. 도구 수(18개)를 유지한다.
- Redmine 의 `/projects/{id}.json?include=issue_categories` 는 범주 id·name 만 주지만 별도 API 는 기본 담당자(`assigned_to`)도 주므로 별도 호출을 택했다. 멤버십은 프로젝트 상세 include 로는 얻을 수 없다.
- 멤버 목록은 LLM 컨텍스트로 그대로 들어가므로 필요한 필드만 화이트리스트로 남기고, 대형 프로젝트에서 응답 폭주·API 호출 폭주를 막기 위해 페이지 상한을 둔다.
- 멤버 조회는 Redmine 권한(`view_members`/`manage_members`)에 따라 403 이 날 수 있어, 전체 실패 대신 섹션 단위로 실패를 알리는 편이 LLM 에게 유용하다.

## 4. 후속 조치 (Action Items)
- [ ] `update_issue` 에 `category`/`category_id` 지원 추가 (현재 update_issue 는 status/notes 만 지원 — 범위 확대가 커서 이번 작업에서 제외)
- [ ] 대형 프로젝트 대비 `memberships` 상한을 파라미터(`memberships_limit`)로 노출하거나 짧은 TTL 캐시 도입 검토 (현재 고정 1,000건)
- [ ] `create_issue` 의 `assignee` 해석을 프로젝트 멤버십 기반으로 좁히는 방안 검토 (현재 전역 사용자 목록 기반)
