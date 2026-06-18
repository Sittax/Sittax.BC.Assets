import { and, asc, eq, isNull } from "drizzle-orm";
import { withUser, type Papel, type Tx } from "@/lib/db/rls";
import { modulo, topico } from "@/lib/db/schema";

export interface TopicoItem {
  id: string;
  titulo: string;
  slug: string;
  parentId: string | null;
  ordem: number;
  filhos?: TopicoItem[];
}

export interface ModuloComTopicos {
  id: string;
  nome: string;
  ordem: number;
  topicos: TopicoItem[];
}

export interface TopicoCompleto {
  id: string;
  titulo: string;
  slug: string;
  conteudoMd: string;
  moduloId: string;
  produtoId: string;
  parentId: string | null;
  ordem: number;
}

export interface Trilha {
  titulo: string;
  slug: string;
}

/** Monta a árvore de tópicos a partir de uma lista plana. */
function construirArvore(lista: TopicoItem[], parentId: string | null): TopicoItem[] {
  return lista
    .filter((t) => t.parentId === parentId)
    .sort((a, b) => a.ordem - b.ordem)
    .map((t) => ({ ...t, filhos: construirArvore(lista, t.id) }));
}

/** Árvore completa do produto (módulos → tópicos aninhados). */
export async function buscarArvore(
  userId: string,
  papel: Papel,
  produtoId: string,
): Promise<ModuloComTopicos[]> {
  return withUser(userId, papel, async (tx) => {
    const modulos = await tx
      .select()
      .from(modulo)
      .where(eq(modulo.produtoId, produtoId))
      .orderBy(asc(modulo.ordem));

    const topicos = await tx
      .select({
        id: topico.id,
        titulo: topico.titulo,
        slug: topico.slug,
        parentId: topico.parentId,
        ordem: topico.ordem,
        moduloId: topico.moduloId,
      })
      .from(topico)
      .where(eq(topico.produtoId, produtoId))
      .orderBy(asc(topico.ordem));

    return modulos.map((m) => ({
      id: m.id,
      nome: m.nome,
      ordem: m.ordem,
      topicos: construirArvore(
        topicos.filter((t) => t.moduloId === m.id),
        null,
      ),
    }));
  });
}

/** Tópico por slug, resolvendo o produto dono (R7). */
export async function buscarTopicoPorSlug(
  userId: string,
  papel: Papel,
  slug: string,
  produtoIdAtivo: string,
): Promise<{ topico: TopicoCompleto; produtoId: string } | null> {
  return withUser(userId, papel, async (tx) => {
    // Tenta no produto ativo primeiro; se não achar, busca em qualquer produto
    let rows = await tx
      .select()
      .from(topico)
      .where(and(eq(topico.slug, slug), eq(topico.produtoId, produtoIdAtivo)));

    if (rows.length === 0) {
      rows = await tx
        .select()
        .from(topico)
        .where(eq(topico.slug, slug));
    }

    if (rows.length === 0) return null;
    const t = rows[0];
    return {
      topico: {
        id: t.id,
        titulo: t.titulo,
        slug: t.slug,
        conteudoMd: t.conteudoMd,
        moduloId: t.moduloId,
        produtoId: t.produtoId,
        parentId: t.parentId,
        ordem: t.ordem,
      },
      produtoId: t.produtoId,
    };
  });
}

/** Irmãos anterior e próximo na ordem (filhos do mesmo parent ou raiz do módulo). */
export async function buscarAnteriorProximo(
  userId: string,
  papel: Papel,
  topicoAtual: { id: string; parentId: string | null; moduloId: string; ordem: number },
): Promise<{ anterior: { slug: string; titulo: string } | null; proximo: { slug: string; titulo: string } | null }> {
  return withUser(userId, papel, async (tx) => {
    const irmaos = await tx
      .select({ id: topico.id, titulo: topico.titulo, slug: topico.slug, ordem: topico.ordem })
      .from(topico)
      .where(
        and(
          eq(topico.moduloId, topicoAtual.moduloId),
          topicoAtual.parentId
            ? eq(topico.parentId, topicoAtual.parentId)
            : isNull(topico.parentId),
        ),
      )
      .orderBy(asc(topico.ordem));

    const idx = irmaos.findIndex((t) => t.id === topicoAtual.id);
    return {
      anterior: idx > 0 ? { slug: irmaos[idx - 1].slug, titulo: irmaos[idx - 1].titulo } : null,
      proximo: idx < irmaos.length - 1 ? { slug: irmaos[idx + 1].slug, titulo: irmaos[idx + 1].titulo } : null,
    };
  });
}

/** Trilha do breadcrumb: Módulo → Tópico (ancestrais). */
export async function buscarTrilha(
  userId: string,
  papel: Papel,
  topicoId: string,
): Promise<Trilha[]> {
  return withUser(userId, papel, async (tx) => {
    const trilha: Trilha[] = [];
    let id: string | null = topicoId;
    while (id !== null) {
      const rows = await tx
        .select({ titulo: topico.titulo, slug: topico.slug, parentId: topico.parentId })
        .from(topico)
        .where(eq(topico.id, id));
      if (rows.length === 0) break;
      trilha.unshift({ titulo: rows[0].titulo, slug: rows[0].slug });
      id = rows[0].parentId;
    }
    return trilha;
  });
}

/** Primeiro tópico do produto (pela ordem do módulo + tópico). */
export async function buscarPrimeiroTopico(
  tx: Tx,
  produtoId: string,
): Promise<{ slug: string } | null> {
  const modulos = await tx
    .select({ id: modulo.id })
    .from(modulo)
    .where(eq(modulo.produtoId, produtoId))
    .orderBy(asc(modulo.ordem));

  for (const m of modulos) {
    const topicos = await tx
      .select({ slug: topico.slug })
      .from(topico)
      .where(and(eq(topico.moduloId, m.id), isNull(topico.parentId)))
      .orderBy(asc(topico.ordem));
    if (topicos.length > 0) return { slug: topicos[0].slug };
  }
  return null;
}
