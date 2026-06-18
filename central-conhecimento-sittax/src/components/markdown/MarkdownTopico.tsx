"use client";

import ReactMarkdown from "react-markdown";
import remarkDirective from "remark-directive";
import type { Plugin } from "unified";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import GithubSlugger from "github-slugger";

/**
 * Renderizador de markdown saneado pelo servidor (MD já passou por
 * sanitizarMarkdown — o cliente nunca recebe o que não pode ver).
 * Mapeia directives para blocos visuais; sem HTML bruto (research R10).
 */

interface DirectiveNode {
  type: string;
  name?: string;
  children?: DirectiveNode[];
  data?: Record<string, unknown>;
}

/** Plugin remark que anota as container directives com classes CSS via hast. */
const remarkDirectiveToHast: Plugin<[], Root> = () => (tree) => {
  visit(tree, ["containerDirective"], (node) => {
    const n = node as unknown as DirectiveNode;
    if (!n.data) n.data = {};
    n.data.hName = "div";
    n.data.hProperties = { className: [`diretiva-${n.name ?? "bloco"}`] };
  });
};

function NotaInterna({ children }: { children: React.ReactNode }) {
  return (
    <div className="bloco-nota-interna" role="note" aria-label="Nota interna">
      <span className="bloco-rotulo">Nota interna</span>
      <div className="bloco-conteudo">{children}</div>
    </div>
  );
}

function NotaTecnica({ children }: { children: React.ReactNode }) {
  return (
    <div className="bloco-nota-tecnica" role="note" aria-label="Nota técnica">
      <span className="bloco-rotulo">Nota técnica</span>
      <div className="bloco-conteudo">{children}</div>
    </div>
  );
}

/** Texto plano de uma árvore de children React (headings, URL do vídeo). */
function textoDe(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textoDe).join("");
  if (children && typeof children === "object" && "props" in children) {
    return textoDe(
      (children as { props: { children?: React.ReactNode } }).props.children,
    );
  }
  return "";
}

function VideoEmbed({ children }: { children: React.ReactNode }) {
  // String(children) virava "[object Object]" (URL relativa → o app dentro
  // do próprio iframe); extrai o TEXTO e valida URL absoluta http(s)
  const url = textoDe(children).trim();

  const yt = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/,
  );

  let src: string | null = null;
  if (yt) {
    src = `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  } else {
    try {
      const u = new URL(url);
      if (u.protocol === "https:" || u.protocol === "http:") src = url;
    } catch {
      src = null;
    }
  }

  if (!src) {
    return (
      <div className="bloco-video bloco-video--invalido" role="note">
        <span className="bloco-rotulo">Vídeo</span>
        URL de vídeo inválida{url ? `: ${url}` : ""} — informe um link completo
        (https://…).
      </div>
    );
  }

  return (
    <div className="bloco-video">
      <iframe
        src={src}
        className="video-embed"
        allowFullScreen
        title="Vídeo incorporado"
        loading="lazy"
      />
    </div>
  );
}

export function MarkdownTopico({ conteudo }: { conteudo: string }) {
  // Conteúdo legado salvo antes da normalização do editor pode conter
  // `<br />` literal (parágrafo vazio serializado pelo Milkdown) — sem
  // renderização de HTML cru (decisão R10), removemos na exibição.
  const conteudoLimpo = conteudo
    .replace(/^[ \t]*<br\s*\/?>[ \t]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");

  // Âncoras de H1/H2 (índice da página): mesma sequência de slugs do
  // extrairIndice (src/lib/conteudo/indice.ts) — ordem do documento
  const slugger = new GithubSlugger();

  return (
    <div className="markdown-topico">
      <ReactMarkdown
        remarkPlugins={[remarkDirective, remarkDirectiveToHast]}
        components={{
          h1({ children }) {
            return <h1 id={slugger.slug(textoDe(children))}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 id={slugger.slug(textoDe(children))}>{children}</h2>;
          },
          // Mapeia divs com classes das directives para componentes visuais
          div({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
            if (className === "diretiva-nota-interna") {
              return <NotaInterna>{children}</NotaInterna>;
            }
            if (className === "diretiva-nota-tecnica") {
              return <NotaTecnica>{children}</NotaTecnica>;
            }
            if (className === "diretiva-video") {
              return <VideoEmbed>{children}</VideoEmbed>;
            }
            return <div className={className} {...props}>{children}</div>;
          },
        }}
      >
        {conteudoLimpo}
      </ReactMarkdown>
    </div>
  );
}
