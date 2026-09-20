import { describe, it, expect, vi } from 'vitest';
import { getMyAccountSchema, getMyAccountHandler } from '../../src/tools/get_my_account.js';

describe('get_my_account tool', () => {
  describe('Schema Validation', () => {
    it('should apply default false for include_memberships and include_groups', () => {
      const args = {};
      const parsed = getMyAccountSchema.parse(args);
      expect(parsed.include_memberships).toBe(false);
      expect(parsed.include_groups).toBe(false);
    });

    it('should validate valid parameters when include options are true', () => {
      const args = {
        include_memberships: true,
        include_groups: true,
      };
      const parsed = getMyAccountSchema.parse(args);
      expect(parsed.include_memberships).toBe(true);
      expect(parsed.include_groups).toBe(true);
    });

    it('should reject invalid types', () => {
      const args = {
        include_memberships: 'invalid_boolean',
      };
      expect(() => getMyAccountSchema.parse(args as any)).toThrow();
    });
  });

  describe('Handler Logic', () => {
    it('should call RedmineClient.getMyAccount with default parameters', async () => {
      const mockUserData = {
        user: {
          id: 1,
          login: 'admin',
          firstname: 'Admin',
          lastname: 'User',
          mail: 'admin@example.com',
        },
      };
      const mockClient = {
        getMyAccount: vi.fn().mockResolvedValue(mockUserData),
      };

      const args = {};
      const parsedArgs = getMyAccountSchema.parse(args);
      const result = await getMyAccountHandler(parsedArgs, mockClient as any);

      expect(mockClient.getMyAccount).toHaveBeenCalledWith({
        include_memberships: false,
        include_groups: false,
      });
      expect(result).toEqual(mockUserData);
    });

    it('should call RedmineClient.getMyAccount with include options', async () => {
      const mockUserData = {
        user: {
          id: 1,
          login: 'admin',
          firstname: 'Admin',
          lastname: 'User',
          memberships: [{ id: 10, project: { id: 1, name: 'Project A' } }],
          groups: [{ id: 2, name: 'DevGroup' }],
        },
      };
      const mockClient = {
        getMyAccount: vi.fn().mockResolvedValue(mockUserData),
      };

      const args = { include_memberships: true, include_groups: true };
      const parsedArgs = getMyAccountSchema.parse(args);
      const result = await getMyAccountHandler(parsedArgs, mockClient as any);

      expect(mockClient.getMyAccount).toHaveBeenCalledWith({
        include_memberships: true,
        include_groups: true,
      });
      expect(result).toEqual(mockUserData);
    });

    it('should return helpful error message on 401 Unauthorized', async () => {
      const error: any = new Error('Unauthorized');
      error.response = { status: 401 };
      const mockClient = {
        getMyAccount: vi.fn().mockRejectedValue(error),
      };

      const args = {};
      const parsedArgs = getMyAccountSchema.parse(args);
      const result = await getMyAccountHandler(parsedArgs, mockClient as any);

      expect(result).toEqual({ error: '인증에 실패했습니다. 유효한 API Key를 확인하세요.' });
    });

    it('should return helpful error message on 404 Not Found', async () => {
      const error: any = new Error('Not Found');
      error.response = { status: 404 };
      const mockClient = {
        getMyAccount: vi.fn().mockRejectedValue(error),
      };

      const args = {};
      const parsedArgs = getMyAccountSchema.parse(args);
      const result = await getMyAccountHandler(parsedArgs, mockClient as any);

      expect(result).toEqual({ error: '내 계정 정보를 찾을 수 없습니다.' });
    });

    it('should re-throw unexpected server errors (500)', async () => {
      const error: any = new Error('Internal Server Error');
      error.response = { status: 500 };
      const mockClient = {
        getMyAccount: vi.fn().mockRejectedValue(error),
      };

      const args = {};
      const parsedArgs = getMyAccountSchema.parse(args);
      await expect(getMyAccountHandler(parsedArgs, mockClient as any)).rejects.toThrow('Internal Server Error');
    });
  });
});
