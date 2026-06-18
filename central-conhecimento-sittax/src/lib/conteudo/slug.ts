import GithubSlugger from "github-slugger";
import type { Tx } from "@/lib/db/rls";
import { topico } from "@/lib/db/schema";
import { and, eq, like } from "drizzle-orm";

/**
 * Gera um slug único por produto (research R7).
 * Usa github-slugger para normalizar o título e sufxa -2, -3... em colisão.
 */
export async function gerarSlugUnico(
  tx: Tx,
  produtoId: string,
  titulo: string,
  excludeId?: string,
): Promise<string> {
  const slugger = new GithubSlugger();
  const base = slugger.slug(titulo);

  // Busca todos os slugs do produto que começam com o base
  const existentes = await tx
    .select({ slug: topico.slug })
    .from(topico)
    .where(
      and(
        eq(topico.produtoId, produtoId),
        like(topico.slug, `${base}%`),
        ...(excludeId ? [eq(topico.id, excludeId)] : []),
      ),
    );

  const set = new Set(
    excludeId
      ? existentes.filter((r) => r.slug !== undefined).map((r) => r.slug)
      : existentes.map((r) => r.slug),
  );

  // Reexclui o slug do tópico atual (para reslug no save)
  if (excludeId) {
    const atual = await tx
      .select({ slug: topico.slug })
      .from(topico)
      .where(eq(topico.id, excludeId));
    if (atual[0]) set.delete(atual[0].slug);
  }

  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
