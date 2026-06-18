import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { PlayCircle, Pencil, ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { inscricaoEad } from "@/lib/db/schema";
import { moduloDoProduto } from "@/lib/ead/trilha";
import { percentualProgresso } from "@/lib/ead/progresso";
import { CascadeEad } from "../componentes/CascadeEad";
import { BotaoIniciarCurso } from "../componentes/BotaoIniciarCurso";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ moduloId: string }> };

export default async function ModuloEadPage({ params }: Props) {
  const { moduloId } = await params;
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { userId, papel } = sessao;
  const podeEditar = papel === "dev" || papel === "master";

  const modulo = await moduloDoProduto(moduloId, userId, papel);
  if (!modulo) notFound();

  // Inscrição é por módulo
  const inscricao = await withUser(userId, papel, (tx) =>
    tx
      .select({ id: inscricaoEad.id })
      .from(inscricaoEad)
      .where(
        and(
          eq(inscricaoEad.usuarioId, userId),
          eq(inscricaoEad.eadModuloId, moduloId),
          eq(inscricaoEad.interno, false),
        ),
      )
      .then((rows) => rows[0] ?? null),
  );

  const inscrito = !!inscricao;

  const percentualInicial = inscrito
    ? await percentualProgresso(userId, moduloId, userId, papel)
    : 0;

  return (
    <div className="curso-cascade-pagina">
      {/* Barra de ações superior: voltar + editar */}
      <div className="curso-cascade-acoes-topo">
        <Link href="/cursos" className="curso-cascade-voltar">
          <ArrowLeft size={15} />
          Cursos
        </Link>
        {podeEditar && (
          <Link href={`/cursos/${moduloId}/editar`} className="curso-card-btn-editar">
            <Pencil size={12} />
            Editar
          </Link>
        )}
      </div>

      {/* Banner — com imagem ou gradiente de marca */}
      {modulo.capaUrl ? (
        <div className="curso-cascade-banner">
          <img className="curso-cascade-banner-img" src={modulo.capaUrl} alt={modulo.nome} />
          <div className="curso-cascade-banner-overlay">
            <h1 className="curso-cascade-banner-titulo">{modulo.nome}</h1>
          </div>
        </div>
      ) : (
        <div className="curso-cascade-banner-sem-capa">
          <h1 className="curso-cascade-banner-titulo">{modulo.nome}</h1>
        </div>
      )}

      {inscrito ? (
        <CascadeEad modulo={modulo} percentualInicial={percentualInicial} />
      ) : (
        <div className="curso-preview-pagina">
          {modulo.descricaoMd && (
            <p className="curso-preview-descricao">{modulo.descricaoMd}</p>
          )}

          {modulo.aulas.length > 0 ? (
            <>
              <p className="curso-preview-aulas-count">
                {modulo.aulas.length} {modulo.aulas.length === 1 ? "aula" : "aulas"} neste curso
              </p>
              <div className="curso-preview-aulas-lista">
                {modulo.aulas.map((a, i) => (
                  <div key={a.id} className="curso-preview-aula-item">
                    <PlayCircle size={13} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
                    <span style={{ minWidth: 24, color: "var(--text-muted)", fontSize: 11, fontWeight: 700 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {a.titulo}
                  </div>
                ))}
              </div>
              <BotaoIniciarCurso moduloId={moduloId} className="curso-btn-iniciar" />
            </>
          ) : (
            <div className="curso-vazio">Nenhuma aula disponível neste curso ainda.</div>
          )}
        </div>
      )}
    </div>
  );
}