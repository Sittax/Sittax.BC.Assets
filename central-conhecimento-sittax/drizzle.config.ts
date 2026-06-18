import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrações rodam como owner do schema, nunca como central_app
    url: process.env.DATABASE_ADMIN_URL ?? "",
  },
});
