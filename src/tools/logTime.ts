import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";

export const logTimeSchema = z.object({
  issue_id: z.number().int().positive().optional().describe("일감 번호 (숫자 ID). issue_id 또는 project_id 중 최소 1개 필요"),
  project_id: z.union([z.number().int().positive(), z.string().min(1)]).optional().describe("프로젝트 ID(숫자) 또는 식별자(문자열 slug)"),
  hours: z.number().positive().describe("소요 시간 (시간 단위, 소수점 가능, 예: 1.5)"),
  activity_id: z.number().int().positive().optional().describe("활동(Activity) 숫자 ID"),
  activity: z.string().optional().describe("활동 이름 (예: '개발', '디자인' 등). Smart Resolver를 통해 자동으로 activity_id로 변환"),
  comments: z.string().max(255).optional().describe("작업 내용 설명 (선택사항, 최대 255자)"),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "spent_on은 YYYY-MM-DD 형식이어야 합니다").optional().describe("작업 수행일 (YYYY-MM-DD 형식, 기본값: 오늘 날짜)"),
});

export type LogTimeArgs = z.infer<typeof logTimeSchema>;

export async function logTimeHandler(args: LogTimeArgs, client: RedmineClient) {
  if (!args.issue_id && !args.project_id) {
    throw new Error("Either issue_id or project_id must be provided");
  }

  let activity_id = args.activity_id;
  if (args.activity && !activity_id) {
    const resolver = new SmartNameResolver(client);
    await resolver.load();
    activity_id = resolver.resolveActivity(args.activity);
    if (activity_id === undefined) {
      throw new Error(`Invalid activity name: ${args.activity}`);
    }
  }

  const timeEntryPayload: Record<string, any> = {
    hours: args.hours,
    spent_on: args.spent_on ?? new Date().toISOString().slice(0, 10),
  };
  if (args.issue_id !== undefined) timeEntryPayload.issue_id = args.issue_id;
  if (args.project_id !== undefined) timeEntryPayload.project_id = args.project_id;
  if (activity_id !== undefined) timeEntryPayload.activity_id = activity_id;
  if (args.comments !== undefined) timeEntryPayload.comments = args.comments;

  try {
    const result = await client.createTimeEntry({ time_entry: timeEntryPayload });
    return result;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return { error: "해당 일감 또는 프로젝트를 찾을 수 없습니다" };
    }
    if (error.response && error.response.status === 422) {
      return { error: `시간 기록 실패: ${JSON.stringify(error.response.data)}` };
    }
    throw error;
  }
}
