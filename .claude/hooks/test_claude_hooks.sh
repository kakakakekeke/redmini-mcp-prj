#!/bin/bash
# Claude Code 훅 어댑터 검증 스위트.
# 실제 저장소를 건드리지 않도록 임시 복제 저장소(MAIN)와 그 워크트리(HERE)에서 실행한다.
HOOKS="$(cd "$(dirname "$0")" && pwd -P)"
SRC=$(git -C "$HOOKS" rev-parse --show-toplevel)
REAL_MAIN=$(cd "$SRC" && cd "$(git rev-parse --git-common-dir)/.." && pwd -P)
SANDBOX=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$SANDBOX"' EXIT
MAIN="$SANDBOX/repo"
git clone -q "$REAL_MAIN" "$MAIN"
git -C "$MAIN" config user.email t@t; git -C "$MAIN" config user.name t
rm -rf "$MAIN/.agents"; cp -R "$SRC/.agents" "$MAIN/.agents"   # 실행 중인 트리의 정책 파일 적용
ln -s "$REAL_MAIN/node_modules" "$MAIN/node_modules"
git -C "$MAIN" worktree add -q "$MAIN/.worktrees/self" -b test-self
HERE="$MAIN/.worktrees/self"
rm -rf "$HERE/.agents"; cp -R "$SRC/.agents" "$HERE/.agents"
ln -s "$REAL_MAIN/node_modules" "$HERE/node_modules"
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
check "main: document/sop 허용 (허용 경로 단일화)"  allow "$(edit "$MAIN/document/sop/vibe_tdd_sop.md")"
check "main: document/templates 허용"         allow "$(edit "$MAIN/document/templates/x.md")"
check "main: .husky 차단"                     deny  "$(edit "$MAIN/.husky/pre-commit")"
check "main: .agents 정책 파일 차단"           deny  "$(edit "$MAIN/.agents/main_allowlist")"
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
check "환경변수 MAIN_ALLOWLIST_FILE 로 정책 교체 불가" deny "$(echo '*' > "$SANDBOX/all"; jq -n --arg f "$MAIN/src/index.ts" '{tool_input:{file_path:$f}}' | MAIN_ALLOWLIST_FILE="$SANDBOX/all" "$HOOKS/enforce_worktree.sh")"
mv "$MAIN/.agents/main_allowlist" "$SANDBOX/al.bak"
check "정책 파일 없으면 차단 (fail-closed)"   deny  "$(edit "$MAIN/document/todo.md")"
mv "$SANDBOX/al.bak" "$MAIN/.agents/main_allowlist"
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

echo "📂 guard_bash.sh"
bash_cmd() { jq -n --arg c "$1" --arg d "$2" '{cwd:$d,tool_name:"Bash",tool_input:{command:$c}}' | "$HOOKS/guard_bash.sh"; }
check "--no-verify 차단"                      deny  "$(bash_cmd 'git commit --no-verify -m x' "$HERE")"
check "HUSKY=0 차단"                          deny  "$(bash_cmd 'HUSKY=0 git commit -m x' "$HERE")"
check "core.hooksPath 변경 차단"              deny  "$(bash_cmd 'git -c core.hooksPath=/dev/null commit -m x' "$HERE")"
check "git config core.hooksPath 설정 차단"   deny  "$(bash_cmd 'git config core.hooksPath /tmp' "$HERE")"
check "PRE_MERGE_COMMIT 위조 차단"            deny  "$(bash_cmd 'PRE_MERGE_COMMIT=1 git commit -m x' "$HERE")"
check "main: cherry-pick 차단"               deny  "$(bash_cmd 'git cherry-pick abc123' "$MAIN")"
check "main: revert 차단"                    deny  "$(bash_cmd 'cd x && git revert HEAD' "$MAIN")"
check "main: git -C 로 main 지정 cherry-pick 차단" deny "$(bash_cmd "git -C $MAIN cherry-pick abc" "$HERE")"
check "worktree: cherry-pick 허용"           allow "$(bash_cmd 'git cherry-pick abc123' "$HERE")"
check "main: 일반 git 명령 허용"              allow "$(bash_cmd 'git status && git log --oneline -3' "$MAIN")"
check "main: merge 허용"                     allow "$(bash_cmd 'git merge --no-ff feat/x' "$MAIN")"
check "core.hooksPath 조회는 허용"            allow "$(bash_cmd 'git config --get core.hooksPath' "$MAIN")"
check "core.hooksPath 값 없는 조회 허용"      allow "$(bash_cmd 'git config core.hooksPath' "$MAIN")"
check "core.hooksPath 조회 후 파이프 허용"    allow "$(bash_cmd 'git -C /x config core.hooksPath | cat' "$MAIN")"
check "core.hooksPath 조회 후 && 허용"       allow "$(bash_cmd 'git config core.hooksPath && echo ok' "$MAIN")"
check "heredoc 본문의 core.hooksPath 허용"    allow "$(bash_cmd "cat > f.txt <<'EOF'
Set core.hooksPath to an absolute path via npm run prepare
EOF" "$HERE")"
check "python 문자열의 core.hooksPath 허용"   allow "$(bash_cmd "python3 -c 'print(\"core.hooksPath is set\")'" "$HERE")"
check "커밋 메시지 속 core.hooksPath 허용"     allow "$(bash_cmd 'git commit -m "docs: explain git config core.hooksPath behaviour"' "$HERE")"
check "echo 문장 속 core.hooksPath 허용"       allow "$(bash_cmd 'echo "do not change core.hooksPath manually"' "$HERE")"
check "git config --unset core.hooksPath 차단" deny "$(bash_cmd 'git config --unset core.hooksPath' "$HERE")"
check "git config --global core.hooksPath 설정 차단" deny "$(bash_cmd 'git config --global core.hooksPath /tmp/h' "$HERE")"
check "git config --local core.hooksPath 설정 차단" deny "$(bash_cmd 'cd x && git config --local core.hooksPath=/tmp' "$HERE")"
check "git config --file 지정 core.hooksPath 설정 차단" deny "$(bash_cmd 'git config --file .git/config core.hooksPath /tmp' "$HERE")"
check "git -C 경로 config core.hooksPath 설정 차단" deny "$(bash_cmd 'git -C /x config core.hooksPath /tmp' "$HERE")"
check "git config --add core.hooksPath 차단"   deny "$(bash_cmd 'git config --add core.hooksPath /tmp' "$HERE")"
check "git config --replace-all core.hooksPath 차단" deny "$(bash_cmd 'git config --replace-all core.hooksPath /tmp' "$HERE")"
check "git config set core.hooksPath 차단"     deny "$(bash_cmd 'git config set core.hooksPath /tmp' "$HERE")"
check "git config unset core.hooksPath 차단"   deny "$(bash_cmd 'git config unset core.hooksPath' "$HERE")"
check "대소문자 바꾼 키 설정 차단"              deny "$(bash_cmd 'git config CORE.HOOKSPATH /tmp' "$HERE")"
check "git -c core.hooksPath=/dev/null commit 차단" deny "$(bash_cmd 'git -c core.hooksPath=/dev/null commit' "$HERE")"
check "git -c 붙여쓴 형태 차단"                deny "$(bash_cmd 'git -ccore.hooksPath=/dev/null commit -m x' "$HERE")"
check "git config --remove-section core 차단"  deny "$(bash_cmd 'git config --remove-section core' "$HERE")"
check "sh -c 안의 core.hooksPath 설정 차단"    deny "$(bash_cmd "sh -c 'git config core.hooksPath /x'" "$HERE")"
check "core.hooksPath 조회 리다이렉션 허용"     allow "$(bash_cmd 'git config core.hooksPath 2>/dev/null || true' "$HERE")"
# 리뷰 반영: 선행 키워드·값 위치·따옴표·변수로 쓰기를 숨기는 형태 (fail-closed)
# shellcheck disable=SC2016 # "$K" 는 가드에 넘기는 명령 문자열의 리터럴
for c in 'if git config core.hooksPath /x; then :; fi' '! git config core.hooksPath /x' 'eval git config core.hooksPath /x' \
         'timeout 5 git config core.hooksPath /x' 'nice git config core.hooksPath /x' 'for i in 1; do git config core.hooksPath /x; done' \
         'git config core.hooksPath get' 'git config core.hooksPath list' 'git config core.hooksPath /x  # list' \
         'git -C "/a b" config core.hooksPath /x' 'K=core.hooksPath; git config "$K" /x' 'git config "core.hooks""Path" /x' \
         'xargs git config core.hooksPath < f' 'eval "git config core.hooksPath /x"' 'git --git-dir="/a b" config core.hooksPath /x' \
         'git -c "core.hooksPath=/x" commit -m y' '"git" config core.hooksPath /x' '\git config core.hooksPath /x' \
         "git -c 'core.hooksPath'=/x commit" 'k=core.hooksPath; git config $k /x' 'git config $(echo core.hooksPath) /x' \
         'git config core."hooksPath" /x' 'git config core.hooks\Path /x' "GIT_CONFIG_KEY_0='core'.hooksPath GIT_CONFIG_COUNT=1 git commit" \
         'git config core.hooksPath x # --get'; do
  check "우회 형태 차단: $c" deny "$(bash_cmd "$c" "$HERE")"
done
check "commit -m 속 'config <key> 값' 산문 허용" allow "$(bash_cmd 'git commit -m "fix: config core.hooksPath x via prepare"' "$HERE")"
check "echo 산문 속 git config <key> 값 허용"   allow "$(bash_cmd 'echo "never run git config core.hooksPath /x by hand"' "$HERE")"
check "git config get <key> 조회 허용"          allow "$(bash_cmd 'git config get core.hooksPath' "$HERE")"
check "--get 뒤 값 패턴 조회 허용"             allow "$(bash_cmd 'git config --get core.hooksPath husky' "$HERE")"
check "GIT_CONFIG_* 환경변수로 키 주입 차단"    deny "$(bash_cmd 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m x' "$HERE")"
check "Bash 깨진 JSON 차단"                   deny2 "$(echo 'oops' | "$HOOKS/guard_bash.sh" 2>&1; echo "rc=$?")"

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
mkdir -p "$MAIN/.husky/_" && touch "$MAIN/.husky/_/h" && git -C "$MAIN" config core.hooksPath .husky/_
path=$(jq -n --arg n "$name" '{name:$n}' | "$HOOKS/worktree_create.sh" 2>/dev/null | tail -n 1)
if [ "$(git -C "$MAIN" config core.hooksPath)" = "$MAIN/.husky/_" ]; then PASS=$((PASS+1)); echo "  ✅ 워크트리 생성 시 상대 hooksPath 를 절대 경로로 복구"; else FAIL=$((FAIL+1)); echo "  ❌ hooksPath 복구 실패: $(git -C "$MAIN" config core.hooksPath)"; fi
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
