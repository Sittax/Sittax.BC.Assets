import Link from "next/link";
import type { Trilha } from "@/lib/conteudo/consultas";

export function Breadcrumb({
  nomeProduto,
  nomeModulo,
  trilha,
}: {
  nomeProduto: string;
  nomeModulo: string;
  trilha: Trilha[];
}) {
  return (
    <nav className="breadcrumb" aria-label="Localização">
      <ol className="breadcrumb-lista">
        <li className="breadcrumb-item">
          <Link href="/base" className="breadcrumb-link">
            {nomeProduto}
          </Link>
        </li>
        <li className="breadcrumb-separador" aria-hidden>›</li>
        <li className="breadcrumb-item breadcrumb-item--modulo">
          {nomeModulo}
        </li>
        {trilha.map((item, i) => (
          <>
            <li key={`sep-${i}`} className="breadcrumb-separador" aria-hidden>›</li>
            <li key={item.slug} className="breadcrumb-item">
              <Link href={`/base/${item.slug}`} className="breadcrumb-link">
                {item.titulo}
              </Link>
            </li>
          </>
        ))}
      </ol>
    </nav>
  );
}
