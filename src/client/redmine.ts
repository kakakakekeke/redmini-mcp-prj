import axios, { AxiosInstance } from 'axios';

export interface GetIssuesParams {
  project_id?: string | number;
  subproject_id?: string | number;
  issue_id?: string | number;
  parent_id?: string | number;
  status_id?: string | number;
  tracker_id?: string | number;
  priority_id?: string | number;
  category_id?: string | number;
  fixed_version_id?: string | number;
  assigned_to_id?: string | number;
  author_id?: string | number;
  query_id?: string | number;
  query?: string;
  subject?: string;
  description?: string;
  created_on?: string;
  updated_on?: string;
  start_date?: string;
  due_date?: string;
  closed_on?: string;
  estimated_hours?: string | number;
  done_ratio?: string | number;
  custom_fields?: Record<string, string | number>;
  sort?: string;
  limit?: number;
  offset?: number;
  include?: string;
}

export interface GetIssueDetailsParams {
  issue_id: number;
  include_journals?: boolean;
  include_attachments?: boolean;
}

export interface GetProjectsParams {
  include_archived?: boolean;
}

export interface GetProjectParams {
  include?: string;
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

export interface SearchAllParams {
  q: string;
  scope?: "all" | "my_projects" | "subprojects";
  open_issues?: boolean;
  all_words?: boolean;
  titles_only?: boolean;
  issues?: boolean;
  wiki_pages?: boolean;
  news?: boolean;
  documents?: boolean;
  changesets?: boolean;
  messages?: boolean;
  projects?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateOrUpdateWikiResult {
  message: string;
  wiki_page?: Record<string, any>;
}

export interface GetMyAccountParams {
  include_memberships?: boolean;
  include_groups?: boolean;
}

export interface GetTimeEntriesParams {
  project_id?: string | number;
  issue_id?: number;
  user_id?: string | number;
  from?: string;
  to?: string;
  spent_on?: string;
  limit?: number;
  offset?: number;
}


export interface CreateVersionData {
  name: string;
  status?: "open" | "locked" | "closed";
  sharing?: "none" | "descendants" | "hierarchy" | "tree" | "system";
  due_date?: string;
  description?: string;
}

export interface UpdateVersionData {
  name?: string;
  status?: "open" | "locked" | "closed";
  sharing?: "none" | "descendants" | "hierarchy" | "tree" | "system";
  due_date?: string;
  description?: string;
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
    if (params.query !== undefined) {
      if (params.query.trim().length > 0 && !queryParams.subject) {
        queryParams.subject = `~${params.query.trim()}`;
      }
      delete queryParams.query;
    }
    if (params.custom_fields) {
      for (const [key, value] of Object.entries(params.custom_fields)) {
        const cfKey = key.startsWith("cf_") ? key : `cf_${key}`;
        queryParams[cfKey] = value;
      }
      delete queryParams.custom_fields;
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

  async getProject(projectId: string | number, params?: GetProjectParams) {
    const defaultInclude = "trackers,issue_categories,enabled_modules,time_entry_activities,issue_custom_fields";
    const queryParams: Record<string, any> = {
      include: params?.include !== undefined ? params.include : defaultInclude,
    };
    try {
      const { data } = await this.api.get(`/projects/${projectId}.json`, { params: queryParams });
      return data;
    } catch (error) {
      throw error;
    }
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

  async getTimeEntries(params?: GetTimeEntriesParams) {
    try {
      const { data } = await this.api.get("/time_entries.json", { params });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getTimeEntryDetails(id: number) {
    try {
      const { data } = await this.api.get(`/time_entries/${id}.json`);
      return data;
    } catch (error) {
      throw error;
    }
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

  async searchAll(params: SearchAllParams) {
    const queryParams: Record<string, unknown> = {
      q: params.q,
    };

    if (params.scope) queryParams.scope = params.scope;
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.offset !== undefined) queryParams.offset = params.offset;

    if (params.open_issues !== undefined) queryParams.open_issues = params.open_issues ? 1 : 0;
    if (params.all_words !== undefined) queryParams.all_words = params.all_words ? 1 : 0;
    if (params.titles_only !== undefined) queryParams.titles_only = params.titles_only ? 1 : 0;

    const domainFlags = [
      "issues",
      "wiki_pages",
      "news",
      "documents",
      "changesets",
      "messages",
      "projects",
    ] as const;

    for (const flag of domainFlags) {
      if (params[flag] !== undefined) {
        queryParams[flag] = params[flag] ? 1 : 0;
      }
    }

    try {
      const { data } = await this.api.get("/search.json", { params: queryParams });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getIssueRelations(issueId: number) {
    try {
      const { data } = await this.api.get(`/issues/${issueId}/relations.json`);
      return data;
    } catch (error) {
      throw error;
    }
  }

  async createIssueRelation(
    issueId: number,
    relationData: { issue_to_id: number; relation_type: string; delay?: number }
  ) {
    try {
      const { data } = await this.api.post(`/issues/${issueId}/relations.json`, {
        relation: relationData,
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async deleteIssueRelation(relationId: number) {
    try {
      await this.api.delete(`/relations/${relationId}.json`);
      return { message: `Relation ${relationId} deleted successfully` };
    } catch (error) {
      throw error;
    }
  }
  async getWatchers(issueId: number) {
    try {
      const { data } = await this.api.get(`/issues/${issueId}.json`, {
        params: { include: "watchers" },
      });
      return data.issue?.watchers || [];
    } catch (error) {
      throw error;
    }
  }

  async addWatcher(issueId: number, userId: number) {
    try {
      const response = await this.api.post(`/issues/${issueId}/watchers.json`, {
        user_id: userId,
      });
      if (response.status === 204 || !response.data) {
        return {
          message: `User ${userId} added as watcher to issue ${issueId} successfully`,
        };
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async removeWatcher(issueId: number, userId: number) {
    try {
      await this.api.delete(`/issues/${issueId}/watchers/${userId}.json`);
      return {
        message: `User ${userId} removed from watchers of issue ${issueId} successfully`,
      };
    } catch (error) {
      throw error;
    }
  }

  async getProjectVersions(projectId: string | number) {
    try {
      const { data } = await this.api.get(`/projects/${projectId}/versions.json`);
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getVersionDetails(versionId: number) {
    try {
      const { data } = await this.api.get(`/versions/${versionId}.json`);
      return data;
    } catch (error) {
      throw error;
    }
  }

  async createVersion(projectId: string | number, versionData: CreateVersionData) {
    try {
      const { data } = await this.api.post(`/projects/${projectId}/versions.json`, {
        version: versionData,
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async updateVersion(versionId: number, versionData: UpdateVersionData) {
    try {
      const response = await this.api.put(`/versions/${versionId}.json`, {
        version: versionData,
      });
      if (response.status === 204 || !response.data) {
        return { message: `Version ${versionId} updated successfully` };
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deleteVersion(versionId: number) {
    try {
      await this.api.delete(`/versions/${versionId}.json`);
      return { message: `Version ${versionId} deleted successfully` };
    } catch (error) {
      throw error;
    }
  }

  async uploadFile(
    filename: string,
    content: Buffer | string,
    contentType: string = "application/octet-stream"
  ) {
    try {
      const { data } = await this.api.post("/uploads.json", content, {
        params: { filename },
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async getAttachment(attachmentId: number) {
    try {
      const { data } = await this.api.get(`/attachments/${attachmentId}.json`);
      return data;
    } catch (error) {
      throw error;
    }
  }

  async downloadAttachment(attachmentId: number, filename: string) {
    try {
      const encodedFilename = encodeURIComponent(filename);
      const { data } = await this.api.get(
        `/attachments/download/${attachmentId}/${encodedFilename}`,
        {
          responseType: "arraybuffer",
        }
      );
      return data;
    } catch (error) {
      throw error;
    }
  }
}
