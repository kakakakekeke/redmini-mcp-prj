---
title: "DL-0035: create_issue/update_issue 커스텀 필드 값 입력과 관리자 키 사전 검증(graceful degradation)"
created: 2026-10-09
author: Claude Code (subagent)
tags:
  - decision-log
  - custom-fields
  - create-issue
  - update-issue
  - smart-name-resolution
  - prompt-injection
updated: 2026-10-09
aliases:
  - DL-0035-issue-custom-field-values
status: active
related:
  - "[[index]]"
  - "[[DL-0025-project-custom-fields-support]]"
  - "[[DL-0031-saved-queries]]"
  - "[[DL-0033-project-memberships-categories]]"
  - "[[mcp_tools_spec]]"
---

# DL-0035: 일감 커스텀 필드 값 입력 (create_issue / update_issue)

## 1. 주제 (Topic)
LLM 이 일감을 만들거나 고칠 때 커스텀 필드 값(예: 고객사, 요청번호, 영향범위)을 넣을 수 있어야 한다.
Redmine REST 는 `POST/PUT /issues` 페이로드의 `custom_fields: [{id, value}]`(다중 선택은 `value` 배열)로 값을 받지만,

- LLM 은 숫자 ID 보다 필드 **이름**을 알고 있다.
- 필드 정의(`field_format`, `possible_values`, `multiple`, `regexp`, `trackers`)는 **관리자 전용** `GET /custom_fields.json` 에만 있고 비관리자는 403 을 받는다. 프로젝트 상세(`include=issue_custom_fields`)는 id·name 만 준다.
- Redmine 은 프로젝트·트래커에 활성화되지 않은 필드 값을 **오류 없이 무시**한다.

새 도구 없이(도구 수 19개 유지) 기존 쓰기 도구를 어떻게 확장할지 결정이 필요했다.

## 2. 결정 사항 (Decision)

```mermaid
flowchart TD
  A[custom_fields 입력] --> B{Zod 검증<br/>키 1~255자·최대 50개·예약 키 거부<br/>값 string ≤65535 / number / boolean / 배열 ≤100×1024}
  B --> C[병렬 조회]
  C --> D[GET /projects/{id}.json<br/>include=issue_custom_fields]
  C --> E[GET /custom_fields.json]
  D --> F{키 해석<br/>숫자 키 = ID, 이름 = 정확→정규화 유일 일치}
  F -- 실패 --> X[예외: Redmine 데이터 미포함]
  E -- 200 --> G[사전 검증: 트래커·다중선택·허용값<br/>regexp 는 실행하지 않고 안내만]
  E -- 403 등 실패 --> H[검증 생략 performed=false<br/>Redmine 422 로 위임]
  G -- 오류 --> Y["{error, custom_field_errors} 반환<br/>(API 호출 없음)"]
  G -- 통과 --> Z[dry_run 미리보기 / 실제 호출]
  H --> Z
```

1. **파라미터**: `create_issue`·`update_issue` 에 `custom_fields: Record<string, string | number | string[]>` 를 추가한다(공용 스키마 `src/utils/issue_custom_fields.ts`).
   - 키는 필드 **이름**(대소문자·앞뒤 공백·보이지 않는 문자 무시, `normalizeName` 재사용) 또는 **숫자 ID 문자열**. 숫자로만 된 키는 항상 ID 로 해석한다.
   - 값: 숫자는 문자열로(지수 표기가 필요한 숫자는 거부), 불리언은 `"1"`/`"0"`, 배열 원소(문자열·숫자)는 문자열로 변환. 빈 문자열·빈 배열은 값 비우기.
   - 상한: 키 255자, 항목 50개, 문자열 65,535자, 배열 100개 × 1,024자. `__proto__`/`constructor`/`prototype` 키 거부.
2. **이름 → ID 해석**: 프로젝트의 `issue_custom_fields` 로 해석한다. 숫자 ID 도 이 목록에 있어야 한다(Redmine 이 조용히 무시하는 것을 방지). 정확 일치 → 정규화 일치가 **유일할 때만** 채택, 2개 이상이면 `Ambiguous`, 없으면 `Invalid`, 두 키가 같은 ID 를 가리키면 `Duplicate` 예외. 프로젝트 조회 403/404 는 `Cannot resolve custom fields: project not found or no permission (HTTP n).` 로 바꾼다.
   - `create_issue` 는 입력 `project_id`, `update_issue` 는 일감 상세의 숫자 `project.id` 를 쓴다. `update_issue` 는 상태 검증과 커스텀 필드 해석이 **같은 `getIssueDetails` 결과를 공유**한다(1회 호출).
   - 프로젝트 단위 데이터라 전역 TTL 캐시(`SmartNameResolver`)에 넣지 않고 호출 시점에 조회한다(DL-0033 범주와 동일).
3. **관리자 키 사전 검증**: `GET /custom_fields.json`(`customized_type: "issue"` 만)이 성공하면 필드별로 검사한다.
   - 트래커: 트래커 ID 를 알 때(create 는 해석된 `tracker_id`, update 는 일감의 트래커) 필드의 `trackers` 에 없으면 오류(조용한 무시 방지).
   - 트래커를 모르면(create 에서 트래커 미지정) `skipped_checks`(`tracker`)에 남긴다.
   - 다중 선택: `multiple: false` 필드에 원소 2개 이상 배열이면 오류. `[]` 는 `""`, 원소 하나는 그 값으로 푼다.
   - 허용값(`possible_values`, 형식이 list·enumeration·bool 일 때만): 값 정확 일치 → 라벨 정확 일치 → 정규화 일치가 유일할 때 **표준 값으로 치환**(예: `"api"` → `"API"`, enumeration 라벨 `"High"` → 값 `"11"`, bool `"yes"` → `"1"`). 없으면 오류에 허용값(정제, 최대 100개)을 담는다. user·version 형식은 `/custom_fields.json` 의 `possible_values` 가 프로젝트 문맥 없이 계산되어 신뢰할 수 없으므로 검사하지 않는다(숫자 ID 입력 안내). 필드당 허용값은 1,000개까지만 처리한다.
   - **regexp 는 실행하지 않는다.** 관리자 정의 패턴을 Node 이벤트 루프에서 동기 실행하면 `(a|aa)+$`, `^\d*\d*\d*\d*$` 같은 패턴이 수 초~수십 초 서버 전체를 멈춘다(리뷰에서 재현, 휴리스틱으로는 막을 수 없음). 값이 있으면 `skipped_checks`(`regexp`)에 정제된 패턴을 보여 주고 Redmine 422 로 검증한다.
   - 정의를 찾지 못한 필드도 `skipped_checks`(`definition`)에 남긴다.
   - **일감 적용 가능 여부(update, 관리자 무관)**: `update_issue` 는 이미 조회한 일감 상세의 `issue.custom_fields`(이 일감의 트래커·권한에서 보이는 필드) 에 없는 필드를 오류로 돌려준다. 비관리자도 "성공했는데 값이 없는" 상황을 피한다.
   - **적용 누락 경고(create)**: 생성 응답의 `issue.custom_fields` 에 보낸 필드가 없으면 `custom_fields_not_applied: [id]` 와 `warning` 을 덧붙인다.
4. **graceful degradation**: `/custom_fields.json` 이 실패(401/403 비관리자, 404, 5xx, 네트워크)하거나 형식이 예상과 다르면 검증을 건너뛰고(`custom_field_validation.performed: false`, `reason` 에는 상태 코드만) Redmine 의 422 응답으로 검증을 위임한다. 사전 검증은 부가 기능이므로 쓰기를 막지 않는다. 프로젝트 조회와 정의 조회는 서로 독립이라 **병렬**로 수행해 비관리자도 지연이 늘지 않게 한다.
5. **결과 형태**
   - 값 검증 실패: 예외 대신 `{ error, dry_run, custom_field_errors: [{id, name, value, problem, allowed_values?}], custom_field_validation }` 를 반환하고 API 를 호출하지 않는다(허용값을 LLM 에 보여 줘야 고칠 수 있기 때문).
   - `dry_run` 미리보기: 페이로드(`custom_fields: [{id, value}]`)와 함께 `custom_fields: [{id, name, value}]`, `custom_field_validation` 을 표시한다. `dry_run` 기본값 `true` 유지(ADR-0003, DL-0007).
   - `update_issue` 는 `custom_fields` 만 있어도 유효한 업데이트로 인정한다.
6. **프롬프트 주입 방어**
   - 예외 메시지에는 Redmine 데이터(필드 이름·허용값)를 넣지 않는다(DL-0033 방식). 사용자 입력 키만 `JSON.stringify` 로 인용한다.
   - 미리보기·검증 오류 객체에는 Redmine 데이터가 들어가므로 `src/index.ts` 에서 `create_issue`·`update_issue` 결과를 `processToolResult` 로 감싼다. 필드 이름·허용값·regexp 는 `cleanExternalText`(DL-0031)로 정제한다.
   - 허용값 치환 결과는 Redmine 에 원문 그대로 보내야 하므로 **표시용(`custom_fields[].value`, 정제)과 페이로드(원문)를 분리**한다. 또 `detectPromptInjection` 이 문자열의 정제 사본도 검사하도록 바꿔 폭 0 문자로 쪼갠 패턴(`I\u200BGNORE`)도 탐지한다(전 도구 공통, 탐지만 늘어남).
   - Redmine 422 메시지(`formatRedmineValidationError`)는 정제·2,000자 상한·주입 패턴 경고를 붙여 예외로 던진다. `create_issue` 도 이제 422 메시지를 그대로 보여 준다(이전에는 axios 기본 메시지).
7. **클라이언트**: `RedmineClient.getCustomFields()` 추가. `getProject` 도 `encodeProjectSegment`(`.`·`..`·빈 값 거부)를 쓰도록 통일했다.

## 3. 이유 (Reasoning)
- 같은 리소스(일감) 쓰기에 파라미터를 더하는 것이 Tool Bloat 방지 원칙에 맞다.
- 관리자 여부를 미리 알 방법이 없으므로 "시도 후 403 이면 생략"이 가장 단순하고, 병렬 호출이라 비용이 거의 없다. 비관리자에게도 Redmine 422 가 최종 방어선이 된다.
- Redmine 이 활성화되지 않은 필드 값을 조용히 버리므로, 숫자 ID 도 프로젝트 필드 목록으로 확인하고(전 사용자), 트래커 활성 여부는 관리자일 때 검사해 "성공했는데 값이 없는" 혼란을 줄인다.
- regexp 사전 검증은 편의 기능인데 ReDoS 로 서버 전체 가용성을 해칠 수 있다. `vm` 타임아웃이나 RE2(의존성 추가)도 검토했으나, Redmine(Ruby 3.2+ 정규식 메모이제이션)이 최종 검증하므로 실행하지 않고 패턴만 안내하는 것이 가장 단순하고 안전하다.
- R2 리뷰(deep·security) 지적사항: ReDoS(High), 비관리자 트래커 무시(M1), 적용 누락(M2), user·version 허용값(M3), 단일값 배열·불리언·5xx·트래커 미상·표시값 정제를 반영했다.

## 4. 후속 조치 (Action Items)
- [ ] 메인 세션: 로컬 Redmine 픽스처(`MCP-TEST 고객사`/`요청번호`/`영향범위`)로 관리자·비관리자 키 라이브 검증
- [ ] 비관리자 키의 반복 403·대형 `/custom_fields.json` 반복 조회를 줄이기 위해 API 키 단위 짧은 TTL 캐시 검토
- [ ] `update_issue` 는 PUT 이 204 라 적용 누락을 응답으로 확인할 수 없음 — 워크플로 읽기 전용 필드는 현재 탐지 불가 (재조회 비교 검토)
- [ ] user·version 형식 필드의 이름 → ID 해석(Smart Name Resolution) 검토
- [ ] `create_issue` 에서 트래커 미지정(프로젝트 기본 트래커) 시 트래커 활성 검사 보강 검토
- [ ] `int`/`float`/`date` 형식 사전 검증 추가 여부 검토 (현재 Redmine 422 에 위임)
