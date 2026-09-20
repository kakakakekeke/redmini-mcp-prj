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

export interface SearchWikiParams {
  project_id?: string;
  title?: string;
  query?: string;
  include_attachments?: boolean;
  limit?: number;
}


export interface CreateOrUpdateWikiParams {
  project_id: string;
  title: string;
  text: string;
  comments?: string;
  version?: number;
  parent_title?: string;
}

export interface CreateOrUpdateWikiResult {
  message: string;
  wiki_page?: Record<string, any>;
}

export interface GetMyAccountParams {
  include_memberships?: boolean;
  include_groups?: boolean;
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

  async searchWiki(params: SearchWikiParams) {
    const { project_id, title, query, include_attachments, limit } = params;

    if (!project_id) {
      throw new Error("project_id is required for wiki search");
    }

    if (title) {
      const queryParams: Record<string, unknown> = {
        include: include_attachments ? "attachments" : undefined,
      };
      const { data } = await this.api.get(`/projects/${project_id}/wiki/${encodeURIComponent(title)}.json`, {
        params: queryParams,
      });
      return { wiki_pages: [data.wiki_page || data] };
    }

    const queryParams: Record<string, unknown> = {
      q: query || "",
      limit: limit ?? 10,
      include: include_attachments ? "attachments" : undefined,
    };

    const { data } = await this.api.get(`/projects/${project_id}/wiki/index.json`, {
      params: queryParams,
    });

    const wikiPages = data.wiki_pages || data.pages || [];
    return { wiki_pages: wikiPages.slice(0, limit ?? 10) };
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
  async createOrUpdateWiki(params: CreateOrUpdateWikiParams): Promise<CreateOrUpdateWikiResult> {
    const { project_id, title, text, comments, version, parent_title } = params;
    const wiki_page: Record<string, unknown> = { text };
    if (comments !== undefined) wiki_page.comments = comments;
    if (version !== undefined) wiki_page.version = version;
    if (parent_title !== undefined) wiki_page.parent_title = parent_title;

    try {
      const response = await this.api.put(
        `/projects/${encodeURIComponent(project_id)}/wiki/${encodeURIComponent(title)}.json`,
        { wiki_page }
      );

      if (response.status === 201) {
        return {
          message: `Wiki page '${title}' created successfully.`,
          wiki_page: response.data?.wiki_page || response.data,
        };
      }

      return {
        message: `Wiki page '${title}' updated successfully.`,
        ...(response.data?.wiki_page ? { wiki_page: response.data.wiki_page } : {}),
      };
    } catch (error) {
      throw error;
    }
  }
  async getMyAccount(params?: GetMyAccountParams) {
    const includes: string[] = [];
    if (params?.include_memberships) includes.push("memberships");
    if (params?.include_groups) includes.push("groups");

    const queryParams: Record<string, unknown> = {};
    if (includes.length > 0) {
      queryParams.include = includes.join(",");
    }

    try {
      const { data } = await this.api.get("/my/account.json", { params: queryParams });
      return data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        const { data } = await this.api.get("/users/current.json", { params: queryParams });
        return data;
      }
      throw error;
    }
  }

}
