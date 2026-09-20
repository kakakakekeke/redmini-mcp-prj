---
title: "DL-0012: Dockerfile 멀티 스테이지 빌드 및 컨테이너 배포 환경 구축"
created: 2026-09-20
updated: 2026-09-20
status: Accepted
tags:
  - decision-log
  - dl
  - docker
  - deployment
  - sse
  - container
  - multi-stage
  - healthcheck
related:
  - "[[index]]"
  - "[[setup_and_deployment]]"
  - "[[architecture_design]]"
---

# DL-0012: Dockerfile 멀티 스테이지 빌드 및 컨테이너 배포 환경 구축

## 1. 주제 (Topic) 및 배경

Redmine MCP 서버의 프로덕션 운영 및 부서 공용 SSE(Server-Sent Events) 모드 배포를 위해 격리되고 재현 가능한 컨테이너 환경 표준화가 요구되었습니다.

기존 소스 직접 실행 방식은 호스트의 Node.js 버전 불일치, 불필요한 빌드 도구(TypeScript 컴파일러 등)의 런타임 상주로 인한 보안 취약점 증가 및 이미지 용량 팽창 등의 한계가 있었습니다. 이에 따라 경량화, 보안 격리(비루트 실행), 네이티브 헬스체크 및 오케스트레이션 편의성을 갖춘 프로덕션 배포 파이프라인을 구축합니다.

## 2. 결정 사항 (Decision)

### 1. 멀티 스테이지 빌드 구조 채택 (`node:20-alpine`)
- **Stage 1 (`builder`)**:
  - 베이스 이미지: `node:20-alpine` (경량 및 보안 취약점 최소화)
  - `package.json`, `package-lock.json` 복사 후 `npm ci`로 devDependencies 포함 전체 의존성 설치.
  - `tsconfig.json`, `src/` 복사 후 `npm run build`로 TypeScript 컴파일 수행 (`dist/` 생성).
- **Stage 2 (`runner`)**:
  - 베이스 이미지: `node:20-alpine`
  - 프로덕션 의존성만 설치 (`npm ci --omit=dev`)하여 런타임 이미지 크기 최소화.
  - `builder` 단계의 `dist/` 빌드 결과물만 복사.
  - 최종 이미지 크기를 극소화하고 빌드 툴체인의 런타임 노출을 차단.

### 2. 보안 강화 및 비루트 유저 실행
- 컨테이너 내부 프로세스를 루트(root)가 아닌 `USER node`로 실행하여 침해 사고 발생 시 호스트 시스템 권한 탈취를 방지.
- 환경변수 및 민감 정보 보호를 위해 `.env*` 및 문서, 테스트 파일을 빌드 컨텍스트에서 원천 제외하는 `.dockerignore` 정의.

### 3. 컨테이너 네이티브 헬스체크 정의
- Node.js 18+ 내장 `fetch` API를 활용하여 외부 유틸리티(curl/wget) 설치 없이 헬스체크 수행:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/mcp/sse').catch(() => process.exit(1))"
  ```
- 30초 주기, 타임아웃 5초, 재시도 3회로 SSE 엔드포인트 응답성을 모니터링하여 컨테이너 오케스트레이터의 비정상 컨테이너 감지 및 자동 재기동 지원.

### 4. 표준 배포 구성 (`docker-compose.yml`)
- 프로덕션/테스트용 배포를 표준화하기 위해 `docker-compose.yml`을 제공:
  - 서비스명: `redmine-mcp`
  - 포트 매핑: `3000:3000`
  - 환경변수 주입 인터페이스: `REDMINE_URL`, `REDMINE_API_KEY`, `TRANSPORT=sse`, `PORT=3000`, `LOG_LEVEL=info`

## 3. 이유 (Reasoning)

1. **배포 재현성 및 표준화**: 호스트 환경 차이로 인한 런타임 오류를 방지하고, 클라우드/온프레미스 어디서나 동일하게 동작 보장.
2. **보안 공격 표면(Attack Surface) 최소화**:
   - Alpine Linux 기반으로 불필요한 OS 패키지 배제.
   - devDependencies 및 TypeScript 컴파일러 배제로 런타임 취약점 유입 차단.
   - 비루트 `node` 계정 실행으로 컨테이너 탈출 위험 완화.
3. **운영 편의성 및 가용성**: `HEALTHCHECK`와 Docker Compose를 결합하여 배포 자동화 및 무중단 운영 용이.

## 4. 후속 조치 (Action Items)

- [x] 경량 멀티 스테이지 `Dockerfile` 작성 (`node:20-alpine`, `USER node`, `HEALTHCHECK`)
- [x] 빌드 컨텍스트 제외를 위한 `.dockerignore` 작성
- [x] 프로덕션/테스트용 `docker-compose.yml` 작성
- [x] `document/setup_and_deployment.md`에 Docker 배포 가이드 추가
- [x] `document/index.md`에 DL-0012 색인 등록
- [x] `document/todo.md` 대기열 완료(`[x]`) 처리
