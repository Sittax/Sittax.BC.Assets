import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { marcarAulaVista } from "@/lib/ead/progresso";

const bodySchema = z.object({ aulaId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const sessao = await getSession();
  if (!sessao) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }

  try {
    const resultado = await marcarAulaVista(
      parsed.data.aulaId,
      sessao.userId,
      sessao.papel,
    );
    return NextResponse.json(resultado);
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ erro: "aula não encontrada" }, { status: 404 });
    }
    if (err?.code === "SEM_INSCRICAO") {
      return NextResponse.json({ erro: "sem_inscricao" }, { status: 409 });
    }
    console.error("[POST /api/ead/progresso]", err);
    return NextResponse.json({ erro: "erro interno" }, { status: 500 });
  }
}
