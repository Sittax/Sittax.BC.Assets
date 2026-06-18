import { z } from "zod";

/** Gate de gestão de eventos (FR-014): suporte, dev e master. */
export function papelPodeGerirEvento(papel: string): boolean {
  return papel === "suporte" || papel === "dev" || papel === "master";
}

const dataHoraLocal = z
  .string()
  .min(1, "Informe data e horário.")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Data/horário inválido.");

/**
 * R3: o banco garante só `fim > inicio` (check); a pontualidade (mesmo dia
 * local) é premissa do v1 validada aqui na borda — relaxável sem migração.
 */
const camposEvento = {
  titulo: z.string().min(1, "Informe o título.").max(200),
  descricao: z.string().max(4000).optional(),
  inicio: dataHoraLocal,
  fim: dataHoraLocal,
};

function fimDepoisDoInicio(d: { inicio: string; fim: string }): boolean {
  return new Date(d.fim).getTime() > new Date(d.inicio).getTime();
}

function mesmoDiaLocal(d: { inicio: string; fim: string }): boolean {
  // inputs `datetime-local` (sem fuso) — compara o dia como o usuário o vê
  return d.inicio.slice(0, 10) === d.fim.slice(0, 10);
}

export const eventoCriarSchema = z
  .object(camposEvento)
  .refine(fimDepoisDoInicio, {
    message: "O horário de fim deve ser depois do horário de início.",
    path: ["fim"],
  })
  .refine(mesmoDiaLocal, {
    message: "Evento deve começar e terminar no mesmo dia.",
    path: ["fim"],
  });

export const eventoAtualizarSchema = z
  .object({ id: z.string().uuid(), ...camposEvento })
  .refine(fimDepoisDoInicio, {
    message: "O horário de fim deve ser depois do horário de início.",
    path: ["fim"],
  })
  .refine(mesmoDiaLocal, {
    message: "Evento deve começar e terminar no mesmo dia.",
    path: ["fim"],
  });
