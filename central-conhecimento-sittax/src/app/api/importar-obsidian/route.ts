import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { importarObsidian } from "@/lib/conteudo/importer";
import { getStorage } from "@/lib/storage/minio";
import { getDb } from "@/lib/db/client";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

/** POST /api/importar-obsidian — importa vault Obsidian (gate suporte+). */
export async function POST(request: NextRequest) {
  const sessao = await getSession();
  if (!sessao) {
    return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  }
  if (!["suporte", "dev", "master"].includes(sessao.papel)) {
    return NextResponse.json({ erro: "permissão insuficiente" }, { status: 403 });
  }

  const formData = await request.formData();
  const vault = formData.get("vault");
  const produtoId = formData.get("produtoId");

  if (!vault || !(vault instanceof File)) {
    return NextResponse.json({ erro: "vault ausente" }, { status: 400 });
  }
  if (!produtoId || typeof produtoId !== "string") {
    return NextResponse.json({ erro: "produtoId ausente" }, { status: 400 });
  }

  const uuidCheck = z.string().uuid().safeParse(produtoId);
  if (!uuidCheck.success) {
    return NextResponse.json({ erro: "produtoId inválido" }, { status: 400 });
  }

  const buffer = Buffer.from(await vault.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ erro: "vault excede 100 MB" }, { status: 400 });
  }

  try {
    const relatorio = await importarObsidian(buffer, produtoId, getStorage(), getDb);
    return NextResponse.json(relatorio);
  } catch (e) {
    // Transparência: a causa real chega ao usuário em vez de um 500 genérico
    console.error("[importar-obsidian] falha:", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao importar o markdown." },
      { status: 500 },
    );
  }
}
