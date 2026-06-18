"use client";

import { useActionState, useState } from "react";
import { ROTULO_PAPEL } from "@/components/shell/tipos";
import type { ActionResult } from "@/lib/actions/gate";
import {
  criarUsuarioCentral,
  desativarUsuarioCentral,
  editarUsuarioCentral,
  reativarUsuarioCentral,
  type UsuarioListado,
} from "@/lib/actions/usuarios";

interface EscritorioOpcao {
  id: string;
  nome: string;
}

function Mensagem({ estado }: { estado: ActionResult | null }) {
  if (!estado?.mensagem) return null;
  return (
    <p className={estado.ok ? "form-ok" : "form-erro"} role="status">
      {estado.mensagem}
    </p>
  );
}

function CamposPapelEscritorio({
  escritorios,
  papelInicial,
  escritorioInicial,
}: {
  escritorios: EscritorioOpcao[];
  papelInicial?: string;
  escritorioInicial?: string | null;
}) {
  return (
    <>
      <label>
        Papel
        <select name="papel" defaultValue={papelInicial ?? "padrao"}>
          <option value="padrao">Padrão</option>
          <option value="suporte">Suporte</option>
          <option value="dev">Desenvolvedor</option>
          <option value="master">Master</option>
        </select>
      </label>
      <label>
        Escritório
        <select name="escritorioId" defaultValue={escritorioInicial ?? ""}>
          <option value="">— sem escritório (suporte+) —</option>
          {escritorios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function FormNovoUsuario({ escritorios }: { escritorios: EscritorioOpcao[] }) {
  const [estado, action, pendente] = useActionState(criarUsuarioCentral, null);
  return (
    <form className="gerencia-form" action={action}>
      <h2>Novo usuário só central</h2>
      <p className="gerencia-nota">
        Usuários dos 6 sistemas não são cadastrados aqui — entram sozinhos no
        primeiro login (espelhamento).
      </p>
      <div className="form-linha">
        <label>
          Nome
          <input name="nome" required />
        </label>
        <label>
          Sobrenome
          <input name="sobrenome" />
        </label>
        <label>
          E-mail
          <input name="email" type="email" required />
        </label>
        <label>
          Senha
          <input name="senha" type="password" required minLength={10} />
        </label>
        <CamposPapelEscritorio escritorios={escritorios} />
        <button type="submit" disabled={pendente}>
          Criar
        </button>
      </div>
      <Mensagem estado={estado} />
    </form>
  );
}

function LinhaUsuario({
  u,
  escritorios,
}: {
  u: UsuarioListado;
  escritorios: EscritorioOpcao[];
}) {
  const [editando, setEditando] = useState(false);
  const [estadoEditar, editar, salvando] = useActionState(editarUsuarioCentral, null);
  const [estadoDesativar, desativar] = useActionState(desativarUsuarioCentral, null);
  const [estadoReativar, reativar] = useActionState(reativarUsuarioCentral, null);

  const espelhado = u.origem === "sistema";
  const nomeCompleto = [u.nome, u.sobrenome].filter(Boolean).join(" ");

  return (
    <li className={`gerencia-cartao${u.ativo ? "" : " cartao-inativo"}`}>
      <div className="cartao-cabecalho">
        <div>
          <strong>{nomeCompleto}</strong>{" "}
          <span className="cartao-meta">{u.email}</span>
          <div className="cartao-meta">
            {ROTULO_PAPEL[u.papel]}
            {u.escritorioNome ? ` · ${u.escritorioNome}` : ""}
            {!u.ativo && " · desativado"}
          </div>
        </div>
        <div className="cartao-acoes">
          {espelhado ? (
            // FR-025: espelhado é somente leitura, sem botão de editar papel
            <span className="badge-espelhado" title="Papel e dados vêm do sistema de origem">
              espelhado da origem
            </span>
          ) : (
            <>
              <button type="button" onClick={() => setEditando((v) => !v)}>
                {editando ? "Fechar" : "Editar"}
              </button>
              {u.ativo ? (
                <form action={desativar}>
                  <input type="hidden" name="id" value={u.id} />
                  <button type="submit" className="botao-perigo">
                    Desativar
                  </button>
                </form>
              ) : (
                <form action={reativar}>
                  <input type="hidden" name="id" value={u.id} />
                  <button type="submit">Reativar</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {editando && !espelhado && (
        <form className="gerencia-form" action={editar}>
          <input type="hidden" name="id" value={u.id} />
          <div className="form-linha">
            <label>
              Nome
              <input name="nome" defaultValue={u.nome} required />
            </label>
            <label>
              Sobrenome
              <input name="sobrenome" defaultValue={u.sobrenome ?? ""} />
            </label>
            <label>
              Nova senha (opcional)
              <input name="senha" type="password" minLength={10} />
            </label>
            <CamposPapelEscritorio
              escritorios={escritorios}
              papelInicial={u.papel}
              escritorioInicial={u.escritorioId}
            />
            <button type="submit" disabled={salvando}>
              Salvar
            </button>
          </div>
        </form>
      )}

      <Mensagem estado={estadoEditar} />
      <Mensagem estado={estadoDesativar} />
      <Mensagem estado={estadoReativar} />
    </li>
  );
}

export function UsuariosClient({
  usuarios,
  escritorios,
}: {
  usuarios: UsuarioListado[];
  escritorios: EscritorioOpcao[];
}) {
  return (
    <div>
      <FormNovoUsuario escritorios={escritorios} />
      <ul className="gerencia-lista">
        {usuarios.map((u) => (
          <LinhaUsuario key={u.id} u={u} escritorios={escritorios} />
        ))}
      </ul>
    </div>
  );
}
