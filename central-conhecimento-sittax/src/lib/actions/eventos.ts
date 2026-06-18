"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { evento } from "@/lib/db/schema";
import {
  eventoAtualizarSchema,
  eventoCriarSchema,
  papelPodeGerirEvento,
} from "@/lib/eventos/validacao";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; mensagem: string };

function revalidar() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/eventos");
}

export async function criarEvento(input: {
  titulo: string;
  descricao?: string;
  inicio: string;
  fim: string;
}): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!papelPodeGerirEvento(sessao.papel))
    return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = eventoCriarSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      mensagem: parsed.error.issues[0]?.message ?? "Entrada inválida.",
    };

  const { titulo, descricao, inicio, fim } = parsed.data;

  const [novo] = await withUser(sessao.userId, sessao.papel, (tx) =>
    tx
      .insert(evento)
      .values({
        titulo,
        descricao: descricao ?? "",
        inicio: new Date(inicio),
        fim: new Date(fim),
        criadoPor: sessao.userId,
      })
      .returning(),
  );

  revalidar();
  return { ok: true, data: { id: novo.id } };
}

export async function atualizarEvento(input: {
  id: string;
  titulo: string;
  descricao?: string;
  inicio: string;
  fim: string;
}): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!papelPodeGerirEvento(sessao.papel))
    return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = eventoAtualizarSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      mensagem: parsed.error.issues[0]?.message ?? "Entrada inválida.",
    };

  const { id, titulo, descricao, inicio, fim } = parsed.data;

  const atualizados = await withUser(sessao.userId, sessao.papel, (tx) =>
    tx
      .update(evento)
      .set({
        titulo,
        descricao: descricao ?? "",
        inicio: new Date(inicio),
        fim: new Date(fim),
      })
      .where(eq(evento.id, id))
      .returning(),
  );

  if (atualizados.length === 0)
    return { ok: false, mensagem: "Evento não encontrado." };

  revalidar();
  return { ok: true };
}

export async function excluirEvento(input: {
  id: string;
}): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!papelPodeGerirEvento(sessao.papel))
    return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  await withUser(sessao.userId, sessao.papel, (tx) =>
    tx.delete(evento).where(eq(evento.id, parsed.data.id)),
  );

  revalidar();
  return { ok: true };
}
