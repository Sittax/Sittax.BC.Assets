"use server";

import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withUser } from "@/lib/db/rls";
import { acessoLog, produto, usuario } from "@/lib/db/schema";
import { exigirMaster } from "./gate";

export interface AcessoListado {
  id: string;
  usuarioNome: string;
  usuarioEmail: string;
  produtoNome: string | null;
  data: Date;
}

const POR_PAGINA = 50;

/**
 * Inspeção bruta do registro de acesso (US4): lista paginada, sem filtros
 * analíticos — nenhuma lógica é construída sobre os dados nesta fase.
 */
export async function listarAcessos(pagina: number): Promise<{
  acessos: AcessoListado[];
  total: number;
  porPagina: number;
}> {
  const sessao = await exigirMaster();
  const p = z.number().int().min(1).catch(1).parse(pagina);

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(acessoLog);
    const acessos = await tx
      .select({
        id: acessoLog.id,
        usuarioNome: usuario.nome,
        usuarioEmail: usuario.email,
        produtoNome: produto.nome,
        data: acessoLog.data,
      })
      .from(acessoLog)
      .innerJoin(usuario, eq(acessoLog.usuarioId, usuario.id))
      .leftJoin(produto, eq(acessoLog.produtoId, produto.id))
      .orderBy(desc(acessoLog.data))
      .limit(POR_PAGINA)
      .offset((p - 1) * POR_PAGINA);
    return { acessos, total, porPagina: POR_PAGINA };
  });
}
