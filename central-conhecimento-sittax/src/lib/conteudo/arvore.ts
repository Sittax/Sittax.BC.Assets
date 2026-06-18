import type { Tx } from "@/lib/db/rls";
import { topico } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const MAX_PROFUNDIDADE = 5;

/**
 * Calcula a profundidade de um tópico subindo pela cadeia de parent_id.
 * Profundidade 1 = filho direto do módulo.
 */
export async function calcularProfundidade(
  tx: Tx,
  parentId: string | null,
): Promise<number> {
  if (!parentId) return 1;
  let id: string | null = parentId;
  let depth = 1;
  while (id !== null) {
    depth++;
    if (depth > MAX_PROFUNDIDADE + 1) return depth;
    const rows = await tx
      .select({ parentId: topico.parentId })
      .from(topico)
      .where(eq(topico.id, id));
    id = rows[0]?.parentId ?? null;
  }
  return depth;
}

/**
 * Verifica se `antepassadoId` é ancestral de `topicoId`.
 * Usado para prevenção de ciclo no moverTopico.
 */
export async function eDescendente(
  tx: Tx,
  topicoId: string,
  antepassadoId: string,
): Promise<boolean> {
  let id: string | null = antepassadoId;
  const visitados = new Set<string>();
  while (id !== null) {
    if (visitados.has(id)) return false; // ciclo já existente
    visitados.add(id);
    if (id === topicoId) return true;
    const rows = await tx
      .select({ parentId: topico.parentId })
      .from(topico)
      .where(eq(topico.id, id));
    id = rows[0]?.parentId ?? null;
  }
  return false;
}

/**
 * Valida se criar/mover um tópico para `novoParentId` respeita as regras:
 * - profundidade ≤ MAX_PROFUNDIDADE
 * - sem ciclo (novoParentId não pode ser descendente do tópico sendo movido)
 * Retorna mensagem de erro ou null se OK.
 */
export async function validarMovimentoTopico(
  tx: Tx,
  topicoId: string | null,
  novoParentId: string | null,
): Promise<string | null> {
  const profundidade = await calcularProfundidade(tx, novoParentId);
  if (profundidade > MAX_PROFUNDIDADE) {
    return `Profundidade máxima de ${MAX_PROFUNDIDADE} níveis excedida.`;
  }
  if (topicoId && novoParentId) {
    const ciclo = await eDescendente(tx, topicoId, novoParentId);
    if (ciclo) {
      return "Não é possível mover um tópico para dentro de si mesmo ou de seus descendentes.";
    }
  }
  return null;
}

/**
 * Verifica se um tópico tem filhos diretos.
 */
export async function temFilhos(tx: Tx, topicoId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: topico.id })
    .from(topico)
    .where(eq(topico.parentId, topicoId));
  return rows.length > 0;
}
