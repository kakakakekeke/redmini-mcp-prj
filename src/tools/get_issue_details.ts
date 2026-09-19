import { z } from 'zod';
import { RedmineClient } from '../client/redmine.js';

export const getIssueDetailsSchema = z.object({
  issue_id: z.number({ invalid_type_error: "Expected number" }).int('Invalid issue_id').positive('Invalid issue_id'),
  include_journals: z.boolean().default(true),
  include_attachments: z.boolean().default(false),
});

export type GetIssueDetailsArgs = z.infer<typeof getIssueDetailsSchema>;

export async function getIssueDetailsHandler(args: GetIssueDetailsArgs, client: RedmineClient) {
  const result = await client.getIssueDetails({
    issue_id: args.issue_id,
    include_journals: args.include_journals,
    include_attachments: args.include_attachments,
  });
  return result;
}
