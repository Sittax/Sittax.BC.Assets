import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/db/rls";
import {
  buscarTopicoPorSlug,
  buscarArvore,
  buscarAnteriorProximo,
  buscarTrilha,
} from "@/lib/conteudo/consultas";
import { sanitizarMarkdown } from "@/lib/conteudo/sanitizar";
import { modulo, produto, usuario } from "@/lib/db/schema";
import { BaseEditor } from "../componentes/BaseEditor";

export const dynamic = "force-dynamic";

function ancestraisIds(
  topicoId: string,
  todos: { id: string; parentId: string | null }[],
): Set<string> {
  const mapa = new Map(todos.map((t) => [t.id, t.parentId]));
  const ids = new Set<string>();
  let id: string | null = topicoId;
  while (id !== null) {
    ids.add(id);
    id = mapa.get(id) ?? null;
  }
  return ids;
}

export default async function TopicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const [{ slug }, { modo }] = await Promise.all([params, searchParams]);
  const sessao = await getSession();
  if (!sessao) redirect("/login");

  const { userId, papel, usuario: u } = sessao;
  const produtoAtivoId = u.produtoSelecionadoId;

  if (!produtoAtivoId) redirect("/base");

  // Busca o tópico — pode ser de outro produto (edge case R7)
  const resultado = await buscarTopicoPorSlug(userId, papel, slug, produtoAtivoId);
  if (!resultado) notFound();

  const { topico: t, produtoId: produtoDonoId } = resultado;

  // T017: slug de outro produto → atualiza produto selecionado
  if (produtoDonoId !== produtoAtivoId) {
    await withUser(userId, papel, async (tx) => {
      await tx
        .update(usuario)
        .set({ produtoSelecionadoId: produtoDonoId })
        .where(eq(usuario.id, userId));
    });
  }

  const podeEditar = papel === "suporte" || papel === "dev" || papel === "master";
  const iniciarEditando = podeEditar && modo === "editar";

  // Sanitiza para leitura (server side, Constituição III)
  const conteudoSaneado = sanitizarMarkdown(t.conteudoMd, papel);

  // Dados de navegação — em paralelo
  const [arvore, anteriorProximo, trilha, nomeProduto, nomeModulo] = await Promise.all([
    buscarArvore(userId, papel, produtoDonoId),
    buscarAnteriorProximo(userId, papel, {
      id: t.id,
      parentId: t.parentId,
      moduloId: t.moduloId,
      ordem: t.ordem,
    }),
    buscarTrilha(userId, papel, t.id),
    withUser(userId, papel, async (tx) => {
      const rows = await tx.select({ nome: produto.nome }).from(produto).where(eq(produto.id, produtoDonoId));
      return rows[0]?.nome ?? "";
    }),
    withUser(userId, papel, async (tx) => {
      const rows = await tx.select({ nome: modulo.nome }).from(modulo).where(eq(modulo.id, t.moduloId));
      return rows[0]?.nome ?? "";
    }),
  ]);

  const todosTopicos = arvore.flatMap(function flat(mod): { id: string; parentId: string | null }[] {
    return mod.topicos.flatMap(function flatTopico(item): { id: string; parentId: string | null }[] {
      return [{ id: item.id, parentId: item.parentId }, ...(item.filhos ?? []).flatMap(flatTopico)];
    });
  });

  return (
    <BaseEditor
      topicoId={t.id}
      slug={slug}
      titulo={t.titulo}
      conteudoMd={podeEditar ? t.conteudoMd : ""}
      conteudoSaneado={conteudoSaneado}
      arvore={arvore}
      ancestraisIds={ancestraisIds(t.id, todosTopicos)}
      produtoId={produtoDonoId}
      papel={papel}
      nomeProduto={nomeProduto}
      nomeModulo={nomeModulo}
      trilha={trilha}
      anteriorProximo={anteriorProximo}
      iniciarEditando={iniciarEditando}
    />
  );
}
