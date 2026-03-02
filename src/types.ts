export interface ServiceInfo {
  /** Auto-discovered or overridden service name */
  name: string;
  /** Original auto-discovered name (before override) */
  originalName: string;
  /** Relative path within the repo (e.g., "services/custody/securities-journal") */
  path: string;
}

export interface DeployResult {
  stage: string;
  prUrl: string | null;
  branch: string | null;
  stdout: string;
}

export type DeployTarget = "unstable" | "staging" | "sandbox" | "live" | "all";

export const ALL_STAGES = ["unstable", "staging", "sandbox", "live"] as const;

export const STAGES_FOR_TARGET: Record<DeployTarget, readonly string[]> = {
  unstable: ["unstable"],
  staging: ["staging"],
  sandbox: ["sandbox"],
  live: ["live"],
  all: ALL_STAGES,
};

/** Stages that require git checkout main + pull before deploying */
export const MAIN_BRANCH_STAGES = new Set(["sandbox", "live"]);

export function requiresMainBranch(target: DeployTarget): boolean {
  if (target === "all") return true;
  return MAIN_BRANCH_STAGES.has(target);
}

export interface DeployHistoryEntry {
  id: string;
  serviceName: string;
  repoName: string;
  target: DeployTarget;
  timestamp: number;
  results: DeployResult[];
  error?: string;
}

const NO_CHANGES_MARKER = "No services for changes";

export function hasNoChanges(results: DeployResult[]): boolean {
  return results.every((r) => r.stdout.includes(NO_CHANGES_MARKER));
}

export interface Preferences {
  projectsDirectory: string;
  ignoredDirectories: string;
  sdcPath: string;
}
