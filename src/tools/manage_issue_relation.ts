import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";

export const manageIssueRelationSchema = z.object({
  action: z
    .enum(["list", "create", "delete"])
    .describe("수행할 작업: 'list' (관계 목록 조회), 'create' (관계 생성), 'delete' (관계 삭제)"),
  issue_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("일감 ID (action이 'list' 또는 'create'일 때 필수)"),
  issue_to_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("대상 일감 ID (action이 'create'일 때 필수)"),
  relation_type: z
    .enum([
      "relates",
      "duplicates",
      "duplicated",
      "blocks",
      "blocked",
      "precedes",
      "follows",
      "copied_to",
      "copied_from",
    ])
    .optional()
    .describe(
      "관계 유형 ('relates', 'duplicates', 'duplicated', 'blocks', 'blocked', 'precedes', 'follows', 'copied_to', 'copied_from') (action이 'create'일 때 필수)"
    ),
  delay: z
    .number()
    .int()
    .optional()
    .describe("지연 일수 (선행/후행 precedes/follows 관계 등에서 사용, 선택사항)"),
  relation_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("삭제할 일감 관계의 숫자 ID (action이 'delete'일 때 필수)"),
  dry_run: z
    .boolean()
    .default(true)
    .describe(
      "기본값이 true이며 안전을 위해 미리보기를 제공합니다. 실제 등록 또는 삭제를 수행할 경우에만 명시적으로 false로 전달하세요."
    ),
});

export type ManageIssueRelationArgs = z.infer<typeof manageIssueRelationSchema>;

export async function manageIssueRelationHandler(
  args: ManageIssueRelationArgs,
  client: RedmineClient
) {
  if (args.action === "list") {
    if (!args.issue_id) {
      throw new Error("issue_id is required for list action");
    }
    return await client.getIssueRelations(args.issue_id);
  }

  if (args.action === "create") {
    if (!args.issue_id || !args.issue_to_id || !args.relation_type) {
      throw new Error(
        "issue_id, issue_to_id, and relation_type are required for create action"
      );
    }

    if (args.dry_run !== false) {
      const relation: Record<string, unknown> = {
        issue_to_id: args.issue_to_id,
        relation_type: args.relation_type,
      };
      if (args.delay !== undefined) {
        relation.delay = args.delay;
      }

      return {
        message:
          "dry_run is true. Issue relation will not be created. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "create",
          issue_id: args.issue_id,
          relation,
        },
      };
    }

    try {
      const relationData: {
        issue_to_id: number;
        relation_type: string;
        delay?: number;
      } = {
        issue_to_id: args.issue_to_id,
        relation_type: args.relation_type,
      };
      if (args.delay !== undefined) {
        relationData.delay = args.delay;
      }
      return await client.createIssueRelation(args.issue_id, relationData);
    } catch (error: any) {
      if (
        error.isAxiosError &&
        error.response?.status === 422 &&
        error.response?.data?.errors
      ) {
        throw new Error(error.response.data.errors.join(", "));
      }
      throw error;
    }
  }

  if (args.action === "delete") {
    if (!args.relation_id) {
      throw new Error("relation_id is required for delete action");
    }

    if (args.dry_run !== false) {
      return {
        message:
          "dry_run is true. Issue relation will not be deleted. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "delete",
          relation_id: args.relation_id,
        },
      };
    }

    try {
      return await client.deleteIssueRelation(args.relation_id);
    } catch (error: any) {
      if (
        error.isAxiosError &&
        error.response?.status === 422 &&
        error.response?.data?.errors
      ) {
        throw new Error(error.response.data.errors.join(", "));
      }
      throw error;
    }
  }

  throw new Error(`Unsupported action: ${args.action}`);
}
