import { getViewer } from "@/lib/auth/viewer";

import { HomeScreen } from "@/components/home-screen";

// The walking skeleton's one page. It renders whichever of the three viewer
// states came back — it does not decide them (ADR-0002 §2).
export default async function Home() {
  const viewer = await getViewer();
  // The parent route boundary redirects anonymous and unlinked viewers before
  // this page runs. Keeping this guard makes that contract explicit to TS.
  if (viewer.state !== "linked") return null;

  return <HomeScreen viewer={viewer} />;
}
