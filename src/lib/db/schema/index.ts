// Single schema entry point for the db client and drizzle-kit.
// Split by ownership: mirror = read-only FACTS copy, portal = portal truth.
export * from "./mirror";
export * from "./portal";
