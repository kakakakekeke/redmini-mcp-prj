---
title: "프로젝트 할 일 및 진행 현황 (TO-DO)"
created: 2026-09-19
updated: 2026-09-19
tags:
  - todo
  - tracker
---

# 📋 Redmine MCP 서버 개발 TO-DO

> **안내**: 개발이 어느 정도 완료되어 자체 Redmine 인스턴스와 연동이 가능해지면, 이 문서의 할 일들은 실제 Redmine 일감으로 이관하여 추적(Dogfooding)합니다.

## ⏳ 할 일 대기열 (Priority Queue)
> **주의 (Queue Management Rules)**: 
> 1. **순서 강제**: 작업은 반드시 위에서부터 순서대로 진행해야 하며, 할 일의 첫 머리에 작업 브랜치명(`` ` ``)을 명시해야 합니다. (pre-commit 훅으로 강제됨)
> 2. **신규 등록 시 우선순위 검토**: 새로운 할 일을 추가할 때 무조건 맨 밑에 추가하지 마십시오. 작업의 기술적 종속성(Dependency)과 비즈니스 중요도를 분석하여 **가장 적절한 순서(위치)에 삽입**해야 합니다.
> 3. **사용자 승인(Review) 필수**: 에이전트는 대기열에 새로운 작업을 추가하거나 순서를 변경할 경우, 반드시 사용자(USER)에게 그 이유를 설명하고 승인을 받은 뒤에만 커밋해야 합니다.

1. [ ] `test/e2e-integration` : Redmine 연동 엔드투엔드(E2E) 통합 테스트 수행
2. [ ] `docs/setup-guide` : Claude Desktop 및 Cursor IDE 연동 가이드 (setup_and_deployment.md) 작성

## ✅ 완료된 작업 (Done)
- [x] `feature/auth-middleware` : 환경변수(REDMINE_API_KEY, REDMINE_URL) 로드 및 인증 미들웨어(Header 위임) 구현
- [x] `feature/http-sse-layer` : Express 기반 HTTP(SSE) 전송 계층 연동 및 라우터 셋업
- [x] `feature/smart-name-resolver` : Smart Name Resolver (상태, 트래커 이름 -> ID 매핑) 로직 구현
- [x] `feature/get-projects` : get_projects 도구 TDD 구현
- [x] `chore/enforce-hooks-policy` : AGENTS.md에 훅 우회 금지 조항 명문화
- [x] `feature/get-issue-details` : get_issue_details 도구 TDD 구현
- [x] `feature/search-issues` : search_issues 도구 TDD 구현 (Redmine API 연동 및 Zod 스키마 검증)
- [x] `chore/enforce-commit-scope` : 커밋 메시지 스코프(Scope) 작성 의무화 및 Husky 보완
- [x] `docs/test-architecture` : 테스트 아키텍처 ADR 추가 및 Worktree 가드레일 훅 적용
- [x] `chore/setup-todo-queue` : todo.md를 Queue 형태로 리팩토링하고 pre-commit에 큐 강제 로직 추가
- [x] `chore/update-todo-rules` : TO-DO 큐 관리에 대한 사용자 승인(Review) 강제 룰을 AGENTS.md와 todo.md에 추가
- [x] 다중 에이전트 동시 작업용 Git Worktree SOP 수립 및 스킬(`.agents/skills/git-workflow`) 등록
- [x] Husky 도입 및 Git Hook(`pre-commit`, `commit-msg`) 고도화 (main 브랜치 보호, 영향도 리뷰 태그 강제)
- [x] 오픈소스 벤치마킹 및 라이선스, 아키텍처 리서치 (`redmine_mcp_research.md`)
- [x] 조회 전용 1단계 MVP 도구 명세 확정 (`mcp_tools_spec.md`)
- [x] 다중 사용자 및 이중 전송 계층 아키텍처 설계 (`architecture_design.md`)
- [x] Node.js 프로젝트 초기화 및 패키지 설치 (`npm init`, `typescript`, `@modelcontextprotocol/sdk`)
- [x] Vibe TDD 워크플로우 셋업 (Vitest, `vibe_tdd_sop.md`, 훅 설정, 서브에이전트 정의)
- [x] 문서화 템플릿(SOP, ADR, DL) 및 관리 체계 셋업
