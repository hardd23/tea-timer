import packageJson from '../package.json';

const repositoryUrl = packageJson.repository.url
  .replace(/^git\+/, '')
  .replace(/\.git$/, '');

export const APP_VERSION = packageJson.version;
export const GITHUB_URL = repositoryUrl;
export const GITHUB_LATEST_RELEASE_API_URL = `${repositoryUrl.replace('github.com', 'api.github.com/repos')}/releases/latest`;
