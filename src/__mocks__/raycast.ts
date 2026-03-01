import type { Preferences } from "../types";

const store = new Map<string, string>();

export const LocalStorage = {
  async getItem<T = string>(key: string): Promise<T | undefined> {
    return store.get(key) as T | undefined;
  },
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async allItems(): Promise<Record<string, string>> {
    return Object.fromEntries(store);
  },
  async clear(): Promise<void> {
    store.clear();
  },
};

let _preferences: Preferences = {
  projectsDirectory: "/tmp/projects",
  ignoredDirectories: "",
  sdcPath: "",
};

export function getPreferenceValues<T = Preferences>(): T {
  return _preferences as unknown as T;
}

/** Test helper — set preferences for the next call */
export function __setPreferences(prefs: Partial<Preferences>): void {
  _preferences = { ..._preferences, ...prefs };
}

/** Test helper — reset mock state */
export function __reset(): void {
  store.clear();
  _preferences = {
    projectsDirectory: "/tmp/projects",
    ignoredDirectories: "",
    sdcPath: "",
  };
}
