import { z } from "zod";

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extrai e valida o ID do YouTube de uma URL ou ID puro (R4).
 * Formatos aceitos: watch?v=, youtu.be/, ID puro de 11 chars.
 * Retorna o ID validado ou lança ZodError.
 */
export const youtubeIdSchema = z.string().transform((input, ctx) => {
  const trimmed = input.trim();

  // ID puro
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;

  try {
    const url = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
    );

    let id: string | null = null;

    if (
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      id = url.searchParams.get("v");
    } else if (
      url.hostname === "youtu.be" ||
      url.hostname === "www.youtu.be"
    ) {
      id = url.pathname.slice(1).split("?")[0] ?? null;
    }

    if (id && YOUTUBE_ID_RE.test(id)) return id;
  } catch {
    // URL inválida — cai no erro abaixo
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "URL ou ID do YouTube inválido. Use watch?v=, youtu.be/ ou ID de 11 caracteres.",
  });
  return z.NEVER;
});

/** Monta a URL de embed youtube-nocookie com enablejsapi=1 (R4). */
export function embedUrl(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1`;
}
