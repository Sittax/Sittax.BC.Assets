import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { notasAcessiveis } from "@/lib/notas/consultas";
import { papelPodeEscreverNota } from "@/lib/notas/validacao";
import { withUser } from "@/lib/db/rls";
import { produto } from "@/lib/db/schema";
import { FiltroNotas } from "./componentes/FiltroNotas";

export const dynamic = "force-dynamic";

export default async function AtualizacoesPage() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { userId, papel, usuario: u } = sessao;
  const produtoId = u.produtoSelecionadoId;
  const podeEditar = papelPodeEscreverNota(papel);

  if (!produtoId) {
    return (
      <div className="notas-pagina">
        <div className="notas-header">
          <h1>Atualizações</h1>
        </div>
        <p className="dash-vazio">
          Selecione um produto no seletor acima para ver as release notes.
        </p>
      </div>
    );
  }

  const [notas, produtoRow] = await Promise.all([
    notasAcessiveis(userId, papel),
    withUser(userId, papel, async (tx) => {
      const [p] = await tx
        .select({ nome: produto.nome })
        .from(produto)
        .where(eq(produto.id, produtoId));
      return p ?? null;
    }),
  ]);

  const produtoNome = produtoRow?.nome ?? "Produto";

  return (
    <div className="notas-pagina">
      <FiltroNotas
        notas={notas}
        produtoSelecionadoId={produtoId}
        produtoSelecionadoNome={produtoNome}
        podeEditar={podeEditar}
      />
    </div>
  );
}
