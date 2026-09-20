import { describe, it, expect, vi } from 'vitest';
import { searchWikiSchema, searchWikiHandler } from '../../src/tools/search_wiki.js';

describe('search_wiki tool', () => {
  describe('Schema Validation', () => {
    it('should validate valid parameters', () => {
      const args = { project_id: 'demo', query: 'architecture', limit: 10 };
      expect(() => searchWikiSchema.parse(args)).not.toThrow();
    });

    it('should apply default values', () => {
      const parsed = searchWikiSchema.parse({ project_id: 'demo' });
      expect(parsed.include_attachments).toBe(false);
      expect(parsed.limit).toBe(10);
    });

    it('should reject invalid project_id', () => {
      expect(() => searchWikiSchema.parse({ project_id: 'invalid_id!' })).toThrow(/Invalid project_id/);
    });

    it('should reject missing project_id', () => {
      expect(() => searchWikiSchema.parse({})).toThrow(/Required|project_id/);
    });

    it('should reject query exceeding 100 characters', () => {
      const longQuery = 'a'.repeat(101);
      expect(() => searchWikiSchema.parse({ query: longQuery })).toThrow(/Query too long/);
    });
  });

  describe('Handler Logic', () => {
    it('should call RedmineClient with correct parameters', async () => {
      const mockClient = {
        searchWiki: vi.fn().mockResolvedValue({ wiki_pages: [{ title: 'Home', updated_on: '2026-09-20' }] })
      };

      const args = { project_id: 'demo', title: 'Home', include_attachments: true, limit: 5 };
      const parsedArgs = searchWikiSchema.parse(args);

      const result = await searchWikiHandler(parsedArgs, mockClient as any);

      expect(mockClient.searchWiki).toHaveBeenCalledWith({
        project_id: 'demo',
        title: 'Home',
        include_attachments: true,
        limit: 5,
        query: undefined,
      });
      expect(result).toEqual({ wiki_pages: [{ title: 'Home', updated_on: '2026-09-20' }] });
    });
  });
});
