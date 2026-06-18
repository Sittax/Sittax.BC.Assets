"use client";

import { useState } from "react";
import { CheckCircle, Circle, PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
import PlayerYouTube from "./PlayerYouTube";
import { MarkdownTopico } from "@/components/markdown/MarkdownTopico";
import type { ModuloComAulas } from "@/lib/ead/trilha";


type Props = {
  modulo: ModuloComAulas;
  percentualInicial: number;
};

export function CascadeEad({ modulo, percentualInicial }: Props) {
  const { aulas } = modulo;

  const primeiraAula = aulas.find((a) => !a.vista) ?? aulas[aulas.length - 1] ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(primeiraAula?.id ?? null);
  const [vistasLocal, setVistasLocal] = useState<Set<string>>(
    new Set(aulas.filter((a) => a.vista).map((a) => a.id)),
  );
  const [percentual, setPercentual] = useState(percentualInicial);

  const aulaAtual = aulas.find((a) => a.id === selectedId) ?? null;
  const idx = aulaAtual ? aulas.indexOf(aulaAtual) : -1;
  const anterior = idx > 0 ? aulas[idx - 1] : null;
  const proxima = idx >= 0 && idx < aulas.length - 1 ? aulas[idx + 1] : null;

  function handleProgressoAtualizado(novoPercentual: number) {
    if (aulaAtual) {
      setVistasLocal((prev) => new Set([...prev, aulaAtual.id]));
    }
    setPercentual(novoPercentual);
  }

  if (aulas.length === 0) {
    return (
      <div className="curso-cascade-vazio">
        Este módulo ainda não possui aulas.
      </div>
    );
  }

  return (
    <>
      {/* Barra de progresso */}
      <div className="curso-cascade-barra-progresso">
        <div className="curso-cascade-progresso-wrap">
          <div className="curso-cascade-progresso-trilho">
            <div
              className="curso-cascade-progresso-fill"
              style={{ width: `${percentual}%` }}
            />
          </div>
          <span className="curso-cascade-progresso-label">
            {vistasLocal.size}/{aulas.length} aulas · {percentual}%
          </span>
        </div>
      </div>

      {/* Descrição do módulo */}
      {modulo.descricaoMd.trim() && (
        <div className="curso-cascade-intro">
          <p>{modulo.descricaoMd}</p>
        </div>
      )}

      {/* Corpo: sidebar + main */}
      <div className="curso-cascade-conteudo">
        {/* Sidebar */}
        <aside className="curso-cascade-sidebar">
          <div className="curso-cascade-sidebar-titulo">Aulas</div>
          <ul className="curso-cascade-aulas-lista">
            {aulas.map((a, i) => {
              const ativa = a.id === selectedId;
              const vista = vistasLocal.has(a.id);
              return (
                <li
                  key={a.id}
                  className={`curso-cascade-aula-item${ativa ? " curso-cascade-aula-item--ativa" : ""}`}
                >
                  <button
                    className="curso-cascade-aula-btn"
                    onClick={() => setSelectedId(a.id)}
                  >
                    <span className="curso-cascade-aula-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="curso-cascade-aula-titulo-sidebar">{a.titulo}</span>
                    {vista ? (
                      <CheckCircle size={13} className="curso-cascade-aula-icone curso-cascade-aula-icone--vista" />
                    ) : ativa ? (
                      <PlayCircle size={13} className="curso-cascade-aula-icone curso-cascade-aula-icone--ativa" />
                    ) : (
                      <Circle size={13} className="curso-cascade-aula-icone" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Main */}
        <div className="curso-cascade-main">
          {aulaAtual ? (
            <>
              <h2 className="curso-cascade-aula-titulo-main">{aulaAtual.titulo}</h2>

              <PlayerYouTube
                key={aulaAtual.id}
                youtubeId={aulaAtual.youtubeId}
                aulaId={aulaAtual.id}
                onProgressoAtualizado={handleProgressoAtualizado}
              />

              {aulaAtual.descricaoMd.trim() && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
                  <MarkdownTopico conteudo={aulaAtual.descricaoMd} />
                </div>
              )}

              {/* Navegação */}
              <div className="curso-cascade-nav">
                {anterior && (
                  <button
                    className="curso-cascade-nav-btn"
                    onClick={() => setSelectedId(anterior.id)}
                  >
                    <ChevronLeft size={14} />
                    {anterior.titulo}
                  </button>
                )}
                {proxima && (
                  <button
                    className="curso-cascade-nav-btn curso-cascade-nav-btn--primario"
                    onClick={() => setSelectedId(proxima.id)}
                  >
                    {proxima.titulo}
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="curso-cascade-vazio">Selecione uma aula na lista ao lado.</div>
          )}
        </div>
      </div>
    </>
  );
}
