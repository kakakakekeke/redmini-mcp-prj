import { z } from 'zod';
import { RedmineClient } from '../client/redmine.js';

export const addIssueNoteSchema = z.object({
  issue_id: z.number().int().positive().describe("댓글을 추가할 Redmine 일감(이슈)의 고유 숫자 ID"),
  notes: z.string().trim().min(1, "댓글 내용은 공백일 수 없습니다").max(5000).describe("추가할 댓글 내용 (마크다운 또는 텍스타일 포맷)"),
  private_notes: z.boolean().default(false).describe("비공개 댓글 여부 (기본값: false)"),
});

export type AddIssueNoteArgs = z.infer<typeof addIssueNoteSchema>;

export async function addIssueNoteHandler(args: AddIssueNoteArgs, client: RedmineClient) {
  try {
    const result = await client.addIssueNote({
      issue_id: args.issue_id,
      notes: args.notes,
      private_notes: args.private_notes,
    });
    return result;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return { error: "해당 일감을 찾을 수 없습니다" };
    }
    if (error.response && error.response.status === 422) {
      return { error: `일감 업데이트 실패: ${JSON.stringify(error.response.data)}` };
    }
    throw error;
  }
}
