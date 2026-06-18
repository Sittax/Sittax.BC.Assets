import GithubSlugger from "github-slugger";

/**
 * Índice da página ("nesta página"): extrai H1/H2 do markdown JÁ SANEADO,
 * com os mesmos slugs que o MarkdownTopico aplica como id nos headings —
 * ambos percorrem os títulos na mesma ordem com o mesmo GithubSlugger.
 */

export type ItemIndice = {
  id: string;
  texto: string;
  nivel: 1 | 2;
};

/** Remove formatação inline básica do texto do título (negrito, código, link). */
function textoLimpo(bruto: string): string {
  return bruto
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

export function extrairIndice(md: string): ItemIndice[] {
  const slugger = new GithubSlugger();
  const itens: ItemIndice[] = [];
  let dentroDeFence = false;

  for (const linha of md.split("\n")) {
    if (/^\s*(```|~~~)/.test(linha)) {
      dentroDeFence = !dentroDeFence;
      continue;
    }
    if (dentroDeFence) continue;

    const m = linha.match(/^(#{1,2})\s+(.+)$/);
    if (!m) continue;

    const texto = textoLimpo(m[2]);
    if (!texto) continue;

    itens.push({
      id: slugger.slug(texto),
      texto,
      nivel: m[1].length as 1 | 2,
    });
  }

  return itens;
}
