/**
 * REGRAS CRÍTICAS da Feature 004 (FR-020 / Constituição III, IV e IX):
 * retomada por última aula acessada (R1), sanitização byte-level de release
 * note para papel padrão (SC-003), visibilidade temporal de evento (R4),
 * validações de evento (FR-016) e regressão da imutabilidade de inscrição.
 * RLS pura das 3 tabelas novas: tests/rls.test.ts.
 */
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  aula,
  aulaAcesso,
  eadModulo,
  escritorio,
  evento,
  inscricaoEad,
  produto,
  progressoAula,
  releaseNote,
  usuario,
} from "../src/lib/db/schema";
import { asSystem, asUser, comCodigoPg, setupTestDatabase } from "./helpers/db";
import {
  _ultimaAulaAcessadaNaTx,
  _retomadaAulaNaTx,
} from "../src/lib/ead/acesso";
import {
  _continuarDeOndeParouNaTx,
  _eadsDisponiveisNaTx,
  _proximosEventosNaTx,
} from "../src/lib/dashboard/consultas";
import { _notasDoProdutoNaTx } from "../src/lib/notas/consultas";
import {
  derivarConteudoPublico,
  notaCriarSchema,
  papelPodeEscreverNota,
} from "../src/lib/notas/validacao";
import {
  eventoCriarSchema,
  papelPodeGerirEvento,
} from "../src/lib/eventos/validacao";

let ctx: Awaited<ReturnType<typeof setupTestDatabase>>;

let prodA: { id: string };
let prodB: { id: string };
let uPadrao: { id: string };
let uSuporte: { id: string };
let uDev: { id: string };
let modA: { id: string };
let modB: { id: string };
let aulaA1: { id: string };
let aulaA2: { id: string };
let aulaA3: { id: string };
let inscA: { id: string };

beforeAll(async () => {
  ctx = await setupTestDatabase();
  const db = ctx.appDb;

  await asSystem(db, async (tx) => {
    const [esc] = await tx
      .insert(escritorio)
      .values({ cnpj: "11222333000181", nome: "Escritório Dash" })
      .returning();

    [prodA] = await tx
      .insert(produto)
      .values({ nome: "Produto A", ordem: 1 })
      .returning();
    [prodB] = await tx
      .insert(produto)
      .values({ nome: "Produto B", ordem: 2 })
      .returning();

    [uPadrao] = await tx
      .insert(usuario)
      .values({
        nome: "Paula",
        email: "padrao-dash@teste.dev",
        papel: "padrao",
        origem: "sistema",
        escritorioId: esc.id,
      })
      .returning();
    [uSuporte] = await tx
      .insert(usuario)
      .values({
        nome: "Saulo",
        email: "suporte-dash@teste.dev",
        papel: "suporte",
        origem: "sistema",
      })
      .returning();
    [uDev] = await tx
      .insert(usuario)
      .values({
        nome: "Diego",
        email: "dev-dash@teste.dev",
        papel: "dev",
        origem: "central",
        senhaHash: "x",
      })
      .returning();

    [modA] = await tx
      .insert(eadModulo)
      .values({ produtoId: prodA.id, nome: "EAD A", ordem: 1 })
      .returning();
    [modB] = await tx
      .insert(eadModulo)
      .values({ produtoId: prodB.id, nome: "EAD B", ordem: 1 })
      .returning();

    [aulaA1, aulaA2, aulaA3] = await tx
      .insert(aula)
      .values([
        { eadModuloId: modA.id, titulo: "A1", youtubeId: "aaaaaaaaaaa", ordem: 1 },
        { eadModuloId: modA.id, titulo: "A2", youtubeId: "bbbbbbbbbbb", ordem: 2 },
        { eadModuloId: modA.id, titulo: "A3", youtubeId: "ccccccccccc", ordem: 3 },
      ])
      .returning();

    await tx.insert(aula).values({
      eadModuloId: modB.id,
      titulo: "B1",
      youtubeId: "ddddddddddd",
      ordem: 1,
    });

    [inscA] = await tx
      .insert(inscricaoEad)
      .values({
        usuarioId: uPadrao.id,
        produtoId: prodA.id,
        eadModuloId: modA.id,
        interno: false,
        status: "em_andamento",
      })
      .returning();

    // inscrição em produto B (módulo B) — não deve aparecer com produto A ativo
    await tx.insert(inscricaoEad).values({
      usuarioId: uPadrao.id,
      produtoId: prodB.id,
      eadModuloId: modB.id,
      interno: false,
      status: "em_andamento",
    });
  });
});

afterAll(async () => {
  await ctx?.teardown();
});

// ─── US1: retomada por última aula acessada (R1) ─────────────────────────────

describe("retomada — última aula acessada", () => {
  it("sem nenhum acesso: retomada = primeira aula na ordem", async () => {
    const retomada = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _retomadaAulaNaTx(tx, modA.id, uPadrao.id),
    );
    expect(retomada).toBe(aulaA1.id);
  });

  it("última acessada vence (acessa A1, depois A2 → retomada = A2)", async () => {
    await asUser(ctx.appDb, uPadrao.id, "padrao", async (tx) => {
      await tx
        .insert(aulaAcesso)
        .values({ usuarioId: uPadrao.id, aulaId: aulaA1.id, acessadoEm: new Date(Date.now() - 60_000) });
      await tx
        .insert(aulaAcesso)
        .values({ usuarioId: uPadrao.id, aulaId: aulaA2.id, acessadoEm: new Date() });
    });

    const ultima = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _ultimaAulaAcessadaNaTx(tx, modA.id, uPadrao.id),
    );
    expect(ultima).toBe(aulaA2.id);
  });

  it("upsert idempotente: reacessar atualiza acessado_em sem duplicar", async () => {
    const antes = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .select()
        .from(aulaAcesso)
        .where(
          and(eq(aulaAcesso.usuarioId, uPadrao.id), eq(aulaAcesso.aulaId, aulaA1.id)),
        ),
    );

    await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .insert(aulaAcesso)
        .values({ usuarioId: uPadrao.id, aulaId: aulaA1.id, acessadoEm: new Date(Date.now() + 60_000) })
        .onConflictDoUpdate({
          target: [aulaAcesso.usuarioId, aulaAcesso.aulaId],
          set: { acessadoEm: new Date(Date.now() + 60_000) },
        }),
    );

    const depois = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .select()
        .from(aulaAcesso)
        .where(
          and(eq(aulaAcesso.usuarioId, uPadrao.id), eq(aulaAcesso.aulaId, aulaA1.id)),
        ),
    );

    expect(depois.length).toBe(1);
    expect(depois[0].acessadoEm.getTime()).toBeGreaterThan(
      antes[0].acessadoEm.getTime(),
    );
    // agora A1 é a mais recente — a retomada acompanha
    const ultima = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _ultimaAulaAcessadaNaTx(tx, modA.id, uPadrao.id),
    );
    expect(ultima).toBe(aulaA1.id);
  });

  it("aula removida: CASCADE apaga o acesso e a retomada recai na mais recente restante", async () => {
    // estado atual: A1 (mais recente) e A2 acessadas. Remove A1.
    await asSystem(ctx.appDb, (tx) => tx.delete(aula).where(eq(aula.id, aulaA1.id)));

    const acessosOrfaos = await asSystem(ctx.appDb, (tx) =>
      tx.select().from(aulaAcesso).where(eq(aulaAcesso.aulaId, aulaA1.id)),
    );
    expect(acessosOrfaos.length).toBe(0);

    const retomada = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _retomadaAulaNaTx(tx, modA.id, uPadrao.id),
    );
    expect(retomada).toBe(aulaA2.id);
  });

  it("regressão (Constituição IV): UPDATE em inscricao_ead segue negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .update(inscricaoEad)
          .set({ status: "concluido" })
          .where(eq(inscricaoEad.id, inscA.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

describe("bloco Continue de onde parou", () => {
  it("lista só inscrições em andamento do produto ativo, com % e retomada", async () => {
    // marca A2 como vista (1 de 2 aulas restantes = 50%)
    await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .insert(progressoAula)
        .values({ usuarioId: uPadrao.id, aulaId: aulaA2.id })
        .onConflictDoNothing(),
    );

    const cards = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _continuarDeOndeParouNaTx(tx, prodA.id, uPadrao.id),
    );

    expect(cards.length).toBe(1); // inscrição do produto B não aparece
    expect(cards[0].moduloId).toBe(modA.id);
    expect(cards[0].nome).toBe("EAD A");
    expect(cards[0].percentual).toBe(50);
    expect(cards[0].retomadaAulaId).toBe(aulaA2.id);
  });

  it("inscrição concluída (criada via system) NÃO aparece", async () => {
    // módulo extra com inscrição já concluída — só o system consegue criar assim
    const [modC] = await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(eadModulo)
        .values({ produtoId: prodA.id, nome: "EAD Concluído", ordem: 9 })
        .returning(),
    );
    await asSystem(ctx.appDb, (tx) =>
      tx.insert(inscricaoEad).values({
        usuarioId: uPadrao.id,
        produtoId: prodA.id,
        eadModuloId: modC.id,
        interno: false,
        status: "concluido",
        dataConclusao: new Date(),
      }),
    );

    const cards = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _continuarDeOndeParouNaTx(tx, prodA.id, uPadrao.id),
    );
    expect(cards.find((c) => c.moduloId === modC.id)).toBeUndefined();
  });

  it("sugestões: módulos do produto sem inscrição do usuário", async () => {
    const [modNovo] = await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(eadModulo)
        .values({ produtoId: prodA.id, nome: "EAD Sem Inscrição", ordem: 10 })
        .returning(),
    );

    const sugestoes = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _eadsDisponiveisNaTx(tx, prodA.id, uPadrao.id),
    );

    expect(sugestoes.map((s) => s.moduloId)).toContain(modNovo.id);
    expect(sugestoes.map((s) => s.moduloId)).not.toContain(modA.id); // inscrito
  });
});

// ─── US2/US3: release notes — sanitização e validação ────────────────────────

const SEGREDO = "XYZSEGREDODANOTA";

describe("release notes — sanitização byte-level (SC-003)", () => {
  beforeAll(async () => {
    const md = `# Versão nova\n\nMelhorias gerais.\n\n:::nota-interna\n${SEGREDO} — detalhe interno da release.\n:::\n`;
    await asSystem(ctx.appDb, (tx) =>
      tx.insert(releaseNote).values([
        {
          produtoId: prodA.id,
          data: "2026-06-10",
          versao: "2.0.0",
          conteudoMd: md,
          conteudoPublico: derivarConteudoPublico(md),
          criadoPor: uDev.id,
        },
        {
          produtoId: prodA.id,
          data: "2026-06-01",
          conteudoMd: "# Antiga\n\nSem versão.\n",
          conteudoPublico: derivarConteudoPublico("# Antiga\n\nSem versão.\n"),
          criadoPor: uDev.id,
        },
        {
          produtoId: prodB.id,
          data: "2026-06-05",
          conteudoMd: "# Nota do B\n",
          conteudoPublico: derivarConteudoPublico("# Nota do B\n"),
          criadoPor: uDev.id,
        },
      ]),
    );
  });

  it("derivarConteudoPublico remove blocos internos (nenhum byte)", () => {
    const publico = derivarConteudoPublico(
      `# X\n\n:::nota-interna\n${SEGREDO}\n:::\n\n:::nota-tecnica\n${SEGREDO}TEC\n:::\n`,
    );
    expect(publico).not.toContain(SEGREDO);
    expect(publico).not.toContain("nota-interna");
    expect(publico).not.toContain("nota-tecnica");
  });

  it("consulta para papel padrão: nenhum byte do conteúdo interno na resposta", async () => {
    const notas = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _notasDoProdutoNaTx(tx, prodA.id, "padrao"),
    );
    expect(notas.length).toBe(2);
    const tudo = JSON.stringify(notas);
    expect(tudo).not.toContain(SEGREDO);
    expect(tudo).not.toContain("nota-interna");
  });

  it("consulta para suporte: bloco interno presente", async () => {
    const notas = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      _notasDoProdutoNaTx(tx, prodA.id, "suporte"),
    );
    expect(JSON.stringify(notas)).toContain(SEGREDO);
  });

  it("isolamento por produto + ordenação data DESC", async () => {
    const notas = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _notasDoProdutoNaTx(tx, prodA.id, "padrao"),
    );
    expect(notas[0].versao).toBe("2.0.0"); // mais recente primeiro
    expect(notas[1].versao).toBeNull();
    expect(JSON.stringify(notas)).not.toContain("Nota do B");
  });
});

describe("release notes — gate e validação (US3)", () => {
  it("papelPodeEscreverNota: só dev/master", () => {
    expect(papelPodeEscreverNota("dev")).toBe(true);
    expect(papelPodeEscreverNota("master")).toBe(true);
    expect(papelPodeEscreverNota("suporte")).toBe(false);
    expect(papelPodeEscreverNota("padrao")).toBe(false);
  });

  it("notaCriarSchema: rejeita produto inválido e data malformada", () => {
    expect(
      notaCriarSchema.safeParse({
        produtoId: "nao-e-uuid",
        data: "2026-06-11",
        conteudoMd: "x",
      }).success,
    ).toBe(false);
    expect(
      notaCriarSchema.safeParse({
        produtoId: "3f0e6f5a-1111-4222-8333-444455556666",
        data: "11/06/2026",
        conteudoMd: "x",
      }).success,
    ).toBe(false);
    expect(
      notaCriarSchema.safeParse({
        produtoId: "3f0e6f5a-1111-4222-8333-444455556666",
        data: "2026-06-11",
        versao: "1.2.3",
        conteudoMd: "# ok",
      }).success,
    ).toBe(true);
  });
});

// ─── US4/US5: eventos ────────────────────────────────────────────────────────

describe("eventos — bloco Próximos eventos (R4)", () => {
  let evFuturo: { id: string };
  let evAndamento: { id: string };
  let evPassado: { id: string };

  beforeAll(async () => {
    const agora = Date.now();
    await asSystem(ctx.appDb, async (tx) => {
      [evFuturo] = await tx
        .insert(evento)
        .values({
          titulo: "Futuro",
          inicio: new Date(agora + 48 * 3600_000),
          fim: new Date(agora + 49 * 3600_000),
          criadoPor: uSuporte.id,
        })
        .returning();
      [evAndamento] = await tx
        .insert(evento)
        .values({
          titulo: "Em andamento",
          inicio: new Date(agora - 3600_000),
          fim: new Date(agora + 3600_000),
          criadoPor: uSuporte.id,
        })
        .returning();
      [evPassado] = await tx
        .insert(evento)
        .values({
          titulo: "Passado",
          inicio: new Date(agora - 49 * 3600_000),
          fim: new Date(agora - 48 * 3600_000),
          criadoPor: uSuporte.id,
        })
        .returning();
    });
  });

  it("padrão: vê futuro e em andamento, nunca o passado; ordem por início ASC", async () => {
    const eventos = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      _proximosEventosNaTx(tx, 5),
    );
    const ids = eventos.map((e) => e.id);
    expect(ids).toContain(evFuturo.id);
    expect(ids).toContain(evAndamento.id);
    expect(ids).not.toContain(evPassado.id);
    expect(ids.indexOf(evAndamento.id)).toBeLessThan(ids.indexOf(evFuturo.id));
  });

  it("suporte: bloco também não mostra o passado (filtro do bloco, não permissão)", async () => {
    const eventos = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      _proximosEventosNaTx(tx, 5),
    );
    expect(eventos.map((e) => e.id)).not.toContain(evPassado.id);
  });

  it("suporte: o passado segue acessível fora do bloco (histórico da gestão)", async () => {
    const rows = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx.select().from(evento).where(eq(evento.id, evPassado.id)),
    );
    expect(rows.length).toBe(1);
  });

  it("resultado independe de produto (evento não tem produto)", async () => {
    // mesma consulta, nada de produto envolvido — basta garantir que a coluna não existe
    const cols = Object.keys(evento);
    expect(cols).not.toContain("produtoId");
  });
});

describe("eventos — gate e validação (US5)", () => {
  it("papelPodeGerirEvento: suporte, dev e master; nunca padrão", () => {
    expect(papelPodeGerirEvento("suporte")).toBe(true);
    expect(papelPodeGerirEvento("dev")).toBe(true);
    expect(papelPodeGerirEvento("master")).toBe(true);
    expect(papelPodeGerirEvento("padrao")).toBe(false);
  });

  it("eventoCriarSchema: rejeita fim <= início com mensagem clara", () => {
    const r = eventoCriarSchema.safeParse({
      titulo: "X",
      inicio: "2026-06-12T10:00",
      fim: "2026-06-12T09:00",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/fim.*início|início.*fim/i);
    }
  });

  it("eventoCriarSchema: rejeita evento de mais de um dia (premissa v1)", () => {
    const r = eventoCriarSchema.safeParse({
      titulo: "X",
      inicio: "2026-06-12T22:00",
      fim: "2026-06-13T02:00",
    });
    expect(r.success).toBe(false);
  });

  it("eventoCriarSchema: aceita evento pontual válido", () => {
    const r = eventoCriarSchema.safeParse({
      titulo: "Live de lançamento",
      descricao: "Novidades do produto",
      inicio: "2026-06-12T10:00",
      fim: "2026-06-12T11:30",
    });
    expect(r.success).toBe(true);
  });
});
