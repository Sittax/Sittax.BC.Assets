"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { formatarData } from "@/lib/notas/formatar";
import type { NotaParaLeitura } from "@/lib/notas/consultas";

type Props = {
  notas: NotaParaLeitura[];
  produtoSelecionadoId: string;
  produtoSelecionadoNome: string;
  podeEditar: boolean;
};

export function FiltroNotas({
  notas,
  produtoSelecionadoId,
  produtoSelecionadoNome,
  podeEditar,
}: Props) {
  const [filtro, setFiltro] = useState<string | null>(produtoSelecionadoId);

  const exibidas = filtro
    ? notas.filter((n) => n.produtoId === filtro)
    : notas;

  return (
    <>
      {/* Cabeçalho: h1 + botão nova + toggle — tudo na mesma flex row */}
      <div className="notas-header">
        <h1>Atualizações</h1>
        {podeEditar && (
          <Link href="/atualizacoes/nova" className="login-botao notas-btn-nova">
            <Plus size={14} />
            Nova nota
          </Link>
        )}
        {/* Toggle filtro — margin-left: auto empurra para a direita */}
        <div className="notas-toggle">
          <button
            className={`notas-toggle-opt${filtro === null ? " notas-toggle-opt--ativo" : ""}`}
            onClick={() => setFiltro(null)}
          >
            Todos os produtos
          </button>
          <button
            className={`notas-toggle-opt${filtro === produtoSelecionadoId ? " notas-toggle-opt--ativo" : ""}`}
            onClick={() => setFiltro(produtoSelecionadoId)}
          >
            {produtoSelecionadoNome}
          </button>
        </div>
      </div>

      {/* Grid */}
      {exibidas.length === 0 ? (
        <p className="dash-vazio">
          Nenhuma release note publicada{filtro ? " para este produto" : ""}.
        </p>
      ) : (
        <div className="notas-grid">
          {exibidas.map((n) => (
            <article key={n.id} className="nota-card">
              <div className="nota-card-chips">
                {n.versao && (
                  <span className="nota-card-versao">v{n.versao}</span>
                )}
                <span className="nota-card-produto">{n.produtoNome}</span>
                <span className="nota-card-data">{formatarData(n.data)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <NotaConteudo conteudo={n.conteudo} />
                </div>
                {podeEditar && (
                  <Link
                    href={`/atualizacoes/${n.id}/editar`}
                    className="curso-card-btn-editar"
                    style={{ flexShrink: 0 }}
                  >
                    <Pencil size={12} />
                    Editar
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function NotaConteudo({ conteudo }: { conteudo: string }) {
  const linhas = conteudo.split("\n").filter(Boolean);
  const tituloLinha = linhas.find((l) => /^#+\s/.test(l)) ?? linhas[0] ?? "";
  const titulo = tituloLinha.replace(/^#+\s*/, "").trim();
  const corpo = linhas
    .filter((l) => !(/^#+\s/.test(l) && l === tituloLinha))
    .join(" ")
    .replace(/[#*_`[\]]/g, "")
    .trim()
    .slice(0, 200);

  return (
    <>
      {titulo && <h3 className="nota-card-titulo">{titulo}</h3>}
      {corpo && <p className="nota-card-corpo">{corpo}</p>}
    </>
  );
}
