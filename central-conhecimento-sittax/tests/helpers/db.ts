import "dotenv/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../../src/lib/db/schema";

/**
 * Infra dos testes de regra crítica (R12): recria o database `central_test`
 * a partir das migrações reais e conecta como `central_app` (não-owner, sem
 * BYPASSRLS) — RLS só é testável de verdade contra Postgres.
 * Requer DATABASE_ADMIN_URL apontando para o Postgres do compose.
 */

const TEST_DB = "central_test";

// a senha vem do DATABASE_URL preparado em tests/setup-env.ts (reaproveita a
// do ambiente — a role é do cluster e não pode ser sobrescrita pelos testes)
function senhaApp(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    if (u.username === "central_app" && u.password) {
      return decodeURIComponent(u.password);
    }
  } catch {}
  return "central_test_pw";
}

export type TestDb = NodePgDatabase<typeof schema>;
export type TestTx = Parameters<Parameters<TestDb["transaction"]>[0]>[0];

function adminUrl(): URL {
  const raw = process.env.DATABASE_ADMIN_URL;
  if (!raw) {
    throw new Error(
      "Testes exigem DATABASE_ADMIN_URL (Postgres do docker compose) — ver quickstart.md",
    );
  }
  return new URL(raw);
}

function withDatabase(url: URL, database: string): string {
  const u = new URL(url.toString());
  u.pathname = `/${database}`;
  return u.toString();
}

/** Recria central_test, aplica migrações e devolve pools admin e app. */
export async function setupTestDatabase() {
  const admin = adminUrl();

  const adminPool = new Pool({ connectionString: admin.toString() });
  await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await adminPool.query(`CREATE DATABASE ${TEST_DB}`);
  await adminPool.end();

  const adminTestPool = new Pool({
    connectionString: withDatabase(admin, TEST_DB),
  });
  await migrate(drizzle(adminTestPool), { migrationsFolder: "./drizzle" });
  const senha = senhaApp();
  await adminTestPool.query(
    `ALTER ROLE central_app WITH LOGIN PASSWORD '${senha.replace(/'/g, "''")}'`,
  );

  const appUrl = new URL(withDatabase(admin, TEST_DB));
  appUrl.username = "central_app";
  appUrl.password = senha;
  const appPool = new Pool({ connectionString: appUrl.toString() });
  const appDb: TestDb = drizzle(appPool, { schema });

  return {
    /** conexão owner (PARA FIXTURES/INSPEÇÃO — não passa por RLS) */
    adminPool: adminTestPool,
    /** conexão da aplicação (central_app — sujeita a RLS) */
    appPool,
    appDb,
    async teardown() {
      await appPool.end();
      await adminTestPool.end();
    },
  };
}

/**
 * Matcher para `.rejects.toSatisfy(...)`: o drizzle embrulha o erro do
 * Postgres em DrizzleQueryError — o código fica em `cause.code`.
 */
export const comCodigoPg = (code: string) => (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return (err.cause?.code ?? err.code) === code;
};

/** Réplica do withUser de produção sobre o pool de teste. */
export async function asUser<T>(
  db: TestDb,
  userId: string,
  papel: string,
  fn: (tx: TestTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.user_id', ${userId}, true),
                 set_config('app.papel', ${papel}, true)`,
    );
    return fn(tx);
  });
}

/** Réplica do withSystem de produção sobre o pool de teste. */
export async function asSystem<T>(
  db: TestDb,
  fn: (tx: TestTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.papel', 'system', true)`);
    return fn(tx);
  });
}
