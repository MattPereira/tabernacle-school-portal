import { describe, expect, it } from "vitest";

import { isSchoolDomain } from "@/lib/identity";

// The domain restriction is policy layered on top of the link-table gate
// (ADR-0001, Decision 4), not the invariant — but it still has to be enforced
// server-side, because the OAuth `hd` hint is only a hint.
describe("isSchoolDomain", () => {
  it("accepts a tbs.org login identity", () => {
    expect(isSchoolDomain("27beno@tbs.org")).toBe(true);
  });

  it("accepts it whatever casing the provider hands back", () => {
    expect(isSchoolDomain(" 27BenO@TBS.org ")).toBe(true);
  });

  it("rejects a personal Google account", () => {
    expect(isSchoolDomain("someone@gmail.com")).toBe(false);
  });

  it("rejects domains that merely contain tbs.org", () => {
    expect(isSchoolDomain("attacker@nottbs.org")).toBe(false);
    expect(isSchoolDomain("attacker@tbs.org.example.com")).toBe(false);
    expect(isSchoolDomain("attacker@sub.tbs.org")).toBe(false);
  });
});
