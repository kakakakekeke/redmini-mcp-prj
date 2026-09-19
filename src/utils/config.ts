export function loadConfig() {
  const REDMINE_URL = process.env.REDMINE_URL;
  const REDMINE_API_KEY = process.env.REDMINE_API_KEY;

  if (!REDMINE_URL) {
    throw new Error('REDMINE_URL is required');
  }

  return {
    REDMINE_URL,
    REDMINE_API_KEY,
  };
}
