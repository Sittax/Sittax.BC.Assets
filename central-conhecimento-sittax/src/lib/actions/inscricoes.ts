"use server";

import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { aula, eadModulo, inscricaoEad } from "@/lib/db/schema";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; mensagem: string };

const iniciarEadSchema = z.object({ moduloId: z.string().uuid() });

/**
 * Inscreve o usuário em um módulo EAD específico (idempotente — ON CONFLICT DO NOTHING).
 * Inscrição é por módulo, não por produto inteiro.
 */
export async function iniciarEad(
  input: z.infer<typeof iniciarEadSchema>,
): Promise<ActionResult<{ id: string; status: string }>> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, mensagem: "Sessão inválida." };

  const parsed = iniciarEadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: "Entrada inválida." };

  const { moduloId } = parsed.data;

  return withUser(sessao.userId, sessao.papel, async (tx) => {
    // Valida: módulo existe
    const [modRow] = await tx
      .select({ id: eadModulo.id, produtoId: eadModulo.produtoId })
      .from(eadModulo)
      .where(eq(eadModulo.id, moduloId));

    if (!modRow) {
      return { ok: false, mensagem: "Curso não encontrado." };
    }

    // Valida: módulo deve ter ≥1 aula (R8)
    const [totalAulas] = await tx
      .select({ total: count() })
      .from(aula)
      .where(eq(aula.eadModuloId, moduloId));

    if ((totalAulas?.total ?? 0) === 0) {
      return { ok: false, mensagem: "Este curso não possui aulas disponíveis." };
    }

    // Tenta inserir; se já existe devolve a existente
    await tx
      .insert(inscricaoEad)
      .values({
        usuarioId: sessao.userId,
        produtoId: modRow.produtoId,
        eadModuloId: moduloId,
        interno: false,
        status: "em_andamento",
      })
      .onConflictDoNothing();

    const [inscricao] = await tx
      .select({ id: inscricaoEad.id, status: inscricaoEad.status })
      .from(inscricaoEad)
      .where(
        and(
          eq(inscricaoEad.usuarioId, sessao.userId),
          eq(inscricaoEad.eadModuloId, moduloId),
          eq(inscricaoEad.interno, false),
        ),
      );

    return { ok: true, data: { id: inscricao.id, status: inscricao.status } };
  });
}
