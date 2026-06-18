"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { modulo, topico } from "@/lib/db/schema";
import { sanitizarMarkdown } from "@/lib/conteudo/sanitizar";
import { suporteAlterouNotasTecnicas } from "@/lib/conteudo/directives";
import { gerarSlugUnico } from "@/lib/conteudo/slug";
import { validarMovimentoTopico, temFilhos } from "@/lib/conteudo/arvore";

type ActionResult = { ok: true } | { ok: false; mensagem: string };

const salvarSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(1).optional(),
  conteudoMd: z.string(),
});

/** Salva o conteúdo de um tópico (gate suporte+). */
export async function salvarTopico(
  input: z.infer<typeof salvarSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel)) {
    return { ok: false, mensagem: "Permissão insuficiente." };
  }

  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };
  const { id, titulo, conteudoMd } = parsed.data;

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const rows = await tx.select().from(topico).where(eq(topico.id, id));
    if (rows.length === 0) return { ok: false, mensagem: "Tópico não encontrado." };
    const atual = rows[0];

    // Validação de directive por papel (research R2 / FR-017)
    if (sessao.papel === "suporte") {
      const alterou = suporteAlterouNotasTecnicas(atual.conteudoMd, conteudoMd);
      if (alterou) {
        return {
          ok: false,
          mensagem:
            "Suporte não pode criar, alterar ou excluir blocos :::nota-tecnica. " +
            "Solicite a um desenvolvedor que faça essa alteração.",
        };
      }
    }

    // Regenera conteudo_publico na MESMA transação (R3)
    const conteudoPublico = sanitizarMarkdown(conteudoMd, "padrao");

    // Reslug se título mudou
    let slug = atual.slug;
    if (titulo && titulo !== atual.titulo) {
      slug = await gerarSlugUnico(tx, atual.produtoId, titulo, id);
    }

    await tx
      .update(topico)
      .set({
        titulo: titulo ?? atual.titulo,
        slug,
        conteudoMd,
        conteudoPublico,
        atualizadoPor: sessao.userId,
        atualizadoEm: new Date(),
      })
      .where(eq(topico.id, id));

    return { ok: true };
  });
}

const criarSchema = z.object({
  moduloId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  titulo: z.string().min(1),
});

/** Cria um novo tópico (gate suporte+). */
export async function criarTopico(
  input: z.infer<typeof criarSchema>,
): Promise<ActionResult & { slug?: string }> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel)) {
    return { ok: false, mensagem: "Permissão insuficiente." };
  }

  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };
  const { moduloId, parentId, titulo } = parsed.data;

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const mods = await tx.select().from(modulo).where(eq(modulo.id, moduloId));
    if (mods.length === 0) return { ok: false, mensagem: "Módulo não encontrado." };
    const mod = mods[0];

    // Valida profundidade e ciclo
    const erroMovimento = await validarMovimentoTopico(tx, null, parentId ?? null);
    if (erroMovimento) return { ok: false, mensagem: erroMovimento };

    const slug = await gerarSlugUnico(tx, mod.produtoId, titulo);

    // Ordem: último entre irmãos
    const irmaos = await tx
      .select({ ordem: topico.ordem })
      .from(topico)
      .where(
        and(
          eq(topico.moduloId, moduloId),
          parentId ? eq(topico.parentId, parentId) : eq(topico.parentId, parentId as unknown as string),
        ),
      );
    const maxOrdem = irmaos.reduce((max, t) => Math.max(max, t.ordem), 0);

    const [novo] = await tx
      .insert(topico)
      .values({
        moduloId,
        produtoId: mod.produtoId,
        parentId: parentId ?? null,
        titulo,
        slug,
        conteudoMd: "",
        conteudoPublico: "",
        ordem: maxOrdem + 1,
        atualizadoPor: sessao.userId,
      })
      .returning();

    return { ok: true, slug: novo.slug };
  });
}

const moverSchema = z.object({
  id: z.string().uuid(),
  novoModuloId: z.string().uuid().optional(),
  novoParentId: z.string().uuid().nullable().optional(),
  novaOrdem: z.number().int().min(1),
});

/** Move um tópico na árvore (gate suporte+). */
export async function moverTopico(
  input: z.infer<typeof moverSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel)) {
    return { ok: false, mensagem: "Permissão insuficiente." };
  }

  const parsed = moverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };
  const { id, novoModuloId, novoParentId, novaOrdem } = parsed.data;

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const rows = await tx.select().from(topico).where(eq(topico.id, id));
    if (rows.length === 0) return { ok: false, mensagem: "Tópico não encontrado." };
    const atual = rows[0];

    const moduloAlvo = novoModuloId ?? atual.moduloId;

    // Verifica que o módulo alvo pertence ao mesmo produto (U1 / FR-016)
    if (novoModuloId && novoModuloId !== atual.moduloId) {
      const mods = await tx.select().from(modulo).where(eq(modulo.id, novoModuloId));
      if (mods.length === 0) return { ok: false, mensagem: "Módulo não encontrado." };
      if (mods[0].produtoId !== atual.produtoId) {
        return {
          ok: false,
          mensagem:
            "Não é possível mover tópicos entre produtos. " +
            "Para migrar conteúdo, exporte e reimporte o tópico no produto de destino.",
        };
      }
    }

    const parentAlvo = novoParentId !== undefined ? novoParentId : atual.parentId;

    const erro = await validarMovimentoTopico(tx, id, parentAlvo);
    if (erro) return { ok: false, mensagem: erro };

    await tx
      .update(topico)
      .set({
        moduloId: moduloAlvo,
        parentId: parentAlvo,
        ordem: novaOrdem,
        atualizadoEm: new Date(),
      })
      .where(eq(topico.id, id));

    return { ok: true };
  });
}

const renomearTopicoSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(1).max(500),
});

/** Renomeia um tópico sem alterar o conteúdo (gate suporte+). */
export async function renomearTopico(
  input: z.infer<typeof renomearTopicoSchema>,
): Promise<ActionResult & { slug?: string }> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel))
    return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = renomearTopicoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };
  const { id, titulo } = parsed.data;

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const rows = await tx.select().from(topico).where(eq(topico.id, id));
    if (rows.length === 0) return { ok: false, mensagem: "Tópico não encontrado." };
    const atual = rows[0];
    const slug = await gerarSlugUnico(tx, atual.produtoId, titulo, id);
    await tx
      .update(topico)
      .set({ titulo, slug, atualizadoEm: new Date() })
      .where(eq(topico.id, id));
    return { ok: true, slug };
  });
}

const reordenarSchema2 = z.array(z.object({
  id: z.string().uuid(),
  novaOrdem: z.number().int().min(1),
  novoModuloId: z.string().uuid().optional(),
}));

/** Reordena lote de tópicos em uma transação (gate suporte+). */
export async function reordenarTopicosModulo(
  ordens: z.infer<typeof reordenarSchema2>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!["suporte", "dev", "master"].includes(sessao.papel))
    return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = reordenarSchema2.safeParse(ordens);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    for (const { id, novaOrdem, novoModuloId } of parsed.data) {
      await tx
        .update(topico)
        .set({ ordem: novaOrdem, ...(novoModuloId ? { moduloId: novoModuloId } : {}) })
        .where(eq(topico.id, id));
    }
    return { ok: true };
  });
}

const excluirSchema = z.object({ id: z.string().uuid() });

/** Exclui um tópico (gate suporte+, só sem filhos). */
export async function excluirTopico(
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
    const temFilhosFlag = await temFilhos(tx, parsed.data.id);
    if (temFilhosFlag) {
      return {
        ok: false,
        mensagem:
          "Este tópico tem subtópicos. Exclua os subtópicos primeiro ou mova-os para outro local.",
      };
    }
    await tx.delete(topico).where(eq(topico.id, parsed.data.id));
    return { ok: true };
  });
}
