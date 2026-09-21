---
title: "DL-0019: add_issue_note 도구에 dry_run 파라미터 추가 및 기본값 true 적용"
created: 2026-09-21
author: Antigravity
tags:
  - decision-log
  - add_issue_note
  - security
  - dry_run
related:
  - "[[0003-write-feature-safety-model]]"
  - "[[DL-0007-dry-run-default-true]]"
---

# DL-0019: add_issue_note 도구에 dry_run 파라미터 추가 및 기본값 true 적용

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
보안 감사 보고서([[security_audit_report]] 2-3항) 지적 사항에 따라, 간접 프롬프트 주입(Indirect Prompt Injection) 공격자가 외부 일감 본문이나 위키 내용을 통해 악성 댓글을 강제 게시하게 유도하는 취약점을 방어하기 위해 `add_issue_note` 도구에 `dry_run` 가드 적용.

## 2. 결정 사항 (Decision)
- `addIssueNoteSchema`에 `dry_run: z.boolean().optional().default(true)` 필드를 추가한다.
- `addIssueNoteHandler`에서 `args.dry_run`이 `true`인 경우 Redmine REST API를 호출하지 않고 일감 ID, 작성 내용, 비공개 여부와 함께 미리보기 성공 메시지를 즉시 반환한다.
- 실제 일감에 댓글을 등록하기 위해서는 LLM 또는 호출자가 명시적으로 `dry_run: false`를 전달해야만 API 요청이 수행되도록 강제한다.
- MCP 도구 등록 설명(description)에 `(dry_run 지원, 기본값: true)` 안내 문구를 명시한다.

## 3. 이유 (Reasoning)
- `DL-0007`(Fail-Safe 기본 원칙)과의 일관성을 유지하고, 쓰기 도구의 불의의 데이터 조작을 방어하기 위함.
- LLM이 악의적인 지시문을 읽고 자율적으로 댓글을 작성하더라도 기본값이 `true`이므로 실제 Redmine에는 아무런 영향이 없으며, 사용자 확인을 거쳐야만 실제 작성이 이루어지는 다단계 확인 안전망 구축.

## 4. 후속 조치 (Action Items)
- [x] [src/tools/add_issue_note.ts](file:///Users/kakakakekeke/workspace/redmini-mcp-prj/src/tools/add_issue_note.ts)에 `dry_run` 스키마 및 핸들러 분기 로직 구현
- [x] [src/index.ts](file:///Users/kakakakekeke/workspace/redmini-mcp-prj/src/index.ts)의 `add_issue_note` 도구 설명 업데이트
- [x] [tests/tools/add_issue_note.test.ts](file:///Users/kakakakekeke/workspace/redmini-mcp-prj/tests/tools/add_issue_note.test.ts)에 기본 `dry_run: true` 및 `dry_run: false` 검증 테스트 추가 및 통과
