---
title: "DL-0010: 위키 등록 및 수정(create_or_update_wiki) 도구 설계 결정"
created: 2026-09-20
updated: 2026-09-20
status: Accepted
tags:
  - decision-log
  - dl
  - wiki
  - write
  - tools
  - design
related:
  - "[[index]]"
  - "[[0003-write-feature-safety-model]]"
  - "[[DL-0007-dry-run-default-true]]"
  - "[[redmine_api_specification]]"
---

# DL-0010: 위키 등록 및 수정(create_or_update_wiki) 도구 설계 결정

## 1. 결정 맥락

사용자의 긴급 요청("위키등록 도구 구현, 우선순위 지금 바로")에 따라, Redmine 위키 문서를 등록 및 관리할 수 있는 도구를 추가하게 되었습니다.
기존에는 조회 전용 `search_wiki`만 구현되어 있었으며, 쓰기 작업을 위한 도구 명칭 및 인터페이스 설계가 필요했습니다.

Redmine REST API의 위키 관리 엔드포인트(`PUT /projects/{project_id}/wiki/{title}.json`)는 페이지가 존재하지 않을 때는 생성(HTTP 201 Created), 이미 존재할 때는 내용 갱신(HTTP 204 No Content)을 수행하는 단일 멱등(Idempotent) 엔드포인트입니다.

## 2. 고려한 대안

### Option A: 생성(`create_wiki`)과 수정(`update_wiki`) 2개 도구로 분리
- **장점**: 사용자의 의도(생성 vs 수정)가 명확히 분리됨.
- **단점**:
  - Redmine API 상으로는 완전히 동일한 엔드포인트를 호출하므로 코드 중복 발생.
  - LLM 입장에서는 대상 위키 문서의 존재 여부를 미리 알지 못할 때 어떤 도구를 써야 할지 혼동하여 도구 호출 횟수 및 토큰 낭비 발생 (Tool Bloat).

### Option B: 단일 도구(`create_or_update_wiki`)로 통합 (채택)
- **장점**:
  - Redmine API 사양(`PUT`)과 1:1로 정확히 일치.
  - Tool Bloat 방지 (AGENTS.md §4 원칙 준수).
  - LLM이 문서 신규 작성 또는 기존 문서 갱신 시 망설임 없이 단일 도구를 활용 가능.
  - 필요 시 `version` 파라미터를 넘겨 동시 수정 충돌을 방어.
- **단점**: 도구 이름이 약간 길어짐.

## 3. 최종 결정

**Option B (`create_or_update_wiki` 단일 도구)**를 채택합니다.

### 핵심 사양 및 보안 모델
1. **보안 가드**: ADR-0003 및 DL-0007을 준수하여 **`dry_run: true`를 기본값**으로 설정합니다. LLM이 사용자에게 등록/수정될 위키 본문과 제목을 먼저 확인받고, 사용자의 명시적 승인 후 `dry_run: false`로 호출하도록 강제합니다.
2. **응답 정규화**:
   - 신규 생성 시 (HTTP 201 Created): Redmine 응답 데이터 반환.
   - 기존 수정 시 (HTTP 204 No Content): `{ message: "Wiki page '...' updated successfully." }` 객체로 정규화하여 빈 응답 파싱 에러 방지.
3. **충돌 방지 지원**: 선택적 `version` 파라미터를 지원하여 여러 사용자 간의 수정 충돌(422)을 감지할 수 있도록 지원합니다.

### Zod 스키마 정의
```typescript
z.object({
  project_id: z.string().regex(/^[a-z0-9\-]+$/, "Invalid project_id").describe("프로젝트 식별자(ID 또는 슬러그 identifier)"),
  title: z.string().min(1, "Title is required").max(100, "Title too long").describe("위키 페이지 제목 (예: 'Home', 'API-Guide')"),
  text: z.string().min(1, "Text cannot be empty").max(65535, "Text too long").describe("위키 페이지 본문 내용 (Markdown 또는 Textile 포맷)"),
  comments: z.string().max(255, "Comments too long").optional().describe("변경/등록 사유 요약 코멘트 (선택사항)"),
  version: z.number().int().positive().optional().describe("수정 시 충돌 방지를 위한 기존 위키 버전 번호 (선택사항)"),
  parent_title: z.string().min(1).max(100).optional().describe("상위 위키 페이지 제목 (계층 구조 생성 시 사용, 선택사항)"),
  dry_run: z.boolean().default(true).describe("기본값이 true이며 안전을 위해 미리보기를 제공합니다. 실제 등록/수정을 원할 경우에만 명시적으로 false로 전달하세요."),
})
```

## 4. 참고 문서
- [[0003-write-feature-safety-model]]: 쓰기 기능 보안 모델 ADR
- [[DL-0007-dry-run-default-true]]: dry_run 기본값 true 정책
- [[redmine_api_specification]]: Redmine 위키 API 엔드포인트 명세
