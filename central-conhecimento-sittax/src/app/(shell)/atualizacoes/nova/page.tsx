import { notFound, redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { produto } from "@/lib/db/schema";
import { papelPodeEscreverNota } from "@/lib/notas/validacao";
import { EditorNota } from "../componentes/EditorNota";

export const dynamic = "force-dynamic";

export default async function NovaNotaPage() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  // Gate server-side (FR-012/FR-018) — o botão oculto é só cortesia
  if (!papelPodeEscreverNota(sessao.papel)) notFound();

  const produtos = await withUser(sessao.userId, sessao.papel, (tx) =>
    tx
      .select({ id: produto.id, nome: produto.nome })
      .from(produto)
      .orderBy(asc(produto.ordem)),
  );

  return (
    <div className="editor-pagina">
      <EditorNota
        produtos={produtos}
        produtoAtivoId={sessao.usuario.produtoSelecionadoId}
      />
    </div>
  );
}
