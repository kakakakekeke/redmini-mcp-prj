import { describe, it, expect, vi } from 'vitest';
import { getAuthClient } from '../../src/middleware/auth.js';
import { RedmineClient } from '../../src/client/redmine.js';
import * as configModule from '../../src/utils/config.js';

vi.mock('../../src/utils/config.js');

describe('Auth Middleware', () => {
  it('should use X-Redmine-API-Key header if provided', () => {
    vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: 'http://redmine.test', REDMINE_API_KEY: 'fallback_key' });
    const reqHeaders = { 'x-redmine-api-key': 'user_specific_key' };
    
    const client = getAuthClient(reqHeaders);
    expect(client).toBeInstanceOf(RedmineClient);
  });

  it('should fallback to REDMINE_API_KEY environment variable if header is not provided', () => {
    vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: 'http://redmine.test', REDMINE_API_KEY: 'fallback_key' });
    const reqHeaders = {};
    
    const client = getAuthClient(reqHeaders);
    expect(client).toBeInstanceOf(RedmineClient);
  });

  it('should throw error if no API key is available in header and env', () => {
    vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: 'http://redmine.test' }); 
    const reqHeaders = {};
    
    expect(() => getAuthClient(reqHeaders)).toThrow('Authentication failed: Missing Redmine API Key');
  });

  it('should be case-insensitive for header keys', () => {
    vi.mocked(configModule.loadConfig).mockReturnValue({ REDMINE_URL: 'http://redmine.test' });
    const reqHeaders = { 'X-Redmine-API-Key': 'user_specific_key' };
    
    const client = getAuthClient(reqHeaders);
    expect(client).toBeInstanceOf(RedmineClient);
  });
});