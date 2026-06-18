import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  continuarDeOndeParou,
  eadsDisponiveis,
  proximosEventos,
  topicosMaisRecentes,
  type CardContinuar,
  type EadDisponivel,
  type TopicoDestaque,
} from "@/lib/dashboard/consultas";
import { notasRecentes, type NotaParaLeitura } from "@/lib/notas/consultas";
import { papelPodeGerirEvento } from "@/lib/eventos/validacao";
import { HeroDash } from "./componentes/HeroDash";
import { BlocoContinuar } from "./componentes/BlocoContinuar";
import { BlocoDestaques } from "./componentes/BlocoDestaques";
import { BlocoFeed } from "./componentes/BlocoFeed";
import { BlocoAgenda } from "./componentes/BlocoAgenda";
import type { EventoProximo } from "@/lib/dashboard/consultas";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { userId, papel, usuario: u } = sessao;
  const podeEditar = papel === "dev" || papel === "master";
  const produtoId = u.produtoSelecionadoId;

  let cards: CardContinuar[] = [];
  let sugestoes: EadDisponivel[] = [];
  let notas: NotaParaLeitura[] = [];
  let destaques: TopicoDestaque[] = [];
  let eventos: EventoProximo[] = [];

  const eventosPromise = proximosEventos(userId, papel);

  if (produtoId) {
    [cards, notas, destaques] = await Promise.all([
      continuarDeOndeParou(produtoId, userId, papel),
      notasRecentes(produtoId, userId, papel, 4),
      topicosMaisRecentes(produtoId, userId, papel, 4),
    ]);
    if (cards.length === 0) {
      sugestoes = await eadsDisponiveis(produtoId, userId, papel);
    }
  }

  eventos = await eventosPromise;

  return (
    <div className="dash-pagina">
      <HeroDash temProduto={Boolean(produtoId)} />

      <div className="dash-grid">
        {/* Coluna esquerda */}
        <div className="dash-col">
          <BlocoContinuar
            temProduto={Boolean(produtoId)}
            cards={cards}
            sugestoes={sugestoes}
          />
          <BlocoDestaques
            temProduto={Boolean(produtoId)}
            destaques={destaques}
            podeEditar={podeEditar}
          />
        </div>

        {/* Coluna direita */}
        <div className="dash-col">
          <BlocoFeed
            temProduto={Boolean(produtoId)}
            notas={notas}
          />
          <BlocoAgenda
            eventos={eventos}
            podeGerir={papelPodeGerirEvento(papel)}
          />
        </div>
      </div>
    </div>
  );
}
