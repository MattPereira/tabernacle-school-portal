import { describe, expect, it } from "vitest";

import { portalBreadcrumb, portalLocation, portalNavigation } from "@/components/portal-navigation";

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

describe("portalBreadcrumb", () => {
  it("puts roster detail below its linked roster", () => {
    expect(portalBreadcrumb("/staff/10")).toEqual([
      { label: "Staff", href: "/staff" },
      { label: "Profile" },
    ]);
    expect(portalBreadcrumb("/students/10")).toEqual([
      { label: "Students", href: "/students" },
      { label: "Profile" },
    ]);
  });

  it("uses the current portal location alone for non-detail routes", () => {
    expect(portalBreadcrumb("/staff")).toEqual([{ label: "Staff" }]);
    expect(portalBreadcrumb("/students")).toEqual([{ label: "Students" }]);
  });
});
