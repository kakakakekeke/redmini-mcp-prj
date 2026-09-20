---
title: "DL-0007: dry_run 파라미터 기본값 변경 (false -> true)"
created: 2026-09-20
updated: 2026-09-20
status: Accepted
tags:
  - decision-log
  - dl
  - security
  - dry_run
related:
  - "[[0003-write-feature-safety-model]]"
  - "[[DL-0006-write-tools-design]]"
---

# DL-0007: dry_run 파라미터 기본값 변경 (false -> true)

## 1. 결정 맥락

ADR-0003과 DL-0006에서 `create_issue`와 `update_issue` 도구에 `dry_run` 파라미터를 추가하기로 결정했습니다.
초기 설계(DL-0006)에서는 `dry_run`의 기본값을 `false`로 설정했습니다.
그러나 `security_code_reviewer`의 리뷰 과정에서, 기본값이 `false`일 경우 LLM이 `dry_run` 파라미터를 명시하지 않으면 사용자 확인 없이 즉시 API 호출(Fail-Open)이 발생하는 보안 취약점이 발견되었습니다.

## 2. 결정 사항

*   모든 쓰기 도구(`create_issue`, `update_issue`)의 `dry_run` 파라미터 기본값을 `false`에서 `true`로 변경합니다.
*   의도하지 않은 데이터 변경(Fail-Open)을 원천 차단하기 위해, 실제 데이터를 변경하려면 LLM이 반드시 명시적으로 `dry_run: false`를 전달해야 합니다.
*   SmartNameResolver를 통한 이름 변환 실패 시 해당 필드를 무시하지 않고 오류를 발생시키도록(Fail-Close) 에러 핸들링을 강화합니다.

## 3. 결정 근거

*   보안의 기본 원칙인 Fail-Safe (Fail-Close) 설계 준수.
*   ADR-0003에서 의도한 "사용자에게 확인 후 실행"하는 워크플로우를 강제.

## 4. 관련 이슈 및 문서

*   [[0003-write-feature-safety-model]]
*   [[DL-0006-write-tools-design]]
