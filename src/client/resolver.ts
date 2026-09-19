import { RedmineClient } from './redmine';

export class SmartNameResolver {
  private client: RedmineClient;
  private projects: Record<string, number> = {};
  private trackers: Record<string, number> = {};
  private statuses: Record<string, number> = {};
  private priorities: Record<string, number> = {};
  private users: Record<string, number> = {};

  constructor(client: RedmineClient) {
    this.client = client;
  }

  async load() {
    const results = await Promise.allSettled([
      this.client.getProjects(),
      this.client.getTrackers(),
      this.client.getStatuses(),
      this.client.getPriorities(),
      this.client.getUsers()
    ]);

    this.projects = {};
    if (results[0].status === 'fulfilled' && results[0].value) {
      for (const p of results[0].value.projects || []) {
        this.projects[p.name.toLowerCase()] = p.id;
      }
    }

    this.trackers = {};
    if (results[1].status === 'fulfilled' && results[1].value) {
      for (const t of results[1].value.trackers || []) {
        this.trackers[t.name.toLowerCase()] = t.id;
      }
    }

    this.statuses = {};
    if (results[2].status === 'fulfilled' && results[2].value) {
      for (const s of results[2].value.issue_statuses || []) {
        this.statuses[s.name.toLowerCase()] = s.id;
      }
    }

    this.priorities = {};
    if (results[3].status === 'fulfilled' && results[3].value) {
      for (const p of results[3].value.issue_priorities || []) {
        this.priorities[p.name.toLowerCase()] = p.id;
      }
    }

    this.users = {};
    if (results[4].status === 'fulfilled' && results[4].value) {
      for (const u of results[4].value.users || []) {
        this.users[`${u.firstname} ${u.lastname}`.toLowerCase()] = u.id;
        if (u.login) {
          this.users[u.login.toLowerCase()] = u.id;
        }
      }
    }
  }

  resolveProject(name: string): number | undefined {
    if (!name) return undefined;
    return this.projects[name.toLowerCase()];
  }

  resolveTracker(name: string): number | undefined {
    if (!name) return undefined;
    return this.trackers[name.toLowerCase()];
  }

  resolveStatus(name: string): number | undefined {
    if (!name) return undefined;
    return this.statuses[name.toLowerCase()];
  }

  resolvePriority(name: string): number | undefined {
    if (!name) return undefined;
    return this.priorities[name.toLowerCase()];
  }

  resolveUser(name: string): number | undefined {
    if (!name) return undefined;
    return this.users[name.toLowerCase()];
  }
}
