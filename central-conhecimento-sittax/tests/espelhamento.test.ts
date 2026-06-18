import { hash } from "@node-rs/argon2";
import { createServer, type Server } from "node:http";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { processarLogin } from "../src/lib/auth/login-flow";
import { normalizarEmail } from "../src/lib/auth/mirror";
import {
  acessoLog,
  escritorio,
  papelMapeamento,
  produto,
  usuario,
} from "../src/lib/db/schema";
import { asSystem, setupTestDatabase } from "./helpers/db";

/**
 * REGRA CRÍTICA (Constituição IX): fluxo de espelhamento contra mock HTTP
 * local dos 6 sistemas, com fixtures do contrato docs/sso-login-endpoint.md.
 * Usa o banco central_test real — o espelhamento escreve via withSystem.
 */

// ----------------------------- mock dos 6 sistemas -----------------------------

interface RespostaMock {
  status: number;
  body?: unknown;
  delayMs?: number;
}

let servidor: Server;
let bases: string[] = [];
let respostas: RespostaMock[] = [];

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function jwt(claims: Record<string, unknown>): string {
  return `${b64url({ alg: "none", typ: "JWT" })}.${b64url(claims)}.assinatura`;
}

/** Resposta de sucesso no formato do contrato SSO. */
function corpoValido(opts: {
  email: string;
  role: string;
  nivel: number;
  cnpj?: string;
  escritorioNome?: string;
  id?: string;
  nome?: string;
}) {
  return {
    token: jwt({
      EscritorioCnpj: opts.cnpj ?? "",
      EscritorioNome: opts.escritorioNome ?? "",
      IdDoUsuario: opts.id ?? "2f057a26-d866-4256-97a2-30ae4a131f76",
      NomeDoUsuario: opts.nome ?? "USUARIO",
      Role: opts.role,
      Nivel: opts.nivel,
      Inadimplencia: "false",
    }),
    primeiro_acesso: false,
    usuario: {
      id: opts.id ?? "2f057a26-d866-4256-97a2-30ae4a131f76",
      nome: opts.nome ?? "Usuário",
      sobrenome: "Teste",
      email: opts.email,
      nivel: opts.nivel,
      role: opts.role,
    },
  };
}

function todasRecusam() {
  respostas = Array(6).fill({ status: 401 });
}

// ------------------------------------ setup ------------------------------------

let ctx: Awaited<ReturnType<typeof setupTestDatabase>>;
const SENHA_LOCAL = "senha-local-12345";

beforeAll(async () => {
  ctx = await setupTestDatabase();

  servidor = createServer((req, res) => {
    const m = req.url?.match(/^\/sys\/(\d)\/api\/auth\/login$/);
    const r = (m && respostas[Number(m[1])]) || { status: 401 };
    setTimeout(() => {
      res.statusCode = r.status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(r.body ?? { erro: "nao_autorizado" }));
    }, r.delayMs ?? 0);
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  const addr = servidor.address();
  const porta = typeof addr === "object" && addr ? addr.port : 0;
  bases = Array.from({ length: 6 }, (_, i) => `http://127.0.0.1:${porta}/sys/${i}`);

  // fixtures: mapa de papéis + usuário só central
  const senhaHash = await hash(SENHA_LOCAL);
  await asSystem(ctx.appDb, async (tx) => {
    await tx.insert(papelMapeamento).values([
      { roleOrigem: "ADMINISTRADOR", nivelOrigem: 10, papelCentral: "dev" },
      { roleOrigem: "SUPORTE", nivelOrigem: null, papelCentral: "suporte" },
    ]);
    await tx.insert(usuario).values({
      nome: "Marta",
      email: "master@teste.dev",
      papel: "master",
      origem: "central",
      senhaHash,
    });
  });
});

afterAll(async () => {
  await new Promise<void>((ok) => servidor.close(() => ok()));
  // encerra o pool de produção apontado para central_test
  const { endPool } = await import("../src/lib/db/client");
  await endPool();
  await ctx?.teardown();
});

beforeEach(() => {
  todasRecusam();
});

const opcoes = () => ({ baseUrls: bases, timeoutMs: 500, totalTimeoutMs: 2000 });

// inspeção de fixture via conexão admin (superusuário) — a policy de SELECT
// do acesso_log é só master; o contexto system não lê o log
async function contarAcessos(usuarioId: string) {
  const r = await ctx.adminPool.query(
    'SELECT id, produto_id AS "produtoId" FROM acesso_log WHERE usuario_id = $1 ORDER BY data',
    [usuarioId],
  );
  return r.rows as { id: string; produtoId: string | null }[];
}

// ------------------------------------ testes ------------------------------------

describe("login local (usuários só central — local-first)", () => {
  it("valida localmente sem consultar o SSO, mesmo com SSO 'validando'", async () => {
    // se o SSO fosse consultado, este mock validaria — local-first impede
    respostas = Array(6).fill({
      status: 200,
      body: corpoValido({ email: "master@teste.dev", role: "ADMINISTRADOR", nivel: 10 }),
    });
    const errado = await processarLogin("master@teste.dev", "senha-errada!!", opcoes());
    expect(errado.tipo).toBe("credencial_invalida");

    const certo = await processarLogin("MASTER@teste.dev ", SENHA_LOCAL, opcoes());
    expect(certo.tipo).toBe("ok");
    if (certo.tipo === "ok") {
      expect(certo.usuario.papel).toBe("master");
      const acessos = await contarAcessos(certo.usuario.id);
      expect(acessos).toHaveLength(1);
      expect(acessos[0].produtoId).toBeNull();
    }
  });

  it("usuário desativado não loga", async () => {
    const senhaHash = await hash(SENHA_LOCAL);
    const [inativo] = await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(usuario)
        .values({
          nome: "Inativo",
          email: "inativo@teste.dev",
          papel: "suporte",
          origem: "central",
          senhaHash,
          ativo: false,
        })
        .returning(),
    );
    expect(inativo.ativo).toBe(false);
    const r = await processarLogin("inativo@teste.dev", SENHA_LOCAL, opcoes());
    expect(r.tipo).toBe("usuario_inativo");
  });
});

describe("primeiro login espelhado", () => {
  it("cria usuário e escritório com papel traduzido pelo mapeamento", async () => {
    respostas[2] = {
      status: 200,
      body: corpoValido({
        email: "Nova.Pessoa@Sittax.com.br",
        role: "ADMINISTRADOR",
        nivel: 10,
        cnpj: "11.222.333/0001-81",
        escritorioNome: "Escritório Origem",
        nome: "Nova",
      }),
    };
    const r = await processarLogin("nova.pessoa@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("ok");
    if (r.tipo !== "ok") return;

    expect(r.usuario.papel).toBe("dev");
    expect(r.usuario.origem).toBe("sistema");
    expect(r.usuario.email).toBe("nova.pessoa@sittax.com.br");

    const esc = await asSystem(ctx.appDb, (tx) =>
      tx.select().from(escritorio).where(eq(escritorio.cnpj, "11222333000181")),
    );
    expect(esc).toHaveLength(1);
    expect(esc[0].nome).toBe("Escritório Origem");
    expect(r.usuario.escritorioId).toBe(esc[0].id);

    const acessos = await contarAcessos(r.usuario.id);
    expect(acessos).toHaveLength(1);
    expect(acessos[0].produtoId).toBeNull();
  });

  it("ressincroniza o papel no relogin (mapeamento vigente)", async () => {
    respostas[0] = {
      status: 200,
      body: corpoValido({
        email: "nova.pessoa@sittax.com.br",
        role: "SUPORTE",
        nivel: 3,
        cnpj: "11222333000181",
      }),
    };
    const r = await processarLogin("nova.pessoa@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") expect(r.usuario.papel).toBe("suporte");
  });

  it("role/nivel não mapeado entra como padrão (menor privilégio)", async () => {
    respostas[1] = {
      status: 200,
      body: corpoValido({
        email: "desconhecida@sittax.com.br",
        role: "PAPEL_DESCONHECIDO",
        nivel: 99,
        cnpj: "11444777000161",
      }),
    };
    const r = await processarLogin("desconhecida@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") expect(r.usuario.papel).toBe("padrao");
  });

  it("CNPJ vazio bloqueia papel padrão (sem_escritorio) e não cria usuário", async () => {
    respostas[0] = {
      status: 200,
      body: corpoValido({
        email: "sem.escritorio@sittax.com.br",
        role: "PAPEL_DESCONHECIDO",
        nivel: 1,
        cnpj: "",
      }),
    };
    const r = await processarLogin("sem.escritorio@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("sem_escritorio");

    const criados = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(usuario)
        .where(eq(usuario.email, "sem.escritorio@sittax.com.br")),
    );
    expect(criados).toHaveLength(0);
  });

  it("CNPJ vazio libera suporte+ (funcionário interno, sem escritório)", async () => {
    respostas[0] = {
      status: 200,
      body: corpoValido({
        email: "interno@sittax.com.br",
        role: "SUPORTE",
        nivel: 7,
        cnpj: "",
      }),
    };
    const r = await processarLogin("interno@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") {
      expect(r.usuario.papel).toBe("suporte");
      expect(r.usuario.escritorioId).toBeNull();
    }
  });

  it("nome de escritório vazio vira CNPJ formatado", async () => {
    respostas[0] = {
      status: 200,
      body: corpoValido({
        email: "outra@sittax.com.br",
        role: "SUPORTE",
        nivel: 1,
        cnpj: "06990590000123",
        escritorioNome: "",
      }),
    };
    const r = await processarLogin("outra@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("ok");
    const esc = await asSystem(ctx.appDb, (tx) =>
      tx.select().from(escritorio).where(eq(escritorio.cnpj, "06990590000123")),
    );
    expect(esc[0].nome).toBe("06.990.590/0001-23");
  });
});

describe("classificação de falhas (FR-007/FR-029)", () => {
  it("todos recusam → credencial_invalida", async () => {
    todasRecusam();
    const r = await processarLogin("alguem@sittax.com.br", "errada", opcoes());
    expect(r.tipo).toBe("credencial_invalida");
  });

  it("nenhum responde → indisponivel", async () => {
    respostas = Array(6).fill({ status: 500 });
    const r = await processarLogin("alguem@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("indisponivel");
  });

  it("misto (recusa + indisponível) → credencial_invalida_parcial", async () => {
    respostas = Array(6).fill({ status: 401 });
    respostas[3] = { status: 503 };
    const r = await processarLogin("alguem@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("credencial_invalida_parcial");
  });

  it("resposta malformada conta como inacessível daquele sistema", async () => {
    respostas = Array(6).fill({ status: 401 });
    respostas[0] = { status: 200, body: { qualquer: "coisa sem token" } };
    const r = await processarLogin("alguem@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("credencial_invalida_parcial");
  });

  it("respeita o teto total de tempo da tentativa", async () => {
    respostas = Array(6).fill({ status: 500, delayMs: 300 });
    const inicio = Date.now();
    const r = await processarLogin("alguem@sittax.com.br", "x", {
      baseUrls: bases,
      timeoutMs: 250,
      totalTimeoutMs: 600,
    });
    const duracao = Date.now() - inicio;
    expect(r.tipo).toBe("indisponivel");
    // teto de 600ms + última requisição em andamento; nunca 6 × 300ms
    expect(duracao).toBeLessThan(1500);
  });
});

describe("normalização", () => {
  it("e-mail é a chave de identidade, normalizado", () => {
    expect(normalizarEmail("  Fulano@Sittax.COM.br ")).toBe("fulano@sittax.com.br");
  });
});

describe("registro bruto de acesso (US4 — R10)", () => {
  it("login gera exatamente 1 registro, sem produto — a seleção automática inicial não registra troca", async () => {
    respostas[0] = {
      status: 200,
      body: corpoValido({
        email: "acessos@sittax.com.br",
        role: "SUPORTE",
        nivel: 2,
        cnpj: "11222333000181",
      }),
    };
    const r = await processarLogin("acessos@sittax.com.br", "x", opcoes());
    expect(r.tipo).toBe("ok");
    if (r.tipo !== "ok") return;

    // só o evento de login; nenhum evento de troca foi gravado junto
    const aposLogin = await contarAcessos(r.usuario.id);
    expect(aposLogin).toHaveLength(1);
    expect(aposLogin[0].produtoId).toBeNull();
  });

  it("troca de produto gera exatamente 1 registro com o produto (caminho da action via RLS)", async () => {
    // mesma operação da server action selecionarProduto (update própria linha
    // + insert no log), executada com o contexto RLS do próprio usuário
    const [prod] = await asSystem(ctx.appDb, (tx) =>
      tx
        .insert(produto)
        .values({ nome: "Produto Acesso", ordem: 90 })
        .returning(),
    );
    const [quem] = await asSystem(ctx.appDb, (tx) =>
      tx
        .select()
        .from(usuario)
        .where(eq(usuario.email, "acessos@sittax.com.br")),
    );

    const { asUser } = await import("./helpers/db");
    await asUser(ctx.appDb, quem.id, quem.papel, async (tx) => {
      await tx
        .update(usuario)
        .set({ produtoSelecionadoId: prod.id })
        .where(eq(usuario.id, quem.id));
      await tx
        .insert(acessoLog)
        .values({ usuarioId: quem.id, produtoId: prod.id });
    });

    const acessos = await contarAcessos(quem.id);
    expect(acessos).toHaveLength(2);
    const troca = acessos.filter((a) => a.produtoId !== null);
    expect(troca).toHaveLength(1);
    expect(troca[0].produtoId).toBe(prod.id);
  });
});
