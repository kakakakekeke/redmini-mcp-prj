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

    it('should set dry_run default to false', () => {
      const args = { project_id: '1', subject: 'Test' };
      const parsed = createIssueSchema.parse(args);
      expect(parsed.dry_run).toBe(false);
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
      
      const args = { project_id: 'test-project', subject: 'Test', dry_run: true };
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
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
      };
      
      const args = { project_id: '1', subject: 'Test', tracker: '결함' };
      const parsedArgs = createIssueSchema.parse(args);
      
      const result = await createIssueHandler(parsedArgs, mockClient as any);
      
      expect(mockClient.createIssue).toHaveBeenCalledWith({ issue: expect.objectContaining({
        project_id: '1',
        subject: 'Test',
        tracker_id: 2
      }) });
      expect(result).toEqual({ issue: { id: 123 } });
    });
  });
});
