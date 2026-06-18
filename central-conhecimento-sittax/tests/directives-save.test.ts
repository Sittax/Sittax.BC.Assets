import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDatabase, asSystem } from "./helpers/db";
import {
  modulo,
  produto,
  topico,
  usuario,
  escritorio,
} from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { sanitizarMarkdown } from "../src/lib/conteudo/sanitizar";
import { suporteAlterouNotasTecnicas } from "../src/lib/conteudo/directives";
import { validarMovimentoTopico, temFilhos } from "../src/lib/conteudo/arvore";

/**
 * REGRA CRÍTICA (Constituição III / FR-017 / SC-002):
 * - suporte: não pode criar/alterar/excluir nota-tecnica
 * - nota-tecnica pré-existente inalterada + edição do resto → aceito
 * - dev/master: aceitos
 * - papel padrão: negado em qualquer action (RLS)
 * - mover além de 5 níveis → rejeitado
 * - mover para descendente → rejeitado
 * - excluir tópico com filhos → orientação
 * - excluir módulo com tópicos → orientação
 * - mover para módulo de outro produto → rejeitado
 */

let ctx: Awaited<ReturnType<typeof setupTestDatabase>>;
let prod1: { id: string };
let prod2: { id: string };
let mod1: { id: string };
let mod2: { id: string };
let modOutroProduto: { id: string };
let topicoComNota: { id: string };
let topicoPai: { id: string };
let topicoFilho: { id: string };
let uSuporte: { id: string };
let uDev: { id: string };

const mdComNota = `# Tópico com Nota Técnica

Texto público.

:::nota-tecnica
Detalhe técnico pré-existente.
:::

Fim.
`;

beforeAll(async () => {
  ctx = await setupTestDatabase();
  const db = ctx.appDb;

  await asSystem(db, async (tx) => {
    [prod1] = await tx
      .insert(produto)
      .values({ nome: "ProdDir1", ordem: 81 })
      .returning();
    [prod2] = await tx
      .insert(produto)
      .values({ nome: "ProdDir2", ordem: 82 })
      .returning();

    [mod1] = await tx
      .insert(modulo)
      .values({ produtoId: prod1.id, nome: "ModDir1", ordem: 1 })
      .returning();
    [mod2] = await tx
      .insert(modulo)
      .values({ produtoId: prod1.id, nome: "ModDir2", ordem: 2 })
      .returning();
    [modOutroProduto] = await tx
      .insert(modulo)
      .values({ produtoId: prod2.id, nome: "ModOutroProd", ordem: 1 })
      .returning();

    [topicoComNota] = await tx
      .insert(topico)
      .values({
        moduloId: mod1.id,
        produtoId: prod1.id,
        titulo: "Com Nota Técnica",
        slug: "com-nota-tecnica-d",
        conteudoMd: mdComNota,
        conteudoPublico: sanitizarMarkdown(mdComNota, "padrao"),
        ordem: 1,
      })
      .returning();

    [topicoPai] = await tx
      .insert(topico)
      .values({
        moduloId: mod2.id,
        produtoId: prod1.id,
        titulo: "Pai",
        slug: "topico-pai-d",
        conteudoMd: "# Pai\n",
        conteudoPublico: "# Pai\n",
        ordem: 1,
      })
      .returning();

    [topicoFilho] = await tx
      .insert(topico)
      .values({
        moduloId: mod2.id,
        produtoId: prod1.id,
        parentId: topicoPai.id,
        titulo: "Filho",
        slug: "topico-filho-d",
        conteudoMd: "# Filho\n",
        conteudoPublico: "# Filho\n",
        ordem: 1,
      })
      .returning();

    // Usuários (suporte não precisa de escritório)
    const esc = await tx
      .insert(escritorio)
      .values({ cnpj: "22333444000195", nome: "Esc Dir" })
      .returning();

    [uSuporte] = await tx
      .insert(usuario)
      .values({
        nome: "Suporte Dir",
        email: "suporte.dir@test.dev",
        papel: "suporte" as const,
        origem: "sistema" as const,
      })
      .returning();

    [uDev] = await tx
      .insert(usuario)
      .values({
        nome: "Dev Dir",
        email: "dev.dir@test.dev",
        papel: "dev" as const,
        origem: "central" as const,
        senhaHash: "x",
      })
      .returning();
  });
});

afterAll(async () => {
  await ctx.teardown();
});

// ─── Validação de nota-tecnica no save (função suporteAlterouNotasTecnicas) ──

describe("suporteAlterouNotasTecnicas — unitário (FR-017)", () => {
  const mdSemNota = "# Título\n\nTexto.\n";
  const mdComNotaA = "# Título\n\n:::nota-tecnica\nConteúdo A.\n:::\n";
  const mdComNotaB = "# Título\n\n:::nota-tecnica\nConteúdo B.\n:::\n";
  const mdComDuasNotas =
    "# Título\n\n:::nota-tecnica\nA.\n:::\n\n:::nota-tecnica\nB.\n:::\n";

  it("criar nota-tecnica (antes sem nota, depois com nota) → alterou = true", () => {
    expect(suporteAlterouNotasTecnicas(mdSemNota, mdComNotaA)).toBe(true);
  });

  it("excluir nota-tecnica → alterou = true", () => {
    expect(suporteAlterouNotasTecnicas(mdComNotaA, mdSemNota)).toBe(true);
  });

  it("alterar conteúdo de nota-tecnica → alterou = true", () => {
    expect(suporteAlterouNotasTecnicas(mdComNotaA, mdComNotaB)).toBe(true);
  });

  it("nota-tecnica inalterada + texto diferente → alterou = false", () => {
    const mdComNotaAMaisTexto =
      "# Título Novo\n\nTexto novo.\n\n:::nota-tecnica\nConteúdo A.\n:::\n";
    expect(suporteAlterouNotasTecnicas(mdComNotaA, mdComNotaAMaisTexto)).toBe(false);
  });

  it("sem nota antes e sem nota depois → alterou = false", () => {
    expect(suporteAlterouNotasTecnicas(mdSemNota, "# Novo\n\nTexto novo.\n")).toBe(false);
  });

  it("duas notas antes, duas depois iguais → alterou = false", () => {
    expect(suporteAlterouNotasTecnicas(mdComDuasNotas, mdComDuasNotas)).toBe(false);
  });

  it("duas notas antes, uma depois → alterou = true", () => {
    expect(suporteAlterouNotasTecnicas(mdComDuasNotas, mdComNotaA)).toBe(true);
  });
});

// ─── Validação de movimento de árvore ──────────────────────────────────────

describe("validarMovimentoTopico — unitário (R8 / FR-018)", () => {
  it("profundidade ≤ 5: aceito", async () => {
    const db = ctx.appDb;
    // Cria cadeia de 4 pais e verifica que o 5º nível é aceito
    let parentAtual: string | null = topicoPai.id;
    const criados: string[] = [];

    await asSystem(db, async (tx) => {
      for (let i = 1; i <= 3; i++) {
        const [t] = await tx
          .insert(topico)
          .values({
            moduloId: mod2.id,
            produtoId: prod1.id,
            parentId: parentAtual,
            titulo: `Nivel ${i + 1}`,
            slug: `nivel-${i + 1}-d-test`,
            conteudoMd: "",
            conteudoPublico: "",
            ordem: i,
          })
          .returning();
        parentAtual = t.id;
        criados.push(t.id);
      }

      // Nível 5 (topicoFilho é nível 2, +3 = nível 5)
      const erro = await validarMovimentoTopico(tx, null, parentAtual);
      expect(erro).toBeNull();

      // Nível 6 seria inválido
      const [nivel5] = await tx
        .insert(topico)
        .values({
          moduloId: mod2.id,
          produtoId: prod1.id,
          parentId: parentAtual,
          titulo: "Nivel 5",
          slug: "nivel-5-d-test",
          conteudoMd: "",
          conteudoPublico: "",
          ordem: 99,
        })
        .returning();

      const erroN6 = await validarMovimentoTopico(tx, null, nivel5.id);
      expect(erroN6).not.toBeNull();
      expect(erroN6).toMatch(/profundidade/i);
    });
  });

  it("mover tópico para seu próprio descendente → rejeitado (anti-ciclo)", async () => {
    const db = ctx.appDb;
    await asSystem(db, async (tx) => {
      // topicoPai → topicoFilho; tentar mover topicoPai para dentro de topicoFilho
      const erro = await validarMovimentoTopico(tx, topicoPai.id, topicoFilho.id);
      expect(erro).not.toBeNull();
      expect(erro).toMatch(/descendente|ciclo/i);
    });
  });
});

// ─── temFilhos ────────────────────────────────────────────────────────────────

describe("temFilhos — unitário (FR-018)", () => {
  it("tópico com filhos → retorna true", async () => {
    const db = ctx.appDb;
    await asSystem(db, async (tx) => {
      expect(await temFilhos(tx, topicoPai.id)).toBe(true);
    });
  });

  it("tópico sem filhos → retorna false", async () => {
    const db = ctx.appDb;
    await asSystem(db, async (tx) => {
      expect(await temFilhos(tx, topicoFilho.id)).toBe(false);
    });
  });
});

// ─── RLS: papel padrão não pode escrever ─────────────────────────────────────

describe("papel padrão: escrita negada em topico (RLS)", () => {
  it("INSERT de tópico como padrão → erro 42501", async () => {
    const db = ctx.appDb;

    // Cria escritório e usuário padrão
    let uPadraoId: string;
    await asSystem(db, async (tx) => {
      const [esc] = await tx
        .insert(escritorio)
        .values({ cnpj: "33444555000101", nome: "EscPadDir" })
        .returning();
      const [up] = await tx
        .insert(usuario)
        .values({
          nome: "Padrao Dir",
          email: "padrao.dir@test.dev",
          papel: "padrao" as const,
          origem: "sistema" as const,
          escritorioId: esc.id,
        })
        .returning();
      uPadraoId = up.id;
    });

    const { asUser, comCodigoPg } = await import("./helpers/db");
    await expect(
      asUser(db, uPadraoId!, "padrao", (tx) =>
        tx.insert(topico).values({
          moduloId: mod1.id,
          produtoId: prod1.id,
          titulo: "Negado",
          slug: "negado-dir",
          conteudoMd: "",
          conteudoPublico: "",
          ordem: 999,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});
