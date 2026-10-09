import { describe, it, expect, vi } from "vitest";
import { getProjectsSchema, getProjectsHandler } from "../../src/tools/get_projects.js";

describe("get_projects tool", () => {
  describe("Schema Validation", () => {
    it("should validate valid parameters", () => {
      const args = { include_archived: true };
      expect(() => getProjectsSchema.parse(args)).not.toThrow();
    });

    it("should apply default include_archived of false if not provided", () => {
      const args = {};
      const parsed = getProjectsSchema.parse(args);
      expect(parsed.include_archived).toBe(false);
    });

    it("should accept project_id as string or number", () => {
      expect(getProjectsSchema.parse({ project_id: "my-project" }).project_id).toBe("my-project");
      expect(getProjectsSchema.parse({ project_id: 123 }).project_id).toBe(123);
      expect(getProjectsSchema.parse({}).project_id).toBeUndefined();
    });

    it("should reject project_id with path traversal characters (/ or \\ or ..)", () => {
      expect(() => getProjectsSchema.parse({ project_id: "../../users/current" })).toThrow();
      expect(() => getProjectsSchema.parse({ project_id: "foo/bar" })).toThrow();
      expect(() => getProjectsSchema.parse({ project_id: "foo\\bar" })).toThrow();
    });

    it("should reject empty or whitespace-only project_id", () => {
      expect(() => getProjectsSchema.parse({ project_id: "   " })).toThrow();
      expect(() => getProjectsSchema.parse({ project_id: "" })).toThrow();
    });

    it("should reject project_id exceeding 255 characters", () => {
      const longId = "a".repeat(256);
      expect(() => getProjectsSchema.parse({ project_id: longId })).toThrow();
    });

    it("should reject non-positive project_id numbers", () => {
      expect(() => getProjectsSchema.parse({ project_id: 0 })).toThrow();
      expect(() => getProjectsSchema.parse({ project_id: -5 })).toThrow();
    });
  });

  describe("Handler Logic", () => {
    it("should call RedmineClient with correct parameters when project_id is omitted", async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({ projects: [{ id: 1, name: "Test Project" }] })
      };
      
      const args = { include_archived: true };
      const parsedArgs = getProjectsSchema.parse(args);
      
      const result = await getProjectsHandler(parsedArgs, mockClient as any);
      
      expect(mockClient.getProjects).toHaveBeenCalledWith({
        include_archived: true
      });
      expect(result).toEqual({ projects: [{ id: 1, name: "Test Project" }] });
    });
    
    it("should handle default arguments when project_id is omitted", async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({ projects: [] })
      };
      
      const args = {};
      const parsedArgs = getProjectsSchema.parse(args);
      
      await getProjectsHandler(parsedArgs, mockClient as any);
      
      expect(mockClient.getProjects).toHaveBeenCalledWith({
        include_archived: false
      });
    });

    it("should call client.getProject when numeric project_id is provided", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({
          project: { id: 42, name: "Project 42", issue_custom_fields: [{ id: 1, name: "CF1" }] },
        }),
      };
      const args = { project_id: 42 };
      const parsedArgs = getProjectsSchema.parse(args);
      const result = await getProjectsHandler(parsedArgs, mockClient as any);

      expect(mockClient.getProject).toHaveBeenCalledWith(42);
      expect(result).toEqual({
        project: { id: 42, name: "Project 42", issue_custom_fields: [{ id: 1, name: "CF1" }] },
      });
    });

    it("should call client.getProject directly when numeric string project_id is provided", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({
          project: { id: 42, name: "Project 42" },
        }),
      };
      const args = { project_id: "42" };
      const parsedArgs = getProjectsSchema.parse(args);
      const result = await getProjectsHandler(parsedArgs, mockClient as any);

      expect(mockClient.getProject).toHaveBeenCalledWith("42");
      expect(result).toEqual({
        project: { id: 42, name: "Project 42" },
      });
    });

    it("should resolve project name with SmartNameResolver when non-numeric string is provided", async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({
          projects: [{ id: 99, name: "Sample Project" }],
        }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
        getProject: vi.fn().mockResolvedValue({
          project: { id: 99, name: "Sample Project", issue_custom_fields: [{ id: 5, name: "Custom Field" }] },
        }),
      };

      const args = { project_id: "Sample Project" };
      const parsedArgs = getProjectsSchema.parse(args);
      const result = await getProjectsHandler(parsedArgs, mockClient as any);

      expect(mockClient.getProjects).toHaveBeenCalled();
      expect(mockClient.getProject).toHaveBeenCalledWith(99);
      expect(result).toEqual({
        project: { id: 99, name: "Sample Project", issue_custom_fields: [{ id: 5, name: "Custom Field" }] },
      });
    });

    it("should fallback to raw project_id string when SmartNameResolver does not resolve name", async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({
          projects: [{ id: 1, name: "Different Project" }],
        }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
        getProject: vi.fn().mockResolvedValue({
          project: { id: 7, identifier: "my-slug", name: "My Slug" },
        }),
      };

      const args = { project_id: "my-slug" };
      const parsedArgs = getProjectsSchema.parse(args);
      const result = await getProjectsHandler(parsedArgs, mockClient as any);

      expect(mockClient.getProject).toHaveBeenCalledWith("my-slug");
      expect(result).toEqual({
        project: { id: 7, identifier: "my-slug", name: "My Slug" },
      });
    });

    it("should return structured error when project is not found (404)", async () => {
      const err: any = new Error("Request failed with status code 404");
      err.response = { status: 404 };
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({ projects: [] }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
        getProject: vi.fn().mockRejectedValue(err),
      };

      const result = await getProjectsHandler({ project_id: "non-existent" } as any, mockClient as any);
      expect(result).toEqual({ error: "해당 프로젝트를 찾을 수 없습니다: non-existent" });
    });

    it("should return structured error when project access is forbidden (403)", async () => {
      const err: any = new Error("Request failed with status code 403");
      err.response = { status: 403 };
      const mockClient = {
        getProject: vi.fn().mockRejectedValue(err),
      };

      const result = await getProjectsHandler({ project_id: 42 } as any, mockClient as any);
      expect(result).toEqual({ error: "해당 프로젝트에 접근할 권한이 없습니다 (403 Forbidden)" });
    });

    it("should reuse resolver instance on client to preserve TTL cache across calls", async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({
          projects: [{ id: 99, name: "Sample Project" }],
        }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
        getProject: vi.fn().mockResolvedValue({
          project: { id: 99, name: "Sample Project" },
        }),
      };

      await getProjectsHandler({ project_id: "Sample Project" } as any, mockClient as any);
      const firstResolver = (mockClient as any).resolver;
      expect(firstResolver).toBeDefined();

      await getProjectsHandler({ project_id: "Sample Project" } as any, mockClient as any);
      expect((mockClient as any).resolver).toBe(firstResolver);
      expect(mockClient.getProjects).toHaveBeenCalledTimes(1);
    });

    it("should redact user.api_key to [REDACTED] if present in project response (defense-in-depth)", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({
          project: { id: 1, name: "Proj" },
          user: { id: 1, api_key: "secret_token_123" },
        }),
      };

      const result: any = await getProjectsHandler({ project_id: 1 } as any, mockClient as any);
      expect(result.user.api_key).toBe("[REDACTED]");
    });
  });
  describe("include option (memberships, issue_categories)", () => {
    const rawMemberships = {
      memberships: [
        {
          id: 1,
          project: { id: 42, name: "Project 42" },
          user: { id: 5, name: "홍 길동", mail: "hong@example.com", login: "hong", api_key: "secret" },
          roles: [{ id: 3, name: "Developer" }, { id: 4, name: "Reporter", inherited: true }],
        },
        {
          id: 2,
          project: { id: 42, name: "Project 42" },
          group: { id: 9, name: "QA Team" },
          roles: [{ id: 5, name: "Tester" }],
        },
      ],
      total_count: 2,
      truncated: false,
    };
    const rawCategories = {
      issue_categories: [
        { id: 11, project: { id: 42, name: "Project 42" }, name: "UI", assigned_to: { id: 5, name: "홍 길동", mail: "hong@example.com" } },
        { id: 12, project: { id: 42, name: "Project 42" }, name: "Backend" },
      ],
      total_count: 2,
    };

    it("should accept include array of known values and reject unknown values", () => {
      expect(getProjectsSchema.parse({ project_id: 1, include: ["memberships", "issue_categories"] }).include).toEqual([
        "memberships",
        "issue_categories",
      ]);
      expect(() => getProjectsSchema.parse({ project_id: 1, include: ["users"] })).toThrow();
      expect(() => getProjectsSchema.parse({ project_id: 1, include: "memberships" })).toThrow();
    });

    it("should not call memberships/categories APIs when include is omitted", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42, name: "Project 42" } }),
        getProjectMemberships: vi.fn(),
        getIssueCategories: vi.fn(),
      };
      await getProjectsHandler(getProjectsSchema.parse({ project_id: 42 }), mockClient as any);
      expect(mockClient.getProjectMemberships).not.toHaveBeenCalled();
      expect(mockClient.getIssueCategories).not.toHaveBeenCalled();
    });

    it("should return sanitized memberships (only id/name of user, group, roles) using numeric project id", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42, identifier: "p42", name: "Project 42" } }),
        getProjectMemberships: vi.fn().mockResolvedValue(rawMemberships),
        getIssueCategories: vi.fn(),
      };
      const result: any = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: "42", include: ["memberships"] }),
        mockClient as any
      );

      expect(mockClient.getProjectMemberships).toHaveBeenCalledWith(42);
      expect(mockClient.getIssueCategories).not.toHaveBeenCalled();
      expect(result.project).toEqual({ id: 42, identifier: "p42", name: "Project 42" });
      expect(result.memberships).toEqual([
        { id: 1, user: { id: 5, name: "홍 길동" }, roles: [{ id: 3, name: "Developer" }, { id: 4, name: "Reporter", inherited: true }] },
        { id: 2, group: { id: 9, name: "QA Team" }, roles: [{ id: 5, name: "Tester" }] },
      ]);
      expect(result.memberships_total_count).toBe(2);
      expect(result.memberships_truncated).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain("hong@example.com");
      expect(JSON.stringify(result)).not.toContain("secret");
    });

    it("should flag memberships_truncated when client reports truncation", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42 } }),
        getProjectMemberships: vi.fn().mockResolvedValue({ memberships: [], total_count: 5000, truncated: true }),
      };
      const result: any = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: 42, include: ["memberships"] }),
        mockClient as any
      );
      expect(result.memberships_truncated).toBe(true);
      expect(result.memberships_total_count).toBe(5000);
    });

    it("should return sanitized issue_categories (id, name, assigned_to id/name)", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42 } }),
        getProjectMemberships: vi.fn(),
        getIssueCategories: vi.fn().mockResolvedValue(rawCategories),
      };
      const result: any = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: 42, include: ["issue_categories"] }),
        mockClient as any
      );
      expect(mockClient.getIssueCategories).toHaveBeenCalledWith(42);
      expect(mockClient.getProjectMemberships).not.toHaveBeenCalled();
      expect(result.issue_categories).toEqual([
        { id: 11, name: "UI", assigned_to: { id: 5, name: "홍 길동" } },
        { id: 12, name: "Backend" },
      ]);
      expect(JSON.stringify(result)).not.toContain("hong@example.com");
    });

    it("should fetch both when both are included and dedupe repeated values", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42 } }),
        getProjectMemberships: vi.fn().mockResolvedValue(rawMemberships),
        getIssueCategories: vi.fn().mockResolvedValue(rawCategories),
      };
      const result: any = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: 42, include: ["memberships", "issue_categories", "memberships"] }),
        mockClient as any
      );
      expect(mockClient.getProjectMemberships).toHaveBeenCalledTimes(1);
      expect(mockClient.getIssueCategories).toHaveBeenCalledTimes(1);
      expect(result.memberships).toHaveLength(2);
      expect(result.issue_categories).toHaveLength(2);
    });

    it("should call section APIs with numeric id from response when a slug is given", async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({ projects: [] }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
        getProject: vi.fn().mockResolvedValue({ project: { id: 42, identifier: "p42" } }),
        getProjectMemberships: vi.fn().mockResolvedValue({ memberships: [], total_count: 0 }),
        getIssueCategories: vi.fn().mockResolvedValue({ issue_categories: [] }),
      };
      await getProjectsHandler(
        getProjectsSchema.parse({ project_id: "p42", include: ["memberships", "issue_categories"] }),
        mockClient as any
      );
      expect(mockClient.getProject).toHaveBeenCalledWith("p42");
      expect(mockClient.getProjectMemberships).toHaveBeenCalledWith(42);
      expect(mockClient.getIssueCategories).toHaveBeenCalledWith(42);
    });

    it("should replace project.issue_categories with the richer top-level list to avoid duplication", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42, issue_categories: [{ id: 11, name: "UI" }] } }),
        getIssueCategories: vi.fn().mockResolvedValue(rawCategories),
      };
      const result: any = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: 42, include: ["issue_categories"] }),
        mockClient as any
      );
      expect(result.project).not.toHaveProperty("issue_categories");
      expect(result.issue_categories).toHaveLength(2);
    });

    it("should keep project.issue_categories when the categories section fails", async () => {
      const err: any = new Error("403");
      err.response = { status: 403 };
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42, issue_categories: [{ id: 11, name: "UI" }] } }),
        getIssueCategories: vi.fn().mockRejectedValue(err),
      };
      const result: any = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: 42, include: ["issue_categories"] }),
        mockClient as any
      );
      expect(result.project.issue_categories).toEqual([{ id: 11, name: "UI" }]);
      expect(result.issue_categories_error).toBeDefined();
    });

    it("should fall back to resolved id when project response lacks numeric id", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { name: "no id" } }),
        getIssueCategories: vi.fn().mockResolvedValue({ issue_categories: [] }),
      };
      await getProjectsHandler(getProjectsSchema.parse({ project_id: 7, include: ["issue_categories"] }), mockClient as any);
      expect(mockClient.getIssueCategories).toHaveBeenCalledWith(7);
    });

    it("should report per-section error on 403 without failing the whole project result", async () => {
      const err: any = new Error("Request failed with status code 403");
      err.response = { status: 403 };
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42 } }),
        getProjectMemberships: vi.fn().mockRejectedValue(err),
        getIssueCategories: vi.fn().mockResolvedValue(rawCategories),
      };
      const result: any = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: 42, include: ["memberships", "issue_categories"] }),
        mockClient as any
      );
      expect(result.project).toEqual({ id: 42 });
      expect(result.memberships).toBeUndefined();
      expect(result.memberships_error).toBe("프로젝트 멤버십을 조회할 권한이 없습니다 (403 Forbidden)");
      expect(result.issue_categories).toHaveLength(2);
    });

    it("should report per-section error on 404", async () => {
      const err: any = new Error("Request failed with status code 404");
      err.response = { status: 404 };
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42 } }),
        getIssueCategories: vi.fn().mockRejectedValue(err),
      };
      const result: any = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: 42, include: ["issue_categories"] }),
        mockClient as any
      );
      expect(result.issue_categories_error).toBe("일감 범주를 찾을 수 없습니다 (404 Not Found)");
    });

    it("should rethrow unexpected errors from include sections", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42 } }),
        getProjectMemberships: vi.fn().mockRejectedValue(new Error("Network Error")),
      };
      await expect(
        getProjectsHandler(getProjectsSchema.parse({ project_id: 42, include: ["memberships"] }), mockClient as any)
      ).rejects.toThrow("Network Error");
    });

    it("should skip include sections when project lookup itself fails (404)", async () => {
      const err: any = new Error("Request failed with status code 404");
      err.response = { status: 404 };
      const mockClient = {
        getProject: vi.fn().mockRejectedValue(err),
        getProjectMemberships: vi.fn(),
      };
      const result = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: 42, include: ["memberships"] }),
        mockClient as any
      );
      expect(result).toEqual({ error: "해당 프로젝트를 찾을 수 없습니다: 42" });
      expect(mockClient.getProjectMemberships).not.toHaveBeenCalled();
    });

    it("should return error when include is given without project_id", async () => {
      const mockClient = { getProjects: vi.fn() };
      const result = await getProjectsHandler(getProjectsSchema.parse({ include: ["memberships"] }), mockClient as any);
      expect(result).toEqual({ error: "include 옵션은 project_id를 지정한 경우에만 사용할 수 있습니다." });
      expect(mockClient.getProjects).not.toHaveBeenCalled();
    });

    it("should ignore malformed membership/category entries without throwing", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValue({ project: { id: 42 } }),
        getProjectMemberships: vi.fn().mockResolvedValue({
          memberships: [null, { id: 3, user: "weird", roles: "x" }, { id: 4, user: { id: 1 }, roles: [null, { id: 2 }] }],
          total_count: 3,
        }),
        getIssueCategories: vi.fn().mockResolvedValue({ issue_categories: [null, { id: 1, name: "A", assigned_to: "x" }] }),
      };
      const result: any = await getProjectsHandler(
        getProjectsSchema.parse({ project_id: 42, include: ["memberships", "issue_categories"] }),
        mockClient as any
      );
      expect(result.memberships).toEqual([
        { id: 3, roles: [] },
        { id: 4, user: { id: 1 }, roles: [{ id: 2 }] },
      ]);
      expect(result.issue_categories).toEqual([{ id: 1, name: "A" }]);
    });
  });
});
