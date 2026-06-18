import { sql } from "drizzle-orm";
import { withUser, type Papel } from "@/lib/db/rls";

export interface ResultadoBusca {
  slug: string;
  titulo: string;
  trecho: string;
}

/**
 * Busca por título da página e headings H1 do conteúdo (linhas `# `).
 * Prioridade: match exato no título → título contém → H1 contém.
 * Filtro obrigatório por produto_id.
 * padrao → busca em conteudo_publico; suporte+ → conteudo_md.
 */
export async function buscarTopicos(
  userId: string,
  papel: Papel,
  produtoId: string,
  termo: string,
): Promise<ResultadoBusca[]> {
  return withUser(userId, papel, async (tx) => {
    const likePattern = `%${termo}%`;
    // Regex PostgreSQL para linhas H1 (# Título) que contenham o termo (case-insensitive)
    const h1Regex = `(?n)^# .*${termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
    const conteudoCol = papel === "padrao" ? sql`conteudo_publico` : sql`conteudo_md`;

    const resultado = await tx.execute(sql`
      SELECT
        slug,
        titulo,
        CASE
          WHEN titulo ILIKE ${likePattern}
            THEN titulo
          ELSE
            -- Extrai a primeira linha H1 que contém o termo
            COALESCE(
              (regexp_match(${conteudoCol}, ${'(?n)^# .*' + termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}, 'i'))[1],
              titulo
            )
        END AS trecho,
        CASE
          WHEN lower(titulo) = lower(${termo}) THEN 0
          WHEN titulo ILIKE ${likePattern}         THEN 1
          ELSE                                          2
        END AS prio
      FROM topico
      WHERE
        produto_id = ${produtoId}
        AND (
          titulo ILIKE ${likePattern}
          OR ${conteudoCol} ~* ${h1Regex}
        )
      ORDER BY prio, titulo
      LIMIT 20
    `);

    return (
      resultado as unknown as {
        rows: { slug: string; titulo: string; trecho: string }[];
      }
    ).rows.map((r) => ({ slug: r.slug, titulo: r.titulo, trecho: r.trecho ?? "" }));
  });
}
