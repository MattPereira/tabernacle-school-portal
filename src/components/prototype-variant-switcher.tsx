"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

// PROTOTYPE ONLY — shared by throwaway variant routes. It is gated here so a
// stray prototype route cannot expose its evaluation controls in production.
export function PrototypeVariantSwitcher({
  label,
  onCycle,
}: {
  label: string;
  onCycle: (direction: -1 | 1) => void;
}) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full border bg-background p-1 shadow-lg">
        <Button aria-label="Previous variant" onClick={() => onCycle(-1)} size="icon" variant="ghost">
          <ArrowLeft />
        </Button>
        <span className="min-w-40 text-center text-sm font-medium">{label}</span>
        <Button aria-label="Next variant" onClick={() => onCycle(1)} size="icon" variant="ghost">
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
