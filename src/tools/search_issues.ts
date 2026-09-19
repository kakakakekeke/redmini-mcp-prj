import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";

export const searchIssuesSchema = z.object({
  project_id: z.string().regex(/^[a-z0-9\-]+$/, "Invalid project_id").optional(),
  status_id: z.string().regex(/^(\d+|open|closed|\*)$/, "Invalid status_id").optional(),
  status: z.string().optional(),
  tracker_id: z.string().regex(/^\d+$/, "Invalid tracker_id").optional(),
  tracker: z.string().optional(),
  assigned_to_id: z.string().regex(/^(\d+|me)$/, "Invalid assigned_to_id").optional(),
  query: z.string().max(100, "Query too long").optional(),
  limit: z.number().int().min(1).max(50, "Limit must be at most 50").default(10),
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
