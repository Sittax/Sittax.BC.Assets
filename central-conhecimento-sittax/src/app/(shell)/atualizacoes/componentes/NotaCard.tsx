import Link from "next/link";
import { Pencil } from "lucide-react";
import { MarkdownTopico } from "@/components/markdown/MarkdownTopico";
import type { NotaParaLeitura } from "@/lib/notas/consultas";
import { formatarData } from "@/lib/notas/formatar";

type Props = {
  nota: NotaParaLeitura;
  podeEditar: boolean;
};

export function NotaCard({ nota, podeEditar }: Props) {
  return (
    <article className="nota-card">
      <header className="nota-card-header">
        <div className="nota-card-meta">
          <time className="nota-card-data">{formatarData(nota.data)}</time>
          {nota.versao && <span className="nota-card-versao">v{nota.versao}</span>}
        </div>
        {podeEditar && (
          <Link
            href={`/atualizacoes/${nota.id}/editar`}
            className="curso-card-btn-editar"
          >
            <Pencil size={12} />
            Editar
          </Link>
        )}
      </header>
      <div className="nota-card-conteudo">
        <MarkdownTopico conteudo={nota.conteudo} />
      </div>
    </article>
  );
}
