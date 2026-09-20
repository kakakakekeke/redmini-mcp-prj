import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  manageIssueRelationSchema,
  manageIssueRelationHandler,
} from "../../src/tools/manage_issue_relation.js";

describe("manage_issue_relation tool", () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getIssueRelations: vi.fn(),
      createIssueRelation: vi.fn(),
      deleteIssueRelation: vi.fn(),
    };
  });

  describe("Schema Validation", () => {
    it("should validate valid list parameters", () => {
      const args = { action: "list", issue_id: 100 };
      const parsed = manageIssueRelationSchema.parse(args);
      expect(parsed.action).toBe("list");
      expect(parsed.issue_id).toBe(100);
      expect(parsed.dry_run).toBe(true);
    });

    it("should validate valid create parameters", () => {
      const args = {
        action: "create",
        issue_id: 100,
        issue_to_id: 101,
        relation_type: "blocks",
        delay: 2,
        dry_run: false,
      };
      const parsed = manageIssueRelationSchema.parse(args);
      expect(parsed.action).toBe("create");
      expect(parsed.issue_id).toBe(100);
      expect(parsed.issue_to_id).toBe(101);
      expect(parsed.relation_type).toBe("blocks");
      expect(parsed.delay).toBe(2);
      expect(parsed.dry_run).toBe(false);
    });

    it("should validate valid delete parameters", () => {
      const args = { action: "delete", relation_id: 50 };
      const parsed = manageIssueRelationSchema.parse(args);
      expect(parsed.action).toBe("delete");
      expect(parsed.relation_id).toBe(50);
      expect(parsed.dry_run).toBe(true);
    });

    it("should reject invalid action", () => {
      expect(() =>
        manageIssueRelationSchema.parse({ action: "invalid_action", issue_id: 100 })
      ).toThrow();
    });

    it("should reject invalid relation_type", () => {
      expect(() =>
        manageIssueRelationSchema.parse({
          action: "create",
          issue_id: 100,
          issue_to_id: 101,
          relation_type: "not_a_relation",
        })
      ).toThrow();
    });

    it("should default dry_run to true", () => {
      const parsed = manageIssueRelationSchema.parse({ action: "list", issue_id: 1 });
      expect(parsed.dry_run).toBe(true);
    });
  });

  describe("Handler - List Action", () => {
    it("should retrieve relations for the specified issue_id", async () => {
      const relationsData = {
        relations: [
          { id: 1, issue_id: 100, issue_to_id: 101, relation_type: "blocks", delay: null },
        ],
      };
      mockClient.getIssueRelations.mockResolvedValue(relationsData);

      const args = manageIssueRelationSchema.parse({ action: "list", issue_id: 100 });
      const result = await manageIssueRelationHandler(args, mockClient);

      expect(mockClient.getIssueRelations).toHaveBeenCalledWith(100);
      expect(result).toEqual(relationsData);
    });

    it("should throw error if issue_id is missing for list action", async () => {
      const args = manageIssueRelationSchema.parse({ action: "list" });
      await expect(manageIssueRelationHandler(args, mockClient)).rejects.toThrow(
        "issue_id is required for list action"
      );
      expect(mockClient.getIssueRelations).not.toHaveBeenCalled();
    });
  });

  describe("Handler - Create Action", () => {
    it("should throw error if required parameters are missing", async () => {
      const missingIssueTo = manageIssueRelationSchema.parse({
        action: "create",
        issue_id: 100,
        relation_type: "blocks",
      });
      await expect(manageIssueRelationHandler(missingIssueTo, mockClient)).rejects.toThrow(
        "issue_id, issue_to_id, and relation_type are required for create action"
      );

      const missingIssueId = manageIssueRelationSchema.parse({
        action: "create",
        issue_to_id: 101,
        relation_type: "blocks",
      });
      await expect(manageIssueRelationHandler(missingIssueId, mockClient)).rejects.toThrow(
        "issue_id, issue_to_id, and relation_type are required for create action"
      );

      const missingType = manageIssueRelationSchema.parse({
        action: "create",
        issue_id: 100,
        issue_to_id: 101,
      });
      await expect(manageIssueRelationHandler(missingType, mockClient)).rejects.toThrow(
        "issue_id, issue_to_id, and relation_type are required for create action"
      );
    });

    it("should return preview plan and NOT call API when dry_run=true", async () => {
      const args = manageIssueRelationSchema.parse({
        action: "create",
        issue_id: 100,
        issue_to_id: 101,
        relation_type: "blocks",
        delay: 1,
        dry_run: true,
      });

      const result = await manageIssueRelationHandler(args, mockClient);

      expect(mockClient.createIssueRelation).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "dry_run is true. Issue relation will not be created. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "create",
          issue_id: 100,
          relation: {
            issue_to_id: 101,
            relation_type: "blocks",
            delay: 1,
          },
        },
      });
    });

    it("should call client.createIssueRelation when dry_run=false", async () => {
      const createdRelation = {
        relation: {
          id: 55,
          issue_id: 100,
          issue_to_id: 101,
          relation_type: "blocks",
          delay: 0,
        },
      };
      mockClient.createIssueRelation.mockResolvedValue(createdRelation);

      const args = manageIssueRelationSchema.parse({
        action: "create",
        issue_id: 100,
        issue_to_id: 101,
        relation_type: "blocks",
        dry_run: false,
      });

      const result = await manageIssueRelationHandler(args, mockClient);

      expect(mockClient.createIssueRelation).toHaveBeenCalledWith(100, {
        issue_to_id: 101,
        relation_type: "blocks",
      });
      expect(result).toEqual(createdRelation);
    });
  });

  describe("Handler - Delete Action", () => {
    it("should throw error if relation_id is missing for delete action", async () => {
      const args = manageIssueRelationSchema.parse({ action: "delete" });
      await expect(manageIssueRelationHandler(args, mockClient)).rejects.toThrow(
        "relation_id is required for delete action"
      );
      expect(mockClient.deleteIssueRelation).not.toHaveBeenCalled();
    });

    it("should return preview plan and NOT call API when dry_run=true", async () => {
      const args = manageIssueRelationSchema.parse({
        action: "delete",
        relation_id: 42,
        dry_run: true,
      });

      const result = await manageIssueRelationHandler(args, mockClient);

      expect(mockClient.deleteIssueRelation).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "dry_run is true. Issue relation will not be deleted. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "delete",
          relation_id: 42,
        },
      });
    });

    it("should call client.deleteIssueRelation when dry_run=false", async () => {
      mockClient.deleteIssueRelation.mockResolvedValue({
        message: "Relation 42 deleted successfully",
      });

      const args = manageIssueRelationSchema.parse({
        action: "delete",
        relation_id: 42,
        dry_run: false,
      });

      const result = await manageIssueRelationHandler(args, mockClient);

      expect(mockClient.deleteIssueRelation).toHaveBeenCalledWith(42);
      expect(result).toEqual({
        message: "Relation 42 deleted successfully",
      });
    });
  });

  describe("Error Handling", () => {
    it("should propagate Redmine 422 error messages properly", async () => {
      const error: any = new Error("Unprocessable Entity");
      error.isAxiosError = true;
      error.response = {
        status: 422,
        data: {
          errors: ["Circular dependency detected", "Relation already exists"],
        },
      };
      mockClient.createIssueRelation.mockRejectedValue(error);

      const args = manageIssueRelationSchema.parse({
        action: "create",
        issue_id: 100,
        issue_to_id: 101,
        relation_type: "blocks",
        dry_run: false,
      });

      await expect(manageIssueRelationHandler(args, mockClient)).rejects.toThrow(
        "Circular dependency detected, Relation already exists"
      );
    });
  });
});
