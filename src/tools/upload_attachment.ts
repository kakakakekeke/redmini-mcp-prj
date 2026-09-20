import { z } from "zod";
import { RedmineClient } from "../client/redmine.js";

export const uploadAttachmentSchema = z.object({
  filename: z
    .string()
    .min(1, "파일명은 필수입니다")
    .describe("업로드할 파일명 (예: screenshot.png, document.pdf)"),
  content: z
    .string()
    .min(1, "파일 내용은 비어 있을 수 없습니다")
    .describe("파일 내용 (일반 텍스트 또는 Base64로 인코딩된 문자열)"),
  content_type: z
    .string()
    .default("application/octet-stream")
    .describe("파일의 MIME 타입 (기본값: 'application/octet-stream')"),
  is_base64: z
    .boolean()
    .default(false)
    .describe(
      "content가 Base64 인코딩인지 여부 (기본값: false, 텍스트 파일인 경우 false, 바이너리/이미지인 경우 true)"
    ),
  description: z
    .string()
    .optional()
    .describe("첨부 파일에 대한 설명 (선택 사항)"),
});

export type UploadAttachmentArgs = z.infer<typeof uploadAttachmentSchema>;

export async function uploadAttachmentHandler(
  args: UploadAttachmentArgs,
  client: RedmineClient
) {
  try {
    let dataBuffer: Buffer;

    if (args.is_base64) {
      let base64Data = args.content;
      // Strip data URL prefix if present (e.g. data:image/png;base64,...)
      if (base64Data.startsWith("data:") && base64Data.includes(";base64,")) {
        base64Data = base64Data.split(";base64,")[1];
      }
      dataBuffer = Buffer.from(base64Data, "base64");
    } else {
      dataBuffer = Buffer.from(args.content, "utf-8");
    }

    const response = await client.uploadFile(
      args.filename,
      dataBuffer,
      args.content_type
    );

    const token = response?.upload?.token ?? response?.token;

    if (!token) {
      throw new Error("Failed to retrieve upload token from Redmine response");
    }

    const result: {
      token: string;
      filename: string;
      content_type: string;
      description?: string;
      message: string;
    } = {
      token,
      filename: args.filename,
      content_type: args.content_type,
      ...(args.description ? { description: args.description } : {}),
      message: `File '${args.filename}' uploaded successfully. Token: ${token}`,
    };

    return result;
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      return { error: "인증에 실패했습니다. 유효한 API Key를 확인하세요." };
    }
    if (error.response && error.response.status === 422) {
      return {
        error: `파일 업로드 실패: ${JSON.stringify(error.response.data)}`,
      };
    }
    throw error;
  }
}
