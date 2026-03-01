import { describe, it, expect, vi, beforeEach } from "vitest";
import { __reset, __setPreferences } from "../../__mocks__/raycast";

vi.mock("fs", () => ({
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ isDirectory: () => true })),
}));

import { readdirSync, statSync } from "fs";
import { discoverServices, listRepositories } from "../services";

const mockReaddirSync = readdirSync as unknown as ReturnType<typeof vi.fn>;
const mockStatSync = statSync as unknown as ReturnType<typeof vi.fn>;

function setupFs(tree: Record<string, string[]>) {
  mockReaddirSync.mockImplementation((dirPath: string) => {
    const entries = tree[dirPath];
    if (!entries) throw new Error(`ENOENT: ${dirPath}`);
    return entries;
  });
  mockStatSync.mockImplementation(() => ({
    isDirectory: () => true,
  }));
}

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

describe("discoverServices", () => {
  it("discovers services two levels deep", async () => {
    setupFs({
      "/repo/services": ["corporate-action"],
      "/repo/services/corporate-action": ["corporate-action-processing"],
    });

    const services = await discoverServices("/repo");
    expect(services).toHaveLength(1);
    expect(services[0]).toEqual({
      name: "corporate-action-processing",
      originalName: "corporate-action-processing",
      path: "services/corporate-action/corporate-action-processing",
    });
  });

  it("falls back to repo name when no services/ dir", async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const services = await discoverServices("/projects/my-app");
    expect(services).toHaveLength(1);
    expect(services[0].name).toBe("my-app");
    expect(services[0].path).toBe("");
  });

  it("filters out common and pkg directories", async () => {
    setupFs({
      "/repo/services": ["common", "pkg", "actual-service"],
      "/repo/services/actual-service": [],
    });

    const services = await discoverServices("/repo");
    expect(services).toHaveLength(1);
    expect(services[0].name).toBe("actual-service");
  });

  it("filters user-configured ignored directories", async () => {
    __setPreferences({ ignoredDirectories: "infra,tools" });
    setupFs({
      "/repo/services": ["infra", "tools", "payments"],
      "/repo/services/payments": [],
    });

    const services = await discoverServices("/repo");
    expect(services).toHaveLength(1);
    expect(services[0].name).toBe("payments");
  });

  it("applies overrides from storage", async () => {
    const { LocalStorage } = await import("@raycast/api");
    await LocalStorage.setItem("override:repo/my-svc", "renamed-svc");

    setupFs({
      "/repo/services": ["my-svc"],
      "/repo/services/my-svc": [],
    });

    const services = await discoverServices("/repo");
    expect(services).toHaveLength(1);
    expect(services[0].name).toBe("renamed-svc");
    expect(services[0].originalName).toBe("my-svc");
  });

  it("treats top-level dir as service when it has no subdirs", async () => {
    setupFs({
      "/repo/services": ["standalone-svc"],
      "/repo/services/standalone-svc": [],
    });

    const services = await discoverServices("/repo");
    expect(services).toHaveLength(1);
    expect(services[0]).toEqual({
      name: "standalone-svc",
      originalName: "standalone-svc",
      path: "services/standalone-svc",
    });
  });
});

describe("listRepositories", () => {
  it("lists directories and skips hidden dirs", () => {
    mockReaddirSync.mockReturnValue([".git", "repo-a", "repo-b", ".hidden"]);
    mockStatSync.mockImplementation((fullPath: string) => ({
      isDirectory: () =>
        !fullPath.includes(".git") && !fullPath.includes(".hidden"),
    }));

    const repos = listRepositories("/projects");
    expect(repos).toEqual(["repo-a", "repo-b"]);
  });
});
