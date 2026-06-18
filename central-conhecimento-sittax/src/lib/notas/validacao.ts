import { z } from "zod";
import { sanitizarMarkdown } from "@/lib/conteudo/sanitizar";

/** Gate de escrita de release note (FR-012): só dev e master. */
export function papelPodeEscreverNota(papel: string): boolean {
  return papel === "dev" || papel === "master";
}

/**
 * Invariante da coluna derivada (R2): conteudo_publico recalculado em TODO
 * save com a MESMA função única de sanitização da base (Constituição III).
 */
export function derivarConteudoPublico(conteudoMd: string): string {
  return sanitizarMarkdown(conteudoMd, "padrao");
}

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD).");

export const notaCriarSchema = z.object({
  produtoId: z.string().uuid(),
  data: dataIso,
  versao: z.string().max(50).optional(),
  conteudoMd: z.string(),
});

export const notaAtualizarSchema = z.object({
  id: z.string().uuid(),
  data: dataIso.optional(),
  versao: z.string().max(50).nullable().optional(),
  conteudoMd: z.string().optional(),
});
