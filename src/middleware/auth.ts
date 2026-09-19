import { RedmineClient } from '../client/redmine.js';
import { loadConfig } from '../utils/config.js';

export function getAuthClient(headers: Record<string, string | string[] | undefined>): RedmineClient {
  const config = loadConfig();
  
  const headerKey = Object.keys(headers).find(k => k.toLowerCase() === 'x-redmine-api-key');
  const userApiKey = headerKey ? headers[headerKey] : undefined;
  
  const apiKey = (Array.isArray(userApiKey) ? userApiKey[0] : userApiKey) || config.REDMINE_API_KEY;
  
  if (!apiKey) {
    throw new Error('Authentication failed: Missing Redmine API Key');
  }
  
  return new RedmineClient(config.REDMINE_URL, apiKey);
}
