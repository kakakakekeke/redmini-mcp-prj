import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  manageWatchersSchema,
  manageWatchersHandler,
} from "../../src/tools/manage_watchers.js";

describe("manage_watchers tool", () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getWatchers: vi.fn(),
      addWatcher: vi.fn(),
      removeWatcher: vi.fn(),
    };
  });

  describe("Schema Validation", () => {
    it("should validate valid list parameters", () => {
      const args = { action: "list", issue_id: 100 };
      const parsed = manageWatchersSchema.parse(args);
      expect(parsed.action).toBe("list");
      expect(parsed.issue_id).toBe(100);
      expect(parsed.dry_run).toBe(true);
    });

    it("should validate valid add parameters", () => {
      const args = {
        action: "add",
        issue_id: 100,
        user_id: 5,
        dry_run: false,
      };
      const parsed = manageWatchersSchema.parse(args);
      expect(parsed.action).toBe("add");
      expect(parsed.issue_id).toBe(100);
      expect(parsed.user_id).toBe(5);
      expect(parsed.dry_run).toBe(false);
    });

    it("should validate valid remove parameters", () => {
      const args = {
        action: "remove",
        issue_id: 100,
        user_id: 5,
        dry_run: true,
      };
      const parsed = manageWatchersSchema.parse(args);
      expect(parsed.action).toBe("remove");
      expect(parsed.issue_id).toBe(100);
      expect(parsed.user_id).toBe(5);
      expect(parsed.dry_run).toBe(true);
    });

    it("should reject invalid action", () => {
      expect(() =>
        manageWatchersSchema.parse({ action: "delete", issue_id: 100 })
      ).toThrow();
    });

    it("should reject non-positive issue_id", () => {
      expect(() =>
        manageWatchersSchema.parse({ action: "list", issue_id: -1 })
      ).toThrow();
      expect(() =>
        manageWatchersSchema.parse({ action: "list", issue_id: 0 })
      ).toThrow();
    });

    it("should default dry_run to true", () => {
      const parsed = manageWatchersSchema.parse({ action: "list", issue_id: 1 });
      expect(parsed.dry_run).toBe(true);
    });
  });

  describe("Handler - List Action", () => {
    it("should retrieve watchers for the specified issue_id", async () => {
      const watchersData = [
        { id: 1, name: "Admin User" },
        { id: 2, name: "Developer Kim" },
      ];
      mockClient.getWatchers.mockResolvedValue(watchersData);

      const args = manageWatchersSchema.parse({ action: "list", issue_id: 100 });
      const result = await manageWatchersHandler(args, mockClient);

      expect(mockClient.getWatchers).toHaveBeenCalledWith(100);
      expect(result).toEqual(watchersData);
    });
  });

  describe("Handler - Add Action", () => {
    it("should throw error if user_id is missing for add action", async () => {
      const args = manageWatchersSchema.parse({
        action: "add",
        issue_id: 100,
      });
      await expect(manageWatchersHandler(args, mockClient)).rejects.toThrow(
        "user_id is required for add action"
      );
      expect(mockClient.addWatcher).not.toHaveBeenCalled();
    });

    it("should return preview plan and NOT call API when dry_run=true", async () => {
      const args = manageWatchersSchema.parse({
        action: "add",
        issue_id: 100,
        user_id: 5,
        dry_run: true,
      });

      const result = await manageWatchersHandler(args, mockClient);

      expect(mockClient.addWatcher).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "dry_run is true. Watcher will not be added. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "add",
          issue_id: 100,
          user_id: 5,
        },
      });
    });

    it("should call client.addWatcher when dry_run=false", async () => {
      const response = { message: "User 5 added as watcher to issue 100 successfully" };
      mockClient.addWatcher.mockResolvedValue(response);

      const args = manageWatchersSchema.parse({
        action: "add",
        issue_id: 100,
        user_id: 5,
        dry_run: false,
      });

      const result = await manageWatchersHandler(args, mockClient);

      expect(mockClient.addWatcher).toHaveBeenCalledWith(100, 5);
      expect(result).toEqual(response);
    });
  });

  describe("Handler - Remove Action", () => {
    it("should throw error if user_id is missing for remove action", async () => {
      const args = manageWatchersSchema.parse({
        action: "remove",
        issue_id: 100,
      });
      await expect(manageWatchersHandler(args, mockClient)).rejects.toThrow(
        "user_id is required for remove action"
      );
      expect(mockClient.removeWatcher).not.toHaveBeenCalled();
    });

    it("should return preview plan and NOT call API when dry_run=true", async () => {
      const args = manageWatchersSchema.parse({
        action: "remove",
        issue_id: 100,
        user_id: 5,
        dry_run: true,
      });

      const result = await manageWatchersHandler(args, mockClient);

      expect(mockClient.removeWatcher).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "dry_run is true. Watcher will not be removed. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "remove",
          issue_id: 100,
          user_id: 5,
        },
      });
    });

    it("should call client.removeWatcher when dry_run=false", async () => {
      const response = { message: "User 5 removed from watchers of issue 100 successfully" };
      mockClient.removeWatcher.mockResolvedValue(response);

      const args = manageWatchersSchema.parse({
        action: "remove",
        issue_id: 100,
        user_id: 5,
        dry_run: false,
      });

      const result = await manageWatchersHandler(args, mockClient);

      expect(mockClient.removeWatcher).toHaveBeenCalledWith(100, 5);
      expect(result).toEqual(response);
    });
  });

  describe("Error Handling", () => {
    it("should propagate Redmine 422 error messages properly", async () => {
      const error: any = new Error("Unprocessable Entity");
      error.isAxiosError = true;
      error.response = {
        status: 422,
        data: {
          errors: ["User is already a watcher"],
        },
      };
      mockClient.addWatcher.mockRejectedValue(error);

      const args = manageWatchersSchema.parse({
        action: "add",
        issue_id: 100,
        user_id: 5,
        dry_run: false,
      });

      await expect(manageWatchersHandler(args, mockClient)).rejects.toThrow(
        "User is already a watcher"
      );
    });
  });
});
