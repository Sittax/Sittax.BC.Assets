import Link from "next/link";
import { PlayCircle, Pencil } from "lucide-react";
import { BotaoIniciarCurso } from "./BotaoIniciarCurso";
import { CapaCurso } from "./CapaCurso";
import type { ModuloComAulas } from "@/lib/ead/trilha";

type Props = {
  modulo: ModuloComAulas;
  inscrito: boolean;
  podeEditar: boolean;
  /** Nome do produto — exibido como badge só no bloco "Outros cursos". */
  produtoNome?: string;
};

export function CardCurso({ modulo, inscrito, podeEditar, produtoNome }: Props) {
  const totalAulas = modulo.aulas.length;
  const vistas = modulo.aulas.filter((a) => a.vista).length;
  const percentual = totalAulas > 0 ? Math.round((vistas / totalAulas) * 100) : 0;
  const temAulas = totalAulas > 0;

  return (
    <div className="curso-card">
      <CapaCurso src={modulo.capaUrl} alt={modulo.nome} />

      {/* Corpo */}
      <div className="curso-card-corpo">
        {produtoNome && <span className="curso-card-badge">{produtoNome}</span>}
        <h3 className="curso-card-titulo">{modulo.nome}</h3>
        {modulo.descricaoMd && (
          <p className="curso-card-descricao">{modulo.descricaoMd}</p>
        )}
        <div className="curso-card-meta">
          <span>{totalAulas} {totalAulas === 1 ? "aula" : "aulas"}</span>
          {inscrito && temAulas && (
            <>
              <div className="curso-card-progresso-trilho">
                <div className="curso-card-progresso-fill" style={{ width: `${percentual}%` }} />
              </div>
              <span style={{ flexShrink: 0 }}>{percentual}%</span>
            </>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="curso-card-acoes">
        {inscrito || !temAulas ? (
          <Link href={`/cursos/${modulo.id}`} className="curso-card-btn-continuar">
            <PlayCircle size={13} />
            {inscrito ? "Continuar" : "Ver aulas"}
          </Link>
        ) : (
          <BotaoIniciarCurso moduloId={modulo.id} />
        )}

        {podeEditar && (
          <Link href={`/cursos/${modulo.id}/editar`} className="curso-card-btn-editar">
            <Pencil size={12} />
            Editar
          </Link>
        )}
      </div>
    </div>
  );
}
