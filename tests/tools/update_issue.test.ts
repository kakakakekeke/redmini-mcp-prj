import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateIssueHandler, updateIssueSchema } from "../../src/tools/update_issue";
import { RedmineClient } from "../../src/client/redmine";

describe("updateIssueHandler", () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getIssueDetails: vi.fn(),
      updateIssue: vi.fn(),
    };
  });

  it("should update an issue successfully when parameters are valid", async () => {
    mockClient.getIssueDetails.mockResolvedValue({
      issue: {
        id: 1,
        status: { id: 1, name: "New" },
      }
    });

    const args = {
      issue_id: 1,
      notes: "This is a test update",
      dry_run: false,
    };

    const result = await updateIssueHandler(args, mockClient as unknown as RedmineClient);

    expect(mockClient.updateIssue).toHaveBeenCalledWith(1, { notes: "This is a test update" });
    expect(result).toEqual({ message: "Issue 1 updated successfully" });
  });

  it("should validate allowed_statuses if status_id is provided", async () => {
    mockClient.getIssueDetails.mockResolvedValue({
      issue: {
        id: 1,
        status: { id: 1, name: "New" },
        allowed_statuses: [
          { id: 2, name: "In Progress" }
        ]
      }
    });

    const args = {
      issue_id: 1,
      status_id: 2,
      dry_run: false,
    };

    const result = await updateIssueHandler(args, mockClient as unknown as RedmineClient);

    expect(mockClient.getIssueDetails).toHaveBeenCalledWith({ issue_id: 1 });
    expect(mockClient.updateIssue).toHaveBeenCalledWith(1, { status_id: 2 });
    expect(result).toEqual({ message: "Issue 1 updated successfully" });
  });

  it("should throw an error if status_id is provided but not in allowed_statuses", async () => {
    mockClient.getIssueDetails.mockResolvedValue({
      issue: {
        id: 1,
        status: { id: 1, name: "New" },
        allowed_statuses: [
          { id: 2, name: "In Progress" }
        ]
      }
    });

    const args = {
      issue_id: 1,
      status_id: 3, // Not allowed
      dry_run: false,
    };

    await expect(updateIssueHandler(args, mockClient as unknown as RedmineClient)).rejects.toThrow("Status ID 3 is not allowed for this issue");
    expect(mockClient.updateIssue).not.toHaveBeenCalled();
  });

  it("should not call API if dry_run is true", async () => {
    mockClient.getIssueDetails.mockResolvedValue({
      issue: {
        id: 1,
        status: { id: 1, name: "New" },
        allowed_statuses: [
          { id: 2, name: "In Progress" }
        ]
      }
    });

    const args = {
      issue_id: 1,
      status_id: 2,
      notes: "Test",
      dry_run: true,
    };

    const result = await updateIssueHandler(args, mockClient as unknown as RedmineClient);

    expect(mockClient.updateIssue).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: "Dry run successful. No changes were made.",
      updates: { status_id: 2, notes: "Test" }
    });
  });

  it("should return an error message if no updates are provided", async () => {
    const args = {
      issue_id: 1,
      dry_run: false,
    };
    await expect(updateIssueHandler(args, mockClient as unknown as RedmineClient)).rejects.toThrow("No updates provided");
  });

  it("should bypass allowed_statuses check if status_id is the same as current status", async () => {
    mockClient.getIssueDetails.mockResolvedValue({
      issue: {
        id: 1,
        status: { id: 2, name: "In Progress" },
        allowed_statuses: [] // no transitions
      }
    });

    const args = {
      issue_id: 1,
      status_id: 2, // Same as current
      notes: "Just updating notes",
      dry_run: false,
    };

    const result = await updateIssueHandler(args, mockClient as unknown as RedmineClient);
    
    expect(mockClient.updateIssue).toHaveBeenCalledWith(1, { status_id: 2, notes: "Just updating notes" });
    expect(result).toEqual({ message: "Issue 1 updated successfully" });
  });

  it("should return formatted error if Redmine API returns 422", async () => {
    mockClient.getIssueDetails.mockResolvedValue({
      issue: {
        id: 1,
        status: { id: 1, name: "New" },
        allowed_statuses: [{ id: 2, name: "In Progress" }]
      }
    });

    mockClient.updateIssue.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: { errors: ["Custom field cannot be blank"] }
      }
    });

    const args = {
      issue_id: 1,
      status_id: 2,
      dry_run: false,
    };

    await expect(updateIssueHandler(args, mockClient as unknown as RedmineClient)).rejects.toThrow("Custom field cannot be blank");
  });

  it("should default dry_run to true when omitted in schema and prevent API call", async () => {
    mockClient.getIssueDetails.mockResolvedValue({
      issue: {
        id: 1,
        status: { id: 1, name: "New" },
      },
    });

    const rawArgs = {
      issue_id: 1,
      notes: "Default dry_run test",
    };
    const parsedArgs = updateIssueSchema.parse(rawArgs);
    expect(parsedArgs.dry_run).toBe(true);

    const result = await updateIssueHandler(parsedArgs, mockClient as unknown as RedmineClient);

    expect(mockClient.updateIssue).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: "Dry run successful. No changes were made.",
      updates: { notes: "Default dry_run test" },
    });
  });
  describe("custom_fields (DL-0035)", () => {
    const projectFields = {
      project: { id: 7, issue_custom_fields: [{ id: 1, name: "MCP-TEST 고객사" }, { id: 2, name: "MCP-TEST 요청번호" }] },
    };
    const defs = {
      custom_fields: [
        { id: 1, customized_type: "issue", field_format: "list", possible_values: [{ value: "A사" }], trackers: [{ id: 1 }] },
        { id: 2, customized_type: "issue", field_format: "string", regexp: "^REQ-[0-9]+$" },
      ],
    };
    const issue = {
      issue: { id: 5, project: { id: 7, name: "P" }, tracker: { id: 1, name: "결함" }, status: { id: 1 }, allowed_statuses: [{ id: 2 }] },
    };
    const forbidden = Object.assign(new Error("403"), { response: { status: 403 } });

    beforeEach(() => {
      mockClient.getIssueDetails.mockResolvedValue(issue);
      mockClient.getProject = vi.fn().mockResolvedValue(projectFields);
      mockClient.getCustomFields = vi.fn().mockResolvedValue(defs);
    });

    it("should accept custom_fields alone as a valid update and show a dry_run preview", async () => {
      const args = updateIssueSchema.parse({ issue_id: 5, custom_fields: { "mcp-test 요청번호": "REQ-1" } });
      const result: any = await updateIssueHandler(args, mockClient);
      expect(mockClient.getIssueDetails).toHaveBeenCalledTimes(1);
      expect(mockClient.getProject).toHaveBeenCalledWith(7, { include: "issue_custom_fields" });
      expect(mockClient.updateIssue).not.toHaveBeenCalled();
      expect(result.updates).toEqual({ custom_fields: [{ id: 2, value: "REQ-1" }] });
      expect(result.custom_fields).toEqual([{ id: 2, name: "MCP-TEST 요청번호", value: "REQ-1" }]);
      expect(result.custom_field_validation.performed).toBe(true);
    });

    it("should reuse a single issue lookup for status validation and custom fields", async () => {
      const args = updateIssueSchema.parse({ issue_id: 5, status_id: 2, custom_fields: { "1": "A사" }, dry_run: false });
      await updateIssueHandler(args, mockClient);
      expect(mockClient.getIssueDetails).toHaveBeenCalledTimes(1);
      expect(mockClient.updateIssue).toHaveBeenCalledWith(5, { status_id: 2, custom_fields: [{ id: 1, value: "A사" }] });
    });

    it("should return validation errors without updating when admin checks fail", async () => {
      const args = updateIssueSchema.parse({ issue_id: 5, custom_fields: { "1": "Z사" }, dry_run: false });
      const result: any = await updateIssueHandler(args, mockClient);
      expect(mockClient.updateIssue).not.toHaveBeenCalled();
      expect(result.error).toMatch(/not updated/);
      expect(result.custom_field_errors[0]).toEqual(expect.objectContaining({ id: 1, allowed_values: ["A사"] }));
    });

    it("should use the issue's tracker for tracker enablement checks", async () => {
      mockClient.getIssueDetails.mockResolvedValue({ issue: { ...issue.issue, tracker: { id: 9 } } });
      const result: any = await updateIssueHandler(updateIssueSchema.parse({ issue_id: 5, custom_fields: { "1": "A사" } }), mockClient);
      expect(result.custom_field_errors[0].problem).toMatch(/tracker id 9/);
    });

    it("should skip pre-validation for non-admin keys and surface Redmine 422 messages", async () => {
      mockClient.getCustomFields = vi.fn().mockRejectedValue(forbidden);
      mockClient.updateIssue.mockRejectedValue({
        isAxiosError: true,
        response: { status: 422, data: { errors: ["MCP-TEST 요청번호 is invalid"] } },
      });
      const preview: any = await updateIssueHandler(updateIssueSchema.parse({ issue_id: 5, custom_fields: { "2": "123" } }), mockClient);
      expect(preview.custom_field_validation.performed).toBe(false);
      await expect(
        updateIssueHandler(updateIssueSchema.parse({ issue_id: 5, custom_fields: { "2": "123" }, dry_run: false }), mockClient)
      ).rejects.toThrow("MCP-TEST 요청번호 is invalid");
    });

    it("should throw when the issue's project cannot be determined", async () => {
      mockClient.getIssueDetails.mockResolvedValue({ issue: { id: 5 } });
      await expect(
        updateIssueHandler(updateIssueSchema.parse({ issue_id: 5, custom_fields: { "1": "A사" } }), mockClient)
      ).rejects.toThrow(/Cannot determine the project of issue 5/);
      expect(mockClient.getProject).not.toHaveBeenCalled();
    });

    it("should reject fields that the issue does not expose even for non-admin keys (review M1)", async () => {
      mockClient.getCustomFields = vi.fn().mockRejectedValue(forbidden);
      mockClient.getIssueDetails.mockResolvedValue({ issue: { ...issue.issue, custom_fields: [{ id: 2, name: "x", value: "" }] } });
      const result: any = await updateIssueHandler(
        updateIssueSchema.parse({ issue_id: 5, custom_fields: { "1": "A사" }, dry_run: false }),
        mockClient
      );
      expect(mockClient.updateIssue).not.toHaveBeenCalled();
      expect(result.custom_field_errors[0].problem).toMatch(/not available on this issue/);
    });

    it("should reject an empty custom_fields object in the schema", () => {
      expect(() => updateIssueSchema.parse({ issue_id: 5, custom_fields: {} })).toThrow();
    });
  });
});
