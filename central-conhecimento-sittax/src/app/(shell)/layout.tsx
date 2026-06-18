import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import type { ModuloItem } from "@/components/shell/tipos";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import { escritorio, escritorioProduto, produto } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Casca autenticada (FR-015): exige sessão válida, resolve o produto
 * selecionado (default: primeiro contratado do escritório ou primeiro do
 * catálogo — R7) e monta a lista de módulos do rail filtrada por papel NO
 * SERVIDOR (FR-009/FR-010 — esconder item é cortesia; o gate de rota é dos
 * layouts/páginas + RLS por baixo).
 */
export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sessao = await getSession();
  if (!sessao) redirect("/login");
  const { usuario: u, papel } = sessao;

  const { produtos, nomeEscritorio, contratadosIds } = await withUser(
    sessao.userId,
    papel,
    async (tx) => {
      const produtos = await tx.select().from(produto).orderBy(asc(produto.ordem));
      const nomeEscritorio = u.escritorioId
        ? ((
            await tx
              .select({ nome: escritorio.nome })
              .from(escritorio)
              .where(eq(escritorio.id, u.escritorioId))
          )[0]?.nome ?? null)
        : null;
      const contratadosIds = u.escritorioId
        ? (
            await tx
              .select({ produtoId: escritorioProduto.produtoId })
              .from(escritorioProduto)
              .where(eq(escritorioProduto.escritorioId, u.escritorioId))
          ).map((r) => r.produtoId)
        : [];
      return { produtos, nomeEscritorio, contratadosIds };
    },
  );

  const selecionado =
    produtos.find((p) => p.id === u.produtoSelecionadoId) ??
    produtos.find((p) => contratadosIds.includes(p.id)) ??
    produtos[0] ??
    null;

  // EAD interno fora da navegação por ora (decisão do PO 2026-06-12) — a
  // rota /ead-interno continua existindo com gate próprio; só some do menu
  const modulos: ModuloItem[] = [
    { href: "/dashboard", rotulo: "Dashboard", icone: "layout-dashboard" },
    { href: "/base", rotulo: "Base de conhecimento", icone: "book-open" },
    { href: "/cursos", rotulo: "Cursos", icone: "graduation-cap" },
    { href: "/atualizacoes", rotulo: "Atualizações", icone: "megaphone" },
  ];

  return (
    <div className="shell">
      <TopBar
        produtos={produtos}
        produtoSelecionadoId={selecionado?.id ?? null}
        usuario={{
          nome: u.nome,
          sobrenome: u.sobrenome,
          papel,
          escritorioNome: nomeEscritorio,
        }}
        modulos={modulos}
      />
      <main className="conteudo">{children}</main>
    </div>
  );
}
