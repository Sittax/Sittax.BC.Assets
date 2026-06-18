"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withSystem } from "@/lib/db/rls";
import { destaqueBase } from "@/lib/db/schema";

export async function salvarDestaques(
  produtoId: string,
  topicoIds: string[],
): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await getSession();
  if (!sessao) return { ok: false, erro: "Não autenticado" };
  if (sessao.papel !== "dev" && sessao.papel !== "master") {
    return { ok: false, erro: "Sem permissão" };
  }
  if (topicoIds.length > 4) {
    return { ok: false, erro: "Máximo de 4 destaques" };
  }

  await withSystem(async (tx) => {
    await tx.delete(destaqueBase).where(eq(destaqueBase.produtoId, produtoId));
    if (topicoIds.length > 0) {
      await tx.insert(destaqueBase).values(
        topicoIds.map((topicoId, i) => ({
          produtoId,
          topicoId,
          ordem: i,
        })),
      );
    }
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
