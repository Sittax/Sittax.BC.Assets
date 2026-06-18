import Link from "next/link";
import { CalendarDays, Settings2 } from "lucide-react";
import type { EventoProximo } from "@/lib/dashboard/consultas";
import { formatarHora } from "@/lib/notas/formatar";

type Props = {
  eventos: EventoProximo[];
  podeGerir: boolean;
};

export function BlocoAgenda({ eventos, podeGerir }: Props) {
  return (
    <div className="dash-agenda-card">
      <div className="sec-head" style={{ marginBottom: eventos.length ? 6 : 0 }}>
        <span className="sec-ico">
          <CalendarDays size={15} />
        </span>
        <h3>Agenda</h3>
        {podeGerir && (
          <Link href="/dashboard/eventos" className="sec-more">
            <Settings2 size={13} />
            Gerenciar
          </Link>
        )}
      </div>

      {eventos.length === 0 ? (
        <div className="dash-agenda-empty">
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Nenhum evento marcado
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Avisamos por aqui quando houver uma live ou lançamento.
          </span>
        </div>
      ) : (
        eventos.map((e) => {
          const inicio = new Date(e.inicio);
          const dia = String(inicio.getDate()).padStart(2, "0");
          const mes = inicio.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
          const now = new Date();
          const ehLive = new Date(e.fim) > now && inicio <= now;

          return (
            <div key={e.id} className="dash-agenda-item">
              <div className={`dash-agenda-data ${ehLive ? "dash-agenda-data--live" : "dash-agenda-data--evento"}`}>
                <span className="dash-agenda-data-dia">{dia}</span>
                <span className="dash-agenda-data-mes">{mes}</span>
              </div>
              <div className="dash-agenda-corpo">
                <div className="dash-agenda-titulo">{e.titulo}</div>
                <div className="dash-agenda-sub">
                  {ehLive ? (
                    <>{formatarHora(e.inicio)} · ao vivo</>
                  ) : e.descricao ? (
                    e.descricao
                  ) : (
                    formatarHora(e.inicio)
                  )}
                </div>
              </div>
              {ehLive && (
                <span className="dash-agenda-live-chip">
                  <span className="dash-agenda-live-dot" />
                  Live
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
