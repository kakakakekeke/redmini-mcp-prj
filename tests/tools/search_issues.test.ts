import { describe, it, expect, vi } from 'vitest';
import { searchIssuesSchema, searchIssuesHandler } from '../../src/tools/search_issues.js';

describe('search_issues tool', () => {
  describe('Schema Validation', () => {
    it('should validate valid parameters', () => {
      const args = { project_id: '1', status_id: 'open', limit: 20 };
      expect(() => searchIssuesSchema.parse(args)).not.toThrow();
    });

    it('should throw error if limit exceeds 50', () => {
      const args = { limit: 51 };
      expect(() => searchIssuesSchema.parse(args)).toThrow(/Limit must be at most 50/);
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
  });
});
