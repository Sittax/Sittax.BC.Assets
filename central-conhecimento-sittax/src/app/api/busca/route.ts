import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { buscarTopicos } from "@/lib/conteudo/busca";

const querySchema = z.object({
  q: z.string().min(3, "termo_curto"),
});

/** GET /api/busca?q={termo} — busca FTS no produto ativo da sessão. */
export async function GET(request: NextRequest) {
  const sessao = await getSession();
  if (!sessao) {
    return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const parsed = querySchema.safeParse({ q });
  if (!parsed.success) {
    return NextResponse.json({ erro: "termo_curto" }, { status: 400 });
  }

  const produtoId = sessao.usuario.produtoSelecionadoId;
  if (!produtoId) {
    return NextResponse.json({ resultados: [] });
  }

  const resultados = await buscarTopicos(
    sessao.userId,
    sessao.papel,
    produtoId,
    parsed.data.q,
  );

  return NextResponse.json({ resultados });
}
