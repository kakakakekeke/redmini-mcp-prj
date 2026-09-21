import { RedmineClient } from './redmine.js';

export class SmartNameResolver {
  private client: RedmineClient;
  private projects: Record<string, number> = {};
  private trackers: Record<string, number> = {};
  private statuses: Record<string, number> = {};
  private priorities: Record<string, number> = {};
  private users: Record<string, number> = {};
  private activities: Record<string, number> = {};

  constructor(client: RedmineClient) {
    this.client = client;
  }

  async load() {
    const fetchPromises: Promise<any>[] = [
      this.client.getProjects(),
      this.client.getTrackers(),
      this.client.getStatuses(),
      this.client.getPriorities(),
      this.client.getUsers()
    ];
    if (typeof this.client.getTimeEntryActivities === "function") {
      fetchPromises.push(this.client.getTimeEntryActivities());
    }

    const results = await Promise.allSettled(fetchPromises);

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

    this.activities = {};
    if (results[5] && results[5].status === "fulfilled" && results[5].value) {
      for (const a of results[5].value.time_entry_activities || []) {
        this.activities[a.name.toLowerCase()] = a.id;
      }
    }
  }

  resolveProject(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.projects, key) && typeof this.projects[key] === "number" ? this.projects[key] : undefined;
  }

  resolveTracker(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.trackers, key) && typeof this.trackers[key] === "number" ? this.trackers[key] : undefined;
  }

  resolveStatus(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.statuses, key) && typeof this.statuses[key] === "number" ? this.statuses[key] : undefined;
  }

  resolvePriority(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.priorities, key) && typeof this.priorities[key] === "number" ? this.priorities[key] : undefined;
  }

  resolveUser(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.users, key) && typeof this.users[key] === "number" ? this.users[key] : undefined;
  }

  resolveActivity(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.activities, key) && typeof this.activities[key] === "number" ? this.activities[key] : undefined;
  }
}
