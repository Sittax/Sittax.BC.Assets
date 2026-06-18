"use server";

import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { aula, eadModulo, eadModuloProduto } from "@/lib/db/schema";
import { youtubeIdSchema } from "@/lib/ead/youtube";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; mensagem: string };

const DEV_MAIS = ["dev", "master"] as const;

function gateDevMais(papel: string): boolean {
  return (DEV_MAIS as readonly string[]).includes(papel);
}

// ─── Módulos ──────────────────────────────────────────────────────────────────

const criarModuloSchema = z.object({
  produtoId: z.string().uuid(),
  nome: z.string().min(1).max(200),
});

export async function criarModuloEad(
  input: z.infer<typeof criarModuloSchema>,
): Promise<ActionResult<{ id: string }>> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!gateDevMais(sessao.papel)) return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = criarModuloSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const existentes = await tx
      .select({ ordem: eadModulo.ordem })
      .from(eadModulo)
      .where(eq(eadModulo.produtoId, parsed.data.produtoId));
    const maxOrdem = existentes.reduce((max, m) => Math.max(max, m.ordem), 0);

    const [novo] = await tx
      .insert(eadModulo)
      .values({ ...parsed.data, ordem: maxOrdem + 1 })
      .returning();

    return { ok: true, data: { id: novo.id } };
  });
}

const atualizarModuloSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).max(200).optional(),
  capaUrl: z.string().min(1).nullable().optional(),
  descricaoMd: z.string().optional(),
  produtosVinculados: z.array(z.string().uuid()).optional(),
  produtoPrincipalNovo: z.string().uuid().optional(),
});

export async function atualizarModuloEad(
  input: z.infer<typeof atualizarModuloSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!gateDevMais(sessao.papel)) return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = atualizarModuloSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: parsed.error.issues[0]?.message ?? "Entrada inválida." };

  const { id, nome, capaUrl, descricaoMd, produtosVinculados, produtoPrincipalNovo } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (nome !== undefined) updates.nome = nome;
  if (capaUrl !== undefined) updates.capaUrl = capaUrl;
  if (descricaoMd !== undefined) updates.descricaoMd = descricaoMd;
  if (produtoPrincipalNovo !== undefined) updates.produtoId = produtoPrincipalNovo;

  if (Object.keys(updates).length === 0 && produtosVinculados === undefined) {
    return { ok: true };
  }

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    if (Object.keys(updates).length > 0) {
      await tx.update(eadModulo).set(updates).where(eq(eadModulo.id, id));
    }

    if (produtosVinculados !== undefined || produtoPrincipalNovo !== undefined) {
      // Descobre o principal atual (após possível troca acima)
      const [mod] = await tx
        .select({ produtoId: eadModulo.produtoId })
        .from(eadModulo)
        .where(eq(eadModulo.id, id));
      const principal = mod?.produtoId ?? null;
      const extras = [...new Set(produtosVinculados ?? [])].filter(
        (pid) => pid !== principal,
      );

      await tx
        .delete(eadModuloProduto)
        .where(eq(eadModuloProduto.eadModuloId, id));
      if (extras.length > 0) {
        await tx
          .insert(eadModuloProduto)
          .values(extras.map((pid) => ({ eadModuloId: id, produtoId: pid })));
      }
    }

    return { ok: true };
  });
}

const renomearModuloSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).max(200),
});

export async function renomearModuloEad(
  input: z.infer<typeof renomearModuloSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!gateDevMais(sessao.papel)) return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = renomearModuloSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    await tx
      .update(eadModulo)
      .set({ nome: parsed.data.nome })
      .where(eq(eadModulo.id, parsed.data.id));
    return { ok: true };
  });
}

const reordenarModulosSchema = z.object({
  produtoId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1),
});

export async function reordenarModulosEad(
  input: z.infer<typeof reordenarModulosSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!gateDevMais(sessao.papel)) return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = reordenarModulosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    for (let i = 0; i < parsed.data.ids.length; i++) {
      await tx
        .update(eadModulo)
        .set({ ordem: i + 1 })
        .where(
          and(
            eq(eadModulo.id, parsed.data.ids[i]),
            eq(eadModulo.produtoId, parsed.data.produtoId),
          ),
        );
    }
    return { ok: true };
  });
}

const excluirModuloSchema = z.object({ id: z.string().uuid() });

export async function excluirModuloEad(
  input: z.infer<typeof excluirModuloSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!gateDevMais(sessao.papel)) return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = excluirModuloSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const [totalAulas] = await tx
      .select({ total: count() })
      .from(aula)
      .where(eq(aula.eadModuloId, parsed.data.id));

    if ((totalAulas?.total ?? 0) > 0) {
      return {
        ok: false,
        mensagem:
          "Este módulo contém aulas e não pode ser excluído. Mova ou exclua todas as aulas antes.",
      };
    }

    await tx.delete(eadModulo).where(eq(eadModulo.id, parsed.data.id));
    return { ok: true };
  });
}

// ─── Aulas ────────────────────────────────────────────────────────────────────

const criarAulaSchema = z.object({
  eadModuloId: z.string().uuid(),
  titulo: z.string().min(1).max(300),
  youtube: youtubeIdSchema,
  descricaoMd: z.string().optional(),
});

export async function criarAula(
  input: z.infer<typeof criarAulaSchema>,
): Promise<ActionResult<{ id: string; youtubeId: string }>> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!gateDevMais(sessao.papel)) return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = criarAulaSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, mensagem: parsed.error.issues[0]?.message ?? "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const existentes = await tx
      .select({ ordem: aula.ordem })
      .from(aula)
      .where(eq(aula.eadModuloId, parsed.data.eadModuloId));
    const maxOrdem = existentes.reduce((max, a) => Math.max(max, a.ordem), 0);

    const [nova] = await tx
      .insert(aula)
      .values({
        eadModuloId: parsed.data.eadModuloId,
        titulo: parsed.data.titulo,
        youtubeId: parsed.data.youtube,
        descricaoMd: parsed.data.descricaoMd ?? "",
        ordem: maxOrdem + 1,
      })
      .returning();

    return { ok: true, data: { id: nova.id, youtubeId: nova.youtubeId } };
  });
}

const editarAulaSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(1).max(300).optional(),
  youtube: youtubeIdSchema.optional(),
  descricaoMd: z.string().optional(),
});

export async function editarAula(
  input: z.infer<typeof editarAulaSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!gateDevMais(sessao.papel)) return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = editarAulaSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, mensagem: parsed.error.issues[0]?.message ?? "Entrada inválida." };

  const { id, titulo, youtube, descricaoMd } = parsed.data;
  const updates: Partial<typeof aula.$inferInsert> = {};
  if (titulo !== undefined) updates.titulo = titulo;
  if (youtube !== undefined) updates.youtubeId = youtube;
  if (descricaoMd !== undefined) updates.descricaoMd = descricaoMd;

  if (Object.keys(updates).length === 0) return { ok: true };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    await tx.update(aula).set(updates).where(eq(aula.id, id));
    return { ok: true };
  });
}

const reordenarAulasSchema = z.object({
  eadModuloId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1),
});

export async function reordenarAulas(
  input: z.infer<typeof reordenarAulasSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!gateDevMais(sessao.papel)) return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = reordenarAulasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    for (let i = 0; i < parsed.data.ids.length; i++) {
      await tx
        .update(aula)
        .set({ ordem: i + 1 })
        .where(
          and(
            eq(aula.id, parsed.data.ids[i]),
            eq(aula.eadModuloId, parsed.data.eadModuloId),
          ),
        );
    }
    return { ok: true };
  });
}

const excluirAulaSchema = z.object({ id: z.string().uuid() });

/** Exclui a aula — progresso em cascata (ON DELETE CASCADE em progresso_aula). */
export async function excluirAula(
  input: z.infer<typeof excluirAulaSchema>,
): Promise<ActionResult> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };
  if (!gateDevMais(sessao.papel)) return { ok: false, mensagem: "Permissão insuficiente." };

  const parsed = excluirAulaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    await tx.delete(aula).where(eq(aula.id, parsed.data.id));
    return { ok: true };
  });
}
