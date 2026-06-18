import "dotenv/config";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

  // Verifica se a tabela já existe (0012 pode já ter sido aplicado via SQL direto)
  const { rows: check } = await pool.query(`
    SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name = 'destaque_base'
  `);

  if (Number(check[0].n) > 0) {
    console.log("Tabela destaque_base já existe — pulando 0013.");
  } else {
    console.log("Criando tabela destaque_base (0013)...");
    const sql0013 = readFileSync(join("drizzle", "0013_destaque_base.sql"), "utf8");
    await pool.query(sql0013);
    console.log("0013 aplicado.");
  }

  // Verifica policies atuais
  const { rows: policies } = await pool.query(`
    SELECT policyname FROM pg_policies WHERE tablename = 'destaque_base'
  `);
  const policyNames = policies.map((p: { policyname: string }) => p.policyname);

  if (policyNames.includes("destaque_base_dev_master") && !policyNames.includes("destaque_base_leitura")) {
    console.log("Corrigindo RLS (0014)...");
    const sql0014 = readFileSync(join("drizzle", "0014_fix_destaque_base_rls.sql"), "utf8");
    await pool.query(sql0014);
    console.log("0014 aplicado.");
  } else {
    console.log("RLS já corrigido — pulando 0014.");
  }

  // Aplica GRANT (idempotente)
  console.log("Garantindo GRANT (0015)...");
  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON destaque_base TO central_app`);
  console.log("0015 aplicado.");

  // Registra no journal do banco (evita re-aplicação futura)
  await pool.query(`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES
      ('0013_destaque_base', extract(epoch from now()) * 1000),
      ('0014_fix_destaque_base_rls', extract(epoch from now()) * 1000 + 1),
      ('0015_destaque_base_grant', extract(epoch from now()) * 1000 + 2)
    ON CONFLICT DO NOTHING
  `);

  // Confirma
  const { rows: resultado } = await pool.query(`
    SELECT
      has_table_privilege('central_app', 'destaque_base', 'SELECT') AS can_select,
      (SELECT string_agg(policyname, ', ') FROM pg_policies WHERE tablename = 'destaque_base') AS policies
  `);
  console.log("Estado final:", resultado[0]);

  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
