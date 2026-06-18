import remarkDirective from "remark-directive";
import { $node, $remark } from "@milkdown/utils";

/**
 * Directives como NÓS DE BLOCO no editor (WYSIWYG): o remark-directive entra
 * no pipeline do Milkdown, então `:::nota-interna … :::` é editado como um
 * bloco estilizado idêntico ao da leitura — o usuário nunca vê os `:::`.
 * A serialização de volta para a sintaxe `:::` é do próprio remark-directive,
 * então o que vai para o save é o mesmo markdown de sempre (a validação de
 * permissão por directive e a sanitização server-side não mudam).
 */

const ROTULOS: Record<string, string> = {
  "nota-interna": "Nota interna",
  "nota-tecnica": "Nota técnica",
  video: "Vídeo",
};

export const remarkDiretivas = $remark(
  "remarkDirective",
  () => remarkDirective,
);

type MdastDirective = {
  name?: string;
  children?: unknown;
};

export const diretivaNode = $node("containerDirective", () => ({
  group: "block",
  content: "block+",
  defining: true,
  attrs: {
    name: { default: "nota-interna" },
  },
  parseDOM: [
    {
      tag: "div[data-diretiva]",
      getAttrs: (dom) => ({
        name: (dom as HTMLElement).dataset.diretiva ?? "nota-interna",
      }),
    },
  ],
  toDOM: (node) => [
    "div",
    {
      class: `editor-diretiva editor-diretiva--${String(node.attrs.name).replace(/[^a-z-]/g, "")}`,
      "data-diretiva": String(node.attrs.name),
      "data-rotulo": ROTULOS[String(node.attrs.name)] ?? String(node.attrs.name),
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === "containerDirective",
    runner: (state, node, type) => {
      const n = node as unknown as MdastDirective;
      state.openNode(type, { name: n.name ?? "nota-interna" });
      state.next((n.children ?? []) as never);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "containerDirective",
    runner: (state, node) => {
      state.openNode("containerDirective", undefined, {
        name: node.attrs.name,
      });
      state.next(node.content);
      state.closeNode();
    },
  },
}));

/** Plugins prontos para `.use(...)` nos dois editores (tópico e nota). */
export const diretivasMilkdown = [remarkDiretivas, diretivaNode].flat();

/**
 * Normalização do markdown na saída do editor: o Milkdown serializa
 * parágrafo vazio como `<br />` literal — a leitura não renderiza HTML cru
 * (de propósito) e o texto vazava na tela. Em markdown, parágrafo vazio não
 * existe; removemos essas linhas antes de salvar.
 */
export function limparMarkdownEditor(md: string): string {
  return md
    .replace(/^[ \t]*<br\s*\/?>[ \t]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");
}
