"use client";

import { useActionState } from "react";
import type { ProdutoItem } from "@/components/shell/tipos";
import {
  alternarProduto,
  criarEscritorio,
  editarEscritorio,
  excluirEscritorio,
  type EscritorioListado,
} from "@/lib/actions/escritorios";
import { formatarCnpj } from "@/lib/cnpj";
import type { ActionResult } from "@/lib/actions/gate";

function Mensagem({ estado }: { estado: ActionResult | null }) {
  if (!estado?.mensagem) return null;
  return (
    <p className={estado.ok ? "form-ok" : "form-erro"} role="status">
      {estado.mensagem}
    </p>
  );
}

function FormNovoEscritorio() {
  const [estado, action, pendente] = useActionState(criarEscritorio, null);
  return (
    <form className="gerencia-form" action={action}>
      <h2>Novo escritório</h2>
      <div className="form-linha">
        <label>
          CNPJ
          <input name="cnpj" required placeholder="00.000.000/0000-00" />
        </label>
        <label>
          Nome
          <input name="nome" required placeholder="Nome do escritório" />
        </label>
        <button type="submit" disabled={pendente}>
          Criar
        </button>
      </div>
      <Mensagem estado={estado} />
    </form>
  );
}

function LinhaEscritorio({
  escritorio: e,
  produtos,
}: {
  escritorio: EscritorioListado;
  produtos: ProdutoItem[];
}) {
  const [estadoEditar, editar, editando] = useActionState(editarEscritorio, null);
  const [estadoExcluir, excluir, excluindo] = useActionState(excluirEscritorio, null);
  const [estadoProduto, alternar] = useActionState(alternarProduto, null);

  return (
    <li className="gerencia-cartao">
      <div className="cartao-cabecalho">
        <form action={editar} className="form-inline">
          <input type="hidden" name="id" value={e.id} />
          <input name="nome" defaultValue={e.nome} aria-label="Nome do escritório" />
          <button type="submit" disabled={editando}>
            Salvar nome
          </button>
        </form>
        <span className="cartao-meta">
          CNPJ {formatarCnpj(e.cnpj)} · {e.totalUsuarios}{" "}
          {e.totalUsuarios === 1 ? "usuário" : "usuários"}
        </span>
        <form action={excluir}>
          <input type="hidden" name="id" value={e.id} />
          <button type="submit" className="botao-perigo" disabled={excluindo}>
            Excluir
          </button>
        </form>
      </div>
      <div className="cartao-produtos">
        <span className="cartao-rotulo">Produtos contratados:</span>
        {produtos.map((p) => {
          const vinculado = e.produtoIds.includes(p.id);
          return (
            <form key={p.id} action={alternar} className="form-chip">
              <input type="hidden" name="escritorioId" value={e.id} />
              <input type="hidden" name="produtoId" value={p.id} />
              <input type="hidden" name="vincular" value={vinculado ? "nao" : "sim"} />
              <button
                type="submit"
                className={`chip${vinculado ? " chip-ativo" : ""}`}
                title={vinculado ? "Desvincular" : "Vincular"}
              >
                {p.nome}
              </button>
            </form>
          );
        })}
      </div>
      <Mensagem estado={estadoEditar} />
      <Mensagem estado={estadoExcluir} />
      <Mensagem estado={estadoProduto} />
    </li>
  );
}

export function EscritoriosClient({
  escritorios,
  produtos,
}: {
  escritorios: EscritorioListado[];
  produtos: ProdutoItem[];
}) {
  return (
    <div>
      <FormNovoEscritorio />
      <ul className="gerencia-lista">
        {escritorios.map((e) => (
          <LinhaEscritorio key={e.id} escritorio={e} produtos={produtos} />
        ))}
      </ul>
      {escritorios.length === 0 && (
        <p className="gerencia-vazio">Nenhum escritório cadastrado ainda.</p>
      )}
    </div>
  );
}
