import { describe, it, expect } from "vitest";
import { buildSlackMessage } from "../slack";
import type { DeployResult } from "../../types";

function result(
  stage: string,
  prUrl: string | null = null,
): DeployResult {
  return { stage, prUrl, branch: null, stdout: "" };
}

describe("buildSlackMessage", () => {
  it("returns null when results array is empty", () => {
    expect(buildSlackMessage("svc", [])).toBeNull();
  });

  it("returns null when sandbox/live results have no PR URLs", () => {
    expect(
      buildSlackMessage("svc", [result("sandbox"), result("live")]),
    ).toBeNull();
  });

  it("returns message with kubernetes PR", () => {
    const results = [
      result("sandbox", "https://github.com/org/kubernetes/pull/100"),
    ];
    expect(buildSlackMessage("my-service", results)).toBe(
      "Deploying my-service\n\n• https://github.com/org/kubernetes/pull/100",
    );
  });

  it("includes PRs for sandbox + live", () => {
    const results = [
      result("sandbox", "https://github.com/org/kubernetes/pull/100"),
      result("live", "https://github.com/org/kubernetes/pull/101"),
    ];
    expect(buildSlackMessage("my-service", results)).toBe(
      "Deploying my-service\n\n" +
        "• https://github.com/org/kubernetes/pull/100\n" +
        "• https://github.com/org/kubernetes/pull/101",
    );
  });

  it("ignores unstable/staging results even if they have URLs", () => {
    const results = [
      result("unstable", "https://github.com/org/kubernetes/pull/10"),
      result("staging", "https://github.com/org/kubernetes/pull/11"),
      result("sandbox", "https://github.com/org/kubernetes/pull/200"),
    ];
    expect(buildSlackMessage("svc", results)).toBe(
      "Deploying svc\n\n• https://github.com/org/kubernetes/pull/200",
    );
  });
});
