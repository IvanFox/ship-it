import { execFile } from "child_process";
import { promisify } from "util";
import { getPreferenceValues } from "@raycast/api";
import { DeployResult, Preferences } from "../types";

const execFileAsync = promisify(execFile);

const SHELL_PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
const PR_URL_REGEX = /https:\/\/github\.com\/[^\s]+\/pull\/\d+/;

function getSdcPath(): string {
  const prefs = getPreferenceValues<Preferences>();
  return prefs.sdcPath?.trim() || "sdc";
}

async function execInRepo(command: string, args: string[], repoPath: string): Promise<{ stdout: string }> {
  return execFileAsync(command, args, {
    cwd: repoPath,
    env: { ...process.env, PATH: SHELL_PATH },
    timeout: 120_000,
  });
}

export function parsePrUrl(stdout: string): string | null {
  const match = stdout.match(PR_URL_REGEX);
  return match ? match[0] : null;
}

export async function gitCheckoutMainAndPull(repoPath: string): Promise<void> {
  await execInRepo("git", ["checkout", "main"], repoPath);
  await execInRepo("git", ["pull"], repoPath);
}

export async function deploySingle(
  service: string,
  stage: string,
  ticket: string,
  repoPath: string,
): Promise<DeployResult> {
  const sdcPath = getSdcPath();
  const { stdout } = await execInRepo(sdcPath, ["-d", "-s", service, "-stage", stage, "-ignore-tests", "-y", "-t", ticket], repoPath);

  return {
    stage,
    prUrl: parsePrUrl(stdout),
    stdout,
  };
}
