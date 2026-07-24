import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/components/ui/utils";

// The one thing every screen shares: a centred column, a heading, an optional
// way back, and the theme toggle. Deliberately not navigation — there is no nav
// concept in this app yet, and this shell is not the place to invent one.
export function PageShell({
  title,
  back,
  className,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  className?: string;
  children?: ReactNode;
}) {
  return (
    <main className={cn("mx-auto w-full max-w-3xl px-4 py-10 sm:px-6", className)}>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-1">
          {back && (
            <Link
              href={back.href}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← {back.label}
            </Link>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        </div>
        <ThemeToggle />
      </header>
      {children}
    </main>
  );
}
