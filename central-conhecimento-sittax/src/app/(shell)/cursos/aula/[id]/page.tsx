import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { aulaComContexto } from "@/lib/ead/trilha";
import { registrarAcessoAula } from "@/lib/ead/acesso";
import { sanitizarMarkdown } from "@/lib/conteudo/sanitizar";
import { PlayerLayout } from "./componentes/PlayerLayout";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AulaPage({ params }: Props) {
  const { id } = await params;
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { userId, papel } = sessao;

  const ctx = await aulaComContexto(id, userId, papel);
  if (!ctx) notFound();

  // Registra acesso para retomada do dashboard (no-op sem inscrição em andamento)
  await registrarAcessoAula(ctx.aula.id, userId, papel);

  const descricaoHtml = sanitizarMarkdown(ctx.aula.descricaoMd, papel);

  return (
    <PlayerLayout
      aulaId={ctx.aula.id}
      aulaOrdem={ctx.todasAulas.findIndex((a) => a.id === ctx.aula.id) + 1}
      aulaTitulo={ctx.aula.titulo}
      aulaYoutubeId={ctx.aula.youtubeId}
      aulaDescricaoHtml={descricaoHtml}
      aulaVista={ctx.aula.vista}
      moduloId={ctx.modulo.id}
      moduloNome={ctx.modulo.nome}
      todasAulas={ctx.todasAulas.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        ordem: a.ordem,
        vista: a.vista,
      }))}
      anteriorId={ctx.anterior?.id ?? null}
      proximoId={ctx.proxima?.id ?? null}
      materiais={ctx.materiais}
      anotacoesIniciais={ctx.anotacoes}
    />
  );
}
