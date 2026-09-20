import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateIssueHandler } from "../../src/tools/update_issue";
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
});
