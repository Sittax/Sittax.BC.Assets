import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { arquivo } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage/minio";

const CAPA_W = 800;
const CAPA_H = 450;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function erro(mensagem: string, status = 400) {
  return NextResponse.json({ mensagem }, { status });
}

/** POST /api/arquivos — upload de imagem (gate suporte+). */
export async function POST(request: NextRequest) {
  const sessao = await getSession();
  if (!sessao) return erro("não autenticado", 401);
  if (!["suporte", "dev", "master"].includes(sessao.papel)) return erro("permissão insuficiente", 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return erro("não foi possível ler o formulário");
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) return erro("arquivo ausente");
  if (!file.type.startsWith("image/")) return erro("tipo inválido — envie JPG, PNG ou WebP");

  let buffer = Buffer.from(await file.arrayBuffer()) as Buffer;
  if (buffer.byteLength > MAX_BYTES) return erro("arquivo excede 10 MB");

  const crop = request.nextUrl.searchParams.get("crop");
  let mime = file.type;

  if (crop === "capa") {
    try {
      buffer = await sharp(buffer)
        .resize(CAPA_W, CAPA_H, { fit: "cover", position: "centre" })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      mime = "image/jpeg";
    } catch (e) {
      console.error("[upload/capa] sharp falhou:", e);
      return erro("não foi possível processar a imagem — verifique se o arquivo é uma imagem válida");
    }
  }

  const ext = mime === "image/jpeg" ? ".jpg" : mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : "";
  const chave = `uploads/${crypto.randomUUID()}${ext}`;

  try {
    await getStorage().salvar(chave, buffer, mime);
  } catch (e) {
    console.error("[upload] MinIO falhou:", e);
    return erro("falha ao salvar o arquivo — o storage pode estar indisponível");
  }

  try {
    const id = await withUser(sessao.userId, sessao.papel, async (tx) => {
      const [reg] = await tx
        .insert(arquivo)
        .values({
          nomeOriginal: file.name,
          mime,
          tamanho: buffer.byteLength,
          chaveStorage: chave,
          criadoPor: sessao.userId,
        })
        .returning();
      return reg.id;
    });

    return NextResponse.json({ id, url: `/api/arquivos/${id}` }, { status: 201 });
  } catch (e) {
    console.error("[upload] DB falhou:", e);
    return erro("falha ao registrar o arquivo no banco", 500);
  }
}
