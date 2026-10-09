#!/bin/bash
# Git 훅 정책(pre-commit / pre-merge-commit / commit-msg / main 허용 경로 / 훅 설치) 검증 스위트.
# 현재 작업 트리의 훅·정책 파일을 임시 복제 저장소에 적용해 실제 커밋·병합으로 검증한다.
# 주의: 복제 원본은 메인 체크아웃의 HEAD 이며 node_modules 는 메인 저장소의 것을 공유한다.
SRC="$(cd "$(dirname "$0")/../.." && pwd -P)"
MAIN=$(cd "$SRC" && cd "$(git rev-parse --git-common-dir)/.." && pwd -P)
SANDBOX=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$SANDBOX"' EXIT
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ❌ $1"; [ -n "$2" ] && echo "$2" | tail -6 | sed 's/^/       /'; }
# expect 설명 pass 명령...            → 성공해야 함
# expect 설명 fail:<사유패턴> 명령... → 실패해야 하며 출력에 사유 패턴(grep -E)이 있어야 함
expect() {
  local d="$1" e="$2"; shift 2
  out=$("$@" 2>&1); rc=$?
  [ -n "$DEBUG" ] && echo "$out" | tail -8
  case "$e" in
    pass) [ $rc -eq 0 ] && ok "$d" || bad "$d (expected pass, rc=$rc)" "$out" ;;
    fail:*) if [ $rc -ne 0 ] && echo "$out" | grep -Eq -- "${e#fail:}"; then ok "$d"; else bad "$d (expected fail with /${e#fail:}/, rc=$rc)" "$out"; fi ;;
  esac
}
# 픽스처 커밋: 훅을 거치지 않는 plumbing (사람이 만든 임의 상태를 재현하기 위함)
fixture_commit() { git add -A && git update-ref HEAD "$(git commit-tree "$(git write-tree)" -p HEAD -m "$1")"; }
new_worktree() { git -C "$R" worktree add -q "$R/.worktrees/$1" -b "$2" && ln -s "$MAIN/node_modules" "$R/.worktrees/$1/node_modules"; }

R="$SANDBOX/repo"
git clone -q "$MAIN" "$R" && cd "$R" || exit 1
git config user.email t@t && git config user.name t
ln -s "$MAIN/node_modules" node_modules
for p in .husky .agents .gitignore AGENTS.md vitest.config.ts package.json; do rm -rf "$R/$p"; cp -R "$SRC/$p" "$R/$p"; done
fixture_commit "chore(test): apply working tree policy"

echo "📂 훅 설치 (install_git_hooks.sh)"
new_worktree inst feat/inst
(cd .worktrees/inst && sh .agents/scripts/install_git_hooks.sh >/dev/null 2>&1)
[ "$(git config core.hooksPath)" = "$R/.husky/_" ] && ok "워크트리에서 실행해도 메인 .husky/_ 절대 경로로 설치" || bad "hooksPath=$(git config core.hooksPath)"
git config core.hooksPath .husky/_
out=$(sh .agents/scripts/install_git_hooks.sh 2>&1)
[ "$(git config core.hooksPath)" = "$R/.husky/_" ] && ok "상대 경로 hooksPath 를 절대 경로로 복구" || bad "상대 경로 복구 실패" "$out"
out=$(cd "$SANDBOX" && PATH=/usr/bin:/bin sh "$R/.agents/scripts/install_git_hooks.sh" 2>&1); rc=$?
[ $rc -eq 0 ] && echo "$out" | grep -q "건너뜀" && ok "git 저장소 밖: 경고 후 정상 종료 (Docker 빌드 등)" || bad "저장소 밖 처리 (rc=$rc)" "$out"
git worktree remove --force .worktrees/inst; git branch -qD feat/inst

echo "📂 main 허용 경로 (.agents/scripts/main_allowlist.sh)"
. .agents/scripts/main_allowlist.sh
for p in document/todo.md document/index.md document/decision_log/DL-1.md document/adr/1.md document/sop/x.md document/templates/t.md document/x.md .env; do
  is_main_allowed "$p" && ok "허용: $p" || bad "허용되어야 함: $p"
done
for p in .husky/pre-commit .agents/scripts/x.sh src/index.ts CLAUDE.md AGENTS.md .claude/settings.json package.json documentx/a.md; do
  is_main_allowed "$p" && bad "차단되어야 함: $p" || ok "차단: $p"
done

echo "📂 main 직접 커밋"
echo "# sop" > document/sop/zz_test.md && echo "| **[[zz_test]]** |" >> document/index.md
git add document/sop/zz_test.md document/index.md
expect "main: document/sop 문서 커밋 허용" pass git commit -qm "docs(sop): add test sop

[Impact-Reviewed]"
echo "# 한글" > "document/한글_문서.md" && echo "| **[[한글_문서]]** |" >> document/index.md; git add -A document
expect "main: 한글 파일명 문서 커밋 허용 (quotePath)" pass git commit -qm "docs(ko): add korean doc

[Impact-Reviewed]"
echo "# x" >> .husky/commit-msg; git add .husky/commit-msg
expect "main: .husky 커밋 차단" "fail:main_allowlist" git commit -qm "chore(husky): weaken

[Impact-Reviewed]"
git reset -q --hard
git mv .husky/commit-msg document/zz_moved.md && echo "| **[[zz_moved]]** |" >> document/index.md && git add document/index.md
expect "main: .husky 를 document/ 로 이름 변경해 삭제하는 우회 차단" "fail:main_allowlist" git commit -qm "docs(x): move

[Impact-Reviewed]"
git reset -q --hard
echo "export const a = 1;" > src/zz_probe.ts; git add src/zz_probe.ts
expect "main: src 커밋 차단" "fail:main_allowlist" git commit -qm "feat(x): probe"
expect "main: PRE_MERGE_COMMIT=1 위조로 우회 불가" "fail:main_allowlist" env PRE_MERGE_COMMIT=1 git commit -qm "feat(x): probe"
echo 'src/*' >> .agents/main_allowlist
expect "main: 정책 파일을 스테이징 없이 고쳐도 HEAD 정책으로 차단" "fail:main_allowlist" git commit -qm "feat(x): probe"
git checkout -q -- .agents/main_allowlist
mv .agents/main_allowlist "$SANDBOX/allowlist.bak"
expect "main: 작업 트리에서 정책 파일을 지워도 HEAD 정책으로 차단" "fail:main_allowlist" git commit -qm "feat(x): probe"
mv "$SANDBOX/allowlist.bak" .agents/main_allowlist
git reset -q --hard; rm -f src/zz_probe.ts
echo "SECRET=1" > .env; git add -f .env
expect "main: .env 강제 커밋 차단" "fail:\\.env" git commit -qm "chore(env): leak"
git reset -q; rm -f .env

echo "📂 브랜치 커밋 (워크트리)"
new_worktree probe feat/probe && cd .worktrees/probe
expect "worktree: 훅 실행됨 (잘못된 커밋 메시지 차단)" "fail:커밋 메시지 규칙" git commit -q --allow-empty -m "bad message"
echo 'export const n: number = "str";' > src/zz_probe.ts; git add src/zz_probe.ts
expect "branch: 타입 에러 커밋 차단 (tsc)" "fail:타입 검사" git commit -qm "feat(probe): bad types"
echo 'export const n: number = 1;' > src/zz_probe.ts; git add src/zz_probe.ts
expect "branch: 정상 커밋 허용" pass git commit -qm "feat(probe): good types"
sed -i '' '/^### 🚨 P1/a\
1. [ ] `feat/probe` : 설명에 `백틱` 이 여러 개 `있는` 항목
' document/todo.md
out=$(git commit -q --allow-empty -m "test(probe): queue" 2>&1)
echo "$out" | grep -q "Queue Warning\] 1순위" && bad "1순위 브랜치와 일치하는데 대기열 경고 발생" "$out" || ok "대기열: 설명에 백틱이 여러 개여도 1순위 브랜치명 정확히 추출"
git checkout -q -- document/todo.md
git checkout -q --detach
expect "detached HEAD: 정상 커밋 허용" pass git commit -q --allow-empty -m "test(probe): detached"
git checkout -q feat/probe

echo "📂 commit-msg 코어 파일"
for f in .husky/pre-commit .claude/settings.json CLAUDE.md .mcp.json .agents/main_allowlist; do
  mkdir -p "$(dirname "$f")"; echo "# probe" >> "$f"; git add "$f"
  expect "코어 파일 $f: 태그 없으면 차단" "fail:Impact-Reviewed" git commit -qm "chore(core): touch"
  expect "코어 파일 $f: [Impact-Reviewed] 있으면 허용" pass git commit -qm "chore(core): touch

[Impact-Reviewed]"
done
mkdir -p .claude/hooks; echo "# k" > ".claude/hooks/한글.sh"; git add -A .claude
expect "코어 파일 한글 경로: 태그 없으면 차단 (quotePath)" "fail:Impact-Reviewed" git commit -qm "chore(core): ko"
git reset -q --hard

echo "📂 main 병합 커밋"
cd "$R"
expect "merge: 정상 브랜치 병합 허용 (pre-merge-commit)" pass git merge -q --no-ff feat/probe -m "chore(merge): merge branch 'feat/probe' into main

[Impact-Reviewed]"
new_worktree broken feat/broken && (cd .worktrees/broken && echo 'export const n2: number = "str";' > src/zz_broken.ts && fixture_commit "feat(broken): bypassed types")
expect "merge: 타입 에러가 섞인 병합 차단" "fail:타입 검사" git merge -q --no-ff feat/broken -m "chore(merge): merge broken"
git merge --abort 2>/dev/null; git reset -q --hard
new_worktree doc feat/doc-only && (cd .worktrees/doc && echo "# doc" >> document/todo.md && fixture_commit "docs(queue): doc")
git merge -q --no-ff --no-commit feat/doc-only >/dev/null 2>&1
echo "export const evil = 1;" > src/zz_evil.ts; git add src/zz_evil.ts
expect "merge(--no-commit): 병합 대상 외 파일 끼워넣기 차단" "fail:병합 대상 브랜치가 변경하지 않은" git commit -qm "chore(merge): merge doc-only"
git merge --abort 2>/dev/null; git reset -q --hard; rm -f src/zz_evil.ts
new_worktree cf feat/conflict && (cd .worktrees/cf && echo "branch-line" >> document/todo.md && fixture_commit "docs(queue): branch")
echo "main-line" >> document/todo.md && git commit -qam "docs(queue): main side" >/dev/null 2>&1
git merge -q --no-ff feat/conflict >/dev/null 2>&1
if [ -f .git/MERGE_HEAD ] && git ls-files -u | grep -q todo.md; then ok "merge: 실제 충돌 발생 (픽스처 확인)"; else bad "충돌 픽스처 실패"; fi
git checkout -q --theirs document/todo.md && git add document/todo.md
expect "merge(충돌 해결): 병합 대상 파일만이면 허용" pass git commit -qm "chore(merge): merge conflict

[Impact-Reviewed]"

echo; echo "결과: $PASS 성공 / $FAIL 실패"
[ $FAIL -eq 0 ]
