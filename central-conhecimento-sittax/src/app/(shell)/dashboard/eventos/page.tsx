import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { eventosParaGestao } from "@/lib/dashboard/consultas";
import { papelPodeGerirEvento } from "@/lib/eventos/validacao";
import { GestaoEventos } from "../componentes/GestaoEventos";

export const dynamic = "force-dynamic";

export default async function GestaoEventosPage() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  // Gate server-side (FR-014/FR-018) — a RLS nega por baixo de qualquer forma
  if (!papelPodeGerirEvento(sessao.papel)) notFound();

  // Suporte+ recebe tudo da RLS; o corte futuro × histórico é apresentação
  // (clarify 2026-06-11: o passado fica no histórico, nada é apagado)
  const eventos = await eventosParaGestao(sessao.userId, sessao.papel);
  const agora = Date.now();
  const proximos = eventos
    .filter((e) => e.fim.getTime() >= agora)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const historico = eventos.filter((e) => e.fim.getTime() < agora);

  return (
    <div className="notas-pagina">
      <div className="notas-header">
        <h1>Gestão de eventos</h1>
        <Link href="/dashboard" className="editor-voltar">
          ← Dashboard
        </Link>
      </div>
      <GestaoEventos proximos={proximos} historico={historico} />
    </div>
  );
}
