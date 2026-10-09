---
title: "DL-0030: 가드레일 다듬기 — commit-msg Broken pipe 제거, Bash 가드 오탐 축소, shellcheck 도입"
created: 2026-10-09
updated: 2026-10-09
author: Claude Code (Opus 5.5)
tags:
  - DL
  - decision-log
  - guardrail
  - husky
  - shellcheck
aliases:
  - DL-0030
  - DL-0030-guardrail-polish
status: active
related:
  - "[[DL-0028-agent-rules-hardening]]"
  - "[[DL-0029-agent-rules-cleanup]]"
  - "[[git_workflow_sop]]"
  - "[[index]]"
---

# DL-0030: 가드레일 다듬기 — commit-msg Broken pipe 제거, Bash 가드 오탐 축소, shellcheck 도입

> **안내 (ADR과의 구분 규칙)**: 
> 아키텍처, 인프라, 보안 모델 등 시스템 전반에 큰 영향을 미치는 사항은 **ADR**로 작성하십시오. 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

> [!abstract] 요약
> [[DL-0028-agent-rules-hardening]]·[[DL-0029-agent-rules-cleanup]]로 강화한 가드레일 계층의 운영 마찰 3건을 정리한다. 잡음(Broken pipe)을 없애고, Bash 가드의 hooksPath 판정을 "키 언급"에서 "설정 쓰기"로 바꾸며(오탐 축소 + 숨긴 쓰기 형태는 fail-closed로 오히려 확대), 셸 스크립트 자체의 정적 분석을 추가한다.

## 1. 주제 (Topic)
| # | 문제 | 영향 |
|:--|:--|:--|
| 1 | `.husky/commit-msg`의 코어 파일 판정이 `while … echo 1 … \| head -n 1` 구조 | `head`가 먼저 종료되면 이후 `echo`가 SIGPIPE를 받아 큰 커밋·병합에서 `echo: write error: Broken pipe` 출력 (판정은 정상이지만 에러처럼 보임) |
| 2 | `.claude/hooks/guard_bash.sh`가 명령 문자열에 hooksPath 키가 **있기만 하면** 차단 (`--get/--list` 예외) | 값 없는 조회(`git config <key>`), heredoc·python 문자열·커밋 메시지 속 언급까지 차단 — 문서 작업·조사 명령 오탐 |
| 3 | 가드레일이 셸 스크립트인데 정적 분석이 없음 | 미사용 변수, 따옴표 누락, `source` 대상 미추적 등 잠재 결함이 리뷰에만 의존 |

## 2. 결정 사항 (Decision)

### 2.1 commit-msg Broken pipe
- 파이프·명령 치환을 없애고 현재 셸에서 heredoc(`done <<EOF $CHANGED EOF`)으로 읽어 첫 일치에서 `break 2`. 판정·`--no-renames`·`core.quotePath=false` 처리는 그대로. (1차안 `exit 0`은 리뷰에서 목록이 64KB를 넘으면 이번엔 `printf`가 같은 메시지를 낸다는 지적을 받아 교체)
- 증상은 **SIGPIPE가 무시되는 환경**(일부 IDE·에이전트 셸)에서만 재현되므로, 회귀 테스트는 `trap '' PIPE` + 64KB 이상의 경로 목록으로 재현한다.
- `("$core"*)` 여는 괄호 형식은 macOS `/bin/sh`(bash 3.2) 호환을 위해 유지한다.
- 같은 이유로 pre-commit의 큰 목록 대상 `printf … | grep -q`(병합 파일 목록, 스테이징 목록)는 `grep … >/dev/null`로 끝까지 읽게, `| head -40`은 `sed -n '1,40…p'`로 바꾼다.
- `.shellcheckrc`는 shellcheck 판정을 바꿀 수 있으므로(`disable=all`) commit-msg 코어 파일에 추가한다 (`[Impact-Reviewed]` 필요).

### 2.2 Bash 가드: hooksPath "쓰기"만 차단
`hooks_path_write` 판정 순서:
1. **위치 무관 차단** (따옴표·역슬래시 제거 사본 기준): `git -c <key>=…`, `--config-env=<key>=…`, `GIT_CONFIG_KEY_n=<key>`, `GIT_CONFIG_PARAMETERS`, 키를 변수에 담고 `config`를 쓰는 명령(`K=<key>; git config "$K" …`).
2. 명령을 셸 구분자(`; & | ( ) { } \`` 개행) 단위로 나누고 리다이렉션을 제거한 뒤, **어디에든** `git [전역옵션] config …`가 있는 세그먼트를 **fail-closed**로 판정한다. 앞에 `if`·`!`·`eval`·`timeout`·`nice`·`do` 등 무엇이 와도, `"git"`·`\git`·`/usr/bin/git`·`-C "/a b"`도 검사 대상.
3. **산문 예외**: 원본에서 `git` 앞에 따옴표가 열려 있고(홀수 개) 따옴표 바로 뒤가 아니면 산문으로 본다 (`-m "explain git config …"`, `echo "never run git config …"`). 따옴표 직후의 git(`sh -c 'git config …'`, `eval "git config …"`)은 명령으로 본다.

| 차단 | 허용 |
|:--|:--|
| 키 뒤에 무엇이든 있음 — 값, `=…`, 주석(`# list`), 값이 `get`/`list`인 경우 포함 | 키 뒤에 아무것도 없음: `git config <key>` |
| 키 앞에 `--unset`/`--unset-all`/`unset` | 키 **앞**에 `--get*`/`--list`/`-l`/`get`/`list` (뒤의 값 패턴 허용) |
| 키 자리에 `$var`·`$(…)`가 있고 명령 어딘가에 키가 있음 | 조회 결과 파이프·리다이렉션 (`… \| cat`, `2>/dev/null`) |
| `xargs git config <key>`, `config --remove-section/--rename-section core` | heredoc 본문, python·echo 문자열, 커밋 메시지 속 키 언급 |

`--no-verify`, `HUSKY=0`, `PRE_MERGE_COMMIT=`, main 체크아웃의 `cherry-pick/revert/am` 차단은 변경 없음.

> [!warning] 이 가드가 hooksPath 의 유일한 방어선
> hooksPath 가 바뀌면 git 훅 자체가 실행되지 않으므로 "최종 방어선은 git 훅"이 성립하지 않는다. 그래서 숨긴 쓰기 형태는 fail-closed 로 차단하고, 남는 오탐은 따옴표 직후에 `git config <key> 값`으로 시작하는 산문(예: `-m "git config core.hooksPath x"`) 정도로 한정했다. `.git/config` 직접 편집·`include.path`·`GIT_CONFIG_GLOBAL` 같은 우회는 이전에도 다루지 않았으며 범위 밖이다(후속 조치).

### 2.3 shellcheck 도입 (워크플로우 신규 도구)
- **도구**: `shellcheck` (≥ 0.10, 개발 머신 0.11.0). npm 의존성이 아니라 시스템 도구(`brew install shellcheck` / `apt install shellcheck`).
- **설정**: 저장소 루트 `.shellcheckrc` — `source-path=SCRIPTDIR`, `external-sources=true`. 각 스크립트의 `. lib.sh`·`. main_allowlist.sh`에 `# shellcheck source=…` 지시자를 달아 source 대상까지 분석한다. 방언은 shebang(`#!/bin/sh` → POSIX sh, `#!/bin/bash` → bash)으로 결정.
- **pre-commit 1-2단계**: 추가·수정된 `*.sh`와 `.husky/` 파일(`.husky/_` 제외, shebang 없는 README 등 제외)이 있으면 **스테이징된 내용**을 임시 디렉터리에 꺼내(`git checkout-index`, source 대상 추적용으로 추적 중인 모든 `*.sh`·`.shellcheckrc` 포함) `shellcheck -x -f gcc`로 검사. 지적이 하나라도 있으면(기본 심각도 = style 이상) 차단. 출력이 비어야 통과하는 fail-closed 구조이며, 임시 디렉터리는 EXIT 트랩으로 정리한다.
- **미설치 환경**: `⚠️ [ShellCheck Warning]`만 출력하고 계속 (CI·Docker·다른 개발자 환경 고려).
- **억제 규칙**: 의도된 경우에만 `# shellcheck disable=SCxxxx # 이유` 형식으로 대상 범위를 좁혀 사용.

#### 기존 스크립트 정리 결과
| 파일 | 지적 | 조치 |
|:--|:--|:--|
| `.husky/pre-commit`, `.agents/scripts/enforce_worktree.sh`, `.claude/hooks/enforce_worktree.sh` | SC2034 `MAIN_ALLOWLIST_FILE` 미사용, SC1091 source 미추적 | `# shellcheck source=` 지시자 (실제로는 main_allowlist.sh가 사용) |
| `.claude/hooks/*.sh` (4개) | SC2154 `input` 미할당, SC1091 | `# shellcheck source=lib.sh` |
| `.husky/commit-msg` | SC2086 따옴표 누락 | `"$HAS_CORE_MODIFICATION"` |
| `.husky/pre-commit` | SC2016 백틱 리터럴 | disable (grep 패턴의 리터럴 백틱) |
| `.agents/scripts/typecheck.sh` | SC2034 `EXIT_CODE` 미사용 | 대입 제거 (출력 동작 동일) |
| `.agents/scripts/test_git_policy.sh` | SC2115, SC2164, SC2015×n, SC2016×n | `${R:?}`, `cd … \|\| exit 1`; SC2015(`ok`는 항상 0)·SC2016(픽스처 리터럴)은 파일 단위 disable |
| `.claude/hooks/test_claude_hooks.sh` (신규 케이스) | SC2016 | 해당 루프만 disable (가드에 넘기는 `$K` 리터럴) |

### 2.4 리뷰 반영 (R2: deep + security)
- Bash 가드 1차안(세그먼트가 `git`으로 시작할 때만 검사, 조회 단어를 세그먼트 전체에서 탐색)은 `if/!/eval/timeout` 선행, 값이 `get`/`list`, `# --get` 주석, 따옴표·역슬래시·변수로 숨긴 키 등 **이전 가드가 막던 쓰기**를 통과시켰다 → 2.2의 fail-closed 판정으로 교체, 해당 형태 전부를 차단 테스트로 추가.
- commit-msg `exit 0` 안의 잔여 `printf` Broken pipe → heredoc 루프, 테스트를 SIGPIPE 무시 + 64KB 이상으로 강화(구 코드에서 실패 확인).
- shellcheck 미설치 테스트가 Linux(`/usr/bin/shellcheck`)에서 깨지는 문제 → PATH 의 실행 파일을 shellcheck 만 빼고 링크한 디렉터리로 실행.
- `.husky/` 비셸 파일 오탐, `cd` 실패 시 fail-open, `mktemp` 실패 무메시지, 임시 디렉터리 미정리, staged `.shellcheckrc` 신뢰 → 각각 수정 (2.1, 2.3).

## 3. 이유 (Reasoning)
- 에러처럼 보이는 잡음은 에이전트가 "훅이 깨졌다"고 오판해 우회를 시도하게 만든다. 판정과 무관한 잡음은 없애야 한다.
- 가드의 오탐은 정당한 조회·문서 작업을 막아 에이전트가 우회 표현을 찾게 만든다. 실제 위험(설정 쓰기)만 정밀하게 막는 편이 가드레일 신뢰도를 높인다.
- 가드레일 스크립트는 보안 경계이므로 TS 코드처럼 커밋 시점 정적 분석을 받아야 한다. 시스템 도구라 강제 설치는 하지 않고, 있는 환경에서만 차단한다.

## 4. 후속 조치 (Action Items)
- [x] `.husky/commit-msg` 루프 수정 + `test_git_policy.sh` Broken pipe 회귀 테스트
- [x] `guard_bash.sh` 쓰기 판정 함수(`hooks_path_write`) + `test_claude_hooks.sh` 허용/차단 케이스
- [x] `.shellcheckrc`, pre-commit 1-2단계, 기존 스크립트 경고 0건, `test_git_policy.sh` shellcheck 케이스
- [ ] CI 도입 시 shellcheck 설치 단계 추가 (미설치 시 경고만 나오므로)
- [ ] (범위 밖, 기존부터 미차단) `.git/config` 직접 편집·리다이렉션, `git config --edit`, `include.path`/`includeIf`, `GIT_CONFIG_GLOBAL=` 로 hooksPath 를 바꾸는 우회 검토
- [ ] 탭·개행·`"`·`\` 가 든 셸 파일명은 git 이 C-quote 하므로 shellcheck 단계에서 "파일 없음"으로 차단됨(fail-closed). 필요 시 `-z` 처리
