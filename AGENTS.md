# AI Agent Guidelines (`AGENTS.md`)

이 문서는 **Redmine MCP 서버 프로젝트**에 참여하는 모든 AI 코딩 에이전트(Antigravity, Claude, Cursor 등)가 반드시 준수해야 하는 작업 지침 및 프로젝트 규약입니다.

---

## 1. 프로젝트 핵심 문서 및 인덱스 파일 (`document/index.md`)

본 프로젝트의 모든 기획, 사전 조사, 기술 명세 및 가이드는 `document/` 폴더에 체계적으로 관리되고 있습니다.

> [!IMPORTANT] 필수 선행 탐색 규칙 (Document Index First)
> 1. **인덱스 파일의 존재**: `document/index.md`는 프로젝트 내 모든 기술 문서의 요약, 키워드, 언제 읽어야 하는지(Trigger)를 기록한 **에이전트 전용 레지스트리**입니다.
> 2. **무분별한 전체 탐색 금지**: 프로젝트 관련 지식(Redmine API 명세, 오픈소스 비교, 라이선스, 아키텍처 등)이 필요할 때 전체 파일 검색(grep/find)을 수행하기 전에 **반드시 `document/index.md`를 먼저 확인(`view_file`)**하여 필요한 문서만 선별 열람하십시오.

### 주요 관리 문서 목록
* `document/index.md`: **문서 인덱스 레지스트리 (Map of Content)**
* `document/redmine_mcp_research.md`: 오픈소스 11종 비교, 라이선스 가이드, 다중 사용자 및 인증 아키텍처
* `document/redmine_api_specification.md`: Redmine 공식 REST API 21개 전수 도메인 상세 명세

---

## 2. 문서 갱신 강제 규약 (Document Index Enforcement)

`document/` 폴더에 문서를 생성하거나 삭제할 경우, **`document/index.md`의 동기화는 선택이 아닌 필수**입니다.

> [!WARNING] 인덱스 갱신 강제 훅 (Enforcement Hook) 동작
> * 본 프로젝트에는 `.agents/hooks.json`에 정의된 **`document-index-enforcer` 훅**이 활성화되어 있습니다.
> * 에이전트가 `document/` 폴더 내에 문서를 추가하거나 삭제한 후 `document/index.md`를 갱신하지 않고 작업을 종료하려 하면, 훅이 `decision: "continue"`를 반환하여 **작업 종료를 강제로 차단**합니다.
> * 따라서 `document/` 내 파일을 변경했을 때는 반드시 `document/index.md`의 **[프로젝트 문서 색인표]**에 파일명, 트리거 키워드, 열람 시점(Action Trigger), 핵심 요약을 1줄로 간결하게 반영하십시오.

---

## 3. 문서 작성 포맷 규약 (Obsidian Markdown)

모든 프로젝트 문서는 **옵시디언(Obsidian) 마크다운 표준**을 따릅니다:
1. **YAML Frontmatter 필수**: `title`, `created`, `updated`, `tags`, `aliases`, `status`, `related`
2. **옵시디언 콜아웃 적극 활용**: `> [!important]`, `> [!tip]`, `> [!warning]`, `> [!abstract]`
3. **양방향 위키링크(Wikilinks)**: 문서 간 상호 참조 시 `[[문서명\|별칭]]` 및 `[[index]]` 연결
4. **Mermaid 다이어그램**: 아키텍처 및 흐름도는 Mermaid 코드블록으로 시각화

---

## 4. MCP 서버 개발 핵심 지침

자체 Redmine 서버 구축 시 지켜야 할 기본 아키텍처 원칙:
1. **Tool Bloat 방지**: 도구를 40~50개씩 등록하지 않고, 5~7개 핵심 액션 도구로 압축하여 LLM 프롬프트 토큰 절약.
2. **Smart Name Resolution**: LLM이 숫자 ID(`tracker_id`) 대신 문자열(`"tracker": "결함"`, `"status": "진행중"`)을 넘겨도 서버가 캐시를 통해 자동 매핑.
3. **Textile ↔ Markdown 호환성**: Redmine 본문 포맷터에 따라 투명하게 상호 변환.
4. **안전 장치**: 일감 삭제 등 파괴적 작업 시 `confirm_delete` 가드 적용.

---

## 5. 필수 개발 방법론: Vibe Coding & TDD

모든 기능 구현 및 모듈 작성 시 반드시 **바이브 코딩 기반 TDD(Test-Driven Development) 워크플로우**를 따라야 합니다.

> [!CAUTION] 작업 전 필수 확인 (SOP 준수)
> 코딩을 시작하기 전, 반드시 `document/sop/vibe_tdd_sop.md` 문서를 열람(`view_file`)하여 정해진 5단계 프로세스를 숙지하고 엄격히 준수하십시오.
> - **Vitest**를 사용해 실패하는 테스트를 먼저 작성해야 합니다.
> - 저장 시 동작하는 **TypeScript 백그라운드 훅**의 에러 로그를 주시하십시오.
> - 기능 구현 후 반드시 `security_code_reviewer` 서브에이전트에게 보안 및 품질 리뷰를 받아야 합니다.

---

## 6. 의사결정 문서화 규약 (ADR vs Decision Log)

프로젝트 진행 중 발생하는 모든 결정 사항은 반드시 추적 가능하도록 문서화되어야 하며, 일정한 템플릿(`document/templates/`)을 사용해야 합니다.

*   **ADR (Architecture Decision Records)**: `document/adr/` 폴더에 저장.
    *   시스템 아키텍처, 굵직한 기술 스택 변경, 보안 모델 등 **전역적이고 파급력이 큰 결정** 시 작성.
*   **DL (Decision Log)**: `document/decision_log/` 폴더에 저장.
    *   라이브러리 교체, 코딩 컨벤션 지정, 워크플로우 조정 등 **실무적이고 운영적인 결정** 시 작성.

---

## 7. 다중 에이전트 동시 작업 및 Git 워크플로우 (Git Worktree SOP)

프로젝트 내에서 단일 브랜치 충돌을 방지하고, 여러 에이전트(또는 사람)가 안전하게 동시 작업을 진행하기 위해 **Git Worktree 기반의 격리 환경 구성**을 원칙으로 합니다.

> [!CAUTION] Git 작업 전 필수 확인 (Worktree SOP 준수)
> 새로운 기능 개발이나 버그 수정을 시작하기 전, 반드시 `document/sop/git_workflow_sop.md` 문서를 열람(`view_file`)하여 다음을 준수하십시오.
> - **격리된 작업 환경**: 현재 디렉토리(`/Workspace`)에서 직접 브랜치를 따지 말고, `git worktree add ../<폴더명> -b <브랜치명>` 명령을 통해 외부 디렉토리에 워크트리를 생성한 후 해당 디렉토리로 이동하여 작업하십시오.
> - **서브 에이전트 위임 시**: 서브 에이전트를 호출(`invoke_subagent`)할 때 `Workspace` 파라미터를 `share`로 설정하면 자동으로 격리된 워크트리와 유사한 환경이 구성됩니다.
> - **커밋 컨벤션 준수**: 모든 커밋은 Conventional Commits(예: `feat(scope): message`) 규격을 따라야 합니다.
