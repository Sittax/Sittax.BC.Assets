"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser } from "@/lib/db/rls";
import { papelMapeamento } from "@/lib/db/schema";
import { exigirMaster, type ActionResult } from "./gate";

export async function listarMapeamentos() {
  const sessao = await exigirMaster();
  return withUser(sessao.userId, sessao.papel, (tx) =>
    tx
      .select()
      .from(papelMapeamento)
      .orderBy(asc(papelMapeamento.roleOrigem), asc(papelMapeamento.nivelOrigem)),
  );
}

const entradaSchema = z.object({
  roleOrigem: z.string().trim().min(1, "informe a role de origem"),
  nivelOrigem: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(
      z
        .number()
        .int("nível deve ser um inteiro")
        .nullable(),
    ),
  // nunca master (FR-006: Master é exclusivamente local)
  papelCentral: z.enum(["padrao", "suporte", "dev"]),
});

export async function criarMapeamento(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const parsed = entradaSchema.safeParse({
    roleOrigem: formData.get("roleOrigem") ?? "",
    nivelOrigem: formData.get("nivelOrigem") ?? "",
    papelCentral: formData.get("papelCentral"),
  });
  if (!parsed.success) {
    return { ok: false, mensagem: parsed.error.issues[0].message };
  }
  try {
    await withUser(sessao.userId, sessao.papel, (tx) =>
      tx.insert(papelMapeamento).values(parsed.data),
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return {
        ok: false,
        mensagem: "Já existe uma entrada para esta combinação de role e nível.",
      };
    }
    throw err;
  }
  revalidatePath("/gerencia/mapeamento");
  return { ok: true, mensagem: "Entrada criada." };
}

export async function editarMapeamento(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const parsed = entradaSchema
    .extend({ id: z.string().uuid() })
    .safeParse({
      id: formData.get("id"),
      roleOrigem: formData.get("roleOrigem") ?? "",
      nivelOrigem: formData.get("nivelOrigem") ?? "",
      papelCentral: formData.get("papelCentral"),
    });
  if (!parsed.success) {
    return { ok: false, mensagem: parsed.error.issues[0].message };
  }
  try {
    await withUser(sessao.userId, sessao.papel, (tx) =>
      tx
        .update(papelMapeamento)
        .set({
          roleOrigem: parsed.data.roleOrigem,
          nivelOrigem: parsed.data.nivelOrigem,
          papelCentral: parsed.data.papelCentral,
        })
        .where(eq(papelMapeamento.id, parsed.data.id)),
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return {
        ok: false,
        mensagem: "Já existe uma entrada para esta combinação de role e nível.",
      };
    }
    throw err;
  }
  revalidatePath("/gerencia/mapeamento");
  return { ok: true, mensagem: "Entrada atualizada." };
}

export async function excluirMapeamento(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, mensagem: "Entrada inválida." };
  await withUser(sessao.userId, sessao.papel, (tx) =>
    tx.delete(papelMapeamento).where(eq(papelMapeamento.id, id.data)),
  );
  revalidatePath("/gerencia/mapeamento");
  return { ok: true, mensagem: "Entrada excluída." };
}
