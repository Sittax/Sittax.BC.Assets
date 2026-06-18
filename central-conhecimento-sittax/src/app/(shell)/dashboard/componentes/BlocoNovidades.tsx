import Link from "next/link";
import { Megaphone } from "lucide-react";
import { MarkdownTopico } from "@/components/markdown/MarkdownTopico";
import type { NotaParaLeitura } from "@/lib/notas/consultas";
import { formatarData } from "@/lib/notas/formatar";

type Props = {
  temProduto: boolean;
  notas: NotaParaLeitura[];
};

export function BlocoNovidades({ temProduto, notas }: Props) {
  return (
    <section className="dash-bloco">
      <div className="dash-bloco-header">
        <h2 className="dash-bloco-titulo">Novidades</h2>
        {temProduto && notas.length > 0 && (
          <Link href="/atualizacoes" className="dash-ver-todas">
            ver todas
          </Link>
        )}
      </div>

      {!temProduto ? (
        <p className="dash-vazio">Selecione um produto no seletor acima.</p>
      ) : notas.length === 0 ? (
        <p className="dash-vazio">
          <Megaphone size={14} /> Nenhuma novidade publicada para este produto.
        </p>
      ) : (
        <ul className="dash-novidades-lista">
          {notas.map((n) => (
            <li key={n.id} className="dash-novidade">
              <div className="dash-novidade-meta">
                <span className="dash-novidade-data">{formatarData(n.data)}</span>
                {n.versao && (
                  <span className="dash-novidade-versao">v{n.versao}</span>
                )}
              </div>
              <div className="dash-novidade-conteudo">
                <MarkdownTopico conteudo={n.conteudo} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
