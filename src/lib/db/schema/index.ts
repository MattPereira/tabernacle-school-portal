// Single schema entry point for the db client and drizzle-kit.
// Split by ownership: mirror = read-only FACTS copy, portal = portal truth,
// auth = better-auth's own tables (library-owned; see auth.ts).
export * from "./auth";
export * from "./mirror";
export * from "./portal";
