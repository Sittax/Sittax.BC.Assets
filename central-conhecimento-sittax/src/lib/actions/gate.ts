import { getSession, type SessaoValida } from "@/lib/auth/session";

/** Resultado padrão das server actions da gerência (exibido pelos forms). */
export interface ActionResult {
  ok: boolean;
  mensagem?: string;
}

/**
 * Toda action da gerência revalida papel master no início (FR-009/FR-011);
 * erro de permissão é genérico — a RLS nega por baixo de qualquer forma.
 */
export async function exigirMaster(): Promise<SessaoValida> {
  const sessao = await getSession();
  if (!sessao || sessao.papel !== "master") {
    throw new Error("acesso negado");
  }
  return sessao;
}
