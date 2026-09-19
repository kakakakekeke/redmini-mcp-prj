import { z } from 'zod';
import { RedmineClient } from '../client/redmine.js';

export const getIssueDetailsSchema = z.object({
  issue_id: z.number().int('Invalid issue_id').positive('Invalid issue_id'),
  include_journals: z.boolean().default(true),
  include_attachments: z.boolean().default(false),
});

export type GetIssueDetailsArgs = z.infer<typeof getIssueDetailsSchema>;

export async function getIssueDetailsHandler(args: GetIssueDetailsArgs, client: RedmineClient) {
  try { const result = await client.getIssueDetails({
    issue_id: args.issue_id,
    include_journals: args.include_journals,
    include_attachments: args.include_attachments,
  });
  return result;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return { error: "해당 일감을 찾을 수 없습니다" };
    }
    throw error;
  }
}
