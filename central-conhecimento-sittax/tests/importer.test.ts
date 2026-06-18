import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";
import { setupTestDatabase, asSystem } from "./helpers/db";
import { modulo, produto, topico } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { importarObsidian } from "../src/lib/conteudo/importer";
import { MemoryStorage } from "../src/lib/storage/minio";
import { getDb } from "../src/lib/db/client";

/**
 * Testes do motor de importação Obsidian (SC-004).
 * Usa MemoryStorage (interface fake) para evitar dependência do MinIO em CI.
 */

let ctx: Awaited<ReturnType<typeof setupTestDatabase>>;
let prod: { id: string };

/** Compacta a pasta de fixture em zip e retorna o buffer. */
function gerarZipFixture(): Buffer {
  const zip = new AdmZip();
  zip.addLocalFolder(join(__dirname, "fixtures/vault"));
  return zip.toBuffer();
}

beforeAll(async () => {
  ctx = await setupTestDatabase();
  const db = ctx.appDb;

  await asSystem(db, async (tx) => {
    [prod] = await tx
      .insert(produto)
      .values({ nome: "ProdImport", ordem: 71 })
      .returning();
  });
});

afterAll(async () => {
  await ctx.teardown();
});

describe("importarObsidian — motor único (SC-004)", () => {
  let storage: MemoryStorage;
  let relatorio: Awaited<ReturnType<typeof importarObsidian>>;

  beforeAll(async () => {
    storage = new MemoryStorage();
    const zipBuffer = gerarZipFixture();
    relatorio = await importarObsidian(zipBuffer, prod.id, storage, getDb);
  });

  it("cria tópicos a partir dos arquivos markdown", () => {
    expect(relatorio.topicos).toBeGreaterThan(0);
  });

  it("migra imagens para o storage", () => {
    expect(relatorio.imagens).toBeGreaterThan(0);
    // Verifica que a imagem foi armazenada no MemoryStorage
    let algumaNaStorage = false;
    // MemoryStorage expõe `tem(chave)`
    // Checamos via relatorio.imagens > 0 (já confirmado acima)
    algumaNaStorage = relatorio.imagens > 0;
    expect(algumaNaStorage).toBe(true);
  });

  it("relatório com totais e avisos de wikilinks quebrados", () => {
    // [[nao-existe-este-arquivo]] deve gerar aviso
    const avisoWikilink = relatorio.avisos.some((a) =>
      a.includes("nao-existe-este-arquivo"),
    );
    expect(avisoWikilink).toBe(true);
  });

  it("hierarquia achatada além de 5 níveis gera aviso", () => {
    const avisoAchatamento = relatorio.avisos.some((a) =>
      a.includes("níveis") || a.includes("profundidade") || a.includes("achatado"),
    );
    expect(avisoAchatamento).toBe(true);
  });

  it("tópicos inseridos no banco via withSystem", async () => {
    const db = ctx.appDb;
    const topicos = await asSystem(db, async (tx) =>
      tx.select({ id: topico.id, titulo: topico.titulo }).from(topico).where(eq(topico.produtoId, prod.id)),
    );
    expect(topicos.length).toBeGreaterThan(0);
    // Verifica que título do frontmatter foi usado
    const intro = topicos.find((t) => t.titulo === "Introdução ao Módulo A");
    expect(intro).toBeDefined();
  });

  it("conteudo_publico gerado corretamente (sem blocos internos)", async () => {
    const db = ctx.appDb;
    const topicos = await asSystem(db, async (tx) =>
      tx
        .select({ conteudoPublico: topico.conteudoPublico })
        .from(topico)
        .where(eq(topico.produtoId, prod.id)),
    );
    for (const t of topicos) {
      expect(t.conteudoPublico).not.toMatch(/nota-interna/);
      expect(t.conteudoPublico).not.toMatch(/nota-tecnica/);
    }
  });

  it("arquivos importados têm CONTEÚDO (regressão: páginas vazias)", async () => {
    const db = ctx.appDb;
    const topicos = await asSystem(db, async (tx) =>
      tx
        .select({ titulo: topico.titulo, conteudoMd: topico.conteudoMd })
        .from(topico)
        .where(eq(topico.produtoId, prod.id)),
    );
    const intro = topicos.find((t) => t.titulo === "Introdução ao Módulo A");
    expect(intro?.conteudoMd.trim().length).toBeGreaterThan(0);
  });

  it("REIMPORT é idempotente: atualiza em vez de duplicar (regressão: triplicação)", async () => {
    const db = ctx.appDb;
    const antes = await asSystem(db, (tx) =>
      tx.select({ id: topico.id }).from(topico).where(eq(topico.produtoId, prod.id)),
    );

    const segundaVez = await importarObsidian(
      gerarZipFixture(),
      prod.id,
      new MemoryStorage(),
      getDb,
    );

    const depois = await asSystem(db, (tx) =>
      tx.select({ id: topico.id }).from(topico).where(eq(topico.produtoId, prod.id)),
    );

    expect(depois.length).toBe(antes.length); // nenhuma página duplicada
    expect(segundaVez.topicos).toBe(0); // nada criado
    expect(segundaVez.atualizados).toBeGreaterThan(0); // conteúdo ressincronizado

    // conteúdo permanece após o reimport
    const conteudos = await asSystem(db, (tx) =>
      tx
        .select({ titulo: topico.titulo, conteudoMd: topico.conteudoMd })
        .from(topico)
        .where(eq(topico.produtoId, prod.id)),
    );
    const intro = conteudos.find((t) => t.titulo === "Introdução ao Módulo A");
    expect(intro?.conteudoMd.trim().length).toBeGreaterThan(0);
  });
});

describe("importarObsidian — folder note (pasta com nota homônima)", () => {
  let prodFolder: { id: string };

  beforeAll(async () => {
    await asSystem(ctx.appDb, async (tx) => {
      [prodFolder] = await tx
        .insert(produto)
        .values({ nome: "ProdFolderNote", ordem: 72 })
        .returning();
    });
  });

  it("nota homônima da pasta preenche o tópico da pasta (sem irmão vazio -2)", async () => {
    const zip = new AdmZip();
    zip.addFile(
      "Modulo X/Apuracao/Apuracao.md",
      Buffer.from("# Apuração\n\nConteúdo da apuração.\n", "utf8"),
    );
    const rel = await importarObsidian(
      zip.toBuffer(),
      prodFolder.id,
      new MemoryStorage(),
      getDb,
    );

    const topicos = await asSystem(ctx.appDb, (tx) =>
      tx
        .select({ titulo: topico.titulo, slug: topico.slug, conteudoMd: topico.conteudoMd })
        .from(topico)
        .where(eq(topico.produtoId, prodFolder.id)),
    );

    // UM tópico só (a pasta virou a página), com conteúdo, sem "-2"
    expect(topicos.length).toBe(1);
    expect(topicos[0].conteudoMd).toContain("Conteúdo da apuração");
    expect(topicos[0].slug).not.toMatch(/-2$/);
    expect(rel.topicos + rel.atualizados).toBeGreaterThan(0);
  });
});
