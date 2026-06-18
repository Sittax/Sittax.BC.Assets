import AdmZip from "adm-zip";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";
import { withSystem, type Tx } from "@/lib/db/rls";
import { modulo, topico } from "@/lib/db/schema";
import { sanitizarMarkdown } from "./sanitizar";
import type { Storage } from "@/lib/storage/minio";
import { and, eq } from "drizzle-orm";

const MAX_DEPTH = 5;

export interface RelatorioImport {
  /** Tópicos criados nesta execução. */
  topicos: number;
  /** Tópicos já existentes que tiveram o conteúdo atualizado (reimport). */
  atualizados: number;
  imagens: number;
  avisos: string[];
}

/** Normaliza o nome do arquivo em slug. */
function nomeParaSlug(nome: string): string {
  const slugger = new GithubSlugger();
  const semExt = nome.replace(/\.[^.]+$/, "");
  return slugger.slug(semExt);
}

/** Substitui `[[wikilink]]` por links markdown `/base/{slug}`. */
function resolverWikilinks(
  conteudo: string,
  mapaSlug: Map<string, string>,
  avisos: string[],
): string {
  return conteudo.replace(/\[\[([^\]]+)\]\]/g, (_, nome: string) => {
    const slug = mapaSlug.get(nome.toLowerCase().trim());
    if (slug) return `[${nome}](/base/${slug})`;
    avisos.push(`Wikilink sem destino: [[${nome}]] — convertido em texto simples.`);
    return nome;
  });
}

/** Reescreve referências de imagem local no markdown. */
function reescreverImagens(
  conteudo: string,
  mapaImagem: Map<string, string>,
): string {
  return conteudo.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match: string, alt: string, src: string) => {
      const url = mapaImagem.get(src.toLowerCase().trim());
      return url ? `![${alt}](${url})` : match;
    },
  );
}

interface EntradaArquivo {
  caminho: string;
  conteudo: Buffer;
  nome: string;
  ext: string;
  partes: string[];
}

function classificarEntradas(zip: AdmZip): {
  arquivosMd: EntradaArquivo[];
  arquivosImagem: EntradaArquivo[];
} {
  const arquivosMd: EntradaArquivo[] = [];
  const arquivosImagem: EntradaArquivo[] = [];
  const imagemExts = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const caminho = entry.entryName;
    const nome = caminho.split("/").pop() ?? caminho;
    const ext = nome.includes(".") ? `.${nome.split(".").pop()!.toLowerCase()}` : "";
    const partes = caminho.split("/").filter(Boolean);
    const conteudo = entry.getData();

    if (ext === ".md") {
      arquivosMd.push({ caminho, conteudo, nome, ext, partes });
    } else if (imagemExts.has(ext)) {
      arquivosImagem.push({ caminho, conteudo, nome, ext, partes });
    }
  }

  return { arquivosMd, arquivosImagem };
}

/**
 * Motor único de importação de vault Obsidian.
 * Recebe um buffer zip e o id do produto de destino.
 * Usa `storage` injetado (interface) para armazenar imagens.
 */
export async function importarObsidian(
  zipBuffer: Buffer,
  produtoId: string,
  storage: Storage,
  getDb: () => ReturnType<typeof import("@/lib/db/client").getDb>,
): Promise<RelatorioImport> {
  const zip = new AdmZip(zipBuffer);
  const { arquivosMd, arquivosImagem } = classificarEntradas(zip);
  const avisos: string[] = [];
  const mapaSlugPorNome = new Map<string, string>();
  const mapaUrlImagem = new Map<string, string>();

  // ── Pré-cálculo de slugs para wikilinks ──────────────────────────────────
  // slug BASE por arquivo (slugger novo por nome — um slugger compartilhado
  // deduplicava entre arquivos e os links apontavam para slugs errados)
  for (const arq of arquivosMd) {
    const nomeSemExt = arq.nome.replace(/\.md$/, "");
    mapaSlugPorNome.set(nomeSemExt.toLowerCase(), nomeParaSlug(nomeSemExt));
  }

  // ── Upload de imagens ─────────────────────────────────────────────────────
  // Imagem NÃO é pré-requisito do texto: se o storage estiver indisponível,
  // para de tentar na primeira falha (um aviso único) e segue importando o
  // markdown — antes o SDK retentava por imagem e travava a requisição.
  let imagens = 0;
  let storageIndisponivel = false;
  for (const img of arquivosImagem) {
    if (storageIndisponivel) break;
    const chave = `imports/${produtoId}/${img.caminho}`;
    const mime = img.ext === ".svg" ? "image/svg+xml" : `image/${img.ext.slice(1)}`;
    try {
      await storage.salvar(chave, img.conteudo, mime);
      mapaUrlImagem.set(img.nome.toLowerCase(), `/api/arquivos/_import_${encodeURIComponent(img.caminho)}`);
      imagens++;
    } catch {
      storageIndisponivel = true;
      avisos.push(
        `Storage de imagens indisponível — ${arquivosImagem.length} imagem(ns) não migrada(s). O texto foi importado normalmente.`,
      );
    }
  }

  // ── Inserção de módulos/tópicos via withSystem ────────────────────────────
  // IDEMPOTENTE: pastas e arquivos são localizados por TÍTULO sob o mesmo
  // pai — reimport atualiza o conteúdo em vez de duplicar a árvore. Nota com
  // o mesmo nome da pasta ("folder note" do Obsidian) preenche o tópico da
  // pasta em vez de virar irmão vazio + "-2".
  let topicosCriados = 0;
  let topicosAtualizados = 0;

  await withSystem(async (tx) => {
    const modulosPorNome = new Map<string, string>();

    /** Localiza tópico-filho por título (case-insensitive) sob um pai. */
    async function filhoPorTitulo(
      parentId: string | null,
      titulo: string,
    ): Promise<{ id: string; conteudoMd: string } | null> {
      const irmaos = await tx
        .select({
          id: topico.id,
          titulo: topico.titulo,
          parentId: topico.parentId,
          conteudoMd: topico.conteudoMd,
        })
        .from(topico)
        .where(and(eq(topico.produtoId, produtoId), eq(topico.titulo, titulo)));
      return (
        irmaos.find((t) => (t.parentId ?? null) === (parentId ?? null)) ?? null
      );
    }

    for (const arq of arquivosMd) {
      const partes = arq.partes;
      const nomeModulo = partes.length > 1 ? partes[0] : "Importados";
      const caminhoTopico = partes.slice(1); // tudo menos o módulo

      // Módulo: localizado por nome (reuso) ou criado
      if (!modulosPorNome.has(nomeModulo)) {
        let mod = (
          await tx
            .select()
            .from(modulo)
            .where(and(eq(modulo.produtoId, produtoId), eq(modulo.nome, nomeModulo)))
        )[0];
        if (!mod) {
          const [novo] = await tx
            .insert(modulo)
            .values({
              produtoId,
              nome: nomeModulo,
              ordem: modulosPorNome.size + 1,
            })
            .returning();
          mod = novo;
        }
        modulosPorNome.set(nomeModulo, mod.id);
      }
      const moduloId = modulosPorNome.get(nomeModulo)!;

      if (caminhoTopico.length > MAX_DEPTH) {
        avisos.push(
          `Hierarquia excede ${MAX_DEPTH} níveis: ${arq.caminho} — achatado para o nível ${MAX_DEPTH}.`,
        );
      }

      // Tópicos intermediários (pastas): reuso por título sob o mesmo pai
      let parentId: string | null = null;
      let ultimaPasta: { id: string; nome: string } | null = null;
      const limitePastas = Math.min(caminhoTopico.length - 1, MAX_DEPTH - 1);
      for (let i = 0; i < limitePastas; i++) {
        const nomePasta = caminhoTopico[i];
        const existente = await filhoPorTitulo(parentId, nomePasta);
        if (existente) {
          parentId = existente.id;
        } else {
          const slugPasta = await gerarSlugUnicoTx(tx, produtoId, nomePasta);
          const novos: { id: string }[] = await tx
            .insert(topico)
            .values({
              moduloId,
              produtoId,
              parentId,
              titulo: nomePasta,
              slug: slugPasta,
              conteudoMd: "",
              conteudoPublico: "",
              ordem: i + 1,
            })
            .returning({ id: topico.id });
          parentId = novos[0].id;
          topicosCriados++;
        }
        ultimaPasta = { id: parentId, nome: nomePasta };
      }

      // Processa o arquivo markdown
      const texto = arq.conteudo.toString("utf8");
      const parsed = matter(texto);
      const nomeArquivo = arq.nome.replace(/\.md$/, "");
      const titulo = (parsed.data.title as string | undefined) ?? nomeArquivo;
      let conteudoMd = parsed.content;

      conteudoMd = resolverWikilinks(conteudoMd, mapaSlugPorNome, avisos);
      conteudoMd = reescreverImagens(conteudoMd, mapaUrlImagem);
      const conteudoPublico = sanitizarMarkdown(conteudoMd, "padrao");

      // Alvo da atualização: folder note (arquivo homônimo da pasta) → o
      // tópico da própria pasta; senão, tópico de mesmo título sob o pai
      const ehFolderNote =
        ultimaPasta !== null &&
        nomeArquivo.toLowerCase() === ultimaPasta.nome.toLowerCase();

      const alvo = ehFolderNote
        ? { id: ultimaPasta!.id, conteudoMd: "" }
        : await filhoPorTitulo(parentId, titulo);

      if (alvo) {
        await tx
          .update(topico)
          .set({ titulo, conteudoMd, conteudoPublico })
          .where(eq(topico.id, alvo.id));
        topicosAtualizados++;
        if (!ehFolderNote && alvo.conteudoMd !== conteudoMd) {
          avisos.push(`Atualizado (já existia): "${titulo}".`);
        }
      } else {
        const slug = await gerarSlugUnicoTx(tx, produtoId, titulo);
        await tx.insert(topico).values({
          moduloId,
          produtoId,
          parentId,
          titulo,
          slug,
          conteudoMd,
          conteudoPublico,
          ordem: topicosCriados + 1,
        });
        topicosCriados++;
      }
    }
  });

  return {
    topicos: topicosCriados,
    atualizados: topicosAtualizados,
    imagens,
    avisos,
  };
}

/** Gera slug único por produto dentro de uma transação. */
async function gerarSlugUnicoTx(tx: Tx, produtoId: string, titulo: string): Promise<string> {
  const slugger = new GithubSlugger();
  const base = slugger.slug(titulo);
  const existentes = await tx
    .select({ slug: topico.slug })
    .from(topico)
    .where(and(eq(topico.produtoId, produtoId)));

  const set = new Set(existentes.map((r) => r.slug));
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
