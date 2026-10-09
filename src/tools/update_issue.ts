import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";
import {
  CustomFieldResolution,
  customFieldsInputSchema,
  formatRedmineValidationError,
  resolveIssueCustomFields,
} from "../utils/issue_custom_fields.js";

export const updateIssueSchema = z.object({
  issue_id: z.number().describe("수정할 일감의 숫자 ID"),
  status_id: z.number().optional().describe("변경할 상태 ID (선택사항)"),
  notes: z.string().optional().describe("일감에 추가할 댓글 (선택사항)"),
  custom_fields: customFieldsInputSchema.optional(),
  dry_run: z.boolean().optional().default(true).describe("실제 변경을 수행하지 않고 유효성만 검사할지 여부 (기본값: true)"),
});

export type UpdateIssueArgs = z.infer<typeof updateIssueSchema>;

export async function updateIssueHandler(args: UpdateIssueArgs, client: RedmineClient) {
  const updateData: any = {};
  if (args.status_id !== undefined) updateData.status_id = args.status_id;
  if (args.notes !== undefined) updateData.notes = args.notes;

  if (Object.keys(updateData).length === 0 && args.custom_fields === undefined) {
    throw new Error("No updates provided");
  }

  // 상태 검증과 커스텀 필드 해석(프로젝트·트래커)이 같은 일감 상세를 쓰므로 한 번만 조회한다.
  const details =
    args.status_id !== undefined || args.custom_fields !== undefined
      ? await client.getIssueDetails({ issue_id: args.issue_id })
      : undefined;

  if (args.status_id !== undefined) {
    // Bypass allowed_statuses check if updating to current status
    if (details.issue.status?.id !== args.status_id) {
      const allowedStatuses = details.issue.allowed_statuses || [];
      const isAllowed = allowedStatuses.some((status: any) => status.id === args.status_id);

      if (!isAllowed) {
        throw new Error(`Status ID ${args.status_id} is not allowed for this issue`);
      }
    }
  }

  let customFields: CustomFieldResolution | undefined;
  if (args.custom_fields !== undefined) {
    const projectId = details?.issue?.project?.id;
    if (typeof projectId !== "number" || !Number.isSafeInteger(projectId) || projectId <= 0) {
      throw new Error(`Cannot determine the project of issue ${args.issue_id} to resolve custom fields.`);
    }
    const trackerId = details.issue.tracker?.id;
    // 일감 상세의 custom_fields 는 이 일감(트래커·권한)에서 실제로 쓸 수 있는 필드 목록이다. 비관리자도 받을 수 있다.
    const issueFields = details.issue.custom_fields;
    customFields = await resolveIssueCustomFields(client, projectId, args.custom_fields, {
      trackerId: typeof trackerId === "number" ? trackerId : undefined,
      applicableFieldIds: Array.isArray(issueFields)
        ? issueFields.map((f: any) => f?.id).filter((id: unknown): id is number => typeof id === "number")
        : undefined,
    });
    if (customFields.errors.length > 0) {
      return {
        error: `Custom field values are invalid. Issue ${args.issue_id} was not updated.`,
        dry_run: args.dry_run,
        custom_field_errors: customFields.errors,
        custom_field_validation: customFields.validation,
      };
    }
    updateData.custom_fields = customFields.payload;
  }

  if (args.dry_run) {
    return {
      message: "Dry run successful. No changes were made.",
      updates: updateData,
      ...(customFields ? { custom_fields: customFields.fields, custom_field_validation: customFields.validation } : {}),
    };
  }

  try {
    await client.updateIssue(args.issue_id, updateData);
  } catch (error: any) {
    const message = formatRedmineValidationError(error);
    if (message !== undefined) throw new Error(message);
    throw error;
  }

  return {
    message: `Issue ${args.issue_id} updated successfully`
  };
}
