import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { getViewer } from "@/lib/auth/viewer";

// The walking skeleton's one page. It renders whichever of the three viewer
// states came back — it does not decide them (ADR-0002 §2).
export default async function Home() {
  const viewer = await getViewer();

  if (viewer.state === "anonymous") {
    return (
      <main>
        <h1>Tabernacle School Portal</h1>
        <SignInButton />
      </main>
    );
  }

  if (viewer.state === "unlinked") {
    return (
      <main>
        <h1>Hi {viewer.name}</h1>
        <p>Your account isn&apos;t set up for the portal yet. Please contact the school office.</p>
        <SignOutButton />
      </main>
    );
  }

  return (
    <main>
      <h1>Hi {viewer.name}</h1>
      <p>You&apos;re signed in as {viewer.role === "student" ? "a student" : "staff"}.</p>
      <SignOutButton />
    </main>
  );
}
