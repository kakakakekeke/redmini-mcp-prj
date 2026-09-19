---
title: "DL-0001: TDD 테스트 러너로 Vitest 채택"
created: 2026-09-19
author: Antigravity
tags:
  - decision-log
  - testing
  - tdd
---

# DL-0001: TDD 테스트 러너로 Vitest 채택

> **안내 (ADR과의 구분 규칙)**: 본 결정 로그는 실무적인 도구 선택과 개발 환경 구성에 관한 기록입니다.

## 1. 주제 (Topic)
Vibe Coding 기반 TDD(Test-Driven Development) 워크플로우를 위해 어떤 테스트 프레임워크를 도입할 것인가?

## 2. 결정 사항 (Decision)
Jest를 대신하여 **Vitest**를 프로젝트의 공식 단위 테스트 러너로 채택한다.

## 3. 이유 (Reasoning)
- **속도와 피드백:** Vibe Coding은 LLM 에이전트와 코드 사이의 피드백 루프 속도가 생명입니다. Vitest는 기본적으로 매우 빠르며 HMR(Hot Module Replacement) 기능이 강력합니다.
- **ESM 호환성:** 프로젝트를 TypeScript ESM(`"type": "module"`) 기반으로 설정(`package.json`, `tsconfig.json`)했기 때문에, ESM 환경을 네이티브로 지원하는 Vitest가 Jest(설정의 복잡함)보다 유리합니다.

## 4. 후속 조치 (Action Items)
- [x] `npm install -D vitest` 패키지 설치
- [x] `vibe_tdd_sop.md` 수행 절차 명령어에 `npx vitest run` 명시
