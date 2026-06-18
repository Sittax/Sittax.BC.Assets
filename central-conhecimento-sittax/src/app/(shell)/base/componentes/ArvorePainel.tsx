"use client";

import Link from "next/link";
import { FileArchive } from "lucide-react";
import type { ModuloComTopicos } from "@/lib/conteudo/consultas";
import type { Papel } from "@/lib/db/rls";
import { ArvoreEdicao } from "./ArvoreEdicao";

/** Coluna fixa da árvore (decisão do PO 2026-06-12: sem recolhimento),
 *  travada à esquerda com altura total abaixo da top bar. */
export function ArvorePainel({
  arvore,
  slugAtual,
  ancestraisIds,
  papel,
  produtoId,
  modoEdicao = false,
  onAtualizar,
  onNovoTopico,
}: {
  arvore: ModuloComTopicos[];
  slugAtual: string;
  ancestraisIds: Set<string>;
  papel?: Papel;
  produtoId?: string;
  modoEdicao?: boolean;
  onAtualizar?: () => void;
  onNovoTopico?: (slug: string) => void;
}) {
  return (
    <aside
      className={`arvore-painel${modoEdicao ? " arvore-painel--edicao" : ""}`}
    >
      <ArvoreEdicao
        arvore={arvore}
        produtoId={produtoId}
        slugAtual={slugAtual}
        ancestraisIds={ancestraisIds}
        papel={papel}
        modoEdicao={modoEdicao}
        onAtualizar={onAtualizar}
        onNovoTopico={onNovoTopico}
      />

      {(papel === "suporte" || papel === "dev" || papel === "master") && (
        <Link href="/base/importar" className="arvore-importar-link">
          <FileArchive size={13} />
          Importar Markdown
        </Link>
      )}
    </aside>
  );
}
