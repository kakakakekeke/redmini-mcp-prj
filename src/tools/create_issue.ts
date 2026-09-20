import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";

export const createIssueSchema = z.object({
  project_id: z.string().describe("프로젝트 식별자(ID 또는 슬러그 identifier)"),
  subject: z.string().max(255).describe("일감 제목 (최대 255자)"),
  description: z.string().max(65535).optional().describe("일감 설명/본문"),
  tracker: z.string().optional().describe("트래커 이름 (예: '결함', '기능'). Smart Name Resolver 자동 변환"),
  tracker_id: z.number().int().optional().describe("트래커 숫자 ID"),
  status: z.string().optional().describe("상태 이름"),
  status_id: z.number().int().optional().describe("상태 숫자 ID"),
  priority: z.string().optional().describe("우선순위 이름"),
  priority_id: z.number().int().optional().describe("우선순위 숫자 ID"),
  assigned_to_id: z.number().int().optional().describe("담당자 사용자 ID"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid due_date").optional().describe("만료일 (YYYY-MM-DD)"),
  estimated_hours: z.number().positive().optional().describe("추정 시간"),
  dry_run: z.boolean().default(false).describe("true로 설정 시 실제 생성하지 않고 미리보기를 반환합니다."),
});

export type CreateIssueArgs = z.infer<typeof createIssueSchema>;

export async function createIssueHandler(args: CreateIssueArgs, client: RedmineClient) {
  let tracker_id = args.tracker_id;
  let status_id = args.status_id;
  let priority_id = args.priority_id;

  if (args.tracker || args.status || args.priority) {
    const resolver = new SmartNameResolver(client);
    await resolver.load();

    if (args.tracker && !tracker_id) {
      tracker_id = resolver.resolveTracker(args.tracker);
    }
    if (args.status && !status_id) {
      status_id = resolver.resolveStatus(args.status);
    }
    if (args.priority && !priority_id) {
      priority_id = resolver.resolvePriority(args.priority);
    }
  }

  const payload: any = {
    project_id: args.project_id,
    subject: args.subject,
  };
  if (args.description !== undefined) payload.description = args.description;
  if (tracker_id !== undefined) payload.tracker_id = tracker_id;
  if (status_id !== undefined) payload.status_id = status_id;
  if (priority_id !== undefined) payload.priority_id = priority_id;
  if (args.assigned_to_id !== undefined) payload.assigned_to_id = args.assigned_to_id;
  if (args.due_date !== undefined) payload.due_date = args.due_date;
  if (args.estimated_hours !== undefined) payload.estimated_hours = args.estimated_hours;

  if (args.dry_run) {
    return {
      message: "dry_run is true. Issue will not be created. Please ask user to confirm.",
      dry_run: true,
      payload
    };
  }

  return await client.createIssue({ issue: payload });
}
