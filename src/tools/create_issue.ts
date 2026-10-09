import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";
import { projectIdentifierStringSchema } from "./get_projects.js";
import {
  customFieldsInputSchema,
  formatRedmineValidationError,
  resolveIssueCustomFields,
} from "../utils/issue_custom_fields.js";

export const createIssueSchema = z.object({
  project_id: projectIdentifierStringSchema.describe("프로젝트 식별자(ID 또는 슬러그 identifier)"),
  subject: z.string().max(255).describe("일감 제목 (최대 255자)"),
  description: z.string().max(65535).optional().describe("일감 설명/본문"),
  tracker: z.string().optional().describe("트래커 이름 (예: '결함', '기능'). Smart Name Resolver 자동 변환"),
  tracker_id: z.number().int().optional().describe("트래커 숫자 ID"),
  status: z.string().optional().describe("상태 이름"),
  status_id: z.number().int().optional().describe("상태 숫자 ID"),
  priority: z.string().optional().describe("우선순위 이름"),
  priority_id: z.number().int().optional().describe("우선순위 숫자 ID"),
  assigned_to_id: z.number().int().optional().describe("담당자 사용자 숫자 ID"),
  assignee: z.string().optional().describe("담당자 이름 또는 로그인 아이디. Smart Name Resolver 자동 변환"),
  category: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .describe("일감 범주 이름 (예: 'UI'). 해당 프로젝트의 범주 목록에서 category_id 로 자동 변환 (get_projects include=['issue_categories'] 로 확인)"),
  category_id: z.number().int().positive().optional().describe("일감 범주 숫자 ID (category 보다 우선)"),
  custom_fields: customFieldsInputSchema.optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid due_date").optional().describe("만료일 (YYYY-MM-DD)"),
  estimated_hours: z.number().positive().optional().describe("추정 시간"),
  uploads: z
    .array(
      z.object({
        token: z.string().describe("첨부파일 업로드 토큰"),
        filename: z.string().optional().describe("파일명"),
        description: z.string().optional().describe("첨부파일 설명"),
        content_type: z.string().optional().describe("파일의 MIME 타입"),
      })
    )
    .optional()
    .describe("첨부파일 목록 (upload_attachment에서 발급받은 token 포함)"),
  dry_run: z.boolean().default(true).describe("기본값이 true이며 안전을 위해 미리보기를 제공합니다. 실제 생성을 원할 경우에만 명시적으로 false로 전달하세요."),
});

export type CreateIssueArgs = z.infer<typeof createIssueSchema>;

async function resolveCategoryId(client: RedmineClient, projectId: string, name: string): Promise<number> {
  let data: any;
  try {
    data = await client.getIssueCategories(projectId);
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 403 || status === 404) {
      throw new Error(
        `Cannot resolve category "${name}": project not found or no permission (HTTP ${status}). Use category_id instead.`
      );
    }
    throw error;
  }
  const categories = (Array.isArray(data?.issue_categories) ? data.issue_categories : []).filter(
    (c: any) => c && typeof c.id === "number" && typeof c.name === "string"
  );
  const exact = categories.find((c: any) => c.name === name);
  if (exact) return exact.id;
  const key = name.toLowerCase();
  const matches = categories.filter((c: any) => c.name.toLowerCase() === key);
  if (matches.length === 1) return matches[0].id;
  // Redmine 이 돌려준 범주 이름은 에러 메시지에 넣지 않는다. 예외 경로는 프롬프트 인젝션 탐지(processToolResult)를
  // 거치지 않으므로, 목록은 탐지 레이어가 있는 get_projects 로 확인하게 안내한다. (DL-0033)
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous category name: ${name}. Multiple categories differ only by case; use category_id (see get_projects include=["issue_categories"]).`
    );
  }
  throw new Error(
    `Invalid category name: ${name}. Check available categories with get_projects (include=["issue_categories"]) or pass category_id.`
  );
}

export async function createIssueHandler(args: CreateIssueArgs, client: RedmineClient) {
  let tracker_id = args.tracker_id;
  let status_id = args.status_id;
  let priority_id = args.priority_id;
  let assigned_to_id = args.assigned_to_id;

  if (args.tracker || args.status || args.priority || args.assignee) {
    const resolver = new SmartNameResolver(client);
    await resolver.load();

    if (args.tracker && !tracker_id) {
      tracker_id = resolver.resolveTracker(args.tracker);
      if (tracker_id === undefined) throw new Error(`Invalid tracker name: ${args.tracker}`);
    }
    if (args.status && !status_id) {
      status_id = resolver.resolveStatus(args.status);
      if (status_id === undefined) throw new Error(`Invalid status name: ${args.status}`);
    }
    if (args.priority && !priority_id) {
      priority_id = resolver.resolvePriority(args.priority);
      if (priority_id === undefined) throw new Error(`Invalid priority name: ${args.priority}`);
    }
    if (args.assignee && !assigned_to_id) {
      assigned_to_id = resolver.resolveUser(args.assignee);
      if (assigned_to_id === undefined) throw new Error(`Invalid assignee name: ${args.assignee}`);
    }
  }

  // 범주는 프로젝트 단위 리소스라 전역 캐시(SmartNameResolver) 대신 해당 프로젝트의 범주 목록으로 해석한다. (DL-0033)
  let category_id = args.category_id;
  if (args.category && category_id === undefined) {
    category_id = await resolveCategoryId(client, args.project_id, args.category);
  }

  // 커스텀 필드: 프로젝트 필드 목록으로 이름 → ID 해석, 관리자 키면 값 사전 검증 (DL-0035)
  const customFields = args.custom_fields
    ? await resolveIssueCustomFields(client, args.project_id, args.custom_fields, { trackerId: tracker_id })
    : undefined;
  if (customFields && customFields.errors.length > 0) {
    return {
      error: "Custom field values are invalid. Issue was not created.",
      dry_run: args.dry_run,
      custom_field_errors: customFields.errors,
      custom_field_validation: customFields.validation,
    };
  }

  const payload: any = {
    project_id: args.project_id,
    subject: args.subject,
  };
  if (args.description !== undefined) payload.description = args.description;
  if (tracker_id !== undefined) payload.tracker_id = tracker_id;
  if (status_id !== undefined) payload.status_id = status_id;
  if (priority_id !== undefined) payload.priority_id = priority_id;
  if (assigned_to_id !== undefined) payload.assigned_to_id = assigned_to_id;
  if (category_id !== undefined) payload.category_id = category_id;
  if (args.due_date !== undefined) payload.due_date = args.due_date;
  if (args.estimated_hours !== undefined) payload.estimated_hours = args.estimated_hours;
  if (args.uploads !== undefined) payload.uploads = args.uploads;
  if (customFields) payload.custom_fields = customFields.payload;

  if (args.dry_run) {
    return {
      message: "[DRY_RUN 미리보기] dry_run is true. Issue will not be created. Please ask user to confirm.",
      dry_run: true,
      payload: { issue: payload },
      ...(customFields ? { custom_fields: customFields.fields, custom_field_validation: customFields.validation } : {}),
    };
  }

  let created: any;
  try {
    created = await client.createIssue({ issue: payload });
  } catch (error: any) {
    const message = formatRedmineValidationError(error);
    if (message !== undefined) throw new Error(message);
    throw error;
  }

  // Redmine 은 트래커·권한상 적용되지 않는 필드 값을 오류 없이 버린다. 응답에 없는 필드를 알려 준다. (DL-0035)
  const returned = created?.issue?.custom_fields;
  if (customFields && Array.isArray(returned)) {
    const returnedIds = new Set(returned.map((f: any) => f?.id));
    const notApplied = customFields.payload.map((f) => f.id).filter((id) => !returnedIds.has(id));
    if (notApplied.length > 0) {
      return {
        ...created,
        custom_fields_not_applied: notApplied,
        warning: "Some custom field values were not applied by Redmine (field not enabled for the tracker, not visible or not editable).",
      };
    }
  }
  return created;
}
