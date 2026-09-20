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

  describe("createOrUpdateWiki", () => {
    it("should call PUT /projects/:project_id/wiki/:title.json and return 201 Created response", async () => {
      const mockPut = vi.fn().mockResolvedValue({
        status: 201,
        data: {
          wiki_page: {
            title: "API_Docs",
            version: 1,
            text: "# API Documentation",
            created_on: "2026-09-20T12:00:00Z",
          },
        },
      });
      (client as any).api = { put: mockPut };

      const result = await client.createOrUpdateWiki({
        project_id: "my-project",
        title: "API Docs",
        text: "# API Documentation",
        comments: "Initial docs",
        parent_title: "Home",
      });

      expect(mockPut).toHaveBeenCalledWith("/projects/my-project/wiki/API%20Docs.json", {
        wiki_page: {
          text: "# API Documentation",
          comments: "Initial docs",
          parent_title: "Home",
        },
      });
      expect(result).toEqual({
        message: "Wiki page 'API Docs' created successfully.",
        wiki_page: {
          title: "API_Docs",
          version: 1,
          text: "# API Documentation",
          created_on: "2026-09-20T12:00:00Z",
        },
      });
    });

it("should normalize 204 No Content or empty data to success message on update", async () => {
      const mockPut = vi.fn().mockResolvedValue({
        status: 204,
        data: "",
      });
      (client as any).api = { put: mockPut };

      const result = await client.createOrUpdateWiki({
        project_id: "my-project",
        title: "Home",
        text: "Updated content",
        version: 2,
      });

      expect(mockPut).toHaveBeenCalledWith("/projects/my-project/wiki/Home.json", {
        wiki_page: {
          text: "Updated content",
          version: 2,
        },
      });
      expect(result).toEqual({
        message: "Wiki page 'Home' updated successfully.",
      });
    });

    it("should properly encode Korean characters and symbols in wiki title", async () => {
      const mockPut = vi.fn().mockResolvedValue({ status: 204, data: "" });
      (client as any).api = { put: mockPut };

      await client.createOrUpdateWiki({
        project_id: "my-project",
        title: "개발 가이드 & FAQ",
        text: "본문 내용",
      });

      expect(mockPut).toHaveBeenCalledWith(
        "/projects/my-project/wiki/%EA%B0%9C%EB%B0%9C%20%EA%B0%80%EC%9D%B4%EB%93%9C%20%26%20FAQ.json",
        expect.anything()
      );
    });
  });
});
