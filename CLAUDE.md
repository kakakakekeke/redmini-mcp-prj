# CLAUDE.md

이 프로젝트의 공통 작업 지침은 `AGENTS.md`에 있습니다. 아래 import로 함께 로드됩니다.

@AGENTS.md

---

## Claude Code 전용 대응표 (Antigravity → Claude Code)

`AGENTS.md`와 `document/sop/*.md`는 Antigravity 도구 이름으로 작성되어 있습니다. Claude Code에서는 다음과 같이 읽으십시오.

| 문서상 표현 (Antigravity) | Claude Code에서의 의미 |
|:---|:---|
| `view_file` | `Read` |
| `write_to_file`, `replace_file_content` | `Write`, `Edit`, `MultiEdit` |
| `invoke_subagent(Workspace: "share" \| "branch")` | `Agent` 도구 + `isolation: "worktree"` |
| `send_message` (서브에이전트 → 메인 보고) | 서브에이전트의 최종 응답(결과 반환) |
| `schedule` (Liveness Timer) | 불필요 — 백그라운드 서브에이전트는 완료 시 자동 통지됨 |
| `security_code_reviewer` 서브에이전트 | `.claude/agents/security-code-reviewer.md` |
| `deep_code_reviewer` 서브에이전트 | `.claude/agents/deep-code-reviewer.md` |
| `.agents/hooks.json` | `.claude/settings.json` (`hooks`) |
| `.agents/skills/*` | `.claude/skills/*` |
| `.agents/typecheck.log` | `.claude/typecheck.log` (타입 에러는 Edit 직후 컨텍스트로도 전달됨) |

## Claude Code 가드레일 (`.claude/settings.json`)

`AGENTS.md`의 가드레일은 Claude Code 훅으로 동일하게 강제됩니다. 어댑터 스크립트는 `.claude/hooks/`에 있으며, 판정 로직은 `.agents/scripts/`와 같은 규칙을 따릅니다.

| 훅 | 이벤트 | 동작 |
|:---|:---|:---|
| `enforce_worktree.sh` | PreToolUse (`Edit\|Write\|MultiEdit\|NotebookEdit`) | `.`/`..` 경로·`.git/`·심볼릭 링크 편집 거부, main 저장소에서 `.agents/main_allowlist`(pre-commit과 공유하는 단일 기준) 외 파일 수정 차단 |
| `enforce_subagent_isolation.sh` | PreToolUse (`Agent\|Task`) | main 저장소에서 쓰기 가능한 서브에이전트를 `isolation: "worktree"`(또는 `"remote"`) 없이 호출하면 차단 (읽기 전용 `Explore`, `Plan`, `claude-code-guide`, 리뷰어 에이전트는 예외) |
| `guard_bash.sh` | PreToolUse (`Bash`) | `--no-verify`·`HUSKY=0`·`core.hooksPath` 변경·병합 플래그 위조 차단, main 체크아웃에서 `cherry-pick`/`revert`/`am` 차단 |
| `typecheck.sh` | PostToolUse (`Edit\|Write\|MultiEdit`) | `.ts` 파일 수정 시 `tsc --noEmit` 실행, 에러를 컨텍스트로 전달 |
| `enforce_document_index.sh` | Stop / SubagentStop | `document/` 와 `document/index.md` 불일치 시 종료 차단 |
| `worktree_create.sh` / `worktree_remove.sh` | WorktreeCreate / WorktreeRemove | 서브에이전트 워크트리를 기본 위치 대신 `.worktrees/<name>`에 생성, 미커밋 변경·미병합 브랜치는 보존 |

> [!note] `Bash`를 통한 파일 쓰기(`sed -i`, 리다이렉션 등)는 편집 가드가 검사하지 않습니다. main 저장소에서는 셸로도 코드 파일을 수정하지 마십시오(최종 방어선은 `.husky/pre-commit`).

> [!important] 훅이 워크트리에서도 동작하려면 `core.hooksPath`가 메인 저장소 `.husky/_`의 절대 경로여야 합니다. 새로 clone 했거나 의심되면 메인 저장소에서 `npm run prepare`를 실행하십시오 (WorktreeCreate 훅도 자동 복구합니다).

## 작업 방식 요약

1. **코드 수정은 워크트리에서**: 메인 세션은 문서·대기열만 다룹니다. 코드는 `Agent`(`isolation: "worktree"`)로 위임하거나, 사용자가 원하면 `EnterWorktree`로 세션 자체를 워크트리로 옮겨 작업합니다.
2. **TDD**: `vibe-tdd-workflow` 스킬 → `document/sop/vibe_tdd_sop.md`. 단일 파일은 `./node_modules/.bin/vitest run <파일>`, 회귀 검증은 `npm test`(커버리지 기준선 포함).
3. **리뷰**: SOP 3단계 등급표(R0 생략 / R1 `deep-code-reviewer` / R2 + `security-code-reviewer`)에 따라 호출합니다.
4. **커밋**: `git-workflow` 스킬 참고. `--no-verify` 금지. 코어 파일(`package.json`, `tsconfig.json`, `vitest.config.*`, `document/index.md`, `src/index.ts`, `.agents/`, `AGENTS.md`, `.husky/`, `.claude/`, `CLAUDE.md`, `.mcp.json`) 변경 시 커밋 본문에 `[Impact-Reviewed]` 포함.
5. **todo.md는 메인 세션 전담**: 항목 추가·순서 변경은 사용자 승인 후 커밋. 완료(`[x]`) 처리는 병합 직후 main에서 수행. 서브에이전트는 todo.md를 수정하지 않습니다.
