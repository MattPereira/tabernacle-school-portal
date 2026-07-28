import { HomeIcon, type LucideIcon, UsersIcon } from "lucide-react";

export type PortalNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Navigation is presentation data. Every item is open to every staff viewer:
// the portal layout is the only access boundary, and features add no RBAC.
export const portalNavigation = (): PortalNavigationItem[] => [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/staff", label: "Staff", icon: UsersIcon },
];
