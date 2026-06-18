import { config } from "@/lib/config";

/**
 * Cliente do SSO compartilhado dos 6 sistemas (docs/sso-login-endpoint.md):
 * sequência das URLs até um validar, timeout por sistema + teto total (R3),
 * decodificação do JWT sem verificar assinatura (R4 — a confiança vem do
 * canal TLS; o token nunca é reutilizado nem armazenado).
 */

export interface DadosSsoValidado {
  idOrigem: string;
  nome: string;
  sobrenome: string | null;
  email: string;
  role: string;
  nivel: number | null;
  escritorioCnpj: string;
  escritorioNome: string;
}

export type ResultadoSso =
  | { tipo: "validado"; dados: DadosSsoValidado }
  // recusa autoritativa (400/401/403) em ao menos um sistema;
  // algumIndisponivel=true marca o cenário misto do FR-007
  | { tipo: "recusado"; algumIndisponivel: boolean }
  // nenhum sistema conseguiu responder (timeout/rede/5xx/malformada/teto)
  | { tipo: "indisponivel" };

export interface OpcoesSso {
  baseUrls?: string[];
  timeoutMs?: number;
  totalTimeoutMs?: number;
}

function decodificarPayloadJwt(token: unknown): Record<string, unknown> | null {
  if (typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes.length < 2) return null;
  try {
    const json = Buffer.from(partes[1], "base64url").toString("utf8");
    const payload = JSON.parse(json);
    return typeof payload === "object" && payload !== null ? payload : null;
  } catch {
    return null;
  }
}

function extrairDados(body: unknown): DadosSsoValidado | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const claims = decodificarPayloadJwt(b.token);
  const usuario =
    typeof b.usuario === "object" && b.usuario !== null
      ? (b.usuario as Record<string, unknown>)
      : null;
  // claims essenciais: token decodificável + e-mail + role; EscritorioCnpj
  // ausente/vazio é claim presente-porém-vazio, não malformação (R3)
  if (!claims || !usuario) return null;
  const email = typeof usuario.email === "string" ? usuario.email : null;
  const role =
    typeof usuario.role === "string"
      ? usuario.role
      : typeof claims.Role === "string"
        ? claims.Role
        : null;
  if (!email || !role) return null;

  const nivelBruto = usuario.nivel ?? claims.Nivel;
  const nivel =
    typeof nivelBruto === "number"
      ? nivelBruto
      : typeof nivelBruto === "string" && nivelBruto.trim() !== ""
        ? Number(nivelBruto)
        : null;

  return {
    idOrigem: typeof usuario.id === "string" ? usuario.id : "",
    nome: typeof usuario.nome === "string" && usuario.nome ? usuario.nome : email,
    sobrenome: typeof usuario.sobrenome === "string" ? usuario.sobrenome : null,
    email,
    role,
    nivel: nivel !== null && Number.isFinite(nivel) ? nivel : null,
    escritorioCnpj:
      typeof claims.EscritorioCnpj === "string" ? claims.EscritorioCnpj : "",
    escritorioNome:
      typeof claims.EscritorioNome === "string" ? claims.EscritorioNome : "",
  };
}

export async function autenticarNoSso(
  email: string,
  senha: string,
  opcoes: OpcoesSso = {},
): Promise<ResultadoSso> {
  const baseUrls = opcoes.baseUrls ?? config.SSO_BASE_URLS;
  const timeoutMs = opcoes.timeoutMs ?? config.SSO_TIMEOUT_MS;
  const totalTimeoutMs = opcoes.totalTimeoutMs ?? config.SSO_TOTAL_TIMEOUT_MS;

  const inicio = Date.now();
  let houveRecusa = false;
  let houveIndisponivel = false;

  for (const base of baseUrls) {
    const restante = totalTimeoutMs - (Date.now() - inicio);
    if (restante <= 0) {
      // teto total estourado sem resposta autoritativa nos restantes (FR-029)
      houveIndisponivel = true;
      break;
    }
    try {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // chaves do body em português, conforme o contrato SSO
        body: JSON.stringify({ usuario: email, senha }),
        signal: AbortSignal.timeout(Math.min(timeoutMs, restante)),
        cache: "no-store",
      });

      if (res.ok) {
        const dados = extrairDados(await res.json().catch(() => null));
        if (!dados) {
          // resposta malformada = falha DAQUELE sistema; a sequência continua
          houveIndisponivel = true;
          continue;
        }
        return { tipo: "validado", dados };
      }

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        houveRecusa = true;
        continue;
      }
      // 5xx e demais status: inacessível
      houveIndisponivel = true;
    } catch {
      // timeout (AbortSignal) ou erro de rede
      houveIndisponivel = true;
    }
  }

  if (houveRecusa) {
    return { tipo: "recusado", algumIndisponivel: houveIndisponivel };
  }
  return { tipo: "indisponivel" };
}
