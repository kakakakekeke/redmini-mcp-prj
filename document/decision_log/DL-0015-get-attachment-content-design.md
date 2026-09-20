---
title: "DL-0015: 첨부파일 본문 내용 조회(get_attachment_content) 도구 설계"
created: 2026-09-20
author: Antigravity
tags:
  - decision-log
  - dl
  - attachment
  - download
  - tools
  - context-protection
related:
  - "[[index]]"
  - "[[redmine_api_specification]]"
  - "[[DL-0014-upload-attachment-tool-design]]"
  - "[[attachment_guide]]"
---

# DL-0015: 첨부파일 본문 내용 조회(get_attachment_content) 도구 설계

> **안내 (ADR과의 구분 규칙)**: 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
Redmine 일감 및 시스템에 첨부된 파일(로그, 소스코드, 텍스트 문서, 이미지 등)의 본문 내용을 다운로드하고 분석할 수 있는 `get_attachment_content` MCP 도구의 스키마, 텍스트/바이너리 판별 및 Truncation 가드레일 설계.

## 2. 결정 사항 (Decision)
1. **2단계 조회 프로세스 (ID 단일 입력 기반)**:
   - 사용자와 LLM의 편의를 위해 복잡한 파일명이나 URL 대신 첨부파일의 고유 번호(`attachment_id`)만 입력받는다.
   - 1차로 `GET /attachments/{id}.json`을 호출하여 메타데이터(파일명, MIME 타입, 파일 크기 등)를 파악한다.
   - 2차로 `GET /attachments/download/{id}/{filename}` 엔드포인트를 호출하여 실제 파일 바이너리를 `arraybuffer`로 안전하게 다운로드한다.
2. **텍스트 vs 바이너리 자동 판별 및 인코딩**:
   - `content_type` (MIME) 및 파일 확장자를 분석하여 자동 판별:
     - **텍스트 형식** (`text/*`, `application/json`, `application/xml`, `.txt`, `.log`, `.md`, `.csv`, `.py`, `.ts`, `.js`, `.yaml`, `.yml` 등): UTF-8 텍스트 문자열로 변환하고 `is_base64: false`로 응답.
     - **바이너리 형식** (이미지, PDF, 압축 파일 등): Base64 인코딩 문자열로 변환하고 `is_base64: true`로 응답.
3. **LLM 컨텍스트 폭주 방지 (Truncation Guard)**:
   - 파라미터 `max_bytes` (기본값: 500,000바이트 = 약 500KB)를 두어, 대용량 파일 다운로드 시 응답 토큰 초과로 인한 세션 크래시를 방지한다.
   - 초과된 경우 데이터를 자르고 `truncated: true` 플래그를 반환한다.
4. **반환 규격**:
   ```json
   {
     "attachment_id": 123,
     "filename": "server.log",
     "content_type": "text/plain",
     "filesize": 1024,
     "is_base64": false,
     "content": "2026-09-20 ...",
     "truncated": false
   }
   ```
5. **에러 핸들링**:
   - 404 Not Found: 해당 첨부파일이 존재하지 않거나 권한이 없음을 친절한 에러 메시지로 반환.

## 3. 이유 (Reasoning)
- 기존에는 `get_issue_details`에서 첨부파일의 메타데이터와 다운로드 URL만 노출되어 에이전트가 직접 파일 내용을 분석할 수 없었음.
- `upload_attachment` (업로드)와 대칭되는 `get_attachment_content` (다운로드 및 내용 읽기)를 제공함으로써 Redmine 파일 처리 파이프라인을 완성함.
- 대용량 로그나 덤프 파일이 컨텍스트 윈도우를 소진시키는 문제를 막기 위해 `max_bytes` 기반의 Truncation 보호 장치를 기본 탑재함.

## 4. 후속 조치 (Action Items)
- [ ] `tests/tools/get_attachment_content.test.ts` 테스트 코드 작성 (TDD Red)
- [ ] `src/client/redmine.ts`에 `getAttachment()`, `downloadAttachment()` 메서드 구현 (TDD Green)
- [ ] `src/tools/get_attachment_content.ts` 도구 및 Zod 스키마 구현
- [ ] `src/index.ts`에 도구 등록
- [ ] `document/todo.md` 대기열 동기화 및 완료(`[x]`) 처리
