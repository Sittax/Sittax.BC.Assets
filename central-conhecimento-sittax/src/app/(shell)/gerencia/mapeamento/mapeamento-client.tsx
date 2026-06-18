"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/actions/gate";
import {
  criarMapeamento,
  editarMapeamento,
  excluirMapeamento,
} from "@/lib/actions/mapeamento";

interface Entrada {
  id: string;
  roleOrigem: string;
  nivelOrigem: number | null;
  papelCentral: "padrao" | "suporte" | "dev";
}

function Mensagem({ estado }: { estado: ActionResult | null }) {
  if (!estado?.mensagem) return null;
  return (
    <p className={estado.ok ? "form-ok" : "form-erro"} role="status">
      {estado.mensagem}
    </p>
  );
}

function SelectPapel({ defaultValue }: { defaultValue?: string }) {
  return (
    <label>
      Papel da central
      <select name="papelCentral" defaultValue={defaultValue ?? "padrao"}>
        <option value="padrao">Padrão</option>
        <option value="suporte">Suporte</option>
        <option value="dev">Desenvolvedor</option>
        {/* nunca master: papel exclusivamente local */}
      </select>
    </label>
  );
}

function FormNovaEntrada() {
  const [estado, action, pendente] = useActionState(criarMapeamento, null);
  return (
    <form className="gerencia-form" action={action}>
      <h2>Nova entrada</h2>
      <div className="form-linha">
        <label>
          Role de origem
          <input name="roleOrigem" required placeholder="ex.: ADMINISTRADOR" />
        </label>
        <label>
          Nível (vazio = qualquer nível)
          <input name="nivelOrigem" type="number" step="1" />
        </label>
        <SelectPapel />
        <button type="submit" disabled={pendente}>
          Criar
        </button>
      </div>
      <Mensagem estado={estado} />
    </form>
  );
}

function LinhaEntrada({ e }: { e: Entrada }) {
  const [estadoEditar, editar, salvando] = useActionState(editarMapeamento, null);
  const [estadoExcluir, excluir] = useActionState(excluirMapeamento, null);
  return (
    <li className="gerencia-cartao">
      <form className="form-linha" action={editar}>
        <input type="hidden" name="id" value={e.id} />
        <label>
          Role de origem
          <input name="roleOrigem" defaultValue={e.roleOrigem} required />
        </label>
        <label>
          Nível (vazio = qualquer nível)
          <input name="nivelOrigem" type="number" step="1" defaultValue={e.nivelOrigem ?? ""} />
        </label>
        <SelectPapel defaultValue={e.papelCentral} />
        <button type="submit" disabled={salvando}>
          Salvar
        </button>
      </form>
      <form action={excluir}>
        <input type="hidden" name="id" value={e.id} />
        <button type="submit" className="botao-perigo">
          Excluir
        </button>
      </form>
      <Mensagem estado={estadoEditar} />
      <Mensagem estado={estadoExcluir} />
    </li>
  );
}

export function MapeamentoClient({ entradas }: { entradas: Entrada[] }) {
  return (
    <div>
      <p className="gerencia-nota">
        Tradução de <code>role</code>/<code>nivel</code> dos sistemas de origem
        para o papel da central, aplicada a cada login. Combinação sem entrada:{" "}
        <strong>não mapeado → padrão</strong> (fallback fixo, menor privilégio).
      </p>
      <FormNovaEntrada />
      <ul className="gerencia-lista">
        {entradas.map((e) => (
          <LinhaEntrada key={e.id} e={e} />
        ))}
      </ul>
      {entradas.length === 0 && (
        <p className="gerencia-vazio">
          Nenhuma entrada — todos os logins espelhados entram como padrão.
        </p>
      )}
    </div>
  );
}
