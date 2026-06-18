"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { iniciarEad } from "@/lib/actions/inscricoes";

type Props = {
  moduloId: string;
  className?: string;
};

export function BotaoIniciarCurso({ moduloId, className }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className={className ?? "curso-card-btn-iniciar"}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await iniciarEad({ moduloId });
          if (res.ok) {
            router.refresh();
          }
        });
      }}
    >
      {pending ? "Iniciando…" : "Iniciar Curso"}
    </button>
  );
}
