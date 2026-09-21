import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";

export const getProjectsSchema = z.object({
  project_id: z
    .union([
      z
        .string()
        .trim()
        .min(1, "프로젝트 ID 또는 식별자는 공백일 수 없습니다.")
        .max(255, "프로젝트 ID 또는 식별자는 255자를 초과할 수 없습니다.")
        .refine((val) => !val.includes("/") && !val.includes("\\") && !val.includes(".."), {
          message: "프로젝트 ID 또는 식별자에 경로 조작 문자(/, \\, ..)가 포함될 수 없습니다.",
        }),
      z.number().int().positive("프로젝트 ID는 양의 정수여야 합니다."),
    ])
    .optional()
    .describe(
      "특정 프로젝트의 상세 정보 및 일감 커스텀 필드(issue_custom_fields)를 조회하기 위한 프로젝트 ID, 식별자(identifier) 또는 프로젝트명 (선택 사항)"
    ),
  include_archived: z
    .boolean()
    .default(false)
    .describe("보관(Archived)된 프로젝트를 결과에 포함할지 여부 (기본값: false, project_id 미지정 시에만 적용)"),
});

export type GetProjectsArgs = z.infer<typeof getProjectsSchema>;

export async function getProjectsHandler(args: GetProjectsArgs, client: RedmineClient) {
  if (args.project_id !== undefined && args.project_id !== null) {
    let resolvedId: string | number = args.project_id;
    if (typeof args.project_id === "string" && !/^\d+$/.test(args.project_id)) {
      const resolver = (client as any).resolver ?? new SmartNameResolver(client);
      (client as any).resolver = resolver;
      await resolver.load();
      const foundId = resolver.resolveProject(args.project_id);
      if (foundId !== undefined) {
        resolvedId = foundId;
      }
    }
    try {
      const result = await client.getProject(resolvedId);
      if (result && typeof result === "object" && result.user && typeof result.user === "object" && "api_key" in result.user) {
        result.user.api_key = "[REDACTED]";
      }
      return result;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { error: `해당 프로젝트를 찾을 수 없습니다: ${args.project_id}` };
      }
      if (error.response?.status === 403) {
        return { error: "해당 프로젝트에 접근할 권한이 없습니다 (403 Forbidden)" };
      }
      throw error;
    }
  }
  return await client.getProjects({ include_archived: args.include_archived });
}
