import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { estaBloqueado, limparFalhas, registrarFalha } from "@/lib/auth/local";
import { processarLogin } from "@/lib/auth/login-flow";
import { createSession } from "@/lib/auth/session";

/**
 * POST /api/auth/login (contracts/internal-api.md). Mensagens em PT-BR que
 * NUNCA revelam qual sistema validou, recusou ou está fora do ar.
 */

const bodySchema = z.object({
  email: z.string().email("informe um e-mail válido"),
  senha: z.string().min(1, "informe a senha"),
});

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "credencial_invalida", mensagem: "Informe e-mail e senha." },
      { status: 401 },
    );
  }
  const { email, senha } = parsed.data;
  const ip = ipDe(req);

  if (estaBloqueado(email, ip)) {
    return NextResponse.json(
      {
        erro: "muitas_tentativas",
        mensagem: "Muitas tentativas de login. Aguarde um minuto e tente novamente.",
      },
      { status: 429 },
    );
  }

  const resultado = await processarLogin(email, senha);

  switch (resultado.tipo) {
    case "ok": {
      limparFalhas(email, ip);
      await createSession(resultado.usuario.id, resultado.usuario.papel);
      return NextResponse.json({ ok: true });
    }
    case "credencial_invalida": {
      registrarFalha(email, ip);
      return NextResponse.json(
        {
          erro: "credencial_invalida",
          mensagem: "E-mail ou senha inválidos.",
        },
        { status: 401 },
      );
    }
    case "credencial_invalida_parcial": {
      registrarFalha(email, ip);
      return NextResponse.json(
        {
          erro: "credencial_invalida_parcial",
          mensagem: "E-mail ou senha inválidos.",
          aviso:
            "Há indisponibilidade parcial no momento — se a sua senha pertence ao sistema indisponível, tente novamente em instantes.",
        },
        { status: 401 },
      );
    }
    case "sem_escritorio":
      return NextResponse.json(
        {
          erro: "sem_escritorio",
          mensagem: "Usuário sem escritório vinculado — contate o suporte.",
        },
        { status: 403 },
      );
    case "usuario_inativo":
      return NextResponse.json(
        {
          erro: "usuario_inativo",
          mensagem: "Usuário desativado — contate o administrador.",
        },
        { status: 403 },
      );
    case "indisponivel":
      return NextResponse.json(
        {
          erro: "indisponivel",
          mensagem:
            "Não foi possível validar seu acesso agora. Tente novamente em instantes.",
        },
        { status: 503 },
      );
  }
}
