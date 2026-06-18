import { and, asc, count, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import { withUser, withSystem, type Papel, type Tx } from "@/lib/db/rls";
import { aula, destaqueBase, eadModulo, evento, inscricaoEad, modulo, produto, topico } from "@/lib/db/schema";
import { _percentualNaTx } from "@/lib/ead/progresso";
import { _retomadaAulaNaTx } from "@/lib/ead/acesso";

/** Card do bloco "Continue de onde parou" (FR-002). */
export type CardContinuar = {
  moduloId: string;
  nome: string;
  capaUrl: string | null;
  percentual: number;
  retomadaAulaId: string | null;
  produtoNome: string | null;
  totalAulas: number;
  aulasVistas: number;
};

export type EadDisponivel = {
  moduloId: string;
  nome: string;
  capaUrl: string | null;
};

export type EventoProximo = {
  id: string;
  titulo: string;
  descricao: string;
  inicio: Date;
  fim: Date;
};

/** Inscrições em_andamento do usuário × módulos do produto ativo (R6). */
export async function continuarDeOndeParou(
  produtoId: string,
  userId: string,
  papel: Papel,
): Promise<CardContinuar[]> {
  return withUser(userId, papel, (tx) =>
    _continuarDeOndeParouNaTx(tx, produtoId, userId),
  );
}

export async function _continuarDeOndeParouNaTx(
  tx: Tx,
  produtoId: string,
  usuarioId: string,
): Promise<CardContinuar[]> {
  const inscricoes = await tx
    .select({
      moduloId: eadModulo.id,
      nome: eadModulo.nome,
      capaUrl: eadModulo.capaUrl,
      ordem: eadModulo.ordem,
      produtoNome: produto.nome,
    })
    .from(inscricaoEad)
    .innerJoin(eadModulo, eq(eadModulo.id, inscricaoEad.eadModuloId))
    .innerJoin(produto, eq(produto.id, eadModulo.produtoId))
    .where(
      and(
        eq(inscricaoEad.usuarioId, usuarioId),
        eq(inscricaoEad.status, "em_andamento"),
        eq(inscricaoEad.interno, false),
        eq(eadModulo.produtoId, produtoId),
      ),
    )
    .orderBy(asc(eadModulo.ordem));

  const cards: CardContinuar[] = [];
  for (const insc of inscricoes) {
    const percentual = await _percentualNaTx(tx, usuarioId, insc.moduloId);
    const retomadaAulaId = await _retomadaAulaNaTx(tx, insc.moduloId, usuarioId);
    const [totalRow] = await tx
      .select({ total: count() })
      .from(aula)
      .where(eq(aula.eadModuloId, insc.moduloId));
    const totalAulas = totalRow?.total ?? 0;
    const aulasVistas = Math.round((percentual / 100) * totalAulas);
    cards.push({
      moduloId: insc.moduloId,
      nome: insc.nome,
      capaUrl: insc.capaUrl,
      percentual,
      retomadaAulaId,
      produtoNome: insc.produtoNome,
      totalAulas,
      aulasVistas,
    });
  }
  return cards;
}

/** Módulos do produto sem inscrição do usuário — sugestão do bloco vazio (FR-004). */
export async function eadsDisponiveis(
  produtoId: string,
  userId: string,
  papel: Papel,
): Promise<EadDisponivel[]> {
  return withUser(userId, papel, (tx) =>
    _eadsDisponiveisNaTx(tx, produtoId, userId),
  );
}

export async function _eadsDisponiveisNaTx(
  tx: Tx,
  produtoId: string,
  usuarioId: string,
): Promise<EadDisponivel[]> {
  const inscritos = await tx
    .select({ eadModuloId: inscricaoEad.eadModuloId })
    .from(inscricaoEad)
    .where(
      and(
        eq(inscricaoEad.usuarioId, usuarioId),
        eq(inscricaoEad.interno, false),
      ),
    );
  const inscritosIds = inscritos
    .map((i) => i.eadModuloId)
    .filter(Boolean) as string[];

  const rows = await tx
    .select({
      moduloId: eadModulo.id,
      nome: eadModulo.nome,
      capaUrl: eadModulo.capaUrl,
    })
    .from(eadModulo)
    .where(
      and(
        eq(eadModulo.produtoId, produtoId),
        eq(eadModulo.interno, false),
        inscritosIds.length > 0
          ? notInArray(eadModulo.id, inscritosIds)
          : undefined,
      ),
    )
    .orderBy(asc(eadModulo.ordem));

  return rows;
}

/**
 * Bloco "Próximos eventos" (FR-006): futuros e em andamento, início ASC.
 * O filtro `fim >= now()` é semântica do BLOCO (vale para todos os papéis);
 * a PERMISSÃO de ver o passado é da policy RLS (R4) — suporte+ o vê na gestão.
 */
export async function proximosEventos(
  userId: string,
  papel: Papel,
  limite = 5,
): Promise<EventoProximo[]> {
  return withUser(userId, papel, (tx) => _proximosEventosNaTx(tx, limite));
}

export async function _proximosEventosNaTx(
  tx: Tx,
  limite = 5,
): Promise<EventoProximo[]> {
  return tx
    .select({
      id: evento.id,
      titulo: evento.titulo,
      descricao: evento.descricao,
      inicio: evento.inicio,
      fim: evento.fim,
    })
    .from(evento)
    .where(gte(evento.fim, sql`now()`))
    .orderBy(asc(evento.inicio))
    .limit(limite);
}

export type TopicoDestaque = {
  id: string;
  titulo: string;
  slug: string;
  moduloNome: string;
  estimativaMinutos: number;
};

/** 4 tópicos mais recentemente atualizados do produto (destaques da base). */
export async function topicosMaisRecentes(
  produtoId: string,
  userId: string,
  papel: Papel,
  limite = 4,
): Promise<TopicoDestaque[]> {
  return withUser(userId, papel, async (tx) => {
    const fixados = await tx
      .select({ topicoId: destaqueBase.topicoId, ordem: destaqueBase.ordem })
      .from(destaqueBase)
      .where(eq(destaqueBase.produtoId, produtoId))
      .orderBy(asc(destaqueBase.ordem))
      .limit(limite);

    const estimativa = sql<number>`GREATEST(1, ROUND(COALESCE(CHAR_LENGTH(${topico.conteudoPublico}), 600) / 1200.0))`;

    if (fixados.length > 0) {
      const ids = fixados.map((f) => f.topicoId);
      const rows = await tx
        .select({
          id: topico.id,
          titulo: topico.titulo,
          slug: topico.slug,
          moduloNome: modulo.nome,
          estimativaMinutos: estimativa,
        })
        .from(topico)
        .innerJoin(modulo, eq(modulo.id, topico.moduloId))
        .where(and(eq(topico.produtoId, produtoId), inArray(topico.id, ids)));

      const ordered = ids
        .map((id) => rows.find((r) => r.id === id))
        .filter(Boolean) as typeof rows;

      return ordered.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        slug: r.slug,
        moduloNome: r.moduloNome,
        estimativaMinutos: Number(r.estimativaMinutos),
      }));
    }

    const rows = await tx
      .select({
        id: topico.id,
        titulo: topico.titulo,
        slug: topico.slug,
        moduloNome: modulo.nome,
        atualizadoEm: topico.atualizadoEm,
        criadoEm: topico.criadoEm,
        estimativaMinutos: estimativa,
      })
      .from(topico)
      .innerJoin(modulo, eq(modulo.id, topico.moduloId))
      .where(eq(topico.produtoId, produtoId))
      .orderBy(desc(sql`COALESCE(${topico.atualizadoEm}, ${topico.criadoEm})`))
      .limit(limite);

    return rows.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      slug: r.slug,
      moduloNome: r.moduloNome,
      estimativaMinutos: Number(r.estimativaMinutos),
    }));
  });
}

export type TopicoOpcao = {
  id: string;
  titulo: string;
  slug: string;
  moduloNome: string;
};

/** Todos os tópicos do produto para o seletor de destaques (dev/master via withSystem). */
export async function topicosDoProduto(produtoId: string): Promise<TopicoOpcao[]> {
  return withSystem(async (tx) =>
    tx
      .select({
        id: topico.id,
        titulo: topico.titulo,
        slug: topico.slug,
        moduloNome: modulo.nome,
      })
      .from(topico)
      .innerJoin(modulo, eq(modulo.id, topico.moduloId))
      .where(eq(topico.produtoId, produtoId))
      .orderBy(asc(modulo.nome), asc(topico.titulo)),
  );
}

/** IDs dos destaques fixados para o produto. */
export async function destaquesFixados(produtoId: string): Promise<string[]> {
  const rows = await withSystem(async (tx) =>
    tx
      .select({ topicoId: destaqueBase.topicoId })
      .from(destaqueBase)
      .where(eq(destaqueBase.produtoId, produtoId))
      .orderBy(asc(destaqueBase.ordem)),
  );
  return rows.map((r) => r.topicoId);
}

/** Gestão (suporte+): tudo que a RLS entrega, mais recente primeiro. */
export async function eventosParaGestao(
  userId: string,
  papel: Papel,
): Promise<EventoProximo[]> {
  return withUser(userId, papel, (tx) =>
    tx
      .select({
        id: evento.id,
        titulo: evento.titulo,
        descricao: evento.descricao,
        inicio: evento.inicio,
        fim: evento.fim,
      })
      .from(evento)
      .orderBy(desc(evento.inicio)),
  );
}
