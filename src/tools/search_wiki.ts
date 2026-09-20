import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";

export const searchWikiSchema = z.object({
  project_id: z.string().regex(/^[a-z0-9\-]+$/, "Invalid project_id").describe("프로젝트 식별자(ID 또는 슬러그 identifier)"),
  title: z.string().min(1).max(100, "Title too long").optional().describe("위키 페이지 제목 (예: 'Home', '개발 가이드')"),
  query: z.string().max(100, "Query too long").optional().describe("검색 키워드. 제목 또는 본문을 기준으로 매칭합니다."),
  include_attachments: z.boolean().default(false).describe("위키 페이지 상세 조회 시 첨부파일 메타데이터 포함 여부"),
  limit: z.number().int().min(1).max(50, "Limit must be at most 50").default(10).describe("반환할 위키 문서 수 (1~50, 기본값: 10)"),
});

export type SearchWikiArgs = z.infer<typeof searchWikiSchema>;

export async function searchWikiHandler(args: SearchWikiArgs, client: RedmineClient) {
  return await client.searchWiki({
    project_id: args.project_id,
    title: args.title,
    query: args.query,
    include_attachments: args.include_attachments,
    limit: args.limit,
  });
}
