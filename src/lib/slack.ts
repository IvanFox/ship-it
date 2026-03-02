import { DeployResult } from "../types";

/**
 * Build a Slack message containing PR URLs for sandbox/live deployments.
 * Returns null if no PRs were created.
 */
export function buildSlackMessage(
  serviceName: string,
  results: DeployResult[],
): string | null {
  const prUrls = results
    .filter(
      (r) => (r.stage === "sandbox" || r.stage === "live") && r.prUrl,
    )
    .map((r) => r.prUrl as string);

  if (prUrls.length === 0) return null;
  return `Deploying ${serviceName}\n\n${prUrls.map((url) => `• ${url}`).join("\n")}`;
}
