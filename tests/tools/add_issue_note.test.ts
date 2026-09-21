import { describe, it, expect, vi } from 'vitest';
import { addIssueNoteSchema, addIssueNoteHandler } from '../../src/tools/add_issue_note.js';
import { RedmineClient } from '../../src/client/redmine.js';

describe('add_issue_note tool', () => {
  describe('Schema Validation', () => {
    it('should validate valid parameters', () => {
      const args = { issue_id: 123, notes: 'Hello world' };
      const parsed = addIssueNoteSchema.parse(args);
      expect(parsed.issue_id).toBe(123);
      expect(parsed.notes).toBe('Hello world');
      expect(parsed.private_notes).toBe(false);
      expect(parsed.dry_run).toBe(true);
    });

    it('should reject invalid issue_id', () => {
      expect(() => addIssueNoteSchema.parse({ issue_id: -1, notes: 'Hello' })).toThrow();
      expect(() => addIssueNoteSchema.parse({ issue_id: 1.5, notes: 'Hello' })).toThrow();
      expect(() => addIssueNoteSchema.parse({ issue_id: '123' as any, notes: 'Hello' })).toThrow();
    });

    it('should reject invalid notes', () => {
      expect(() => addIssueNoteSchema.parse({ issue_id: 123, notes: '' })).toThrow();
      expect(() => addIssueNoteSchema.parse({ issue_id: 123, notes: 'a'.repeat(5001) })).toThrow();
    });
    
    it('should reject whitespace-only notes', () => {
      expect(() => addIssueNoteSchema.parse({ issue_id: 123, notes: '   ' })).toThrow(/댓글 내용은 공백일 수 없습니다/);
    });

    it('should reject issue_id 0', () => {
      expect(() => addIssueNoteSchema.parse({ issue_id: 0, notes: 'Hello' })).toThrow();
    });
  });

  describe('Handler Logic', () => {
    it('should perform dry_run by default and not call RedmineClient', async () => {
      const mockClient = {
        addIssueNote: vi.fn().mockResolvedValue({})
      } as unknown as RedmineClient;
      
      const args = { issue_id: 123, notes: 'Test note' };
      const parsedArgs = addIssueNoteSchema.parse(args);
      
      const result = await addIssueNoteHandler(parsedArgs, mockClient);
      
      expect((mockClient as any).addIssueNote).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "Dry run successful. No changes were made.",
        issue_id: 123,
        notes: "Test note",
        private_notes: false,
      });
    });

    it('should call RedmineClient when dry_run is explicitly false', async () => {
      const mockClient = {
        addIssueNote: vi.fn().mockResolvedValue({})
      } as unknown as RedmineClient;
      
      const args = { issue_id: 123, notes: 'Test note', private_notes: true, dry_run: false };
      const parsedArgs = addIssueNoteSchema.parse(args);
      
      const result = await addIssueNoteHandler(parsedArgs, mockClient);
      
      expect((mockClient as any).addIssueNote).toHaveBeenCalledWith({
        issue_id: 123,
        notes: 'Test note',
        private_notes: true
      });
      expect(result).toEqual({});
    });

    it('should handle 404 error when issue is not found', async () => {
      const mockClient = {
        addIssueNote: vi.fn().mockRejectedValue({ response: { status: 404 } }),
      } as unknown as RedmineClient;

      const result = await addIssueNoteHandler({ issue_id: 999999, notes: 'Hello', private_notes: false }, mockClient);
      expect(result).toEqual({ error: '해당 일감을 찾을 수 없습니다' });
    });

    it('should handle 422 validation error from Redmine', async () => {
      const mockClient = {
        addIssueNote: vi.fn().mockRejectedValue({
          response: { status: 422, data: { errors: ['Notes cannot be blank'] } },
        }),
      } as unknown as RedmineClient;

      const result = await addIssueNoteHandler({ issue_id: 42, notes: 'Hello', private_notes: false }, mockClient);
      expect(result).toEqual({ error: '일감 업데이트 실패: {"errors":["Notes cannot be blank"]}' });
    });

    it('should rethrow unexpected errors', async () => {
      const mockClient = {
        addIssueNote: vi.fn().mockRejectedValue(new Error('Network error')),
      } as unknown as RedmineClient;

      await expect(
        addIssueNoteHandler({ issue_id: 42, notes: 'Hello', private_notes: false }, mockClient)
      ).rejects.toThrow('Network error');
    });
  });
});
