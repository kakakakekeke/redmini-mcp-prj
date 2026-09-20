import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";

export const updateIssueSchema = z.object({
  issue_id: z.number().describe("수정할 일감의 숫자 ID"),
  status_id: z.number().optional().describe("변경할 상태 ID (선택사항)"),
  notes: z.string().optional().describe("일감에 추가할 댓글 (선택사항)"),
  dry_run: z.boolean().optional().default(false).describe("실제 변경을 수행하지 않고 유효성만 검사할지 여부"),
});

export type UpdateIssueArgs = z.infer<typeof updateIssueSchema>;

export async function updateIssueHandler(args: UpdateIssueArgs, client: RedmineClient) {
  const updateData: any = {};
  if (args.status_id !== undefined) updateData.status_id = args.status_id;
  if (args.notes !== undefined) updateData.notes = args.notes;

  if (Object.keys(updateData).length === 0) {
    throw new Error("No updates provided");
  }

  if (args.status_id !== undefined) {
    const details = await client.getIssueDetails({ issue_id: args.issue_id });
    
    // Bypass allowed_statuses check if updating to current status
    if (details.issue.status?.id !== args.status_id) {
      const allowedStatuses = details.issue.allowed_statuses || [];
      const isAllowed = allowedStatuses.some((status: any) => status.id === args.status_id);
      
      if (!isAllowed) {
        throw new Error(`Status ID ${args.status_id} is not allowed for this issue`);
      }
    }
  }

  if (args.dry_run) {
    return {
      message: "Dry run successful. No changes were made.",
      updates: updateData
    };
  }

  try {
    await client.updateIssue(args.issue_id, updateData);
  } catch (error: any) {
    if (error.isAxiosError && error.response?.status === 422 && error.response?.data?.errors) {
      throw new Error(error.response.data.errors.join(", "));
    }
    throw error;
  }

  return {
    message: `Issue ${args.issue_id} updated successfully`
  };
}
