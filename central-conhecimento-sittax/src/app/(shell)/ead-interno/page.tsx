import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * EAD interno — gate server-side suporte+ (FR-010). Papel insuficiente
 * recebe 404 (R6: não revela a existência da rota).
 */
export default async function EadInternoPage() {
  const sessao = await getSession();
  if (!sessao || !["suporte", "dev", "master"].includes(sessao.papel)) {
    notFound();
  }
  return (
    <section className="placeholder">
      <h1>EAD interno</h1>
      <p>Este módulo será construído em uma fase futura da plataforma.</p>
      <p className="placeholder-nota">
        O EAD interno é organizado por temas internos — o seletor de produto
        não se aplica aqui.
      </p>
    </section>
  );
}
