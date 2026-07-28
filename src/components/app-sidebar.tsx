"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LogOutIcon, UserRoundIcon } from "lucide-react";

import { portalNavigation } from "@/components/portal-navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { StaffViewer } from "@/lib/auth/viewer";

export function AppSidebar({
  viewer,
  signOut,
}: {
  viewer: StaffViewer;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const navigation = portalNavigation();

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <p className="px-2 text-xl font-medium group-data-[collapsible=icon]:sr-only">
          Tabernacle Portal
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    size="xl"
                    className="group-data-[collapsible=icon]:p-2!"
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
              size="xl"
              className="group-data-[collapsible=icon]:p-2!"
              render={<Link href={`/staff/${viewer.staffId}`} />}
              tooltip={`${viewer.name} (staff)`}
            >
              <UserRoundIcon />
              <span>{viewer.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton
                size="xl"
                className="group-data-[collapsible=icon]:p-2!"
                type="submit"
                tooltip="Sign out"
              >
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
