import { describe, it, expect, vi } from 'vitest';
import { getTimeEntriesSchema, getTimeEntriesHandler } from '../../src/tools/get_time_entries.js';
import { RedmineClient } from '../../src/client/redmine.js';

describe('get_time_entries tool', () => {
  describe('Schema Validation', () => {
    it('should validate empty params and apply default limit', () => {
      const args = {};
      const parsed = getTimeEntriesSchema.parse(args);
      expect(parsed.limit).toBe(25);
    });

    it('should validate list filter parameters', () => {
      const args = {
        project_id: 'my-project',
        issue_id: 101,
        user_id: 'me',
        from: '2026-09-01',
        to: '2026-09-20',
        spent_on: '2026-09-18',
        limit: 50,
        offset: 10,
      };
      const parsed = getTimeEntriesSchema.parse(args);
      expect(parsed).toEqual({
        project_id: 'my-project',
        issue_id: 101,
        user_id: 'me',
        from: '2026-09-01',
        to: '2026-09-20',
        spent_on: '2026-09-18',
        limit: 50,
        offset: 10,
      });
    });

    it('should validate numeric project_id and user_id', () => {
      const args = {
        project_id: 12,
        user_id: 45,
      };
      const parsed = getTimeEntriesSchema.parse(args);
      expect(parsed.project_id).toBe(12);
      expect(parsed.user_id).toBe(45);
    });

    it('should validate single time entry id or time_entry_id', () => {
      const parsed1 = getTimeEntriesSchema.parse({ id: 10 });
      expect(parsed1.id).toBe(10);

      const parsed2 = getTimeEntriesSchema.parse({ time_entry_id: 20 });
      expect(parsed2.time_entry_id).toBe(20);
    });

    it('should reject invalid id or issue_id', () => {
      expect(() => getTimeEntriesSchema.parse({ id: -1 })).toThrow();
      expect(() => getTimeEntriesSchema.parse({ id: 1.5 })).toThrow();
      expect(() => getTimeEntriesSchema.parse({ issue_id: 0 })).toThrow();
      expect(() => getTimeEntriesSchema.parse({ issue_id: -5 })).toThrow();
    });

    it('should reject invalid date format for from, to, spent_on', () => {
      expect(() => getTimeEntriesSchema.parse({ from: '2026/09/01' })).toThrow();
      expect(() => getTimeEntriesSchema.parse({ to: '20-09-2026' })).toThrow();
      expect(() => getTimeEntriesSchema.parse({ spent_on: 'invalid' })).toThrow();
    });

    it('should reject invalid limit (less than 1 or greater than 100)', () => {
      expect(() => getTimeEntriesSchema.parse({ limit: 0 })).toThrow();
      expect(() => getTimeEntriesSchema.parse({ limit: 101 })).toThrow();
    });

    it('should reject negative offset', () => {
      expect(() => getTimeEntriesSchema.parse({ offset: -1 })).toThrow();
    });
  });

  describe('Handler Logic - List (getTimeEntries)', () => {
    it('should call client.getTimeEntries with parsed filters', async () => {
      const mockData = {
        time_entries: [
          { id: 1, hours: 2.5, spent_on: '2026-09-18', comments: 'Bugfix' },
        ],
        total_count: 1,
        limit: 25,
        offset: 0,
      };
      const mockClient = {
        getTimeEntries: vi.fn().mockResolvedValue(mockData),
      } as unknown as RedmineClient;

      const args = {
        project_id: 'my-project',
        issue_id: 101,
        user_id: 'me',
        from: '2026-09-01',
        to: '2026-09-20',
        limit: 25,
      };
      const parsed = getTimeEntriesSchema.parse(args);
      const result = await getTimeEntriesHandler(parsed, mockClient);

      expect(mockClient.getTimeEntries).toHaveBeenCalledWith({
        project_id: 'my-project',
        issue_id: 101,
        user_id: 'me',
        from: '2026-09-01',
        to: '2026-09-20',
        limit: 25,
      });
      expect(result).toEqual(mockData);
    });

    it('should handle 404 error when querying list', async () => {
      const mockClient = {
        getTimeEntries: vi.fn().mockRejectedValue({ response: { status: 404 } }),
      } as unknown as RedmineClient;

      const parsed = getTimeEntriesSchema.parse({ project_id: 'non-existent' });
      const result = await getTimeEntriesHandler(parsed, mockClient);

      expect(result).toEqual({ error: '시간 기록 목록을 찾을 수 없습니다' });
    });

    it('should rethrow unexpected errors', async () => {
      const mockClient = {
        getTimeEntries: vi.fn().mockRejectedValue(new Error('Network error')),
      } as unknown as RedmineClient;

      const parsed = getTimeEntriesSchema.parse({});
      await expect(getTimeEntriesHandler(parsed, mockClient)).rejects.toThrow('Network error');
    });
  });

  describe('Handler Logic - Single Entry (getTimeEntryDetails)', () => {
    it('should call client.getTimeEntryDetails when id is provided', async () => {
      const mockDetail = {
        time_entry: {
          id: 42,
          project: { id: 1, name: 'Project' },
          issue: { id: 100 },
          user: { id: 5, name: 'John Doe' },
          hours: 3,
          spent_on: '2026-09-19',
        },
      };
      const mockClient = {
        getTimeEntryDetails: vi.fn().mockResolvedValue(mockDetail),
      } as unknown as RedmineClient;

      const parsed = getTimeEntriesSchema.parse({ id: 42 });
      const result = await getTimeEntriesHandler(parsed, mockClient);

      expect(mockClient.getTimeEntryDetails).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockDetail);
    });

    it('should call client.getTimeEntryDetails when time_entry_id is provided', async () => {
      const mockDetail = {
        time_entry: { id: 42, hours: 3 },
      };
      const mockClient = {
        getTimeEntryDetails: vi.fn().mockResolvedValue(mockDetail),
      } as unknown as RedmineClient;

      const parsed = getTimeEntriesSchema.parse({ time_entry_id: 42 });
      const result = await getTimeEntriesHandler(parsed, mockClient);

      expect(mockClient.getTimeEntryDetails).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockDetail);
    });

    it('should handle 404 error when single entry not found', async () => {
      const mockClient = {
        getTimeEntryDetails: vi.fn().mockRejectedValue({ response: { status: 404 } }),
      } as unknown as RedmineClient;

      const parsed = getTimeEntriesSchema.parse({ id: 9999 });
      const result = await getTimeEntriesHandler(parsed, mockClient);

      expect(result).toEqual({ error: '해당 시간 기록을 찾을 수 없습니다' });
    });
  });
});
