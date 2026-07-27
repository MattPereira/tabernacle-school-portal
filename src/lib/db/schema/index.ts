// Single schema entry point for the db client and drizzle-kit.
// Split by ownership: FACTS snapshot = read-only copy, portal = portal truth,
// auth = better-auth's own tables (library-owned; see auth.ts).
export * from "./auth";
export * from "./facts";
export * from "./portal";
