"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { criarAnotacao, editarAnotacao, excluirAnotacao } from "@/lib/actions/ead-anotacoes";

type Anotacao = { id: string; conteudoMd: string; criadoEm: string };

type Props = {
  aulaId: string;
  anotacoes: Anotacao[];
  onCriar: (nova: Anotacao) => void;
  onEditar: (id: string, texto: string) => void;
  onExcluir: (id: string) => void;
};

export function TabAnotacoes({ aulaId, anotacoes, onCriar, onEditar, onExcluir }: Props) {
  const [nova, setNova] = useState("");
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");

  async function handleCriar() {
    if (!nova.trim()) return;
    setPendente(true);
    setErro(null);
    const res = await criarAnotacao({ aulaId, conteudoMd: nova.trim() });
    if (res.ok && res.data) {
      onCriar({ id: res.data.id, conteudoMd: nova.trim(), criadoEm: res.data.criadoEm });
      setNova("");
    } else if (!res.ok) {
      setErro(res.mensagem);
    }
    setPendente(false);
  }

  function abrirEdicao(a: Anotacao) {
    setEditandoId(a.id);
    setEditTexto(a.conteudoMd);
  }

  async function handleEditar(id: string) {
    if (!editTexto.trim()) return;
    const res = await editarAnotacao({ id, conteudoMd: editTexto.trim() });
    if (res.ok) {
      onEditar(id, editTexto.trim());
      setEditandoId(null);
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir esta anotação?")) return;
    const res = await excluirAnotacao(id);
    if (res.ok) onExcluir(id);
  }

  return (
    <div>
      {/* Form nova anotação */}
      <div className="curso-anotacao-form">
        <textarea
          className="curso-anotacao-textarea"
          rows={3}
          placeholder="Escreva uma anotação sobre esta aula…"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCriar();
          }}
        />
        {erro && <p style={{ color: "var(--danger, #c0392b)", fontSize: 12 }}>{erro}</p>}
        <div>
          <button
            className="curso-player-btn curso-player-btn--primario"
            onClick={handleCriar}
            disabled={pendente || !nova.trim()}
          >
            {pendente ? "Salvando…" : "Salvar anotação"}
          </button>
        </div>
      </div>

      {/* Lista */}
      {anotacoes.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Nenhuma anotação ainda.</p>
      ) : (
        <div>
          {anotacoes.map((a) => (
            <div key={a.id} className="curso-anotacao-item">
              <div className="curso-anotacao-cabecalho">
                <span className="curso-anotacao-data">
                  {new Date(a.criadoEm).toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </span>
                <span className="curso-anotacao-acoes">
                  <button
                    className="curso-gestao-icone-btn"
                    title="Editar"
                    onClick={() => (editandoId === a.id ? setEditandoId(null) : abrirEdicao(a))}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="curso-gestao-icone-btn curso-gestao-icone-btn--perigo"
                    title="Excluir"
                    onClick={() => handleExcluir(a.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>

              {editandoId === a.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <textarea
                    className="curso-anotacao-textarea"
                    rows={3}
                    value={editTexto}
                    onChange={(e) => setEditTexto(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="curso-player-btn curso-player-btn--primario" onClick={() => handleEditar(a.id)}>
                      Salvar
                    </button>
                    <button className="curso-player-btn" onClick={() => setEditandoId(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="curso-anotacao-texto">{a.conteudoMd}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
