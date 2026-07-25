"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LogOutIcon, UserRoundIcon } from "lucide-react";

import { portalNavigation } from "@/components/portal-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { LinkedViewer } from "@/lib/auth/viewer";

export function AppSidebar({
  viewer,
  signOut,
}: {
  viewer: LinkedViewer;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const navigation = portalNavigation(viewer);

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <p className="px-2 text-lg font-medium group-data-[collapsible=icon]:sr-only">
          Tabernacle School Portal
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm">Portal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    size="lg"
                    isActive={pathname === item.href}
                    render={<Link href={item.href} />}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              tooltip={`${viewer.name} (${viewer.role})`}
            >
              <UserRoundIcon />
              <span>{viewer.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton size="lg" type="submit" tooltip="Sign out">
                <LogOutIcon />
                <span>Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
