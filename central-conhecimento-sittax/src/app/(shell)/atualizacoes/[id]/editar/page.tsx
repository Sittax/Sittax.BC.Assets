import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { produto, releaseNote } from "@/lib/db/schema";
import { papelPodeEscreverNota } from "@/lib/notas/validacao";
import { EditorNota } from "../../componentes/EditorNota";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditarNotaPage({ params }: Props) {
  const { id } = await params;
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  // Gate server-side (FR-012/FR-018)
  if (!papelPodeEscreverNota(sessao.papel)) notFound();

  const [notaRow, produtos] = await withUser(
    sessao.userId,
    sessao.papel,
    async (tx) => {
      const [n] = await tx
        .select()
        .from(releaseNote)
        .where(eq(releaseNote.id, id));
      const prods = await tx
        .select({ id: produto.id, nome: produto.nome })
        .from(produto)
        .orderBy(asc(produto.ordem));
      return [n ?? null, prods] as const;
    },
  );

  if (!notaRow) notFound();

  return (
    <div className="editor-pagina">
      <EditorNota
        produtos={produtos}
        produtoAtivoId={sessao.usuario.produtoSelecionadoId}
        nota={{
          id: notaRow.id,
          produtoId: notaRow.produtoId,
          data: notaRow.data,
          versao: notaRow.versao,
          conteudoMd: notaRow.conteudoMd,
        }}
      />
    </div>
  );
}
