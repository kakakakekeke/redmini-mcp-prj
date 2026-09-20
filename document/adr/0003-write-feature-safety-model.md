---
title: "ADR-0003: 쓰기(Write) 기능 보안 모델 및 가드 전략"
created: 2026-09-20
updated: 2026-09-20
status: Accepted
tags:
  - adr
  - architecture
  - security
  - write
  - guard
related:
  - "[[index]]"
  - "[[0001-initial-architecture]]"
  - "[[mcp_tools_spec]]"
---

# ADR-0003: 쓰기(Write) 기능 보안 모델 및 가드 전략

## 1. 배경 및 맥락 (Context)

1단계(MVP)는 비파괴적인 조회(Read-only) 기능 3종으로만 구성하여 보안 리스크를 최소화했습니다. UAT를 통해 실 Redmine 연동이 안정적임을 검증한 이후, 현업 사용 빈도가 높은 쓰기(Write) 기능을 추가합니다.

쓰기 기능은 LLM이 의도치 않게 또는 잘못된 파라미터로 호출할 경우 **실제 Redmine 데이터가 변경·생성**됩니다. 따라서 MVP와는 다른 수준의 보안 모델과 실수 방지 가드가 필요합니다.

추가 예정 도구:
- `add_issue_note` — 일감 댓글(저널) 추가
- `create_issue` — 새 일감 생성
- `update_issue` — 일감 상태/담당자/우선순위 등 변경

## 2. 고려한 대안들 (Considered Options)

### 가드(Guard) 전략

- **대안 A: `dry_run` 파라미터 방식**
  - 모든 쓰기 도구에 `dry_run: boolean` 파라미터 추가.
  - `dry_run: true`일 때는 Redmine API를 실제로 호출하지 않고 실행될 내용을 요약하여 반환.
  - LLM이 먼저 dry_run으로 미리보기를 보여주고, 사용자 확인 후 `dry_run: false`로 재호출.

- **대안 B: 도구 설명(description)에만 명시**
  - 코드 수준 가드 없이, 도구 description에 "반드시 사용자에게 확인 후 실행"을 명시.
  - 구현이 단순하지만 LLM의 프롬프트 해석에 의존하므로 신뢰성이 낮음.

- **대안 C: `confirm_token` 2단계 인증**
  - 1차 호출 시 서버가 토큰을 생성·반환하고, 2차 호출 시 해당 토큰을 포함해야만 실행.
  - 보안성이 높으나 구현 복잡도가 과도하게 높고 LLM 상호작용 흐름이 복잡해짐.

### 상태 전이 보호 전략

- **대안 A: `allowed_statuses` 선제 검증 (권장)**
  - `update_issue` 호출 시, Redmine의 `GET /issues/{id}.json?include=allowed_statuses`로 유효한 전이 상태 목록을 먼저 조회.
  - 요청한 상태가 목록에 없으면 API 호출 없이 즉시 에러 반환.
  - Redmine 워크플로우 설정을 MCP 서버가 존중.

- **대안 B: Redmine API 위임 후 422 처리**
  - 선제 검증 없이 무조건 Redmine API를 호출하고, 422 에러를 클라이언트에 전달.
  - 구현이 단순하지만 불필요한 API 호출이 발생하고 에러 메시지가 LLM에 불친절.

## 3. 최종 결정 (Decision)

> **가드 전략**: 대안 A (`dry_run` 파라미터 방식)를 `create_issue`와 `update_issue`에 적용한다. `add_issue_note`는 상대적으로 파급력이 낮으므로 dry_run 없이 description 명시로 대체한다.

> **상태 전이 보호**: 대안 A (`allowed_statuses` 선제 검증)를 `update_issue`에 적용한다.

## 4. 결정 근거 (Rationale)

### `dry_run` 채택 이유
- LLM은 사용자의 "일감 만들어줘"라는 요청을 받았을 때, 실행 전 미리보기를 보여주는 자연스러운 대화 흐름을 만들 수 있음.
- `dry_run=true` 응답을 사용자가 보고 "좋아, 만들어줘"라고 확인하면 LLM이 `dry_run=false`로 재호출하는 패턴이 직관적.
- 코드 레벨에서 실수를 차단하므로 description 명시만 하는 대안 B보다 신뢰성이 높음.
- 대안 C(confirm_token)보다 구현 복잡도가 낮고 MCP 표준 흐름에 부합.

### `add_issue_note`에 dry_run 미적용 이유
- 댓글 추가는 일감의 상태나 데이터를 바꾸지 않음. 잘못된 댓글이 달려도 Redmine에서 직접 삭제·수정 가능.
- dry_run 없이 description에 "댓글 내용을 먼저 사용자에게 보여주고 확인받을 것"을 명시하는 것으로 충분.

### `allowed_statuses` 선제 검증 채택 이유
- Redmine은 프로젝트별로 커스텀 워크플로우를 가질 수 있어, 특정 상태에서 전이 가능한 상태가 제한됨.
- LLM이 알 수 없는 워크플로우 제약을 서버가 대신 검증함으로써 422 에러를 사전 방지.
- LLM에게 "이 일감은 현재 '진행중' → '해결됨' 또는 '반려됨'으로만 변경 가능합니다"라는 친화적 메시지를 제공 가능.

## 5. 결과 및 영향 (Consequences)

### 긍정적 영향
- 쓰기 기능의 실수·오남용 리스크 감소.
- `allowed_statuses` 검증으로 워크플로우 무결성 보장.
- LLM과의 대화 흐름(미리보기 → 확인 → 실행)이 자연스럽고 사용자 친화적.

### 부정적 영향 / Trade-off
- `dry_run` 지원으로 `create_issue`/`update_issue` 구현 코드 복잡도 소폭 증가.
- `update_issue` 호출 시 `allowed_statuses` 조회를 위한 추가 API 요청 발생 (1회 추가 네트워크 비용).

### 보안 정책 요약

| 도구 | dry_run 지원 | 상태 전이 검증 | 설명 명시 |
|:---|:---:|:---:|:---:|
| `add_issue_note` | ❌ | ❌ | ✅ |
| `create_issue` | ✅ | ❌ (초기 상태 고정) | ✅ |
| `update_issue` | ✅ | ✅ (allowed_statuses) | ✅ |

## 6. 참고 및 연관 문서 (References)
- [[0001-initial-architecture]]: 1단계 초기 아키텍처 결정
- [[mcp_tools_spec]]: MVP 도구 명세 및 보안 가이드라인
- [[redmine_api_specification]]: `PUT /issues/{id}.json` 및 `allowed_statuses` 명세
- [[DL-0006-write-tools-design]]: 쓰기 도구 분리/통합 실무 결정
