import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedmineClient } from '../../src/client/redmine';

describe('RedmineClient', () => {
  let client: RedmineClient;

  beforeEach(() => {
    client = new RedmineClient('http://localhost', 'dummy');
  });

  it('should paginate getUsers to fetch all users', async () => {
    // Mock this.api.get to return paginated results
    const mockGet = vi.fn();
    (client as any).api = { get: mockGet };

    mockGet
      .mockResolvedValueOnce({ data: { users: Array.from({length: 100}, (_, i) => ({ id: i })), total_count: 150 } })
      .mockResolvedValueOnce({ data: { users: Array.from({length: 50}, (_, i) => ({ id: 100 + i })), total_count: 150 } });

    const data = await client.getUsers();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(data.users.length).toBe(150);
  });

  it('should paginate getProjects to fetch all projects', async () => {
    // Mock this.api.get
    const mockGet = vi.fn();
    (client as any).api = { get: mockGet };

    mockGet
      .mockResolvedValueOnce({ data: { projects: Array.from({length: 100}, (_, i) => ({ id: i })), total_count: 101 } })
      .mockResolvedValueOnce({ data: { projects: [{ id: 100 }], total_count: 101 } });

    const data = await client.getProjects();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(data.projects.length).toBe(101);
  });

  describe('addIssueNote', () => {
    it('should call PUT /issues/:id.json and normalize 204 No Content to {}', async () => {
      const mockPut = vi.fn().mockResolvedValue({ status: 204, data: '' });
      (client as any).api = { put: mockPut };

      const result = await client.addIssueNote({
        issue_id: 42,
        notes: 'Test comment',
        private_notes: true,
      });

      expect(mockPut).toHaveBeenCalledWith('/issues/42.json', {
        issue: {
          notes: 'Test comment',
          private_notes: true,
        },
      });
      expect(result).toEqual({});
    });

    it('should return response data when status is not 204', async () => {
      const mockPut = vi.fn().mockResolvedValue({ status: 200, data: { issue: { id: 42 } } });
      (client as any).api = { put: mockPut };

      const result = await client.addIssueNote({
        issue_id: 42,
        notes: 'Test comment',
      });

      expect(result).toEqual({ issue: { id: 42 } });
    });
  });

  describe("getTimeEntryActivities", () => {
    it("should call GET /enumerations/time_entry_activities.json and return data", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { time_entry_activities: [{ id: 1, name: "Design" }] },
      });
      (client as any).api = { get: mockGet };

      const result = await client.getTimeEntryActivities();
      expect(mockGet).toHaveBeenCalledWith("/enumerations/time_entry_activities.json");
      expect(result).toEqual({
        time_entry_activities: [{ id: 1, name: "Design" }],
      });
    });
  });

  describe("createTimeEntry", () => {
    it("should call POST /time_entries.json with payload", async () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: { time_entry: { id: 123, hours: 2 } },
      });
      (client as any).api = { post: mockPost };

      const payload = { time_entry: { issue_id: 1, hours: 2 } };
      const result = await client.createTimeEntry(payload);
      expect(mockPost).toHaveBeenCalledWith("/time_entries.json", payload);
      expect(result).toEqual({ time_entry: { id: 123, hours: 2 } });
    });
  });
});
