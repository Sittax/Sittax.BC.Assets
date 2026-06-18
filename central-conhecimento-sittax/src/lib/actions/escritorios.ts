"use server";

import { asc, eq, ilike, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validarCnpj } from "@/lib/cnpj";
import { withUser } from "@/lib/db/rls";
import {
  escritorio,
  escritorioProduto,
  produto,
  usuario,
} from "@/lib/db/schema";
import { exigirMaster, type ActionResult } from "./gate";

export interface EscritorioListado {
  id: string;
  cnpj: string;
  nome: string;
  produtoIds: string[];
  totalUsuarios: number;
}

export async function listarEscritorios(busca?: string): Promise<EscritorioListado[]> {
  const sessao = await exigirMaster();
  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const escritorios = await tx
      .select()
      .from(escritorio)
      .where(busca ? ilike(escritorio.nome, `%${busca}%`) : undefined)
      .orderBy(asc(escritorio.nome));
    const vinculos = await tx.select().from(escritorioProduto);
    const contagens = await tx
      .select({
        escritorioId: usuario.escritorioId,
        total: sql<number>`count(*)::int`,
      })
      .from(usuario)
      .groupBy(usuario.escritorioId);

    return escritorios.map((e) => ({
      id: e.id,
      cnpj: e.cnpj,
      nome: e.nome,
      produtoIds: vinculos
        .filter((v) => v.escritorioId === e.id)
        .map((v) => v.produtoId),
      totalUsuarios:
        contagens.find((c) => c.escritorioId === e.id)?.total ?? 0,
    }));
  });
}

export async function listarProdutosCatalogo() {
  const sessao = await exigirMaster();
  return withUser(sessao.userId, sessao.papel, (tx) =>
    tx.select().from(produto).orderBy(asc(produto.ordem)),
  );
}

const criarSchema = z.object({
  cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(validarCnpj, "CNPJ inválido — confira os 14 dígitos"),
  nome: z.string().trim().min(1, "informe o nome do escritório"),
});

export async function criarEscritorio(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const parsed = criarSchema.safeParse({
    cnpj: formData.get("cnpj") ?? "",
    nome: formData.get("nome") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, mensagem: parsed.error.issues[0].message };
  }
  try {
    await withUser(sessao.userId, sessao.papel, (tx) =>
      tx.insert(escritorio).values(parsed.data),
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, mensagem: "Já existe um escritório com este CNPJ." };
    }
    throw err;
  }
  revalidatePath("/gerencia/escritorios");
  return { ok: true, mensagem: "Escritório criado." };
}

export async function editarEscritorio(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const parsed = z
    .object({
      id: z.string().uuid(),
      // CNPJ imutável pela UI nesta fase (chave de espelhamento)
      nome: z.string().trim().min(1, "informe o nome do escritório"),
    })
    .safeParse({ id: formData.get("id"), nome: formData.get("nome") ?? "" });
  if (!parsed.success) {
    return { ok: false, mensagem: parsed.error.issues[0].message };
  }
  await withUser(sessao.userId, sessao.papel, (tx) =>
    tx
      .update(escritorio)
      .set({ nome: parsed.data.nome })
      .where(eq(escritorio.id, parsed.data.id)),
  );
  revalidatePath("/gerencia/escritorios");
  return { ok: true, mensagem: "Escritório atualizado." };
}

export async function excluirEscritorio(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, mensagem: "Escritório inválido." };
  try {
    await withUser(sessao.userId, sessao.papel, (tx) =>
      tx.delete(escritorio).where(eq(escritorio.id, id.data)),
    );
  } catch (err) {
    // FK RESTRICT em usuario.escritorio_id (FR-026)
    if ((err as { code?: string }).code === "23503") {
      return {
        ok: false,
        mensagem:
          "Este escritório tem usuários vinculados. Desative ou migre os usuários antes de excluir.",
      };
    }
    throw err;
  }
  revalidatePath("/gerencia/escritorios");
  return { ok: true, mensagem: "Escritório excluído." };
}

export async function alternarProduto(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const parsed = z
    .object({
      escritorioId: z.string().uuid(),
      produtoId: z.string().uuid(),
      vincular: z.enum(["sim", "nao"]),
    })
    .safeParse({
      escritorioId: formData.get("escritorioId"),
      produtoId: formData.get("produtoId"),
      vincular: formData.get("vincular"),
    });
  if (!parsed.success) return { ok: false, mensagem: "Dados inválidos." };

  const { escritorioId, produtoId, vincular } = parsed.data;
  await withUser(sessao.userId, sessao.papel, async (tx) => {
    if (vincular === "sim") {
      await tx
        .insert(escritorioProduto)
        .values({ escritorioId, produtoId })
        .onConflictDoNothing();
    } else {
      await tx
        .delete(escritorioProduto)
        .where(
          sql`${escritorioProduto.escritorioId} = ${escritorioId} AND ${escritorioProduto.produtoId} = ${produtoId}`,
        );
    }
  });
  revalidatePath("/gerencia/escritorios");
  return { ok: true };
}
