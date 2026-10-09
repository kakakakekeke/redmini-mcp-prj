---
title: "DL-0029: 낡은 에이전트 규칙 정리 및 TDD 프로세스 효율화"
created: 2026-10-09
updated: 2026-10-09
author: Claude Code (Opus 5.5)
tags:
  - DL
  - decision-log
  - tdd
  - coverage
  - documentation
aliases:
  - DL-0029
  - DL-0029-agent-rules-cleanup
status: active
related:
  - "[[DL-0028-agent-rules-hardening]]"
  - "[[0005-test-architecture-revision]]"
  - "[[vibe_tdd_sop]]"
  - "[[git_workflow_sop]]"
---

# DL-0029: 낡은 에이전트 규칙 정리 및 TDD 프로세스 효율화

> [!abstract] 요약
> 2026-10-09 에이전트 규칙 점검 보고서의 4번(낡은 규칙)·5번(TDD 효율) 항목을 처리한다. 가드레일 구멍(1~3번)은 [[DL-0028-agent-rules-hardening]]에서 처리했다.

## 1. 주제 (Topic)
규칙 문서가 실제 코드·관행과 어긋나 에이전트가 규칙을 신뢰하지 않거나 잘못된 방향으로 "교정"할 위험이 있고, TDD 절차는 변경 규모와 무관하게 비용이 일정해 비효율적이었다.

## 2. 결정 사항 (Decision)

### 2.1 낡은 규칙 정리
| 항목 | 이전 | 이후 |
|:--|:--|:--|
| AGENTS.md 4장 도구 수 | "5~7개 핵심 도구" (실제 18개) | 도메인 단위 묶음, 같은 리소스 CRUD는 `action`을 가진 `manage_*`로 통합, 신규 도구 추가 시 DL |
| AGENTS.md 4장 안전 장치 | `confirm_delete` 가드 (미구현) | 모든 쓰기·삭제 도구 `dry_run` 기본 `true` (ADR-0003, DL-0007) |
| 테스트 아키텍처 | ADR-0002 (MSW, `tests/integration`) | [[0005-test-architecture-revision|ADR-0005]]로 대체, `test/utils` → `tests/unit` 통합 |
| frontmatter 규약 | 템플릿부터 필수 7필드 누락, 문서 36개 위반 | 템플릿 3종 보완, 기존 문서 일괄 보완, **pre-commit이 추가·수정된 `document/**/*.md`의 필수 필드 검사** |
| 브랜치 네이밍 | SOP `feature/`·`bugfix/` ↔ 실사용 `feat/`·`fix/`·`chore/` | 커밋 타입과 동일한 `feat/ fix/ docs/ chore/ test/ refactor/`, 자동 생성 브랜치는 `git branch -m`으로 todo 항목명과 일치 |
| 문서 인덱스 검사 | 파일명이 index 본문 어디든 있으면 통과 | 색인표 행(`\| **[[문서명`)으로 등록되어야 통과 |

### 2.2 TDD 효율화
1. **리뷰 등급화** (vibe SOP 3단계): R0 생략(문서·테스트만) / R1 `deep_code_reviewer`(일반 기능) / R2 + `security_code_reviewer`(인증·쓰기 도구·전송 계층·설정·의존성·가드레일). 애매하면 높은 등급.
2. **커버리지 기준선**: `@vitest/coverage-v8@^5.0.1`(devDependency) 도입. `npm test`를 `vitest run --coverage`로 변경하고 `vitest.config.ts`에 기준선(84/83/74/84) 설정 → pre-commit이 커버리지 하락을 차단. 측정 오버헤드 약 0.1초.
3. **테스트 누락 경고**: pre-commit이 `src/**/*.ts` 변경에 테스트 변경이 없으면 `⚠️ [Test Warning]` 출력(차단 아님 — 순수 리팩터링 허용).
4. **DL 작성 조건 축소** (AGENTS.md 6장): 로컬 `.env` 값 변경·버전 업데이트는 대상에서 제외. 새 패키지, 새 환경변수(`.env.example`), 커밋되는 설정 동작 변경만 DL.
5. **테스트 명령 통일**: 단일 파일 `./node_modules/.bin/vitest run <파일>`, 회귀 검증 `npm test`. (`npx vitest run` 표기 제거)

### 2.3 리뷰 반영 (R2: deep + security)
- **커버리지 게이트 보호**: `vitest.config.*`를 commit-msg 코어 파일에 추가(기준선 하향 시 `[Impact-Reviewed]` 필요). `src/*.ts`에 `v8|c8|istanbul ignore` 주석 추가 시 차단. `package.json`·`tsconfig.json`·`vitest.config.*`에 스테이징되지 않은 변경이 있으면 차단(tsc·테스트가 작업 트리 기준으로 돌기 때문).
- **의존성 누락 안내**: 커버리지 provider가 없으면 "테스트 실패" 대신 `npm install` 안내로 차단.
- **frontmatter 파싱**: CRLF·여는 `---` 뒤 공백 허용, 닫는 `---`가 없으면 frontmatter 없음으로 판정, 읽을 수 없는 파일명은 별도 안내.
- **인덱스 검사**: 공백이 든 파일명 처리(누락·삭제 감지 모두), 표 안 이스케이프 별칭(`\|`)의 역슬래시 제거, 접두사 충돌·특수문자 등록 테스트 추가.
- **테스트 경고 정밀화**: `src`의 추가·수정만 대상(삭제·`.d.ts` 제외), `.test.ts`/`.spec.ts` 변경이 있어야 경고 해제.
- **문서**: AGENTS.md 5장 리뷰 규칙을 등급표로, 리뷰어 정의를 ADR-0005·`dry_run` 기준으로 갱신. 서브 브랜치에서 todo.md를 수정하지 않도록 todo.md frontmatter 보완은 메인 세션이 main에서 수행.

## 3. 이유 (Reasoning)
- 규칙이 실제와 다르면 에이전트는 둘 중 하나를 "고친다". 문서를 실제에 맞추는 것이 가장 저렴하고 안전하다.
- frontmatter·인덱스 규약은 문서로만 강제되어 36개 문서가 위반 상태였다. 커밋 시점 검사만이 지속 가능한 강제 수단이다(신규·수정 문서만 검사하므로 마찰이 작다).
- 리뷰어 2개를 모든 변경에 돌리면 문서 오타 수정에도 수 분이 걸린다. 위험 경로에만 보안 리뷰를 집중하는 편이 품질 대비 비용이 낫다.
- 커버리지 래칫은 "TDD를 했는가"를 사후에 수치로 확인하는 유일한 자동 장치다.

## 4. 후속 조치 (Action Items)
- [x] 검증: `test_git_policy.sh` 61건(frontmatter·CRLF·테스트 경고·커버리지 차단·무시 주석·미스테이징 설정·provider 누락 포함), `test_hook_suite.sh` 22건(본문 언급·특수문자·접두사 충돌·공백 파일명 포함)
- [x] **병합 절차** (메인 세션): ① main에서 `npm install --no-save @vitest/coverage-v8@5.0.1` (병합 커밋의 `npm test`가 새 설정으로 실행되므로 선설치 필요) ② main에서 `document/todo.md` frontmatter 보완 커밋 ③ 병합 ④ `npm install`로 lock 동기화
- [ ] 커버리지가 오르면 기준선 상향 (래칫) — 각 기능 작업의 5단계에서 수행
- [ ] **E2E 고정 포트(33333)·고정 대기(2초)**: 연속·동시 `npm test`에서 간헐 실패(샌드박스 연속 커밋에서 관측). pre-commit·병합이 모두 `npm test`에 의존하게 되었으므로 후속 작업으로 처리 필요 (`PORT=0` + `/health` 폴링)
- [ ] 커버리지 기준선 여유가 작다(Functions 113/151 → 미테스트 함수 2개 추가 시 미달). 의도적으로 낮출 때는 DL로 남긴다.
- [ ] (범위 밖) `[Impact-Reviewed]` 태그가 형식적 절차가 된 문제 — 자기 신고 태그 대신 R2 리뷰 수행 여부와 연동하는 방안 검토
