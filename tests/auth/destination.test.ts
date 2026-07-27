import { describe, expect, it } from "vitest";

import { canonicalDestination } from "@/lib/auth/destination";

describe("canonicalDestination", () => {
  it.each([
    ["anonymous", "/login"],
    ["unmatched", "/"],
    ["student", "/"],
    ["staff", "/"],
  ] as const)("sends %s viewers to %s", (state, destination) => {
    expect(canonicalDestination({ state })).toBe(destination);
  });
});
