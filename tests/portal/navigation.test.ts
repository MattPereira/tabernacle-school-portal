import { describe, expect, it } from "vitest";

import { portalNavigation } from "@/components/portal-navigation";

describe("portalNavigation", () => {
  it("links Home and Staff, in that order", () => {
    // "Staff", never "Directory" — the school's own word (CONTEXT.md).
    expect(portalNavigation().map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/", label: "Home" },
      { href: "/staff", label: "Staff" },
    ]);
  });
});
