import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acessoLog,
  arquivo,
  aula,
  aulaAcesso,
  certificado,
  evento,
  eadModulo,
  escritorio,
  escritorioProduto,
  inscricaoEad,
  modulo,
  eadModuloProduto,
  papelMapeamento,
  produto,
  progressoAula,
  prova,
  questao,
  releaseNote,
  tentativa,
  topico,
  usuario,
} from "../src/lib/db/schema";
import { asSystem, asUser, comCodigoPg, setupTestDatabase } from "./helpers/db";

/**
 * REGRA CRÍTICA (Constituição II e IX): para cada papel × tabela, afirma o
 * que as policies permitem e negam conforme data-model.md. Violação de RLS:
 *  - SELECT/UPDATE/DELETE filtrados → zero linhas (fail-closed)
 *  - INSERT/WITH CHECK → erro 42501
 *  - sem GRANT (acesso_log UPDATE/DELETE) → erro 42501
 */

let ctx: Awaited<ReturnType<typeof setupTestDatabase>>;

// fixtures (criadas via system no beforeAll)
let escritorioA: { id: string };
let escritorioVazio: { id: string };
let produto1: { id: string };
let uPadrao: { id: string };
let uSuporte: { id: string };
let uDev: { id: string };
let uMaster: { id: string };
let uCentralComum: { id: string };

beforeAll(async () => {
  ctx = await setupTestDatabase();
  const db = ctx.appDb;

  await asSystem(db, async (tx) => {
    [escritorioA] = await tx
      .insert(escritorio)
      .values({ cnpj: "11222333000181", nome: "Escritório A" })
      .returning();
    [escritorioVazio] = await tx
      .insert(escritorio)
      .values({ cnpj: "11444777000161", nome: "Escritório Vazio" })
      .returning();
    [produto1] = await tx
      .insert(produto)
      .values({ nome: "Sittax Simples", ordem: 1 })
      .returning();
    await tx
      .insert(escritorioProduto)
      .values({ escritorioId: escritorioA.id, produtoId: produto1.id });

    [uPadrao] = await tx
      .insert(usuario)
      .values({
        nome: "Paula",
        email: "padrao@teste.dev",
        papel: "padrao",
        origem: "sistema",
        escritorioId: escritorioA.id,
      })
      .returning();
    [uSuporte] = await tx
      .insert(usuario)
      .values({
        nome: "Saulo",
        email: "suporte@teste.dev",
        papel: "suporte",
        origem: "sistema",
      })
      .returning();
    [uDev] = await tx
      .insert(usuario)
      .values({
        nome: "Diego",
        email: "dev@teste.dev",
        papel: "dev",
        origem: "central",
        senhaHash: "x",
      })
      .returning();
    [uMaster] = await tx
      .insert(usuario)
      .values({
        nome: "Marta",
        email: "master@teste.dev",
        papel: "master",
        origem: "central",
        senhaHash: "x",
      })
      .returning();
    [uCentralComum] = await tx
      .insert(usuario)
      .values({
        nome: "Carla",
        email: "central@teste.dev",
        papel: "suporte",
        origem: "central",
        senhaHash: "x",
      })
      .returning();

    await tx.insert(papelMapeamento).values({
      roleOrigem: "ADMINISTRADOR",
      nivelOrigem: 10,
      papelCentral: "dev",
    });
    await tx
      .insert(acessoLog)
      .values({ usuarioId: uPadrao.id, produtoId: null });
  });
});

afterAll(async () => {
  await ctx?.teardown();
});

describe("sem contexto setado (bypass)", () => {
  it("SELECT em qualquer tabela retorna zero linhas", async () => {
    const db = ctx.appDb;
    expect(await db.select().from(escritorio)).toHaveLength(0);
    expect(await db.select().from(usuario)).toHaveLength(0);
    expect(await db.select().from(produto)).toHaveLength(0);
    expect(await db.select().from(escritorioProduto)).toHaveLength(0);
    expect(await db.select().from(acessoLog)).toHaveLength(0);
    expect(await db.select().from(papelMapeamento)).toHaveLength(0);
  });

  it("INSERT é negado", async () => {
    await expect(
      ctx.appDb
        .insert(escritorio)
        .values({ cnpj: "99999999000191", nome: "Invasor" }),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

describe("papel padrão", () => {
  it("vê escritórios, produtos e vínculos", async () => {
    await asUser(ctx.appDb, uPadrao.id, "padrao", async (tx) => {
      expect((await tx.select().from(escritorio)).length).toBeGreaterThan(0);
      expect((await tx.select().from(produto)).length).toBeGreaterThan(0);
      expect(
        (await tx.select().from(escritorioProduto)).length,
      ).toBeGreaterThan(0);
    });
  });

  it("vê apenas o próprio registro de usuário", async () => {
    await asUser(ctx.appDb, uPadrao.id, "padrao", async (tx) => {
      const rows = await tx.select().from(usuario);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(uPadrao.id);
    });
  });

  it("não vê acesso_log nem papel_mapeamento", async () => {
    await asUser(ctx.appDb, uPadrao.id, "padrao", async (tx) => {
      expect(await tx.select().from(acessoLog)).toHaveLength(0);
      expect(await tx.select().from(papelMapeamento)).toHaveLength(0);
    });
  });

  it("não cria nem edita escritório", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .insert(escritorio)
          .values({ cnpj: "88888888000175", nome: "Nope" }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
    const updated = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .update(escritorio)
        .set({ nome: "Hackeado" })
        .where(eq(escritorio.id, escritorioA.id))
        .returning(),
    );
    expect(updated).toHaveLength(0);
  });

  it("atualiza o próprio produto_selecionado_id", async () => {
    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .update(usuario)
        .set({ produtoSelecionadoId: produto1.id })
        .where(eq(usuario.id, uPadrao.id))
        .returning(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].produtoSelecionadoId).toBe(produto1.id);
  });

  it("não eleva o próprio papel", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .update(usuario)
          .set({ papel: "master" })
          .where(eq(usuario.id, uPadrao.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("não edita outro usuário", async () => {
    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .update(usuario)
        .set({ nome: "Invadido" })
        .where(eq(usuario.id, uSuporte.id))
        .returning(),
    );
    expect(rows).toHaveLength(0);
  });

  it("registra o próprio acesso, nunca o de outro usuário", async () => {
    await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .insert(acessoLog)
        .values({ usuarioId: uPadrao.id, produtoId: produto1.id }),
    );
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(acessoLog).values({ usuarioId: uSuporte.id }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

describe.each([
  ["suporte", () => uSuporte],
  ["dev", () => uDev],
])("papel %s", (papel, getUser) => {
  it("vê apenas o próprio usuário e nada de log/mapeamento", async () => {
    const u = getUser();
    await asUser(ctx.appDb, u.id, papel, async (tx) => {
      const rows = await tx.select().from(usuario);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(u.id);
      expect(await tx.select().from(acessoLog)).toHaveLength(0);
      expect(await tx.select().from(papelMapeamento)).toHaveLength(0);
    });
  });

  it("não escreve em escritório nem mapeamento", async () => {
    const u = getUser();
    await expect(
      asUser(ctx.appDb, u.id, papel, (tx) =>
        tx
          .insert(escritorio)
          .values({ cnpj: "77777777000169", nome: "Nope" }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
    await expect(
      asUser(ctx.appDb, u.id, papel, (tx) =>
        tx.insert(papelMapeamento).values({
          roleOrigem: "X",
          nivelOrigem: 1,
          papelCentral: "dev",
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

describe("papel master", () => {
  it("vê todos os usuários e o acesso_log", async () => {
    await asUser(ctx.appDb, uMaster.id, "master", async (tx) => {
      expect((await tx.select().from(usuario)).length).toBeGreaterThanOrEqual(5);
      expect((await tx.select().from(acessoLog)).length).toBeGreaterThan(0);
    });
  });

  it("faz CRUD de escritório e vínculo de produto", async () => {
    const [novo] = await asUser(ctx.appDb, uMaster.id, "master", (tx) =>
      tx
        .insert(escritorio)
        .values({ cnpj: "06990590000123", nome: "Escritório do Master" })
        .returning(),
    );
    await asUser(ctx.appDb, uMaster.id, "master", async (tx) => {
      await tx
        .update(escritorio)
        .set({ nome: "Renomeado" })
        .where(eq(escritorio.id, novo.id));
      await tx
        .insert(escritorioProduto)
        .values({ escritorioId: novo.id, produtoId: produto1.id });
      await tx
        .delete(escritorioProduto)
        .where(eq(escritorioProduto.escritorioId, novo.id));
      await tx.delete(escritorio).where(eq(escritorio.id, novo.id));
    });
  });

  it("cria usuário só central, nunca espelhado", async () => {
    await asUser(ctx.appDb, uMaster.id, "master", (tx) =>
      tx.insert(usuario).values({
        nome: "Novo",
        email: "novo-central@teste.dev",
        papel: "suporte",
        origem: "central",
        senhaHash: "x",
      }),
    );
    await expect(
      asUser(ctx.appDb, uMaster.id, "master", (tx) =>
        tx.insert(usuario).values({
          nome: "Falso Espelhado",
          email: "falso@teste.dev",
          papel: "suporte",
          origem: "sistema",
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("edita/desativa usuário central, mas usuário espelhado é imutável", async () => {
    const central = await asUser(ctx.appDb, uMaster.id, "master", (tx) =>
      tx
        .update(usuario)
        .set({ ativo: false })
        .where(eq(usuario.id, uCentralComum.id))
        .returning(),
    );
    expect(central).toHaveLength(1);

    const espelhado = await asUser(ctx.appDb, uMaster.id, "master", (tx) =>
      tx
        .update(usuario)
        .set({ nome: "Editado" })
        .where(eq(usuario.id, uPadrao.id))
        .returning(),
    );
    expect(espelhado).toHaveLength(0);
  });

  it("não exclui escritório com usuários (FK RESTRICT)", async () => {
    await expect(
      asUser(ctx.appDb, uMaster.id, "master", (tx) =>
        tx.delete(escritorio).where(eq(escritorio.id, escritorioA.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("23503"));
  });

  it("exclui escritório sem usuários", async () => {
    await asUser(ctx.appDb, uMaster.id, "master", (tx) =>
      tx.delete(escritorio).where(eq(escritorio.id, escritorioVazio.id)),
    );
  });

  it("faz CRUD do mapeamento de papéis", async () => {
    await asUser(ctx.appDb, uMaster.id, "master", async (tx) => {
      const [m] = await tx
        .insert(papelMapeamento)
        .values({ roleOrigem: "SUPORTE", nivelOrigem: null, papelCentral: "suporte" })
        .returning();
      await tx
        .update(papelMapeamento)
        .set({ papelCentral: "dev" })
        .where(eq(papelMapeamento.id, m.id));
      await tx.delete(papelMapeamento).where(eq(papelMapeamento.id, m.id));
    });
  });

  it("não cria produto (catálogo é seed/bootstrap)", async () => {
    await expect(
      asUser(ctx.appDb, uMaster.id, "master", (tx) =>
        tx.insert(produto).values({ nome: "Produto Pirata", ordem: 99 }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

describe("acesso_log é append-only", () => {
  it("nem master altera ou apaga (sem GRANT)", async () => {
    await expect(
      asUser(ctx.appDb, uMaster.id, "master", (tx) =>
        tx.update(acessoLog).set({ produtoId: null }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
    await expect(
      asUser(ctx.appDb, uMaster.id, "master", (tx) => tx.delete(acessoLog)),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

describe("contexto system", () => {
  it("espelha (cria/atualiza) usuário e escritório", async () => {
    await asSystem(ctx.appDb, async (tx) => {
      const updated = await tx
        .update(usuario)
        .set({ nome: "Paula Ressincronizada" })
        .where(eq(usuario.id, uPadrao.id))
        .returning();
      expect(updated).toHaveLength(1);
    });
  });

  it("não lê via app_user_id (não há usuário system)", async () => {
    await asSystem(ctx.appDb, async (tx) => {
      const r = await tx.execute(sql`SELECT app_user_id() AS id`);
      expect((r.rows[0] as { id: string | null }).id).toBeNull();
    });
  });
});

// ─── Feature 002: RLS de modulo, topico e arquivo ────────────────────────────

let modulo1: { id: string };
let topico1: { id: string };
let arquivo1: { id: string };

// Cria fixtures de conteúdo via system antes dos testes de RLS de conteúdo
beforeAll(async () => {
  const db = ctx.appDb;
  await asSystem(db, async (tx) => {
    [modulo1] = await tx
      .insert(modulo)
      .values({ produtoId: produto1.id, nome: "Módulo RLS Teste", ordem: 99 })
      .returning();

    [topico1] = await tx
      .insert(topico)
      .values({
        moduloId: modulo1.id,
        produtoId: produto1.id,
        titulo: "Tópico RLS",
        slug: "topico-rls-teste",
        conteudoMd: "# Conteúdo\n\n:::nota-interna\nSegredo\n:::\n",
        conteudoPublico: "# Conteúdo\n",
        ordem: 1,
      })
      .returning();

    [arquivo1] = await tx
      .insert(arquivo)
      .values({
        nomeOriginal: "imagem.png",
        mime: "image/png",
        tamanho: 1024,
        chaveStorage: "rls-test/imagem.png",
        criadoPor: uSuporte.id,
      })
      .returning();
  });
});

describe("modulo — RLS", () => {
  it("qualquer papel autenticado lê", async () => {
    for (const [uid, p] of [
      [uPadrao.id, "padrao"],
      [uSuporte.id, "suporte"],
      [uDev.id, "dev"],
      [uMaster.id, "master"],
    ] as [string, string][]) {
      const rows = await asUser(ctx.appDb, uid, p, (tx) =>
        tx.select().from(modulo).where(eq(modulo.id, modulo1.id)),
      );
      expect(rows.length).toBe(1);
    }
  });

  it("sem contexto: zero linhas", async () => {
    const rows = await ctx.appDb
      .select()
      .from(modulo)
      .where(eq(modulo.id, modulo1.id))
      .catch(() => []);
    expect(rows.length).toBe(0);
  });

  it("papel padrão: INSERT negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .insert(modulo)
          .values({ produtoId: produto1.id, nome: "Negado", ordem: 999 }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("suporte: INSERT e UPDATE permitidos", async () => {
    const [m] = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx
        .insert(modulo)
        .values({ produtoId: produto1.id, nome: "ModSuporte", ordem: 100 })
        .returning(),
    );
    expect(m.id).toBeTruthy();

    await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx.update(modulo).set({ nome: "ModSuporteRenomeado" }).where(eq(modulo.id, m.id)),
    );
  });

  it("dev: INSERT permitido", async () => {
    const [m] = await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx
        .insert(modulo)
        .values({ produtoId: produto1.id, nome: "ModDev", ordem: 101 })
        .returning(),
    );
    expect(m.id).toBeTruthy();
  });
});

describe("topico — RLS", () => {
  it("qualquer papel autenticado lê", async () => {
    for (const [uid, p] of [
      [uPadrao.id, "padrao"],
      [uSuporte.id, "suporte"],
    ] as [string, string][]) {
      const rows = await asUser(ctx.appDb, uid, p, (tx) =>
        tx.select().from(topico).where(eq(topico.id, topico1.id)),
      );
      expect(rows.length).toBe(1);
    }
  });

  it("sem contexto: zero linhas", async () => {
    const rows = await ctx.appDb
      .select()
      .from(topico)
      .where(eq(topico.id, topico1.id))
      .catch(() => []);
    expect(rows.length).toBe(0);
  });

  it("papel padrão: INSERT negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(topico).values({
          moduloId: modulo1.id,
          produtoId: produto1.id,
          titulo: "Negado",
          slug: "negado-padrao",
          conteudoMd: "",
          conteudoPublico: "",
          ordem: 999,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("suporte: INSERT e UPDATE permitidos", async () => {
    const [t] = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx
        .insert(topico)
        .values({
          moduloId: modulo1.id,
          produtoId: produto1.id,
          titulo: "Tópico Suporte",
          slug: "topico-suporte-rls",
          conteudoMd: "# Suporte\n",
          conteudoPublico: "# Suporte\n",
          ordem: 200,
        })
        .returning(),
    );
    expect(t.id).toBeTruthy();

    await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx.update(topico).set({ titulo: "Tópico Suporte Atualizado" }).where(eq(topico.id, t.id)),
    );
  });
});

describe("arquivo — RLS", () => {
  it("qualquer papel autenticado lê", async () => {
    for (const [uid, p] of [
      [uPadrao.id, "padrao"],
      [uSuporte.id, "suporte"],
    ] as [string, string][]) {
      const rows = await asUser(ctx.appDb, uid, p, (tx) =>
        tx.select().from(arquivo).where(eq(arquivo.id, arquivo1.id)),
      );
      expect(rows.length).toBe(1);
    }
  });

  it("papel padrão: INSERT negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(arquivo).values({
          nomeOriginal: "x.png",
          mime: "image/png",
          tamanho: 1,
          chaveStorage: "rls-test/negado.png",
          criadoPor: uPadrao.id,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("suporte: INSERT permitido", async () => {
    const [a] = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx
        .insert(arquivo)
        .values({
          nomeOriginal: "ok.png",
          mime: "image/png",
          tamanho: 512,
          chaveStorage: "rls-test/ok.png",
          criadoPor: uSuporte.id,
        })
        .returning(),
    );
    expect(a.id).toBeTruthy();
  });

  it("arquivo: sem UPDATE/DELETE (sem GRANT) — suporte não pode alterar", async () => {
    await expect(
      asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
        tx.update(arquivo).set({ mime: "text/plain" }).where(eq(arquivo.id, arquivo1.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));

    await expect(
      asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
        tx.delete(arquivo).where(eq(arquivo.id, arquivo1.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

// ─── Feature 003: RLS das tabelas EAD ────────────────────────────────────────

let eadMod1: { id: string };
let aula1: { id: string };
let aula2: { id: string };
let inscricaoPadrao: { id: string };
let progressoPadrao: { usuarioId: string; aulaId: string };

beforeAll(async () => {
  const db = ctx.appDb;
  await asSystem(db, async (tx) => {
    [eadMod1] = await tx
      .insert(eadModulo)
      .values({ produtoId: produto1.id, nome: "Módulo EAD RLS", ordem: 99 })
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

    [inscricaoPadrao] = await tx
      .insert(inscricaoEad)
      .values({
        usuarioId: uPadrao.id,
        produtoId: produto1.id,
        interno: false,
        status: "em_andamento",
      })
      .returning();

    [progressoPadrao] = await tx
      .insert(progressoAula)
      .values({ usuarioId: uPadrao.id, aulaId: aula1.id })
      .returning();
  });
});

describe("ead_modulo — RLS", () => {
  it("qualquer papel autenticado lê", async () => {
    for (const [uid, p] of [
      [uPadrao.id, "padrao"],
      [uSuporte.id, "suporte"],
      [uDev.id, "dev"],
      [uMaster.id, "master"],
    ] as [string, string][]) {
      const rows = await asUser(ctx.appDb, uid, p, (tx) =>
        tx.select().from(eadModulo).where(eq(eadModulo.id, eadMod1.id)),
      );
      expect(rows.length).toBe(1);
    }
  });

  it("papel padrão: INSERT negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .insert(eadModulo)
          .values({ produtoId: produto1.id, nome: "Negado", ordem: 999 }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("suporte: INSERT negado (42501) — somente dev/master", async () => {
    await expect(
      asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
        tx
          .insert(eadModulo)
          .values({ produtoId: produto1.id, nome: "NegadoSuporte", ordem: 998 }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("dev: INSERT e UPDATE permitidos", async () => {
    const [m] = await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx
        .insert(eadModulo)
        .values({ produtoId: produto1.id, nome: "ModEadDev", ordem: 100 })
        .returning(),
    );
    expect(m.id).toBeTruthy();
    await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx
        .update(eadModulo)
        .set({ nome: "ModEadDevRenomeado" })
        .where(eq(eadModulo.id, m.id)),
    );
  });
});

describe("aula — RLS", () => {
  it("qualquer papel autenticado lê", async () => {
    for (const [uid, p] of [
      [uPadrao.id, "padrao"],
      [uSuporte.id, "suporte"],
    ] as [string, string][]) {
      const rows = await asUser(ctx.appDb, uid, p, (tx) =>
        tx.select().from(aula).where(eq(aula.id, aula1.id)),
      );
      expect(rows.length).toBe(1);
    }
  });

  it("papel padrão: INSERT negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(aula).values({
          eadModuloId: eadMod1.id,
          titulo: "Negada",
          youtubeId: "xxxxxxxxxxx",
          ordem: 999,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("dev: INSERT e UPDATE permitidos", async () => {
    const [a] = await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx
        .insert(aula)
        .values({
          eadModuloId: eadMod1.id,
          titulo: "Aula Dev",
          youtubeId: "aaaaaaaaaaa",
          ordem: 50,
        })
        .returning(),
    );
    expect(a.id).toBeTruthy();
    await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx.update(aula).set({ titulo: "Aula Dev Renomeada" }).where(eq(aula.id, a.id)),
    );
  });
});

describe("ead_modulo_produto — RLS (vínculo de produtos)", () => {
  let produtoVinc: { id: string };

  beforeAll(async () => {
    [produtoVinc] = await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(produto)
        .values({ nome: "Produto Vínculo", ordem: 95 })
        .returning(),
    );
    // system cria um vínculo de fixture
    await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(eadModuloProduto)
        .values({ eadModuloId: eadMod1.id, produtoId: produtoVinc.id }),
    );
  });

  it("qualquer papel autenticado lê os vínculos", async () => {
    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .select()
        .from(eadModuloProduto)
        .where(eq(eadModuloProduto.eadModuloId, eadMod1.id)),
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("papel padrão e suporte: INSERT negado (42501)", async () => {
    for (const [uid, p] of [
      [uPadrao.id, "padrao"],
      [uSuporte.id, "suporte"],
    ] as [string, string][]) {
      await expect(
        asUser(ctx.appDb, uid, p, (tx) =>
          tx
            .insert(eadModuloProduto)
            .values({ eadModuloId: eadMod1.id, produtoId: produto1.id }),
        ),
      ).rejects.toSatisfy(comCodigoPg("42501"));
    }
  });

  it("dev: INSERT e DELETE permitidos", async () => {
    await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx
        .insert(eadModuloProduto)
        .values({ eadModuloId: eadMod1.id, produtoId: produto1.id }),
    );
    await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx
        .delete(eadModuloProduto)
        .where(eq(eadModuloProduto.eadModuloId, eadMod1.id)),
    );
  });
});

describe("inscricao_ead — RLS (own-row + UPDATE/DELETE negados)", () => {
  it("usuário padrão lê a própria inscrição", async () => {
    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .select()
        .from(inscricaoEad)
        .where(eq(inscricaoEad.id, inscricaoPadrao.id)),
    );
    expect(rows.length).toBe(1);
  });

  it("suporte não lê inscrição de outro usuário", async () => {
    const rows = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx.select().from(inscricaoEad).where(eq(inscricaoEad.id, inscricaoPadrao.id)),
    );
    expect(rows.length).toBe(0);
  });

  it("dev/master lê todas as inscrições", async () => {
    const rows = await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx.select().from(inscricaoEad),
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("UPDATE negado a todos — incluindo o dono (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .update(inscricaoEad)
          .set({ status: "concluido" })
          .where(eq(inscricaoEad.id, inscricaoPadrao.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("UPDATE negado até para dev (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uDev.id, "dev", (tx) =>
        tx
          .update(inscricaoEad)
          .set({ status: "concluido" })
          .where(eq(inscricaoEad.id, inscricaoPadrao.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("DELETE negado a todos (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uDev.id, "dev", (tx) =>
        tx.delete(inscricaoEad).where(eq(inscricaoEad.id, inscricaoPadrao.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("INSERT de inscrição para outro usuário negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(inscricaoEad).values({
          usuarioId: uSuporte.id,
          produtoId: produto1.id,
          interno: false,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

describe("progresso_aula — RLS (own-row + UPDATE/DELETE negados)", () => {
  it("usuário padrão lê o próprio progresso", async () => {
    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .select()
        .from(progressoAula)
        .where(eq(progressoAula.aulaId, aula1.id)),
    );
    expect(rows.length).toBe(1);
  });

  it("suporte não lê progresso de outro usuário", async () => {
    const rows = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx.select().from(progressoAula).where(eq(progressoAula.usuarioId, uPadrao.id)),
    );
    expect(rows.length).toBe(0);
  });

  it("dev/master lê todo o progresso", async () => {
    const rows = await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx.select().from(progressoAula),
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("UPDATE negado — sem GRANT (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .update(progressoAula)
          .set({ vistaEm: new Date() })
          .where(eq(progressoAula.aulaId, aula1.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("DELETE negado — sem GRANT (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uDev.id, "dev", (tx) =>
        tx
          .delete(progressoAula)
          .where(eq(progressoAula.aulaId, aula1.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("INSERT de progresso para outro usuário negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(progressoAula).values({
          usuarioId: uSuporte.id,
          aulaId: aula2.id,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

describe("alicerce (prova/questao/tentativa/certificado) — ilegível para papel padrão", () => {
  let prova1: { id: string };

  beforeAll(async () => {
    await asSystem(ctx.appDb, async (tx) => {
      [prova1] = await tx
        .insert(prova)
        .values({ produtoId: produto1.id, notaCorte: 70 })
        .returning();
      await tx.insert(questao).values({
        provaId: prova1.id,
        enunciado: "Questão teste?",
        alternativas: ["A", "B"],
        gabarito: 0,
        ordem: 1,
      });
    });
  });

  it("papel padrão: SELECT em prova retorna zero", async () => {
    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx.select().from(prova),
    );
    expect(rows.length).toBe(0);
  });

  it("papel padrão: SELECT em questao retorna zero", async () => {
    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx.select().from(questao),
    );
    expect(rows.length).toBe(0);
  });

  it("papel padrão: SELECT em tentativa retorna zero", async () => {
    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx.select().from(tentativa),
    );
    expect(rows.length).toBe(0);
  });

  it("dev lê prova e questao", async () => {
    const provas = await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx.select().from(prova),
    );
    expect(provas.length).toBeGreaterThan(0);
    const questoes = await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx.select().from(questao),
    );
    expect(questoes.length).toBeGreaterThan(0);
  });

  it("papel padrão: INSERT em prova negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .insert(prova)
          .values({ produtoId: produto1.id, notaCorte: 50 }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});

// ─── Feature 004: RLS de release_note, evento e aula_acesso ──────────────────

let nota1: { id: string };
let eventoFuturo: { id: string };
let eventoPassado: { id: string };
let aulaAcessoFixture: { usuarioId: string; aulaId: string };

beforeAll(async () => {
  const db = ctx.appDb;
  const agora = Date.now();
  await asSystem(db, async (tx) => {
    [nota1] = await tx
      .insert(releaseNote)
      .values({
        produtoId: produto1.id,
        data: "2026-06-01",
        versao: "1.0.0",
        conteudoMd: "# Nota\n\n:::nota-interna\nSegredo\n:::\n",
        conteudoPublico: "# Nota\n",
        criadoPor: uDev.id,
      })
      .returning();

    [eventoFuturo] = await tx
      .insert(evento)
      .values({
        titulo: "Live futura",
        descricao: "",
        inicio: new Date(agora + 24 * 3600_000),
        fim: new Date(agora + 25 * 3600_000),
        criadoPor: uSuporte.id,
      })
      .returning();

    [eventoPassado] = await tx
      .insert(evento)
      .values({
        titulo: "Live passada",
        descricao: "",
        inicio: new Date(agora - 25 * 3600_000),
        fim: new Date(agora - 24 * 3600_000),
        criadoPor: uSuporte.id,
      })
      .returning();

    [aulaAcessoFixture] = await tx
      .insert(aulaAcesso)
      .values({ usuarioId: uPadrao.id, aulaId: aula1.id })
      .returning();
  });
});

describe("release_note — RLS", () => {
  it("qualquer papel autenticado lê a linha", async () => {
    for (const [uid, p] of [
      [uPadrao.id, "padrao"],
      [uSuporte.id, "suporte"],
      [uDev.id, "dev"],
      [uMaster.id, "master"],
    ] as [string, string][]) {
      const rows = await asUser(ctx.appDb, uid, p, (tx) =>
        tx.select().from(releaseNote).where(eq(releaseNote.id, nota1.id)),
      );
      expect(rows.length).toBe(1);
    }
  });

  it("papel padrão: INSERT negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(releaseNote).values({
          produtoId: produto1.id,
          data: "2026-06-11",
          conteudoMd: "x",
          criadoPor: uPadrao.id,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("suporte: INSERT negado (42501) — escrita é só dev/master", async () => {
    await expect(
      asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
        tx.insert(releaseNote).values({
          produtoId: produto1.id,
          data: "2026-06-11",
          conteudoMd: "x",
          criadoPor: uSuporte.id,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("dev: INSERT e UPDATE permitidos", async () => {
    const [n] = await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx
        .insert(releaseNote)
        .values({
          produtoId: produto1.id,
          data: "2026-06-10",
          conteudoMd: "# Dev\n",
          conteudoPublico: "# Dev\n",
          criadoPor: uDev.id,
        })
        .returning(),
    );
    expect(n.id).toBeTruthy();
    await asUser(ctx.appDb, uDev.id, "dev", (tx) =>
      tx
        .update(releaseNote)
        .set({ versao: "1.0.1" })
        .where(eq(releaseNote.id, n.id)),
    );
  });

  it("DELETE negado a TODOS, inclusive dev/master — sem GRANT (42501)", async () => {
    for (const [uid, p] of [
      [uDev.id, "dev"],
      [uMaster.id, "master"],
    ] as [string, string][]) {
      await expect(
        asUser(ctx.appDb, uid, p, (tx) =>
          tx.delete(releaseNote).where(eq(releaseNote.id, nota1.id)),
        ),
      ).rejects.toSatisfy(comCodigoPg("42501"));
    }
  });
});

describe("evento — RLS (visibilidade temporal R4)", () => {
  it("padrão vê o evento futuro, mas NÃO o passado", async () => {
    await asUser(ctx.appDb, uPadrao.id, "padrao", async (tx) => {
      const futuros = await tx
        .select()
        .from(evento)
        .where(eq(evento.id, eventoFuturo.id));
      expect(futuros.length).toBe(1);

      const passados = await tx
        .select()
        .from(evento)
        .where(eq(evento.id, eventoPassado.id));
      expect(passados.length).toBe(0);
    });
  });

  it("suporte vê o evento passado (histórico da gestão)", async () => {
    const rows = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx.select().from(evento).where(eq(evento.id, eventoPassado.id)),
    );
    expect(rows.length).toBe(1);
  });

  it("papel padrão: INSERT negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(evento).values({
          titulo: "Invasão",
          inicio: new Date(Date.now() + 3600_000),
          fim: new Date(Date.now() + 7200_000),
          criadoPor: uPadrao.id,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("suporte: INSERT, UPDATE e DELETE permitidos", async () => {
    const [e] = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx
        .insert(evento)
        .values({
          titulo: "Evento do Suporte",
          inicio: new Date(Date.now() + 3600_000),
          fim: new Date(Date.now() + 7200_000),
          criadoPor: uSuporte.id,
        })
        .returning(),
    );
    expect(e.id).toBeTruthy();
    await asUser(ctx.appDb, uSuporte.id, "suporte", async (tx) => {
      await tx
        .update(evento)
        .set({ titulo: "Evento Renomeado" })
        .where(eq(evento.id, e.id));
      await tx.delete(evento).where(eq(evento.id, e.id));
    });
  });

  it("check do banco: fim <= inicio rejeitado (23514)", async () => {
    const t = new Date(Date.now() + 3600_000);
    await expect(
      asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
        tx.insert(evento).values({
          titulo: "Inválido",
          inicio: t,
          fim: t,
          criadoPor: uSuporte.id,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("23514"));
  });
});

describe("aula_acesso — RLS (own-row com UPDATE próprio)", () => {
  it("dono lê o próprio acesso; outro papel não lê nada", async () => {
    const proprias = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .select()
        .from(aulaAcesso)
        .where(eq(aulaAcesso.usuarioId, uPadrao.id)),
    );
    expect(proprias.length).toBe(1);

    for (const [uid, p] of [
      [uSuporte.id, "suporte"],
      [uDev.id, "dev"],
    ] as [string, string][]) {
      const alheias = await asUser(ctx.appDb, uid, p, (tx) =>
        tx
          .select()
          .from(aulaAcesso)
          .where(eq(aulaAcesso.usuarioId, uPadrao.id)),
      );
      expect(alheias.length).toBe(0);
    }
  });

  it("INSERT de acesso para outro usuário negado (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx.insert(aulaAcesso).values({
          usuarioId: uSuporte.id,
          aulaId: aula2.id,
        }),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });

  it("dono faz upsert (UPDATE own-row) do próprio acesso", async () => {
    const rows = await asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
      tx
        .insert(aulaAcesso)
        .values({ usuarioId: uPadrao.id, aulaId: aula1.id })
        .onConflictDoUpdate({
          target: [aulaAcesso.usuarioId, aulaAcesso.aulaId],
          set: { acessadoEm: new Date() },
        })
        .returning(),
    );
    expect(rows.length).toBe(1);
  });

  it("UPDATE de linha alheia não atinge nada (filtrada, zero linhas)", async () => {
    const rows = await asUser(ctx.appDb, uSuporte.id, "suporte", (tx) =>
      tx
        .update(aulaAcesso)
        .set({ acessadoEm: new Date() })
        .where(eq(aulaAcesso.usuarioId, uPadrao.id))
        .returning(),
    );
    expect(rows.length).toBe(0);
  });

  it("DELETE negado — sem GRANT (42501)", async () => {
    await expect(
      asUser(ctx.appDb, uPadrao.id, "padrao", (tx) =>
        tx
          .delete(aulaAcesso)
          .where(eq(aulaAcesso.usuarioId, uPadrao.id)),
      ),
    ).rejects.toSatisfy(comCodigoPg("42501"));
  });
});
