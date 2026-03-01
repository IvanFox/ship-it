import { describe, it, expect, beforeEach } from "vitest";
import { __reset } from "../../__mocks__/raycast";
import {
  getServiceOverride,
  setServiceOverride,
  removeServiceOverride,
  getAllOverrides,
} from "../storage";

beforeEach(() => {
  __reset();
});

describe("setServiceOverride / getServiceOverride round-trip", () => {
  it("stores and retrieves an override", async () => {
    await setServiceOverride("my-repo", "original-svc", "custom-svc");
    const result = await getServiceOverride("my-repo", "original-svc");
    expect(result).toBe("custom-svc");
  });

  it("returns undefined for missing override", async () => {
    const result = await getServiceOverride("repo", "nonexistent");
    expect(result).toBeUndefined();
  });
});

describe("removeServiceOverride", () => {
  it("removes a previously set override", async () => {
    await setServiceOverride("repo", "svc", "override");
    await removeServiceOverride("repo", "svc");
    const result = await getServiceOverride("repo", "svc");
    expect(result).toBeUndefined();
  });
});

describe("getAllOverrides", () => {
  it("parses override keys correctly", async () => {
    await setServiceOverride("repo-a", "svc-1", "custom-1");
    await setServiceOverride("repo-b", "svc-2", "custom-2");

    const overrides = await getAllOverrides();
    expect(overrides).toHaveLength(2);
    expect(overrides).toContainEqual({
      repoName: "repo-a",
      originalName: "svc-1",
      overrideName: "custom-1",
      key: "override:repo-a/svc-1",
    });
    expect(overrides).toContainEqual({
      repoName: "repo-b",
      originalName: "svc-2",
      overrideName: "custom-2",
      key: "override:repo-b/svc-2",
    });
  });

  it("ignores non-override keys", async () => {
    const { LocalStorage } = await import("@raycast/api");
    await LocalStorage.setItem("some-other-key", "value");
    await setServiceOverride("repo", "svc", "override");

    const overrides = await getAllOverrides();
    expect(overrides).toHaveLength(1);
    expect(overrides[0].repoName).toBe("repo");
  });
});
