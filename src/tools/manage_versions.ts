import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";

export const manageVersionsSchema = z.object({
  action: z
    .enum(["list", "get", "create", "update", "delete"])
    .describe(
      "수행할 작업: 'list' (프로젝트 버전 목록), 'get' (버전 단건 상세), 'create' (버전 생성), 'update' (버전 수정), 'delete' (버전 삭제)"
    ),
  project_id: z
    .union([z.string(), z.number()])
    .optional()
    .describe("프로젝트 식별자 (ID 또는 식별자 문자열) (action이 'list' 또는 'create'일 때 필수)"),
  version_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("버전 ID (action이 'get', 'update', 'delete'일 때 필수)"),
  name: z
    .string()
    .optional()
    .describe("버전/마일스톤 이름 (action이 'create'일 때 필수, 'update'일 때 선택)"),
  status: z
    .enum(["open", "locked", "closed"])
    .optional()
    .describe("버전 상태 ('open': 진행 중, 'locked': 신규 일감 배정 잠금, 'closed': 완료/종료)"),
  sharing: z
    .enum(["none", "descendants", "hierarchy", "tree", "system"])
    .optional()
    .describe("버전 공유 범위 ('none', 'descendants', 'hierarchy', 'tree', 'system')"),
  due_date: z
    .string()
    .optional()
    .describe("목표 완료일자 (YYYY-MM-DD 형식)"),
  description: z
    .string()
    .optional()
    .describe("버전/마일스톤 설명"),
  dry_run: z
    .boolean()
    .default(true)
    .describe(
      "기본값이 true이며 안전을 위해 미리보기를 제공합니다. 실제 생성, 수정, 삭제를 수행할 경우에만 명시적으로 false로 전달하세요."
    ),
});

export type ManageVersionsArgs = z.infer<typeof manageVersionsSchema>;

export async function manageVersionsHandler(
  args: ManageVersionsArgs,
  client: RedmineClient
) {
  if (args.action === "list") {
    if (!args.project_id) {
      throw new Error("project_id is required for list action");
    }
    return await client.getProjectVersions(args.project_id);
  }

  if (args.action === "get") {
    if (!args.version_id) {
      throw new Error("version_id is required for get action");
    }
    return await client.getVersionDetails(args.version_id);
  }

  if (args.action === "create") {
    if (!args.project_id || !args.name) {
      throw new Error("project_id and name are required for create action");
    }

    if (args.dry_run !== false) {
      const version: Record<string, unknown> = {
        name: args.name,
      };
      if (args.status !== undefined) {
        version.status = args.status;
      }
      if (args.sharing !== undefined) {
        version.sharing = args.sharing;
      }
      if (args.due_date !== undefined) {
        version.due_date = args.due_date;
      }
      if (args.description !== undefined) {
        version.description = args.description;
      }

      return {
        message:
          "dry_run is true. Version will not be created. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "create",
          project_id: args.project_id,
          version,
        },
      };
    }

    try {
      const versionData: {
        name: string;
        status?: "open" | "locked" | "closed";
        sharing?: "none" | "descendants" | "hierarchy" | "tree" | "system";
        due_date?: string;
        description?: string;
      } = {
        name: args.name,
      };
      if (args.status !== undefined) {
        versionData.status = args.status;
      }
      if (args.sharing !== undefined) {
        versionData.sharing = args.sharing;
      }
      if (args.due_date !== undefined) {
        versionData.due_date = args.due_date;
      }
      if (args.description !== undefined) {
        versionData.description = args.description;
      }

      return await client.createVersion(args.project_id, versionData);
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

  if (args.action === "update") {
    if (!args.version_id) {
      throw new Error("version_id is required for update action");
    }

    if (args.dry_run !== false) {
      const version: Record<string, unknown> = {};
      if (args.name !== undefined) {
        version.name = args.name;
      }
      if (args.status !== undefined) {
        version.status = args.status;
      }
      if (args.sharing !== undefined) {
        version.sharing = args.sharing;
      }
      if (args.due_date !== undefined) {
        version.due_date = args.due_date;
      }
      if (args.description !== undefined) {
        version.description = args.description;
      }

      return {
        message:
          "dry_run is true. Version will not be updated. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "update",
          version_id: args.version_id,
          version,
        },
      };
    }

    try {
      const versionData: {
        name?: string;
        status?: "open" | "locked" | "closed";
        sharing?: "none" | "descendants" | "hierarchy" | "tree" | "system";
        due_date?: string;
        description?: string;
      } = {};
      if (args.name !== undefined) {
        versionData.name = args.name;
      }
      if (args.status !== undefined) {
        versionData.status = args.status;
      }
      if (args.sharing !== undefined) {
        versionData.sharing = args.sharing;
      }
      if (args.due_date !== undefined) {
        versionData.due_date = args.due_date;
      }
      if (args.description !== undefined) {
        versionData.description = args.description;
      }

      return await client.updateVersion(args.version_id, versionData);
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
    if (!args.version_id) {
      throw new Error("version_id is required for delete action");
    }

    if (args.dry_run !== false) {
      return {
        message:
          "dry_run is true. Version will not be deleted. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "delete",
          version_id: args.version_id,
        },
      };
    }

    try {
      return await client.deleteVersion(args.version_id);
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

  throw new Error(`Unsupported action: ${(args as any).action}`);
}
