import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedmineClient } from '../../src/client/redmine';

describe('RedmineClient', () => {
  let client: RedmineClient;

  beforeEach(() => {
    client = new RedmineClient('http://localhost', 'dummy');
  });

  it('should paginate getUsers to fetch all users', async () => {
    // Mock this.api.get to return paginated results
    const mockGet = vi.fn();
    (client as any).api = { get: mockGet };

    mockGet
      .mockResolvedValueOnce({ data: { users: Array.from({length: 100}, (_, i) => ({ id: i })), total_count: 150 } })
      .mockResolvedValueOnce({ data: { users: Array.from({length: 50}, (_, i) => ({ id: 100 + i })), total_count: 150 } });

    const data = await client.getUsers();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(data.users.length).toBe(150);
  });

  it('should paginate getProjects to fetch all projects', async () => {
    // Mock this.api.get
    const mockGet = vi.fn();
    (client as any).api = { get: mockGet };

    mockGet
      .mockResolvedValueOnce({ data: { projects: Array.from({length: 100}, (_, i) => ({ id: i })), total_count: 101 } })
      .mockResolvedValueOnce({ data: { projects: [{ id: 100 }], total_count: 101 } });

    const data = await client.getProjects();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(data.projects.length).toBe(101);
  });
});
