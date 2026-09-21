import { z } from "zod";
import { RedmineClient, GetIssuesParams } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";

export const searchIssuesSchema = z.object({
  project_id: z.union([z.string().regex(/^[a-z0-9\-_]+$/, "Invalid project_id"), z.number().int().positive()]).optional().describe("프로젝트 식별자 (숫자 ID 또는 slug)"),
  project: z.string().max(100).optional().describe("프로젝트 이름 (Smart Name Resolver가 project_id로 자동 변환)"),
  subproject_id: z.union([z.string().regex(/^(!\*|\*|\d+)$/, "Invalid subproject_id"), z.number().int().positive()]).optional().describe("하위 프로젝트 필터 ('*' 전체 포함, '!*' 하위 프로젝트 제외, 또는 특정 하위 프로젝트 숫자 ID)"),
  issue_id: z.union([z.string().regex(/^(\d+)(,\d+)*$/, "Invalid issue_id"), z.number().int().positive()]).optional().describe("일감 ID (단일 숫자 또는 쉼표로 구분된 ID 목록, 예: 123 또는 '123,456')"),
  parent_id: z.union([z.string().regex(/^(!\*|\*|\d+)$/, "Invalid parent_id"), z.number().int().positive()]).optional().describe("상위 일감 ID (숫자 ID, '*' 상위 일감 있음, '!*' 상위 일감 없음)"),
  status_id: z.union([z.string().regex(/^(\d+|open|closed|\*)$/, "Invalid status_id"), z.number().int().positive()]).optional().describe("일감 상태의 숫자 ID 또는 'open', 'closed', '*'"),
  status: z.string().max(100).optional().describe("일감 상태명 (예: '신규', '진행중', '해결'). Smart Name Resolver가 status_id로 자동 변환"),
  tracker_id: z.union([z.string().regex(/^\d+$/, "Invalid tracker_id"), z.number().int().positive()]).optional().describe("트래커(유형) 숫자 ID"),
  tracker: z.string().max(100).optional().describe("트래커 이름 (예: '결함', '기능', '지원'). Smart Name Resolver가 tracker_id로 자동 변환"),
  priority_id: z.union([z.string().regex(/^\d+$/, "Invalid priority_id"), z.number().int().positive()]).optional().describe("우선순위 숫자 ID"),
  priority: z.string().max(100).optional().describe("우선순위 이름 (예: '낮음', '보통', '높음', '긴급'). Smart Name Resolver가 priority_id로 자동 변환"),
  category_id: z.union([z.string().regex(/^(!\*|\*|\d+)$/, "Invalid category_id"), z.number().int().positive()]).optional().describe("일감 카테고리 ID ('*' 카테고리 지정됨, '!*' 미지정, 또는 숫자 ID)"),
  fixed_version_id: z.union([z.string().regex(/^(!\*|\*|\d+)$/, "Invalid fixed_version_id"), z.number().int().positive()]).optional().describe("목표 버전/마일스톤 ID ('*' 버전 지정됨, '!*' 미지정, 또는 숫자 ID)"),
  assigned_to_id: z.union([z.string().regex(/^(\d+|me|!\*|\*)$/, "Invalid assigned_to_id"), z.number().int().positive()]).optional().describe("담당자 사용자 ID 또는 현재 사용자 'me'"),
  assigned_to: z.string().max(100).optional().describe("담당자 이름 또는 로그인 계정 (Smart Name Resolver가 assigned_to_id로 자동 변환)"),
  author_id: z.union([z.string().regex(/^(\d+|me|!\*|\*)$/, "Invalid author_id"), z.number().int().positive()]).optional().describe("작성자 사용자 ID 또는 현재 사용자 'me'"),
  author: z.string().max(100).optional().describe("작성자 이름 또는 로그인 계정 (Smart Name Resolver가 author_id로 자동 변환)"),
  query_id: z.union([z.string().regex(/^\d+$/, "Invalid query_id"), z.number().int().positive()]).optional().describe("Redmine에 저장된 커스텀 쿼리(필터 뷰) ID"),
  query: z.string().max(100, "Query too long").optional().describe("제목 검색 키워드 (최대 100자, Redmine의 subject: ~query로 매핑)"),
  subject: z.string().max(255).optional().describe("일감 제목 필터 (예: '~키워드', '=정확한제목')"),
  description: z.string().max(255).optional().describe("일감 본문/설명 필터 (예: '~키워드', '!~키워드')"),
  created_on: z.string().max(50).optional().describe("생성일 필터 (예: '>=2026-09-01', '><2026-09-01|2026-09-18', '2026-09-20')"),
  updated_on: z.string().max(50).optional().describe("수정일 필터 (예: '>=2026-09-01', '><2026-09-01|2026-09-18')"),
  start_date: z.string().max(50).optional().describe("시작일 필터 (예: '>=2026-09-01', '2026-09-01')"),
  due_date: z.string().max(50).optional().describe("완료 기한(만료일) 필터 (예: '<=2026-09-30', '><2026-09-01|2026-09-30')"),
  closed_on: z.string().max(50).optional().describe("종료일 필터 (예: '>=2026-09-01', '><2026-09-01|2026-09-18')"),
  estimated_hours: z.union([z.string().max(50), z.number()]).optional().describe("추정 시간 필터 (예: '>=4', 10, '><2|8')"),
  done_ratio: z.union([z.string().max(50), z.number()]).optional().describe("진척도(%) 필터 (예: '>=50', 100, '><20|80')"),
  custom_fields: z.record(
    z.string().regex(/^(\d+|cf_\d+)$/, "Custom field ID must be numeric or cf_<numeric>"),
    z.union([z.string().max(255), z.number()])
  ).optional().describe("사용자 정의 필드 검색 조건 (예: { '1': '값' } -> cf_1=값)"),
  sort: z.string().regex(/^[a-zA-Z0-9_,:]+$/, "Invalid sort syntax").max(100).optional().describe("결과 정렬 기준 (예: 'updated_on:desc', 'priority:desc,created_on:asc')"),
  limit: z.number().int().min(1).max(100, "Limit must be at most 100").default(10).describe("가져올 최대 일감 수 (1~100, 기본값: 10)"),
  offset: z.number().int().min(0).optional().describe("결과 오프셋 (페이징용, 0 이상)"),
  include: z.string().regex(/^[a-z_,]+$/, "Invalid include format").max(100).optional().describe("추가 포함할 리소스 (예: 'attachments,relations,subtasks')"),
});

export type SearchIssuesArgs = z.infer<typeof searchIssuesSchema>;

export async function searchIssuesHandler(args: SearchIssuesArgs, client: RedmineClient) {
  let project_id = args.project_id;
  let status_id = args.status_id;
  let tracker_id = args.tracker_id;
  let priority_id = args.priority_id;
  let assigned_to_id = args.assigned_to_id;
  let author_id = args.author_id;

  if (args.assigned_to && assigned_to_id === undefined && args.assigned_to.toLowerCase() === "me") {
    assigned_to_id = "me";
  }

  if (args.author && author_id === undefined && args.author.toLowerCase() === "me") {
    author_id = "me";
  }

  const needsResolution =
    (args.project !== undefined && project_id === undefined) ||
    (args.status !== undefined && status_id === undefined) ||
    (args.tracker !== undefined && tracker_id === undefined) ||
    (args.priority !== undefined && priority_id === undefined) ||
    (args.assigned_to !== undefined && assigned_to_id === undefined) ||
    (args.author !== undefined && author_id === undefined);

  if (needsResolution) {
    const resolver = new SmartNameResolver(client);
    await resolver.load();

    if (args.project !== undefined && project_id === undefined) {
      const id = resolver.resolveProject(args.project);
      if (typeof id !== "number") throw new Error(`Project not found: ${args.project}`);
      project_id = id.toString();
    }

    if (args.status !== undefined && status_id === undefined) {
      const id = resolver.resolveStatus(args.status);
      if (typeof id !== "number") throw new Error(`Status not found: ${args.status}`);
      status_id = id.toString();
    }

    if (args.tracker !== undefined && tracker_id === undefined) {
      const id = resolver.resolveTracker(args.tracker);
      if (typeof id !== "number") throw new Error(`Tracker not found: ${args.tracker}`);
      tracker_id = id.toString();
    }

    if (args.priority !== undefined && priority_id === undefined) {
      const id = resolver.resolvePriority(args.priority);
      if (typeof id !== "number") throw new Error(`Priority not found: ${args.priority}`);
      priority_id = id.toString();
    }

    if (args.assigned_to !== undefined && assigned_to_id === undefined) {
      const id = resolver.resolveUser(args.assigned_to);
      if (typeof id !== "number") throw new Error(`Assigned user not found: ${args.assigned_to}`);
      assigned_to_id = id.toString();
    }

    if (args.author !== undefined && author_id === undefined) {
      const id = resolver.resolveUser(args.author);
      if (typeof id !== "number") throw new Error(`Author user not found: ${args.author}`);
      author_id = id.toString();
    }
  }

  const rawParams: GetIssuesParams = {
    project_id,
    subproject_id: args.subproject_id,
    issue_id: args.issue_id,
    parent_id: args.parent_id,
    status_id,
    tracker_id,
    priority_id,
    category_id: args.category_id,
    fixed_version_id: args.fixed_version_id,
    assigned_to_id,
    author_id,
    query_id: args.query_id,
    query: args.query,
    subject: args.subject,
    description: args.description,
    created_on: args.created_on,
    updated_on: args.updated_on,
    start_date: args.start_date,
    due_date: args.due_date,
    closed_on: args.closed_on,
    estimated_hours: args.estimated_hours,
    done_ratio: args.done_ratio,
    custom_fields: args.custom_fields,
    sort: args.sort,
    limit: args.limit,
    offset: args.offset,
    include: args.include,
  };

  const params: GetIssuesParams = Object.fromEntries(
    Object.entries(rawParams).filter(([_, value]) => value !== undefined)
  );

  return await client.getIssues(params);
}
