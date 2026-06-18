import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

  // Quais migrations estão no journal?
  const journal = await pool.query(
    `SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10`
  );
  console.log("Journal (últimas 10):", journal.rows);

  // A tabela existe?
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'destaque%' OR table_name LIKE 'evento%'`
  );
  console.log("Tabelas relevantes:", tables.rows);

  await pool.end();
}

main().catch(console.error);
