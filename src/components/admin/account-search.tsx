"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

export function AccountSearch({ query }: { query: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(query);

  useEffect(() => {
    if (value === query) return;

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const nextQuery = value.trim();

      if (nextQuery) params.set("q", nextQuery);
      else params.delete("q");

      params.delete("all");
      params.delete("edit");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams, value]);

  return (
    <Input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      aria-label="Search portal accounts"
      placeholder="Search account, name, id, or role…"
      className="max-w-md"
    />
  );
}
