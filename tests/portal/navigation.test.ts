import { describe, expect, it } from "vitest";

import { portalNavigation } from "@/components/portal-navigation";

describe("portalNavigation", () => {
  it("shows Admin only to an admin viewer", () => {
    expect(portalNavigation({ admin: false }).map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/", label: "Home" },
    ]);
    expect(portalNavigation({ admin: true }).map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/", label: "Home" },
      { href: "/admin", label: "Admin" },
    ]);
  });
});
