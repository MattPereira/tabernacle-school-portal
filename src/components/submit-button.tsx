"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

// A shared form submit button that disables itself while its server action is
// running. The nearest parent form supplies the pending state.
export function SubmitButton({
  children,
  name,
  value,
  variant,
  size,
  className,
}: {
  children: ReactNode;
  name?: string;
  value?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      variant={variant}
      size={size}
      className={className}
    >
      {pending ? "Working…" : children}
    </Button>
  );
}
