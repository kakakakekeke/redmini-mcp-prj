import { z } from 'zod';
import { RedmineClient } from '../client/redmine.js';

export const getProjectsSchema = z.object({
  include_archived: z.boolean().default(false).describe("보관(Archived)된 프로젝트를 결과에 포함할지 여부 (기본값: false)"),
});

export type GetProjectsArgs = z.infer<typeof getProjectsSchema>;

export async function getProjectsHandler(args: GetProjectsArgs, client: RedmineClient) {
  return await client.getProjects({ include_archived: args.include_archived });
}
