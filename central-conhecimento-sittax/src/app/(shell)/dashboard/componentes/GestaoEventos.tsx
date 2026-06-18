"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  criarEvento,
  atualizarEvento,
  excluirEvento,
} from "@/lib/actions/eventos";
import {
  formatarDataHora,
  formatarHora,
  paraInputDateTimeLocal,
} from "@/lib/notas/formatar";

export type EventoGestao = {
  id: string;
  titulo: string;
  descricao: string;
  inicio: Date;
  fim: Date;
};

type FormState = {
  id?: string;
  titulo: string;
  descricao: string;
  inicio: string;
  fim: string;
};

const FORM_VAZIO: FormState = { titulo: "", descricao: "", inicio: "", fim: "" };

function FormEvento({
  inicial,
  onFechar,
}: {
  inicial: FormState;
  onFechar: () => void;
}) {
  const [form, setForm] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const result = form.id
      ? await atualizarEvento({ ...form, id: form.id })
      : await criarEvento(form);
    setSalvando(false);
    if (result.ok) {
      onFechar();
      router.refresh();
    } else {
      setErro(result.mensagem);
    }
  };

  return (
    <form className="evento-form" onSubmit={salvar}>
      <div className="evento-form-linha">
        <label className="editor-nota-campo">
          Título
          <input
            type="text"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            required
          />
        </label>
      </div>
      <div className="evento-form-linha">
        <label className="editor-nota-campo">
          Descrição
          <textarea
            value={form.descricao}
            rows={2}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
        </label>
      </div>
      <div className="evento-form-linha evento-form-horarios">
        <label className="editor-nota-campo">
          Início
          <input
            type="datetime-local"
            value={form.inicio}
            onChange={(e) => setForm({ ...form, inicio: e.target.value })}
            required
          />
        </label>
        <label className="editor-nota-campo">
          Fim
          <input
            type="datetime-local"
            value={form.fim}
            onChange={(e) => setForm({ ...form, fim: e.target.value })}
            required
          />
        </label>
      </div>
      {erro && <p className="editor-erro">{erro}</p>}
      <div className="evento-form-acoes">
        <button type="submit" className="login-botao" disabled={salvando}>
          {salvando ? "Salvando…" : form.id ? "Salvar alterações" : "Criar evento"}
        </button>
        <button
          type="button"
          className="login-botao editor-btn-secundario"
          onClick={onFechar}
        >
          <X size={13} /> Cancelar
        </button>
      </div>
    </form>
  );
}

function LinhaEvento({
  evento,
  onEditar,
}: {
  evento: EventoGestao;
  onEditar: () => void;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const router = useRouter();

  const excluir = async () => {
    if (!window.confirm(`Excluir o evento "${evento.titulo}"?`)) return;
    setExcluindo(true);
    const result = await excluirEvento({ id: evento.id });
    setExcluindo(false);
    if (result.ok) router.refresh();
  };

  return (
    <li className="dash-evento">
      <div className="dash-evento-data">
        <span>{formatarDataHora(evento.inicio)}</span>
        <span className="dash-evento-hora">
          {formatarHora(evento.inicio)} – {formatarHora(evento.fim)}
        </span>
      </div>
      <div className="dash-evento-corpo">
        <h3>{evento.titulo}</h3>
        {evento.descricao && <p>{evento.descricao}</p>}
      </div>
      <div className="evento-acoes">
        <button className="curso-card-btn-editar" onClick={onEditar}>
          <Pencil size={12} /> Editar
        </button>
        <button
          className="curso-card-btn-editar evento-btn-excluir"
          onClick={excluir}
          disabled={excluindo}
        >
          <Trash2 size={12} /> Excluir
        </button>
      </div>
    </li>
  );
}

export function GestaoEventos({
  proximos,
  historico,
}: {
  proximos: EventoGestao[];
  historico: EventoGestao[];
}) {
  const [form, setForm] = useState<FormState | null>(null);

  const editar = (e: EventoGestao) =>
    setForm({
      id: e.id,
      titulo: e.titulo,
      descricao: e.descricao,
      inicio: paraInputDateTimeLocal(e.inicio),
      fim: paraInputDateTimeLocal(e.fim),
    });

  return (
    <div className="gestao-eventos">
      {form ? (
        <FormEvento inicial={form} onFechar={() => setForm(null)} />
      ) : (
        <button className="login-botao notas-btn-nova" onClick={() => setForm(FORM_VAZIO)}>
          <Plus size={14} /> Novo evento
        </button>
      )}

      <h2 className="dash-bloco-titulo">Próximos</h2>
      {proximos.length === 0 ? (
        <p className="dash-vazio">
          <CalendarDays size={14} /> Nenhum evento agendado.
        </p>
      ) : (
        <ul className="dash-eventos-lista">
          {proximos.map((e) => (
            <LinhaEvento key={e.id} evento={e} onEditar={() => editar(e)} />
          ))}
        </ul>
      )}

      <h2 className="dash-bloco-titulo">Histórico</h2>
      {historico.length === 0 ? (
        <p className="dash-vazio">Nenhum evento passado.</p>
      ) : (
        <ul className="dash-eventos-lista gestao-historico">
          {historico.map((e) => (
            <LinhaEvento key={e.id} evento={e} onEditar={() => editar(e)} />
          ))}
        </ul>
      )}
    </div>
  );
}
