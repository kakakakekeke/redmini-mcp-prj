---
title: "DL-0014: 파일 업로드 및 첨부 토큰 발급(upload_attachment) 도구 설계"
created: 2026-09-20
author: subagent-Upload-Tool-Developer
tags:
  - decision-log
  - dl
  - upload
  - attachments
  - tools
related:
  - "[[index]]"
  - "[[redmine_api_specification]]"
  - "[[DL-0008-subagent-todo-completion-enforcement]]"
---

# DL-0014: 파일 업로드 및 첨부 토큰 발급(upload_attachment) 도구 설계

> **안내 (ADR과의 구분 규칙)**: 
> 본 결정 로그(Decision Log)는 코딩 컨벤션, 라이브러리 단순 교체, 워크플로우 조정, UI/UX 결정 등 **일상적이고 실무적인(Operational) 결정**을 빠르게 기록하고 추적하기 위한 용도입니다.

## 1. 주제 (Topic)
Redmine 2단계 첨부 파일 업로드 메커니즘 중 1단계인 바이너리 업로드 API(`POST /uploads.json?filename={filename}`)를 연동하여 업로드 토큰(`token`)을 발급받는 `upload_attachment` 도구의 파라미터 스키마 및 클라이언트 전송 방식 설계.

## 2. 결정 사항 (Decision)
1. **Redmine 2단계 업로드 메커니즘 1단계 전담**:
   - `POST /uploads.json?filename={filename}` 엔드포인트를 호출하여 바이너리 데이터를 업로드하고, 반환된 업로드 토큰(`token`)을 LLM에게 응답한다.
   - 발급된 토큰은 이후 `create_issue` 또는 `update_issue`의 `uploads` 배열 필드(`[{ token, filename, description, content_type }]`)에 바인딩하여 일감 첨부 파일로 연결된다.
2. **텍스트 및 Base64 바이너리 지원**:
   - `content`: 일반 텍스트 또는 Base64 인코딩 문자열을 입력받는다.
   - `is_base64`: 기본값 `false`로, 이미지나 PDF 등 바이너리 파일 업로드 시 `true`로 지정하여 `Buffer.from(content, 'base64')` 변환을 수행한다. Data URL prefix(`data:image/png;base64,`)가 포함된 경우 자동 정제(strip) 처리한다.
3. **MIME 타입 및 메타데이터 지원**:
   - `content_type`: 기본값 `"application/octet-stream"`.
   - `description`: 첨부 파일 설명(선택 파라미터)으로, 반환 객체에 포함하여 LLM이 이후 일감 생성/수정 페이로드 구성 시 그대로 활용할 수 있도록 지원한다.
4. **반환 규격**:
   - `{ token: string, filename: string, content_type: string, description?: string, message: string }`
5. **에러 핸들링**:
   - 401 Unauthorized: 유효한 API Key 확인 안내 메시지 반환.
   - 422 Unprocessable Entity: 업로드 실패 세부 사유 반환.

## 3. 이유 (Reasoning)
- LLM 환경에서는 파일 시스템의 임의 바이너리를 직접 스트리밍하기보다 텍스트나 Base64 포맷으로 전달하는 경우가 일반적이므로, `is_base64` 플래그를 통해 텍스트 로그/스크립트뿐만 아니라 이미지/스크린샷 업로드까지 유연하게 지원할 수 있음.
- 반환값에 입력받은 `filename`, `content_type`, `description`을 함께 반환하여, LLM이 후속 `create_issue`/`update_issue` 호출 시 필요한 uploads 구조체를 별도의 상태 저장 없이 즉시 완성할 수 있도록 편의성을 극대화함.

## 4. 후속 조치 (Action Items)
- [x] `tests/tools/upload_attachment.test.ts` 테스트 코드 작성 (TDD Red)
- [x] `src/client/redmine.ts`에 `uploadFile()` 메서드 구현 및 `tests/unit/redmine.test.ts` 단위 테스트 추가 (TDD Green)
- [x] `src/tools/upload_attachment.ts` Zod 스키마 및 핸들러 구현
- [x] `src/index.ts`에 `upload_attachment` 도구 등록
- [x] `document/todo.md` 대기열 완료(`[x]`) 동기화 (DL-0008)
