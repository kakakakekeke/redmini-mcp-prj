---
title: "DL-0025: get_projects 도구 확장 및 프로젝트별 일감 커스텀 필드(issue_custom_fields) 조회 지원"
created: 2026-09-21
author: Antigravity
tags:
  - decision-log
  - custom-fields
  - get-projects
  - redmine-api
---

# DL-0025: get_projects 도구 확장 및 프로젝트별 일감 커스텀 필드(issue_custom_fields) 조회 지원

> **안내**: 
> 관리자 권한이 없는 일반 사용자 계정에서도 특정 프로젝트에 매핑된 일감 커스텀 필드 목록을 안전하게 확인할 수 있도록 `get_projects` 도구 파라미터 및 `RedmineClient`를 확장합니다.

## 1. 주제 (Topic)
- 일반 사용자 API Key로 Redmine의 커스텀 필드 목록을 확인하고자 할 때, 전체 커스텀 필드 엔드포인트(`GET /custom_fields.json`)는 관리자(Admin) 권한이 필수이므로 `403 Forbidden`이 발생함.
- Redmine REST API는 `GET /projects/{id}.json?include=issue_custom_fields`를 통해 일반 사용자에게도 해당 프로젝트에 활성화된 커스텀 필드 메타데이터 조회를 허용함.
- 이를 MCP 서버에서 어떻게 제공할 것인가? (신규 도구 `get_project_details` 분리 vs 기존 `get_projects` 도구 확장)

## 2. 결정 사항 (Decision)
1. **Tool Bloat 방지 (기존 도구 확장)**:
   - 신규 도구를 추가하지 않고 기존 `get_projects` 도구의 스키마에 선택적 `project_id` 파라미터를 추가한다.
   - `project_id`가 생략되면 기존처럼 전체 프로젝트 목록(`projects`)을 반환하고, `project_id`가 제공되면 단일 프로젝트의 상세 정보(`project`)를 반환한다.
2. **RedmineClient에 getProject 메서드 추가**:
   - `GET /projects/{id}.json` 호출 시 `include=trackers,issue_categories,enabled_modules,time_entry_activities,issue_custom_fields`를 기본 파라미터로 바인딩한다.
3. **SmartNameResolver 연동**:
   - `project_id`로 프로젝트 식별자(identifier) 또는 숫자 ID 외에 프로젝트 표시 이름이 들어올 경우에도 캐시된 리졸버를 통해 ID를 자동 변환 지원한다.

## 3. 이유 (Reasoning)
- **프롬프트 토큰 절약 및 LLM 친화성**: 도구 목록이 과도하게 늘어나는 것(Tool Bloat)을 방지하여 모델 컨텍스트 효율을 극대화함.
- **권한 호환성**: 관리자 권한이 없어도 일감 작성/검색 전에 필요한 프로젝트별 커스텀 필드 목록(`issue_custom_fields`)을 LLM이 선제적으로 파악할 수 있음.

## 4. 후속 조치 (Action Items)
- [ ] `RedmineClient.getProject` 메서드 및 단위 테스트 구현
- [ ] `getProjectsSchema` 및 `getProjectsHandler` 확장 및 도구 테스트 구현
- [ ] `src/index.ts`의 `get_projects` 도구 설명 갱신
- [ ] 전체 회귀 테스트 통과 확인
