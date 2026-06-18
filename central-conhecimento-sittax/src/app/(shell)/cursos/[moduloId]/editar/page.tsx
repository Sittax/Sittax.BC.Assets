import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { asc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { produto } from "@/lib/db/schema";
import { moduloDoProduto } from "@/lib/ead/trilha";
import { EditorEadModulo } from "../../componentes/EditorEadModulo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ moduloId: string }> };

export default async function EditorEadPage({ params }: Props) {
  const { moduloId } = await params;
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { userId, papel } = sessao;

  if (papel !== "dev" && papel !== "master") {
    return (
      <div className="curso-editor-pagina">
        <h1>Acesso negado</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
          Esta área é exclusiva para desenvolvedores e masters.
        </p>
      </div>
    );
  }

  const modulo = await moduloDoProduto(moduloId, userId, papel);
  if (!modulo) notFound();

  const produtos = await withUser(userId, papel, (tx) =>
    tx
      .select({ id: produto.id, nome: produto.nome })
      .from(produto)
      .orderBy(asc(produto.ordem)),
  );

  return (
    <div className="curso-editor-pagina">
      <div className="curso-editor-header">
        <Link href="/cursos" className="curso-editor-voltar" title="Voltar à listagem">
          <ArrowLeft size={16} />
        </Link>
        <h1>Editar Curso</h1>
        <Link
          href={`/cursos/${moduloId}`}
          className="curso-card-btn-editar"
          style={{ marginLeft: "auto" }}
        >
          <Eye size={12} />
          Ver Curso
        </Link>
      </div>

      <EditorEadModulo
        moduloId={modulo.id}
        nomeInicial={modulo.nome}
        capaUrlInicial={modulo.capaUrl}
        descricaoMdInicial={modulo.descricaoMd}
        produtos={produtos}
        produtoPrincipalId={modulo.produtoId}
        produtosVinculadosIniciais={modulo.produtosVinculados}
        aulasIniciais={modulo.aulas.map((a) => ({
          id: a.id,
          titulo: a.titulo,
          youtubeId: a.youtubeId,
          descricaoMd: a.descricaoMd,
          ordem: a.ordem,
        }))}
      />
    </div>
  );
}
