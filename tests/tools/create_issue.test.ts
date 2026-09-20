import { describe, it, expect, vi } from 'vitest';
import { createIssueSchema, createIssueHandler } from '../../src/tools/create_issue.js';

describe('create_issue tool', () => {
  describe('Schema Validation', () => {
    it('should validate valid parameters', () => {
      const args = { project_id: '1', subject: 'Test Issue' };
      expect(() => createIssueSchema.parse(args)).not.toThrow();
    });

    it('should reject missing project_id', () => {
      expect(() => createIssueSchema.parse({ subject: 'Test Issue' })).toThrow();
    });

    it('should reject missing subject', () => {
      expect(() => createIssueSchema.parse({ project_id: '1' })).toThrow();
    });

    it('should reject invalid due_date', () => {
      expect(() => createIssueSchema.parse({ project_id: '1', subject: 'Test', due_date: '2023/01/01' })).toThrow();
    });

    it('should reject negative estimated_hours', () => {
      expect(() => createIssueSchema.parse({ project_id: '1', subject: 'Test', estimated_hours: -5 })).toThrow();
    });

    it('should set dry_run default to true', () => {
      const args = { project_id: '1', subject: 'Test' };
      const parsed = createIssueSchema.parse(args);
      expect(parsed.dry_run).toBe(true);
    });
  });

  describe('Handler Logic', () => {
    it('should handle dry_run=true without calling API', async () => {
      const mockClient = {
        createIssue: vi.fn(),
        getProjects: vi.fn().mockResolvedValue({ projects: [] }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
      };
      
      const args = { project_id: 'test-project', subject: 'Test' };
      const parsedArgs = createIssueSchema.parse(args);
      
      const result = await createIssueHandler(parsedArgs, mockClient as any);
      
      expect(mockClient.createIssue).not.toHaveBeenCalled();
      expect(result).toHaveProperty('dry_run', true);
      expect(result).toHaveProperty('payload');
    });

    it('should resolve names and call API when dry_run=false', async () => {
      const mockClient = {
        createIssue: vi.fn().mockResolvedValue({ issue: { id: 123 } }),
        getProjects: vi.fn().mockResolvedValue({ projects: [] }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [{ id: 2, name: '결함' }] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [{ id: 3, name: '진행중' }] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [{ id: 4, name: '높음' }] }),
        getUsers: vi.fn().mockResolvedValue({ users: [{ id: 5, firstname: '홍', lastname: '길동', login: 'hong' }] }),
      };
      
      const args = { project_id: '1', subject: 'Test', tracker: '결함', status: '진행중', priority: '높음', assignee: '홍 길동', dry_run: false };
      const parsedArgs = createIssueSchema.parse(args);
      
      const result = await createIssueHandler(parsedArgs, mockClient as any);
      
      expect(mockClient.createIssue).toHaveBeenCalledWith({ issue: expect.objectContaining({
        project_id: '1',
        subject: 'Test',
        tracker_id: 2,
        status_id: 3,
        priority_id: 4,
        assigned_to_id: 5
      }) });
      expect(result).toEqual({ issue: { id: 123 } });
    });
  });
});
