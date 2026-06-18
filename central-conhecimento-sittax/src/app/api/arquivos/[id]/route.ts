import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { arquivo } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage/minio";
import { Readable } from "stream";

/**
 * GET /api/arquivos/{id} — serve imagem autenticada (débito v1: exige só
 * sessão válida, sem checagem de papel — FR-021).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sessao = await getSession();
  if (!sessao) {
    return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  }

  const rows = await withUser(sessao.userId, sessao.papel, (tx) =>
    tx.select().from(arquivo).where(eq(arquivo.id, id)),
  );

  if (rows.length === 0) {
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  }

  const reg = rows[0];
  const storage = getStorage();

  try {
    const { stream, mime } = await storage.abrirStream(reg.chaveStorage);
    // Converte Node.js Readable para ReadableStream da Web API
    const webStream = Readable.toWeb(stream) as unknown as BodyInit;
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${reg.nomeOriginal}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  }
}
