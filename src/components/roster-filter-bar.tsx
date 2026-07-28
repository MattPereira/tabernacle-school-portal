"use client";

import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type RosterFilterBarProps = {
  filterLabel: string;
  options: string[];
  selected: string | null;
  onSelectedChange: (selected: string | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchLabel: string;
};

// The two rosters both narrow an already-loaded population with one exclusive
// category and a name search. Their data shapes differ, but this interaction
// and its accessible labels do not.
export function RosterFilterBar({
  filterLabel,
  options,
  selected,
  onSelectedChange,
  query,
  onQueryChange,
  searchLabel,
}: RosterFilterBarProps) {
  const selectedIndex = selected === null ? -1 : options.indexOf(selected);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        aria-label={filterLabel}
        onValueChange={(values) => {
          const value = values[0];
          onSelectedChange(value === undefined || value === "all" ? null : options[Number(value)] ?? null);
        }}
        size="sm"
        value={[selectedIndex === -1 ? "all" : String(selectedIndex)]}
        variant="outline"
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        {options.map((option, index) => (
          <ToggleGroupItem key={option} value={String(index)}>
            {option}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="relative w-full sm:ms-auto sm:w-64">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label={`Search ${searchLabel} by name`}
          className="ps-9"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name"
          type="search"
          value={query}
        />
      </div>
    </div>
  );
}
