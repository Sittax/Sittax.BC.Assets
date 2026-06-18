import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import remarkStringify from "remark-stringify";
import { visit } from "unist-util-visit";
import type { Node } from "unist";
import type { Root } from "mdast";

interface ContainerDirectiveNode {
  type: "containerDirective";
  name: string;
  children: Node[];
}

/**
 * Serializa um nó `nota-tecnica` normalizado (sem posição/metadata) para
 * comparação determinística por conteúdo.
 */
function serializarNotaTecnica(node: ContainerDirectiveNode): string {
  const syntheticRoot: Root = {
    type: "root",
    children: [node as unknown as Root["children"][number]],
  };
  const result = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkStringify)
    .stringify(syntheticRoot);
  return String(result).trim();
}

/**
 * Extrai todos os blocos `nota-tecnica` do markdown e devolve uma lista de
 * suas representações serializadas (normalizadas). Usada para comparação de
 * multiconjunto no save (research R2).
 */
export function extrairNotasTecnicas(md: string): string[] {
  const tree = unified().use(remarkParse).use(remarkDirective).parse(md);
  const notas: string[] = [];
  visit(tree, "containerDirective", (node) => {
    const n = node as unknown as ContainerDirectiveNode;
    if (n.name === "nota-tecnica") {
      notas.push(serializarNotaTecnica(n));
    }
  });
  return notas;
}

/** Compara dois multiconjuntos de notas técnicas. */
function multiconjuntosIguais(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const contagem = new Map<string, number>();
  for (const s of a) contagem.set(s, (contagem.get(s) ?? 0) + 1);
  for (const s of b) {
    const c = contagem.get(s) ?? 0;
    if (c === 0) return false;
    contagem.set(s, c - 1);
  }
  return true;
}

/**
 * Verifica se suporte está tentando alterar os blocos nota-tecnica.
 * Retorna true se o save deve ser rejeitado.
 */
export function suporteAlterouNotasTecnicas(
  mdAtual: string,
  mdNovo: string,
): boolean {
  const antes = extrairNotasTecnicas(mdAtual);
  const depois = extrairNotasTecnicas(mdNovo);
  return !multiconjuntosIguais(antes, depois);
}
