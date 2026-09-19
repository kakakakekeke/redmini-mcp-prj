#!/bin/sh
# test_hook_suite.sh
# Comprehensive test suite for enforce_document_index.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$PROJECT_ROOT/.agents/scripts/enforce_document_index.sh"
DOC_DIR="$PROJECT_ROOT/document"
INDEX_FILE="$DOC_DIR/index.md"
ORIG_INDEX="$PROJECT_ROOT/.orig_index.md.bak"

# Backup original index.md
cp "$INDEX_FILE" "$ORIG_INDEX"

TOTAL=0
PASSED=0
FAILED=0

run_test() {
  TOTAL=$((TOTAL + 1))
  DESC="$1"
  CMD="$2"
  EXPECT_TYPE="$3"   # "allow", "continue", "empty", "git_fail", "git_pass"
  EXPECT_TEXT="$4"

  OUTPUT=$(eval "$CMD" 2>&1)
  STATUS=$?

  SUCCESS=0
  case "$EXPECT_TYPE" in
    "allow")
      if echo "$OUTPUT" | grep -q '"decision":"allow"'; then SUCCESS=1; fi
      ;;
    "continue")
      if echo "$OUTPUT" | grep -q '"decision":"continue"'; then
        if [ -n "$EXPECT_TEXT" ]; then
          if echo "$OUTPUT" | grep -q "$EXPECT_TEXT"; then SUCCESS=1; fi
        else
          SUCCESS=1
        fi
      fi
      ;;
    "empty")
      if [ "$OUTPUT" = "{}" ]; then SUCCESS=1; fi
      ;;
    "git_fail")
      if [ $STATUS -ne 0 ]; then SUCCESS=1; fi
      ;;
    "git_pass")
      if [ $STATUS -eq 0 ]; then SUCCESS=1; fi
      ;;
  esac

  if [ $SUCCESS -eq 1 ]; then
    PASSED=$((PASSED + 1))
    printf "  ✅ [PASS] TC-%02d: %s\n" "$TOTAL" "$DESC"
  else
    FAILED=$((FAILED + 1))
    printf "  ❌ [FAIL] TC-%02d: %s\n" "$TOTAL" "$DESC"
    printf "       Output: %s\n" "$OUTPUT"
  fi
}

cleanup() {
  if [ -f "$ORIG_INDEX" ]; then
    cp "$ORIG_INDEX" "$INDEX_FILE"
    rm -f "$ORIG_INDEX"
  fi
  rm -rf "$DOC_DIR"/test_* "$DOC_DIR"/fake_* "$DOC_DIR"/*.tmp
}
trap cleanup EXIT INT TERM

printf "\n========================================================\n"
printf "   Redmine MCP Document Index Hook 전수 검증 테스트\n"
printf "========================================================\n\n"

printf "📂 [카테고리 1: 정상 상태 및 다중 파일 등록 검증]\n"
run_test "기본 정상 상태 (index와 디스크 일치)" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "allow"

# 새 파일 생성 및 index 등록
touch "$DOC_DIR/test_valid_a.md"
printf "\n| **[[test_valid_a|document/test_valid_a.md]]** | \`테스트\` | 테스트 시 | 테스트 요약 |\n" >> "$INDEX_FILE"
run_test "새 마크다운 생성 후 index 색인표에 등록된 경우 (정상 통과)" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "allow"

touch "$DOC_DIR/test_valid_b.md"
printf "| **[[test_valid_b|document/test_valid_b.md]]** | \`테스트2\` | 테스트 시 | 테스트 요약 2 |\n" >> "$INDEX_FILE"
run_test "복수 마크다운 생성 후 모두 index에 등록된 경우 (정상 통과)" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "allow"
cleanup; cp "$INDEX_FILE" "$ORIG_INDEX"

printf "\n📂 [카테고리 2: 누락 파일 감지 및 예외 파일 포맷 검증]\n"
touch "$DOC_DIR/test_unindexed.md"
run_test "단일 미등록 마크다운 파일 감지" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "continue" "test_unindexed.md"

touch "$DOC_DIR/test_unindexed_2.md" "$DOC_DIR/test_unindexed_3.md"
run_test "다중 미등록 파일 동시 감지 (모든 파일명 리포트 확인)" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "continue" "test_unindexed_3.md"
cleanup; cp "$INDEX_FILE" "$ORIG_INDEX"

touch "$DOC_DIR/test_SPEC-V2.0_Final.md"
run_test "특수문자/하이픈/대문자/점 복합 파일명 감지" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "continue" "test_SPEC-V2.0_Final.md"
cleanup; cp "$INDEX_FILE" "$ORIG_INDEX"

touch "$DOC_DIR/test_diagram.png" "$DOC_DIR/test_data.json" "$DOC_DIR/test_notes.txt"
run_test "마크다운이 아닌 파일(.png, .json, .txt) 무시 검증" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "allow"
cleanup; cp "$INDEX_FILE" "$ORIG_INDEX"

mkdir -p "$DOC_DIR/test_subdir"
touch "$DOC_DIR/test_subdir/nested.md"
run_test "document 내 하위 디렉터리 존재 시 크래시 없이 정상 처리" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "allow"
cleanup; cp "$INDEX_FILE" "$ORIG_INDEX"

printf "\n📂 [카테고리 3: 삭제/이름변경 파일 불일치 감지 검증]\n"
printf "\n| **[[test_ghost_doc|document/test_ghost_doc.md]]** | \`유령\` | 유령 문서 | 존재하지 않는 문서 |\n" >> "$INDEX_FILE"
run_test "index에는 있으나 디스크에 파일이 없는 경우 (삭제 감지)" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "continue" "test_ghost_doc.md"

printf "| **[[test_ghost_2|document/test_ghost_2.md]]** | \`유령2\` | 유령2 | 미존재 문서 2 |\n" >> "$INDEX_FILE"
run_test "복수 삭제 파일 동시 감지" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "continue" "test_ghost_2.md"
cleanup; cp "$INDEX_FILE" "$ORIG_INDEX"

# 파일명 변경 (Rename) 시나리오
touch "$DOC_DIR/test_new_name.md"
printf "\n| **[[test_old_name|document/test_old_name.md]]** | \`구이름\` | 구문서 | 변경 전 |\n" >> "$INDEX_FILE"
run_test "파일명 변경(Rename) 시 누락 및 삭제 동시 감지" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "continue" "test_new_name.md"
cleanup; cp "$INDEX_FILE" "$ORIG_INDEX"

run_test "2장 '작성 예정 문서'에 기재된 미래 문서는 삭제로 오탐하지 않음" \
  "echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK'" \
  "allow"

printf "\n📂 [카테고리 4: 실행 경로 독립성 및 이벤트 타입 검증]\n"
run_test "CWD가 .agents 디렉터리일 때의 경로 독립성 검증 (Antigravity 실행 환경)" \
  "(cd '$PROJECT_ROOT/.agents' && echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK')" \
  "allow"

run_test "CWD가 .agents/scripts 깊은 디렉터리일 때의 경로 독립성 검증" \
  "(cd '$PROJECT_ROOT/.agents/scripts' && echo '{\"terminationReason\": \"model_stop\"}' | '$HOOK')" \
  "allow"

run_test "Non-Stop 이벤트(PostToolUse) 시 {} 반환하여 에이전트 작업 미방해 검증" \
  "echo '{\"stepIdx\": 5, \"tool\": \"write_to_file\"}' | '$HOOK'" \
  "empty"

run_test "비정상/일반 텍스트 stdin 입력 시 크래시 방지 내구성 검증" \
  "echo 'not a json input plain text' | '$HOOK'" \
  "empty"

printf "\n📂 [카테고리 5: Git Pre-commit 훅 연동 차단/허용 검증]\n"
touch "$DOC_DIR/test_git_unindexed.md"
run_test "Git pre-commit: 미등록 파일 존재 시 커밋 강제 차단 (Exit Code != 0)" \
  "'$PROJECT_ROOT/.git/hooks/pre-commit'" \
  "git_fail"
cleanup; cp "$INDEX_FILE" "$ORIG_INDEX"

run_test "Git pre-commit: 정상 상태 시 커밋 통과 (Exit Code == 0)" \
  "'$PROJECT_ROOT/.git/hooks/pre-commit'" \
  "git_pass"

cleanup

printf "\n========================================================\n"
printf "  테스트 결과: 총 %d건 중 %d건 성공 (%d건 실패)\n" "$TOTAL" "$PASSED" "$FAILED"
printf "========================================================\n\n"

if [ $FAILED -gt 0 ]; then
  exit 1
fi
exit 0
