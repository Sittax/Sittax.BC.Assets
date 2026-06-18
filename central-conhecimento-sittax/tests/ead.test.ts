/**
 * REGRAS CRÍTICAS (FR-016/SC-003): inscrição única, idempotência, gate,
 * % derivado, nenhum caminho grava status='concluido'.
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
import { youtubeIdSchema, embedUrl } from "../src/lib/ead/youtube";

let ctx: Awaited<ReturnType<typeof setupTestDatabase>>;

let prod1: { id: string };
let uPadrao: { id: string };
let uPadrao2: { id: string };
let eadMod1: { id: string };
let eadMod2: { id: string };
let aula1: { id: string };
let aula2: { id: string };
let aula3: { id: string };

beforeAll(async () => {
  ctx = await setupTestDatabase();
  const db = ctx.appDb;

  await asSystem(db, async (tx) => {
    const escritorioA = (
      await tx
        .insert(escritorio)
        .values({ cnpj: "22333444000195", nome: "Escritório EAD" })
        .returning()
    )[0];

    [prod1] = await tx
      .insert(produto)
      .values({ nome: "Produto EAD Teste", ordem: 10 })
      .returning();

    await tx
      .insert(escritorioProduto)
      .values({ escritorioId: escritorioA.id, produtoId: prod1.id });

    [uPadrao] = await tx
      .insert(usuario)
      .values({
        nome: "Paula",
        email: "paula-ead@teste.dev",
        papel: "padrao",
        origem: "sistema",
        escritorioId: escritorioA.id,
      })
      .returning();

    [uPadrao2] = await tx
      .insert(usuario)
      .values({
        nome: "Pedro",
        email: "pedro-ead@teste.dev",
        papel: "padrao",
        origem: "sistema",
        escritorioId: escritorioA.id,
      })
      .returning();

    [eadMod1] = await tx
      .insert(eadModulo)
      .values({ produtoId: prod1.id, nome: "Módulo 1", ordem: 1 })
      .returning();

    [eadMod2] = await tx
      .insert(eadModulo)
      .values({ produtoId: prod1.id, nome: "Módulo 2", ordem: 2 })
      .returning();

    [aula1] = await tx
      .insert(aula)
      .values({
        eadModuloId: eadMod1.id,
        titulo: "Aula 1",
        youtubeId: "dQw4w9WgXcQ",
        descricaoMd: "",
        ordem: 1,
      })
      .returning();

    [aula2] = await tx
      .insert(aula)
      .values({
        eadModuloId: eadMod1.id,
        titulo: "Aula 2",
        youtubeId: "9bZkp7q19f0",
        descricaoMd: "",
        ordem: 2,
      })
      .returning();

    [aula3] = await tx
      .insert(aula)
      .values({
        eadModuloId: eadMod2.id,
        titulo: "Aula 3",
        youtubeId: "M7lc1UVf-VE",
        descricaoMd: "",
        ordem: 1,
      })
      .returning();
  });
});

afterAll(async () => {
  await ctx?.teardown();
});

// ─── youtube.ts ───────────────────────────────────────────────────────────────

describe("youtubeIdSchema — extração e validação", () => {
  it("aceita ID puro de 11 chars", () => {
    expect(youtubeIdSchema.parse("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrai de watch?v= URL", () => {
    expect(youtubeIdSchema.parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrai de youtu.be/ URL", () => {
    expect(youtubeIdSchema.parse("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejeita ID com menos de 11 chars", () => {
    expect(() => youtubeIdSchema.parse("abc")).toThrow();
  });

  it("rejeita URL sem parâmetro v", () => {
    expect(() => youtubeIdSchema.parse("https://www.youtube.com/watch")).toThrow();
  });

  it("rejeita string vazia", () => {
    expect(() => youtubeIdSchema.parse("")).toThrow();
  });

  it("embedUrl monta URL youtube-nocookie com enablejsapi=1", () => {
    const url = embedUrl("dQw4w9WgXcQ");
    expect(url).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1");
  });
});

// ─── Inscrição ────────────────────────────────────────────────────────────────

describe("inscrição — idempotência e isolamento", () => {
  it("cria inscrição para usuário no módulo", async () => {
    const [insc] = await asSystem(ctx.appDb, async (tx) => {
      return tx
        .insert(inscricaoEad)
        .values({
          usuarioId: uPadrao.id,
          produtoId: prod1.id,
          eadModuloId: eadMod1.id,
          interno: false,
          status: "em_andamento",
        })
        .returning();
    });
    expect(insc.id).toBeTruthy();
    expect(insc.status).toBe("em_andamento");
  });

  it("ON CONFLICT DO NOTHING — clique repetido não duplica (unique parcial por módulo, 0007)", async () => {
    const antes = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(inscricaoEad)
        .where(
          and(
            eq(inscricaoEad.usuarioId, uPadrao.id),
            eq(inscricaoEad.eadModuloId, eadMod1.id),
          ),
        ),
    );

    await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(inscricaoEad)
        .values({
          usuarioId: uPadrao.id,
          produtoId: prod1.id,
          eadModuloId: eadMod1.id,
          interno: false,
        })
        .onConflictDoNothing(),
    );

    const depois = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(inscricaoEad)
        .where(
          and(
            eq(inscricaoEad.usuarioId, uPadrao.id),
            eq(inscricaoEad.eadModuloId, eadMod1.id),
          ),
        ),
    );

    expect(depois.length).toBe(antes.length);
  });

  it("nenhum caminho desta fase grava status='concluido' — UPDATE negado por RLS (42501)", async () => {
    const [insc] = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(inscricaoEad)
        .where(
          and(
            eq(inscricaoEad.usuarioId, uPadrao.id),
            eq(inscricaoEad.produtoId, prod1.id),
          ),
        ),
    );

    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .update(inscricaoEad)
          .set({ status: "concluido" })
          .where(eq(inscricaoEad.id, insc.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));

    // nem dev consegue
    await expect(
      asUser(ctx.appDb, uPadrao.id, "dev", (tx) =>
        tx
          .update(inscricaoEad)
          .set({ status: "concluido" })
          .where(eq(inscricaoEad.id, insc.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("isolamento: uPadrao2 não tem inscrição de uPadrao", async () => {
    const rows = await asUser(ctx.appDb, uPadrao2.id, "padrao", (tx) =>
      tx
        .select()
        .from(inscricaoEad)
        .where(eq(inscricaoEad.usuarioId, uPadrao.id)),
    );
    expect(rows.length).toBe(0);
  });
});

// ─── Progresso / marcação idempotente ────────────────────────────────────────

describe("progresso — idempotência e cálculo de %", () => {
  it("marcar aula vista cria registro de progresso", async () => {
    await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .insert(progressoAula)
        .values({ usuarioId: uPadrao.id, aulaId: aula1.id })
        .onConflictDoNothing(),
    );

    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .select()
        .from(progressoAula)
        .where(
          and(
            eq(progressoAula.usuarioId, uPadrao.id),
            eq(progressoAula.aulaId, aula1.id),
          ),
        ),
    );
    expect(rows.length).toBe(1);
  });

  it("marcar mesma aula 2x = 1 registro (idempotente)", async () => {
    await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .insert(progressoAula)
        .values({ usuarioId: uPadrao.id, aulaId: aula1.id })
        .onConflictDoNothing(),
    );

    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .select()
        .from(progressoAula)
        .where(
          and(
            eq(progressoAula.usuarioId, uPadrao.id),
            eq(progressoAula.aulaId, aula1.id),
          ),
        ),
    );
    expect(rows.length).toBe(1);
  });

  it("sem inscrição: INSERT em progresso negado para outro usuário (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(progressoAula).values({
          usuarioId: uPadrao2.id,
          aulaId: aula1.id,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("% = 0 antes de marcar qualquer aula (uPadrao2 sem progresso)", async () => {
    const rows = await asUser(ctx.appDb, uPadrao2.id, "padrao", (tx) =>
      tx
        .select()
        .from(progressoAula)
        .where(eq(progressoAula.usuarioId, uPadrao2.id)),
    );
    expect(rows.length).toBe(0);
  });

  it("excluir aula vista remove progresso em cascata (ON DELETE CASCADE)", async () => {
    // Cria uma aula temporária e marca como vista
    const [aulaTemp] = await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(aula)
        .values({
          eadModuloId: eadMod1.id,
          titulo: "Aula Temp",
          youtubeId: "zzzzzzzzzzz",
          descricaoMd: "",
          ordem: 99,
        })
        .returning(),
    );

    await asSystem(ctx.appDb, (tx) =>
      tx.insert(progressoAula).values({
        usuarioId: uPadrao.id,
        aulaId: aulaTemp.id,
      }),
    );

    // Confirma que existe progresso
    const antes = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(progressoAula)
        .where(eq(progressoAula.aulaId, aulaTemp.id)),
    );
    expect(antes.length).toBe(1);

    // Exclui a aula (via system — dev/master teriam permissão)
    await asSystem(ctx.appDb, (tx) =>
      tx.delete(aula).where(eq(aula.id, aulaTemp.id)),
    );

    // Progresso deve ter sido removido em cascata
    const depois = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(progressoAula)
        .where(eq(progressoAula.aulaId, aulaTemp.id)),
    );
    expect(depois.length).toBe(0);
  });

  it("inscrição a 100% das aulas permanece em_andamento", async () => {
    // Marca todas as aulas como vistas
    await asSystem(ctx.appDb, async (tx) => {
      for (const aulaRow of [aula1, aula2, aula3]) {
        await tx
          .insert(progressoAula)
          .values({ usuarioId: uPadrao.id, aulaId: aulaRow.id })
          .onConflictDoNothing();
      }
    });

    // Status ainda deve ser em_andamento (nenhum caminho altera)
    const [insc] = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(inscricaoEad)
        .where(
          and(
            eq(inscricaoEad.usuarioId, uPadrao.id),
            eq(inscricaoEad.produtoId, prod1.id),
          ),
        ),
    );
    expect(insc.status).toBe("em_andamento");
  });

  it("isolamento de progresso: uPadrao2 não vê progresso de uPadrao", async () => {
    const rows = await asUser(ctx.appDb, uPadrao2.id, "padrao", (tx) =>
      tx
        .select()
        .from(progressoAula)
        .where(eq(progressoAula.usuarioId, uPadrao.id)),
    );
    expect(rows.length).toBe(0);
  });
});
