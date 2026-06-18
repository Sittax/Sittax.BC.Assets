"use client";

import { useState, useRef, useCallback, Fragment } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { ModuloComTopicos, TopicoItem } from "@/lib/conteudo/consultas";
import type { Papel } from "@/lib/db/rls";
import {
  criarTopico,
  excluirTopico,
  renomearTopico,
  reordenarTopicosModulo,
} from "@/lib/actions/topicos";
import {
  criarModulo,
  excluirModulo,
  renomearModulo,
  reordenarModulosBatch,
} from "@/lib/actions/modulos";

type DragKind = "topico" | "modulo";

interface DragState {
  kind: DragKind;
  id: string;
  moduloId?: string;
  ordem: number;
}

interface DropTarget {
  kind: "after-topico" | "after-modulo" | "into-modulo";
  topicoId?: string;
  moduloId: string;
  ordem: number;
}

interface CriandoApos {
  afterId: string | null; // null = append to end of module
  moduloId: string;
  parentId?: string;
}

function flatTopicos(
  items: TopicoItem[],
  moduloId: string,
): { id: string; moduloId: string; ordem: number }[] {
  const result: { id: string; moduloId: string; ordem: number }[] = [];
  function walk(list: TopicoItem[]) {
    list.forEach((t) => {
      result.push({ id: t.id, moduloId, ordem: t.ordem });
      if (t.filhos?.length) walk(t.filhos);
    });
  }
  walk(items);
  return result;
}

// ─── Menu de 3 pontos ──────────────────────────────────────────────────────

function MenuTresPontos({
  onRenomear,
  onExcluir,
}: {
  onRenomear: () => void;
  onExcluir: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fechar = useCallback(() => setAberto(false), []);

  return (
    <div
      className="ae-menu-wrap"
      ref={ref}
      onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) fechar(); }}
    >
      <button
        className="ae-btn-pontos"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto((v) => !v); }}
        title="Opções"
        tabIndex={0}
      >
        ⋯
      </button>
      {aberto && (
        <div className="ae-menu-dropdown">
          <button className="ae-menu-item" onClick={() => { fechar(); onRenomear(); }}>
            Renomear
          </button>
          <button
            className="ae-menu-item ae-menu-item--perigo"
            onClick={() => { fechar(); onExcluir(); }}
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline input ──────────────────────────────────────────────────────────

function InlineInput({
  valorInicial,
  indent = 0,
  onConfirmar,
  onCancelar,
}: {
  valorInicial?: string;
  indent?: number;
  onConfirmar: (nome: string) => void;
  onCancelar: () => void;
}) {
  const [valor, setValor] = useState(valorInicial ?? "");
  return (
    <input
      className="ae-inline-input"
      style={{ marginLeft: indent }}
      autoFocus
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && valor.trim()) onConfirmar(valor.trim());
        if (e.key === "Escape") onCancelar();
      }}
      onBlur={() => { if (valor.trim()) onConfirmar(valor.trim()); else onCancelar(); }}
      placeholder="Nome..."
    />
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

export function ArvoreEdicao({
  arvore,
  produtoId,
  slugAtual,
  ancestraisIds,
  papel,
  modoEdicao = false,
  onAtualizar,
  onNovoTopico,
}: {
  arvore: ModuloComTopicos[];
  produtoId?: string;
  slugAtual: string;
  ancestraisIds: Set<string>;
  papel?: Papel;
  modoEdicao?: boolean;
  onAtualizar?: () => void;
  onNovoTopico?: (slug: string) => void;
}) {
  const podeEditar =
    modoEdicao &&
    (papel === "suporte" || papel === "dev" || papel === "master") &&
    !!produtoId &&
    !!onAtualizar;

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropAlvo, setDropAlvo] = useState<DropTarget | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criandoModulo, setCriandoModulo] = useState(false);
  const [renomeando, setRenomeando] = useState<{
    kind: "topico" | "modulo";
    id: string;
    atual: string;
  } | null>(null);
  const [criandoApos, setCriandoApos] = useState<CriandoApos | null>(null);
  // Colapso de módulos — só visual, não persiste; todos iniciam abertos
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  function toggleModulo(id: string) {
    setColapsados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  // ── Drag ─────────────────────────────────────────────────────────────────

  async function soltarTopico(alvo: DropTarget) {
    if (!drag || drag.kind !== "topico" || !onAtualizar) return;
    setDrag(null);
    setDropAlvo(null);

    const modAlvo = arvore.find((m) => m.id === alvo.moduloId);
    if (!modAlvo) return;
    const todos = flatTopicos(modAlvo.topicos, alvo.moduloId);
    const semArrastado = todos.filter((t) => t.id !== drag.id);
    const idxAlvo = alvo.topicoId ? semArrastado.findIndex((t) => t.id === alvo.topicoId) : -1;
    const inserirEm = idxAlvo + 1;
    const novaLista = [
      ...semArrastado.slice(0, inserirEm),
      { id: drag.id, moduloId: alvo.moduloId, ordem: 0 },
      ...semArrastado.slice(inserirEm),
    ];
    const ordens = novaLista.map((t, i) => ({
      id: t.id,
      novaOrdem: i + 1,
      novoModuloId: t.id === drag.id ? alvo.moduloId : undefined,
    }));
    const r = await reordenarTopicosModulo(ordens);
    if (!r.ok) setErro(r.mensagem);
    else onAtualizar();
  }

  async function soltarModulo(novaOrdem: number) {
    if (!drag || drag.kind !== "modulo" || !onAtualizar) return;
    setDrag(null);
    setDropAlvo(null);
    const semArrastado = arvore.filter((m) => m.id !== drag.id);
    const inserirEm = Math.max(0, Math.min(novaOrdem - 1, semArrastado.length));
    const novaLista = [
      ...semArrastado.slice(0, inserirEm),
      { id: drag.id },
      ...semArrastado.slice(inserirEm),
    ];
    const ordens = novaLista.map((m, i) => ({ id: m.id, novaOrdem: i + 1 }));
    const r = await reordenarModulosBatch(ordens);
    if (!r.ok) setErro(r.mensagem);
    else onAtualizar();
  }

  // ── Ações ─────────────────────────────────────────────────────────────────

  async function confirmarCriarTopico(titulo: string) {
    if (!criandoApos || !onAtualizar) return;
    const { moduloId, parentId } = criandoApos;
    setCriandoApos(null);
    const r = await criarTopico({ moduloId, parentId, titulo });
    if (!r.ok) { setErro(r.mensagem); return; }
    onAtualizar();
    if (r.slug && onNovoTopico) onNovoTopico(r.slug);
  }

  async function confirmarCriarModulo(nome: string) {
    if (!produtoId || !onAtualizar) return;
    setCriandoModulo(false);
    const r = await criarModulo({ produtoId, nome });
    if (!r.ok) { setErro(r.mensagem); return; }
    onAtualizar();
  }

  async function confirmarRenomear(novoNome: string) {
    if (!renomeando || !onAtualizar) return;
    const alvo = renomeando;
    setRenomeando(null);
    const r =
      alvo.kind === "topico"
        ? await renomearTopico({ id: alvo.id, titulo: novoNome })
        : await renomearModulo({ id: alvo.id, nome: novoNome });
    if (!r.ok) { setErro(r.mensagem); return; }
    onAtualizar();
  }

  async function handleExcluirTopico(id: string) {
    if (!onAtualizar) return;
    if (!confirm("Excluir este tópico? Esta ação não pode ser desfeita.")) return;
    const r = await excluirTopico({ id });
    if (!r.ok) setErro(r.mensagem);
    else onAtualizar();
  }

  async function handleExcluirModulo(id: string) {
    if (!onAtualizar) return;
    if (!confirm("Excluir este módulo? Só é possível se estiver vazio.")) return;
    const r = await excluirModulo({ id });
    if (!r.ok) setErro(r.mensagem);
    else onAtualizar();
  }

  // ── Render tópico ─────────────────────────────────────────────────────────

  function renderTopico(
    item: TopicoItem,
    moduloId: string,
    parentId: string | null,
    depth: number,
  ): React.ReactNode {
    const ativo = item.slug === slugAtual;
    const href = modoEdicao ? `/base/${item.slug}?modo=editar` : `/base/${item.slug}`;
    const mostrarFilhos = (item.filhos?.length ?? 0) > 0 && ancestraisIds.has(item.id);
    const estaDragging = drag?.kind === "topico" && drag.id === item.id;
    const isDropAlvo = dropAlvo?.kind === "after-topico" && dropAlvo.topicoId === item.id;
    const inserindoApos =
      podeEditar && criandoApos?.afterId === item.id && criandoApos.moduloId === moduloId;

    return (
      <Fragment key={item.id}>
        <li className={`ae-topico-wrap${ativo ? " ae-topico-wrap--ativo" : ""}`}>
          {/* drop indicator line */}
          {isDropAlvo && drag?.kind === "topico" && <div className="ae-drop-line" />}

          <div
            className={`ae-topico${ativo ? " ae-ativo" : ""}${estaDragging ? " ae-dragging" : ""}`}
            style={{ paddingLeft: depth * 12 + 8 }}
            draggable={podeEditar}
            onDragStart={podeEditar ? (e) => { e.stopPropagation(); setDrag({ kind: "topico", id: item.id, moduloId, ordem: item.ordem }); } : undefined}
            onDragEnd={podeEditar ? () => { setDrag(null); setDropAlvo(null); } : undefined}
            onDragOver={podeEditar ? (e) => { e.preventDefault(); e.stopPropagation(); setDropAlvo({ kind: "after-topico", topicoId: item.id, moduloId, ordem: item.ordem }); } : undefined}
            onDrop={podeEditar ? (e) => { e.preventDefault(); e.stopPropagation(); soltarTopico({ kind: "after-topico", topicoId: item.id, moduloId, ordem: item.ordem }); } : undefined}
          >
            {podeEditar && (
              <span className="ae-drag-handle" title="Arrastar">⠿</span>
            )}

            {renomeando?.id === item.id ? (
              <InlineInput
                valorInicial={item.titulo}
                onConfirmar={confirmarRenomear}
                onCancelar={() => setRenomeando(null)}
              />
            ) : (
              <Link href={href} className="ae-topico-link" onClick={(e) => e.stopPropagation()}>
                {item.titulo}
              </Link>
            )}

            {podeEditar && (
              <div className="ae-topico-acoes">
                <MenuTresPontos
                  onRenomear={() => setRenomeando({ kind: "topico", id: item.id, atual: item.titulo })}
                  onExcluir={() => handleExcluirTopico(item.id)}
                />
              </div>
            )}
          </div>

          {/*
           * Insert zone: zero height, absolutely positioned at the bottom
           * edge of this li. Does NOT occupy space in the flow.
           * The li's ::after pseudo-element (CSS) extends hover detection
           * 8px below so the zone stays visible when cursor dips below the row.
           */}
          {podeEditar && !drag && (
            <div className="ae-insert-zone">
              <div className="ae-insert-line" />
              <button
                className="ae-insert-btn"
                title="Adicionar página aqui"
                onClick={(e) => {
                  e.stopPropagation();
                  setCriandoApos({ afterId: item.id, moduloId, parentId: parentId ?? undefined });
                }}
              >
                +
              </button>
              <div className="ae-insert-line" />
            </div>
          )}
        </li>

        {/* Inline input — in flow only while actively creating */}
        {inserindoApos && (
          <li className="ae-criando-item" style={{ paddingLeft: depth * 12 + 8 }}>
            <InlineInput
              onConfirmar={confirmarCriarTopico}
              onCancelar={() => setCriandoApos(null)}
            />
          </li>
        )}

        {/* Children */}
        {mostrarFilhos && (
          <ul className="ae-filhos-lista">
            {item.filhos!.map((filho) =>
              renderTopico(filho, moduloId, item.id, depth + 1),
            )}
          </ul>
        )}
      </Fragment>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ae-root">
      {erro && (
        <div className="ae-erro" role="alert">
          {erro}
          <button className="ae-erro-fechar" onClick={() => setErro(null)}>×</button>
        </div>
      )}

      {arvore.length === 0 && (
        <p className="arvore-vazia">Nenhum módulo ainda.</p>
      )}

      {arvore.map((mod, modIdx) => {
        const estaDragging = drag?.kind === "modulo" && drag.id === mod.id;
        const isDropAlvo = dropAlvo?.kind === "after-modulo" && dropAlvo.moduloId === mod.id;
        const colapsado = colapsados.has(mod.id);

        return (
          <div key={mod.id} className="ae-modulo-wrap">
            {isDropAlvo && drag?.kind === "modulo" && <div className="ae-drop-line" />}

            <div
              className={`ae-modulo${estaDragging ? " ae-dragging" : ""}`}
              role="button"
              aria-expanded={!colapsado}
              onClick={() => {
                if (renomeando?.id === mod.id) return;
                toggleModulo(mod.id);
              }}
              draggable={podeEditar}
              onDragStart={podeEditar ? () => setDrag({ kind: "modulo", id: mod.id, ordem: mod.ordem }) : undefined}
              onDragEnd={podeEditar ? () => { setDrag(null); setDropAlvo(null); } : undefined}
              onDragOver={podeEditar ? (e) => { e.preventDefault(); if (drag?.kind === "modulo") setDropAlvo({ kind: "after-modulo", moduloId: mod.id, ordem: mod.ordem }); } : undefined}
              onDrop={podeEditar ? (e) => { e.preventDefault(); if (drag?.kind === "modulo") soltarModulo(modIdx + 1); } : undefined}
            >
              {podeEditar && (
                <span className="ae-drag-handle" title="Arrastar módulo">⠿</span>
              )}

              <ChevronDown
                size={13}
                className={`ae-modulo-chevron${colapsado ? " ae-modulo-chevron--fechado" : ""}`}
              />

              {renomeando?.id === mod.id ? (
                <InlineInput
                  valorInicial={mod.nome}
                  onConfirmar={confirmarRenomear}
                  onCancelar={() => setRenomeando(null)}
                />
              ) : (
                <span className="ae-modulo-nome">{mod.nome}</span>
              )}

              {podeEditar && (
                <div className="ae-modulo-acoes" onClick={(e) => e.stopPropagation()}>
                  <MenuTresPontos
                    onRenomear={() => setRenomeando({ kind: "modulo", id: mod.id, atual: mod.nome })}
                    onExcluir={() => handleExcluirModulo(mod.id)}
                  />
                </div>
              )}
            </div>

            {!colapsado && (
              <ul
                className="ae-topicos-lista"
                onDragOver={podeEditar ? (e) => { if (drag?.kind === "topico") { e.preventDefault(); setDropAlvo({ kind: "into-modulo", moduloId: mod.id, ordem: mod.topicos.length + 1 }); } } : undefined}
                onDrop={podeEditar ? (e) => { e.preventDefault(); if (drag?.kind === "topico") soltarTopico({ kind: "after-topico", topicoId: undefined, moduloId: mod.id, ordem: mod.topicos.length + 1 }); } : undefined}
              >
                {mod.topicos.map((t) => renderTopico(t, mod.id, null, 0))}
              </ul>
            )}

          </div>
        );
      })}

      {/* Add module */}
      {podeEditar && (
        <div className="ae-add-modulo">
          {criandoModulo ? (
            <InlineInput
              onConfirmar={confirmarCriarModulo}
              onCancelar={() => setCriandoModulo(false)}
            />
          ) : (
            <button className="ae-btn-add-modulo" onClick={() => setCriandoModulo(true)}>
              + Adicionar módulo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
