---
title: "DL-0013: 내 계정 정보 조회(get_my_account) 도구 및 Fallback 설계"
created: 2026-09-20
author: subagent-Account-Tool-Developer
tags:
  - decision-log
  - dl
  - account
  - tools
  - fallback
related:
  - "[[index]]"
  - "[[redmine_api_specification]]"
  - "[[DL-0008-subagent-todo-completion-enforcement]]"
---

# DL-0013: 내 계정 정보 조회(get_my_account) 도구 및 Fallback 설계

> **안내 (ADR과의 구분 규칙)**: 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
현재 인증된 사용자의 프로필 및 계정 정보를 조회하는 `get_my_account` 도구의 Redmine API 연동 및 버전 호환성(Fallback) 설계.

## 2. 결정 사항 (Decision)
1. **Fallback 전략 채택**:
   - 1차적으로 Redmine 4.1+의 공식 내 계정 엔드포인트인 `GET /my/account.json`을 호출한다.
   - 대상 Redmine 서버가 구버전(< 4.1)이거나 404 Not Found를 반환할 경우, 자동으로 `GET /users/current.json`으로 Fallback 호출하여 계정 정보를 안전하게 조회한다.
2. **연관 데이터(Include) 확장 옵션 제공**:
   - 사용자가 속한 프로젝트 목록 및 그룹 정보를 함께 조회할 수 있도록 `include_memberships` (기본값: false), `include_groups` (기본값: false) 옵션을 Zod 스키마로 정의한다.
3. **사용자 친화적 에러 래핑**:
   - 401 Unauthorized 발생 시 명확한 안내 메시지(`인증에 실패했습니다. 유효한 API Key를 확인하세요.`)를 반환한다.
   - 404 Not Found 발생 시 안내 메시지(`내 계정 정보를 찾을 수 없습니다.`)를 반환한다.

## 3. 이유 (Reasoning)
- Redmine 4.1 이전 버전에서는 `/my/account.json`이 지원되지 않고 `/users/current.json`만 지원되므로, 엔드포인트 Fallback을 통해 다양한 환경의 Redmine 인스턴스와의 하위 호환성을 보장할 수 있음.
- `include` 옵션을 선택적으로 받음으로써 불필요한 네트워크 페이로드를 줄이고 LLM 토큰 소모를 최적화함.

## 4. 후속 조치 (Action Items)
- [x] `tests/tools/get_my_account.test.ts` 단위/통합 테스트 작성 (TDD Red)
- [x] `src/client/redmine.ts`에 `getMyAccount()` 및 fallback 구현 (TDD Green)
- [x] `src/tools/get_my_account.ts` Zod 스키마 및 핸들러 구현
- [x] `src/index.ts`에 `get_my_account` 도구 등록
- [x] `document/todo.md` 대기열 완료(`[x]`) 동기화 (DL-0008)
