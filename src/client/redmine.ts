import axios, { AxiosInstance } from 'axios';

export interface GetIssuesParams {
  project_id?: string;
  status_id?: string;
  assigned_to_id?: string;
  query?: string;
  limit?: number;
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
    // Note: The redmine API query parameter for text search is usually 'q' or 'subject' or we can ignore if not specified.
    // Wait, the specification says query -> `q` is not used in /issues.json, but search API uses `q`.
    // Wait, /issues.json uses `subject` for title search. Let's map query to subject if provided, or maybe omit for now as we just need basic parameters.
    const queryParams: any = { ...params };
    if (params.query) {
       queryParams.subject = `~${params.query}`;
       delete queryParams.query;
    }

    const { data } = await this.api.get('/issues.json', { params: queryParams });
    return data;
  }
}
