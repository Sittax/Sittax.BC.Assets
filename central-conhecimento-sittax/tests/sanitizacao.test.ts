import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { sanitizarMarkdown } from "../src/lib/conteudo/sanitizar";
import { setupTestDatabase, asSystem } from "./helpers/db";
import { modulo, produto, topico } from "../src/lib/db/schema";

/**
 * REGRA CRÍTICA (Constituição III / Princípio III):
 * Nenhum byte de nota-interna ou nota-tecnica pode sair pelo caminho de leitura
 * para papel padrão — nem em conteúdo de página nem em resultados de busca.
 */

// ─── Parte 1: testes unitários da função única ────────────────────────────────

describe("sanitizarMarkdown — unitário", () => {
  const mdComBlocos = `# Título

Parágrafo público.

:::nota-interna
Conteúdo interno — só suporte.
:::

:::nota-tecnica
Detalhe técnico — só dev/master.
:::

:::video
https://exemplo.com/video123
:::

Rodapé público.
`;

  it("papel padrão: remove nota-interna e nota-tecnica", () => {
    const resultado = sanitizarMarkdown(mdComBlocos, "padrao");
    expect(resultado).not.toMatch(/nota-interna/);
    expect(resultado).not.toMatch(/Conteúdo interno/);
    expect(resultado).not.toMatch(/nota-tecnica/);
    expect(resultado).not.toMatch(/Detalhe técnico/);
  });

  it("papel padrão: preserva :::video", () => {
    const resultado = sanitizarMarkdown(mdComBlocos, "padrao");
    expect(resultado).toMatch(/video/);
  });

  it("papel padrão: preserva conteúdo público", () => {
    const resultado = sanitizarMarkdown(mdComBlocos, "padrao");
    expect(resultado).toMatch(/Parágrafo público/);
    expect(resultado).toMatch(/Rodapé público/);
  });

  it("papel suporte: mantém nota-interna e nota-tecnica", () => {
    const resultado = sanitizarMarkdown(mdComBlocos, "suporte");
    expect(resultado).toMatch(/nota-interna/);
    expect(resultado).toMatch(/Conteúdo interno/);
    expect(resultado).toMatch(/nota-tecnica/);
    expect(resultado).toMatch(/Detalhe técnico/);
  });

  it("papel dev: mantém todos os blocos", () => {
    const resultado = sanitizarMarkdown(mdComBlocos, "dev");
    expect(resultado).toMatch(/nota-tecnica/);
    expect(resultado).toMatch(/nota-interna/);
  });

  it("papel master: mantém todos os blocos", () => {
    const resultado = sanitizarMarkdown(mdComBlocos, "master");
    expect(resultado).toMatch(/nota-interna/);
    expect(resultado).toMatch(/nota-tecnica/);
  });

  it("directive sem fechamento (fail-closed): conteúdo não vaza para padrão", () => {
    const mdMalformado = `# Título

:::nota-interna
Este conteúdo não tem fechamento — deve ser engolido.

Mais texto sem fechar o bloco.
`;
    const resultado = sanitizarMarkdown(mdMalformado, "padrao");
    expect(resultado).not.toMatch(/Este conteúdo não tem fechamento/);
    expect(resultado).not.toMatch(/Mais texto sem fechar/);
  });

  it("markdown sem blocos internos: retorna sem alterar conteúdo público para padrão", () => {
    const md = "# Simples\n\nApenas texto público.\n";
    const resultado = sanitizarMarkdown(md, "padrao");
    expect(resultado).toMatch(/Apenas texto público/);
    expect(resultado).not.toMatch(/nota-interna/);
  });
});

// ─── Parte 2: integração com banco (FR-013 / SC-001 / SC-007) ─────────────────

let ctx: Awaited<ReturnType<typeof setupTestDatabase>>;
let prod1: { id: string };
let prod2: { id: string };

const mdComNotas = `# Tópico com Notas

Texto público.

:::nota-interna
Segredo interno.
:::

:::nota-tecnica
Detalhe técnico secreto.
:::

Fim público.
`;

beforeAll(async () => {
  ctx = await setupTestDatabase();
  const db = ctx.appDb;

  await asSystem(db, async (tx) => {
    [prod1] = await tx
      .insert(produto)
      .values({ nome: "Prod Sanit 1", ordem: 91 })
      .returning();
    [prod2] = await tx
      .insert(produto)
      .values({ nome: "Prod Sanit 2", ordem: 92 })
      .returning();

    const [m1] = await tx
      .insert(modulo)
      .values({ produtoId: prod1.id, nome: "Módulo Teste", ordem: 1 })
      .returning();

    const [m2] = await tx
      .insert(modulo)
      .values({ produtoId: prod2.id, nome: "Módulo P2", ordem: 1 })
      .returning();

    await tx.insert(topico).values({
      moduloId: m1.id,
      produtoId: prod1.id,
      titulo: "Tópico com Notas",
      slug: "topico-com-notas-s",
      conteudoMd: mdComNotas,
      conteudoPublico: sanitizarMarkdown(mdComNotas, "padrao"),
      ordem: 1,
    });

    const mdPub = "# Só produto 2\n\nExclusivo produto dois.\n";
    await tx.insert(topico).values({
      moduloId: m2.id,
      produtoId: prod2.id,
      titulo: "Só produto 2",
      slug: "so-produto-2-s",
      conteudoMd: mdPub,
      conteudoPublico: sanitizarMarkdown(mdPub, "padrao"),
      ordem: 1,
    });
  });
});

afterAll(async () => {
  await ctx.teardown();
});

describe("sanitizarMarkdown — integração de leitura (FR-013)", () => {
  it("conteudo_publico não contém bytes de nota-interna ou nota-tecnica", async () => {
    const db = ctx.appDb;
    const rows = await asSystem(db, async (tx) =>
      tx
        .select({ conteudoPublico: topico.conteudoPublico })
        .from(topico)
        .where(eq(topico.produtoId, prod1.id)),
    );
    const pub = rows[0].conteudoPublico;
    expect(pub).not.toMatch(/nota-interna/);
    expect(pub).not.toMatch(/Segredo interno/);
    expect(pub).not.toMatch(/nota-tecnica/);
    expect(pub).not.toMatch(/Detalhe técnico secreto/);
    expect(pub).toMatch(/Texto público/);
  });

  it("conteudo_md completo preservado (suporte vê tudo)", async () => {
    const db = ctx.appDb;
    const rows = await asSystem(db, async (tx) =>
      tx
        .select({ conteudoMd: topico.conteudoMd })
        .from(topico)
        .where(eq(topico.produtoId, prod1.id)),
    );
    expect(rows[0].conteudoMd).toMatch(/Segredo interno/);
    expect(rows[0].conteudoMd).toMatch(/Detalhe técnico secreto/);
  });
});

describe("busca FTS — papel e isolamento por produto (SC-007)", () => {
  it("busca de termo-interno via tsv_publico: zero resultados (padrão não encontra)", async () => {
    const db = ctx.appDb;
    const result = await asSystem(db, async (tx) =>
      tx.execute(
        sql`SELECT id FROM topico
            WHERE produto_id = ${prod1.id}
              AND tsv_publico @@ plainto_tsquery('portuguese', 'Segredo')`,
      ),
    );
    expect((result as unknown as { rows: unknown[] }).rows.length).toBe(0);
  });

  it("busca de termo-interno via tsv_completo: suporte encontra", async () => {
    const db = ctx.appDb;
    const result = await asSystem(db, async (tx) =>
      tx.execute(
        sql`SELECT id FROM topico
            WHERE produto_id = ${prod1.id}
              AND tsv_completo @@ plainto_tsquery('portuguese', 'Segredo')`,
      ),
    );
    expect((result as unknown as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
  });

  it("busca com produto 1 ativo não retorna tópico do produto 2 (isolamento)", async () => {
    const db = ctx.appDb;
    // "Exclusivo" existe só no produto 2
    const result = await asSystem(db, async (tx) =>
      tx.execute(
        sql`SELECT id FROM topico
            WHERE produto_id = ${prod1.id}
              AND tsv_publico @@ plainto_tsquery('portuguese', 'Exclusivo')`,
      ),
    );
    expect((result as unknown as { rows: unknown[] }).rows.length).toBe(0);
  });

  it("busca de 'Exclusivo' no produto 2 encontra o tópico correto", async () => {
    const db = ctx.appDb;
    const result = await asSystem(db, async (tx) =>
      tx.execute(
        sql`SELECT id FROM topico
            WHERE produto_id = ${prod2.id}
              AND tsv_publico @@ plainto_tsquery('portuguese', 'Exclusivo')`,
      ),
    );
    expect((result as unknown as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
  });
});
