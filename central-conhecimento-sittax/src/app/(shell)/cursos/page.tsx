import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { inscricaoEad, produto } from "@/lib/db/schema";
import { trilhaDoProduto, cursosDeOutrosProdutos } from "@/lib/ead/trilha";
import { CardCurso } from "./componentes/CardCurso";
import { CriarEadBtn } from "./componentes/CriarEadBtn";

export const dynamic = "force-dynamic";

export default async function EadPage() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { userId, papel, usuario: u } = sessao;
  const produtoId = u.produtoSelecionadoId;
  const podeEditar = papel === "dev" || papel === "master";

  if (!produtoId) {
    return (
      <div className="curso-listing-pagina">
        <div className="curso-listing-header"><h1>Cursos</h1></div>
        <div className="curso-vazio">Selecione um produto no seletor acima para ver os cursos.</div>
      </div>
    );
  }

  // ── Bloco 1: cursos do produto selecionado + nome do produto ──────────────
  const [modulos, nomeProduto] = await Promise.all([
    trilhaDoProduto(produtoId, userId, papel),
    withUser(userId, papel, async (tx) => {
      const [p] = await tx
        .select({ nome: produto.nome })
        .from(produto)
        .where(eq(produto.id, produtoId));
      return p?.nome ?? "";
    }),
  ]);

  const moduloIds = modulos.map((m) => m.id);
  const inscricoesDoUsuario =
    moduloIds.length > 0
      ? await withUser(userId, papel, (tx) =>
          tx
            .select({ eadModuloId: inscricaoEad.eadModuloId })
            .from(inscricaoEad)
            .where(
              and(
                eq(inscricaoEad.usuarioId, userId),
                inArray(inscricaoEad.eadModuloId, moduloIds),
                eq(inscricaoEad.interno, false),
              ),
            ),
        )
      : [];

  const inscritosSet = new Set(
    inscricoesDoUsuario.map((i) => i.eadModuloId).filter(Boolean) as string[],
  );

  // ── Bloco 2: cursos de OUTROS produtos contratados (exceção declarada §V) ──
  // Dedup: um EAD vinculado ao produto ativo já apareceu no Bloco 1.
  const outrosCursos = (
    await cursosDeOutrosProdutos(produtoId, u.escritorioId, userId, papel)
  ).filter((c) => !moduloIds.includes(c.modulo.id));

  return (
    <div className="curso-listing-pagina">
      {/* Bloco 1 — produto selecionado (principal) */}
      <section className="curso-bloco">
        <div className="curso-bloco-header">
          <div>
            <h1 className="curso-bloco-titulo">
              Cursos {nomeProduto ? `de ${nomeProduto}` : "do produto"}
            </h1>
            <p className="curso-bloco-sub">
              {modulos.length > 0
                ? `${modulos.length} ${modulos.length === 1 ? "curso disponível" : "cursos disponíveis"}`
                : "Trilhas de aprendizado deste produto"}
              {inscritosSet.size > 0 && ` · ${inscritosSet.size} em andamento`}
            </p>
          </div>
          {podeEditar && <CriarEadBtn produtoId={produtoId} />}
        </div>

        {modulos.length === 0 ? (
          <div className="curso-vazio">
            {podeEditar
              ? 'Nenhum curso criado ainda. Clique em "Novo Curso" para começar.'
              : "Nenhum conteúdo disponível para este produto."}
          </div>
        ) : (
          <div className="curso-grid">
            {modulos.map((m) => (
              <CardCurso
                key={m.id}
                modulo={m}
                inscrito={inscritosSet.has(m.id)}
                podeEditar={podeEditar}
              />
            ))}
          </div>
        )}
      </section>

      {/* Bloco 2 — outros produtos contratados (secundário) */}
      {outrosCursos.length > 0 && (
        <section className="curso-bloco curso-bloco--secundario">
          <div className="curso-bloco-header">
            <div>
              <h2 className="curso-bloco-titulo curso-bloco-titulo--secundario">
                Outros cursos recomendados
              </h2>
              <p className="curso-bloco-sub">
                Dos produtos que seu escritório também contratou
              </p>
            </div>
          </div>
          <div className="curso-grid">
            {outrosCursos.map((c) => (
              <CardCurso
                key={c.modulo.id}
                modulo={c.modulo}
                inscrito={c.inscrito}
                podeEditar={podeEditar}
                produtoNome={c.produtoNome}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
