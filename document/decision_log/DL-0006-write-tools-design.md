---
title: "DL-0006: 2단계 쓰기 도구 설계 결정 (분리 vs 통합)"
created: 2026-09-20
updated: 2026-09-20
status: Accepted
tags:
  - decision-log
  - dl
  - write
  - tools
  - design
related:
  - "[[index]]"
  - "[[0003-write-feature-safety-model]]"
  - "[[mcp_tools_spec]]"
---

# DL-0006: 2단계 쓰기 도구 설계 결정 (분리 vs 통합)

## 1. 결정 맥락

1단계 MVP(조회 전용) 완료 및 실 Redmine UAT 통과 후, 2단계 쓰기 기능을 추가하는 설계 단계에서 도구 구조를 결정해야 했습니다.

Redmine은 **댓글 추가**와 **일감 필드 변경(상태, 담당자 등)**을 동일한 API인 `PUT /issues/{id}.json`으로 처리합니다. 이로 인해 MCP 도구 레벨에서 이를 하나로 합칠지, 나눌지 결정이 필요했습니다.

## 2. 고려한 옵션

### Option A: 3개 도구로 완전 분리
- `add_issue_note(issue_id, notes, private_notes)` — 댓글만
- `create_issue(...)` — 신규 일감 생성
- `update_issue(...)` — 필드 변경 (상태, 담당자 등)

**장점**: 각 도구의 역할이 명확하고, 댓글 추가가 실수로 상태 변경을 트리거하는 사고를 원천 방지.
**단점**: 도구 수 증가(Tool Bloat). "댓글 달면서 상태도 바꾸기" 같은 복합 작업 시 LLM이 2번 호출해야 함.

### Option B: 2개 도구로 통합 (채택)
- `add_issue_note(issue_id, notes, private_notes)` — 댓글 **전용** (상태 변경 불가)
- `create_issue(...)` — 신규 일감 생성
- `update_issue(issue_id, notes?, status?, assigned_to?, ...)` — 필드 변경 + 선택적 댓글 동시 지원

**장점**:
- Tool Bloat 방지 (AGENTS.md §4 원칙 준수).
- "상태 변경 + 코멘트 남기기" 같은 복합 요청을 단일 도구 1회 호출로 처리.
- `add_issue_note`는 댓글 전용 도구로 명확하게 유지되어 안전.

**단점**: `update_issue`의 파라미터가 다소 복잡해짐.

## 3. 최종 결정

**Option B (2개+1개 구조)** 채택.

```
add_issue_note  ← 댓글 전용 (낮은 리스크, dry_run 불필요)
create_issue    ← 신규 생성 (dry_run 지원)
update_issue    ← 필드 변경 + 선택적 댓글 (dry_run + allowed_statuses 검증)
```

## 4. 구현 상세 결정 사항

### `add_issue_note` Zod 스키마
```typescript
z.object({
  issue_id: z.number().int().positive(),
  notes: z.string().min(1).max(5000),
  private_notes: z.boolean().default(false),
})
```

### `create_issue` Zod 스키마 (핵심 필드)
```typescript
z.object({
  project_id: z.string(),              // required
  subject: z.string().max(255),        // required
  description: z.string().max(65535).optional(),
  tracker: z.string().optional(),      // Smart Name Resolver 자동 변환
  tracker_id: z.number().int().optional(),
  status: z.string().optional(),
  status_id: z.number().int().optional(),
  priority: z.string().optional(),
  priority_id: z.number().int().optional(),
  assigned_to_id: z.number().int().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estimated_hours: z.number().positive().optional(),
  dry_run: z.boolean().default(false), // 미리보기 가드
})
```

### `update_issue` Zod 스키마 (핵심 필드)
```typescript
z.object({
  issue_id: z.number().int().positive(),   // required
  status: z.string().optional(),
  status_id: z.number().int().optional(),
  assigned_to_id: z.number().int().optional(),
  priority: z.string().optional(),
  priority_id: z.number().int().optional(),
  done_ratio: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),  // 댓글 동시 처리 가능
  private_notes: z.boolean().default(false),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dry_run: z.boolean().default(false),     // 미리보기 가드
})
```

### HTTP 204 응답 처리
`PUT /issues/{id}.json` 성공 시 Redmine은 빈 본문과 함께 HTTP 204를 반환합니다.
`redmine.ts` 클라이언트에서 204 응답을 빈 객체 `{}`로 정규화하여 반환합니다.

## 5. 참고 문서
- [[0003-write-feature-safety-model]]: 쓰기 기능 전반 보안 모델 ADR
- [[redmine_api_specification]]: `PUT /issues/{id}.json` 페이로드 명세
- [[mcp_tools_spec]]: Tool Bloat 방지 원칙
