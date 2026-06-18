import { and, desc, eq } from "drizzle-orm";
import { withUser, type Papel, type Tx } from "@/lib/db/rls";
import { produto, releaseNote } from "@/lib/db/schema";

/**
 * Leitura de release notes com ESCOLHA DE COLUNA POR PAPEL (R2): padrão
 * recebe conteudo_publico (derivada saneada); suporte+ recebe conteudo_md.
 * O markdown bruto NUNCA é retornado a sessão de papel padrão.
 */
export type NotaParaLeitura = {
  id: string;
  data: string;
  versao: string | null;
  conteudo: string;
  produtoId: string;
  produtoNome: string;
};

export async function notasDoProduto(
  produtoId: string,
  userId: string,
  papel: Papel,
): Promise<NotaParaLeitura[]> {
  return withUser(userId, papel, (tx) =>
    _notasDoProdutoNaTx(tx, produtoId, papel),
  );
}

export async function notasRecentes(
  produtoId: string,
  userId: string,
  papel: Papel,
  limite = 5,
): Promise<NotaParaLeitura[]> {
  return withUser(userId, papel, async (tx) => {
    const todas = await _notasDoProdutoNaTx(tx, produtoId, papel);
    return todas.slice(0, limite);
  });
}

/** Todas as notas acessíveis ao usuário (todos os produtos via RLS). */
export async function notasAcessiveis(
  userId: string,
  papel: Papel,
  limite = 30,
): Promise<NotaParaLeitura[]> {
  return withUser(userId, papel, async (tx) => {
    const coluna =
      papel === "padrao" ? releaseNote.conteudoPublico : releaseNote.conteudoMd;
    const rows = await tx
      .select({
        id: releaseNote.id,
        data: releaseNote.data,
        versao: releaseNote.versao,
        conteudo: coluna,
        produtoId: releaseNote.produtoId,
        produtoNome: produto.nome,
      })
      .from(releaseNote)
      .innerJoin(produto, eq(produto.id, releaseNote.produtoId))
      .orderBy(desc(releaseNote.data), desc(releaseNote.criadoEm))
      .limit(limite);
    return rows;
  });
}

export async function _notasDoProdutoNaTx(
  tx: Tx,
  produtoId: string,
  papel: Papel | "system",
): Promise<NotaParaLeitura[]> {
  const coluna =
    papel === "padrao" ? releaseNote.conteudoPublico : releaseNote.conteudoMd;

  const rows = await tx
    .select({
      id: releaseNote.id,
      data: releaseNote.data,
      versao: releaseNote.versao,
      conteudo: coluna,
      produtoId: releaseNote.produtoId,
      produtoNome: produto.nome,
    })
    .from(releaseNote)
    .innerJoin(produto, eq(produto.id, releaseNote.produtoId))
    .where(and(eq(releaseNote.produtoId, produtoId)))
    .orderBy(desc(releaseNote.data), desc(releaseNote.criadoEm));

  return rows;
}
