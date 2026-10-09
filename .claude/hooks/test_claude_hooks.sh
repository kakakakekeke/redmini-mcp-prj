#!/bin/bash
# Claude Code 훅 어댑터 검증 스위트. 메인 저장소/워크트리 어디서 실행해도 동작한다.
HOOKS="$(cd "$(dirname "$0")" && pwd -P)"
HERE=$(git -C "$HOOKS" rev-parse --show-toplevel)
MAIN=$(cd "$HERE" && cd "$(git rev-parse --git-common-dir)/.." && pwd -P)
export CLAUDE_PROJECT_DIR="$MAIN"
PASS=0; FAIL=0

check() { # 설명, 기대("deny"|"allow"|"block"|"silent"), 실제 출력
  local got
  case "$3" in
    *'"permissionDecision": "deny"'* | *'"permissionDecision":"deny"'*) got=deny ;;
    *'"decision": "block"'* | *'"decision":"block"'*) got=block ;;
    *rc=2) got=deny2 ;;
    "") got=silent ;;
    *) got=other ;;
  esac
  [ "$2" = allow ] && [ "$got" = silent ] && got=allow
  if [ "$got" = "$2" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1 (expected $2, got $got: $3)"; fi
}
edit_nojq() { echo "{\"tool_input\":{\"file_path\":\"$1\"}}" | PATH=/nonexistent /bin/bash "$HOOKS/enforce_worktree.sh" 2>&1; echo "rc=$?"; }
edit() { jq -n --arg f "$1" '{tool_name:"Edit",tool_input:{file_path:$f}}' | "$HOOKS/enforce_worktree.sh"; }
agent() { jq -n --arg c "$1" --arg t "$2" --arg i "$3" '{cwd:$c,tool_name:"Agent",tool_input:({subagent_type:$t,prompt:"x"} + (if $i=="" then {} else {isolation:$i} end))}' | "$HOOKS/enforce_subagent_isolation.sh"; }

echo "📂 enforce_worktree.sh"
check "main: src 코드 수정 차단"            deny  "$(edit "$MAIN/src/index.ts")"
check "main: 신규 하위 디렉터리 파일 차단"   deny  "$(edit "$MAIN/src/new_dir/x.ts")"
check "main: CLAUDE.md 차단"               deny  "$(edit "$MAIN/CLAUDE.md")"
check "main: document/todo.md 허용"        allow "$(edit "$MAIN/document/todo.md")"
check "main: document/index.md 허용"       allow "$(edit "$MAIN/document/index.md")"
check "main: decision_log 허용"            allow "$(edit "$MAIN/document/decision_log/DL-9999-x.md")"
check "main: adr 허용"                     allow "$(edit "$MAIN/document/adr/9999-x.md")"
check "main: .env 허용"                    allow "$(edit "$MAIN/.env")"
check "main: 경로 조작(../) 우회 차단"      deny  "$(edit "$MAIN/document/adr/../../src/index.ts")"
check "프로젝트 외부 경로 허용"             allow "$(edit "/tmp/outside.md")"
check "file_path 없음 허용"                 allow "$(echo '{"tool_input":{}}' | "$HOOKS/enforce_worktree.sh")"
if [ "$HERE" != "$MAIN" ]; then
  check "worktree: src 코드 수정 허용"     allow "$(edit "$HERE/src/index.ts")"
fi
check "main: 없는 디렉터리 경유 ../ 우회 차단" deny "$(edit "$MAIN/document/adr/nope/../../../src/index.ts")"
check "worktree 경유 ../ 로 main 탈출 차단" deny  "$(edit "$HERE/nope/../../../src/index.ts")"
check "main: .git/config 수정 차단"         deny  "$(edit "$MAIN/.git/config")"
check "main: .git/hooks 수정 차단"          deny  "$(edit "$MAIN/.git/hooks/pre-commit")"
ln -s ../../src/index.ts "$MAIN/document/adr/__probe_link.md"
check "main: 화이트리스트 내 심볼릭 링크 차단" deny "$(edit "$MAIN/document/adr/__probe_link.md")"
rm -f "$MAIN/document/adr/__probe_link.md"
check "깨진 JSON 입력은 차단(fail-closed)"   deny2 "$(echo 'not json' | "$HOOKS/enforce_worktree.sh" 2>&1; echo "rc=$?")"
check "jq 부재 시 차단(fail-closed)"         deny2 "$(edit_nojq "$MAIN/src/index.ts")"
check "NotebookEdit notebook_path 검사"     deny  "$(jq -n --arg f "$MAIN/x.ipynb" '{tool_input:{notebook_path:$f}}' | "$HOOKS/enforce_worktree.sh")"

echo "📂 enforce_subagent_isolation.sh"
check "main: general-purpose 격리 없음 차단"   deny  "$(agent "$MAIN" general-purpose "")"
check "main: subagent_type 생략 차단"          deny  "$(jq -n --arg c "$MAIN" '{cwd:$c,tool_input:{prompt:"x"}}' | "$HOOKS/enforce_subagent_isolation.sh")"
check "main: isolation worktree 허용"          allow "$(agent "$MAIN" general-purpose worktree)"
check "main: Explore 읽기 전용 허용"           allow "$(agent "$MAIN" Explore "")"
check "main: isolation remote 허용"            allow "$(agent "$MAIN" general-purpose remote)"
check "Agent 깨진 JSON 입력은 차단"            deny2 "$(echo 'oops' | "$HOOKS/enforce_subagent_isolation.sh" 2>&1; echo "rc=$?")"
check "main: security-code-reviewer 허용"     allow "$(agent "$MAIN" security-code-reviewer "")"
if [ "$HERE" != "$MAIN" ]; then
  check "worktree 세션: 격리 없이 허용"        allow "$(agent "$HERE" general-purpose "")"
fi

echo "📂 enforce_document_index.sh"
check "정상 상태 통과"            allow "$(jq -n --arg c "$HERE" '{cwd:$c,hook_event_name:"Stop"}' | "$HOOKS/enforce_document_index.sh")"
touch "$HERE/document/test_unindexed_claude.md"
check "미등록 문서 존재 시 차단"   block "$(jq -n --arg c "$HERE" '{cwd:$c,hook_event_name:"Stop"}' | "$HOOKS/enforce_document_index.sh")"
check "stop_hook_active 시 통과"   allow "$(jq -n --arg c "$HERE" '{cwd:$c,stop_hook_active:true}' | "$HOOKS/enforce_document_index.sh")"
rm -f "$HERE/document/test_unindexed_claude.md"

echo "📂 typecheck.sh"
check ".md 파일은 검사 생략"       allow "$(jq -n --arg f "$HERE/README.md" '{tool_input:{file_path:$f}}' | "$HOOKS/typecheck.sh")"
check "정상 .ts 는 출력 없음"       allow "$(jq -n --arg f "$HERE/src/index.ts" '{tool_input:{file_path:$f}}' | "$HOOKS/typecheck.sh")"
bad="$HERE/src/__typecheck_probe.ts"; echo 'const x: number = "str"; export {x};' > "$bad"
out=$(jq -n --arg f "$bad" '{tool_input:{file_path:$f}}' | "$HOOKS/typecheck.sh"); rm -f "$bad"
if echo "$out" | grep -q 'additionalContext' && echo "$out" | grep -q 'TS2322'; then PASS=$((PASS+1)); echo "  ✅ 타입 에러를 additionalContext로 전달"; else FAIL=$((FAIL+1)); echo "  ❌ 타입 에러 전달 실패: $out"; fi

echo "📂 worktree_create.sh / worktree_remove.sh"
name="hooktest-$$"
path=$(jq -n --arg n "$name" '{name:$n}' | "$HOOKS/worktree_create.sh" 2>/dev/null | tail -n 1)
if [ "$path" = "$MAIN/.worktrees/$name" ] && [ -d "$path" ] && [ "$(git -C "$path" symbolic-ref --short HEAD)" = "worktree-$name" ] && [ -L "$path/node_modules" ]; then
  PASS=$((PASS+1)); echo "  ✅ .worktrees/<name> 에 worktree-<name> 브랜치로 생성"
else FAIL=$((FAIL+1)); echo "  ❌ 생성 실패: $path"; fi
for n in '../escape' '-x' 'a..b' ''; do
  bad=$(jq -n --arg n "$n" '{name:$n}' | "$HOOKS/worktree_create.sh" 2>/dev/null); rc=$?
  if [ $rc -ne 0 ] && [ -z "$bad" ]; then PASS=$((PASS+1)); echo "  ✅ 잘못된 이름 거부: '$n'"; else FAIL=$((FAIL+1)); echo "  ❌ 잘못된 이름 허용됨: '$n'"; git -C "$MAIN" worktree remove --force "$bad" 2>/dev/null; fi
done
if [ "$(git -C "$path" rev-parse HEAD)" = "$(git -C "$MAIN" rev-parse HEAD)" ]; then PASS=$((PASS+1)); echo "  ✅ 메인 체크아웃 HEAD 기준으로 분기"; else FAIL=$((FAIL+1)); echo "  ❌ HEAD 기준 분기 아님"; fi
if git -C "$path" status --porcelain | grep -q node_modules; then FAIL=$((FAIL+1)); echo "  ❌ node_modules 심볼릭 링크가 untracked 로 노출"; else PASS=$((PASS+1)); echo "  ✅ node_modules 심볼릭 링크 무시됨"; fi
jq -n --arg p "$path" '{worktree_path:$p}' | "$HOOKS/worktree_remove.sh" 2>/dev/null
if [ ! -d "$path" ] && ! git -C "$MAIN" show-ref --quiet "refs/heads/worktree-$name"; then
  PASS=$((PASS+1)); echo "  ✅ 병합된(빈) 브랜치와 워크트리 정리"
else FAIL=$((FAIL+1)); echo "  ❌ 정리 실패"; fi
path=$(jq -n --arg n "$name-b" '{name:$n}' | "$HOOKS/worktree_create.sh" 2>/dev/null | tail -n 1)
# 미병합 상태를 만들기 위한 픽스처 커밋 (git commit 대신 plumbing 사용 — 훅 우회 아님)
probe=$(git -C "$path" commit-tree "HEAD^{tree}" -p HEAD -m "test(hook): probe")
git -C "$path" update-ref "refs/heads/worktree-$name-b" "$probe"
jq -n --arg p "$path" '{worktree_path:$p}' | "$HOOKS/worktree_remove.sh" 2>/dev/null
if [ ! -d "$path" ] && git -C "$MAIN" show-ref --quiet "refs/heads/worktree-$name-b"; then
  PASS=$((PASS+1)); echo "  ✅ 미병합 브랜치는 보존"
else FAIL=$((FAIL+1)); echo "  ❌ 미병합 브랜치 보존 실패"; fi
git -C "$MAIN" branch -D "worktree-$name-b" >/dev/null 2>&1
path=$(jq -n --arg n "$name-c" '{name:$n}' | "$HOOKS/worktree_create.sh" 2>/dev/null | tail -n 1)
echo wip > "$path/uncommitted.txt"
jq -n --arg p "$path" '{worktree_path:$p}' | "$HOOKS/worktree_remove.sh" 2>/dev/null; rc=$?
if [ $rc -ne 0 ] && [ -f "$path/uncommitted.txt" ]; then PASS=$((PASS+1)); echo "  ✅ 미커밋 변경이 있는 워크트리는 보존"; else FAIL=$((FAIL+1)); echo "  ❌ 미커밋 변경 삭제됨"; fi
git -C "$MAIN" worktree remove --force "$path" 2>/dev/null; git -C "$MAIN" branch -D "worktree-$name-c" >/dev/null 2>&1

echo; echo "결과: $PASS 성공 / $FAIL 실패"
[ $FAIL -eq 0 ]
