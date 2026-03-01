import { describe, it, expect } from "vitest";
import { requiresMainBranch, STAGES_FOR_TARGET, ALL_STAGES } from "../types";

describe("requiresMainBranch", () => {
  it("returns false for unstable", () => {
    expect(requiresMainBranch("unstable")).toBe(false);
  });

  it("returns false for staging", () => {
    expect(requiresMainBranch("staging")).toBe(false);
  });

  it("returns true for sandbox", () => {
    expect(requiresMainBranch("sandbox")).toBe(true);
  });

  it("returns true for live", () => {
    expect(requiresMainBranch("live")).toBe(true);
  });

  it("returns true for all", () => {
    expect(requiresMainBranch("all")).toBe(true);
  });
});

describe("STAGES_FOR_TARGET", () => {
  it('"all" contains all 4 stages in order', () => {
    expect(STAGES_FOR_TARGET.all).toEqual([
      "unstable",
      "staging",
      "sandbox",
      "live",
    ]);
    expect(STAGES_FOR_TARGET.all).toBe(ALL_STAGES);
  });

  it("single targets contain only their stage", () => {
    expect(STAGES_FOR_TARGET.unstable).toEqual(["unstable"]);
    expect(STAGES_FOR_TARGET.staging).toEqual(["staging"]);
    expect(STAGES_FOR_TARGET.sandbox).toEqual(["sandbox"]);
    expect(STAGES_FOR_TARGET.live).toEqual(["live"]);
  });
});
