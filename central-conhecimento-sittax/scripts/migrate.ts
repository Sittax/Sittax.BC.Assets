import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Aplica as migrações de ./drizzle (schema + policies RLS) como owner do
 * schema (DATABASE_ADMIN_URL) — a aplicação conecta como central_app, que
 * não pode alterar schema.
 */
async function main() {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) {
    throw new Error(
      "DATABASE_ADMIN_URL é obrigatória para migrar (conexão de owner do schema — ver .env.example)",
    );
  }
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    await definirSenhaCentralApp(pool);
    console.log("Migrações aplicadas com sucesso.");
  } finally {
    await pool.end();
  }
}

/**
 * A migração de RLS cria a role central_app SEM senha (credencial nunca entra
 * em código versionado). A senha vem do DATABASE_URL do ambiente.
 */
async function definirSenhaCentralApp(pool: Pool) {
  const appUrl = process.env.DATABASE_URL;
  if (!appUrl) return;
  const parsed = new URL(appUrl);
  if (parsed.username !== "central_app" || !parsed.password) return;
  const senha = decodeURIComponent(parsed.password).replace(/'/g, "''");
  await pool.query(`ALTER ROLE central_app WITH LOGIN PASSWORD '${senha}'`);
  console.log("Senha da role central_app sincronizada com o DATABASE_URL.");
}

main().catch((err) => {
  console.error("Falha ao migrar:", err);
  process.exit(1);
});
