---
title: "DL-0022: SmartNameResolver TTL 인메모리 캐시 적용"
created: 2026-09-21
author: Antigravity
tags:
  - decision-log
  - security
  - resolver
  - ttl
  - cache
related:
  - "[[security_audit_report]]"
  - "[[architecture_design]]"
---

# DL-0022: SmartNameResolver TTL 인메모리 캐시 적용

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
보안 감사 보고서([[security_audit_report]] 2-5항)에 따라, `SmartNameResolver`가 사용자/프로젝트/상태/트래커 메타데이터를 매 요청마다 무제한으로 조회하거나 캐시 갱신 주기 없이 동작할 경우 발생할 수 있는 Redmine 인스턴스 부하(DoS 위험) 및 사용자 정보 과다 노출을 완화하기 위해 TTL 기반 인메모리 캐싱 도입.

## 2. 결정 사항 (Decision)
- `SmartNameResolver`에 `lastLoadedAt` 및 `cacheTtlMs`(기본값: 5분, 300,000ms) 필드를 추가한다.
- `load(force: boolean = false)` 메서드에서 캐시가 유효한 동안(`Date.now() - lastLoadedAt < cacheTtlMs`)에는 원격 Redmine API를 추가 호출하지 않고 기존 매핑 테이블을 즉시 재사용한다.
- 강제 갱신이 필요한 경우 `force: true`를 전달하거나, `clearCache()` 메서드를 통해 캐시를 즉시 만료시킬 수 있도록 지원한다.

## 3. 이유 (Reasoning)
- 도구 호출이 빈번하게 일어날 때 Redmine API 서버로 쏟아지는 불필요한 메타데이터 전수 조회(프로젝트, 트래커, 상태, 우선순위, 사용자, 활동 등)를 차단하여 시스템 안정성과 응답 속도를 개선.
- 사용자 목록 조회 횟수를 제한하여 메타데이터 정보 노출 빈도 최소화.

## 4. 후속 조치 (Action Items)
- [x] `src/client/resolver.ts`에 TTL 캐시 상태 관리 및 `clearCache()` 메서드 구현
- [x] `tests/unit/resolver.test.ts`에 TTL 만료 전 재사용, `force=true`, `clearCache()`, TTL 만료 후 재조회 검증 테스트 작성 및 통과
