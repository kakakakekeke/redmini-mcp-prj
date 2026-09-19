import { z } from 'zod';
import { RedmineClient } from '../client/redmine.js';

export const searchIssuesSchema = z.object({
  project_id: z.string().regex(/^[a-z0-9\-]+$/, 'Invalid project_id').optional(),
  status_id: z.string().regex(/^(\d+|open|closed|\*)$/, 'Invalid status_id').optional(),
  assigned_to_id: z.string().regex(/^(\d+|me)$/, 'Invalid assigned_to_id').optional(),
  query: z.string().max(100, 'Query too long').optional(),
  limit: z.number().int().min(1).max(50, 'Limit must be at most 50').default(10),
});

export type SearchIssuesArgs = z.infer<typeof searchIssuesSchema>;

export async function searchIssuesHandler(args: SearchIssuesArgs, client: RedmineClient) {
  const result = await client.getIssues({
    project_id: args.project_id,
    status_id: args.status_id,
    assigned_to_id: args.assigned_to_id,
    query: args.query,
    limit: args.limit,
  });
  return result;
}
