import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from '../../src/utils/config.js';

describe('Config Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load config when REDMINE_URL and REDMINE_API_KEY are provided', () => {
    process.env.REDMINE_URL = 'http://redmine.test';
    process.env.REDMINE_API_KEY = 'test_key';
    
    const config = loadConfig();
    expect(config.REDMINE_URL).toBe('http://redmine.test');
    expect(config.REDMINE_API_KEY).toBe('test_key');
  });

  it('should load config even if REDMINE_API_KEY is not provided', () => {
    process.env.REDMINE_URL = 'http://redmine.test';
    delete process.env.REDMINE_API_KEY;
    
    const config = loadConfig();
    expect(config.REDMINE_URL).toBe('http://redmine.test');
    expect(config.REDMINE_API_KEY).toBeUndefined();
  });

  it('should throw error if REDMINE_URL is missing', () => {
    delete process.env.REDMINE_URL;
    process.env.REDMINE_API_KEY = 'test_key';
    
    expect(() => loadConfig()).toThrow('REDMINE_URL is required');
  });
});