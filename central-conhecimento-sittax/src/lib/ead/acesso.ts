import { and, desc, eq, inArray } from "drizzle-orm";
import { withUser, type Papel, type Tx } from "@/lib/db/rls";
import { aula, aulaAcesso, inscricaoEad } from "@/lib/db/schema";

/**
 * Fato "usuário abriu a página da aula" (R1) — base da retomada do dashboard.
 * Distinto de progresso_aula (vista = evento `ended` do player).
 */

/**
 * Upsert do acesso, chamado pelo server component da página da aula (R7).
 * Pré-condição: inscrição em_andamento no módulo da aula; sem inscrição é
 * no-op silencioso — nunca quebra o render.
 */
export async function registrarAcessoAula(
  aulaId: string,
  userId: string,
  papel: Papel,
): Promise<void> {
  await withUser(userId, papel, async (tx) => {
    const [aulaRow] = await tx
      .select({ eadModuloId: aula.eadModuloId })
      .from(aula)
      .where(eq(aula.id, aulaId));
    if (!aulaRow) return;

    const [inscricao] = await tx
      .select({ id: inscricaoEad.id })
      .from(inscricaoEad)
      .where(
        and(
          eq(inscricaoEad.usuarioId, userId),
          eq(inscricaoEad.eadModuloId, aulaRow.eadModuloId),
          eq(inscricaoEad.interno, false),
          eq(inscricaoEad.status, "em_andamento"),
        ),
      );
    if (!inscricao) return;

    await tx
      .insert(aulaAcesso)
      .values({ usuarioId: userId, aulaId })
      .onConflictDoUpdate({
        target: [aulaAcesso.usuarioId, aulaAcesso.aulaId],
        set: { acessadoEm: new Date() },
      });
  });
}

/** Aula com max(acessado_em) entre as aulas do módulo; null se nenhum acesso. */
export async function _ultimaAulaAcessadaNaTx(
  tx: Tx,
  moduloId: string,
  usuarioId: string,
): Promise<string | null> {
  const aulasDoModulo = await tx
    .select({ id: aula.id })
    .from(aula)
    .where(eq(aula.eadModuloId, moduloId));
  if (aulasDoModulo.length === 0) return null;

  const [ultimo] = await tx
    .select({ aulaId: aulaAcesso.aulaId })
    .from(aulaAcesso)
    .where(
      and(
        eq(aulaAcesso.usuarioId, usuarioId),
        inArray(
          aulaAcesso.aulaId,
          aulasDoModulo.map((a) => a.id),
        ),
      ),
    )
    .orderBy(desc(aulaAcesso.acessadoEm))
    .limit(1);

  return ultimo?.aulaId ?? null;
}

/**
 * Alvo da retomada (R1): última aula acessada; fallback primeira aula na
 * ordem (nunca acessou, ou a acessada foi removida — o CASCADE já apagou o
 * registro). Null apenas se o módulo não tem aulas.
 */
export async function _retomadaAulaNaTx(
  tx: Tx,
  moduloId: string,
  usuarioId: string,
): Promise<string | null> {
  const ultima = await _ultimaAulaAcessadaNaTx(tx, moduloId, usuarioId);
  if (ultima) return ultima;

  const [primeira] = await tx
    .select({ id: aula.id })
    .from(aula)
    .where(eq(aula.eadModuloId, moduloId))
    .orderBy(aula.ordem)
    .limit(1);

  return primeira?.id ?? null;
}
