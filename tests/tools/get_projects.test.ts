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
  });
});
