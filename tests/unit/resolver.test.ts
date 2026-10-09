import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartNameResolver } from '../../src/client/resolver';
import { RedmineClient } from '../../src/client/redmine';

vi.mock('../../src/client/redmine');

describe('SmartNameResolver', () => {
  let client: RedmineClient;
  let resolver: SmartNameResolver;

  beforeEach(() => {
    client = new RedmineClient('http://localhost', 'dummy');
    
    // Mock implementations
    client.getProjects = vi.fn().mockResolvedValue({ projects: [{ id: 1, name: 'Project A' }, { id: 2, name: 'Project B' }] });
    client.getTrackers = vi.fn().mockResolvedValue({ trackers: [{ id: 1, name: 'Bug' }, { id: 2, name: 'Feature' }] });
    client.getStatuses = vi.fn().mockResolvedValue({ issue_statuses: [{ id: 1, name: 'New' }, { id: 2, name: 'In Progress' }] });
    client.getPriorities = vi.fn().mockResolvedValue({ issue_priorities: [{ id: 1, name: 'Low' }, { id: 2, name: 'High' }] });
    client.getUsers = vi.fn().mockResolvedValue({ users: [{ id: 1, firstname: 'John', lastname: 'Doe', login: 'jdoe' }] });
    client.getTimeEntryActivities = vi.fn().mockResolvedValue({ time_entry_activities: [{ id: 1, name: 'Design' }, { id: 2, name: 'Development' }] });

    resolver = new SmartNameResolver(client);
  });

  it('should load metadata', async () => {
    await resolver.load();
    expect(client.getProjects).toHaveBeenCalled();
    expect(client.getTrackers).toHaveBeenCalled();
    expect(client.getStatuses).toHaveBeenCalled();
    expect(client.getPriorities).toHaveBeenCalled();
    expect(client.getUsers).toHaveBeenCalled();
  });

  it('should resolve project by name', async () => {
    await resolver.load();
    expect(resolver.resolveProject('Project A')).toBe(1);
    expect(resolver.resolveProject('project b')).toBe(2);
    expect(resolver.resolveProject('Unknown')).toBeUndefined();
    expect(resolver.resolveProject(undefined as any)).toBeUndefined();
  });

  it('should index both project name and identifier', async () => {
    client.getProjects = vi.fn().mockResolvedValue({
      projects: [{ id: 10, name: "Infrastructure Core", identifier: "infra-core" }],
    });
    await resolver.load(true);
    expect(resolver.resolveProject("Infrastructure Core")).toBe(10);
    expect(resolver.resolveProject("infra-core")).toBe(10);
  });

  it('should resolve tracker by name', async () => {
    await resolver.load();
    expect(resolver.resolveTracker('Bug')).toBe(1);
    expect(resolver.resolveTracker('feature')).toBe(2);
    expect(resolver.resolveTracker(undefined as any)).toBeUndefined();
  });

  it('should resolve status by name', async () => {
    await resolver.load();
    expect(resolver.resolveStatus('New')).toBe(1);
    expect(resolver.resolveStatus('in progress')).toBe(2);
    expect(resolver.resolveStatus(undefined as any)).toBeUndefined();
  });

  it('should resolve priority by name', async () => {
    await resolver.load();
    expect(resolver.resolvePriority('Low')).toBe(1);
    expect(resolver.resolvePriority('high')).toBe(2);
    expect(resolver.resolvePriority(undefined as any)).toBeUndefined();
  });

  it('should resolve user by name or login', async () => {
    await resolver.load();
    expect(resolver.resolveUser('John Doe')).toBe(1);
    expect(resolver.resolveUser('jdoe')).toBe(1);
    expect(resolver.resolveUser('Unknown')).toBeUndefined();
    expect(resolver.resolveUser(undefined as any)).toBeUndefined();
  });

  it('should resolve activity by name', async () => {
    await resolver.load();
    expect(resolver.resolveActivity('Design')).toBe(1);
    expect(resolver.resolveActivity('development')).toBe(2);
    expect(resolver.resolveActivity(undefined as any)).toBeUndefined();
  });

  it('should tolerate partial failures in load', async () => {
    // Simulate failure in getUsers
    client.getUsers = vi.fn().mockRejectedValue(new Error('API Error'));
    await resolver.load();

    // Still successfully mapped other entities
    expect(resolver.resolveProject('Project A')).toBe(1);
    // User should not be found
    expect(resolver.resolveUser('John Doe')).toBeUndefined();
  });
  describe("TTL In-Memory Cache", () => {
    it("should not refetch Redmine data if called multiple times within cache TTL", async () => {
      await resolver.load();
      expect(client.getProjects).toHaveBeenCalledTimes(1);

      await resolver.load();
      await resolver.load();
      expect(client.getProjects).toHaveBeenCalledTimes(1);
    });

    it("should refetch Redmine data if force=true is passed to load()", async () => {
      await resolver.load();
      expect(client.getProjects).toHaveBeenCalledTimes(1);

      await resolver.load(true);
      expect(client.getProjects).toHaveBeenCalledTimes(2);
    });

    it("should refetch Redmine data after clearCache() is called", async () => {
      await resolver.load();
      expect(client.getProjects).toHaveBeenCalledTimes(1);

      resolver.clearCache();
      await resolver.load();
      expect(client.getProjects).toHaveBeenCalledTimes(2);
    });

    it("should refetch Redmine data after TTL expires", async () => {
      const shortTtlResolver = new SmartNameResolver(client, 50); // 50ms TTL
      await shortTtlResolver.load();
      expect(client.getProjects).toHaveBeenCalledTimes(1);

      await new Promise((r) => setTimeout(r, 60));
      await shortTtlResolver.load();
      expect(client.getProjects).toHaveBeenCalledTimes(2);
    });
  });

  describe("Saved queries (resolveSavedQuery)", () => {
    const queries = [
      { id: 1, name: "내 미해결 결함", is_public: false },
      { id: 2, name: "릴리스 점검", is_public: true, project_id: 10 },
      { id: 3, name: "릴리스 점검", is_public: true, project_id: 20 },
      { id: 4, name: "주간 보고", is_public: true },
      { id: 5, name: "주간 보고", is_public: true, project_id: 10 },
      { id: 6, name: "중복 전역", is_public: true },
      { id: 7, name: "중복 전역", is_public: false },
    ];

    beforeEach(() => {
      (client as any).getAllQueries = vi.fn().mockResolvedValue({ queries, total_count: queries.length, truncated: false });
    });

    it("should not fetch saved queries in load() (lazy, separate cache)", async () => {
      await resolver.load();
      expect((client as any).getAllQueries).not.toHaveBeenCalled();
    });

    it("should cache saved queries within TTL and refetch on force or clearCache", async () => {
      await resolver.loadSavedQueries();
      await resolver.loadSavedQueries();
      expect((client as any).getAllQueries).toHaveBeenCalledTimes(1);

      await resolver.loadSavedQueries(true);
      expect((client as any).getAllQueries).toHaveBeenCalledTimes(2);

      resolver.clearCache();
      await resolver.loadSavedQueries();
      expect((client as any).getAllQueries).toHaveBeenCalledTimes(3);
    });

    it("should refetch saved queries after TTL expires", async () => {
      const shortTtlResolver = new SmartNameResolver(client, 50);
      await shortTtlResolver.loadSavedQueries();
      await new Promise((r) => setTimeout(r, 60));
      await shortTtlResolver.loadSavedQueries();
      expect((client as any).getAllQueries).toHaveBeenCalledTimes(2);
    });

    it("should propagate fetch errors from loadSavedQueries", async () => {
      (client as any).getAllQueries = vi.fn().mockRejectedValue(new Error("403 Forbidden"));
      await expect(resolver.loadSavedQueries()).rejects.toThrow("403 Forbidden");
    });

    it("should resolve a unique name case-insensitively with trimming", async () => {
      (client as any).getAllQueries = vi.fn().mockResolvedValue({
        queries: [{ id: 9, name: "Open Bugs" }],
        total_count: 1,
        truncated: false,
      });
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("  open bugs ");
      expect(r).toEqual({ status: "resolved", query: { id: 9, name: "Open Bugs", is_public: undefined, project_id: undefined } });
    });

    it("should resolve Korean names regardless of Unicode normalization form (NFC/NFD)", async () => {
      await resolver.loadSavedQueries();
      const nfd = "내 미해결 결함".normalize("NFD");
      const r = resolver.resolveSavedQuery(nfd);
      expect(r.status).toBe("resolved");
      if (r.status === "resolved") expect(r.query.id).toBe(1);
    });

    it("should return not_found without unrelated candidates when nothing is similar", async () => {
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("없는 필터");
      expect(r.status).toBe("not_found");
      expect(r.candidates).toEqual([]);
    });

    it("should return only partial matches as not_found candidates", async () => {
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("보고");
      expect(r.status).toBe("not_found");
      expect(r.candidates.map((q) => q.id)).toEqual([4, 5]);
    });

    it("should resolve a single project-specific match when no project is given (caller scopes the request)", async () => {
      (client as any).getAllQueries = vi.fn().mockResolvedValue({
        queries: [{ id: 2, name: "릴리스 점검", project_id: 10 }],
        total_count: 1,
        truncated: false,
      });
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("릴리스 점검");
      expect(r.status).toBe("resolved");
      if (r.status === "resolved") expect(r.query.project_id).toBe(10);
    });

    it("should report other_project when the only match belongs to a different project (Redmine would 404)", async () => {
      (client as any).getAllQueries = vi.fn().mockResolvedValue({
        queries: [{ id: 2, name: "릴리스 점검", project_id: 10 }],
        total_count: 1,
        truncated: false,
      });
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("릴리스 점검", 20);
      expect(r.status).toBe("other_project");
      expect(r.candidates.map((q) => q.id)).toEqual([2]);
    });

    it("should match names ignoring invisible format characters", async () => {
      (client as any).getAllQueries = vi.fn().mockResolvedValue({
        queries: [{ id: 3, name: `주간${String.fromCharCode(0x200b)} 보고` }],
        total_count: 1,
        truncated: false,
      });
      await resolver.loadSavedQueries();
      expect(resolver.resolveSavedQuery("주간 보고").status).toBe("resolved");
    });

    it("should de-duplicate saved queries by id (pages shifting between requests)", async () => {
      (client as any).getAllQueries = vi.fn().mockResolvedValue({
        queries: [{ id: 3, name: "dup" }, { id: 3, name: "dup" }],
        total_count: 2,
        truncated: false,
      });
      await resolver.loadSavedQueries();
      expect(resolver.resolveSavedQuery("dup").status).toBe("resolved");
      expect(resolver.getSavedQueries()).toHaveLength(1);
    });

    it("should prefer the query of the given project when the name is duplicated", async () => {
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("릴리스 점검", 20);
      expect(r.status).toBe("resolved");
      if (r.status === "resolved") expect(r.query.id).toBe(3);
    });

    it("should fall back to the global query when no project-specific match exists", async () => {
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("주간 보고", 99);
      expect(r.status).toBe("resolved");
      if (r.status === "resolved") expect(r.query.id).toBe(4);
    });

    it("should prefer the global query when no project is given", async () => {
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("주간 보고");
      expect(r.status).toBe("resolved");
      if (r.status === "resolved") expect(r.query.id).toBe(4);
    });

    it("should return ambiguous when duplicates exist only in other projects", async () => {
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("릴리스 점검");
      expect(r.status).toBe("ambiguous");
      expect(r.candidates.map((q) => q.id)).toEqual([2, 3]);

      const r2 = resolver.resolveSavedQuery("릴리스 점검", 99);
      expect(r2.status).toBe("other_project");
      expect(r2.candidates.map((q) => q.id)).toEqual([2, 3]);
    });

    it("should return ambiguous when several global queries share the name", async () => {
      await resolver.loadSavedQueries();
      const r = resolver.resolveSavedQuery("중복 전역", 10);
      expect(r.status).toBe("ambiguous");
      expect(r.candidates.map((q) => q.id)).toEqual([6, 7]);
    });

    it("should ignore malformed entries returned by the API", async () => {
      (client as any).getAllQueries = vi.fn().mockResolvedValue({
        queries: [
          null,
          { id: "x", name: "bad id" },
          { id: -1, name: "negative" },
          { id: 11, name: 123 },
          { id: 12, name: "__proto__" },
          { id: 13, name: "valid", project_id: "oops" },
        ],
        total_count: 6,
        truncated: false,
      });
      await resolver.loadSavedQueries();
      expect(resolver.resolveSavedQuery("bad id").status).toBe("not_found");
      const proto = resolver.resolveSavedQuery("__proto__");
      expect(proto.status).toBe("resolved");
      const valid = resolver.resolveSavedQuery("valid");
      expect(valid).toEqual({ status: "resolved", query: { id: 13, name: "valid", is_public: undefined, project_id: undefined } });
    });

    it("should expose whether the saved query list was truncated", async () => {
      (client as any).getAllQueries = vi.fn().mockResolvedValue({ queries: [], total_count: 0, truncated: true });
      await resolver.loadSavedQueries();
      expect(resolver.savedQueriesTruncated).toBe(true);
      expect(resolver.getSavedQueries()).toEqual([]);
    });

    it("should return not_found for empty input", async () => {
      await resolver.loadSavedQueries();
      expect(resolver.resolveSavedQuery("   ").status).toBe("not_found");
    });
  });
});
