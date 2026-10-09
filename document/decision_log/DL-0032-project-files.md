---
title: "DL-0032: 프로젝트 파일 탭(Files API) 지원 — 신규 manage_project_files 도구"
created: 2026-10-09
updated: 2026-10-09
author: Claude Code (Opus 5.5)
tags:
  - DL
  - decision-log
  - tools
  - files
  - attachment
aliases:
  - DL-0032
  - DL-0032-project-files
status: active
related:
  - "[[attachment_guide]]"
  - "[[redmine_api_specification]]"
  - "[[mcp_tools_spec]]"
  - "[[DL-0007-dry-run-default-true]]"
  - "[[DL-0014-upload-attachment-tool-design]]"
  - "[[DL-0026-get-projects-security-hardening]]"
  - "[[index]]"
---

# DL-0032: 프로젝트 파일 탭(Files API) 지원 — 신규 manage_project_files 도구

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

> [!abstract] 요약
> Redmine 프로젝트 "파일" 탭(`GET/POST /projects/{project_id}/files.json`, Redmine 3.4+)을 신규 도구 `manage_project_files`(action: `list` | `add`)로 지원한다. 업로드(토큰 발급)는 기존 `upload_attachment`가 그대로 담당하고, 새 도구는 **조회와 토큰 바인딩**만 맡는다. 도구 수는 18 → 19개.

## 1. 주제 (Topic)
[[attachment_guide|첨부파일 가이드]]의 2단계-B(프로젝트 파일 탭 등록)와 파일 탭 목록 조회를 MCP 도구로 노출해야 한다. AGENTS.md 4장(Tool Bloat 방지)에 따라 기존 도구 확장과 신규 `manage_*` 도구를 비교해 결정한다.

## 2. 결정 사항 (Decision)
- 신규 도구 **`manage_project_files`** 를 추가한다.

| 파라미터 | 타입 | 설명 |
|:--|:--|:--|
| `action` | `"list" \| "add"` | 필수 |
| `project_id` | string \| number | 필수. ID·식별자·프로젝트명. get_projects 와 동일 검증(`/`, `\`, `..` 차단, 1~255자, 양의 정수) + 클라이언트에서 `encodeURIComponent`. 숫자가 아닌 문자열은 SmartNameResolver(`client.resolver` 캐시 재사용)로 매핑, 실패 시 식별자로 그대로 사용 |
| `token` | string | `add` 필수. `^\d+\.[0-9a-zA-Z]+$`, 200자 이하 |
| `filename` | string | 선택. upload_attachment 와 같은 금지문자·`..` 규칙 + 제어문자·서식 문자(`\p{Cc}`, `\p{Cf}`, RTL override 등) 거부 |
| `description` | string | 선택. 255자 이하, NUL·양방향 제어 문자 거부(줄바꿈 허용) |
| `version_id` | int > 0 | 선택. `version` 과 동시 지정 불가 |
| `version` | string | 선택. 버전 이름 → `GET /projects/{id}/versions.json` 에서 대소문자·앞뒤 공백 무시 매핑. Files API 는 **프로젝트 소유 버전만** 받으므로(`@project.versions`) 숫자 project id 로 소유 버전만 남긴다(식별자 문자열이면 `getProject` 로 ID 확인). 공유 버전만 일치하면 에러, 여럿이면 에러(`version_id` 지정 요구), 없으면 `available_versions` 와 함께 에러 |
| `dry_run` | boolean | 기본 `true` ([[DL-0007-dry-run-default-true]]). 미리보기에도 버전 이름은 해석해 실제 전송될 `version_id` 를 보여 준다(조회 API만 호출). 미리보기의 토큰은 `7167.ed10…` 처럼 마스킹 |

- 클라이언트: `getProjectFiles(projectId)`, `addProjectFile(projectId, { token, filename?, description?, version_id? })`. 등록 성공 응답은 Redmine 버전에 따라 본문 없는 200 또는 204 이므로 메시지로 정규화한다. 기존 `getProjectVersions` 에도 `encodeURIComponent` 를 적용했다(버전 이름 해석 경로의 경로 조작 방어, `manage_versions` 도 함께 혜택).
- 에러: 404(프로젝트 없음, 버전 지정 시 "버전이 이 프로젝트 소유가 아닐 수 있음" 안내), 403(권한 없음 또는 파일 모듈 비활성), 400(토큰 무효·만료)은 `{ error }` 로 반환한다. 422 는 FilesController 가 내지 않지만 방어적으로 `{ error }` 로 변환한다.
- Redmine 데이터(버전 이름, 422 메시지)를 담는 실패는 예외가 아닌 결과 객체로 반환해 `processToolResult` 를 거치게 한다(예외는 MCP SDK 가 `isError` 로 바꿔 탐지 레이어를 우회하므로).
- `list` 결과는 사용자 입력(description 등)을 포함하므로 `processToolResult`(프롬프트 인젝션 탐지)를 거친다.

## 3. 이유 (Reasoning)
- **upload_attachment 확장안 기각**: 업로드에 "프로젝트 등록" 옵션을 붙이면 (1) 업로드는 지금 dry_run 없이 즉시 수행되는 반면 등록은 dry_run 대상이라 한 호출 안에 서로 다른 안전 정책이 섞이고, (2) 파일 탭 **목록 조회**를 담을 자리가 없으며, (3) 일감 첨부(2단계-A)와 대칭이 깨진다(일감 첨부도 업로드와 바인딩이 별도 도구다).
- **get_projects 확장안 기각**: 조회 전용 도구에 쓰기를 넣으면 읽기/쓰기 경계와 R2 리뷰 범위가 흐려진다.
- **manage_* 통합**: 같은 리소스(프로젝트 파일)의 조회·등록을 `action` 하나로 묶는 것이 AGENTS.md 4장의 규칙이며, 향후 Redmine 이 파일 삭제 API 를 제공하거나 `DELETE /attachments/{id}.json` 연동이 필요해지면 `action` 확장으로 흡수할 수 있다.
- **버전 이름 해석을 도구 내부에서 처리**: SmartNameResolver 는 전역 캐시(프로젝트·트래커 등)만 다루며 버전은 프로젝트별이라 캐시 키 설계가 다르다. 병렬 작업 중인 resolver 변경을 피하고, 등록 시 1회 조회로 충분하므로 도구 내부 조회로 해결했다.

## 4. 후속 조치 (Action Items)
- [x] `src/tools/manage_project_files.ts`, 클라이언트 메서드, 단위 테스트 추가
- [x] `src/index.ts` 등록, AGENTS.md 4장 도구 수(19개) 갱신, [[mcp_tools_spec]]·[[attachment_guide]] 반영
- [x] R2 리뷰(deep + security) 반영: 소유 버전 엄격 필터, `getProjectVersions` 인코딩, 예외 대신 결과 객체, 파일명·설명 제어문자 차단, 미리보기 토큰 마스킹, 403/404 문구 정정
- [ ] (후속) `resolveProjectId` 가 `get_projects` 와 중복 — `resolver.ts` 에 공용 헬퍼(`getSharedResolver(client)`)로 추출 검토
- [ ] (후속) `upload_attachment` 파일명에도 제어문자·서식 문자 차단 규칙 적용 검토
- [ ] 로컬 Docker Redmine 으로 실제 등록·조회 라이브 검증 (파일 모듈 활성화 필요)
