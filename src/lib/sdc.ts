import { execFile } from "child_process";
import { promisify } from "util";
import { getPreferenceValues } from "@raycast/api";
import { DeployResult, Preferences } from "../types";

const execFileAsync = promisify(execFile);

const SHELL_PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
const K8S_PR_URL_REGEX = /https:\/\/github\.com\/[^\s]*kubernetes\/pull\/\d+/g;
const BRANCH_REGEX = /from branch\s*:\s*(\S+)/;

function getSdcPath(): string {
  const prefs = getPreferenceValues<Preferences>();
  return prefs.sdcPath?.trim() || "sdc";
}

async function execInRepo(
  command: string,
  args: string[],
  repoPath: string,
): Promise<{ stdout: string }> {
  return execFileAsync(command, args, {
    cwd: repoPath,
    env: { ...process.env, PATH: SHELL_PATH },
    timeout: 120_000,
  });
}

export function parsePrUrl(stdout: string): string | null {
  const matches = stdout.match(K8S_PR_URL_REGEX);
  return matches?.[0] ?? null;
}

export function parseBranch(stdout: string): string | null {
  const match = stdout.match(BRANCH_REGEX);
  return match?.[1] ?? null;
}

export async function gitCheckoutMainAndPull(repoPath: string): Promise<void> {
  await execInRepo("git", ["checkout", "main"], repoPath);
  await execInRepo("git", ["pull"], repoPath);
}

export async function deploySingle(
  service: string,
  stage: string,
  repoPath: string,
  ticket?: string,
): Promise<DeployResult> {
  const sdcPath = getSdcPath();
  const args = ["-d", "-s", service, "-stage", stage, "-ignore-tests", "-y"];
  if (ticket) {
    args.push("-t", ticket);
  }
  const { stdout } = await execInRepo(sdcPath, args, repoPath);
  const prUrl = parsePrUrl(stdout);
  const branch = parseBranch(stdout);

  return {
    stage,
    prUrl,
    branch,
    stdout,
  };
}
