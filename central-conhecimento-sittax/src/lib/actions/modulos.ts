"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { modulo, topico } from "@/lib/db/schema";

type ActionResult = { ok: true } | { ok: false; mensagem: string };

const criarSchema = z.object({
  produtoId: z.string().uuid(),
  nome: z.string().min(1).max(200),
});

/** Cria um módulo (gate suporte+). */
export async function criarModulo(
  input: z.infer<typeof criarSchema>,
): Promise<ActionResult & { id?: string }> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel)) {
    return { ok: false, mensagem: "Permissão insuficiente." };
  }

  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const existentes = await tx
      .select({ ordem: modulo.ordem })
      .from(modulo)
      .where(eq(modulo.produtoId, parsed.data.produtoId));
    const maxOrdem = existentes.reduce((max, m) => Math.max(max, m.ordem), 0);

    const [novo] = await tx
      .insert(modulo)
      .values({ ...parsed.data, ordem: maxOrdem + 1 })
      .returning();
    return { ok: true, id: novo.id };
  });
}

const renomearSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).max(200),
});

/** Renomeia um módulo (gate suporte+). */
export async function renomearModulo(
  input: z.infer<typeof renomearSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel)) {
    return { ok: false, mensagem: "Permissão insuficiente." };
  }

  const parsed = renomearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    await tx
      .update(modulo)
      .set({ nome: parsed.data.nome })
      .where(eq(modulo.id, parsed.data.id));
    return { ok: true };
  });
}

const reordenarSchema = z.object({
  id: z.string().uuid(),
  novaOrdem: z.number().int().min(1),
});

/** Reordena um módulo (gate suporte+). */
export async function reordenarModulo(
  input: z.infer<typeof reordenarSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel)) {
    return { ok: false, mensagem: "Permissão insuficiente." };
  }

  const parsed = reordenarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    await tx
      .update(modulo)
      .set({ ordem: parsed.data.novaOrdem })
      .where(eq(modulo.id, parsed.data.id));
    return { ok: true };
  });
}

const reordenarBatchSchema = z.array(
  z.object({ id: z.string().uuid(), novaOrdem: z.number().int().min(1) }),
);

/** Reordena lote de módulos em uma transação (gate suporte+). */
export async function reordenarModulosBatch(
  ordens: z.infer<typeof reordenarBatchSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel))
    return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = reordenarBatchSchema.safeParse(ordens);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    for (const { id, novaOrdem } of parsed.data) {
      await tx.update(modulo).set({ ordem: novaOrdem }).where(eq(modulo.id, id));
    }
    return { ok: true };
  });
}

const excluirSchema = z.object({ id: z.string().uuid() });

/** Exclui um módulo (gate suporte+, só vazio — FR-018). */
export async function excluirModulo(
  input: z.infer<typeof excluirSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel)) {
    return { ok: false, mensagem: "Permissão insuficiente." };
  }

  const parsed = excluirSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const filhos = await tx
      .select({ id: topico.id })
      .from(topico)
      .where(eq(topico.moduloId, parsed.data.id));

    if (filhos.length > 0) {
      return {
        ok: false,
        mensagem:
          "Este módulo contém tópicos e não pode ser excluído. " +
          "Mova ou exclua todos os tópicos do módulo antes de excluí-lo.",
      };
    }

    await tx.delete(modulo).where(eq(modulo.id, parsed.data.id));
    return { ok: true };
  });
}
