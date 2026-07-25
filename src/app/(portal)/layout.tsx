import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { canonicalDestination } from "@/lib/auth/destination";
import { getViewer } from "@/lib/auth/viewer";

// Route-group layouts do not affect URLs. This is the one gate for every
// portal route, leaving the root layout concerned only with the document/theme.
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();

  if (viewer.state !== "linked") redirect(canonicalDestination(viewer));

  return children;
}
