import Link from "next/link";
import { CheckCircle, Circle, PlayCircle } from "lucide-react";

type Aula = {
  id: string;
  titulo: string;
  ordem: number;
  vista: boolean;
};

type Props = {
  aulas: Aula[];
  aulaAtualId?: string;
};

export function ListaAulas({ aulas, aulaAtualId }: Props) {
  if (aulas.length === 0) {
    return <p className="curso-aulas-vazio">Nenhuma aula neste módulo.</p>;
  }

  return (
    <ul className="curso-aulas-lista">
      {aulas.map((a) => {
        const ativa = aulaAtualId === a.id;
        return (
          <li key={a.id} className={`curso-aula-item${ativa ? " curso-aula-item--ativa" : ""}`}>
            <Link href={`/cursos/aula/${a.id}`} className="curso-aula-link">
              {a.vista ? (
                <CheckCircle size={14} className="curso-aula-icone curso-aula-icone--vista" />
              ) : ativa ? (
                <PlayCircle size={14} className="curso-aula-icone curso-aula-icone--ativa" />
              ) : (
                <Circle size={14} className="curso-aula-icone" />
              )}
              <span className="curso-aula-titulo">{a.titulo}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
