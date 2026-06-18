import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { trilhaDoProduto } from "@/lib/ead/trilha";
import { GestaoEad } from "../componentes/GestaoEad";

export const dynamic = "force-dynamic";

export default async function GestaoEadPage() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { userId, papel, usuario: u } = sessao;

  if (papel !== "dev" && papel !== "master") {
    return (
      <div className="curso-pagina">
        <h1>Acesso negado</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
          Esta área é exclusiva para desenvolvedores e masters.
        </p>
      </div>
    );
  }

  const produtoId = u.produtoSelecionadoId;

  if (!produtoId) {
    return (
      <div className="curso-pagina">
        <h1>Gestão Cursos</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
          Selecione um produto no seletor acima para gerenciar os cursos.
        </p>
      </div>
    );
  }

  const modulos = await trilhaDoProduto(produtoId, userId, papel);

  return (
    <div className="curso-pagina">
      <div className="curso-gestao-cabecalho">
        <Link href="/cursos" className="curso-gestao-voltar" title="Voltar à trilha">
          <ArrowLeft size={16} />
        </Link>
        <h1>Gestão Cursos</h1>
      </div>

      <GestaoEad produtoId={produtoId} modulosIniciais={modulos} />
    </div>
  );
}
