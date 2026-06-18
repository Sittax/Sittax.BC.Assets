"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, GripVertical, BookOpen } from "lucide-react";
import { salvarDestaques } from "@/lib/dashboard/acoes";
import type { TopicoOpcao } from "@/lib/dashboard/consultas";

type Props = {
  produtoId: string;
  todoTopicos: TopicoOpcao[];
  selecionadosIniciais: string[];
};

export function EditorDestaques({ produtoId, todoTopicos, selecionadosIniciais }: Props) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [selecionados, setSelecionados] = useState<string[]>(selecionadosIniciais);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return todoTopicos;
    return todoTopicos.filter(
      (t) =>
        t.titulo.toLowerCase().includes(q) ||
        t.moduloNome.toLowerCase().includes(q),
    );
  }, [busca, todoTopicos]);

  const selecionadosMapa = useMemo(
    () => new Map(selecionados.map((id, i) => [id, i])),
    [selecionados],
  );

  function toggleTopico(id: string) {
    setSelecionados((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  async function handleSalvar() {
    setErro(null);
    iniciarTransicao(async () => {
      const res = await salvarDestaques(produtoId, selecionados);
      if (!res.ok) {
        setErro(res.erro ?? "Erro ao salvar");
      } else {
        router.push("/dashboard");
      }
    });
  }

  const topicosOrdenados = selecionados
    .map((id) => todoTopicos.find((t) => t.id === id))
    .filter(Boolean) as TopicoOpcao[];

  return (
    <div className="dest-editor">
      {/* Selecionados */}
      <div className="dest-sel-wrap">
        <div className="dest-sel-header">
          <span className="dest-sel-label">Destaques selecionados</span>
          <span className="dest-sel-count">{selecionados.length} / 4</span>
        </div>
        {topicosOrdenados.length === 0 ? (
          <div className="dest-sel-vazio">Nenhum tópico selecionado ainda.</div>
        ) : (
          <ul className="dest-sel-lista">
            {topicosOrdenados.map((t, i) => (
              <li key={t.id} className="dest-sel-item">
                <span className="dest-sel-num">{i + 1}</span>
                <div className="dest-sel-info">
                  <span className="dest-sel-titulo">{t.titulo}</span>
                  <span className="dest-sel-modulo">{t.moduloNome}</span>
                </div>
                <button
                  className="dest-sel-remover"
                  onClick={() => toggleTopico(t.id)}
                  type="button"
                  aria-label="Remover"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Busca */}
      <div className="dest-busca-wrap">
        <div className="dest-busca-field">
          <Search size={14} className="dest-busca-ico" />
          <input
            className="dest-busca-input"
            type="text"
            placeholder="Buscar tópico..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <ul className="dest-lista">
          {filtrados.length === 0 && (
            <li className="dest-lista-vazio">Nenhum tópico encontrado.</li>
          )}
          {filtrados.map((t) => {
            const ordem = selecionadosMapa.get(t.id);
            const marcado = ordem !== undefined;
            const bloqueado = !marcado && selecionados.length >= 4;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`dest-item${marcado ? " dest-item--sel" : ""}${bloqueado ? " dest-item--bloq" : ""}`}
                  onClick={() => !bloqueado && toggleTopico(t.id)}
                  disabled={bloqueado}
                >
                  <span className="dest-item-check">
                    {marcado ? <span className="dest-item-num">{(ordem ?? 0) + 1}</span> : <BookOpen size={13} />}
                  </span>
                  <div className="dest-item-info">
                    <span className="dest-item-titulo">{t.titulo}</span>
                    <span className="dest-item-modulo">{t.moduloNome}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {erro && <p className="dest-erro">{erro}</p>}

      <div className="dest-rodape">
        <button
          type="button"
          className="curso-modulo-voltar"
          onClick={() => router.push("/dashboard")}
          disabled={pendente}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="login-botao"
          onClick={handleSalvar}
          disabled={pendente}
        >
          {pendente ? "Salvando…" : "Salvar destaques"}
        </button>
      </div>
    </div>
  );
}
