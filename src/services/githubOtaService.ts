const DEFAULT_REPO_SLUG = 'ZoeyJF555/Mu-Offline-Mobile-nuevo-';
const LOCAL_VERSION = '2.3.0';
const LS_REPO_KEY = 'mu_linked_github_repo';
const LS_CLOUD_URL_KEY = 'mu_cloud_api_url';

export interface GithubOtaStatus {
  repoSlug: string;
  localVersion: string;
  pagesUrl: string;
  pagesVersion?: string;
  latestCommitSha?: string;
  latestCommitMessage?: string;
  updateAvailable: boolean;
  updateReason?: string;
}

function normalizeRepoSlug(raw: string): string {
  const trimmed = raw.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return DEFAULT_REPO_SLUG;
}

export function getLinkedGithubRepoSlug(): string {
  try {
    const saved = localStorage.getItem(LS_REPO_KEY);
    return saved ? normalizeRepoSlug(saved) : DEFAULT_REPO_SLUG;
  } catch {
    return DEFAULT_REPO_SLUG;
  }
}

export function setLinkedGithubRepoSlug(raw: string): string {
  const slug = normalizeRepoSlug(raw);
  try {
    localStorage.setItem(LS_REPO_KEY, slug);
  } catch {
    // ignore storage quota errors
  }
  return slug;
}

export function getConfiguredCloudApiUrl(): string {
  try {
    return (localStorage.getItem(LS_CLOUD_URL_KEY) || '').trim().replace(/\/+$/g, '');
  } catch {
    return '';
  }
}

export function setConfiguredCloudApiUrl(raw: string): string {
  const clean = raw.trim().replace(/\/+$/g, '');
  try {
    localStorage.setItem(LS_CLOUD_URL_KEY, clean);
  } catch {
    // ignore storage errors
  }
  return clean;
}

async function fetchJsonTimeout<T>(url: string, timeoutMs = 4000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function checkForGithubOtaUpdate(): Promise<GithubOtaStatus> {
  const repoSlug = getLinkedGithubRepoSlug();
  const [owner, repo] = repoSlug.split('/');
  const pagesUrl = `https://${owner.toLowerCase()}.github.io/${repo}/`;

  const localManifest = await fetchJsonTimeout<{ version?: string }>('./ota-manifest.json', 2500);
  const localVersion = localManifest?.version || LOCAL_VERSION;

  const status: GithubOtaStatus = {
    repoSlug,
    localVersion,
    pagesUrl,
    updateAvailable: false,
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return status;
  }

  const [pagesManifest, commitInfo] = await Promise.all([
    fetchJsonTimeout<{ version?: string }>(`${pagesUrl}ota-manifest.json`, 3500),
    fetchJsonTimeout<{ sha?: string; commit?: { message?: string } }>(
      `https://api.github.com/repos/${repoSlug}/commits/main`,
      3500,
    ),
  ]);

  if (pagesManifest?.version) {
    status.pagesVersion = pagesManifest.version;
    if (pagesManifest.version !== localVersion) {
      status.updateAvailable = true;
      status.updateReason = `Nueva versión ${pagesManifest.version} disponible en GitHub Pages.`;
    }
  }

  if (commitInfo?.sha) {
    const shortSha = commitInfo.sha.slice(0, 7);
    status.latestCommitSha = shortSha;
    status.latestCommitMessage = commitInfo.commit?.message?.split('\n')[0] || '';

  }

  return status;
}

export async function applyWebOtaUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !navigator.onLine) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    await registration.update();
    return true;
  } catch {
    return false;
  }
}

export function watchWebUpdates(): () => void {
  const check = () => void applyWebOtaUpdate();
  window.addEventListener('online', check);
  const timer = window.setInterval(check, 20 * 60 * 1000);
  return () => {
    window.removeEventListener('online', check);
    window.clearInterval(timer);
  };
}
