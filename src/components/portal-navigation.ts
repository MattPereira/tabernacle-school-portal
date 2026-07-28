import { GraduationCapIcon, HomeIcon, type LucideIcon, UsersIcon } from "lucide-react";

export type PortalNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type PortalBreadcrumb = { label: string; href?: string };

// Navigation is presentation data. Every item is open to every staff viewer:
// the portal layout is the only access boundary, and features add no RBAC.
export const portalNavigation = (): PortalNavigationItem[] => [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/staff", label: "Staff", icon: UsersIcon },
  { href: "/students", label: "Students", icon: GraduationCapIcon },
];

// What the portal header calls where you are. Derived from the navigation so a
// new item can't ship with a sidebar label and a nameless header.
export const portalLocation = (pathname: string): string =>
  portalNavigation().find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Portal";

// Staff detail is one level below the Staff roster. Other portal locations are
// their own destinations, so their header remains a single current-page crumb.
export const portalBreadcrumb = (pathname: string): PortalBreadcrumb[] => {
  const detail = /^\/(staff|students)\/\d+$/.exec(pathname);
  if (detail) {
    const location = portalLocation(pathname);
    return [{ label: location, href: `/${detail[1]}` }, { label: "Profile" }];
  }

  return [{ label: portalLocation(pathname) }];
};
