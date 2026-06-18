import Link from "next/link";
import { BookOpen, FileText, Clock, Settings2 } from "lucide-react";
import type { TopicoDestaque } from "@/lib/dashboard/consultas";

type Props = {
  temProduto: boolean;
  destaques: TopicoDestaque[];
  podeEditar?: boolean;
};

const THUMB_TONS = ["--a", "--c", "--d", "--b"] as const;

export function BlocoDestaques({ temProduto, destaques, podeEditar }: Props) {
  if (!temProduto || destaques.length === 0) return null;

  return (
    <section>
      <div className="sec-head">
        <span className="sec-ico">
          <BookOpen size={16} />
        </span>
        <h3>Destaques da base</h3>
        {podeEditar && (
          <Link href="/dashboard/destaques" className="sec-more">
            <Settings2 size={13} />
            Editar
          </Link>
        )}
        <Link href="/base" className="sec-more">
          Explorar base
        </Link>
      </div>

      <div className="dash-base-grid">
        {destaques.map((d, i) => {
          const ton = THUMB_TONS[i % THUMB_TONS.length];
          return (
            <Link
              key={d.id}
              href={`/base/${d.slug}`}
              className="dash-base-card"
            >
              <div className={`dash-base-thumb dash-base-thumb${ton}`}>
                <FileText size={22} strokeWidth={1.5} />
                <span className="dash-base-thumb-chip">{d.moduloNome}</span>
              </div>
              <div className="dash-base-corpo">
                <div className="dash-base-cat">{d.moduloNome}</div>
                <div className="dash-base-titulo">{d.titulo}</div>
                <div className="dash-base-leitura">
                  <Clock size={10} />
                  {d.estimativaMinutos} min de leitura
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
