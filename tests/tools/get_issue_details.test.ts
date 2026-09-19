import { describe, it, expect, vi } from 'vitest';
import { getIssueDetailsSchema, getIssueDetailsHandler } from '../../src/tools/get_issue_details.js';
import { RedmineClient } from '../../src/client/redmine.js';

describe('get_issue_details tool', () => {
  describe('Schema Validation', () => {
    it('should validate valid parameters', () => {
      const args = { issue_id: 123 };
      const parsed = getIssueDetailsSchema.parse(args);
      expect(parsed.issue_id).toBe(123);
      expect(parsed.include_journals).toBe(true);
      expect(parsed.include_attachments).toBe(false);
    });

    it('should reject invalid issue_id', () => {
      expect(() => getIssueDetailsSchema.parse({ issue_id: -1 })).toThrow(/Invalid issue_id/);
      expect(() => getIssueDetailsSchema.parse({ issue_id: 1.5 })).toThrow(/Invalid issue_id/);
      expect(() => getIssueDetailsSchema.parse({ issue_id: '123' as any })).toThrow(/expected number/i);
    });
  });

  describe('Handler Logic', () => {
    it('should call RedmineClient with correct parameters', async () => {
      const mockClient = {
        getIssueDetails: vi.fn().mockResolvedValue({ issue: { id: 123, subject: 'Test' } })
      } as unknown as RedmineClient;
      
      const args = { issue_id: 123, include_journals: false, include_attachments: true };
      const parsedArgs = getIssueDetailsSchema.parse(args);
      
      const result = await getIssueDetailsHandler(parsedArgs, mockClient);
      
      expect(mockClient.getIssueDetails).toHaveBeenCalledWith({
        issue_id: 123,
        include_journals: false,
        include_attachments: true
      });
      expect(result).toEqual({ issue: { id: 123, subject: 'Test' } });
    });
  });
});
