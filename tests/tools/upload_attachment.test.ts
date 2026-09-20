import { describe, it, expect, vi } from "vitest";
import {
  uploadAttachmentSchema,
  uploadAttachmentHandler,
} from "../../src/tools/upload_attachment.js";

describe("upload_attachment tool", () => {
  describe("Schema Validation", () => {
    it("should parse valid parameters with defaults", () => {
      const args = {
        filename: "test.txt",
        content: "hello world",
      };
      const parsed = uploadAttachmentSchema.parse(args);
      expect(parsed.filename).toBe("test.txt");
      expect(parsed.content).toBe("hello world");
      expect(parsed.content_type).toBe("application/octet-stream");
      expect(parsed.is_base64).toBe(false);
      expect(parsed.description).toBeUndefined();
    });

    it("should parse valid parameters with custom options", () => {
      const args = {
        filename: "screenshot.png",
        content: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        content_type: "image/png",
        is_base64: true,
        description: "Test Screenshot",
      };
      const parsed = uploadAttachmentSchema.parse(args);
      expect(parsed.filename).toBe("screenshot.png");
      expect(parsed.content_type).toBe("image/png");
      expect(parsed.is_base64).toBe(true);
      expect(parsed.description).toBe("Test Screenshot");
    });

    it("should reject missing filename", () => {
      const args = {
        content: "hello",
      };
      expect(() => uploadAttachmentSchema.parse(args as any)).toThrow();
    });

    it("should reject empty filename", () => {
      const args = {
        filename: "",
        content: "hello",
      };
      expect(() => uploadAttachmentSchema.parse(args)).toThrow();
    });

    it("should reject missing content", () => {
      const args = {
        filename: "test.txt",
      };
      expect(() => uploadAttachmentSchema.parse(args as any)).toThrow();
    });

    it("should reject empty content", () => {
      const args = {
        filename: "test.txt",
        content: "",
      };
      expect(() => uploadAttachmentSchema.parse(args)).toThrow();
    });

    it("should reject invalid is_base64 type", () => {
      const args = {
        filename: "test.txt",
        content: "hello",
        is_base64: "yes",
      };
      expect(() => uploadAttachmentSchema.parse(args as any)).toThrow();
    });
  });

  describe("Handler Logic", () => {
    it("should upload text content as UTF-8 buffer and return token", async () => {
      const mockClient = {
        uploadFile: vi.fn().mockResolvedValue({
          upload: { token: "7167.ed1074a1a2" },
        }),
      };

      const args = {
        filename: "test.txt",
        content: "Hello Redmine",
      };
      const parsed = uploadAttachmentSchema.parse(args);
      const result = await uploadAttachmentHandler(parsed, mockClient as any);

      expect(mockClient.uploadFile).toHaveBeenCalledWith(
        "test.txt",
        Buffer.from("Hello Redmine", "utf-8"),
        "application/octet-stream"
      );
      expect(result).toEqual({
        token: "7167.ed1074a1a2",
        filename: "test.txt",
        content_type: "application/octet-stream",
        message: expect.stringContaining("test.txt"),
      });
    });

    it("should upload base64 binary content and return token with description", async () => {
      const rawString = "fake-binary-data";
      const base64Content = Buffer.from(rawString).toString("base64");

      const mockClient = {
        uploadFile: vi.fn().mockResolvedValue({
          upload: { token: "8291.ab9283c847" },
        }),
      };

      const args = {
        filename: "image.png",
        content: base64Content,
        content_type: "image/png",
        is_base64: true,
        description: "Error Screenshot",
      };
      const parsed = uploadAttachmentSchema.parse(args);
      const result = await uploadAttachmentHandler(parsed, mockClient as any);

      expect(mockClient.uploadFile).toHaveBeenCalledWith(
        "image.png",
        Buffer.from(rawString),
        "image/png"
      );
      expect(result).toEqual({
        token: "8291.ab9283c847",
        filename: "image.png",
        content_type: "image/png",
        description: "Error Screenshot",
        message: expect.stringContaining("image.png"),
      });
    });

    it("should handle base64 content with data URI prefix", async () => {
      const rawString = "image-bytes";
      const base64Content = "data:image/png;base64," + Buffer.from(rawString).toString("base64");

      const mockClient = {
        uploadFile: vi.fn().mockResolvedValue({
          upload: { token: "9999.prefix123" },
        }),
      };

      const args = {
        filename: "logo.png",
        content: base64Content,
        content_type: "image/png",
        is_base64: true,
      };
      const parsed = uploadAttachmentSchema.parse(args);
      const result = await uploadAttachmentHandler(parsed, mockClient as any);

      expect(mockClient.uploadFile).toHaveBeenCalledWith(
        "logo.png",
        Buffer.from(rawString),
        "image/png"
      );
      expect(result.token).toBe("9999.prefix123");
    });

    it("should throw error if upload response does not contain a token", async () => {
      const mockClient = {
        uploadFile: vi.fn().mockResolvedValue({}),
      };

      const args = {
        filename: "empty.txt",
        content: "some content",
      };
      const parsed = uploadAttachmentSchema.parse(args);
      await expect(uploadAttachmentHandler(parsed, mockClient as any)).rejects.toThrow(
        "Failed to retrieve upload token from Redmine response"
      );
    });

    it("should return helpful error message on 401 Unauthorized", async () => {
      const error: any = new Error("Unauthorized");
      error.response = { status: 401 };
      const mockClient = {
        uploadFile: vi.fn().mockRejectedValue(error),
      };

      const args = {
        filename: "test.txt",
        content: "hello",
      };
      const parsed = uploadAttachmentSchema.parse(args);
      const result = await uploadAttachmentHandler(parsed, mockClient as any);

      expect(result).toEqual({ error: "인증에 실패했습니다. 유효한 API Key를 확인하세요." });
    });

    it("should return helpful error message on 422 Unprocessable Entity", async () => {
      const error: any = new Error("Unprocessable Entity");
      error.response = { status: 422, data: { errors: ["File is too large"] } };
      const mockClient = {
        uploadFile: vi.fn().mockRejectedValue(error),
      };

      const args = {
        filename: "large.bin",
        content: "huge-data",
      };
      const parsed = uploadAttachmentSchema.parse(args);
      const result = await uploadAttachmentHandler(parsed, mockClient as any);

      expect(result).toEqual({
        error: expect.stringContaining("파일 업로드 실패"),
      });
    });

    it("should re-throw unexpected server errors (500)", async () => {
      const error: any = new Error("Internal Server Error");
      error.response = { status: 500 };
      const mockClient = {
        uploadFile: vi.fn().mockRejectedValue(error),
      };

      const args = {
        filename: "test.txt",
        content: "hello",
      };
      const parsed = uploadAttachmentSchema.parse(args);
      await expect(uploadAttachmentHandler(parsed, mockClient as any)).rejects.toThrow(
        "Internal Server Error"
      );
    });
  });
});
