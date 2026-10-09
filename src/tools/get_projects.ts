import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";

export const PROJECT_INCLUDE_OPTIONS = ["memberships", "issue_categories"] as const;
type ProjectInclude = (typeof PROJECT_INCLUDE_OPTIONS)[number];

/**
 * URL 경로에 들어가는 프로젝트 식별자(문자열) 공용 검증. 경로 조작 문자(/, \, ..)와 단독 '.' 를 거부한다.
 * get_projects 와 create_issue(범주 이름 해석) 가 함께 사용한다. (DL-0026, DL-0033)
 */
export const projectIdentifierStringSchema = z
  .string()
  .trim()
  .min(1, "프로젝트 ID 또는 식별자는 공백일 수 없습니다.")
  .max(255, "프로젝트 ID 또는 식별자는 255자를 초과할 수 없습니다.")
  .refine((val) => val !== "." && !val.includes("/") && !val.includes("\\") && !val.includes(".."), {
    message: "프로젝트 ID 또는 식별자에 경로 조작 문자(/, \\, ..)가 포함될 수 없습니다.",
  });

export const getProjectsSchema = z.object({
  project_id: z
    .union([
      projectIdentifierStringSchema,
      z.number().int().positive("프로젝트 ID는 양의 정수여야 합니다."),
    ])
    .optional()
    .describe(
      "특정 프로젝트의 상세 정보 및 일감 커스텀 필드(issue_custom_fields)를 조회하기 위한 프로젝트 ID, 식별자(identifier) 또는 프로젝트명 (선택 사항)"
    ),
  include_archived: z
    .boolean()
    .default(false)
    .describe("보관(Archived)된 프로젝트를 결과에 포함할지 여부 (기본값: false, project_id 미지정 시에만 적용)"),
  include: z
    .array(z.enum(PROJECT_INCLUDE_OPTIONS))
    .max(10)
    .optional()
    .describe(
      "project_id 지정 시 추가로 조회할 정보. 'memberships': 프로젝트 멤버(사용자/그룹 id·이름)와 역할 — 일감 담당자 후보 선택에 사용 (최대 1,000건, 초과 시 memberships_truncated), 'issue_categories': 일감 범주와 기본 담당자(assigned_to) — create_issue 의 category 지정에 사용"
    ),
});

export type GetProjectsArgs = z.infer<typeof getProjectsSchema>;

type IdName = { id: number; name?: string };

function pickIdName(value: unknown): IdName | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "number") return undefined;
  const out: IdName = { id: v.id };
  if (typeof v.name === "string") out.name = v.name;
  return out;
}

// 개인정보 최소화: 멤버십에서는 사용자·그룹·역할의 id/name 만 반환한다 (mail, login 등 제거). (DL-0033)
function sanitizeMembership(raw: unknown) {
  if (!raw || typeof raw !== "object") return undefined;
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== "number") return undefined;
  const out: Record<string, unknown> = { id: m.id };
  const user = pickIdName(m.user);
  if (user) out.user = user;
  const group = pickIdName(m.group);
  if (group) out.group = group;
  const roles = Array.isArray(m.roles) ? m.roles : [];
  out.roles = roles
    .map((r) => {
      const role: Record<string, unknown> | undefined = pickIdName(r);
      if (role && (r as Record<string, unknown>).inherited === true) role.inherited = true;
      return role;
    })
    .filter((r) => r !== undefined);
  return out;
}

function sanitizeCategory(raw: unknown) {
  const base: Record<string, unknown> | undefined = pickIdName(raw);
  if (!base) return undefined;
  const assignee = pickIdName((raw as Record<string, unknown>).assigned_to);
  if (assignee) base.assigned_to = assignee;
  return base;
}

function sectionError(error: any, label: string): string | undefined {
  const status = error?.response?.status;
  if (status === 403) return `${label} 조회할 권한이 없습니다 (403 Forbidden)`;
  if (status === 404) return `${label} 찾을 수 없습니다 (404 Not Found)`;
  return undefined;
}

async function attachIncludes(
  result: Record<string, any>,
  projectId: string | number,
  includes: Set<ProjectInclude>,
  client: RedmineClient
) {
  // 두 섹션은 서로 독립이므로 병렬로 조회한다.
  const tasks: Promise<void>[] = [];
  if (includes.has("memberships")) {
    tasks.push(
      (async () => {
        try {
          const data = await client.getProjectMemberships(projectId);
          const list = Array.isArray(data?.memberships) ? data.memberships : [];
          result.memberships = list.map(sanitizeMembership).filter((m: unknown) => m !== undefined);
          result.memberships_total_count = data?.total_count ?? result.memberships.length;
          if (data?.truncated) result.memberships_truncated = true;
        } catch (error: any) {
          const msg = sectionError(error, "프로젝트 멤버십을");
          if (!msg) throw error;
          result.memberships_error = msg;
        }
      })()
    );
  }
  if (includes.has("issue_categories")) {
    tasks.push(
      (async () => {
        try {
          const data = await client.getIssueCategories(projectId);
          const list = Array.isArray(data?.issue_categories) ? data.issue_categories : [];
          result.issue_categories = list.map(sanitizeCategory).filter((c: unknown) => c !== undefined);
          // project.issue_categories(id, name)와 중복되므로, assigned_to 까지 담은 최상위 목록만 남긴다.
          if (result.project && typeof result.project === "object") delete result.project.issue_categories;
        } catch (error: any) {
          const msg = sectionError(error, "일감 범주를");
          if (!msg) throw error;
          result.issue_categories_error = msg;
        }
      })()
    );
  }
  await Promise.all(tasks);
}

export async function getProjectsHandler(args: GetProjectsArgs, client: RedmineClient) {
  const includes = new Set<ProjectInclude>(args.include ?? []);

  if (args.project_id !== undefined && args.project_id !== null) {
    let resolvedId: string | number = args.project_id;
    if (typeof args.project_id === "string" && !/^\d+$/.test(args.project_id)) {
      const resolver = (client as any).resolver ?? new SmartNameResolver(client);
      (client as any).resolver = resolver;
      await resolver.load();
      const foundId = resolver.resolveProject(args.project_id);
      if (foundId !== undefined) {
        resolvedId = foundId;
      }
    }
    let result: any;
    try {
      result = await client.getProject(resolvedId);
      if (result && typeof result === "object" && result.user && typeof result.user === "object" && "api_key" in result.user) {
        result.user.api_key = "[REDACTED]";
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { error: `해당 프로젝트를 찾을 수 없습니다: ${args.project_id}` };
      }
      if (error.response?.status === 403) {
        return { error: "해당 프로젝트에 접근할 권한이 없습니다 (403 Forbidden)" };
      }
      throw error;
    }
    if (includes.size > 0 && result && typeof result === "object") {
      // 하위 API 는 사용자 입력이 아니라 Redmine 이 돌려준 숫자 ID 로 호출한다 (경로 조작 여지 최소화).
      const numericId = typeof result.project?.id === "number" ? result.project.id : resolvedId;
      await attachIncludes(result, numericId, includes, client);
    }
    return result;
  }

  if (includes.size > 0) {
    return { error: "include 옵션은 project_id를 지정한 경우에만 사용할 수 있습니다." };
  }
  return await client.getProjects({ include_archived: args.include_archived });
}
