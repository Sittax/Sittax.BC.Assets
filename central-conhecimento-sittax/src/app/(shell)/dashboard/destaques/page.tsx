import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { topicosDoProduto, destaquesFixados } from "@/lib/dashboard/consultas";
import { EditorDestaques } from "./EditorDestaques";

export const dynamic = "force-dynamic";

export default async function DestaquesPage() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { papel, usuario: u } = sessao;
  if (papel !== "dev" && papel !== "master") redirect("/dashboard");

  const produtoId = u.produtoSelecionadoId;
  if (!produtoId) redirect("/dashboard");

  const [todoTopicos, fixados] = await Promise.all([
    topicosDoProduto(produtoId),
    destaquesFixados(produtoId),
  ]);

  return (
    <div className="dest-pagina">
      <div className="dest-topo">
        <Link href="/dashboard" className="curso-modulo-voltar">
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <h1 className="dest-titulo">Destaques da base</h1>
        <p className="dest-sub">
          Escolha até 4 tópicos que aparecem no bloco "Destaques da base" do dashboard.
          Sem seleção, os 4 mais recentes são exibidos automaticamente.
        </p>
      </div>

      <EditorDestaques
        produtoId={produtoId}
        todoTopicos={todoTopicos}
        selecionadosIniciais={fixados}
      />
    </div>
  );
}
