import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "@/lib/config";
import * as schema from "./schema";

/**
 * Pool de conexões como `central_app` (role não-owner, sem BYPASSRLS),
 * criado de forma lazy (o `next build` importa módulos sem ambiente).
 * REGRA (Constituição II / research R5): este módulo só pode ser importado
 * por `rls.ts` — toda query roda dentro de withUser/withSystem.
 */

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    pool = new Pool({ connectionString: config.DATABASE_URL });
    db = drizzle(pool, { schema });
  }
  return db;
}

/** Encerra o pool (scripts e testes). */
export async function endPool(): Promise<void> {
  await pool?.end();
  pool = null;
  db = null;
}
