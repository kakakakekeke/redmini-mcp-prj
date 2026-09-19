import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";

export const searchIssuesSchema = z.object({
  project_id: z.string().regex(/^[a-z0-9\-]+$/, "Invalid project_id").optional().describe("프로젝트 식별자(ID 또는 슬러그 identifier)"),
  status_id: z.string().regex(/^(\d+|open|closed|\*)$/, "Invalid status_id").optional().describe("일감 상태의 숫자 ID 또는 'open', 'closed', '*'"),
  status: z.string().optional().describe("일감 상태명 (예: '신규', '진행중', '해결'). Smart Name Resolver가 ID로 자동 변환"),
  tracker_id: z.string().regex(/^\d+$/, "Invalid tracker_id").optional().describe("트래커(유형) 숫자 ID"),
  tracker: z.string().optional().describe("트래커 이름 (예: '결함', '기능', '지원'). Smart Name Resolver가 ID로 자동 변환"),
  assigned_to_id: z.string().regex(/^(\d+|me)$/, "Invalid assigned_to_id").optional().describe("담당자 사용자 ID 또는 현재 사용자 'me'"),
  query: z.string().max(100, "Query too long").optional().describe("제목 또는 본문 검색 키워드 (최대 100자)"),
  limit: z.number().int().min(1).max(50, "Limit must be at most 50").default(10).describe("가져올 최대 일감 수 (1~50, 기본값: 10)"),
});

export type SearchIssuesArgs = z.infer<typeof searchIssuesSchema>;

export async function searchIssuesHandler(args: SearchIssuesArgs, client: RedmineClient) {
  let status_id = args.status_id;
  let tracker_id = args.tracker_id;
  
  if (args.status || args.tracker) {
    const resolver = new SmartNameResolver(client);
    await resolver.load();
    
    if (args.status && !status_id) {
      const id = resolver.resolveStatus(args.status);
      if (id) status_id = id.toString();
    }
    
    if (args.tracker && !tracker_id) {
      const id = resolver.resolveTracker(args.tracker);
      if (id) tracker_id = id.toString();
    }
  }

  const result = await client.getIssues({
    project_id: args.project_id,
    status_id: status_id,
    tracker_id: tracker_id,
    assigned_to_id: args.assigned_to_id,
    query: args.query,
    limit: args.limit,
  } as any);
  return result;
}
