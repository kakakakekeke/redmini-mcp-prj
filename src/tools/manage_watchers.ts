import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";

export const manageWatchersSchema = z.object({
  action: z
    .enum(["list", "add", "remove"])
    .describe(
      "수행할 작업: 'list' (관찰자 목록 조회), 'add' (관찰자 추가), 'remove' (관찰자 제거)"
    ),
  issue_id: z
    .number()
    .int()
    .positive()
    .describe("대상 일감 ID (필수)"),
  user_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "관찰자로 추가하거나 제거할 사용자의 숫자 ID (action이 'add' 또는 'remove'일 때 필수)"
    ),
  dry_run: z
    .boolean()
    .default(true)
    .describe(
      "기본값이 true이며 안전을 위해 미리보기를 제공합니다. 실제 추가 또는 제거를 수행할 경우에만 명시적으로 false로 전달하세요."
    ),
});

export type ManageWatchersArgs = z.infer<typeof manageWatchersSchema>;

export async function manageWatchersHandler(
  args: ManageWatchersArgs,
  client: RedmineClient
) {
  if (args.action === "list") {
    return await client.getWatchers(args.issue_id);
  }

  if (args.action === "add") {
    if (!args.user_id) {
      throw new Error("user_id is required for add action");
    }

    if (args.dry_run !== false) {
      return {
        message:
          "dry_run is true. Watcher will not be added. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "add",
          issue_id: args.issue_id,
          user_id: args.user_id,
        },
      };
    }

    try {
      return await client.addWatcher(args.issue_id, args.user_id);
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

  if (args.action === "remove") {
    if (!args.user_id) {
      throw new Error("user_id is required for remove action");
    }

    if (args.dry_run !== false) {
      return {
        message:
          "dry_run is true. Watcher will not be removed. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "remove",
          issue_id: args.issue_id,
          user_id: args.user_id,
        },
      };
    }

    try {
      return await client.removeWatcher(args.issue_id, args.user_id);
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
