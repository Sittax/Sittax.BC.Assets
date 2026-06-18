"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { acessoLog, usuario } from "@/lib/db/schema";

/**
 * Troca do produto selecionado (seletor "grudento", R7): persiste no próprio
 * usuário (RLS: própria linha) e grava acesso_log COM produto (R10). A
 * seleção automática inicial não passa por aqui — só troca real registra.
 */
export async function selecionarProduto(produtoId: string): Promise<void> {
  const sessao = await getSession();
  if (!sessao) throw new Error("não autenticado");

  const id = z.string().uuid().parse(produtoId);

  await withUser(sessao.userId, sessao.papel, async (tx) => {
    await tx
      .update(usuario)
      .set({ produtoSelecionadoId: id })
      .where(eq(usuario.id, sessao.userId));
    await tx.insert(acessoLog).values({
      usuarioId: sessao.userId,
      produtoId: id,
    });
  });

  revalidatePath("/", "layout");
}
