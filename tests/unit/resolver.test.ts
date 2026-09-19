import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartNameResolver } from '../../src/client/resolver';
import { RedmineClient } from '../../src/client/redmine';

vi.mock('../../src/client/redmine');

describe('SmartNameResolver', () => {
  let client: RedmineClient;
  let resolver: SmartNameResolver;

  beforeEach(() => {
    client = new RedmineClient('http://localhost', 'dummy');
    
    // Mock implementations
    client.getProjects = vi.fn().mockResolvedValue({ projects: [{ id: 1, name: 'Project A' }, { id: 2, name: 'Project B' }] });
    client.getTrackers = vi.fn().mockResolvedValue({ trackers: [{ id: 1, name: 'Bug' }, { id: 2, name: 'Feature' }] });
    client.getStatuses = vi.fn().mockResolvedValue({ issue_statuses: [{ id: 1, name: 'New' }, { id: 2, name: 'In Progress' }] });
    client.getPriorities = vi.fn().mockResolvedValue({ issue_priorities: [{ id: 1, name: 'Low' }, { id: 2, name: 'High' }] });
    client.getUsers = vi.fn().mockResolvedValue({ users: [{ id: 1, firstname: 'John', lastname: 'Doe', login: 'jdoe' }] });

    resolver = new SmartNameResolver(client);
  });

  it('should load metadata', async () => {
    await resolver.load();
    expect(client.getProjects).toHaveBeenCalled();
    expect(client.getTrackers).toHaveBeenCalled();
    expect(client.getStatuses).toHaveBeenCalled();
    expect(client.getPriorities).toHaveBeenCalled();
    expect(client.getUsers).toHaveBeenCalled();
  });

  it('should resolve project by name', async () => {
    await resolver.load();
    expect(resolver.resolveProject('Project A')).toBe(1);
    expect(resolver.resolveProject('project b')).toBe(2);
    expect(resolver.resolveProject('Unknown')).toBeUndefined();
    expect(resolver.resolveProject(undefined as any)).toBeUndefined();
  });

  it('should resolve tracker by name', async () => {
    await resolver.load();
    expect(resolver.resolveTracker('Bug')).toBe(1);
    expect(resolver.resolveTracker('feature')).toBe(2);
    expect(resolver.resolveTracker(undefined as any)).toBeUndefined();
  });

  it('should resolve status by name', async () => {
    await resolver.load();
    expect(resolver.resolveStatus('New')).toBe(1);
    expect(resolver.resolveStatus('in progress')).toBe(2);
    expect(resolver.resolveStatus(undefined as any)).toBeUndefined();
  });

  it('should resolve priority by name', async () => {
    await resolver.load();
    expect(resolver.resolvePriority('Low')).toBe(1);
    expect(resolver.resolvePriority('high')).toBe(2);
    expect(resolver.resolvePriority(undefined as any)).toBeUndefined();
  });

  it('should resolve user by name or login', async () => {
    await resolver.load();
    expect(resolver.resolveUser('John Doe')).toBe(1);
    expect(resolver.resolveUser('jdoe')).toBe(1);
    expect(resolver.resolveUser('Unknown')).toBeUndefined();
    expect(resolver.resolveUser(undefined as any)).toBeUndefined();
  });

  it('should tolerate partial failures in load', async () => {
    // Simulate failure in getUsers
    client.getUsers = vi.fn().mockRejectedValue(new Error('API Error'));
    await resolver.load();

    // Still successfully mapped other entities
    expect(resolver.resolveProject('Project A')).toBe(1);
    // User should not be found
    expect(resolver.resolveUser('John Doe')).toBeUndefined();
  });
});
