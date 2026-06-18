import { and, asc, eq, inArray, or } from "drizzle-orm";
import { withUser, type Papel, type Tx } from "@/lib/db/rls";
import {
  aula,
  aulaAnotacao,
  aulaMaterial,
  eadModulo,
  eadModuloProduto,
  escritorioProduto,
  inscricaoEad,
  produto,
  progressoAula,
} from "@/lib/db/schema";

export type AulaComVista = {
  id: string;
  titulo: string;
  youtubeId: string;
  descricaoMd: string;
  ordem: number;
  vista: boolean;
};

export type ModuloComAulas = {
  id: string;
  produtoId: string | null;
  nome: string;
  capaUrl: string | null;
  descricaoMd: string;
  ordem: number;
  aulas: AulaComVista[];
};

/** Retorna os módulos e aulas do produto ativo, ordenados, com flag de aula vista. */
export async function trilhaDoProduto(
  produtoId: string,
  userId: string,
  papel: Papel,
): Promise<ModuloComAulas[]> {
  return withUser(userId, papel, async (tx) => {
    return _trilhaDoProduto(tx, produtoId, userId);
  });
}

export async function _trilhaDoProduto(
  tx: Tx,
  produtoId: string,
  userId: string,
): Promise<ModuloComAulas[]> {
  // Inclui EADs cujo produto PRINCIPAL é este OU que estão VINCULADOS a ele
  // (tema multi-produto) — exceção declarada ao §4 do escopo.
  const vinculados = await tx
    .select({ id: eadModuloProduto.eadModuloId })
    .from(eadModuloProduto)
    .where(eq(eadModuloProduto.produtoId, produtoId));
  const vinculadosIds = vinculados.map((v) => v.id);

  const condProduto =
    vinculadosIds.length > 0
      ? or(eq(eadModulo.produtoId, produtoId), inArray(eadModulo.id, vinculadosIds))
      : eq(eadModulo.produtoId, produtoId);

  const modulos = await tx
    .select()
    .from(eadModulo)
    .where(and(condProduto, eq(eadModulo.interno, false)))
    .orderBy(asc(eadModulo.ordem));

  if (modulos.length === 0) return [];

  const moduloIds = modulos.map((m) => m.id);

  const [aulasRows, vistasRows] = await Promise.all([
    tx
      .select()
      .from(aula)
      .where(inArray(aula.eadModuloId, moduloIds))
      .orderBy(asc(aula.ordem)),
    tx
      .select({ aulaId: progressoAula.aulaId })
      .from(progressoAula)
      .where(eq(progressoAula.usuarioId, userId)),
  ]);

  const vistasSet = new Set(vistasRows.map((r) => r.aulaId));

  return modulos.map((m) => ({
    id: m.id,
    produtoId: m.produtoId,
    nome: m.nome,
    capaUrl: m.capaUrl,
    descricaoMd: m.descricaoMd,
    ordem: m.ordem,
    aulas: aulasRows
      .filter((a) => a.eadModuloId === m.id)
      .map((a) => ({
        id: a.id,
        titulo: a.titulo,
        youtubeId: a.youtubeId,
        descricaoMd: a.descricaoMd,
        ordem: a.ordem,
        vista: vistasSet.has(a.id),
      })),
  }));
}

/** Módulo com aulas + ids dos produtos vinculados (para a tela de edição). */
export type ModuloEditavel = ModuloComAulas & { produtosVinculados: string[] };

/** Retorna um único módulo com suas aulas, flag de vista e produtos vinculados. */
export async function moduloDoProduto(
  moduloId: string,
  userId: string,
  papel: Papel,
): Promise<ModuloEditavel | null> {
  return withUser(userId, papel, async (tx) => {
    const [modulo] = await tx
      .select()
      .from(eadModulo)
      .where(eq(eadModulo.id, moduloId));

    if (!modulo) return null;

    const [aulasRows, vistasRows, vinculadosRows] = await Promise.all([
      tx
        .select()
        .from(aula)
        .where(eq(aula.eadModuloId, moduloId))
        .orderBy(asc(aula.ordem)),
      tx
        .select({ aulaId: progressoAula.aulaId })
        .from(progressoAula)
        .where(eq(progressoAula.usuarioId, userId)),
      tx
        .select({ produtoId: eadModuloProduto.produtoId })
        .from(eadModuloProduto)
        .where(eq(eadModuloProduto.eadModuloId, moduloId)),
    ]);

    const vistasSet = new Set(vistasRows.map((r) => r.aulaId));

    return {
      id: modulo.id,
      produtoId: modulo.produtoId,
      nome: modulo.nome,
      capaUrl: modulo.capaUrl,
      descricaoMd: modulo.descricaoMd,
      ordem: modulo.ordem,
      produtosVinculados: vinculadosRows.map((r) => r.produtoId),
      aulas: aulasRows.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        youtubeId: a.youtubeId,
        descricaoMd: a.descricaoMd,
        ordem: a.ordem,
        vista: vistasSet.has(a.id),
      })),
    };
  });
}

/**
 * Curso de OUTRO produto contratado pelo escritório (Bloco 2 da tela de EAD).
 * EXCEÇÃO DECLARADA ao Princípio V (produto = dimensão suprema): cruza a
 * dimensão de produto de propósito, para favorecer aprendizado dos produtos
 * já contratados. Usa só produtos CONTRATADOS (dado existente) — sem lógica
 * de lead. Ver docs/escopo §4 e §6.2.
 */
export type CursoDeOutroProduto = {
  produtoId: string;
  produtoNome: string;
  modulo: ModuloComAulas;
  inscrito: boolean;
};

export async function cursosDeOutrosProdutos(
  produtoSelecionadoId: string,
  escritorioId: string | null,
  userId: string,
  papel: Papel,
): Promise<CursoDeOutroProduto[]> {
  if (!escritorioId) return [];
  return withUser(userId, papel, async (tx) => {
    // Produtos contratados (nome + ordem do catálogo), menos o selecionado
    const contratados = await tx
      .select({ id: produto.id, nome: produto.nome, ordem: produto.ordem })
      .from(escritorioProduto)
      .innerJoin(produto, eq(produto.id, escritorioProduto.produtoId))
      .where(eq(escritorioProduto.escritorioId, escritorioId))
      .orderBy(asc(produto.ordem));

    const outros = contratados.filter((p) => p.id !== produtoSelecionadoId);
    if (outros.length === 0) return [];

    // Inscrições do usuário (interno=false) para marcar "inscrito" nos cards
    const inscricoes = await tx
      .select({ eadModuloId: inscricaoEad.eadModuloId })
      .from(inscricaoEad)
      .where(
        and(
          eq(inscricaoEad.usuarioId, userId),
          eq(inscricaoEad.interno, false),
        ),
      );
    const inscritosSet = new Set(
      inscricoes.map((i) => i.eadModuloId).filter(Boolean) as string[],
    );

    const resultado: CursoDeOutroProduto[] = [];
    for (const prod of outros) {
      const modulos = await _trilhaDoProduto(tx, prod.id, userId);
      for (const m of modulos) {
        resultado.push({
          produtoId: prod.id,
          produtoNome: prod.nome,
          modulo: m,
          inscrito: inscritosSet.has(m.id),
        });
      }
    }
    return resultado;
  });
}

export type AulaMaterial = {
  id: string;
  nome: string;
  url: string;
  mime: string;
  tamanhoBytes: number | null;
  ordem: number;
};

export type AulaAnotacao = {
  id: string;
  conteudoMd: string;
  criadoEm: string; // ISO string (serializado para client component)
};

export type AulaContexto = {
  aula: AulaComVista;
  modulo: { id: string; nome: string; capaUrl: string | null };
  todasAulas: AulaComVista[];
  anterior: { id: string; titulo: string } | null;
  proxima: { id: string; titulo: string } | null;
  materiais: AulaMaterial[];
  anotacoes: AulaAnotacao[];
};

/**
 * Dados completos para o player de aula: a aula, o módulo, todas as aulas
 * com flag de vista, vizinhas para navegação, materiais e anotações do usuário.
 */
export async function aulaComContexto(
  aulaId: string,
  userId: string,
  papel: Papel,
): Promise<AulaContexto | null> {
  return withUser(userId, papel, async (tx) => {
    const [aulaRow] = await tx.select().from(aula).where(eq(aula.id, aulaId));
    if (!aulaRow) return null;

    const [modRow] = await tx
      .select({ id: eadModulo.id, nome: eadModulo.nome, capaUrl: eadModulo.capaUrl })
      .from(eadModulo)
      .where(eq(eadModulo.id, aulaRow.eadModuloId));
    if (!modRow) return null;

    const [aulasRows, vistasRows, materiaisRows, anotacoesRows] = await Promise.all([
      tx.select().from(aula).where(eq(aula.eadModuloId, aulaRow.eadModuloId)).orderBy(asc(aula.ordem)),
      tx.select({ aulaId: progressoAula.aulaId }).from(progressoAula).where(eq(progressoAula.usuarioId, userId)),
      tx.select().from(aulaMaterial).where(eq(aulaMaterial.aulaId, aulaId)).orderBy(asc(aulaMaterial.ordem)),
      tx.select().from(aulaAnotacao)
        .where(and(eq(aulaAnotacao.aulaId, aulaId), eq(aulaAnotacao.usuarioId, userId)))
        .orderBy(asc(aulaAnotacao.criadoEm)),
    ]);

    const vistasSet = new Set(vistasRows.map((r) => r.aulaId));
    const todasAulas: AulaComVista[] = aulasRows.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      youtubeId: a.youtubeId,
      descricaoMd: a.descricaoMd,
      ordem: a.ordem,
      vista: vistasSet.has(a.id),
    }));

    const idx = todasAulas.findIndex((a) => a.id === aulaId);
    const aulaAtual = todasAulas[idx];

    return {
      aula: aulaAtual ?? {
        id: aulaRow.id, titulo: aulaRow.titulo, youtubeId: aulaRow.youtubeId,
        descricaoMd: aulaRow.descricaoMd, ordem: aulaRow.ordem, vista: vistasSet.has(aulaId),
      },
      modulo: modRow,
      todasAulas,
      anterior: idx > 0 ? { id: todasAulas[idx - 1].id, titulo: todasAulas[idx - 1].titulo } : null,
      proxima: idx >= 0 && idx < todasAulas.length - 1 ? { id: todasAulas[idx + 1].id, titulo: todasAulas[idx + 1].titulo } : null,
      materiais: materiaisRows.map((m) => ({
        id: m.id, nome: m.nome, url: m.url, mime: m.mime, tamanhoBytes: m.tamanhoBytes, ordem: m.ordem,
      })),
      anotacoes: anotacoesRows.map((a) => ({
        id: a.id, conteudoMd: a.conteudoMd, criadoEm: a.criadoEm.toISOString(),
      })),
    };
  });
}

/** Retorna a aula anterior e próxima na trilha do produto. */
export async function aulaVizinhas(
  aulaId: string,
  userId: string,
  papel: Papel,
): Promise<{
  anterior: { id: string; titulo: string } | null;
  proxima: { id: string; titulo: string } | null;
}> {
  return withUser(userId, papel, async (tx) => {
    const [aulaAtual] = await tx
      .select({ eadModuloId: aula.eadModuloId })
      .from(aula)
      .where(eq(aula.id, aulaId));

    if (!aulaAtual) return { anterior: null, proxima: null };

    const [modAtual] = await tx
      .select({ produtoId: eadModulo.produtoId })
      .from(eadModulo)
      .where(eq(eadModulo.id, aulaAtual.eadModuloId));

    if (!modAtual?.produtoId) return { anterior: null, proxima: null };

    const trilha = await _trilhaDoProduto(tx, modAtual.produtoId, userId);
    const todasAulas = trilha.flatMap((m) => m.aulas);
    const idx = todasAulas.findIndex((a) => a.id === aulaId);

    return {
      anterior:
        idx > 0
          ? { id: todasAulas[idx - 1].id, titulo: todasAulas[idx - 1].titulo }
          : null,
      proxima:
        idx >= 0 && idx < todasAulas.length - 1
          ? { id: todasAulas[idx + 1].id, titulo: todasAulas[idx + 1].titulo }
          : null,
    };
  });
}
