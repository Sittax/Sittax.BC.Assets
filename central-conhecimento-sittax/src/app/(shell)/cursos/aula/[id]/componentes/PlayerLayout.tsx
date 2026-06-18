"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Check, CheckCircle2, Play,
  FileText, File, Download, GraduationCap, Clock,
} from "lucide-react";
import PlayerYouTube from "../../../componentes/PlayerYouTube";
import { TabAnotacoes } from "./TabAnotacoes";
import type { AulaMaterial, AulaAnotacao } from "@/lib/ead/trilha";

type AulaSimples = { id: string; titulo: string; ordem: number; vista: boolean };

type Props = {
  aulaId: string;
  aulaOrdem: number;
  aulaTitulo: string;
  aulaYoutubeId: string;
  aulaDescricaoHtml: string;
  aulaVista: boolean;
  moduloId: string;
  moduloNome: string;
  todasAulas: AulaSimples[];
  anteriorId: string | null;
  proximoId: string | null;
  materiais: AulaMaterial[];
  anotacoesIniciais: AulaAnotacao[];
};

type Aba = "sobre" | "materiais" | "anotacoes";

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function IconeMime({ mime }: { mime: string }) {
  if (mime.includes("pdf")) return <FileText size={20} />;
  return <File size={20} />;
}

export function PlayerLayout({
  aulaId,
  aulaOrdem,
  aulaTitulo,
  aulaYoutubeId,
  aulaDescricaoHtml,
  aulaVista,
  moduloId,
  moduloNome,
  todasAulas,
  anteriorId,
  proximoId,
  materiais,
  anotacoesIniciais,
}: Props) {
  const router = useRouter();
  const [vistaLocal, setVistaLocal] = useState(aulaVista);
  const [aba, setAba] = useState<Aba>("sobre");
  const [pendente, setPendente] = useState(false);
  const [anotacoes, setAnotacoes] = useState(anotacoesIniciais);

  const aulasComStatus = todasAulas.map((a) =>
    a.id === aulaId ? { ...a, vista: vistaLocal } : a,
  );
  const vistas = aulasComStatus.filter((a) => a.vista).length;
  const total = aulasComStatus.length;
  const percentual = total > 0 ? Math.round((vistas / total) * 100) : 0;

  async function handleConcluirAvancar() {
    setPendente(true);
    await fetch("/api/ead/progresso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aulaId }),
    }).catch(() => {});
    setVistaLocal(true);
    if (proximoId) {
      router.push(`/cursos/aula/${proximoId}`);
    }
    setPendente(false);
  }

  return (
    <div className="curso-player-pagina">
      {/* Breadcrumb */}
      <nav className="curso-player-breadcrumb">
        <Link href={`/cursos/${moduloId}`} className="curso-player-breadcrumb-link">
          <ChevronLeft size={14} />
          Voltar para a trilha
        </Link>
        <span className="curso-player-breadcrumb-sep">·</span>
        <span className="curso-player-breadcrumb-curso">{moduloNome}</span>
      </nav>

      <div className="curso-player-cols">
        {/* ── Coluna principal ── */}
        <div className="curso-player-main">
          {/* Label dark acima do player */}
          <div className="curso-player-label">
            <Play size={12} fill="currentColor" />
            aula {aulaOrdem} · {aulaTitulo}
          </div>

          <PlayerYouTube
            youtubeId={aulaYoutubeId}
            aulaId={aulaId}
            onProgressoAtualizado={() => setVistaLocal(true)}
          />

          {/* Cabeçalho da aula */}
          <div className="curso-player-header">
            <div className="curso-player-header-esq">
              <h1 className="curso-player-titulo">
                Aula {aulaOrdem} · {aulaTitulo}
              </h1>
              <div className="curso-player-meta-row">
                <span className={`curso-player-chip ${vistaLocal ? "curso-player-chip--verde" : "curso-player-chip--laranja"}`}>
                  <span className="dot" />
                  {vistaLocal ? "Concluída" : "Em andamento"}
                </span>
              </div>
            </div>
            <div className="curso-player-nav">
              <button
                className="curso-player-btn"
                disabled={!anteriorId}
                onClick={() => anteriorId && router.push(`/cursos/aula/${anteriorId}`)}
              >
                <ChevronLeft size={14} />
                Anterior
              </button>
              <button
                className="curso-player-btn curso-player-btn--primario"
                disabled={pendente}
                onClick={handleConcluirAvancar}
              >
                <Check size={14} />
                {proximoId ? "Concluir e avançar" : "Concluir aula"}
              </button>
            </div>
          </div>

          {/* Abas */}
          <div className="curso-player-tabs">
            <button
              className={`curso-player-tab${aba === "sobre" ? " curso-player-tab--ativa" : ""}`}
              onClick={() => setAba("sobre")}
            >
              Sobre a aula
            </button>
            <button
              className={`curso-player-tab${aba === "materiais" ? " curso-player-tab--ativa" : ""}`}
              onClick={() => setAba("materiais")}
            >
              Materiais
              {materiais.length > 0 && (
                <span className="curso-player-tab-count">{materiais.length}</span>
              )}
            </button>
            <button
              className={`curso-player-tab${aba === "anotacoes" ? " curso-player-tab--ativa" : ""}`}
              onClick={() => setAba("anotacoes")}
            >
              Anotações
              {anotacoes.length > 0 && (
                <span className="curso-player-tab-count">{anotacoes.length}</span>
              )}
            </button>
          </div>

          <div className="curso-player-tab-content">
            {aba === "sobre" && (
              aulaDescricaoHtml.trim() ? (
                <div
                  className="curso-descricao"
                  dangerouslySetInnerHTML={{ __html: aulaDescricaoHtml }}
                />
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  Nenhuma descrição disponível para esta aula.
                </p>
              )
            )}

            {aba === "materiais" && (
              materiais.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  Nenhum material disponível para esta aula.
                </p>
              ) : (
                <div>
                  {materiais.map((m) => (
                    <div key={m.id} className="curso-material-item">
                      <span className="curso-material-icone">
                        <IconeMime mime={m.mime} />
                      </span>
                      <div className="curso-material-info">
                        <div className="curso-material-nome">{m.nome}</div>
                        {(m.mime || m.tamanhoBytes) && (
                          <div className="curso-material-meta">
                            {m.mime.split("/").pop()?.toUpperCase()}
                            {m.tamanhoBytes ? ` · ${formatarTamanho(m.tamanhoBytes)}` : ""}
                          </div>
                        )}
                      </div>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="curso-material-dl-btn"
                        download={m.nome}
                      >
                        <Download size={13} />
                        Baixar
                      </a>
                    </div>
                  ))}
                </div>
              )
            )}

            {aba === "anotacoes" && (
              <TabAnotacoes
                aulaId={aulaId}
                anotacoes={anotacoes}
                onCriar={(nova) => setAnotacoes((prev) => [...prev, nova])}
                onEditar={(id, texto) =>
                  setAnotacoes((prev) =>
                    prev.map((a) => (a.id === id ? { ...a, conteudoMd: texto } : a)),
                  )
                }
                onExcluir={(id) => setAnotacoes((prev) => prev.filter((a) => a.id !== id))}
              />
            )}
          </div>
        </div>

        {/* ── Rail direito ── */}
        <aside className="curso-player-rail">
          {/* Card 1: progresso */}
          <div className="curso-rail-prog-card">
            <div className="curso-rail-prog-header">
              <span className="curso-rail-chip">Trilha</span>
              <span className="curso-rail-aula-counter">
                aula {aulaOrdem} de {total}
              </span>
            </div>
            <p className="curso-rail-modulo-nome">{moduloNome}</p>
            <div className="curso-rail-barra-trilho">
              <div className="curso-rail-barra-fill" style={{ width: `${percentual}%` }} />
            </div>
            <div className="curso-rail-stats">
              {percentual}% concluído · {vistas} de {total} {total === 1 ? "aula" : "aulas"}
            </div>
          </div>

          {/* Card 2: lista de aulas */}
          <div className="curso-rail-list-card">
            <div className="curso-rail-list-header">
              <GraduationCap size={14} />
              Aulas da trilha
            </div>
            <ul className="curso-rail-aulas-lista">
              {aulasComStatus.map((a, i) => {
                const eAtual = a.id === aulaId;
                return (
                  <li key={a.id} className="curso-rail-aula-li">
                    <Link
                      href={`/cursos/aula/${a.id}`}
                      className={`curso-rail-aula-item${eAtual ? " curso-rail-aula-item--atual" : ""}`}
                    >
                      <span
                        className={`curso-rail-aula-status ${
                          a.vista
                            ? "curso-rail-aula-status--vista"
                            : eAtual
                              ? "curso-rail-aula-status--atual"
                              : "curso-rail-aula-status--pendente"
                        }`}
                      >
                        {a.vista ? <Check size={11} strokeWidth={3} /> : i + 1}
                      </span>
                      <div className="curso-rail-aula-info">
                        <span className="curso-rail-aula-titulo">{a.titulo}</span>
                        {eAtual && (
                          <span className="curso-rail-aula-meta">
                            <Clock size={10} />
                            assistindo
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
