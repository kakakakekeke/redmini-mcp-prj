import axios, { AxiosInstance } from 'axios';

export interface GetIssuesParams {
  project_id?: string;
  status_id?: string;
  assigned_to_id?: string;
  query?: string;
  limit?: number;
}

export interface GetIssueDetailsParams {
  issue_id: number;
  include_journals?: boolean;
  include_attachments?: boolean;
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
    const queryParams: any = { ...params };
    if (params.query) {
       queryParams.subject = `~${params.query}`;
       delete queryParams.query;
    }

    const { data } = await this.api.get('/issues.json', { params: queryParams });
    return data;
  }

  async getIssueDetails(params: GetIssueDetailsParams) {
    const includes: string[] = ['allowed_statuses'];
    if (params.include_journals) includes.push('journals');
    if (params.include_attachments) includes.push('attachments');

    const queryParams: any = {};
    if (includes.length > 0) {
      queryParams.include = includes.join(',');
    }

    const { data } = await this.api.get(`/issues/${params.issue_id}.json`, { params: queryParams });
    return data;
  }
}
