import { describe, it, expect, vi } from 'vitest';
import { getProjectsSchema, getProjectsHandler } from '../../src/tools/get_projects.js';

describe('get_projects tool', () => {
  describe('Schema Validation', () => {
    it('should validate valid parameters', () => {
      const args = { include_archived: true };
      expect(() => getProjectsSchema.parse(args)).not.toThrow();
    });

    it('should apply default include_archived of false if not provided', () => {
      const args = {};
      const parsed = getProjectsSchema.parse(args);
      expect(parsed.include_archived).toBe(false);
    });
  });

  describe('Handler Logic', () => {
    it('should call RedmineClient with correct parameters', async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({ projects: [{ id: 1, name: 'Test Project' }] })
      };
      
      const args = { include_archived: true };
      const parsedArgs = getProjectsSchema.parse(args);
      
      const result = await getProjectsHandler(parsedArgs, mockClient as any);
      
      expect(mockClient.getProjects).toHaveBeenCalledWith({
        include_archived: true
      });
      expect(result).toEqual({ projects: [{ id: 1, name: 'Test Project' }] });
    });
    
    it('should handle default arguments', async () => {
      const mockClient = {
        getProjects: vi.fn().mockResolvedValue({ projects: [] })
      };
      
      const args = {};
      const parsedArgs = getProjectsSchema.parse(args);
      
      await getProjectsHandler(parsedArgs, mockClient as any);
      
      expect(mockClient.getProjects).toHaveBeenCalledWith({
        include_archived: false
      });
    });
  });
});
