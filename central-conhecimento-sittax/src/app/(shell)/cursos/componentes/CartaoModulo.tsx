import { BookOpen } from "lucide-react";
import { ListaAulas } from "./ListaAulas";

type Aula = {
  id: string;
  titulo: string;
  ordem: number;
  vista: boolean;
};

type Props = {
  modulo: { id: string; nome: string; ordem: number; aulas: Aula[] };
  aulaAtualId?: string;
};

export function CartaoModulo({ modulo, aulaAtualId }: Props) {
  const total = modulo.aulas.length;
  const vistas = modulo.aulas.filter((a) => a.vista).length;

  return (
    <div className="curso-modulo-cartao">
      <div className="curso-modulo-titulo">
        <BookOpen size={14} className="curso-aula-icone" />
        <span className="curso-modulo-nome">{modulo.nome}</span>
        {total > 0 && (
          <span className="curso-modulo-contagem">{vistas}/{total}</span>
        )}
      </div>
      <ListaAulas aulas={modulo.aulas} aulaAtualId={aulaAtualId} />
    </div>
  );
}
