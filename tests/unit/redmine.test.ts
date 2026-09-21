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
  describe("Watchers API", () => {
    it("should call GET /issues/:id.json?include=watchers and return watchers array", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          issue: {
            id: 10,
            watchers: [
              { id: 1, name: "Admin" },
              { id: 2, name: "User" },
            ],
          },
        },
      });
      (client as any).api = { get: mockGet };

      const result = await client.getWatchers(10);
      expect(mockGet).toHaveBeenCalledWith("/issues/10.json", {
        params: { include: "watchers" },
      });
      expect(result).toEqual([
        { id: 1, name: "Admin" },
        { id: 2, name: "User" },
      ]);
    });

    it("should return empty array if watchers not present in issue data", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { issue: { id: 10 } },
      });
      (client as any).api = { get: mockGet };

      const result = await client.getWatchers(10);
      expect(result).toEqual([]);
    });

    it("should call POST /issues/:id/watchers.json with user_id", async () => {
      const mockPost = vi.fn().mockResolvedValue({ status: 204, data: "" });
      (client as any).api = { post: mockPost };

      const result = await client.addWatcher(10, 5);
      expect(mockPost).toHaveBeenCalledWith("/issues/10/watchers.json", {
        user_id: 5,
      });
      expect(result).toEqual({
        message: "User 5 added as watcher to issue 10 successfully",
      });
    });

    it("should return response.data if POST /issues/:id/watchers.json returns data", async () => {
      const mockPost = vi.fn().mockResolvedValue({ status: 200, data: { success: true } });
      (client as any).api = { post: mockPost };

      const result = await client.addWatcher(10, 5);
      expect(result).toEqual({ success: true });
    });

    it("should call DELETE /issues/:id/watchers/:user_id.json and return success message", async () => {
      const mockDelete = vi.fn().mockResolvedValue({ status: 200, data: "" });
      (client as any).api = { delete: mockDelete };

      const result = await client.removeWatcher(10, 5);
      expect(mockDelete).toHaveBeenCalledWith("/issues/10/watchers/5.json");
      expect(result).toEqual({
        message: "User 5 removed from watchers of issue 10 successfully",
      });
    });
  });

  describe("Versions API", () => {
    it("should call GET /projects/:project_id/versions.json and return data", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { versions: [{ id: 1, name: "v1.0" }] },
      });
      (client as any).api = { get: mockGet };

      const result = await client.getProjectVersions("my-project");
      expect(mockGet).toHaveBeenCalledWith("/projects/my-project/versions.json");
      expect(result).toEqual({ versions: [{ id: 1, name: "v1.0" }] });
    });

    it("should call GET /versions/:id.json and return version details", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { version: { id: 10, name: "v1.0.0", status: "open" } },
      });
      (client as any).api = { get: mockGet };

      const result = await client.getVersionDetails(10);
      expect(mockGet).toHaveBeenCalledWith("/versions/10.json");
      expect(result).toEqual({ version: { id: 10, name: "v1.0.0", status: "open" } });
    });

    it("should call POST /projects/:project_id/versions.json with payload", async () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: { version: { id: 11, name: "v1.1.0", status: "open" } },
      });
      (client as any).api = { post: mockPost };

      const versionData = { name: "v1.1.0", status: "open" as const, sharing: "tree" as const };
      const result = await client.createVersion("my-project", versionData);
      expect(mockPost).toHaveBeenCalledWith("/projects/my-project/versions.json", {
        version: versionData,
      });
      expect(result).toEqual({ version: { id: 11, name: "v1.1.0", status: "open" } });
    });

    it("should call PUT /versions/:id.json and return 204 normalized success message", async () => {
      const mockPut = vi.fn().mockResolvedValue({ status: 204, data: "" });
      (client as any).api = { put: mockPut };

      const versionData = { status: "closed" as const };
      const result = await client.updateVersion(11, versionData);
      expect(mockPut).toHaveBeenCalledWith("/versions/11.json", {
        version: versionData,
      });
      expect(result).toEqual({ message: "Version 11 updated successfully" });
    });

    it("should call PUT /versions/:id.json and return response.data if present", async () => {
      const mockPut = vi.fn().mockResolvedValue({ status: 200, data: { version: { id: 11, status: "closed" } } });
      (client as any).api = { put: mockPut };

      const versionData = { status: "closed" as const };
      const result = await client.updateVersion(11, versionData);
      expect(result).toEqual({ version: { id: 11, status: "closed" } });
    });

    it("should call DELETE /versions/:id.json and return success message", async () => {
      const mockDelete = vi.fn().mockResolvedValue({ status: 200, data: "" });
      (client as any).api = { delete: mockDelete };

      const result = await client.deleteVersion(11);
      expect(mockDelete).toHaveBeenCalledWith("/versions/11.json");
      expect(result).toEqual({ message: "Version 11 deleted successfully" });
    });
  });

  describe("uploadFile", () => {
    it("should call POST /uploads.json with binary content and headers", async () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: { upload: { token: "7167.ed1074a1a2" } },
      });
      (client as any).api = { post: mockPost };

      const content = Buffer.from("test file content");
      const result = await client.uploadFile("test.txt", content);

      expect(mockPost).toHaveBeenCalledWith("/uploads.json", content, {
        params: { filename: "test.txt" },
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });
      expect(result).toEqual({ upload: { token: "7167.ed1074a1a2" } });
    });

    it("should throw error if api.post throws", async () => {
      const mockPost = vi.fn().mockRejectedValue(new Error("Upload failed"));
      (client as any).api = { post: mockPost };

      await expect(
        client.uploadFile("test.txt", "some content")
      ).rejects.toThrow("Upload failed");
    });
  });

  describe("getAttachment", () => {
    it("should call GET /attachments/:id.json and return data", async () => {
      const mockAttachment = {
        attachment: {
          id: 42,
          filename: "test.log",
          filesize: 1024,
          content_type: "text/plain",
        },
      };
      const mockGet = vi.fn().mockResolvedValue({ data: mockAttachment });
      (client as any).api = { get: mockGet };

      const result = await client.getAttachment(42);
      expect(mockGet).toHaveBeenCalledWith("/attachments/42.json");
      expect(result).toEqual(mockAttachment);
    });

    it("should propagate errors from GET /attachments/:id.json", async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error("Attachment not found"));
      (client as any).api = { get: mockGet };

      await expect(client.getAttachment(999)).rejects.toThrow("Attachment not found");
    });
  });

  describe("downloadAttachment", () => {
    it("should call GET /attachments/download/:id/:filename with responseType arraybuffer", async () => {
      const bufferData = Buffer.from("file data");
      const mockGet = vi.fn().mockResolvedValue({ data: bufferData });
      (client as any).api = { get: mockGet };

      const result = await client.downloadAttachment(42, "test.log");
      expect(mockGet).toHaveBeenCalledWith("/attachments/download/42/test.log", {
        responseType: "arraybuffer",
      });
      expect(result).toEqual(bufferData);
    });

    it("should properly URL-encode filename with special characters or spaces", async () => {
      const bufferData = Buffer.from("file data with space");
      const mockGet = vi.fn().mockResolvedValue({ data: bufferData });
      (client as any).api = { get: mockGet };

      await client.downloadAttachment(42, "my report (v1).pdf");
      expect(mockGet).toHaveBeenCalledWith(
        `/attachments/download/42/${encodeURIComponent("my report (v1).pdf")}`,
        { responseType: "arraybuffer" }
      );
    });

    it("should propagate download errors", async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error("Download failed"));
      (client as any).api = { get: mockGet };

      await expect(client.downloadAttachment(42, "test.log")).rejects.toThrow("Download failed");
    });
  });
  describe("getIssues", () => {
    it("should call GET /issues.json with basic params", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { issues: [{ id: 1, subject: "Issue 1" }], total_count: 1 },
      });
      (client as any).api = { get: mockGet };

      const params = { project_id: "test-proj", status_id: "open", limit: 20 };
      const result = await client.getIssues(params);

      expect(mockGet).toHaveBeenCalledWith("/issues.json", { params });
      expect(result).toEqual({ issues: [{ id: 1, subject: "Issue 1" }], total_count: 1 });
    });

    it("should convert query param to subject: ~query and remove query", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { issues: [] },
      });
      (client as any).api = { get: mockGet };

      await client.getIssues({ query: "login error" });

      expect(mockGet).toHaveBeenCalledWith("/issues.json", {
        params: { subject: "~login error" },
      });
    });

    it("should handle custom_fields with or without cf_ prefix without double prefixing", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { issues: [] },
      });
      (client as any).api = { get: mockGet };

      await client.getIssues({
        custom_fields: {
          "cf_1": "prefixed",
          "2": "unprefixed",
        },
      });

      expect(mockGet).toHaveBeenCalledWith("/issues.json", {
        params: {
          cf_1: "prefixed",
          cf_2: "unprefixed",
        },
      });
    });

    it("should not overwrite subject if subject already specified, and ignore empty query", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { issues: [] },
      });
      (client as any).api = { get: mockGet };

      await client.getIssues({
        query: "ignored query",
        subject: "=Explicit Subject",
      });

      expect(mockGet).toHaveBeenCalledWith("/issues.json", {
        params: {
          subject: "=Explicit Subject",
        },
      });

      await client.getIssues({
        query: "   ",
      });

      expect(mockGet).toHaveBeenCalledWith("/issues.json", {
        params: {},
      });
    });

    it("should map custom_fields record to cf_X params and delete custom_fields", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { issues: [] },
      });
      (client as any).api = { get: mockGet };

      await client.getIssues({
        project_id: "proj-1",
        custom_fields: {
          "1": "feature",
          "2": 42,
        },
      });

      expect(mockGet).toHaveBeenCalledWith("/issues.json", {
        params: {
          project_id: "proj-1",
          cf_1: "feature",
          cf_2: 42,
        },
      });
    });

    it("should pass all extended filters correctly", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { issues: [] },
      });
      (client as any).api = { get: mockGet };

      const params = {
        project_id: "test-proj",
        subproject_id: "!*",
        issue_id: "1,2,3",
        parent_id: 10,
        status_id: "open",
        tracker_id: 1,
        priority_id: 2,
        category_id: 3,
        fixed_version_id: 4,
        assigned_to_id: "me",
        author_id: 5,
        query_id: 6,
        subject: "test",
        description: "details",
        created_on: ">=2026-09-01",
        updated_on: "<=2026-09-20",
        start_date: "2026-09-01",
        due_date: "2026-09-30",
        closed_on: "2026-09-20",
        estimated_hours: ">=4",
        done_ratio: 80,
        sort: "updated_on:desc",
        limit: 100,
        offset: 20,
        include: "attachments,relations",
      };

      await client.getIssues(params);

      expect(mockGet).toHaveBeenCalledWith("/issues.json", { params });
    });

    it("should propagate errors from GET /issues.json", async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error("Network Error"));
      (client as any).api = { get: mockGet };

      await expect(client.getIssues({ project_id: "fail" })).rejects.toThrow("Network Error");
    });
  });
});
