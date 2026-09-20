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

  describe("getTimeEntries", () => {
    it("should call GET /time_entries.json with query params and return data", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { time_entries: [{ id: 1, hours: 2 }], total_count: 1 },
      });
      (client as any).api = { get: mockGet };

      const params = { project_id: "test", limit: 25 };
      const result = await client.getTimeEntries(params);
      expect(mockGet).toHaveBeenCalledWith("/time_entries.json", { params });
      expect(result).toEqual({ time_entries: [{ id: 1, hours: 2 }], total_count: 1 });
    });
  });

  describe("getTimeEntryDetails", () => {
    it("should call GET /time_entries/:id.json and return data", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { time_entry: { id: 42, hours: 3 } },
      });
      (client as any).api = { get: mockGet };

      const result = await client.getTimeEntryDetails(42);
      expect(mockGet).toHaveBeenCalledWith("/time_entries/42.json");
      expect(result).toEqual({ time_entry: { id: 42, hours: 3 } });
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

  describe("getMyAccount", () => {
    it("should call GET /my/account.json with empty params by default", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { user: { id: 1, login: "admin", firstname: "Admin", lastname: "User" } },
      });
      (client as any).api = { get: mockGet };

      const result = await client.getMyAccount();

      expect(mockGet).toHaveBeenCalledWith("/my/account.json", { params: {} });
      expect(result).toEqual({
        user: { id: 1, login: "admin", firstname: "Admin", lastname: "User" },
      });
    });

    it("should pass include query parameter when memberships and groups are true", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 1,
            login: "admin",
            memberships: [{ id: 10 }],
            groups: [{ id: 20 }],
          },
        },
      });
      (client as any).api = { get: mockGet };

      const result = await client.getMyAccount({
        include_memberships: true,
        include_groups: true,
      });

      expect(mockGet).toHaveBeenCalledWith("/my/account.json", {
        params: { include: "memberships,groups" },
      });
      expect(result.user.memberships.length).toBe(1);
    });

    it("should fallback to GET /users/current.json when /my/account.json returns 404", async () => {
      const notFoundError: any = new Error("Not Found");
      notFoundError.response = { status: 404 };

      const mockGet = vi.fn()
        .mockRejectedValueOnce(notFoundError)
        .mockResolvedValueOnce({
          data: { user: { id: 1, login: "admin", mail: "admin@example.com" } },
        });
      (client as any).api = { get: mockGet };

      const result = await client.getMyAccount({ include_memberships: true });

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenNthCalledWith(1, "/my/account.json", {
        params: { include: "memberships" },
      });
      expect(mockGet).toHaveBeenNthCalledWith(2, "/users/current.json", {
        params: { include: "memberships" },
      });
      expect(result).toEqual({
        user: { id: 1, login: "admin", mail: "admin@example.com" },
      });
    });

    it("should not fallback and re-throw error when /my/account.json fails with non-404 status", async () => {
      const authError: any = new Error("Unauthorized");
      authError.response = { status: 401 };

      const mockGet = vi.fn().mockRejectedValueOnce(authError);
      (client as any).api = { get: mockGet };

      await expect(client.getMyAccount()).rejects.toThrow("Unauthorized");
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe("searchAll", () => {
    it("should call GET /search.json with minimal parameters (only q)", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { results: [], total_count: 0 },
      });
      (client as any).api = { get: mockGet };

      const result = await client.searchAll({ q: "test" });

      expect(mockGet).toHaveBeenCalledWith("/search.json", {
        params: { q: "test" },
      });
      expect(result).toEqual({ results: [], total_count: 0 });
    });

    it("should convert boolean flags to 1/0 and pass scope, limit, offset", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          results: [{ id: 1, title: "Test Result", type: "issue" }],
          total_count: 1,
          offset: 10,
          limit: 20,
        },
      });
      (client as any).api = { get: mockGet };

      const result = await client.searchAll({
        q: "bug fix",
        scope: "my_projects",
        open_issues: true,
        all_words: true,
        titles_only: false,
        issues: true,
        wiki_pages: false,
        news: true,
        documents: false,
        changesets: true,
        messages: false,
        projects: true,
        limit: 20,
        offset: 10,
      });

      expect(mockGet).toHaveBeenCalledWith("/search.json", {
        params: {
          q: "bug fix",
          scope: "my_projects",
          open_issues: 1,
          all_words: 1,
          titles_only: 0,
          issues: 1,
          wiki_pages: 0,
          news: 1,
          documents: 0,
          changesets: 1,
          messages: 0,
          projects: 1,
          limit: 20,
          offset: 10,
        },
      });
      expect(result.results.length).toBe(1);
    });

    it("should throw error if api.get throws", async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error("Network Error"));
      (client as any).api = { get: mockGet };

      await expect(client.searchAll({ q: "fail" })).rejects.toThrow("Network Error");
    });
  });

  describe("Issue Relations API", () => {
    it("should call GET /issues/:id/relations.json and return data", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { relations: [{ id: 1, issue_id: 10, issue_to_id: 20, relation_type: "blocks" }] },
      });
      (client as any).api = { get: mockGet };

      const result = await client.getIssueRelations(10);
      expect(mockGet).toHaveBeenCalledWith("/issues/10/relations.json");
      expect(result).toEqual({
        relations: [{ id: 1, issue_id: 10, issue_to_id: 20, relation_type: "blocks" }],
      });
    });

    it("should call POST /issues/:id/relations.json with payload", async () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: { relation: { id: 1, issue_id: 10, issue_to_id: 20, relation_type: "blocks" } },
      });
      (client as any).api = { post: mockPost };

      const relationData = { issue_to_id: 20, relation_type: "blocks", delay: 1 };
      const result = await client.createIssueRelation(10, relationData);
      expect(mockPost).toHaveBeenCalledWith("/issues/10/relations.json", {
        relation: relationData,
      });
      expect(result).toEqual({
        relation: { id: 1, issue_id: 10, issue_to_id: 20, relation_type: "blocks" },
      });
    });

    it("should call DELETE /relations/:id.json and return success message", async () => {
      const mockDelete = vi.fn().mockResolvedValue({ status: 200, data: "" });
      (client as any).api = { delete: mockDelete };

      const result = await client.deleteIssueRelation(99);
      expect(mockDelete).toHaveBeenCalledWith("/relations/99.json");
      expect(result).toEqual({
        message: "Relation 99 deleted successfully",
      });
    });
  });
});
