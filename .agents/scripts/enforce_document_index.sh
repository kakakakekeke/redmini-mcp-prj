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
MISSING=""
for f in $(find "$DOC_DIR" -type f -name "*.md"); do
  [ "$f" = "$INDEX_FILE" ] && continue
  fname=$(basename "$f")
  base=$(basename "$f" .md)
  # Check if the base name exists in the index
  if ! grep -q "$base" "$INDEX_FILE"; then
    MISSING="${MISSING} ${fname}"
  fi
done

# 5. Check for deleted files that are still referenced in active catalog rows
DELETED=""
# Extract links cleanly: matches [[...]] and takes the first part before | or ]]
ACTIVE_LINKS=$(grep -E '^\s*\|\s*\*\*\[\[' "$INDEX_FILE" 2>/dev/null | sed -n 's/.*\[\[\([^]|]*\).*/\1/p' | sort -u)

for link in $ACTIVE_LINKS; do
  target_base=$(basename "$link")
  [ "$target_base" = "index" ] && continue
  
  # Recursively find the file in DOC_DIR
  found_file=$(find "$DOC_DIR" -type f -name "${target_base}.md")
  if [ -z "$found_file" ]; then
    DELETED="${DELETED} ${target_base}.md"
  fi
done

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
