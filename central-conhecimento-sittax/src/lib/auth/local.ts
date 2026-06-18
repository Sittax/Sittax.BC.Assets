import { verify } from "@node-rs/argon2";

/**
 * Login local de usuários só central (R11): verificação Argon2id e
 * rate-limit em memória por e-mail+IP — 5 falhas → bloqueio de 1 minuto.
 * Suficiente para deploy on-prem single-node.
 */

const MAX_FALHAS = 5;
const BLOQUEIO_MS = 60_000;

interface Tentativas {
  falhas: number;
  bloqueadoAte: number;
}

const tentativas = new Map<string, Tentativas>();

function chave(email: string, ip: string): string {
  return `${email}|${ip}`;
}

export function estaBloqueado(email: string, ip: string): boolean {
  const t = tentativas.get(chave(email, ip));
  if (!t) return false;
  if (t.bloqueadoAte > Date.now()) return true;
  if (t.bloqueadoAte > 0) tentativas.delete(chave(email, ip));
  return false;
}

export function registrarFalha(email: string, ip: string): void {
  const k = chave(email, ip);
  const t = tentativas.get(k) ?? { falhas: 0, bloqueadoAte: 0 };
  t.falhas += 1;
  if (t.falhas >= MAX_FALHAS) {
    t.bloqueadoAte = Date.now() + BLOQUEIO_MS;
    t.falhas = 0;
  }
  tentativas.set(k, t);
}

export function limparFalhas(email: string, ip: string): void {
  tentativas.delete(chave(email, ip));
}

export async function verificarSenha(
  senhaHash: string,
  senha: string,
): Promise<boolean> {
  try {
    return await verify(senhaHash, senha);
  } catch {
    return false;
  }
}
