---
title: "DL-0026: get_projects 도구 및 getProject API 보안 강화 (경로 조작 방어, 리졸버 캐시 보존, 예외 복원력)"
created: 2026-09-21
author: Antigravity
tags:
  - decision-log
  - security
  - path-traversal
  - get-projects
  - resolver
  - error-handling
---

# DL-0026: get_projects 도구 및 getProject API 보안 강화

> **안내**: 
> `deep_code_reviewer` 및 `security_code_reviewer` 정밀 감사에서 발견된 경로 조작(Path Traversal)을 통한 API 키 노출 위험, 리졸버 DoS 취약점, 404/403 런타임 크래시 문제를 해결하기 위한 보안 강화 결정 로그입니다.

## 1. 주제 (Topic)
- `client.getProject(projectId)`에서 `encodeURIComponent`가 누락되어 `../../users/current` 입력 시 Axios에 의해 `/users/current.json`이 호출되어 마스킹되지 않은 `api_key`가 유출될 수 있는 고위험 취약점 발견.
- `getProjectsHandler`에서 매번 `new SmartNameResolver(client)`를 생성하여 DL-0022의 5분 TTL 인메모리 캐시가 무효화되고 업스트림 Redmine에 대한 DoS 유발 가능성.
- `SmartNameResolver`가 `p.identifier`(슬러그)를 인덱싱하지 않아 불필요한 전체 재조회 및 fail-open 유발.
- 404(Not Found) 및 403(Forbidden) 발생 시 Axios 에러가 잡히지 않아 MCP 런타임이 크래시되는 문제.

## 2. 결정 사항 (Decision)
1. **URL 인코딩 및 스키마 수준 경로 조작 차단 (다층 방어)**:
   - `src/client/redmine.ts`: `/projects/${encodeURIComponent(String(projectId).trim())}.json`으로 안전하게 인코딩.
   - `src/tools/get_projects.ts`: Zod 스키마에서 `trim()`, `min(1)`, `max(255)`, 및 `!val.includes("/") && !val.includes("\\") && !val.includes("..")` 정제 검증 추가.
2. **리졸버 인스턴스 캐시 보존 및 식별자(Slug) 인덱싱**:
   - `src/client/resolver.ts`: `p.name` 외에 `p.identifier`도 소문자 키로 인덱싱하여 슬러그를 O(1)로 매핑.
   - `getProjectsHandler`: `(client as any).resolver`에 인스턴스를 바인딩하여 5분 TTL 캐시를 보존.
3. **구조화된 예외 처리 (LLM 친화적 응답)**:
   - 404 발생 시 `{ error: "해당 프로젝트를 찾을 수 없습니다: ${projectId}" }` 반환.
   - 403 발생 시 `{ error: "해당 프로젝트에 접근할 권한이 없습니다 (403 Forbidden)" }` 반환.
4. **민감정보 다층 방어 (Defense-in-depth)**:
   - 혹시라도 응답 객체에 `user.api_key`가 포함된 경우 `[REDACTED]`로 마스킹.

## 3. 이유 (Reasoning)
- 시스템의 보안 무결성을 확보하고, 악의적인 입력에 의한 계정 권한 유출 및 DoS 공격을 원천 차단하기 위함.
- 예외 발생 시 도구 프로세스가 비정상 종료되지 않고 LLM이 에러 사유를 인지하고 복구할 수 있도록 보장.

## 4. 후속 조치 (Action Items)
- [ ] Vibe TDD 단계 4: 취약점 검증 테스트 작성 (Red)
- [ ] 보안 강화 코드 적용 (Green)
- [ ] deep_code_reviewer 및 security_code_reviewer 재검토 승인 획득
- [ ] 전체 회귀 테스트 통과 및 머지
