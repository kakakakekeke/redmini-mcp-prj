import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  manageVersionsSchema,
  manageVersionsHandler,
} from "../../src/tools/manage_versions.js";

describe("manage_versions tool", () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getProjectVersions: vi.fn(),
      getVersionDetails: vi.fn(),
      createVersion: vi.fn(),
      updateVersion: vi.fn(),
      deleteVersion: vi.fn(),
    };
  });

  describe("Schema Validation", () => {
    it("should validate valid list parameters", () => {
      const args = { action: "list", project_id: "test-project" };
      const parsed = manageVersionsSchema.parse(args);
      expect(parsed.action).toBe("list");
      expect(parsed.project_id).toBe("test-project");
      expect(parsed.dry_run).toBe(true);
    });

    it("should validate valid get parameters", () => {
      const args = { action: "get", version_id: 12 };
      const parsed = manageVersionsSchema.parse(args);
      expect(parsed.action).toBe("get");
      expect(parsed.version_id).toBe(12);
      expect(parsed.dry_run).toBe(true);
    });

    it("should validate valid create parameters", () => {
      const args = {
        action: "create",
        project_id: 10,
        name: "v1.0.0 Release",
        status: "open",
        sharing: "descendants",
        due_date: "2026-12-31",
        description: "Initial production release",
        dry_run: false,
      };
      const parsed = manageVersionsSchema.parse(args);
      expect(parsed.action).toBe("create");
      expect(parsed.project_id).toBe(10);
      expect(parsed.name).toBe("v1.0.0 Release");
      expect(parsed.status).toBe("open");
      expect(parsed.sharing).toBe("descendants");
      expect(parsed.due_date).toBe("2026-12-31");
      expect(parsed.description).toBe("Initial production release");
      expect(parsed.dry_run).toBe(false);
    });

    it("should validate valid update parameters", () => {
      const args = {
        action: "update",
        version_id: 12,
        status: "closed",
        dry_run: false,
      };
      const parsed = manageVersionsSchema.parse(args);
      expect(parsed.action).toBe("update");
      expect(parsed.version_id).toBe(12);
      expect(parsed.status).toBe("closed");
      expect(parsed.dry_run).toBe(false);
    });

    it("should validate valid delete parameters", () => {
      const args = { action: "delete", version_id: 15 };
      const parsed = manageVersionsSchema.parse(args);
      expect(parsed.action).toBe("delete");
      expect(parsed.version_id).toBe(15);
      expect(parsed.dry_run).toBe(true);
    });

    it("should reject invalid action", () => {
      expect(() =>
        manageVersionsSchema.parse({ action: "invalid_action", project_id: 1 })
      ).toThrow();
    });

    it("should reject invalid status", () => {
      expect(() =>
        manageVersionsSchema.parse({
          action: "create",
          project_id: 1,
          name: "v1.0",
          status: "not_a_status",
        })
      ).toThrow();
    });

    it("should reject invalid sharing", () => {
      expect(() =>
        manageVersionsSchema.parse({
          action: "create",
          project_id: 1,
          name: "v1.0",
          sharing: "not_a_sharing",
        })
      ).toThrow();
    });

    it("should default dry_run to true", () => {
      const parsed = manageVersionsSchema.parse({
        action: "create",
        project_id: 1,
        name: "v1.0",
      });
      expect(parsed.dry_run).toBe(true);
    });
  });

  describe("Handler - List Action", () => {
    it("should retrieve versions for the specified project_id", async () => {
      const versionsData = {
        versions: [
          { id: 1, name: "v1.0.0", status: "closed" },
          { id: 2, name: "v1.1.0", status: "open" },
        ],
      };
      mockClient.getProjectVersions.mockResolvedValue(versionsData);

      const args = manageVersionsSchema.parse({ action: "list", project_id: "test-proj" });
      const result = await manageVersionsHandler(args, mockClient);

      expect(mockClient.getProjectVersions).toHaveBeenCalledWith("test-proj");
      expect(result).toEqual(versionsData);
    });

    it("should throw error if project_id is missing for list action", async () => {
      const args = manageVersionsSchema.parse({ action: "list" });
      await expect(manageVersionsHandler(args, mockClient)).rejects.toThrow(
        "project_id is required for list action"
      );
      expect(mockClient.getProjectVersions).not.toHaveBeenCalled();
    });
  });

  describe("Handler - Get Action", () => {
    it("should retrieve single version details for the specified version_id", async () => {
      const versionDetail = {
        version: {
          id: 12,
          project: { id: 1, name: "Project 1" },
          name: "v1.2.0",
          status: "open",
        },
      };
      mockClient.getVersionDetails.mockResolvedValue(versionDetail);

      const args = manageVersionsSchema.parse({ action: "get", version_id: 12 });
      const result = await manageVersionsHandler(args, mockClient);

      expect(mockClient.getVersionDetails).toHaveBeenCalledWith(12);
      expect(result).toEqual(versionDetail);
    });

    it("should throw error if version_id is missing for get action", async () => {
      const args = manageVersionsSchema.parse({ action: "get" });
      await expect(manageVersionsHandler(args, mockClient)).rejects.toThrow(
        "version_id is required for get action"
      );
      expect(mockClient.getVersionDetails).not.toHaveBeenCalled();
    });
  });

  describe("Handler - Create Action", () => {
    it("should throw error if project_id is missing for create action", async () => {
      const args = manageVersionsSchema.parse({ action: "create", name: "v2.0" });
      await expect(manageVersionsHandler(args, mockClient)).rejects.toThrow(
        "project_id and name are required for create action"
      );
      expect(mockClient.createVersion).not.toHaveBeenCalled();
    });

    it("should throw error if name is missing for create action", async () => {
      const args = manageVersionsSchema.parse({ action: "create", project_id: "proj-1" });
      await expect(manageVersionsHandler(args, mockClient)).rejects.toThrow(
        "project_id and name are required for create action"
      );
      expect(mockClient.createVersion).not.toHaveBeenCalled();
    });

    it("should return dry_run preview without calling client when dry_run is true", async () => {
      const args = manageVersionsSchema.parse({
        action: "create",
        project_id: "proj-1",
        name: "v2.0.0",
        status: "open",
        sharing: "none",
        due_date: "2026-11-01",
        description: "Preview version",
        dry_run: true,
      });

      const result = await manageVersionsHandler(args, mockClient);

      expect(mockClient.createVersion).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "dry_run is true. Version will not be created. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "create",
          project_id: "proj-1",
          version: {
            name: "v2.0.0",
            status: "open",
            sharing: "none",
            due_date: "2026-11-01",
            description: "Preview version",
          },
        },
      });
    });

    it("should call client.createVersion and return created version when dry_run is false", async () => {
      const createdData = {
        version: {
          id: 101,
          name: "v2.0.0",
          status: "open",
        },
      };
      mockClient.createVersion.mockResolvedValue(createdData);

      const args = manageVersionsSchema.parse({
        action: "create",
        project_id: 5,
        name: "v2.0.0",
        status: "open",
        dry_run: false,
      });

      const result = await manageVersionsHandler(args, mockClient);

      expect(mockClient.createVersion).toHaveBeenCalledWith(5, {
        name: "v2.0.0",
        status: "open",
      });
      expect(result).toEqual(createdData);
    });

    it("should extract 422 error messages if creation fails", async () => {
      const axiosError: any = new Error("Request failed with status code 422");
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 422,
        data: {
          errors: ["Name has already been taken", "Due date is invalid"],
        },
      };
      mockClient.createVersion.mockRejectedValue(axiosError);

      const args = manageVersionsSchema.parse({
        action: "create",
        project_id: 5,
        name: "v2.0.0",
        dry_run: false,
      });

      await expect(manageVersionsHandler(args, mockClient)).rejects.toThrow(
        "Name has already been taken, Due date is invalid"
      );
    });
  });

  describe("Handler - Update Action", () => {
    it("should throw error if version_id is missing for update action", async () => {
      const args = manageVersionsSchema.parse({ action: "update", status: "closed" });
      await expect(manageVersionsHandler(args, mockClient)).rejects.toThrow(
        "version_id is required for update action"
      );
      expect(mockClient.updateVersion).not.toHaveBeenCalled();
    });

    it("should return dry_run preview without calling client when dry_run is true", async () => {
      const args = manageVersionsSchema.parse({
        action: "update",
        version_id: 12,
        name: "v1.2.1 Patched",
        status: "locked",
        dry_run: true,
      });

      const result = await manageVersionsHandler(args, mockClient);

      expect(mockClient.updateVersion).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "dry_run is true. Version will not be updated. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "update",
          version_id: 12,
          version: {
            name: "v1.2.1 Patched",
            status: "locked",
          },
        },
      });
    });

    it("should call client.updateVersion when dry_run is false", async () => {
      mockClient.updateVersion.mockResolvedValue({
        message: "Version 12 updated successfully",
      });

      const args = manageVersionsSchema.parse({
        action: "update",
        version_id: 12,
        status: "closed",
        dry_run: false,
      });

      const result = await manageVersionsHandler(args, mockClient);

      expect(mockClient.updateVersion).toHaveBeenCalledWith(12, {
        status: "closed",
      });
      expect(result).toEqual({
        message: "Version 12 updated successfully",
      });
    });

    it("should extract 422 error messages if update fails", async () => {
      const axiosError: any = new Error("Request failed with status code 422");
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 422,
        data: {
          errors: ["Due date can't be in the past"],
        },
      };
      mockClient.updateVersion.mockRejectedValue(axiosError);

      const args = manageVersionsSchema.parse({
        action: "update",
        version_id: 12,
        due_date: "2020-01-01",
        dry_run: false,
      });

      await expect(manageVersionsHandler(args, mockClient)).rejects.toThrow(
        "Due date can't be in the past"
      );
    });
  });

  describe("Handler - Delete Action", () => {
    it("should throw error if version_id is missing for delete action", async () => {
      const args = manageVersionsSchema.parse({ action: "delete" });
      await expect(manageVersionsHandler(args, mockClient)).rejects.toThrow(
        "version_id is required for delete action"
      );
      expect(mockClient.deleteVersion).not.toHaveBeenCalled();
    });

    it("should return dry_run preview without calling client when dry_run is true", async () => {
      const args = manageVersionsSchema.parse({
        action: "delete",
        version_id: 34,
        dry_run: true,
      });

      const result = await manageVersionsHandler(args, mockClient);

      expect(mockClient.deleteVersion).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "dry_run is true. Version will not be deleted. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "delete",
          version_id: 34,
        },
      });
    });

    it("should call client.deleteVersion when dry_run is false", async () => {
      mockClient.deleteVersion.mockResolvedValue({
        message: "Version 34 deleted successfully",
      });

      const args = manageVersionsSchema.parse({
        action: "delete",
        version_id: 34,
        dry_run: false,
      });

      const result = await manageVersionsHandler(args, mockClient);

      expect(mockClient.deleteVersion).toHaveBeenCalledWith(34);
      expect(result).toEqual({
        message: "Version 34 deleted successfully",
      });
    });

    it("should extract 422 error messages if delete fails", async () => {
      const axiosError: any = new Error("Request failed with status code 422");
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 422,
        data: {
          errors: ["This version cannot be deleted because it has issues assigned to it"],
        },
      };
      mockClient.deleteVersion.mockRejectedValue(axiosError);

      const args = manageVersionsSchema.parse({
        action: "delete",
        version_id: 34,
        dry_run: false,
      });

      await expect(manageVersionsHandler(args, mockClient)).rejects.toThrow(
        "This version cannot be deleted because it has issues assigned to it"
      );
    });
  });
});
