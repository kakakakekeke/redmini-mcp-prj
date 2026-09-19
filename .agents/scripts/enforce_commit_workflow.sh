#!/bin/bash

# 전달받은 명령어 (run_command의 CommandLine)
CMD="$1"

# git commit 명령어인지 확인
if [[ "$CMD" == *"git commit"* ]]; then
  echo "[Hook] Git 커밋을 감지했습니다. 사전 검증 절차(단위 테스트, 컨벤션 검사)를 시작합니다..." >&2

  # 1. 단위 테스트 실행 (package.json에 test 스크립트가 정의된 경우만)
  if grep -q '"test":' package.json; then
    echo "🧪 단위 테스트(npm test)를 실행합니다..." >&2
    npm test >&2
    if [ $? -ne 0 ]; then
      echo "❌ [Hook Error] 단위 테스트가 실패했습니다. 테스트 실패 원인을 분석하고 코드를 수정한 뒤 다시 커밋하세요."
      echo "decision: \"reject\""
      exit 0
    fi
  else
    echo "⚠️ 'test' 스크립트가 설정되지 않아 단위 테스트를 건너뜁니다." >&2
  fi

  # 2. 커밋 메시지 컨벤션 검사 (Conventional Commits)
  # -m "..." 부분을 추출하여 정규식 검사
  COMMIT_MSG=$(echo "$CMD" | grep -oE "\-m [\"'][^\"']+[\"']" | sed -E "s/^-m [\"'](.*)[\"']$/\1/")
  
  if [ -n "$COMMIT_MSG" ]; then
    # 정규식: 타입(옵션 스코프): 설명 (타입은 영문소문자)
    if ! [[ "$COMMIT_MSG" =~ ^(feat|fix|docs|style|refactor|test|chore)(\([a-z0-9_-]+\))?:\ .+ ]]; then
      echo "❌ [Hook Error] 커밋 메시지 컨벤션 위반: '$COMMIT_MSG'"
      echo "반드시 '타입(스코프): 제목' 형식을 따라야 합니다. (예: feat(auth): add login)"
      echo "decision: \"reject\""
      exit 0
    fi
  fi

  # 3. 코드 리뷰 확인 경고
  echo "✅ [Hook Success] 단위 테스트 및 커밋 컨벤션 검증 완료." >&2
  echo "💡 (Reminder) 코드 병합(Merge/Push) 전, Security Code Reviewer 등 다른 에이전트나 사용자에게 코드 리뷰를 받았는지 확인하세요." >&2
  
  echo "decision: \"continue\""
  exit 0
else
  # 커밋 명령어가 아니면 통과
  echo "decision: \"continue\""
  exit 0
fi
