import { describe, expect, it } from "vitest";

import { initials } from "@/lib/facts/initials";

describe("initials", () => {
  it("takes the first letter of each name, upper-cased", () => {
    expect(initials("ada", "lovelace")).toBe("AL");
    expect(initials("  Jane  ", "  Doe  ")).toBe("JD");
  });

  it("uses whichever name part FACTS has", () => {
    expect(initials(null, "Zeta")).toBe("Z");
    expect(initials("Prince", null)).toBe("P");
    expect(initials("", "")).toBe("");
  });

  it("has nothing to show when FACTS gave no name at all", () => {
    // A blank circle, not a placeholder person: the missing name is the thing
    // worth noticing.
    expect(initials(null, null)).toBe("");
  });
});
