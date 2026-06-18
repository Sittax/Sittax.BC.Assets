import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SubNav } from "./sub-nav";

export const dynamic = "force-dynamic";

/**
 * Gerência — gate server-side master (FR-011). Papel insuficiente recebe
 * 404 (R6: não revela a existência da rota). As actions revalidam o papel
 * de novo e a RLS nega por baixo (defesa em profundidade).
 */
export default async function GerenciaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sessao = await getSession();
  if (!sessao || sessao.papel !== "master") notFound();

  return (
    <section className="gerencia">
      <h1>Gerência</h1>
      <SubNav
        itens={[
          { href: "/gerencia/escritorios", rotulo: "Escritórios" },
          { href: "/gerencia/usuarios", rotulo: "Usuários" },
          { href: "/gerencia/mapeamento", rotulo: "Mapeamento de papéis" },
          { href: "/gerencia/acessos", rotulo: "Acessos" },
        ]}
      />
      {children}
    </section>
  );
}
