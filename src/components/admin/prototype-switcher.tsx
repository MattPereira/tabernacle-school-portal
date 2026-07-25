"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

const variants = [
  { key: "A", name: "Dashboard" },
  { key: "B", name: "Work inbox" },
  { key: "C", name: "Command center" },
] as const;

export function PrototypeSwitcher({ current }: { current: "A" | "B" | "C" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const index = variants.findIndex((variant) => variant.key === current);

  function select(offset: number) {
    const next = variants[(index + offset + variants.length) % variants.length];
    const params = new URLSearchParams(searchParams);
    params.set("variant", next.key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") select(-1);
      if (event.key === "ArrowRight") select(1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-foreground p-1.5 text-background shadow-lg">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Previous prototype"
        onClick={() => select(-1)}
        className="hover:bg-background/15 hover:text-background"
      >
        <ArrowLeftIcon />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium">
        {current} — {variants[index].name}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Next prototype"
        onClick={() => select(1)}
        className="hover:bg-background/15 hover:text-background"
      >
        <ArrowRightIcon />
      </Button>
    </div>
  );
}
