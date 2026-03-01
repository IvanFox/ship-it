import { describe, it, expect } from "vitest";
import { buildSlackMessage } from "../slack";
import type { DeployResult } from "../../types";

describe("buildSlackMessage", () => {
  it("returns null when results array is empty", () => {
    expect(buildSlackMessage([])).toBeNull();
  });

  it("returns null when sandbox/live results have no PR URLs", () => {
    const results: DeployResult[] = [
      { stage: "sandbox", prUrl: null, stdout: "no url" },
      { stage: "live", prUrl: null, stdout: "no url" },
    ];
    expect(buildSlackMessage(results)).toBeNull();
  });

  it("returns single URL for one sandbox PR", () => {
    const results: DeployResult[] = [
      {
        stage: "sandbox",
        prUrl: "https://github.com/org/repo/pull/1",
        stdout: "",
      },
    ];
    expect(buildSlackMessage(results)).toBe(
      "https://github.com/org/repo/pull/1",
    );
  });

  it("returns newline-separated URLs for sandbox + live PRs", () => {
    const results: DeployResult[] = [
      {
        stage: "sandbox",
        prUrl: "https://github.com/org/repo/pull/1",
        stdout: "",
      },
      {
        stage: "live",
        prUrl: "https://github.com/org/repo/pull/2",
        stdout: "",
      },
    ];
    expect(buildSlackMessage(results)).toBe(
      "https://github.com/org/repo/pull/1\nhttps://github.com/org/repo/pull/2",
    );
  });

  it("ignores unstable/staging results even if they have URLs", () => {
    const results: DeployResult[] = [
      {
        stage: "unstable",
        prUrl: "https://github.com/org/repo/pull/10",
        stdout: "",
      },
      {
        stage: "staging",
        prUrl: "https://github.com/org/repo/pull/11",
        stdout: "",
      },
      {
        stage: "sandbox",
        prUrl: "https://github.com/org/repo/pull/12",
        stdout: "",
      },
    ];
    expect(buildSlackMessage(results)).toBe(
      "https://github.com/org/repo/pull/12",
    );
  });
});
