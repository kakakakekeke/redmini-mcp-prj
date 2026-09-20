import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";

export const createOrUpdateWikiSchema = z.object({
  project_id: z
    .string()
    .trim()
    .min(1, "Project ID is required")
    .max(100, "Project ID too long")
    .regex(/^[a-z0-9\-_]+$/, "Invalid project_id")
    .describe("프로젝트 식별자(ID 또는 슬러그 identifier)"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(100, "Title too long")
    .regex(
      /^[^/\\?#%\x00-\x1f]+$/,
      "Title cannot contain slashes, question marks, hashes, percent signs, or control characters"
    )
    .refine(
      (val) => val !== "." && val !== ".." && !val.startsWith("../") && !val.startsWith("./"),
      {
        message: "Invalid wiki title: cannot be a relative path traversal sequence ('.' or '..')",
      }
    )
    .describe("위키 페이지 제목 (예: 'Home', 'API-Guide')"),
  text: z
    .string()
    .trim()
    .min(1, "Text cannot be empty")
    .max(65535, "Text too long")
    .describe("위키 페이지 본문 내용 (Markdown 또는 Textile 포맷)"),
  comments: z
    .string()
    .trim()
    .max(255, "Comments too long")
    .optional()
    .describe("변경/등록 사유 요약 코멘트 (선택사항)"),
  version: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("수정 시 충돌 방지를 위한 기존 위키 버전 번호 (선택사항)"),
  parent_title: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[^/\\?#%\x00-\x1f]+$/, "Parent title cannot contain invalid path characters")
    .optional()
    .describe("상위 위키 페이지 제목 (계층 구조 생성 시 사용, 선택사항)"),
  dry_run: z
    .boolean()
    .default(true)
    .describe(
      "기본값이 true이며 안전을 위해 미리보기를 제공합니다. 실제 등록/수정을 원할 경우에만 명시적으로 false로 전달하세요."
    ),
});

export type CreateOrUpdateWikiArgs = z.infer<typeof createOrUpdateWikiSchema>;

export async function createOrUpdateWikiHandler(
  args: CreateOrUpdateWikiArgs,
  client: RedmineClient
) {
  // [보안 가드]: Fail-Close 원칙 적용. args.dry_run이 명시적으로 false가 아닌 모든 경우(undefined, null 포함) preview 반환
  if (args.dry_run !== false) {
    const wiki_page: Record<string, unknown> = {
      text: args.text,
    };
    if (args.comments !== undefined) wiki_page.comments = args.comments;
    if (args.version !== undefined) wiki_page.version = args.version;
    if (args.parent_title !== undefined) wiki_page.parent_title = args.parent_title;

    return {
      message:
        "dry_run is true. Wiki page will not be created or updated. Please confirm with user.",
      dry_run: true,
      payload: {
        project_id: args.project_id,
        title: args.title,
        wiki_page,
      },
    };
  }

  try {
    return await client.createOrUpdateWiki({
      project_id: args.project_id,
      title: args.title,
      text: args.text,
      comments: args.comments,
      version: args.version,
      parent_title: args.parent_title,
    });
  } catch (error: any) {
    const status = error?.response?.status;
    const errors = error?.response?.data?.errors;
    const detail = errors
      ? Array.isArray(errors)
        ? errors.join(", ")
        : typeof errors === "object"
        ? JSON.stringify(errors)
        : String(errors)
      : null;

    if (status === 401) {
      throw new Error("Authentication failed: Invalid Redmine API key or unauthorized (status 401)");
    }
    if (status === 403) {
      throw new Error("Permission denied: Insufficient permissions to create or update wiki in this project (status 403)");
    }
    if (status === 404) {
      throw new Error(`Wiki or project not found: ${detail || "Not found"} (status 404)`);
    }
    if (status === 422) {
      throw new Error(`Wiki validation error: ${detail || "Validation failed or version conflict"} (status 422)`);
    }

    // [민감정보 보호]: 원시 AxiosError(headers 내 X-Redmine-API-Key 포함)를 던지지 않고 정제된 에러만 노출
    const safeMessage = detail || error?.message || "Wiki operation failed";
    throw new Error(`Redmine Wiki request failed: ${safeMessage}${status ? ` (status ${status})` : ""}`);
  }
}
