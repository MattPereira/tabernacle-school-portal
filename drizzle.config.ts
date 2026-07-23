import { defineConfig } from "drizzle-kit";

// Schema lives under the src/ runtime barrier; migrations + this config are
// root ops artifacts, not runtime-imported (ADR-0002 §3).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
