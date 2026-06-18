import { eq, sql } from "drizzle-orm";
import { withSystem } from "@/lib/db/rls";
import { acessoLog, usuario } from "@/lib/db/schema";
import { verificarSenha } from "./local";
import {
  espelharLogin,
  normalizarEmail,
  SemEscritorioError,
  type UsuarioEspelhado,
} from "./mirror";
import { autenticarNoSso, type OpcoesSso } from "./sso-client";

/**
 * Orquestração do login (sem HTTP/sessão — o route handler mapeia o
 * resultado para status + cookie): roteia local-first (e-mail de usuário
 * `origem='central'` valida sempre localmente, sem consultar o SSO) vs SSO,
 * executa espelhamento e grava acesso_log sem produto (R10).
 */

export type ResultadoLogin =
  | { tipo: "ok"; usuario: UsuarioEspelhado }
  | { tipo: "credencial_invalida" }
  | { tipo: "credencial_invalida_parcial" }
  | { tipo: "sem_escritorio" }
  | { tipo: "usuario_inativo" }
  | { tipo: "indisponivel" };

async function registrarAcessoDeLogin(usuarioId: string): Promise<void> {
  await withSystem(async (tx) => {
    await tx.insert(acessoLog).values({ usuarioId, produtoId: null });
  });
}

export async function processarLogin(
  emailBruto: string,
  senha: string,
  opcoesSso: OpcoesSso = {},
): Promise<ResultadoLogin> {
  const email = normalizarEmail(emailBruto);

  const existente = await withSystem(async (tx) => {
    const rows = await tx.select().from(usuario).where(eq(usuario.email, email));
    return rows[0] ?? null;
  });

  // local-first: cadastro local tem precedência; SSO não é consultado
  if (existente && existente.origem === "central") {
    if (!existente.ativo) return { tipo: "usuario_inativo" };
    const ok = await verificarSenha(existente.senhaHash ?? "", senha);
    if (!ok) return { tipo: "credencial_invalida" };
    await withSystem(async (tx) => {
      await tx
        .update(usuario)
        .set({ ultimoLoginEm: sql`now()` })
        .where(eq(usuario.id, existente.id));
    });
    await registrarAcessoDeLogin(existente.id);
    return { tipo: "ok", usuario: { ...existente, ultimoLoginEm: new Date() } };
  }

  const resultado = await autenticarNoSso(email, senha, opcoesSso);

  if (resultado.tipo === "indisponivel") return { tipo: "indisponivel" };
  if (resultado.tipo === "recusado") {
    return resultado.algumIndisponivel
      ? { tipo: "credencial_invalida_parcial" }
      : { tipo: "credencial_invalida" };
  }

  let espelhado: UsuarioEspelhado;
  try {
    espelhado = await espelharLogin(resultado.dados);
  } catch (err) {
    if (err instanceof SemEscritorioError) return { tipo: "sem_escritorio" };
    throw err;
  }

  await registrarAcessoDeLogin(espelhado.id);
  return { tipo: "ok", usuario: espelhado };
}
