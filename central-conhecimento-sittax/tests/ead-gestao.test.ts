/**
 * REGRA CRÍTICA (FR-004/SC-004): gate dev/master — suporte e padrão negados.
 * Exclusão de módulo só se vazio. Criação de aula com URL válida e inválida.
 * Excluir aula vista remove progresso em cascata.
 */
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  aula,
  eadModulo,
  escritorio,
  escritorioProduto,
  inscricaoEad,
  produto,
  progressoAula,
  usuario,
} from "../src/lib/db/schema";
import { asSystem, asUser, comCodigoPg, setupTestDatabase } from "./helpers/db";
import { youtubeIdSchema } from "../src/lib/ead/youtube";

let ctx: Awaited<ReturnType<typeof setupTestDatabase>>;

let prod1: { id: string };
let uPadrao: { id: string };
let uSuporte: { id: string };
let uDev: { id: string };
let uMaster: { id: string };
let eadMod1: { id: string };
let aula1: { id: string };

beforeAll(async () => {
  ctx = await setupTestDatabase();
  const db = ctx.appDb;

  await asSystem(db, async (tx) => {
    const esc = (
      await tx
        .insert(escritorio)
        .values({ cnpj: "33444555000130", nome: "Escritório Gestão" })
        .returning()
    )[0];

    [prod1] = await tx
      .insert(produto)
      .values({ nome: "Produto Gestão EAD", ordem: 11 })
      .returning();

    await tx
      .insert(escritorioProduto)
      .values({ escritorioId: esc.id, produtoId: prod1.id });

    [uPadrao] = await tx
      .insert(usuario)
      .values({
        nome: "Paula Gestão",
        email: "paula-gestao@teste.dev",
        papel: "padrao",
        origem: "sistema",
        escritorioId: esc.id,
      })
      .returning();

    [uSuporte] = await tx
      .insert(usuario)
      .values({
        nome: "Saulo Gestão",
        email: "saulo-gestao@teste.dev",
        papel: "suporte",
        origem: "sistema",
      })
      .returning();

    [uDev] = await tx
      .insert(usuario)
      .values({
        nome: "Diego Gestão",
        email: "diego-gestao@teste.dev",
        papel: "dev",
        origem: "central",
        senhaHash: "x",
      })
      .returning();

    [uMaster] = await tx
      .insert(usuario)
      .values({
        nome: "Marta Gestão",
        email: "marta-gestao@teste.dev",
        papel: "master",
        origem: "central",
        senhaHash: "x",
      })
      .returning();

    [eadMod1] = await tx
      .insert(eadModulo)
      .values({ produtoId: prod1.id, nome: "Módulo Gestão 1", ordem: 1 })
      .returning();

    [aula1] = await tx
      .insert(aula)
      .values({
        eadModuloId: eadMod1.id,
        titulo: "Aula Gestão 1",
        youtubeId: "dQw4w9WgXcQ",
        descricaoMd: "",
        ordem: 1,
      })
      .returning();
  });
});

afterAll(async () => {
  await ctx?.teardown();
});

// ─── Gate dev/master ──────────────────────────────────────────────────────────

describe("gate de gestão — padrão e suporte são negados (42501)", () => {
  it("padrão não pode criar módulo EAD", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .insert(eadModulo)
          .values({ produtoId: prod1.id, nome: "Negado", ordem: 99 }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("suporte não pode criar módulo EAD", async () => {
    await expect(
      asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
        tx
          .insert(eadModulo)
          .values({ produtoId: prod1.id, nome: "NegadoSuporte", ordem: 99 }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("padrão não pode criar aula", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(aula).values({
          eadModuloId: eadMod1.id,
          titulo: "Negada",
          youtubeId: "xxxxxxxxxxx",
          ordem: 99,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("suporte não pode criar aula", async () => {
    await expect(
      asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
        tx.insert(aula).values({
          eadModuloId: eadMod1.id,
          titulo: "NegadaSuporte",
          youtubeId: "yyyyyyyyyyy",
          ordem: 99,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("padrão não pode excluir módulo (DELETE filtrado pela policy — 0 linhas)", async () => {
    // FOR DELETE USING filtra linhas não autorizadas (não lança 42501 — o
    // GRANT existe para dev/master); o efeito é zero linhas e o módulo intacto
    await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx.delete(eadModulo).where(eq(eadModulo.id, eadMod1.id)),
    );
    const restante = await asSystem(ctx.appDb, (tx) =>
      tx.select().from(eadModulo).where(eq(eadModulo.id, eadMod1.id)),
    );
    expect(restante).toHaveLength(1);
  });

  it("suporte não pode excluir aula (DELETE filtrado pela policy — 0 linhas)", async () => {
    await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx.delete(aula).where(eq(aula.id, aula1.id)),
    );
    const restante = await asSystem(ctx.appDb, (tx) =>
      tx.select().from(aula).where(eq(aula.id, aula1.id)),
    );
    expect(restante).toHaveLength(1);
  });
});

describe("gate de gestão — dev e master podem criar/editar/excluir", () => {
  it("dev cria módulo", async () => {
    const [m] = await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx
        .insert(eadModulo)
        .values({ produtoId: prod1.id, nome: "Módulo Dev", ordem: 10 })
        .returning(),
    );
    expect(m.id).toBeTruthy();
  });

  it("master cria aula com URL válida (youtube.ts extrai ID)", async () => {
    const youtubeId = youtubeIdSchema.parse("https://www.youtube.com/watch?v=M7lc1UVf-VE");
    expect(youtubeId).toBe("M7lc1UVf-VE");

    const [a] = await asUser(ctx.appDb, uMaster.id, "master", (tx) =>
      tx
        .insert(aula)
        .values({
          eadModuloId: eadMod1.id,
          titulo: "Aula Master",
          youtubeId,
          ordem: 50,
        })
        .returning(),
    );
    expect(a.id).toBeTruthy();
  });

  it("criação de aula com URL inválida falha na validação (youtubeIdSchema)", () => {
    expect(() => youtubeIdSchema.parse("nao-e-youtube")).toThrow();
    expect(() => youtubeIdSchema.parse("https://vimeo.com/abc")).toThrow();
  });
});

describe("exclusão de módulo — só vazio", () => {
  it("exclusão de módulo com aulas é negada pelo FK RESTRICT (23503)", async () => {
    await expect(
      asUser(ctx.appDb, uDev.id, "dev", (tx) =>
        tx.delete(eadModulo).where(eq(eadModulo.id, eadMod1.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("23503"));
  });

  it("exclusão de módulo vazio é permitida", async () => {
    const [moduloVazio] = await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(eadModulo)
        .values({ produtoId: prod1.id, nome: "Módulo Vazio", ordem: 99 })
        .returning(),
    );

    await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx.delete(eadModulo).where(eq(eadModulo.id, moduloVazio.id)),
    );

    const rows = await asSystem(ctx.appDb, (tx) =>
      tx.select().from(eadModulo).where(eq(eadModulo.id, moduloVazio.id)),
    );
    expect(rows.length).toBe(0);
  });
});

describe("excluir aula vista remove progresso + % recalcula", () => {
  it("excluir aula com progresso remove progresso em cascata", async () => {
    // Cria uma inscrição e aula temporária
    const [inscricao] = await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(inscricaoEad)
        .values({ usuarioId: uPadrao.id, produtoId: prod1.id, interno: false })
        .returning(),
    );

    const [aulaTemp] = await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(aula)
        .values({
          eadModuloId: eadMod1.id,
          titulo: "Aula Temporária",
          youtubeId: "zzzzzzzzzzz",
          ordem: 88,
        })
        .returning(),
    );

    // Marca como vista
    await asSystem(ctx.appDb, (tx) =>
      tx.insert(progressoAula).values({
        usuarioId: uPadrao.id,
        aulaId: aulaTemp.id,
      }),
    );

    // Confirma progresso
    const antes = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(progressoAula)
        .where(eq(progressoAula.aulaId, aulaTemp.id)),
    );
    expect(antes.length).toBe(1);

    // Dev exclui a aula
    await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx.delete(aula).where(eq(aula.id, aulaTemp.id)),
    );

    // Progresso removido em cascata
    const depois = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(progressoAula)
        .where(eq(progressoAula.aulaId, aulaTemp.id)),
    );
    expect(depois.length).toBe(0);
  });
});
