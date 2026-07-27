import { HomeIcon, type LucideIcon } from "lucide-react";

export type PortalNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Navigation is presentation data for the walking skeleton.
export const portalNavigation = (): PortalNavigationItem[] => [{ href: "/", label: "Home", icon: HomeIcon }];
