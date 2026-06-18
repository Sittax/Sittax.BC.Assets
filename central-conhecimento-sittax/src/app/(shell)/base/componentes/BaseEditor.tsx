"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarTopico } from "@/lib/actions/topicos";
import type { ModuloComTopicos, Trilha } from "@/lib/conteudo/consultas";
import type { Papel } from "@/lib/db/rls";
import { ArvorePainel } from "./ArvorePainel";
import { EditorConteudo } from "./EditorTopico";
import { IndicePagina } from "./IndicePagina";
import { limparMarkdownEditor } from "./diretivasMilkdown";
import { extrairIndice } from "@/lib/conteudo/indice";
import { Breadcrumb } from "./Breadcrumb";
import { AnteriorProximo } from "./AnteriorProximo";
import { MarkdownTopico } from "@/components/markdown/MarkdownTopico";

interface AnteriorProximoItem {
  titulo: string;
  slug: string;
}

interface BaseEditorProps {
  // Tópico atual
  topicoId: string;
  slug: string;
  titulo: string;
  conteudoMd: string;
  conteudoSaneado: string;
  // Árvore
  arvore: ModuloComTopicos[];
  ancestraisIds: Set<string>;
  produtoId: string;
  papel: Papel;
  // Navegação
  nomeProduto: string;
  nomeModulo: string;
  trilha: Trilha[];
  anteriorProximo: {
    anterior: AnteriorProximoItem | null;
    proximo: AnteriorProximoItem | null;
  };
  // Estado inicial
  iniciarEditando: boolean;
}

export function BaseEditor({
  topicoId,
  slug,
  titulo,
  conteudoMd,
  conteudoSaneado,
  arvore,
  ancestraisIds,
  produtoId,
  papel,
  nomeProduto,
  nomeModulo,
  trilha,
  anteriorProximo,
  iniciarEditando,
}: BaseEditorProps) {
  const [editando, setEditando] = useState(iniciarEditando);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const conteudoEditRef = useRef(conteudoMd);
  const tituloEditRef = useRef(titulo);
  const router = useRouter();

  const podeEditar = papel === "suporte" || papel === "dev" || papel === "master";
  const indice = extrairIndice(conteudoSaneado);

  const entrarEdicao = () => {
    // Reseta refs com o conteúdo atual (pode ter atualizado via router.refresh)
    conteudoEditRef.current = conteudoMd;
    tituloEditRef.current = titulo;
    setErroSalvar(null);
    setEditando(true);
    router.replace(`/base/${slug}?modo=editar`, { scroll: false });
  };

  const sairEdicao = () => {
    setEditando(false);
    setErroSalvar(null);
    router.replace(`/base/${slug}`, { scroll: false });
  };

  const salvar = async () => {
    setSalvando(true);
    setErroSalvar(null);
    const r = await salvarTopico({
      id: topicoId,
      titulo: tituloEditRef.current,
      conteudoMd: limparMarkdownEditor(conteudoEditRef.current),
    });
    setSalvando(false);
    if (r.ok) {
      router.refresh();
      sairEdicao();
    } else {
      setErroSalvar(r.mensagem);
    }
  };

  return (
    <div className="base-layout">
      {/* Coluna fixa da árvore */}
      <ArvorePainel
        arvore={arvore}
        slugAtual={slug}
        ancestraisIds={ancestraisIds}
        papel={papel}
        produtoId={produtoId}
        modoEdicao={editando}
        onAtualizar={() => router.refresh()}
        onNovoTopico={(novoSlug) => {
          router.push(`/base/${novoSlug}?modo=editar`);
        }}
      />

      {/* Conteúdo — card branco sobre o fundo cinza da página */}
      <article className="base-conteudo">
        <div className="base-card">
        {/* Cabeçalho do card: breadcrumb + ações */}
        <div className="base-card-header">
          {editando ? (
            <div className="barra-edicao barra-edicao--ativa">
              <span className="barra-edicao-label">Modo de edição</span>
              <div className="barra-edicao-acoes">
                {erroSalvar && <span className="editor-erro">{erroSalvar}</span>}
                <button className="barra-edicao-cancelar" onClick={sairEdicao} disabled={salvando}>
                  Cancelar
                </button>
                <button className="barra-edicao-salvar login-botao" onClick={salvar} disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <Breadcrumb
                nomeProduto={nomeProduto}
                nomeModulo={nomeModulo}
                trilha={trilha.slice(0, -1)}
              />
              {podeEditar && (
                <button className="botao-editar" onClick={entrarEdicao}>
                  Editar
                </button>
              )}
            </>
          )}
        </div>

        {/* Conteúdo: modo leitura ou edição */}
        {editando ? (
          <EditorConteudo
            conteudoInicial={conteudoMd}
            tituloInicial={titulo}
            papel={papel}
            conteudoRef={conteudoEditRef}
            tituloRef={tituloEditRef}
          />
        ) : (
          <>
            <MarkdownTopico conteudo={conteudoSaneado} />
            <AnteriorProximo
              anterior={anteriorProximo.anterior}
              proximo={anteriorProximo.proximo}
            />
          </>
        )}
        </div>

        {/* Índice "nesta página" (H1/H2) — só em leitura, à direita do card */}
        {!editando && <IndicePagina itens={indice} />}
      </article>
    </div>
  );
}
