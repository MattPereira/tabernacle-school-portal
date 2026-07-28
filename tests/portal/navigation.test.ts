import { describe, expect, it } from "vitest";

import { portalLocation, portalNavigation } from "@/components/portal-navigation";

describe("portalNavigation", () => {
  it("links Home, Staff and Students, in that order", () => {
    // "Staff", never "Directory" — the school's own word (CONTEXT.md).
    expect(portalNavigation().map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/", label: "Home" },
      { href: "/staff", label: "Staff" },
      { href: "/students", label: "Students" },
    ]);
  });
});

describe("portalLocation", () => {
  it("names the header after the navigation item you are on", () => {
    expect(portalLocation("/")).toBe("Home");
    expect(portalLocation("/staff")).toBe("Staff");
    expect(portalLocation("/students")).toBe("Students");
  });

  it("falls back to the portal itself off the navigation", () => {
    expect(portalLocation("/somewhere-else")).toBe("Portal");
  });
});
