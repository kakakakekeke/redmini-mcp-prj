import axios, { AxiosInstance } from 'axios';

export interface GetIssuesParams {
  project_id?: string;
  status_id?: string;
  tracker_id?: string;
  assigned_to_id?: string;
  query?: string;
  limit?: number;
}

export interface GetIssueDetailsParams {
  issue_id: number;
  include_journals?: boolean;
  include_attachments?: boolean;
}

export interface GetProjectsParams {
  include_archived?: boolean;
}

export class RedmineClient {
  private api: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    this.api = axios.create({
      baseURL,
      headers: {
        'X-Redmine-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async getIssues(params: GetIssuesParams) {
    const queryParams: Record<string, unknown> = { ...params };
    if (params.query) {
       queryParams.subject = `~${params.query}`;
       delete queryParams.query;
    }

    try {
      const { data } = await this.api.get('/issues.json', { params: queryParams });
      return data;
    } catch (error) {
      // Re-throw or handle as per caller requirement
      throw error;
    }
  }

  async getIssueDetails(params: GetIssueDetailsParams) {
    const includes: string[] = ['allowed_statuses'];
    if (params.include_journals) includes.push('journals');
    if (params.include_attachments) includes.push('attachments');

    const queryParams: Record<string, unknown> = {};
    if (includes.length > 0) {
      queryParams.include = includes.join(',');
    }

    try {
      const { data } = await this.api.get(`/issues/${params.issue_id}.json`, { params: queryParams });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async updateIssue(issueId: number, issueData: any) {
    try {
      const { status, data } = await this.api.put(`/issues/${issueId}.json`, { issue: issueData });
      if (status === 204) {
        return {};
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getTrackers() {
    const { data } = await this.api.get('/trackers.json');
    return data;
  }

  async getProjects(params?: GetProjectsParams) {
    let offset = 0;
    const limit = 100;
    let allProjects: any[] = [];
    let totalCount = 0;

    const queryParams: any = {
      include: 'trackers,issue_categories,enabled_modules',
      limit,
    };
    
    if (params?.include_archived) {
      queryParams.status = '*';
    }
    
    do {
      queryParams.offset = offset;
      const { data } = await this.api.get('/projects.json', { params: queryParams });
      const projects = data.projects || [];
      allProjects = allProjects.concat(projects);
      totalCount = data.total_count || 0;
      offset += limit;
    } while (offset < totalCount);

    return { projects: allProjects };
  }

  async getStatuses() {
    const { data } = await this.api.get('/issue_statuses.json');
    return data;
  }

  async getPriorities() {
    const { data } = await this.api.get('/enumerations/issue_priorities.json');
    return data;
  }

  async createIssue(payload: any) {
    try {
      const { data } = await this.api.post('/issues.json', payload);
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getUsers() {
    let offset = 0;
    const limit = 100;
    let allUsers: any[] = [];
    let totalCount = 0;
    
    do {
      const { data } = await this.api.get('/users.json', { params: { limit, offset } });
      const users = data.users || [];
      allUsers = allUsers.concat(users);
      totalCount = data.total_count || 0;
      offset += limit;
    } while (offset < totalCount);

    return { users: allUsers };
  }

  async addIssueNote(params: { issue_id: number; notes: string; private_notes?: boolean }) {
    const payload = {
      issue: {
        notes: params.notes,
        private_notes: params.private_notes || false
      }
    };
    try {
      const response = await this.api.put(`/issues/${params.issue_id}.json`, payload);
      if (response.status === 204 || !response.data) {
        return {};
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getTimeEntryActivities() {
    const { data } = await this.api.get("/enumerations/time_entry_activities.json");
    return data;
  }

  async createTimeEntry(payload: { time_entry: Record<string, any> }) {
    try {
      const { data } = await this.api.post("/time_entries.json", payload);
      return data;
    } catch (error) {
      throw error;
    }
  }
}

