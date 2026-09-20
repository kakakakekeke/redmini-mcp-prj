import { describe, it, expect, vi } from "vitest";
import {
  getAttachmentContentSchema,
  getAttachmentContentHandler,
} from "../../src/tools/get_attachment_content.js";

describe("get_attachment_content tool", () => {
  describe("Schema Validation", () => {
    it("should parse valid parameters with defaults", () => {
      const args = {
        attachment_id: 42,
      };
      const parsed = getAttachmentContentSchema.parse(args);
      expect(parsed.attachment_id).toBe(42);
      expect(parsed.max_bytes).toBe(500000);
    });

    it("should parse valid parameters with custom max_bytes", () => {
      const args = {
        attachment_id: 100,
        max_bytes: 1024,
      };
      const parsed = getAttachmentContentSchema.parse(args);
      expect(parsed.attachment_id).toBe(100);
      expect(parsed.max_bytes).toBe(1024);
    });

    it("should reject missing attachment_id", () => {
      const args = {};
      expect(() => getAttachmentContentSchema.parse(args as any)).toThrow();
    });

    it("should reject zero or negative attachment_id", () => {
      expect(() =>
        getAttachmentContentSchema.parse({ attachment_id: 0 })
      ).toThrow();
      expect(() =>
        getAttachmentContentSchema.parse({ attachment_id: -5 })
      ).toThrow();
    });

    it("should reject non-integer attachment_id", () => {
      expect(() =>
        getAttachmentContentSchema.parse({ attachment_id: 3.14 })
      ).toThrow();
    });

    it("should reject non-positive max_bytes", () => {
      expect(() =>
        getAttachmentContentSchema.parse({ attachment_id: 1, max_bytes: 0 })
      ).toThrow();
      expect(() =>
        getAttachmentContentSchema.parse({ attachment_id: 1, max_bytes: -100 })
      ).toThrow();
    });
  });

  describe("Handler Logic", () => {
    it("should download text file as UTF-8 string with is_base64: false", async () => {
      const textContent = "Server log output: [INFO] System started.";
      const mockClient = {
        getAttachment: vi.fn().mockResolvedValue({
          attachment: {
            id: 101,
            filename: "system.log",
            filesize: Buffer.byteLength(textContent, "utf-8"),
            content_type: "text/plain",
            description: "Server startup logs",
            author: { id: 1, name: "Admin" },
            created_on: "2026-09-20T10:00:00Z",
          },
        }),
        downloadAttachment: vi
          .fn()
          .mockResolvedValue(Buffer.from(textContent, "utf-8")),
      };

      const parsed = getAttachmentContentSchema.parse({ attachment_id: 101 });
      const result = await getAttachmentContentHandler(parsed, mockClient as any);

      expect(mockClient.getAttachment).toHaveBeenCalledWith(101);
      expect(mockClient.downloadAttachment).toHaveBeenCalledWith(101, "system.log");
      expect(result).toEqual({
        attachment_id: 101,
        filename: "system.log",
        content_type: "text/plain",
        filesize: Buffer.byteLength(textContent, "utf-8"),
        description: "Server startup logs",
        is_base64: false,
        content: textContent,
        truncated: false,
      });
    });

    it("should download source code and markdown text files with is_base64: false", async () => {
      const jsonContent = JSON.stringify({ key: "value", number: 123 }, null, 2);
      const mockClient = {
        getAttachment: vi.fn().mockResolvedValue({
          attachment: {
            id: 102,
            filename: "config.json",
            filesize: Buffer.byteLength(jsonContent, "utf-8"),
            content_type: "application/json",
          },
        }),
        downloadAttachment: vi
          .fn()
          .mockResolvedValue(Buffer.from(jsonContent, "utf-8")),
      };

      const parsed = getAttachmentContentSchema.parse({ attachment_id: 102 });
      const result = await getAttachmentContentHandler(parsed, mockClient as any);

      expect(result.is_base64).toBe(false);
      expect(result.content).toBe(jsonContent);
      expect(result.truncated).toBe(false);
      expect(result.description).toBeUndefined();
    });

    it("should identify text file based on file extension when content_type is octet-stream", async () => {
      const pyContent = "def hello():\n    print('Hello world!')\n";
      const mockClient = {
        getAttachment: vi.fn().mockResolvedValue({
          attachment: {
            id: 103,
            filename: "script.py",
            filesize: Buffer.byteLength(pyContent, "utf-8"),
            content_type: "application/octet-stream",
          },
        }),
        downloadAttachment: vi
          .fn()
          .mockResolvedValue(Buffer.from(pyContent, "utf-8")),
      };

      const parsed = getAttachmentContentSchema.parse({ attachment_id: 103 });
      const result = await getAttachmentContentHandler(parsed, mockClient as any);

      expect(result.is_base64).toBe(false);
      expect(result.content).toBe(pyContent);
      expect(result.truncated).toBe(false);
    });

    it("should download binary file as Base64 string with is_base64: true", async () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const mockClient = {
        getAttachment: vi.fn().mockResolvedValue({
          attachment: {
            id: 201,
            filename: "screenshot.png",
            filesize: pngHeader.length,
            content_type: "image/png",
          },
        }),
        downloadAttachment: vi.fn().mockResolvedValue(pngHeader),
      };

      const parsed = getAttachmentContentSchema.parse({ attachment_id: 201 });
      const result = await getAttachmentContentHandler(parsed, mockClient as any);

      expect(mockClient.getAttachment).toHaveBeenCalledWith(201);
      expect(mockClient.downloadAttachment).toHaveBeenCalledWith(201, "screenshot.png");
      expect(result).toEqual({
        attachment_id: 201,
        filename: "screenshot.png",
        content_type: "image/png",
        filesize: pngHeader.length,
        is_base64: true,
        content: pngHeader.toString("base64"),
        truncated: false,
      });
    });

    it("should truncate content and set truncated: true when exceeding max_bytes", async () => {
      const longText = "A".repeat(1000);
      const maxBytes = 100;
      const mockClient = {
        getAttachment: vi.fn().mockResolvedValue({
          attachment: {
            id: 301,
            filename: "large.txt",
            filesize: 1000,
            content_type: "text/plain",
          },
        }),
        downloadAttachment: vi
          .fn()
          .mockResolvedValue(Buffer.from(longText, "utf-8")),
      };

      const parsed = getAttachmentContentSchema.parse({
        attachment_id: 301,
        max_bytes: maxBytes,
      });
      const result = await getAttachmentContentHandler(parsed, mockClient as any);

      expect(result.truncated).toBe(true);
      expect(result.content).toBe("A".repeat(100));
      expect(result.is_base64).toBe(false);
      expect(result.filesize).toBe(1000);
    });

    it("should truncate binary content when exceeding max_bytes", async () => {
      const rawBytes = Buffer.alloc(200, 0xff);
      const maxBytes = 50;
      const mockClient = {
        getAttachment: vi.fn().mockResolvedValue({
          attachment: {
            id: 302,
            filename: "binary.bin",
            filesize: 200,
            content_type: "application/octet-stream",
          },
        }),
        downloadAttachment: vi.fn().mockResolvedValue(rawBytes),
      };

      const parsed = getAttachmentContentSchema.parse({
        attachment_id: 302,
        max_bytes: maxBytes,
      });
      const result = await getAttachmentContentHandler(parsed, mockClient as any);

      expect(result.truncated).toBe(true);
      expect(result.is_base64).toBe(true);
      expect(result.content).toBe(Buffer.alloc(50, 0xff).toString("base64"));
    });

    it("should handle 404 Not Found error gracefully", async () => {
      const error404 = {
        response: {
          status: 404,
          data: "Not Found",
        },
      };
      const mockClient = {
        getAttachment: vi.fn().mockRejectedValue(error404),
        downloadAttachment: vi.fn(),
      };

      const parsed = getAttachmentContentSchema.parse({ attachment_id: 99999 });
      const result = await getAttachmentContentHandler(parsed, mockClient as any);

      expect(result).toEqual({
        error: "첨부파일(ID: 99999)을 찾을 수 없거나 접근 권한이 없습니다.",
      });
    });

    it("should handle 401 Unauthorized error gracefully", async () => {
      const error401 = {
        response: {
          status: 401,
          data: "Unauthorized",
        },
      };
      const mockClient = {
        getAttachment: vi.fn().mockRejectedValue(error401),
        downloadAttachment: vi.fn(),
      };

      const parsed = getAttachmentContentSchema.parse({ attachment_id: 100 });
      const result = await getAttachmentContentHandler(parsed, mockClient as any);

      expect(result).toEqual({
        error: "인증에 실패했습니다. 유효한 API Key를 확인하세요.",
      });
    });

    it("should handle 403 Forbidden error gracefully", async () => {
      const error403 = {
        response: {
          status: 403,
          data: "Forbidden",
        },
      };
      const mockClient = {
        getAttachment: vi.fn().mockRejectedValue(error403),
        downloadAttachment: vi.fn(),
      };

      const parsed = getAttachmentContentSchema.parse({ attachment_id: 100 });
      const result = await getAttachmentContentHandler(parsed, mockClient as any);

      expect(result).toEqual({
        error: "첨부파일(ID: 100)에 접근할 권한이 없습니다.",
      });
    });

    it("should rethrow unknown errors", async () => {
      const genericError = new Error("Network connection reset");
      const mockClient = {
        getAttachment: vi.fn().mockRejectedValue(genericError),
        downloadAttachment: vi.fn(),
      };

      const parsed = getAttachmentContentSchema.parse({ attachment_id: 100 });
      await expect(
        getAttachmentContentHandler(parsed, mockClient as any)
      ).rejects.toThrow("Network connection reset");
    });
  });
});
