"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import {
  criarModuloEad,
  renomearModuloEad,
  excluirModuloEad,
  criarAula,
  editarAula,
  excluirAula,
} from "@/lib/actions/ead-gestao";

type AulaItem = {
  id: string;
  titulo: string;
  youtubeId: string;
  descricaoMd: string;
  ordem: number;
};

type ModuloItem = {
  id: string;
  nome: string;
  ordem: number;
  aulas: AulaItem[];
};

type Props = {
  produtoId: string;
  modulosIniciais: ModuloItem[];
};

export function GestaoEad({ produtoId, modulosIniciais }: Props) {
  const [modulos, setModulos] = useState(modulosIniciais);
  const [pending, startTransition] = useTransition();
  const [moduloExpandido, setModuloExpandido] = useState<string | null>(
    modulosIniciais[0]?.id ?? null,
  );
  const [erro, setErro] = useState<string | null>(null);

  // ── Módulos ──────────────────────────────────────────────────────────────────

  function handleCriarModulo() {
    const nome = prompt("Nome do novo módulo:")?.trim();
    if (!nome) return;
    startTransition(async () => {
      const res = await criarModuloEad({ produtoId, nome });
      if (!res.ok) {
        setErro(res.mensagem);
        return;
      }
      window.location.reload();
    });
  }

  function handleRenomearModulo(id: string, nomeAtual: string) {
    const nome = prompt("Novo nome:", nomeAtual)?.trim();
    if (!nome || nome === nomeAtual) return;
    startTransition(async () => {
      const res = await renomearModuloEad({ id, nome });
      if (!res.ok) setErro(res.mensagem);
      else setModulos((prev) =>
        prev.map((m) => (m.id === id ? { ...m, nome } : m)),
      );
    });
  }

  function handleExcluirModulo(id: string) {
    if (!confirm("Excluir este módulo? Ele deve estar vazio.")) return;
    startTransition(async () => {
      const res = await excluirModuloEad({ id });
      if (!res.ok) setErro(res.mensagem);
      else setModulos((prev) => prev.filter((m) => m.id !== id));
    });
  }

  // ── Aulas ────────────────────────────────────────────────────────────────────

  function handleCriarAula(eadModuloId: string) {
    const titulo = prompt("Título da aula:")?.trim();
    if (!titulo) return;
    const youtube = prompt("URL ou ID do YouTube:")?.trim();
    if (!youtube) return;
    startTransition(async () => {
      const res = await criarAula({ eadModuloId, titulo, youtube });
      if (!res.ok) {
        setErro(res.mensagem);
        return;
      }
      window.location.reload();
    });
  }

  function handleEditarAula(id: string, aulaAtual: AulaItem) {
    const titulo = prompt("Título:", aulaAtual.titulo)?.trim();
    const youtube = prompt("URL ou ID do YouTube:", aulaAtual.youtubeId)?.trim();
    if (!titulo && !youtube) return;
    startTransition(async () => {
      const res = await editarAula({
        id,
        ...(titulo ? { titulo } : {}),
        ...(youtube ? { youtube } : {}),
      });
      if (!res.ok) setErro(res.mensagem);
      else
        setModulos((prev) =>
          prev.map((m) => ({
            ...m,
            aulas: m.aulas.map((a) =>
              a.id === id
                ? {
                    ...a,
                    titulo: titulo ?? a.titulo,
                    youtubeId: youtube ?? a.youtubeId,
                  }
                : a,
            ),
          })),
        );
    });
  }

  function handleExcluirAula(id: string) {
    if (!confirm("Excluir esta aula? O progresso dos inscritos será removido.")) return;
    startTransition(async () => {
      const res = await excluirAula({ id });
      if (!res.ok) setErro(res.mensagem);
      else
        setModulos((prev) =>
          prev.map((m) => ({ ...m, aulas: m.aulas.filter((a) => a.id !== id) })),
        );
    });
  }

  return (
    <div>
      {erro && (
        <div className="curso-erro">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="curso-erro-fechar">
            fechar
          </button>
        </div>
      )}

      {modulos.length === 0 && (
        <p className="curso-gestao-vazio">
          Nenhum módulo criado ainda. Crie o primeiro abaixo.
        </p>
      )}

      {modulos.map((m) => (
        <div key={m.id} className="curso-gestao-modulo">
          <div className="curso-gestao-modulo-header">
            <button
              onClick={() =>
                setModuloExpandido((prev) => (prev === m.id ? null : m.id))
              }
              className="curso-gestao-modulo-toggle"
            >
              {moduloExpandido === m.id ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.nome}
              </span>
              <span className="curso-gestao-modulo-count">
                ({m.aulas.length} aulas)
              </span>
            </button>
            <button
              onClick={() => handleRenomearModulo(m.id, m.nome)}
              className="curso-gestao-icone-btn"
              title="Renomear módulo"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => handleExcluirModulo(m.id)}
              className="curso-gestao-icone-btn curso-gestao-icone-btn--perigo"
              title="Excluir módulo (só se vazio)"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {moduloExpandido === m.id && (
            <div className="curso-gestao-aulas-corpo">
              {m.aulas.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Nenhuma aula neste módulo.
                </p>
              )}
              {m.aulas.map((a) => (
                <div key={a.id} className="curso-gestao-aula-row">
                  <GripVertical size={13} style={{ color: "var(--border)", flexShrink: 0 }} />
                  <span className="curso-gestao-aula-titulo">{a.titulo}</span>
                  <span className="curso-gestao-aula-id">{a.youtubeId}</span>
                  <span className="curso-gestao-aula-acoes">
                    <button
                      onClick={() => handleEditarAula(a.id, a)}
                      className="curso-gestao-icone-btn"
                      title="Editar aula"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleExcluirAula(a.id)}
                      className="curso-gestao-icone-btn curso-gestao-icone-btn--perigo"
                      title="Excluir aula"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
              ))}
              <button
                onClick={() => handleCriarAula(m.id)}
                disabled={pending}
                className="curso-gestao-nova-aula"
              >
                <Plus size={12} /> Nova aula
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={handleCriarModulo}
        disabled={pending}
        className="curso-gestao-btn-novo-modulo"
      >
        <Plus size={15} />
        Novo módulo
      </button>
    </div>
  );
}
