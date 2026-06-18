import Link from "next/link";
import { CalendarDays, Settings2 } from "lucide-react";
import type { EventoProximo } from "@/lib/dashboard/consultas";
import { formatarDataHora, formatarHora } from "@/lib/notas/formatar";

type Props = {
  eventos: EventoProximo[];
  podeGerir: boolean;
};

export function BlocoEventos({ eventos, podeGerir }: Props) {
  return (
    <section className="dash-bloco">
      <div className="dash-bloco-header">
        <h2 className="dash-bloco-titulo">Próximos eventos</h2>
        {podeGerir && (
          <Link href="/dashboard/eventos" className="dash-ver-todas">
            <Settings2 size={13} />
            Gerenciar eventos
          </Link>
        )}
      </div>

      {eventos.length === 0 ? (
        <p className="dash-vazio">
          <CalendarDays size={14} /> Nenhum evento agendado.
        </p>
      ) : (
        <ul className="dash-eventos-lista">
          {eventos.map((e) => (
            <li key={e.id} className="dash-evento">
              <div className="dash-evento-data">
                <span>{formatarDataHora(e.inicio)}</span>
                <span className="dash-evento-hora">
                  {formatarHora(e.inicio)} – {formatarHora(e.fim)}
                </span>
              </div>
              <div className="dash-evento-corpo">
                <h3>{e.titulo}</h3>
                {e.descricao && <p>{e.descricao}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
