"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { history } from "@milkdown/plugin-history";
import { clipboard } from "@milkdown/plugin-clipboard";
import { replaceAll } from "@milkdown/utils";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { salvarTopico } from "@/lib/actions/topicos";
import type { Papel } from "@/lib/db/rls";
import { diretivasMilkdown, limparMarkdownEditor } from "./diretivasMilkdown";

// ─── Tipos compartilhados ─────────────────────────────────────────────────────

interface SlashCmd {
  id: string;
  label: string;
  desc: string;
  icon: string;
  template: string;
  somenteDevMais?: boolean;
}

const SLASH_CMDS: SlashCmd[] = [
  { id: "h1",          label: "Título 1",        desc: "Seção principal",          icon: "H1",  template: "# "                     },
  { id: "h2",          label: "Título 2",        desc: "Subseção",                 icon: "H2",  template: "## "                    },
  { id: "h3",          label: "Título 3",        desc: "Subseção menor",           icon: "H3",  template: "### "                   },
  { id: "lista",       label: "Lista",           desc: "Lista com marcadores",     icon: "•",   template: "- "                     },
  { id: "listanum",    label: "Lista numerada",  desc: "Lista com números",        icon: "1.",  template: "1. "                    },
  { id: "notainterna", label: "Nota Interna",    desc: "Visível só para suporte+", icon: "🔒",  template: ":::nota-interna\nEscreva a nota aqui\n:::" },
  { id: "notatecnica", label: "Nota Técnica",    desc: "Visível só para dev/master", icon: "⚙", template: ":::nota-tecnica\nEscreva a nota aqui\n:::", somenteDevMais: true },
  { id: "video",       label: "Vídeo",           desc: "Incorporar vídeo por URL", icon: "▶",   template: ":::video\nhttps://\n:::" },
];

interface SlashMenuState {
  lineIndex: number;
  query: string;
  selecionado: number;
  opcoes: SlashCmd[];
}

// ─── EditorConteudo: editor puro (sem controles de salvar/cancelar) ───────────
// Usado tanto pelo EditorTopico standalone quanto pelo BaseEditor integrado.

export interface EditorConteudoProps {
  conteudoInicial: string;
  tituloInicial: string;
  papel: Papel;
  /** Refs compartilhados com o pai para leitura no momento de salvar */
  conteudoRef: React.MutableRefObject<string>;
  tituloRef: React.MutableRefObject<string>;
}

function EditorConteudoInterior({
  conteudoInicial,
  tituloInicial,
  papel,
  conteudoRef,
  tituloRef,
}: EditorConteudoProps) {
  const [, get] = useInstance();
  const [titulo, setTitulo] = useState(tituloInicial);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<SlashMenuState | null>(null);
  slashMenuRef.current = slashMenu;

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, conteudoInicial);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          conteudoRef.current = markdown;

          const lines = markdown.split("\n");
          let found: { lineIndex: number; query: string } | null = null;
          for (let i = lines.length - 1; i >= 0; i--) {
            if (/^\/[a-z0-9]*$/.test(lines[i].trim())) {
              found = { lineIndex: i, query: lines[i].trim().slice(1) };
              break;
            }
          }

          if (found) {
            const devMais = papel === "dev" || papel === "master";
            const q = found.query.toLowerCase();
            const opcoes = SLASH_CMDS.filter(
              (c) => (!c.somenteDevMais || devMais) &&
                (q === "" || c.id.startsWith(q) || c.label.toLowerCase().includes(q)),
            );
            setSlashMenu({ ...found, selecionado: 0, opcoes });
          } else {
            setSlashMenu(null);
          }
        });
      })
      .use(commonmark)
      .use(listener)
      .use(history)
      .use(clipboard)
      .use(diretivasMilkdown),
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const menu = slashMenuRef.current;
      if (!menu) return;
      if (e.key === "ArrowDown") {
        e.preventDefault(); e.stopPropagation();
        setSlashMenu((m) => m ? { ...m, selecionado: Math.min(m.selecionado + 1, m.opcoes.length - 1) } : m);
      } else if (e.key === "ArrowUp") {
        e.preventDefault(); e.stopPropagation();
        setSlashMenu((m) => m ? { ...m, selecionado: Math.max(m.selecionado - 1, 0) } : m);
      } else if (e.key === "Enter") {
        const opcao = menu.opcoes[menu.selecionado];
        if (opcao) { e.preventDefault(); e.stopPropagation(); executarComando(menu, opcao); }
      } else if (e.key === "Escape") {
        setSlashMenu(null);
      }
    };
    el.addEventListener("keydown", onKeyDown, true);
    return () => el.removeEventListener("keydown", onKeyDown, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const executarComando = (menu: SlashMenuState, cmd: SlashCmd) => {
    const lines = conteudoRef.current.split("\n");
    lines[menu.lineIndex] = cmd.template;
    const novoConteudo = lines.join("\n");
    conteudoRef.current = novoConteudo;
    setSlashMenu(null);
    get()?.action(replaceAll(novoConteudo));
    setTimeout(() => wrapRef.current?.querySelector<HTMLElement>(".ProseMirror")?.focus(), 30);
  };

  const handleTituloChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitulo(e.target.value);
    tituloRef.current = e.target.value;
  };

  return (
    <div className="editor-conteudo">
      <input
        className="editor-titulo-input"
        value={titulo}
        onChange={handleTituloChange}
        placeholder="Título do tópico"
      />
      <div className="editor-milkdown-wrap" ref={wrapRef}>
        <Milkdown />
        {slashMenu && slashMenu.opcoes.length > 0 && (
          <div className="slash-menu">
            <p className="slash-menu-titulo">Blocos</p>
            {slashMenu.opcoes.map((cmd, i) => (
              <button
                key={cmd.id}
                className={`slash-opcao${i === slashMenu.selecionado ? " slash-opcao-ativa" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); executarComando(slashMenu, cmd); }}
                onMouseEnter={() => setSlashMenu((m) => m ? { ...m, selecionado: i } : m)}
              >
                <span className="slash-icone">{cmd.icon}</span>
                <span className="slash-texto">
                  <span className="slash-label">{cmd.label}</span>
                  <span className="slash-desc">{cmd.desc}</span>
                </span>
              </button>
            ))}
            <p className="slash-menu-dica">
              <kbd>↑↓</kbd> navegar · <kbd>Enter</kbd> inserir · <kbd>Esc</kbd> fechar
            </p>
          </div>
        )}
      </div>
      <p className="editor-hint">
        Digite <kbd>/</kbd> para inserir blocos — títulos, listas, notas e vídeos.
      </p>
    </div>
  );
}

/** Editor puro com MilkdownProvider — para uso no BaseEditor integrado. */
export function EditorConteudo(props: EditorConteudoProps) {
  return (
    <MilkdownProvider>
      <EditorConteudoInterior {...props} />
    </MilkdownProvider>
  );
}

// ─── EditorTopico: página standalone /[slug]/editar ──────────────────────────

interface EditorTopicoProps {
  topicoId: string;
  slug: string;
  tituloInicial: string;
  conteudoInicial: string;
  papel: Papel;
}

function EditorInterior({ topicoId, slug, tituloInicial, conteudoInicial, papel }: EditorTopicoProps) {
  const conteudoRef = useRef(conteudoInicial);
  const tituloRef = useRef(tituloInicial);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const router = useRouter();

  const salvar = async (): Promise<boolean> => {
    setSalvando(true);
    setMensagem(null);
    const result = await salvarTopico({ id: topicoId, titulo: tituloRef.current, conteudoMd: limparMarkdownEditor(conteudoRef.current) });
    setSalvando(false);
    if (result.ok) { setMensagem({ ok: true, texto: "Salvo com sucesso." }); return true; }
    setMensagem({ ok: false, texto: result.mensagem });
    return false;
  };

  const handleUploadImagem = async (file: File) => {
    setMensagem(null);
    const form = new FormData();
    form.append("file", file);
    const resp = await fetch("/api/arquivos", { method: "POST", body: form });
    if (!resp.ok) { setMensagem({ ok: false, texto: "Falha no upload da imagem." }); return; }
    const { id } = await resp.json();
    const novaUrl = `\n![${file.name}](/api/arquivos/${id})\n`;
    conteudoRef.current = conteudoRef.current + novaUrl;
  };

  return (
    <div className="editor-topico">
      <div className="editor-cabecalho">
        <Link href={`/base/${slug}`} className="editor-voltar">← Voltar</Link>
        <div className="editor-acoes">
          <button className="login-botao" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button
            className="login-botao editor-btn-secundario"
            onClick={async () => { if (await salvar()) router.push(`/base/${slug}`); }}
            disabled={salvando}
          >
            Salvar e voltar
          </button>
          <label className="editor-bloco-btn" style={{ cursor: "pointer" }}>
            + Imagem
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadImagem(f); e.target.value = ""; }}
            />
          </label>
        </div>
      </div>

      <EditorConteudoInterior
        conteudoInicial={conteudoInicial}
        tituloInicial={tituloInicial}
        papel={papel}
        conteudoRef={conteudoRef}
        tituloRef={tituloRef}
      />

      {mensagem && <p className={mensagem.ok ? "form-ok" : "editor-erro"}>{mensagem.texto}</p>}
    </div>
  );
}

export function EditorTopico(props: EditorTopicoProps) {
  return (
    <MilkdownProvider>
      <EditorInterior {...props} />
    </MilkdownProvider>
  );
}
