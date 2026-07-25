"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { LinkedViewer } from "@/lib/auth/viewer";

const pageLocations: Record<string, string> = {
  "/": "Home",
  "/admin": "Admin",
};

export function PortalShell({
  viewer,
  defaultSidebarOpen,
  signOut,
  children,
}: {
  viewer: LinkedViewer;
  defaultSidebarOpen: boolean;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const location = pageLocations[pathname] ?? "Portal";

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AppSidebar viewer={viewer} signOut={signOut} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <p className="text-sm font-medium">{location}</p>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
