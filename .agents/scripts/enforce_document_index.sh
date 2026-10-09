#!/bin/sh
# enforce_document_index.sh
# Zero-dependency POSIX shell script to enforce document/index.md synchronization.
# Updated to support recursive subdirectories in document/

# 1. Resolve Project Root
if [ -d "document" ]; then
  ROOT="."
elif [ -d "../document" ]; then
  ROOT=".."
else
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

DOC_DIR="$ROOT/document"
INDEX_FILE="$DOC_DIR/index.md"

# If document directory or index.md does not exist, allow
if [ ! -d "$DOC_DIR" ] || [ ! -f "$INDEX_FILE" ]; then
  echo '{"decision":"allow"}'
  exit 0
fi

# 2. Read stdin if available
INPUT=""
if [ ! -t 0 ]; then
  INPUT=$(cat)
fi

# 3. Check if this is a Stop event
if [ -n "$INPUT" ]; then
  case "$INPUT" in
    *terminationReason*|*model_stop*|*Stop*)
      ;;
    *)
      echo '{}'
      exit 0
      ;;
  esac
fi

# 4. Check for unindexed files in document/**/*.md
# 공백이 든 파일명도 처리하도록 줄 단위로 읽는다 (서브셸 결과는 출력으로 수집)
MISSING=$(find "$DOC_DIR" -type f -name "*.md" ! -path "*/.obsidian/*" | while IFS= read -r f; do
  [ "$f" = "$INDEX_FILE" ] && continue
  fname=$(basename "$f")
  base=$(basename "$f" .md)
  # 색인표 행(| **[[문서명| ...)으로 등록되어 있어야 한다. 본문에 이름만 언급된 것은 인정하지 않음 (DL-0029)
  base_re=$(printf '%s' "$base" | sed 's/[][\.*^$+?(){}|/]/\\&/g')
  # 문서명 뒤에는 '|'(별칭), '\|'(표 안 이스케이프 별칭), ']]' 중 하나가 와야 한다
  if ! grep -Eq '^[[:space:]]*\|[[:space:]]*\*\*\[\['"$base_re"'[]|\\]' "$INDEX_FILE"; then
    printf ' %s' "$fname"
  fi
done)

# 5. Check for deleted files that are still referenced in active catalog rows
# Extract links cleanly: matches [[...]] and takes the first part before | or ]] (표 안 이스케이프 '\|' 의 역슬래시 제거)
# 공백이 든 문서명도 처리하도록 줄 단위로 읽는다.
DELETED=$(grep -E '^[[:space:]]*\|[[:space:]]*\*\*\[\[' "$INDEX_FILE" 2>/dev/null \
  | sed -n 's/.*\[\[\([^]|]*\).*/\1/p' | sed 's/\\$//' | sort -u | while IFS= read -r link; do
  target_base=$(basename "$link")
  [ "$target_base" = "index" ] && continue
  # Recursively find the file in DOC_DIR (glob 특수문자를 피하기 위해 -name 대신 정확 비교)
  if ! find "$DOC_DIR" -type f -name "*.md" | while IFS= read -r f; do [ "$(basename "$f" .md)" = "$target_base" ] && echo hit; done | grep -q hit; then
    printf ' %s' "${target_base}.md"
  fi
done)

# 6. Output decision
if [ -n "$MISSING" ] || [ -n "$DELETED" ]; then
  MSG="[Document Index Enforcer] document/ 폴더 상태와 document/index.md가 불일치하여 작업을 종료할 수 없습니다."
  if [ -n "$MISSING" ]; then
    MSG="${MSG}\n- 인덱스 누락 파일:${MISSING}"
  fi
  if [ -n "$DELETED" ]; then
    MSG="${MSG}\n- 삭제된 파일 링크:${DELETED}"
  fi
  MSG="${MSG}\n\n▶ 조치: document/index.md 색인표에 파일 정보를 갱신하십시오."

  printf '{"decision":"continue","reason":"%s"}\n' "$MSG"
else
  echo '{"decision":"allow"}'
fi
