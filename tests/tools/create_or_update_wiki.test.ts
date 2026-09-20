import { describe, it, expect, vi } from 'vitest';
import {
  createOrUpdateWikiSchema,
  createOrUpdateWikiHandler,
} from '../../src/tools/create_or_update_wiki.js';

describe('create_or_update_wiki tool', () => {
  describe('Schema Validation', () => {
    it('should validate valid parameters', () => {
      const args = {
        project_id: 'my-project',
        title: 'Architecture-Design',
        text: '# Architecture\nThis is the architecture doc.',
        comments: 'Initial revision',
        version: 1,
        parent_title: 'Home',
        dry_run: false,
      };
      const parsed = createOrUpdateWikiSchema.parse(args);
      expect(parsed).toEqual(args);
    });

    it('should set dry_run default to true', () => {
      const args = {
        project_id: 'my-project',
        title: 'Home',
        text: 'Welcome to our wiki',
      };
      const parsed = createOrUpdateWikiSchema.parse(args);
      expect(parsed.dry_run).toBe(true);
    });

    it('should allow underscore in project_id', () => {
      const args = {
        project_id: 'my_sub_project_123',
        title: 'Home',
        text: 'Welcome',
      };
      expect(() => createOrUpdateWikiSchema.parse(args)).not.toThrow();
    });

    it('should reject missing project_id', () => {
      const args = {
        title: 'Home',
        text: 'Welcome',
      };
      expect(() => createOrUpdateWikiSchema.parse(args)).toThrow(/project_id/);
    });

    it('should reject missing title', () => {
      const args = {
        project_id: 'my-project',
        text: 'Welcome',
      };
      expect(() => createOrUpdateWikiSchema.parse(args)).toThrow(/title|Title/);
    });

    it('should reject missing text', () => {
      const args = {
        project_id: 'my-project',
        title: 'Home',
      };
      expect(() => createOrUpdateWikiSchema.parse(args)).toThrow(/text|Text/);
    });

    it('should reject empty or whitespace-only title', () => {
      const emptyTitles = ['', '   ', '\t\n'];
      for (const title of emptyTitles) {
        expect(() =>
          createOrUpdateWikiSchema.parse({
            project_id: 'my-project',
            title,
            text: 'Some content',
          })
        ).toThrow();
      }
    });

    it('should reject titles containing path traversal or invalid characters', () => {
      const invalidTitles = [
        '.',
        '..',
        '../evil',
        './relative',
        'foo/bar',
        'page\\sub',
        'wiki#anchor',
        'test?query',
        'page%20name',
      ];
      for (const title of invalidTitles) {
        expect(() =>
          createOrUpdateWikiSchema.parse({
            project_id: 'my-project',
            title,
            text: 'Content',
          })
        ).toThrow();
      }
    });

    it('should reject empty or whitespace-only text', () => {
      const emptyCases = ['', '   ', '\n\t  \n'];
      for (const emptyText of emptyCases) {
        expect(() =>
          createOrUpdateWikiSchema.parse({
            project_id: 'my-project',
            title: 'Home',
            text: emptyText,
          })
        ).toThrow(/Text cannot be empty/);
      }
    });

    it('should reject invalid project_id pattern', () => {
      const invalidCases = ['Invalid_ID', 'project/name', 'proj!ect', 'PROJECT'];
      for (const invalidId of invalidCases) {
        expect(() =>
          createOrUpdateWikiSchema.parse({
            project_id: invalidId,
            title: 'Home',
            text: 'Content',
          })
        ).toThrow(/Invalid project_id/);
      }
    });

    it('should reject title exceeding 100 characters', () => {
      const longTitle = 'a'.repeat(101);
      expect(() =>
        createOrUpdateWikiSchema.parse({
          project_id: 'my-project',
          title: longTitle,
          text: 'Content',
        })
      ).toThrow(/Title too long/);
    });

    it('should reject text exceeding 65535 characters', () => {
      const longText = 'a'.repeat(65536);
      expect(() =>
        createOrUpdateWikiSchema.parse({
          project_id: 'my-project',
          title: 'Home',
          text: longText,
        })
      ).toThrow(/Text too long/);
    });

    it('should reject comments exceeding 255 characters', () => {
      const longComment = 'a'.repeat(256);
      expect(() =>
        createOrUpdateWikiSchema.parse({
          project_id: 'my-project',
          title: 'Home',
          text: 'Content',
          comments: longComment,
        })
      ).toThrow(/Comments too long/);
    });
  });

  describe('Handler Logic', () => {
    it('should return dry_run preview payload without calling RedmineClient when dry_run=true', async () => {
      const mockClient = {
        createOrUpdateWiki: vi.fn(),
      };

      const args = {
        project_id: 'my-project',
        title: 'Home',
        text: '# Welcome',
        comments: 'Updating Home page',
        version: 2,
        parent_title: 'Wiki-Root',
        dry_run: true,
      };

      const result = await createOrUpdateWikiHandler(args, mockClient as any);

      expect(mockClient.createOrUpdateWiki).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        dry_run: true,
        payload: {
          project_id: 'my-project',
          title: 'Home',
          wiki_page: {
            text: '# Welcome',
            comments: 'Updating Home page',
            version: 2,
            parent_title: 'Wiki-Root',
          },
        },
      });
      expect(result.message).toContain('dry_run is true');
    });

    it('should enforce Fail-Close security guard when dry_run is undefined or omitted', async () => {
      const mockClient = {
        createOrUpdateWiki: vi.fn(),
      };

      const args = {
        project_id: 'my-project',
        title: 'Home',
        text: 'Preview only',
      };

      const result = await createOrUpdateWikiHandler(args as any, mockClient as any);

      expect(mockClient.createOrUpdateWiki).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        dry_run: true,
        payload: {
          project_id: 'my-project',
          title: 'Home',
          wiki_page: {
            text: 'Preview only',
          },
        },
      });
    });

    it('should call client.createOrUpdateWiki and return result when dry_run=false', async () => {
      const mockWikiResult = {
        message: "Wiki page 'Home' updated successfully.",
      };
      const mockClient = {
        createOrUpdateWiki: vi.fn().mockResolvedValue(mockWikiResult),
      };

      const args = {
        project_id: 'my-project',
        title: 'Home',
        text: '# Welcome',
        comments: 'Update docs',
        dry_run: false,
      };

      const result = await createOrUpdateWikiHandler(args, mockClient as any);

      expect(mockClient.createOrUpdateWiki).toHaveBeenCalledWith({
        project_id: 'my-project',
        title: 'Home',
        text: '# Welcome',
        comments: 'Update docs',
        version: undefined,
        parent_title: undefined,
      });
      expect(result).toEqual(mockWikiResult);
    });

    it('should handle 401 Unauthorized with clear authentication message', async () => {
      const error401: any = new Error('Unauthorized');
      error401.response = { status: 401 };

      const mockClient = {
        createOrUpdateWiki: vi.fn().mockRejectedValue(error401),
      };

      const args = {
        project_id: 'my-project',
        title: 'Home',
        text: 'Content',
        dry_run: false,
      };

      await expect(createOrUpdateWikiHandler(args, mockClient as any)).rejects.toThrow(
        /Authentication failed.*401/
      );
    });

    it('should handle 403 Forbidden with permission guidance', async () => {
      const error403: any = new Error('Forbidden');
      error403.response = { status: 403, statusText: 'Forbidden' };

      const mockClient = {
        createOrUpdateWiki: vi.fn().mockRejectedValue(error403),
      };

      const args = {
        project_id: 'my-project',
        title: 'Home',
        text: 'Content',
        dry_run: false,
      };

      await expect(createOrUpdateWikiHandler(args, mockClient as any)).rejects.toThrow(
        /Permission denied.*403/
      );
    });

    it('should handle 404 error appropriately when project or wiki is not found', async () => {
      const error404: any = new Error('Request failed with status code 404');
      error404.response = { status: 404, data: { errors: ['Project not found or Wiki module disabled'] } };

      const mockClient = {
        createOrUpdateWiki: vi.fn().mockRejectedValue(error404),
      };

      const args = {
        project_id: 'unknown-project',
        title: 'Home',
        text: 'Content',
        dry_run: false,
      };

      await expect(createOrUpdateWikiHandler(args, mockClient as any)).rejects.toThrow(
        /Wiki or project not found.*404/
      );
    });

    it('should handle 422 error appropriately when validation or version conflict occurs', async () => {
      const error422: any = new Error('Request failed with status code 422');
      error422.response = {
        status: 422,
        data: { errors: ['Version conflict: someone else edited this wiki page'] },
      };

      const mockClient = {
        createOrUpdateWiki: vi.fn().mockRejectedValue(error422),
      };

      const args = {
        project_id: 'my-project',
        title: 'Home',
        text: 'Content',
        version: 1,
        dry_run: false,
      };

      await expect(createOrUpdateWikiHandler(args, mockClient as any)).rejects.toThrow(
        /Wiki validation error.*422/
      );
    });

    it('should handle 422 error when errors is a non-array object or string', async () => {
      const error422: any = new Error('Request failed with status code 422');
      error422.response = {
        status: 422,
        data: { errors: 'Direct string error' },
      };

      const mockClient = {
        createOrUpdateWiki: vi.fn().mockRejectedValue(error422),
      };

      const args = {
        project_id: 'my-project',
        title: 'Home',
        text: 'Content',
        dry_run: false,
      };

      await expect(createOrUpdateWikiHandler(args, mockClient as any)).rejects.toThrow(
        /Direct string error/
      );
    });

    it('should sanitize errors and not expose API key on unexpected error', async () => {
      const sensitiveError: any = new Error('Network error');
      sensitiveError.config = { headers: { 'X-Redmine-API-Key': 'SECRET_KEY_12345' } };
      sensitiveError.response = { status: 500, data: 'Internal Server Error' };

      const mockClient = {
        createOrUpdateWiki: vi.fn().mockRejectedValue(sensitiveError),
      };

      const args = {
        project_id: 'my-project',
        title: 'Home',
        text: 'Content',
        dry_run: false,
      };

      let caughtError: Error | null = null;
      try {
        await createOrUpdateWikiHandler(args, mockClient as any);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).not.toContain('SECRET_KEY_12345');
      expect(caughtError?.message).toContain('Redmine Wiki request failed');
    });
  });
});
