import { describe, it, expect, vi } from 'vitest';
import { logTimeSchema, logTimeHandler } from '../../src/tools/logTime.js';
import { RedmineClient } from '../../src/client/redmine.js';

describe('log_time tool', () => {
  describe('Schema Validation', () => {
    it('should validate valid parameters with issue_id and hours', () => {
      const args = { issue_id: 101, hours: 2.5 };
      const parsed = logTimeSchema.parse(args);
      expect(parsed.issue_id).toBe(101);
      expect(parsed.hours).toBe(2.5);
    });

    it('should validate valid parameters with project_id and hours', () => {
      const args = { project_id: 'sample-project', hours: 1 };
      const parsed = logTimeSchema.parse(args);
      expect(parsed.project_id).toBe('sample-project');
      expect(parsed.hours).toBe(1);

      const argsNumeric = { project_id: 42, hours: 1 };
      const parsedNumeric = logTimeSchema.parse(argsNumeric);
      expect(parsedNumeric.project_id).toBe(42);
    });

    it('should validate optional fields', () => {
      const args = {
        issue_id: 101,
        hours: 3.5,
        activity_id: 9,
        activity: '개발',
        comments: '기능 구현 및 테스트 작성',
        spent_on: '2026-09-20',
      };
      const parsed = logTimeSchema.parse(args);
      expect(parsed.activity_id).toBe(9);
      expect(parsed.activity).toBe('개발');
      expect(parsed.comments).toBe('기능 구현 및 테스트 작성');
      expect(parsed.spent_on).toBe('2026-09-20');
    });

    it('should reject invalid hours (non-positive, zero, NaN)', () => {
      expect(() => logTimeSchema.parse({ issue_id: 101, hours: 0 })).toThrow();
      expect(() => logTimeSchema.parse({ issue_id: 101, hours: -1.5 })).toThrow();
      expect(() => logTimeSchema.parse({ issue_id: 101, hours: 'two' as any })).toThrow();
    });

    it('should reject invalid issue_id', () => {
      expect(() => logTimeSchema.parse({ issue_id: -10, hours: 1 })).toThrow();
      expect(() => logTimeSchema.parse({ issue_id: 1.5, hours: 1 })).toThrow();
      expect(() => logTimeSchema.parse({ issue_id: '101' as any, hours: 1 })).toThrow();
    });

    it('should reject invalid spent_on format', () => {
      expect(() => logTimeSchema.parse({ issue_id: 101, hours: 1, spent_on: '2026/09/20' })).toThrow();
      expect(() => logTimeSchema.parse({ issue_id: 101, hours: 1, spent_on: '20-09-2026' })).toThrow();
      expect(() => logTimeSchema.parse({ issue_id: 101, hours: 1, spent_on: 'invalid' })).toThrow();
    });
  });

  describe('Handler Logic', () => {
    it('should throw error if neither issue_id nor project_id is provided', async () => {
      const mockClient = {
        createTimeEntry: vi.fn(),
      } as unknown as RedmineClient;

      await expect(
        logTimeHandler({ hours: 2 } as any, mockClient)
      ).rejects.toThrow('Either issue_id or project_id must be provided');
    });

    it('should call createTimeEntry with default spent_on (today) when spent_on is omitted', async () => {
      const mockClient = {
        createTimeEntry: vi.fn().mockResolvedValue({ time_entry: { id: 1, hours: 2 } }),
      } as unknown as RedmineClient;

      const args = { issue_id: 101, hours: 2 };
      const parsedArgs = logTimeSchema.parse(args);

      const result = await logTimeHandler(parsedArgs, mockClient);

      const today = new Date().toISOString().slice(0, 10);
      expect((mockClient as any).createTimeEntry).toHaveBeenCalledWith({
        time_entry: {
          issue_id: 101,
          hours: 2,
          spent_on: today,
        },
      });
      expect(result).toEqual({ time_entry: { id: 1, hours: 2 } });
    });

    it('should call createTimeEntry with provided parameters', async () => {
      const mockClient = {
        createTimeEntry: vi.fn().mockResolvedValue({ time_entry: { id: 2 } }),
      } as unknown as RedmineClient;

      const args = {
        issue_id: 101,
        project_id: 'my-proj',
        hours: 1.5,
        activity_id: 8,
        comments: '디자인 작업',
        spent_on: '2026-09-18',
      };
      const parsedArgs = logTimeSchema.parse(args);

      const result = await logTimeHandler(parsedArgs, mockClient);

      expect((mockClient as any).createTimeEntry).toHaveBeenCalledWith({
        time_entry: {
          issue_id: 101,
          project_id: 'my-proj',
          hours: 1.5,
          activity_id: 8,
          comments: '디자인 작업',
          spent_on: '2026-09-18',
        },
      });
      expect(result).toEqual({ time_entry: { id: 2 } });
    });

    it('should resolve activity name to activity_id via SmartNameResolver', async () => {
      const mockClient = {
        createTimeEntry: vi.fn().mockResolvedValue({ time_entry: { id: 3 } }),
        getProjects: vi.fn().mockResolvedValue({ projects: [] }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
        getTimeEntryActivities: vi.fn().mockResolvedValue({
          time_entry_activities: [
            { id: 8, name: '디자인' },
            { id: 9, name: '개발' },
          ],
        }),
      } as unknown as RedmineClient;

      const args = {
        issue_id: 101,
        hours: 4,
        activity: '개발',
      };
      const parsedArgs = logTimeSchema.parse(args);

      const result = await logTimeHandler(parsedArgs, mockClient);

      const today = new Date().toISOString().slice(0, 10);
      expect((mockClient as any).createTimeEntry).toHaveBeenCalledWith({
        time_entry: {
          issue_id: 101,
          hours: 4,
          activity_id: 9,
          spent_on: today,
        },
      });
      expect(result).toEqual({ time_entry: { id: 3 } });
    });

    it('should throw error if activity name cannot be resolved', async () => {
      const mockClient = {
        createTimeEntry: vi.fn(),
        getProjects: vi.fn().mockResolvedValue({ projects: [] }),
        getTrackers: vi.fn().mockResolvedValue({ trackers: [] }),
        getStatuses: vi.fn().mockResolvedValue({ issue_statuses: [] }),
        getPriorities: vi.fn().mockResolvedValue({ issue_priorities: [] }),
        getUsers: vi.fn().mockResolvedValue({ users: [] }),
        getTimeEntryActivities: vi.fn().mockResolvedValue({
          time_entry_activities: [{ id: 9, name: '개발' }],
        }),
      } as unknown as RedmineClient;

      const args = {
        issue_id: 101,
        hours: 2,
        activity: '알수없는활동',
      };
      const parsedArgs = logTimeSchema.parse(args);

      await expect(logTimeHandler(parsedArgs, mockClient)).rejects.toThrow(
        'Invalid activity name: 알수없는활동'
      );
      expect((mockClient as any).createTimeEntry).not.toHaveBeenCalled();
    });

    it('should prefer explicit activity_id over resolving activity name', async () => {
      const mockClient = {
        createTimeEntry: vi.fn().mockResolvedValue({ time_entry: { id: 4 } }),
        getTimeEntryActivities: vi.fn(),
      } as unknown as RedmineClient;

      const args = {
        issue_id: 101,
        hours: 2,
        activity_id: 12,
        activity: '개발',
      };
      const parsedArgs = logTimeSchema.parse(args);

      await logTimeHandler(parsedArgs, mockClient);

      expect((mockClient as any).getTimeEntryActivities).not.toHaveBeenCalled();
      expect((mockClient as any).createTimeEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          time_entry: expect.objectContaining({ activity_id: 12 }),
        })
      );
    });

    it('should handle 404 error when issue or project not found', async () => {
      const mockClient = {
        createTimeEntry: vi.fn().mockRejectedValue({ response: { status: 404 } }),
      } as unknown as RedmineClient;

      const args = { issue_id: 99999, hours: 1 };
      const parsedArgs = logTimeSchema.parse(args);

      const result = await logTimeHandler(parsedArgs, mockClient);
      expect(result).toEqual({ error: '해당 일감 또는 프로젝트를 찾을 수 없습니다' });
    });

    it('should handle 422 validation error from Redmine', async () => {
      const mockClient = {
        createTimeEntry: vi.fn().mockRejectedValue({
          response: {
            status: 422,
            data: { errors: ['Activity cannot be blank'] },
          },
        }),
      } as unknown as RedmineClient;

      const args = { issue_id: 101, hours: 1 };
      const parsedArgs = logTimeSchema.parse(args);

      const result = await logTimeHandler(parsedArgs, mockClient);
      expect(result).toEqual({
        error: '시간 기록 실패: {"errors":["Activity cannot be blank"]}',
      });
    });

    it('should rethrow unexpected errors', async () => {
      const mockClient = {
        createTimeEntry: vi.fn().mockRejectedValue(new Error('Connection timeout')),
      } as unknown as RedmineClient;

      const args = { issue_id: 101, hours: 1 };
      const parsedArgs = logTimeSchema.parse(args);

      await expect(logTimeHandler(parsedArgs, mockClient)).rejects.toThrow('Connection timeout');
    });
  });
});
