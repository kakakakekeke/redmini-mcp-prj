import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";

export const searchAllSchema = z.object({
  q: z.string().min(1, "Search query is required").max(100, "Query too long").describe("통합 검색 키워드 (필수, 최대 100자)"),
  scope: z.enum(["all", "my_projects", "subprojects"]).optional().describe("검색 범위 ('all': 전체 프로젝트, 'my_projects': 내 프로젝트, 'subprojects': 하위 프로젝트 포함)"),
  open_issues: z.boolean().optional().describe("열린 일감만 검색할지 여부 (기본값: false)"),
  all_words: z.boolean().optional().describe("모든 검색어가 일치해야 하는지 여부 (기본값: false)"),
  titles_only: z.boolean().optional().describe("제목에서만 검색할지 여부 (기본값: false)"),
  issues: z.boolean().optional().describe("일감(Issues) 검색 포함 여부"),
  wiki_pages: z.boolean().optional().describe("위키 문서(Wiki pages) 검색 포함 여부"),
  news: z.boolean().optional().describe("뉴스(News) 검색 포함 여부"),
  documents: z.boolean().optional().describe("문서(Documents) 검색 포함 여부"),
  changesets: z.boolean().optional().describe("변경이력/커밋(Changesets) 검색 포함 여부"),
  messages: z.boolean().optional().describe("게시판 메시지(Messages) 검색 포함 여부"),
  projects: z.boolean().optional().describe("프로젝트(Projects) 검색 포함 여부"),
  limit: z.number().int().min(1).max(100, "Limit must be at most 100").default(10).describe("가져올 최대 검색 결과 수 (1~100, 기본값: 10)"),
  offset: z.number().int().min(0, "Offset must be non-negative").default(0).optional().describe("결과 오프셋 페이징 시작 위치 (기본값: 0)"),
});

export type SearchAllArgs = z.infer<typeof searchAllSchema>;

export async function searchAllHandler(args: SearchAllArgs, client: RedmineClient) {
  const result = await client.searchAll({
    q: args.q,
    scope: args.scope,
    open_issues: args.open_issues,
    all_words: args.all_words,
    titles_only: args.titles_only,
    issues: args.issues,
    wiki_pages: args.wiki_pages,
    news: args.news,
    documents: args.documents,
    changesets: args.changesets,
    messages: args.messages,
    projects: args.projects,
    limit: args.limit,
    offset: args.offset,
  });
  return result;
}
