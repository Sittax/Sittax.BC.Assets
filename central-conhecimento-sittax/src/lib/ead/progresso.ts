import { and, count, eq, inArray } from "drizzle-orm";
import { withUser, type Papel } from "@/lib/db/rls";
import { aula, inscricaoEad, progressoAula } from "@/lib/db/schema";

/** % de aulas vistas sobre o total atual do módulo. Nunca >100%. */
export async function percentualProgresso(
  usuarioId: string,
  moduloId: string,
  userId: string,
  papel: Papel,
): Promise<number> {
  return withUser(userId, papel, async (tx) => {
    return _percentualNaTx(tx, usuarioId, moduloId);
  });
}

/**
 * Marca aula como vista (idempotente — ON CONFLICT DO NOTHING).
 * Pré-condições: aula existe + inscrição ativa no módulo da aula (FR-005).
 */
export async function marcarAulaVista(
  aulaId: string,
  usuarioId: string,
  papel: Papel,
): Promise<{ vista: true; percentual: number }> {
  return withUser(usuarioId, papel, async (tx) => {
    const [aulaRow] = await tx
      .select({ eadModuloId: aula.eadModuloId })
      .from(aula)
      .where(eq(aula.id, aulaId));

    if (!aulaRow) {
      const err = new Error("aula_nao_encontrada");
      (err as any).code = "NOT_FOUND";
      throw err;
    }

    // Verifica inscrição ativa neste módulo
    const [inscricao] = await tx
      .select({ id: inscricaoEad.id })
      .from(inscricaoEad)
      .where(
        and(
          eq(inscricaoEad.usuarioId, usuarioId),
          eq(inscricaoEad.eadModuloId, aulaRow.eadModuloId),
          eq(inscricaoEad.interno, false),
          eq(inscricaoEad.status, "em_andamento"),
        ),
      );

    if (!inscricao) {
      const err = new Error("sem_inscricao");
      (err as any).code = "SEM_INSCRICAO";
      throw err;
    }

    await tx
      .insert(progressoAula)
      .values({ usuarioId, aulaId })
      .onConflictDoNothing();

    const percentual = await _percentualNaTx(tx, usuarioId, aulaRow.eadModuloId);

    return { vista: true, percentual };
  });
}

/** Percentual dentro de uma transação aberta (reuso interno). */
export async function _percentualNaTx(
  tx: import("@/lib/db/rls").Tx,
  usuarioId: string,
  moduloId: string,
): Promise<number> {
  const aulasDoModulo = await tx
    .select({ id: aula.id })
    .from(aula)
    .where(eq(aula.eadModuloId, moduloId));

  const total = aulasDoModulo.length;
  if (total === 0) return 0;

  const aulaIds = aulasDoModulo.map((a) => a.id);

  const [vistasRow] = await tx
    .select({ vistas: count() })
    .from(progressoAula)
    .where(
      and(
        eq(progressoAula.usuarioId, usuarioId),
        inArray(progressoAula.aulaId, aulaIds),
      ),
    );

  return Math.min(100, Math.round(((vistasRow?.vistas ?? 0) / total) * 100));
}

/** Inscrições em andamento do usuário com % de cada uma (FR-007). */
export async function inscricoesEmAndamento(
  usuarioId: string,
  papel: Papel,
): Promise<{ moduloId: string; percentual: number }[]> {
  return withUser(usuarioId, papel, async (tx) => {
    const inscricoes = await tx
      .select({ eadModuloId: inscricaoEad.eadModuloId })
      .from(inscricaoEad)
      .where(
        and(
          eq(inscricaoEad.usuarioId, usuarioId),
          eq(inscricaoEad.status, "em_andamento"),
          eq(inscricaoEad.interno, false),
        ),
      );

    const result: { moduloId: string; percentual: number }[] = [];
    for (const insc of inscricoes) {
      if (!insc.eadModuloId) continue;
      const pct = await _percentualNaTx(tx, usuarioId, insc.eadModuloId);
      result.push({ moduloId: insc.eadModuloId, percentual: pct });
    }
    return result;
  });
}
