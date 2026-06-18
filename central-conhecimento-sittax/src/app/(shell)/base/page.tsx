import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { buscarPrimeiroTopico, buscarArvore } from "@/lib/conteudo/consultas";
import { ArvorePainel } from "./componentes/ArvorePainel";

export const dynamic = "force-dynamic";

/** Redireciona ao 1º tópico do produto ativo ou mostra estado vazio. */
export default async function BasePage() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { userId, papel, usuario: u } = sessao;
  const produtoId = u.produtoSelecionadoId;

  if (!produtoId) {
    return (
      <div className="base-vazio">
        <h2>Selecione um produto</h2>
        <p>Escolha um produto no seletor acima para ver a base de conhecimento.</p>
      </div>
    );
  }

  const primeiro = await withUser(userId, papel, (tx) =>
    buscarPrimeiroTopico(tx, produtoId),
  );

  if (primeiro) {
    redirect(`/base/${primeiro.slug}`);
  }

  // Base vazia — suporte+ vê a gerência para criar o primeiro conteúdo
  const podeGerenciar = papel === "suporte" || papel === "dev" || papel === "master";

  if (!podeGerenciar) {
    return (
      <div className="base-vazio">
        <h2>Base de conhecimento vazia</h2>
        <p>Ainda não há conteúdo publicado para este produto.</p>
      </div>
    );
  }

  // Carrega arvore (vazia) para passar ao ArvorePainel
  const arvore = await buscarArvore(userId, papel, produtoId);

  return (
    <div className="base-layout">
      <ArvorePainel
        arvore={arvore}
        slugAtual=""
        ancestraisIds={new Set()}
        papel={papel}
        produtoId={produtoId}
      />
      <div className="base-conteudo">
        <div className="base-vazio-inline">
          <h2>Base de conhecimento vazia</h2>
          <p>
            Use o painel à esquerda para criar módulos e tópicos.
            Clique em <strong>⚙ Gerenciar árvore</strong> para começar.
          </p>
        </div>
      </div>
    </div>
  );
}
