"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { history } from "@milkdown/plugin-history";
import { clipboard } from "@milkdown/plugin-clipboard";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import {
  diretivasMilkdown,
  limparMarkdownEditor,
} from "@/app/(shell)/base/componentes/diretivasMilkdown";
import { criarNota, atualizarNota } from "@/lib/actions/release-notes";

type ProdutoOpcao = { id: string; nome: string };

type Props = {
  produtos: ProdutoOpcao[];
  produtoAtivoId: string | null;
  /** Presente = edição; ausente = criação. */
  nota?: {
    id: string;
    produtoId: string;
    data: string;
    versao: string | null;
    conteudoMd: string;
  };
};

function EditorNotaInterior({ produtos, produtoAtivoId, nota }: Props) {
  const hoje = new Date().toISOString().slice(0, 10);
  const conteudoRef = useRef(nota?.conteudoMd ?? "");
  const [produtoId, setProdutoId] = useState(
    nota?.produtoId ?? produtoAtivoId ?? produtos[0]?.id ?? "",
  );
  const [data, setData] = useState(nota?.data ?? hoje);
  const [versao, setVersao] = useState(nota?.versao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, nota?.conteudoMd ?? "");
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          conteudoRef.current = markdown;
        });
      })
      .use(commonmark)
      .use(listener)
      .use(history)
      .use(clipboard)
      .use(diretivasMilkdown),
  );

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    const conteudoMd = limparMarkdownEditor(conteudoRef.current);
    const result = nota
      ? await atualizarNota({
          id: nota.id,
          data,
          versao: versao.trim() || null,
          conteudoMd,
        })
      : await criarNota({
          produtoId,
          data,
          versao: versao.trim() || undefined,
          conteudoMd,
        });
    setSalvando(false);
    if (result.ok) {
      router.push("/atualizacoes");
    } else {
      setErro(result.mensagem);
    }
  };

  return (
    <div className="editor-nota">
      <div className="editor-cabecalho">
        <Link href="/atualizacoes" className="editor-voltar">
          ← Voltar
        </Link>
        <div className="editor-acoes">
          <button className="login-botao" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : nota ? "Salvar alterações" : "Publicar nota"}
          </button>
        </div>
      </div>

      <div className="editor-nota-campos">
        <label className="editor-nota-campo">
          Produto
          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            disabled={Boolean(nota)}
          >
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="editor-nota-campo">
          Data
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label className="editor-nota-campo">
          Versão (opcional)
          <input
            type="text"
            value={versao}
            placeholder="ex.: 2.4.0"
            onChange={(e) => setVersao(e.target.value)}
          />
        </label>
      </div>

      <div className="editor-milkdown-wrap">
        <Milkdown />
      </div>
      <p className="editor-hint">
        Markdown livre — blocos <code>:::nota-interna</code> ficam visíveis só
        para suporte+.
      </p>

      {erro && <p className="editor-erro">{erro}</p>}
    </div>
  );
}

export function EditorNota(props: Props) {
  return (
    <MilkdownProvider>
      <EditorNotaInterior {...props} />
    </MilkdownProvider>
  );
}
