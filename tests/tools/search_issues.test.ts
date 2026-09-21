import { describe, it, expect, vi } from 'vitest';
import { searchIssuesSchema, searchIssuesHandler } from '../../src/tools/search_issues.js';

describe('search_issues tool', () => {
  describe('Schema Validation', () => {
    it('should validate valid parameters with legacy fields', () => {
      const args = { project_id: '1', status_id: 'open', limit: 20 };
      expect(() => searchIssuesSchema.parse(args)).not.toThrow();
    });

    it('should validate all extended parameters', () => {
      const args = {
        project_id: 'proj-slug',
        subproject_id: '!*',
        issue_id: '1,2,3',
        parent_id: 10,
        status_id: 'open',
        status: '진행중',
        tracker_id: 2,
        tracker: '결함',
        priority_id: 3,
        priority: '높음',
        category_id: 4,
        fixed_version_id: 5,
        assigned_to_id: 'me',
        assigned_to: '홍길동',
        author_id: 1,
        author: 'admin',
        query_id: 42,
        query: '검색어',
        subject: '~일감제목',
        description: '~본문내용',
        created_on: '>=2026-09-01',
        updated_on: '><2026-09-01|2026-09-18',
        start_date: '2026-09-01',
        due_date: '<=2026-09-30',
        closed_on: '2026-09-20',
        estimated_hours: '>=4',
        done_ratio: 80,
        custom_fields: { '1': 'alpha', '2': 100 },
        sort: 'updated_on:desc,priority:desc',
        limit: 100,
        offset: 20,
        include: 'attachments,relations',
        project: '테스트 프로젝트',
      };
      const parsed = searchIssuesSchema.parse(args);
      expect(parsed.limit).toBe(100);
      expect(parsed.offset).toBe(20);
      expect(parsed.custom_fields).toEqual({ '1': 'alpha', '2': 100 });
      expect(parsed.subproject_id).toBe('!*');
      expect(parsed.issue_id).toBe('1,2,3');
    });

    it("should accept project_id with underscore", () => {
      expect(() => searchIssuesSchema.parse({ project_id: "my_project_1" })).not.toThrow();
    });

    it("should accept custom_fields with cf_ prefix", () => {
      expect(() => searchIssuesSchema.parse({ custom_fields: { cf_10: "test", "20": 100 } })).not.toThrow();
    });

    it("should reject custom_fields with non-numeric key", () => {
      expect(() => searchIssuesSchema.parse({ custom_fields: { invalid_key: "test" } })).toThrow();
    });

    it('should allow limit up to 100', () => {
      const args = { limit: 100 };
      const parsed = searchIssuesSchema.parse(args);
      expect(parsed.limit).toBe(100);
    });

    it('should throw error if limit exceeds 100', () => {
      const args = { limit: 101 };
      expect(() => searchIssuesSchema.parse(args)).toThrow(/Limit must be at most 100/);
    });

    it('should reject negative offset', () => {
      expect(() => searchIssuesSchema.parse({ offset: -1 })).toThrow();
    });

    it('should reject invalid project_id', () => {
      expect(() => searchIssuesSchema.parse({ project_id: 'invalid_id!' })).toThrow(/Invalid project_id/);
    });

    it('should reject invalid status_id', () => {
      expect(() => searchIssuesSchema.parse({ status_id: 'progress' })).toThrow(/Invalid status_id/);
    });

    it('should reject invalid assigned_to_id', () => {
      expect(() => searchIssuesSchema.parse({ assigned_to_id: 'admin' })).toThrow(/Invalid assigned_to_id/);
    });

    it('should reject invalid subproject_id', () => {
      expect(() => searchIssuesSchema.parse({ subproject_id: 'invalid' })).toThrow(/Invalid subproject_id/);
    });

    it('should reject invalid issue_id', () => {
      expect(() => searchIssuesSchema.parse({ issue_id: 'abc' })).toThrow(/Invalid issue_id/);
    });

    it('should reject query exceeding 100 characters', () => {
      const longQuery = 'a'.repeat(101);
      expect(() => searchIssuesSchema.parse({ query: longQuery })).toThrow(/Query too long/);
    });

    it('should apply default limit of 10 if not provided', () => {
      const args = {};
      const parsed = searchIssuesSchema.parse(args);
      expect(parsed.limit).toBe(10);
    });
  });

  describe('Handler Logic', () => {
    it('should call RedmineClient with correct parameters', async () => {
      const mockClient = {
        getIssues: vi.fn().mockResolvedValue({ issues: [{ id: 1, subject: 'Test' }] })
      };
      
      const args = { project_id: '1', status_id: 'open', limit: 10 };
      const parsedArgs = searchIssuesSchema.parse(args);
      
      const result = await searchIssuesHandler(parsedArgs, mockClient as any);
      
      expect(mockClient.getIssues).toHaveBeenCalledWith({
        project_id: '1',
        status_id: 'open',
        limit: 10
      });
      expect(result).toEqual({ issues: [{ id: 1, subject: 'Test' }] });
    });
    
    it('should handle assigned_to_id="me"', async () => {
      const mockClient = {
        getIssues: vi.fn().mockResolvedValue({ issues: [] })
      };
      
      const args = { assigned_to_id: 'me', limit: 10 };
      const parsedArgs = searchIssuesSchema.parse(args);
      
      await searchIssuesHandler(parsedArgs, mockClient as any);
      
      expect(mockClient.getIssues).toHaveBeenCalledWith({
        assigned_to_id: 'me',
        limit: 10
      });
    });

    it('should pass all expanded filters to RedmineClient.getIssues', async () => {
      const mockClient = {
        getIssues: vi.fn().mockResolvedValue({ issues: [], total_count: 0 })
      };

      const args = {
        project_id: 'my-project',
        subproject_id: '!*',
        issue_id: '10,20',
        parent_id: 5,
        status_id: 'open',
        tracker_id: 1,
        priority_id: 2,
        category_id: 3,
        fixed_version_id: 4,
        assigned_to_id: 'me',
        author_id: 100,
        query_id: 7,
        query: '검색어',
        subject: '~제목',
        description: '~본문',
        created_on: '>=2026-09-01',
        updated_on: '<=2026-09-20',
        start_date: '2026-09-01',
        due_date: '2026-09-30',
        closed_on: '2026-09-20',
        estimated_hours: '>=4',
        done_ratio: 50,
        custom_fields: { '1': 'val' },
        sort: 'created_on:desc',
        limit: 50,
        offset: 10,
        include: 'attachments,relations',
      };

      const parsedArgs = searchIssuesSchema.parse(args);
      await searchIssuesHandler(parsedArgs, mockClient as any);

      expect(mockClient.getIssues).toHaveBeenCalledWith({
        project_id: 'my-project',
        subproject_id: '!*',
        issue_id: '10,20',
        parent_id: 5,
        status_id: 'open',
        tracker_id: 1,
        priority_id: 2,
        category_id: 3,
        fixed_version_id: 4,
        assigned_to_id: 'me',
        author_id: 100,
        query_id: 7,
        query: '검색어',
        subject: '~제목',
        description: '~본문',
        created_on: '>=2026-09-01',
        updated_on: '<=2026-09-20',
        start_date: '2026-09-01',
        due_date: '2026-09-30',
        closed_on: '2026-09-20',
        estimated_hours: '>=4',
        done_ratio: 50,
        custom_fields: { '1': 'val' },
        sort: 'created_on:desc',
        limit: 50,
        offset: 10,
        include: 'attachments,relations',
      });
    });

    it('should resolve natural language names via SmartNameResolver (project, status, tracker, priority, assigned_to, author)', async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({ projects: [{ id: 10, name: '테스트 프로젝트' }] }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [{ id: 1, name: '결함' }] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [{ id: 2, name: '진행중' }] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [{ id: 4, name: '높음' }] }),
        getUsers: vi.fn().mockResolvedValue({
          users: [
            { id: 20, firstname: '홍', lastname: '길동', login: 'hong' },
            { id: 30, firstname: '관리자', lastname: '', login: 'admin' },
          ],
        }),
        getIssues: vi.fn().mockResolvedValue({ issues: [] }),
      };

      const args = {
        project: '테스트 프로젝트',
        status: '진행중',
        tracker: '결함',
        priority: '높음',
        assigned_to: '홍 길동',
        author: 'admin',
      };

      const parsedArgs = searchIssuesSchema.parse(args);
      await searchIssuesHandler(parsedArgs, mockClient as any);

      expect(mockClient.getIssues).toHaveBeenCalledWith({
        project_id: '10',
        status_id: '2',
        tracker_id: '1',
        priority_id: '4',
        assigned_to_id: '20',
        author_id: '30',
        limit: 10,
      });
    });

    it('should not overwrite explicit ID if natural language name is also provided', async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({ projects: [{ id: 10, name: '프로젝트 A' }] }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [{ id: 1, name: '결함' }] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [{ id: 2, name: '진행중' }] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [{ id: 4, name: '높음' }] }),
        getUsers: vi.fn().mockResolvedValue({ users: [{ id: 20, firstname: '길동', lastname: '홍', login: 'hong' }] }),
        getIssues: vi.fn().mockResolvedValue({ issues: [] }),
      };

      const args = {
        priority: '높음',
        priority_id: 99,
        assigned_to: 'hong',
        assigned_to_id: '999',
      };

      const parsedArgs = searchIssuesSchema.parse(args);
      await searchIssuesHandler(parsedArgs, mockClient as any);

      expect(mockClient.getIssues).toHaveBeenCalledWith({
        priority_id: 99,
        assigned_to_id: '999',
        limit: 10,
      });
    });

    it("should handle assigned_to='me' and author='me' directly without resolver", async () => {
      const mockClient = {
        getIssues: vi.fn().mockResolvedValue({ issues: [] }),
        getUsers: vi.fn(),
      };

      const args = { assigned_to: "me", author: "ME" };
      const parsed = searchIssuesSchema.parse(args);
      await searchIssuesHandler(parsed, mockClient as any);

      expect(mockClient.getIssues).toHaveBeenCalledWith({
        assigned_to_id: "me",
        author_id: "me",
        limit: 10,
      });
      expect(mockClient.getUsers).not.toHaveBeenCalled();
    });

    it("should throw error (fail-close) if natural language entity cannot be resolved", async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({ projects: [] }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
        getIssues: vi.fn(),
      };

      await expect(searchIssuesHandler(searchIssuesSchema.parse({ project: "nonexistent" }), mockClient as any))
        .rejects.toThrow("Project not found: nonexistent");

      await expect(searchIssuesHandler(searchIssuesSchema.parse({ status: "nonexistent" }), mockClient as any))
        .rejects.toThrow("Status not found: nonexistent");

      await expect(searchIssuesHandler(searchIssuesSchema.parse({ tracker: "nonexistent" }), mockClient as any))
        .rejects.toThrow("Tracker not found: nonexistent");

      await expect(searchIssuesHandler(searchIssuesSchema.parse({ priority: "nonexistent" }), mockClient as any))
        .rejects.toThrow("Priority not found: nonexistent");

      await expect(searchIssuesHandler(searchIssuesSchema.parse({ assigned_to: "nonexistent" }), mockClient as any))
        .rejects.toThrow("Assigned user not found: nonexistent");

      await expect(searchIssuesHandler(searchIssuesSchema.parse({ author: "nonexistent" }), mockClient as any))
        .rejects.toThrow("Author user not found: nonexistent");
    });
  });
});
