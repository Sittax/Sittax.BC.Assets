"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { releaseNote } from "@/lib/db/schema";
import {
  derivarConteudoPublico,
  notaAtualizarSchema,
  notaCriarSchema,
  papelPodeEscreverNota,
} from "@/lib/notas/validacao";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; mensagem: string };

// FR-012/R5: NÃO existe excluirNota — a operação não existe no negócio e a
// RLS tampouco tem policy/GRANT de DELETE.

export async function criarNota(input: {
  produtoId: string;
  data: string;
  versao?: string;
  conteudoMd: string;
}): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!papelPodeEscreverNota(sessao.papel))
    return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = notaCriarSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      mensagem: parsed.error.issues[0]?.message ?? "Entrada inválida.",
    };

  const { produtoId, data, versao, conteudoMd } = parsed.data;

  const [nova] = await withUser(sessao.userId, sessao.papel, (tx) =>
    tx
      .insert(releaseNote)
      .values({
        produtoId,
        data,
        versao: versao || null,
        conteudoMd,
        // invariante R2: derivada recalculada em TODO save
        conteudoPublico: derivarConteudoPublico(conteudoMd),
        criadoPor: sessao.userId,
      })
      .returning(),
  );

  revalidatePath("/atualizacoes");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: nova.id } };
}

export async function atualizarNota(input: {
  id: string;
  data?: string;
  versao?: string | null;
  conteudoMd?: string;
}): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!papelPodeEscreverNota(sessao.papel))
    return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = notaAtualizarSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      mensagem: parsed.error.issues[0]?.message ?? "Entrada inválida.",
    };

  const { id, data, versao, conteudoMd } = parsed.data;

  const atualizadas = await withUser(sessao.userId, sessao.papel, (tx) =>
    tx
      .update(releaseNote)
      .set({
        ...(data !== undefined ? { data } : {}),
        ...(versao !== undefined ? { versao: versao || null } : {}),
        ...(conteudoMd !== undefined
          ? {
              conteudoMd,
              // invariante R2: derivada recalculada em TODO save
              conteudoPublico: derivarConteudoPublico(conteudoMd),
            }
          : {}),
        atualizadoPor: sessao.userId,
        atualizadoEm: new Date(),
      })
      .where(eq(releaseNote.id, id))
      .returning(),
  );

  if (atualizadas.length === 0)
    return { ok: false, mensagem: "Nota não encontrada." };

  revalidatePath("/atualizacoes");
  revalidatePath("/dashboard");
  return { ok: true };
}
