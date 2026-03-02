import { LocalStorage } from "@raycast/api";
import { DeployHistoryEntry } from "../types";

const OVERRIDE_PREFIX = "override:";
const DEPLOY_HISTORY_KEY = "deploy-history";
const MAX_HISTORY_ENTRIES = 10;

function overrideKey(repoName: string, originalServiceName: string): string {
  return `${OVERRIDE_PREFIX}${repoName}/${originalServiceName}`;
}

export async function getServiceOverride(
  repoName: string,
  originalServiceName: string,
): Promise<string | undefined> {
  return LocalStorage.getItem<string>(
    overrideKey(repoName, originalServiceName),
  );
}

export async function setServiceOverride(
  repoName: string,
  originalServiceName: string,
  overrideName: string,
): Promise<void> {
  await LocalStorage.setItem(
    overrideKey(repoName, originalServiceName),
    overrideName,
  );
}

export async function removeServiceOverride(
  repoName: string,
  originalServiceName: string,
): Promise<void> {
  await LocalStorage.removeItem(overrideKey(repoName, originalServiceName));
}

export interface OverrideEntry {
  repoName: string;
  originalName: string;
  overrideName: string;
  key: string;
}

const PINNED_REPOS_KEY = "pinned-repos";

export async function getPinnedRepos(): Promise<string[]> {
  const raw = await LocalStorage.getItem<string>(PINNED_REPOS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function togglePinRepo(repoName: string): Promise<boolean> {
  const pinned = await getPinnedRepos();
  const index = pinned.indexOf(repoName);
  if (index >= 0) {
    pinned.splice(index, 1);
    await LocalStorage.setItem(PINNED_REPOS_KEY, JSON.stringify(pinned));
    return false;
  } else {
    pinned.push(repoName);
    await LocalStorage.setItem(PINNED_REPOS_KEY, JSON.stringify(pinned));
    return true;
  }
}

export async function getAllOverrides(): Promise<OverrideEntry[]> {
  const all = await LocalStorage.allItems();
  const entries: OverrideEntry[] = [];

  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(OVERRIDE_PREFIX)) continue;
    const rest = key.slice(OVERRIDE_PREFIX.length);
    const slashIndex = rest.indexOf("/");
    if (slashIndex === -1) continue;

    entries.push({
      repoName: rest.slice(0, slashIndex),
      originalName: rest.slice(slashIndex + 1),
      overrideName: String(value),
      key,
    });
  }

  return entries;
}

export async function getDeployHistory(): Promise<DeployHistoryEntry[]> {
  const raw = await LocalStorage.getItem<string>(DEPLOY_HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveDeployToHistory(
  entry: DeployHistoryEntry,
): Promise<void> {
  const history = await getDeployHistory();
  history.unshift(entry);
  await LocalStorage.setItem(
    DEPLOY_HISTORY_KEY,
    JSON.stringify(history.slice(0, MAX_HISTORY_ENTRIES)),
  );
}
