import { eq } from "drizzle-orm";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { usuario } from "@/lib/db/schema";
import { withUser, type Papel } from "@/lib/db/rls";

/**
 * Sessão própria da central (research R2): cookie httpOnly assinado e
 * criptografado, stateless. Papel congelado no login (rebaixamento vale no
 * próximo login); desativação derruba no próximo acesso porque o usuário é
 * sempre recarregado do banco.
 */

export interface SessionData {
  userId?: string;
  papel?: Papel;
  loginAt?: number;
  lastActivityAt?: number;
}

export type Usuario = typeof usuario.$inferSelect;

export interface SessaoValida {
  userId: string;
  papel: Papel;
  usuario: Usuario;
}

// função (não const de módulo): config só pode ser lida em tempo de request
function sessionOptions(): SessionOptions {
  return {
    password: config.SESSION_SECRET,
    cookieName: "central_sessao",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // validade do cookie maior que o teto; quem manda é a validação no servidor
      maxAge: config.SESSION_MAX_DAYS * 24 * 60 * 60,
    },
  };
}

async function session() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createSession(userId: string, papel: Papel): Promise<void> {
  const s = await session();
  const now = Date.now();
  s.userId = userId;
  s.papel = papel;
  s.loginAt = now;
  s.lastActivityAt = now;
  await s.save();
}

export async function destroySession(): Promise<void> {
  const s = await session();
  s.destroy();
}

/**
 * Lê e valida a sessão: janela deslizante (SESSION_IDLE_DAYS), teto absoluto
 * (SESSION_MAX_DAYS) e `usuario.ativo` no banco; renova lastActivityAt.
 * Inválida → null (telas redirecionam a /login).
 *
 * Em Server Components o Next proíbe gravar cookies, então a renovação e a
 * limpeza do cookie são oportunistas (try/catch): valem em route handlers e
 * server actions; na renderização apenas validam.
 */
export async function getSession(): Promise<SessaoValida | null> {
  const s = await session();
  const { userId, papel, loginAt, lastActivityAt } = s;
  if (!userId || !papel || !loginAt || !lastActivityAt) return null;

  const now = Date.now();
  const expirouPorInatividade =
    now - lastActivityAt > config.SESSION_IDLE_DAYS * DAY_MS;
  const estourouTeto = now - loginAt > config.SESSION_MAX_DAYS * DAY_MS;
  if (expirouPorInatividade || estourouTeto) {
    try {
      s.destroy();
    } catch {}
    return null;
  }

  const u = await withUser(userId, papel, async (tx) => {
    const rows = await tx.select().from(usuario).where(eq(usuario.id, userId));
    return rows[0] ?? null;
  });
  if (!u || !u.ativo) {
    try {
      s.destroy();
    } catch {}
    return null;
  }

  s.lastActivityAt = now;
  try {
    await s.save();
  } catch {}

  return { userId, papel, usuario: u };
}
