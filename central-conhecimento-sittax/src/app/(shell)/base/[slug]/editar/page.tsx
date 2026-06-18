import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { topico } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { EditorTopico } from "../../componentes/EditorTopico";

export const dynamic = "force-dynamic";

export default async function EditarTopicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  // Gate server-side: só suporte/dev/master (R6 da Fase 1)
  if (!["suporte", "dev", "master"].includes(sessao.papel)) {
    notFound();
  }

  const rows = await withUser(sessao.userId, sessao.papel, (tx) =>
    tx.select().from(topico).where(eq(topico.slug, slug)),
  );

  if (rows.length === 0) notFound();
  const t = rows[0];

  return (
    <div className="editor-pagina">
      <EditorTopico
        topicoId={t.id}
        slug={slug}
        tituloInicial={t.titulo}
        conteudoInicial={t.conteudoMd}
        papel={sessao.papel}
      />
    </div>
  );
}
