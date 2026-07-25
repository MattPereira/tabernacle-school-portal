import { HomeIcon, ShieldIcon, type LucideIcon } from "lucide-react";

export type PortalNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Navigation is presentation data, but keeping this small decision at a
// public seam makes the admin-only link explicit and directly testable.
export function portalNavigation({ admin }: { admin: boolean }): PortalNavigationItem[] {
  const navigation = [{ href: "/", label: "Home", icon: HomeIcon }];

  if (admin) navigation.push({ href: "/admin", label: "Admin", icon: ShieldIcon });

  return navigation;
}
