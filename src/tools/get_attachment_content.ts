import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";

export const getAttachmentContentSchema = z.object({
  attachment_id: z
    .number()
    .int("첨부파일 ID는 정수여야 합니다")
    .positive("첨부파일 ID는 1 이상의 양수여야 합니다")
    .describe("다운로드 및 본문 내용을 조회할 첨부파일의 고유 숫자 ID (필수)"),
  max_bytes: z
    .number()
    .int("max_bytes는 정수여야 합니다")
    .positive("max_bytes는 1 이상의 양수여야 합니다")
    .default(500000)
    .describe(
      "반환할 최대 바이트 수 (기본값: 500,000바이트 = 약 500KB). 초과 시 데이터가 Truncation 처리됩니다."
    ),
});

export type GetAttachmentContentArgs = z.infer<typeof getAttachmentContentSchema>;

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/x-yaml",
  "application/yaml",
  "application/x-sh",
  "application/sql",
  "application/csv",
  "application/xhtml+xml",
]);

const TEXT_EXTENSIONS = new Set([
  "txt", "log", "md", "markdown", "csv", "tsv", "json", "xml", "yaml", "yml",
  "py", "ts", "js", "mjs", "cjs", "jsx", "tsx", "sh", "bash", "zsh", "fish",
  "c", "cpp", "cc", "h", "hpp", "cs", "java", "go", "rs", "rb", "php",
  "html", "htm", "css", "scss", "sass", "less", "sql", "ini", "cfg", "conf",
  "env", "properties", "toml", "diff", "patch", "svg"
]);

function isTextFile(contentType: string, filename: string): boolean {
  const mime = (contentType || "").toLowerCase();
  if (mime.startsWith("text/")) {
    return true;
  }
  if (TEXT_MIME_TYPES.has(mime)) {
    return true;
  }

  const extMatch = filename.toLowerCase().match(/\.([a-z0-9_-]+)$/);
  if (extMatch) {
    const ext = extMatch[1];
    if (TEXT_EXTENSIONS.has(ext)) {
      return true;
    }
  }

  return false;
}

export async function getAttachmentContentHandler(
  args: GetAttachmentContentArgs,
  client: RedmineClient
) {
  try {
    const metaResponse = await client.getAttachment(args.attachment_id);
    const attachment = metaResponse?.attachment ?? metaResponse;

    if (!attachment || !attachment.filename) {
      throw new Error(
        `Failed to retrieve valid attachment metadata for ID: ${args.attachment_id}`
      );
    }

    const filename = attachment.filename;
    const contentType = attachment.content_type || "application/octet-stream";

    const rawData = await client.downloadAttachment(args.attachment_id, filename);
    const buffer = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);

    const maxBytes = args.max_bytes;
    const truncated = buffer.length > maxBytes;
    const processedBuffer = truncated ? buffer.subarray(0, maxBytes) : buffer;

    const isText = isTextFile(contentType, filename);
    const is_base64 = !isText;
    const content = isText
      ? processedBuffer.toString("utf-8")
      : processedBuffer.toString("base64");

    const result: {
      attachment_id: number;
      filename: string;
      content_type: string;
      filesize: number;
      is_base64: boolean;
      content: string;
      truncated: boolean;
      description?: string;
    } = {
      attachment_id: args.attachment_id,
      filename,
      content_type: contentType,
      filesize: attachment.filesize ?? buffer.length,
      ...(attachment.description ? { description: attachment.description } : {}),
      is_base64,
      content,
      truncated,
    };

    return result;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return {
        error: `첨부파일(ID: ${args.attachment_id})을 찾을 수 없거나 접근 권한이 없습니다.`,
      };
    }
    if (error.response && error.response.status === 401) {
      return { error: "인증에 실패했습니다. 유효한 API Key를 확인하세요." };
    }
    if (error.response && error.response.status === 403) {
      return {
        error: `첨부파일(ID: ${args.attachment_id})에 접근할 권한이 없습니다.`,
      };
    }
    throw error;
  }
}
