import { z } from "zod";
import { RedmineClient, GetTimeEntriesParams } from "../client/redmine.js";

export const getTimeEntriesSchema = z.object({
  id: z.number().int().positive().optional().describe("조회할 특정 시간 기록의 고유 숫자 ID (단건 상세 조회 시 사용)"),
  time_entry_id: z.number().int().positive().optional().describe("조회할 특정 시간 기록의 고유 숫자 ID (id와 동일)"),
  project_id: z.union([z.number().int().positive(), z.string().min(1)]).optional().describe("프로젝트 식별자 (숫자 ID 또는 slug)"),
  issue_id: z.number().int().positive().optional().describe("일감(이슈) 고유 숫자 ID"),
  user_id: z.union([z.number().int().positive(), z.string().min(1)]).optional().describe("사용자 식별자 (숫자 ID 또는 'me')"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from은 YYYY-MM-DD 형식이어야 합니다").optional().describe("조회 시작일 (YYYY-MM-DD 형식)"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to는 YYYY-MM-DD 형식이어야 합니다").optional().describe("조회 종료일 (YYYY-MM-DD 형식)"),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "spent_on은 YYYY-MM-DD 형식이어야 합니다").optional().describe("특정 작업일 (YYYY-MM-DD 형식)"),
  limit: z.number().int().min(1).max(100).default(25).describe("가져올 최대 기록 수 (1~100, 기본값: 25)"),
  offset: z.number().int().min(0).optional().describe("조회 시작 오프셋 (페이징용, 0 이상)"),
});

export type GetTimeEntriesArgs = z.infer<typeof getTimeEntriesSchema>;

export async function getTimeEntriesHandler(args: GetTimeEntriesArgs, client: RedmineClient) {
  const entryId = args.id ?? args.time_entry_id;

  if (entryId !== undefined) {
    try {
      return await client.getTimeEntryDetails(entryId);
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return { error: "해당 시간 기록을 찾을 수 없습니다" };
      }
      throw error;
    }
  }

  try {
    const params: GetTimeEntriesParams = {};
    if (args.project_id !== undefined) params.project_id = args.project_id;
    if (args.issue_id !== undefined) params.issue_id = args.issue_id;
    if (args.user_id !== undefined) params.user_id = args.user_id;
    if (args.from !== undefined) params.from = args.from;
    if (args.to !== undefined) params.to = args.to;
    if (args.spent_on !== undefined) params.spent_on = args.spent_on;
    if (args.limit !== undefined) params.limit = args.limit;
    if (args.offset !== undefined) params.offset = args.offset;

    return await client.getTimeEntries(params);
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return { error: "시간 기록 목록을 찾을 수 없습니다" };
    }
    throw error;
  }
}
