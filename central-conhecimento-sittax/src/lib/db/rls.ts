import { sql } from "drizzle-orm";
import { getDb, type Db } from "./client";

/** Papéis de sessão (enum `papel` do banco). */
export type Papel = "padrao" | "suporte" | "dev" | "master";

/** Transação tipada do drizzle com o schema da central. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Helper ÚNICO de acesso ao banco (Constituição II): abre transação, seta o
 * contexto RLS com set_config(..., true) — morre com a transação, seguro com
 * pool — e executa `fn`. Nenhuma query pode existir fora deste módulo.
 */
export async function withUser<T>(
  userId: string,
  papel: Papel,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.user_id', ${userId}, true),
                 set_config('app.papel', ${papel}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Contexto `system` — uso RESTRITO a login/espelhamento (antes de existir
 * sessão) e seed (research R5). Não usar em telas ou actions de usuário.
 */
export async function withSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.papel', 'system', true)`);
    return fn(tx);
  });
}
