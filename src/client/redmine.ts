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

export interface GetQueriesParams {
  limit?: number;
  offset?: number;
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

/**
 * 프로젝트 ID 를 URL 경로 세그먼트로 인코딩한다. encodeURIComponent 는 '.'·'..' 를 그대로 두어
 * axios 가 dot-segment 로 정규화하므로(상위 경로 이동) 빈 값과 함께 거부한다. (DL-0033)
 */
function encodeProjectSegment(projectId: string | number): string {
  const id = String(projectId).trim();
  if (id === "" || id === "." || id === "..") {
    throw new Error(`Invalid project id: ${JSON.stringify(id)}`);
  }
  return encodeURIComponent(id);
}

export interface AddProjectFileData {
  token: string;
  filename?: string;
  description?: string;
  version_id?: number;
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
    const encodedId = encodeURIComponent(String(projectId).trim());
    try {
      const { data } = await this.api.get(`/projects/${encodedId}.json`, { params: queryParams });
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 프로젝트 멤버십 전체 조회 (페이지네이션). 응답 크기·호출 수 폭주를 막기 위해 최대 10페이지(1,000건)까지만
   * 가져오고, 그 이상이면 truncated=true 로 표시한다. (DL-0033)
   */
  async getProjectMemberships(projectId: string | number) {
    const encodedId = encodeProjectSegment(projectId);
    const limit = 100;
    const maxPages = 10;
    let offset = 0;
    let pages = 0;
    let memberships: any[] = [];
    let totalCount = 0;

    do {
      const { data } = await this.api.get(`/projects/${encodedId}/memberships.json`, {
        params: { limit, offset },
      });
      const page = Array.isArray(data?.memberships) ? data.memberships : [];
      memberships = memberships.concat(page);
      totalCount = typeof data?.total_count === "number" ? data.total_count : memberships.length;
      offset += limit;
      pages += 1;
      if (page.length === 0) break;
    } while (offset < totalCount && pages < maxPages);

    // 상한 도달이든 빈 페이지로 인한 조기 종료든, 받은 건수가 total_count 보다 적으면 불완전한 목록이다.
    return { memberships, total_count: totalCount, truncated: memberships.length < totalCount };
  }

  async getIssueCategories(projectId: string | number) {
    const encodedId = encodeProjectSegment(projectId);
    const { data } = await this.api.get(`/projects/${encodedId}/issue_categories.json`);
    return data;
  }

  async getStatuses() {
    const { data } = await this.api.get('/issue_statuses.json');
    return data;
  }

  async getPriorities() {
    const { data } = await this.api.get('/enumerations/issue_priorities.json');
    return data;
  }

  /** 저장된 필터(Queries) 한 페이지 조회 (GET /queries.json). DL-0031 */
  async getQueries(params?: GetQueriesParams) {
    const queryParams: Record<string, number> = {};
    if (params?.limit !== undefined) queryParams.limit = params.limit;
    if (params?.offset !== undefined) queryParams.offset = params.offset;
    const { data } = await this.api.get('/queries.json', { params: queryParams });
    return data;
  }

  /** 페이지 상한(DoS 방지). 100건 × 20페이지 = 최대 2,000개 필터. */
  static readonly MAX_QUERY_PAGES = 20;

  /** 저장된 필터 전체 조회 (이름 매칭용). 페이지 상한에 걸리면 truncated: true. DL-0031 */
  async getAllQueries(): Promise<{ queries: any[]; total_count: number; truncated: boolean }> {
    const limit = 100;
    let offset = 0;
    let allQueries: any[] = [];
    let totalCount = 0;

    for (let page = 0; page < RedmineClient.MAX_QUERY_PAGES; page++) {
      const data = await this.getQueries({ limit, offset });
      const queries: any[] = Array.isArray(data?.queries) ? data.queries : [];
      allQueries = allQueries.concat(queries);
      totalCount = typeof data?.total_count === "number" ? data.total_count : 0;
      // 서버가 limit 보다 적게 돌려줄 수 있으므로(설정 상한) 받은 개수만큼 전진한다
      offset += queries.length;
      if (queries.length === 0 || offset >= totalCount) {
        return { queries: allQueries, total_count: totalCount, truncated: false };
      }
    }

    return { queries: allQueries, total_count: totalCount, truncated: true };
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
      const encodedId = encodeProjectSegment(projectId);
      const { data } = await this.api.get(`/projects/${encodedId}/versions.json`);
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

  // 프로젝트 "파일" 탭 (Files API, Redmine 3.4+). project id 는 경로 조작 방지를 위해 인코딩한다. (DL-0032)
  async getProjectFiles(projectId: string | number) {
    const encodedId = encodeProjectSegment(projectId);
    const { data } = await this.api.get(`/projects/${encodedId}/files.json`);
    return data;
  }

  async addProjectFile(projectId: string | number, fileData: AddProjectFileData) {
    const encodedId = encodeProjectSegment(projectId);
    const response = await this.api.post(`/projects/${encodedId}/files.json`, {
      file: fileData,
    });
    if (response.status === 204 || !response.data) {
      return { message: `File registered to project ${projectId} successfully` };
    }
    return response.data;
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
