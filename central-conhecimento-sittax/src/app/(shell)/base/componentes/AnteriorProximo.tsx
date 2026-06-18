import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function AnteriorProximo({
  anterior,
  proximo,
}: {
  anterior: { slug: string; titulo: string } | null;
  proximo: { slug: string; titulo: string } | null;
}) {
  return (
    <nav className="anterior-proximo" aria-label="Navegação entre tópicos">
      <div className="anterior-proximo-esquerda">
        {anterior ? (
          <Link href={`/base/${anterior.slug}`} className="nav-btn nav-btn--anterior">
            <ChevronLeft size={16} aria-hidden />
            <span>{anterior.titulo}</span>
          </Link>
        ) : (
          <span className="nav-btn nav-btn--desabilitado">
            <ChevronLeft size={16} aria-hidden />
            <span>Início</span>
          </span>
        )}
      </div>
      <div className="anterior-proximo-direita">
        {proximo ? (
          <Link href={`/base/${proximo.slug}`} className="nav-btn nav-btn--proximo">
            <span>{proximo.titulo}</span>
            <ChevronRight size={16} aria-hidden />
          </Link>
        ) : (
          <span className="nav-btn nav-btn--desabilitado">
            <span>Fim</span>
            <ChevronRight size={16} aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
