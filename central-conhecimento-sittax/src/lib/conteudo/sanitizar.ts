import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import remarkStringify from "remark-stringify";
import { visit } from "unist-util-visit";
import type { Node, Parent } from "unist";
import type { Papel } from "@/lib/db/rls";

const BLOCOS_INTERNOS = new Set(["nota-interna", "nota-tecnica"]);

/**
 * Remove nós `nota-interna` e `nota-tecnica` quando papel = 'padrao'.
 * Fail-closed (R1/FR-014): directive mal-formada não fecha o nó — o conteúdo
 * fica dentro do nó removido e nunca vaza para papel padrão.
 */
function transformarRemoverInternos() {
  return (tree: Node) => {
    visit(tree, "containerDirective", (node, index, parent) => {
      const n = node as { name?: string };
      if (BLOCOS_INTERNOS.has(n.name ?? "") && parent && index !== undefined) {
        (parent as Parent).children.splice(index, 1);
        return index;
      }
    });
  };
}

/**
 * FUNÇÃO ÚNICA de sanitização (Constituição III / research R1).
 * Pura: string → string. Todo ponto de saída de conteúdo a invoca.
 * Para papel padrão: remove nota-interna e nota-tecnica do AST antes de
 * serializar. Para suporte/dev/master: retorna o markdown inalterado.
 */
export function sanitizarMarkdown(md: string, papel: Papel | "system"): string {
  if (papel === "padrao") {
    const result = unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(transformarRemoverInternos)
      .use(remarkStringify)
      .processSync(md);
    return String(result);
  }
  return md;
}
