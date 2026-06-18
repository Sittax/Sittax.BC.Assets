"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { aulaAnotacao } from "@/lib/db/schema";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; mensagem: string };

const criarSchema = z.object({
  aulaId: z.string().uuid(),
  conteudoMd: z.string().min(1, "Anotação não pode estar vazia.").max(4000),
});

export async function criarAnotacao(
  input: z.infer<typeof criarSchema>,
): Promise<ActionResult<{ id: string; criadoEm: string }>> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };

  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: parsed.error.issues[0]?.message ?? "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const [nova] = await tx
      .insert(aulaAnotacao)
      .values({
        aulaId: parsed.data.aulaId,
        usuarioId: sessao.userId,
        conteudoMd: parsed.data.conteudoMd,
      })
      .returning();

    return { ok: true, data: { id: nova.id, criadoEm: nova.criadoEm.toISOString() } };
  });
}

const editarSchema = z.object({
  id: z.string().uuid(),
  conteudoMd: z.string().min(1, "Anotação não pode estar vazia.").max(4000),
});

export async function editarAnotacao(
  input: z.infer<typeof editarSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };

  const parsed = editarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: parsed.error.issues[0]?.message ?? "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    await tx
      .update(aulaAnotacao)
      .set({ conteudoMd: parsed.data.conteudoMd, atualizadoEm: new Date() })
      .where(
        and(
          eq(aulaAnotacao.id, parsed.data.id),
          eq(aulaAnotacao.usuarioId, sessao.userId),
        ),
      );
    return { ok: true };
  });
}

export async function excluirAnotacao(id: string): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    await tx
      .delete(aulaAnotacao)
      .where(
        and(
          eq(aulaAnotacao.id, id),
          eq(aulaAnotacao.usuarioId, sessao.userId),
        ),
      );
    return { ok: true };
  });
}
