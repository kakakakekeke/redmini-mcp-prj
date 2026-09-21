import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";

export const getProjectsSchema = z.object({
  project_id: z
    .union([z.string(), z.number()])
    .optional()
    .describe(
      "특정 프로젝트의 상세 정보 및 일감 커스텀 필드(issue_custom_fields)를 조회하기 위한 프로젝트 ID, 식별자(identifier) 또는 프로젝트명 (선택 사항)"
    ),
  include_archived: z
    .boolean()
    .default(false)
    .describe("보관(Archived)된 프로젝트를 결과에 포함할지 여부 (기본값: false)"),
});

export type GetProjectsArgs = z.infer<typeof getProjectsSchema>;

export async function getProjectsHandler(args: GetProjectsArgs, client: RedmineClient) {
  if (args.project_id !== undefined && args.project_id !== null && args.project_id !== "") {
    let resolvedId: string | number = args.project_id;
    if (typeof args.project_id === "string" && !/^\d+$/.test(args.project_id.trim())) {
      const resolver = new SmartNameResolver(client);
      await resolver.load();
      const foundId = resolver.resolveProject(args.project_id);
      if (foundId !== undefined) {
        resolvedId = foundId;
      }
    }
    return await client.getProject(resolvedId);
  }
  return await client.getProjects({ include_archived: args.include_archived });
}
