import { describe, expect, it } from "vitest";

import { portalNavigation } from "@/components/portal-navigation";

describe("portalNavigation", () => {
  it("shows the walking skeleton's home navigation", () => {
    expect(portalNavigation().map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/", label: "Home" },
    ]);
  });
});
