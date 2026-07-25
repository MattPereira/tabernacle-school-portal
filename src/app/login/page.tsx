import { redirect } from "next/navigation";

import { signIn } from "@/app/actions";
import { LoginScreen } from "@/components/login-screen";
import { canonicalDestination } from "@/lib/auth/destination";
import { getViewer } from "@/lib/auth/viewer";

export default async function LoginPage() {
  const viewer = await getViewer();

  const destination = canonicalDestination(viewer);
  if (destination !== "/login") redirect(destination);

  return <LoginScreen signIn={signIn} />;
}
