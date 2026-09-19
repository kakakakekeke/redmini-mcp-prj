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

## 🏃 진행 중인 작업 (In Progress)
- [ ] `search_issues` 도구 TDD 구현 (Redmine API 연동 및 Zod 스키마 검증)

## ⏳ 대기 중인 작업 (To Do)
- [ ] `get_issue_details` 도구 TDD 구현
- [ ] `get_projects` 도구 TDD 구현
- [ ] Smart Name Resolver (상태, 트래커 이름 -> ID 매핑) 로직 구현
- [ ] Express 기반 HTTP(SSE) 전송 계층 연동 및 라우터 셋업
- [ ] 환경변수(`REDMINE_API_KEY`, `REDMINE_URL`) 로드 및 인증 미들웨어(Header 위임) 구현
- [ ] Redmine 연동 엔드투엔드(E2E) 통합 테스트 수행
- [ ] Claude Desktop 및 Cursor IDE 연동 가이드 (`setup_and_deployment.md`) 작성

## ✅ 완료된 작업 (Done)
- [x] 오픈소스 벤치마킹 및 라이선스, 아키텍처 리서치 (`redmine_mcp_research.md`)
- [x] 조회 전용 1단계 MVP 도구 명세 확정 (`mcp_tools_spec.md`)
- [x] 다중 사용자 및 이중 전송 계층 아키텍처 설계 (`architecture_design.md`)
- [x] Node.js 프로젝트 초기화 및 패키지 설치 (`npm init`, `typescript`, `@modelcontextprotocol/sdk`)
- [x] Vibe TDD 워크플로우 셋업 (Vitest, `vibe_tdd_sop.md`, 훅 설정, 서브에이전트 정의)
- [x] 문서화 템플릿(SOP, ADR, DL) 및 관리 체계 셋업
