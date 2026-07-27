import type { Viewer } from "./viewer";

// The three viewer states each have one place they belong. Route files only
// compare their own path with this answer; the school access decision remains
// in resolveAccess/getViewer.
export function canonicalDestination({ state }: Pick<Viewer, "state">) {
  switch (state) {
    case "anonymous":
      return "/login";
    case "unmatched":
    case "student":
      return "/";
    case "staff":
      return "/";
  }
}
