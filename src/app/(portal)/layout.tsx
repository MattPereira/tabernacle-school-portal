import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signOut } from "@/app/actions";
import { PortalShell } from "@/components/portal-shell";
import { canonicalDestination } from "@/lib/auth/destination";
import { getViewer } from "@/lib/auth/viewer";

// Route-group layouts do not affect URLs. This is the one gate for every
// portal route, leaving the root layout concerned only with the document/theme.
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();

  if (viewer.state !== "linked") redirect(canonicalDestination(viewer));

  const sidebarCookie = (await cookies()).get("sidebar_state");

  return (
    <PortalShell
      viewer={viewer}
      defaultSidebarOpen={sidebarCookie?.value !== "false"}
      signOut={signOut}
    >
      {children}
    </PortalShell>
  );
}
