import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";
import { formatarData } from "@/lib/notas/formatar";
import type { NotaParaLeitura } from "@/lib/notas/consultas";

type Props = {
  temProduto: boolean;
  notas: NotaParaLeitura[];
};

export function BlocoFeed({ temProduto, notas }: Props) {
  return (
    <div className="dash-feed-card">
      <div className="sec-head" style={{ marginBottom: 6 }}>
        <span className="sec-ico">
          <Megaphone size={15} />
        </span>
        <h3>Atualizações recentes</h3>
      </div>

      {!temProduto ? (
        <p className="dash-vazio">Selecione um produto no seletor acima.</p>
      ) : notas.length === 0 ? (
        <p className="dash-vazio">
          Nenhuma novidade publicada para este produto.
        </p>
      ) : (
        <>
          {notas.map((n) => (
            <Link
              key={n.id}
              href="/atualizacoes"
              className="dash-feed-item"
              style={{ display: "flex", gap: 11, padding: "12px 0", borderBottom: "1px solid var(--border)", textDecoration: "none" }}
            >
              {n.versao && (
                <span className="dash-feed-chip">{n.versao}</span>
              )}
              <div className="dash-feed-body">
                <div className="dash-feed-ttl">
                  {/* extrai primeira linha de markdown como título */}
                  {n.conteudo.replace(/^#+\s*/m, "").split("\n")[0].slice(0, 80)}
                </div>
                <div className="dash-feed-sub">
                  {n.produtoNome} · {formatarData(n.data)}
                </div>
              </div>
            </Link>
          ))}
          <Link href="/atualizacoes" className="dash-feed-ver-todas">
            Ver todas as atualizações <ArrowRight size={13} />
          </Link>
        </>
      )}
    </div>
  );
}
