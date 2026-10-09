import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  manageProjectFilesSchema,
  manageProjectFilesHandler,
} from "../../src/tools/manage_project_files.js";

const VALID_TOKEN = "7167.ed1074a1a20e4b2f";

function axiosError(status: number, data: any = {}) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });
}

describe("manage_project_files tool", () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getProjectFiles: vi.fn(),
      addProjectFile: vi.fn(),
      getProjectVersions: vi.fn(),
      getProject: vi.fn().mockResolvedValue({ project: { id: 77, identifier: "unknown-ident" } }),
      getProjects: vi.fn().mockResolvedValue({
        projects: [{ id: 5, name: "My Project", identifier: "my-project" }],
      }),
      getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
      getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
      getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
      getUsers: vi.fn().mockResolvedValue({ users: [] }),
    };
  });

  describe("Schema Validation", () => {
    it("should validate list parameters and default dry_run to true", () => {
      const parsed = manageProjectFilesSchema.parse({ action: "list", project_id: "my-project" });
      expect(parsed.action).toBe("list");
      expect(parsed.project_id).toBe("my-project");
      expect(parsed.dry_run).toBe(true);
    });

    it("should validate add parameters", () => {
      const parsed = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        filename: "release-1.0.zip",
        description: "v1.0 release package",
        version_id: 3,
        dry_run: false,
      });
      expect(parsed.token).toBe(VALID_TOKEN);
      expect(parsed.version_id).toBe(3);
      expect(parsed.dry_run).toBe(false);
    });

    it("should reject unknown action", () => {
      expect(() => manageProjectFilesSchema.parse({ action: "delete", project_id: 1 })).toThrow();
    });

    it("should require project_id", () => {
      expect(() => manageProjectFilesSchema.parse({ action: "list" })).toThrow();
    });

    it("should reject project_id with path traversal characters (/ or \\ or ..)", () => {
      expect(() => manageProjectFilesSchema.parse({ action: "list", project_id: "../../users/current" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ action: "list", project_id: "foo/bar" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ action: "list", project_id: "foo\\bar" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ action: "list", project_id: ".." })).toThrow();
    });

    it("should reject empty, whitespace-only or overly long project_id", () => {
      expect(() => manageProjectFilesSchema.parse({ action: "list", project_id: "" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ action: "list", project_id: "   " })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ action: "list", project_id: "a".repeat(256) })).toThrow();
    });

    it("should reject non-positive numeric project_id", () => {
      expect(() => manageProjectFilesSchema.parse({ action: "list", project_id: 0 })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ action: "list", project_id: -1 })).toThrow();
    });

    it("should reject malformed upload tokens", () => {
      const base = { action: "add", project_id: 5 };
      expect(() => manageProjectFilesSchema.parse({ ...base, token: "" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ ...base, token: "abc" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ ...base, token: "1.abc/../x" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ ...base, token: `1.${"a".repeat(300)}` })).toThrow();
    });

    it("should reject filenames with path separators or traversal", () => {
      const base = { action: "add", project_id: 5, token: VALID_TOKEN };
      expect(() => manageProjectFilesSchema.parse({ ...base, filename: "../evil.zip" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ ...base, filename: "a/b.zip" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ ...base, filename: "a\\b.zip" })).toThrow();
    });

    it("should reject control and bidi override characters in filename", () => {
      const base = { action: "add", project_id: 5, token: VALID_TOKEN };
      expect(() => manageProjectFilesSchema.parse({ ...base, filename: "invoice\u202Eexe.pdf" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ ...base, filename: "a\nb.txt" })).toThrow();
      expect(() => manageProjectFilesSchema.parse({ ...base, filename: "a\u0000b.txt" })).toThrow();
    });

    it("should reject bidi override characters in description but allow newlines", () => {
      const base = { action: "add", project_id: 5, token: VALID_TOKEN };
      expect(() => manageProjectFilesSchema.parse({ ...base, description: "x\u202Ey" })).toThrow();
      expect(manageProjectFilesSchema.parse({ ...base, description: "line1\nline2" }).description).toBe("line1\nline2");
    });

    it("should reject description over 255 characters", () => {
      expect(() =>
        manageProjectFilesSchema.parse({
          action: "add",
          project_id: 5,
          token: VALID_TOKEN,
          description: "x".repeat(256),
        })
      ).toThrow();
    });

    it("should reject non-positive version_id", () => {
      expect(() =>
        manageProjectFilesSchema.parse({ action: "add", project_id: 5, token: VALID_TOKEN, version_id: 0 })
      ).toThrow();
    });
  });

  describe("list action", () => {
    it("should call getProjectFiles with numeric project_id", async () => {
      const files = {
        files: [
          {
            id: 1,
            filename: "release.zip",
            filesize: 1024,
            description: "release",
            author: { id: 1, name: "Admin" },
            version: { id: 3, name: "v1.0" },
            digest: "abc",
            downloads: 2,
            created_on: "2026-10-01T00:00:00Z",
          },
        ],
      };
      mockClient.getProjectFiles.mockResolvedValue(files);
      const args = manageProjectFilesSchema.parse({ action: "list", project_id: 5 });
      const result = await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.getProjectFiles).toHaveBeenCalledWith(5);
      expect(result).toEqual(files);
    });

    it("should resolve project name to id via SmartNameResolver", async () => {
      mockClient.getProjectFiles.mockResolvedValue({ files: [] });
      const args = manageProjectFilesSchema.parse({ action: "list", project_id: "My Project" });
      await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.getProjectFiles).toHaveBeenCalledWith(5);
    });

    it("should reuse the resolver cached on the client", async () => {
      mockClient.getProjectFiles.mockResolvedValue({ files: [] });
      const args = manageProjectFilesSchema.parse({ action: "list", project_id: "my-project" });
      await manageProjectFilesHandler(args, mockClient);
      await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.getProjects).toHaveBeenCalledTimes(1);
    });

    it("should pass unresolved identifiers through unchanged", async () => {
      mockClient.getProjectFiles.mockResolvedValue({ files: [] });
      const args = manageProjectFilesSchema.parse({ action: "list", project_id: "unknown-ident" });
      await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.getProjectFiles).toHaveBeenCalledWith("unknown-ident");
    });

    it("should treat numeric strings as ids without resolving", async () => {
      mockClient.getProjectFiles.mockResolvedValue({ files: [] });
      const args = manageProjectFilesSchema.parse({ action: "list", project_id: "42" });
      await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.getProjects).not.toHaveBeenCalled();
      expect(mockClient.getProjectFiles).toHaveBeenCalledWith("42");
    });

    it("should return a friendly error on 404", async () => {
      mockClient.getProjectFiles.mockRejectedValue(axiosError(404));
      const args = manageProjectFilesSchema.parse({ action: "list", project_id: 99 });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toContain("99");
    });

    it("should return a friendly error on 403", async () => {
      mockClient.getProjectFiles.mockRejectedValue(axiosError(403));
      const args = manageProjectFilesSchema.parse({ action: "list", project_id: 5 });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toContain("403");
    });

    it("should rethrow unexpected errors", async () => {
      mockClient.getProjectFiles.mockRejectedValue(new Error("network down"));
      const args = manageProjectFilesSchema.parse({ action: "list", project_id: 5 });
      await expect(manageProjectFilesHandler(args, mockClient)).rejects.toThrow("network down");
    });
  });

  describe("add action", () => {
    it("should require token", async () => {
      const args = manageProjectFilesSchema.parse({ action: "add", project_id: 5 });
      await expect(manageProjectFilesHandler(args, mockClient)).rejects.toThrow(/token/);
    });

    it("should reject when both version_id and version are given", async () => {
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        version_id: 3,
        version: "v1.0",
      });
      await expect(manageProjectFilesHandler(args, mockClient)).rejects.toThrow(/version/);
    });

    it("should return a dry-run preview by default without calling addProjectFile", async () => {
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        filename: "release.zip",
        description: "release",
        version_id: 3,
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.addProjectFile).not.toHaveBeenCalled();
      expect(result.dry_run).toBe(true);
      expect(result.payload).toEqual({
        action: "add",
        project_id: 5,
        file: { token: "7167.ed10…", filename: "release.zip", description: "release", version_id: 3 },
      });
      expect(JSON.stringify(result)).not.toContain(VALID_TOKEN);
    });

    it("should call addProjectFile when dry_run is false", async () => {
      mockClient.addProjectFile.mockResolvedValue({ message: "ok" });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        dry_run: false,
      });
      const result = await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.addProjectFile).toHaveBeenCalledWith(5, { token: VALID_TOKEN });
      expect(result).toEqual({ message: "ok" });
    });

    it("should resolve version name to version_id (case-insensitive)", async () => {
      mockClient.getProjectVersions.mockResolvedValue({
        versions: [
          { id: 3, name: "v1.0", project: { id: 5 } },
          { id: 4, name: "v2.0", project: { id: 5 } },
        ],
      });
      mockClient.addProjectFile.mockResolvedValue({ message: "ok" });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: "My Project",
        token: VALID_TOKEN,
        version: " V2.0 ",
        dry_run: false,
      });
      await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.getProjectVersions).toHaveBeenCalledWith(5);
      expect(mockClient.addProjectFile).toHaveBeenCalledWith(5, { token: VALID_TOKEN, version_id: 4 });
    });

    it("should resolve version name in dry-run preview too", async () => {
      mockClient.getProjectVersions.mockResolvedValue({
        versions: [{ id: 3, name: "v1.0", project: { id: 5 } }],
      });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        version: "v1.0",
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.payload.file.version_id).toBe(3);
      expect(mockClient.addProjectFile).not.toHaveBeenCalled();
    });

    it("should prefer the project's own version when a shared version has the same name", async () => {
      mockClient.getProjectVersions.mockResolvedValue({
        versions: [
          { id: 9, name: "v1.0", project: { id: 1 } },
          { id: 3, name: "v1.0", project: { id: 5 } },
        ],
      });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        version: "v1.0",
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.payload.file.version_id).toBe(3);
    });

    it("should error when version name is ambiguous", async () => {
      mockClient.getProjectVersions.mockResolvedValue({
        versions: [
          { id: 3, name: "v1.0", project: { id: 5 } },
          { id: 7, name: "V1.0", project: { id: 5 } },
        ],
      });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        version: "v1.0",
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toMatch(/ambiguous|version_id/i);
      expect(mockClient.addProjectFile).not.toHaveBeenCalled();
    });

    it("should error with available names when version is not found", async () => {
      mockClient.getProjectVersions.mockResolvedValue({
        versions: [{ id: 3, name: "v1.0", project: { id: 5 } }],
      });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        version: "v9.9",
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toContain("v9.9");
      expect(result.available_versions).toEqual(["v1.0"]);
    });

    it("should handle missing versions array gracefully", async () => {
      mockClient.getProjectVersions.mockResolvedValue({});
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        version: "v1.0",
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toContain("v1.0");
      expect(result.available_versions).toEqual([]);
    });

    it("should reject a version that only matches a shared (non-owned) version", async () => {
      mockClient.getProjectVersions.mockResolvedValue({
        versions: [{ id: 9, name: "v1.0", project: { id: 1 } }],
      });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        version: "v1.0",
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toMatch(/shared|소유/);
      expect(result.payload).toBeUndefined();
    });

    it("should look up the numeric project id when the identifier is not resolved", async () => {
      mockClient.getProjectVersions.mockResolvedValue({
        versions: [
          { id: 9, name: "v1.0", project: { id: 1 } },
          { id: 12, name: "v1.0", project: { id: 77 } },
        ],
      });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: "unknown-ident",
        token: VALID_TOKEN,
        version: "v1.0",
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.getProject).toHaveBeenCalledWith("unknown-ident", { include: "" });
      expect(result.payload.file.version_id).toBe(12);
    });

    it("should convert numeric-string project ids for version ownership checks", async () => {
      mockClient.getProjectVersions.mockResolvedValue({
        versions: [{ id: 3, name: "v1.0", project: { id: 42 } }],
      });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: "42",
        token: VALID_TOKEN,
        version: "v1.0",
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(mockClient.getProject).not.toHaveBeenCalled();
      expect(result.payload.file.version_id).toBe(3);
    });

    it("should mention version ownership when a 404 occurs with a version specified", async () => {
      mockClient.addProjectFile.mockRejectedValue(axiosError(404));
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        version_id: 3,
        dry_run: false,
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toMatch(/버전/);
    });

    it("should mention the files module on 403", async () => {
      mockClient.getProjectFiles.mockRejectedValue(axiosError(403));
      const args = manageProjectFilesSchema.parse({ action: "list", project_id: 5 });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toMatch(/모듈/);
    });

    it("should map 404/unexpected errors raised while resolving a version name", async () => {
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        version: "v1.0",
      });
      mockClient.getProjectVersions.mockRejectedValueOnce(axiosError(404));
      const r404: any = await manageProjectFilesHandler(args, mockClient);
      expect(r404.error).toContain("5");
      mockClient.getProjectVersions.mockRejectedValueOnce(new Error("network"));
      await expect(manageProjectFilesHandler(args, mockClient)).rejects.toThrow("network");
    });

    it("should fall back to all versions when the numeric project id cannot be determined", async () => {
      mockClient.getProject.mockResolvedValue({});
      mockClient.getProjectVersions.mockResolvedValue({
        versions: [{ id: 9, name: "v1.0", project: { id: 1 } }],
      });
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: "unknown-ident",
        token: VALID_TOKEN,
        version: "v1.0",
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.payload.file.version_id).toBe(9);
    });

    it("should convert 422 validation errors into a message", async () => {
      mockClient.addProjectFile.mockRejectedValue(axiosError(422, { errors: ["Version is invalid"] }));
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        dry_run: false,
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toContain("Version is invalid");
    });

    it("should return a friendly error on 400 (invalid or expired token)", async () => {
      mockClient.addProjectFile.mockRejectedValue(axiosError(400));
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        dry_run: false,
      });
      const result: any = await manageProjectFilesHandler(args, mockClient);
      expect(result.error).toMatch(/token/i);
    });

    it("should return a friendly error on 404 and 403", async () => {
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        dry_run: false,
      });
      mockClient.addProjectFile.mockRejectedValueOnce(axiosError(404));
      const r404: any = await manageProjectFilesHandler(args, mockClient);
      expect(r404.error).toBeDefined();
      expect(r404.error).not.toContain("모듈");
      mockClient.addProjectFile.mockRejectedValueOnce(axiosError(403));
      const r403: any = await manageProjectFilesHandler(args, mockClient);
      expect(r403.error).toContain("403");
    });

    it("should rethrow unexpected errors", async () => {
      mockClient.addProjectFile.mockRejectedValue(new Error("boom"));
      const args = manageProjectFilesSchema.parse({
        action: "add",
        project_id: 5,
        token: VALID_TOKEN,
        dry_run: false,
      });
      await expect(manageProjectFilesHandler(args, mockClient)).rejects.toThrow("boom");
    });
  });
});
