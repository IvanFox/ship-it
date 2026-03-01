import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "child_process";
import { parsePrUrl, gitCheckoutMainAndPull, deploySingle } from "../sdc";

function mockExecFile(stdout: string) {
  (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb?: (err: Error | null, result: { stdout: string }) => void,
    ) => {
      // promisify calls execFile with a callback
      if (cb) {
        cb(null, { stdout });
      }
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parsePrUrl", () => {
  it("extracts URL from typical sdc output", () => {
    const output =
      "Creating PR [staging] deploy service-name → Pr is created. https://github.com/toknapp/kubernetes/pull/56197";
    expect(parsePrUrl(output)).toBe(
      "https://github.com/toknapp/kubernetes/pull/56197",
    );
  });

  it("returns null for output with no URL", () => {
    expect(parsePrUrl("Deploying... done.")).toBeNull();
  });

  it("handles URLs with long paths", () => {
    const output = "PR: https://github.com/some-org/some-repo/pull/999999";
    expect(parsePrUrl(output)).toBe(
      "https://github.com/some-org/some-repo/pull/999999",
    );
  });
});

describe("gitCheckoutMainAndPull", () => {
  it("runs git checkout main then git pull", async () => {
    mockExecFile("");
    await gitCheckoutMainAndPull("/repo");

    const calls = (execFile as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe("git");
    expect(calls[0][1]).toEqual(["checkout", "main"]);
    expect(calls[0][2].cwd).toBe("/repo");
    expect(calls[1][0]).toBe("git");
    expect(calls[1][1]).toEqual(["pull"]);
    expect(calls[1][2].cwd).toBe("/repo");
  });
});

describe("deploySingle", () => {
  it("calls sdc with correct arguments and extracts PR URL", async () => {
    const prUrl = "https://github.com/org/k8s/pull/123";
    mockExecFile(`Deploying... PR created: ${prUrl}`);

    const result = await deploySingle(
      "my-service",
      "sandbox",
      "TICK-1",
      "/repo",
    );

    const calls = (execFile as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("sdc");
    expect(calls[0][1]).toEqual([
      "-d",
      "-s",
      "my-service",
      "-stage",
      "sandbox",
      "-ignore-tests",
      "-y",
      "-t",
      "TICK-1",
    ]);
    expect(calls[0][2].cwd).toBe("/repo");

    expect(result.stage).toBe("sandbox");
    expect(result.prUrl).toBe(prUrl);
  });

  it("returns null prUrl when sdc output has no PR link", async () => {
    mockExecFile("Deployed successfully, no PR needed.");

    const result = await deploySingle("svc", "unstable", "T-1", "/repo");
    expect(result.prUrl).toBeNull();
  });
});
