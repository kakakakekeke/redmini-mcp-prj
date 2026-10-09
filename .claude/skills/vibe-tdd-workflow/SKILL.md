---
name: vibe-tdd-workflow
description: Redmine MCP 프로젝트에서 Vibe Coding TDD 방법론으로 기능을 구현하는 절차. 기능 구현·버그 수정·TDD 사이클을 시작할 때, 또는 사용자가 TDD로 구현을 요청할 때 사용한다.
---

# Vibe Coding TDD Workflow (Claude Code)

## 1. SOP 열람
구현을 시작하기 전에 반드시 `document/sop/vibe_tdd_sop.md`를 `Read`로 열람하고 절차를 따른다.
SOP의 Antigravity 도구명은 `CLAUDE.md`의 대응표로 읽는다.

## 2. 작업 위치
- main 저장소에서는 코드 수정이 훅으로 차단된다. 코드 작업은 워크트리(`.worktrees/<name>`)에서 한다.
- 메인 세션이라면 `Agent` 도구에 `isolation: "worktree"`를 지정해 구현을 위임한다.
- 워크트리에 `node_modules`가 없으면 `npm install`을 실행한다. 테스트는 다운로드 프롬프트를 피하기 위해 `./node_modules/.bin/vitest`를 직접 호출한다.

## 3. 사이클
1. **Red**: 요구사항·입력 검증·예외 상황을 커버하는 테스트 작성 → `./node_modules/.bin/vitest run <파일>` 이 의도대로 실패하는지 확인.
2. **Green**: 테스트를 통과시키는 최소 구현. Edit 직후 typecheck 훅이 타입 에러를 알려주면 즉시 수정.
3. **Review**: `deep-code-reviewer`와 `security-code-reviewer` 서브에이전트를 한 메시지에서 병렬 호출. 변경 파일 경로와 작업 목표를 넘긴다.
4. **Remediation**: 리뷰 지적 사항은 새 요구사항으로 취급 — 테스트를 먼저 추가한 뒤 수정 (1단계로 회귀).
5. **Regression**: `./node_modules/.bin/vitest run` 전체 스위트 통과 확인.
6. **Queue**: 서브에이전트(워크트리)는 `document/todo.md`를 수정하지 않고 최종 보고에 결과를 담는다. 메인 세션이 병합 직후 main에서 `[x]` 처리한다.
7. **Decision Log**: 패키지 추가·설정 변경 → DL, 구조 변경 → ADR. 작성 시 `document/index.md` 동기화.

## 4. 중단 조건
리뷰어와 의견 충돌이 계속되거나 테스트 통과가 3회 이상 실패하면 작업을 멈추고 사용자에게 보고한다.
