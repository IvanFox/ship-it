import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "child_process";
import {
  parsePrUrl,
  parseBranch,
  extractTicketId,
  gitCheckoutMainAndPull,
  deploySingle,
} from "../sdc";

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
  it("extracts kubernetes URL from typical sdc output", () => {
    const output =
      "Creating PR [staging] deploy service-name → Pr is created. https://github.com/toknapp/kubernetes/pull/56197";
    expect(parsePrUrl(output)).toBe(
      "https://github.com/toknapp/kubernetes/pull/56197",
    );
  });

  it("returns null for output with no URL", () => {
    expect(parsePrUrl("Deploying... done.")).toBeNull();
  });

  it("ignores non-kubernetes PR URLs", () => {
    const output = "PR: https://github.com/some-org/some-repo/pull/999999";
    expect(parsePrUrl(output)).toBeNull();
  });

  it("extracts kubernetes URL even when other URLs are present", () => {
    const output = [
      "Service PR: https://github.com/org/my-service/pull/42",
      "K8s PR: https://github.com/org/kubernetes/pull/100",
    ].join("\n");
    expect(parsePrUrl(output)).toBe(
      "https://github.com/org/kubernetes/pull/100",
    );
  });

  it("takes only the first kubernetes match", () => {
    const output = [
      "https://github.com/org/repo-a/pull/1",
      "https://github.com/org/kubernetes/pull/10",
      "https://github.com/org/kubernetes/pull/20",
    ].join("\n");
    expect(parsePrUrl(output)).toBe(
      "https://github.com/org/kubernetes/pull/10",
    );
  });

  it("extracts kubernetes URL from real sdc output with ANSI codes", () => {
    const output = `Checking rollbacks...
2026-03-02 07:25:52 : Creating PR [staging] deploy corporate-action-proxy-voting \x1b[?25l\x1b[36m←\x1b[1D\x1b[0m→ Pr is created. https://github.com/toknapp/kubernetes/pull/56273
\x1b[?25h2026-03-02 07:25:54 : OK`;
    expect(parsePrUrl(output)).toBe(
      "https://github.com/toknapp/kubernetes/pull/56273",
    );
  });
});

describe("parseBranch", () => {
  it("extracts branch from sdc output", () => {
    const output = ` from branch               : CAP-1479\n from ref                  : abc123`;
    expect(parseBranch(output)).toBe("CAP-1479");
  });

  it("extracts main branch", () => {
    const output = ` from branch               : main\n`;
    expect(parseBranch(output)).toBe("main");
  });

  it("returns null when no branch line present", () => {
    expect(parseBranch("Deploying... done.")).toBeNull();
  });
});

describe("extractTicketId", () => {
  it("extracts ticket from branch name prefix", () => {
    expect(extractTicketId("CAP-1479-add-feature")).toBe("CAP-1479");
  });

  it("extracts ticket from commit message prefix", () => {
    expect(extractTicketId("CAP-1479 add feature")).toBe("CAP-1479");
  });

  it("normalises to uppercase", () => {
    expect(extractTicketId("cap-123-foo")).toBe("CAP-123");
  });

  it("returns null when no ticket present", () => {
    expect(extractTicketId("main")).toBeNull();
    expect(extractTicketId("fix-typo")).toBeNull();
    expect(extractTicketId("")).toBeNull();
  });

  it("handles ticket-only branch name", () => {
    expect(extractTicketId("ENG-42")).toBe("ENG-42");
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
  it("calls sdc with correct arguments and extracts kubernetes PR URL and branch", async () => {
    const k8sUrl = "https://github.com/org/kubernetes/pull/123";
    mockExecFile(
      ` from branch               : CAP-1479\nDeploying... PR created: https://github.com/org/my-service/pull/42\nK8s PR: ${k8sUrl}`,
    );

    const result = await deploySingle(
      "my-service",
      "sandbox",
      "/repo",
      "TICK-1",
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
    expect(result.prUrl).toBe(k8sUrl);
    expect(result.branch).toBe("CAP-1479");
  });

  it("returns nulls when sdc output has no PR link or branch", async () => {
    mockExecFile("Deployed successfully, no PR needed.");

    const result = await deploySingle("svc", "unstable", "/repo", "T-1");
    expect(result.prUrl).toBeNull();
    expect(result.branch).toBeNull();
  });
});
