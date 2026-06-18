import Link from "next/link";
import { listarAcessos } from "@/lib/actions/acessos";

export const dynamic = "force-dynamic";

/** Registro bruto de acesso (US4): leitura paginada, sem filtros analíticos. */
export default async function AcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { pagina: paginaParam } = await searchParams;
  const pagina = Math.max(1, Number(paginaParam) || 1);
  const { acessos, total, porPagina } = await listarAcessos(pagina);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  return (
    <div>
      <p className="gerencia-nota">
        Registro bruto: um evento por login (sem produto) e por troca de
        produto. Nenhuma métrica é calculada nesta fase.
      </p>
      <table className="gerencia-tabela">
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Produto</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {acessos.map((a) => (
            <tr key={a.id}>
              <td>
                {a.usuarioNome}{" "}
                <span className="cartao-meta">{a.usuarioEmail}</span>
              </td>
              <td>{a.produtoNome ?? "—"}</td>
              <td>
                {a.data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </td>
            </tr>
          ))}
          {acessos.length === 0 && (
            <tr>
              <td colSpan={3} className="gerencia-vazio">
                Nenhum acesso registrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <nav className="gerencia-paginacao" aria-label="Paginação">
        {pagina > 1 && (
          <Link href={`/gerencia/acessos?pagina=${pagina - 1}`}>‹ Anterior</Link>
        )}
        <span>
          Página {pagina} de {totalPaginas} ({total}{" "}
          {total === 1 ? "registro" : "registros"})
        </span>
        {pagina < totalPaginas && (
          <Link href={`/gerencia/acessos?pagina=${pagina + 1}`}>Próxima ›</Link>
        )}
      </nav>
    </div>
  );
}
