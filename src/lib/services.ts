import { readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { getPreferenceValues } from "@raycast/api";
import { ServiceInfo, Preferences } from "../types";
import { getServiceOverride } from "./storage";

const ALWAYS_IGNORED = new Set(["common", "pkg"]);

function getIgnoredDirs(): Set<string> {
  const prefs = getPreferenceValues<Preferences>();
  const extra = prefs.ignoredDirectories
    ? prefs.ignoredDirectories
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
    : [];
  return new Set([...ALWAYS_IGNORED, ...extra]);
}

function listDirectories(dirPath: string): string[] {
  try {
    return readdirSync(dirPath).filter((entry) => {
      const full = join(dirPath, entry);
      return statSync(full).isDirectory() && !entry.startsWith(".");
    });
  } catch {
    return [];
  }
}

/**
 * Discover services in a repository.
 *
 * Scans `services/` directory. For each non-ignored subdirectory, walks one
 * level deeper to find the service name (deepest directory).
 * Falls back to repo name if no `services/` directory exists.
 */
export async function discoverServices(repoPath: string): Promise<ServiceInfo[]> {
  const repoName = basename(repoPath);
  const servicesDir = join(repoPath, "services");
  const ignored = getIgnoredDirs();

  const topLevelDirs = listDirectories(servicesDir);
  if (topLevelDirs.length === 0) {
    // No services/ dir or it's empty — repo name is the service
    const override = await getServiceOverride(repoName, repoName);
    return [
      {
        name: override ?? repoName,
        originalName: repoName,
        path: "",
      },
    ];
  }

  const services: ServiceInfo[] = [];

  for (const topDir of topLevelDirs) {
    if (ignored.has(topDir)) continue;

    const topDirPath = join(servicesDir, topDir);
    const subDirs = listDirectories(topDirPath);

    if (subDirs.length === 0) {
      // Top-level dir itself is the service
      const override = await getServiceOverride(repoName, topDir);
      services.push({
        name: override ?? topDir,
        originalName: topDir,
        path: `services/${topDir}`,
      });
    } else {
      // Walk one level deeper — each subdir is a service
      for (const subDir of subDirs) {
        if (ignored.has(subDir)) continue;
        const originalName = subDir;
        const override = await getServiceOverride(repoName, originalName);
        services.push({
          name: override ?? originalName,
          originalName,
          path: `services/${topDir}/${subDir}`,
        });
      }
    }
  }

  // Fallback if everything was filtered out
  if (services.length === 0) {
    const override = await getServiceOverride(repoName, repoName);
    return [
      {
        name: override ?? repoName,
        originalName: repoName,
        path: "",
      },
    ];
  }

  return services;
}

/**
 * List repository directories from the configured projects path.
 */
export function listRepositories(projectsDirectory: string): string[] {
  return listDirectories(projectsDirectory).sort();
}
