"use client";

import { useTransition } from "react";
import { CartaoModulo } from "./CartaoModulo";
import { iniciarEad } from "@/lib/actions/inscricoes";

type Modulo = {
  id: string;
  nome: string;
  ordem: number;
  aulas: { id: string; titulo: string; ordem: number; vista: boolean }[];
};

type Props = {
  moduloId: string;
  modulos: Modulo[];
  inscrito: boolean;
  percentual: number | null;
};

export function TrilhaEad({ moduloId, modulos, inscrito, percentual }: Props) {
  const [pending, startTransition] = useTransition();
  const temAulas = modulos.some((m) => m.aulas.length > 0);

  function handleIniciar() {
    startTransition(async () => {
      await iniciarEad({ moduloId });
      window.location.reload();
    });
  }

  return (
    <div>
      <div className="curso-status-barra">
        <div className="curso-progresso-wrap">
          {inscrito && percentual !== null && (
            <>
              <div className="curso-progresso-trilho">
                <div
                  className="curso-progresso-fill"
                  style={{ width: `${percentual}%` }}
                />
              </div>
              <span className="curso-progresso-label">{percentual}%</span>
            </>
          )}
        </div>

        {!inscrito && temAulas && (
          <button
            onClick={handleIniciar}
            disabled={pending}
            className="curso-btn-iniciar"
          >
            {pending ? "Iniciando…" : "Iniciar Curso"}
          </button>
        )}

        {inscrito && (
          <span className="curso-badge-andamento">em andamento</span>
        )}
      </div>

      {modulos.length === 0 ? (
        <div className="curso-vazio">
          Nenhum conteúdo disponível para este produto.
        </div>
      ) : (
        <div className="curso-modulos-lista">
          {modulos.map((m) => (
            <CartaoModulo key={m.id} modulo={m} />
          ))}
        </div>
      )}
    </div>
  );
}
