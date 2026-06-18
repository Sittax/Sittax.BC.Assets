import { notFound, redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { produto } from "@/lib/db/schema";
import { ImportarForm } from "../componentes/ImportarForm";

export const dynamic = "force-dynamic";

/** Importação de markdown (.zip, ex. vault Obsidian) — gate suporte+ (o gate real é do route handler). */
export default async function ImportarPage() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  if (!["suporte", "dev", "master"].includes(sessao.papel)) notFound();

  const produtos = await withUser(sessao.userId, sessao.papel, (tx) =>
    tx
      .select({ id: produto.id, nome: produto.nome })
      .from(produto)
      .orderBy(asc(produto.ordem)),
  );

  return (
    <div className="importar-pagina">
      <ImportarForm
        produtos={produtos}
        produtoAtivoId={sessao.usuario.produtoSelecionadoId}
      />
    </div>
  );
}
