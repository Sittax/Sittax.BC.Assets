import Link from "next/link";
import { GraduationCap, PlayCircle } from "lucide-react";
import type { CardContinuar, EadDisponivel } from "@/lib/dashboard/consultas";

type Props = {
  temProduto: boolean;
  cards: CardContinuar[];
  sugestoes: EadDisponivel[];
};

const THUMB_TONS = ["--a", "--b", "--c", "--d"] as const;

export function BlocoContinuar({ temProduto, cards, sugestoes }: Props) {
  return (
    <section>
      <div className="sec-head">
        <span className="sec-ico">
          <GraduationCap size={16} />
        </span>
        <h3>Continuar estudando</h3>
        <Link href="/cursos" className="sec-more">
          Ver trilhas <PlayCircle size={13} />
        </Link>
      </div>

      {!temProduto ? (
        <p className="dash-vazio">Selecione um produto no seletor acima.</p>
      ) : cards.length > 0 ? (
        <div className="dash-ead-scroll">
          {cards.map((c, i) => {
            const ton = THUMB_TONS[i % THUMB_TONS.length];
            const href = c.retomadaAulaId
              ? `/cursos/aula/${c.retomadaAulaId}`
              : `/cursos/${c.moduloId}`;
            return (
              <Link key={c.moduloId} href={href} className="dash-ead-card">
                <div className={`dash-ead-thumb dash-ead-thumb${c.capaUrl ? "" : ton}`}>
                  {c.capaUrl ? (
                    <img src={c.capaUrl} alt="" />
                  ) : (
                    <GraduationCap size={30} strokeWidth={1.5} />
                  )}
                  {c.produtoNome && (
                    <span className="dash-ead-thumb-chip">{c.produtoNome}</span>
                  )}
                </div>
                <div className="dash-ead-corpo">
                  <div className="dash-ead-titulo">{c.nome}</div>
                  {c.totalAulas > 0 && (
                    <div className="dash-ead-aula-label">
                      Aula {Math.min(c.aulasVistas + 1, c.totalAulas)} de {c.totalAulas}
                    </div>
                  )}
                  <div className="dash-ead-prog">
                    <i style={{ width: `${c.percentual}%` }} />
                  </div>
                  <div className="dash-ead-rodape">
                    <span className="dash-ead-pct">
                      <span className="dash-ead-pct-dot" />
                      {c.percentual}%
                    </span>
                    <span className="dash-ead-continuar">
                      Continuar <PlayCircle size={13} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : sugestoes.length > 0 ? (
        <>
          <p className="dash-vazio">
            Nenhum curso em andamento. Que tal começar por um destes?
          </p>
          <ul className="dash-sugestoes-lista">
            {sugestoes.map((s) => (
              <li key={s.moduloId}>
                <Link href={`/cursos/${s.moduloId}`} className="dash-sugestao-link">
                  <GraduationCap size={14} />
                  {s.nome}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="dash-vazio">
          Nenhum curso disponível neste produto por enquanto.
        </p>
      )}
    </section>
  );
}
