"use client";

import type { ItemIndice } from "@/lib/conteudo/indice";

/** Índice "nesta página" (H1/H2), coluna sticky à direita do card. */
export function IndicePagina({ itens }: { itens: ItemIndice[] }) {
  if (itens.length < 2) return null;

  // Scroll programático: o comportamento nativo do hash falha quando o hash
  // já está na URL (clicar 2x no mesmo item) — rolamos sempre, com offset
  // garantido pelo scroll-margin-top dos headings
  const irPara = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const alvo = document.getElementById(id);
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <aside className="indice-pagina" aria-label="Nesta página">
      <p className="indice-titulo">Nesta página</p>
      <ul className="indice-lista">
        {itens.map((item) => (
          <li key={item.id} className={`indice-item indice-item--h${item.nivel}`}>
            <a href={`#${item.id}`} onClick={(e) => irPara(e, item.id)}>
              {item.texto}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
