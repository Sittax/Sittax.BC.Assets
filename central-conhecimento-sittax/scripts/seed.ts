import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { withSystem } from "../src/lib/db/rls";
import { endPool } from "../src/lib/db/client";
import {
  aula,
  eadModulo,
  escritorio,
  escritorioProduto,
  evento,
  inscricaoEad,
  modulo,
  papelMapeamento,
  produto,
  prova,
  questao,
  releaseNote,
  topico,
  usuario,
} from "../src/lib/db/schema";
import { sanitizarMarkdown } from "../src/lib/conteudo/sanitizar";
import { and, eq } from "drizzle-orm";

/**
 * Seed de desenvolvimento (padrão) e bootstrap de produção (--bootstrap).
 * Roda via withSystem (research R5). Idempotente: reexecutar não duplica.
 *
 * Bootstrap (exceção documentada ao "tudo pela interface"): cria APENAS os 6
 * produtos e o primeiro Master (SEED_MASTER_EMAIL / SEED_MASTER_PASSWORD).
 */

// Catálogo oficial dos 6 produtos, na ordem do seletor (fornecido pelo PO
// em 2026-06-10).
const PRODUTOS = [
  { nome: "Sittax Simples", ordem: 1 },
  { nome: "Sittax Recupera", ordem: 2 },
  { nome: "Sittax ST", ordem: 3 },
  { nome: "Sittax Token", ordem: 4 },
  { nome: "Sittax Monitora", ordem: 5 },
  { nome: "Sittax Certificado", ordem: 6 },
];

// CNPJs de teste com dígitos verificadores válidos
const ESCRITORIOS_DEV = [
  { cnpj: "11222333000181", nome: "Escritório Alfa Contabilidade" },
  { cnpj: "11444777000161", nome: "Escritório Beta Assessoria" },
];

async function seedProdutos() {
  return withSystem(async (tx) => {
    await tx.insert(produto).values(PRODUTOS).onConflictDoNothing();
    return tx.select().from(produto);
  });
}

async function bootstrap() {
  const email = process.env.SEED_MASTER_EMAIL;
  const senha = process.env.SEED_MASTER_PASSWORD;
  if (!email || !senha || senha.length < 10) {
    throw new Error(
      "Bootstrap exige SEED_MASTER_EMAIL e SEED_MASTER_PASSWORD (mínimo 10 caracteres) no ambiente.",
    );
  }
  await seedProdutos();
  const senhaHash = await hash(senha);
  await withSystem(async (tx) => {
    await tx
      .insert(usuario)
      .values({
        nome: "Master",
        email: email.trim().toLowerCase(),
        papel: "master",
        origem: "central",
        senhaHash,
      })
      .onConflictDoNothing();
  });
  console.log("Bootstrap concluído: 6 produtos + primeiro Master.");
}

async function seedDev() {
  const senha = process.env.SEED_USER_PASSWORD ?? "central12345";
  const senhaHash = await hash(senha);
  const produtos = await seedProdutos();

  await withSystem(async (tx) => {
    await tx.insert(escritorio).values(ESCRITORIOS_DEV).onConflictDoNothing();
    const escritorios = await tx.select().from(escritorio);
    const alfa = escritorios.find((e) => e.cnpj === ESCRITORIOS_DEV[0].cnpj)!;
    const beta = escritorios.find((e) => e.cnpj === ESCRITORIOS_DEV[1].cnpj)!;

    // produtos contratados: alfa contrata 1-3, beta contrata 4-6
    const ordenados = [...produtos].sort((a, b) => a.ordem - b.ordem);
    await tx
      .insert(escritorioProduto)
      .values([
        ...ordenados.slice(0, 3).map((p) => ({
          escritorioId: alfa.id,
          produtoId: p.id,
        })),
        ...ordenados.slice(3).map((p) => ({
          escritorioId: beta.id,
          produtoId: p.id,
        })),
      ])
      .onConflictDoNothing();

    // 4 usuários, um por papel
    await tx
      .insert(usuario)
      .values([
        {
          nome: "Paula",
          sobrenome: "Padrão",
          email: "padrao@exemplo.dev",
          papel: "padrao",
          origem: "sistema",
          escritorioId: alfa.id,
          idOrigem: "00000000-0000-0000-0000-000000000001",
        },
        {
          nome: "Saulo",
          sobrenome: "Suporte",
          email: "suporte@exemplo.dev",
          papel: "suporte",
          origem: "sistema",
          idOrigem: "00000000-0000-0000-0000-000000000002",
        },
        {
          nome: "Diego",
          sobrenome: "Dev",
          email: "dev@exemplo.dev",
          papel: "dev",
          origem: "central",
          senhaHash,
        },
        {
          nome: "Marta",
          sobrenome: "Master",
          email: "master@exemplo.dev",
          papel: "master",
          origem: "central",
          senhaHash,
        },
      ])
      .onConflictDoNothing();

    // mapa de papéis placeholder até o PO fornecer o real (editável na tela)
    await tx
      .insert(papelMapeamento)
      .values([{ roleOrigem: "ADMINISTRADOR", nivelOrigem: 10, papelCentral: "dev" }])
      .onConflictDoNothing();
  });

  console.log(
    "Seed de desenvolvimento concluído: 6 produtos, 2 escritórios, 4 usuários (senha local: SEED_USER_PASSWORD), mapa placeholder.",
  );
}

async function seedConteudo() {
  await withSystem(async (tx) => {
    const prods = await tx.select().from(produto);
    const p1 = prods.find((p) => p.ordem === 1);
    const p2 = prods.find((p) => p.ordem === 2);
    if (!p1 || !p2) return;

    // ── Produto 1: 2 módulos, ~6 tópicos (para testes de leitura e sanitização)
    // onConflictDoNothing devolve [] quando já existe — busca o existente como fallback
    async function upsertModulo(prodId: string, nome: string, ordem: number) {
      const [inserted] = await tx
        .insert(modulo)
        .values({ produtoId: prodId, nome, ordem })
        .onConflictDoNothing()
        .returning();
      if (inserted) return inserted;
      const [existing] = await tx
        .select()
        .from(modulo)
        .where(and(eq(modulo.produtoId, prodId), eq(modulo.nome, nome)));
      return existing;
    }

    const mod1 = await upsertModulo(p1.id, "Introdução", 1);
    const mod2 = await upsertModulo(p1.id, "Operações", 2);

    if (mod1) {
      const mdPublico = "# Bem-vindo\n\nEsta é a base de conhecimento do produto.\n";
      const mdNota = `# Notas Internas\n\nConteúdo público aqui.\n\n:::nota-interna\nEsta nota só aparece para suporte.\n:::\n\n:::nota-tecnica\nDetalhe técnico reservado.\n:::\n`;
      const mdVideo = `# Tutorial em Vídeo\n\n:::video\nhttps://exemplo.com/video123\n:::\n`;

      await tx
        .insert(topico)
        .values([
          {
            moduloId: mod1.id,
            produtoId: p1.id,
            titulo: "Bem-vindo",
            slug: "bem-vindo",
            conteudoMd: mdPublico,
            conteudoPublico: sanitizarMarkdown(mdPublico, "padrao"),
            ordem: 1,
          },
          {
            moduloId: mod1.id,
            produtoId: p1.id,
            titulo: "Notas e Blocos Internos",
            slug: "notas-e-blocos-internos",
            conteudoMd: mdNota,
            conteudoPublico: sanitizarMarkdown(mdNota, "padrao"),
            ordem: 2,
          },
          {
            moduloId: mod1.id,
            produtoId: p1.id,
            titulo: "Tutorial em Vídeo",
            slug: "tutorial-em-video",
            conteudoMd: mdVideo,
            conteudoPublico: sanitizarMarkdown(mdVideo, "padrao"),
            ordem: 3,
          },
        ])
        .onConflictDoNothing();
    }

    if (mod2) {
      const sub1Md = "# Subtópico A\n\nConteúdo do subtópico A.\n";
      const sub2Md = "# Subtópico B\n\nConteúdo do subtópico B.\n";
      const [t1] = await tx
        .insert(topico)
        .values({
          moduloId: mod2.id,
          produtoId: p1.id,
          titulo: "Processamento",
          slug: "processamento",
          conteudoMd: "# Processamento\n\nVisão geral de processamento.\n",
          conteudoPublico: sanitizarMarkdown("# Processamento\n\nVisão geral de processamento.\n", "padrao"),
          ordem: 1,
        })
        .onConflictDoNothing()
        .returning();

      if (t1) {
        await tx
          .insert(topico)
          .values([
            {
              moduloId: mod2.id,
              produtoId: p1.id,
              parentId: t1.id,
              titulo: "Subtópico A",
              slug: "subtopico-a",
              conteudoMd: sub1Md,
              conteudoPublico: sanitizarMarkdown(sub1Md, "padrao"),
              ordem: 1,
            },
            {
              moduloId: mod2.id,
              produtoId: p1.id,
              parentId: t1.id,
              titulo: "Subtópico B",
              slug: "subtopico-b",
              conteudoMd: sub2Md,
              conteudoPublico: sanitizarMarkdown(sub2Md, "padrao"),
              ordem: 2,
            },
          ])
          .onConflictDoNothing();
      }
    }

    // ── Tópicos com diretivas internas (Princípio III — validação manual)
    if (mod1) {
      const mdNotaInterna1 = `# Configuração Avançada\n\nPara configurar o módulo siga os passos abaixo.\n\n:::nota-interna\nXYZSEGREDOINTERNO — credenciais de homologação: usuário admin, senha temporária enviada por e-mail ao gestor.\n:::\n\nAcesse o painel de configurações no menu lateral.\n`;
      const mdNotaInterna2 = `# Política de Cancelamento\n\nO cancelamento pode ser solicitado a qualquer momento.\n\n:::nota-interna\nXYZCONFIDENCIAL — desconto de retenção de até 40% autorizado pelo gerente comercial; não informar ao cliente proativamente.\n:::\n\nEntre em contato com o suporte para iniciar o processo.\n`;
      const mdNotaTecnica = `# Integração via API\n\nA integração usa REST com autenticação por token Bearer.\n\n:::nota-tecnica\nXYZDETALHESTECNICOS — endpoint interno: https://api-interna.sittax.local/v2; timeout recomendado 8 s; retry com backoff exponencial (máx 3 tentativas).\n:::\n\nConsulte a documentação pública para os endpoints disponíveis.\n`;

      await tx
        .insert(topico)
        .values([
          {
            moduloId: mod1.id,
            produtoId: p1.id,
            titulo: "Configuração Avançada",
            slug: "configuracao-avancada",
            conteudoMd: mdNotaInterna1,
            conteudoPublico: sanitizarMarkdown(mdNotaInterna1, "padrao"),
            ordem: 4,
          },
          {
            moduloId: mod1.id,
            produtoId: p1.id,
            titulo: "Política de Cancelamento",
            slug: "politica-de-cancelamento",
            conteudoMd: mdNotaInterna2,
            conteudoPublico: sanitizarMarkdown(mdNotaInterna2, "padrao"),
            ordem: 5,
          },
          {
            moduloId: mod1.id,
            produtoId: p1.id,
            titulo: "Integração via API",
            slug: "integracao-via-api",
            conteudoMd: mdNotaTecnica,
            conteudoPublico: sanitizarMarkdown(mdNotaTecnica, "padrao"),
            ordem: 6,
          },
        ])
        .onConflictDoNothing();
    }

    // ── Produto 2: 1 módulo, 2 tópicos (para teste de isolamento da busca)
    const mod3 = await upsertModulo(p2.id, "Fundamentos", 1);

    if (mod3) {
      const somente2Md = "# Exclusivo Produto 2\n\nEste tópico só aparece no produto 2.\n";
      await tx
        .insert(topico)
        .values([
          {
            moduloId: mod3.id,
            produtoId: p2.id,
            titulo: "Introdução ao Produto 2",
            slug: "introducao-produto-2",
            conteudoMd: "# Introdução\n\nBem-vindo ao produto 2.\n",
            conteudoPublico: sanitizarMarkdown("# Introdução\n\nBem-vindo ao produto 2.\n", "padrao"),
            ordem: 1,
          },
          {
            moduloId: mod3.id,
            produtoId: p2.id,
            titulo: "Exclusivo Produto 2",
            slug: "exclusivo-produto-2",
            conteudoMd: somente2Md,
            conteudoPublico: sanitizarMarkdown(somente2Md, "padrao"),
            ordem: 2,
          },
        ])
        .onConflictDoNothing();
    }
  });
  console.log("Seed de conteúdo concluído: módulos e tópicos dos produtos 1 e 2.");
}

async function seedEad() {
  await withSystem(async (tx) => {
    const prods = await tx.select().from(produto);
    const p1 = prods.find((p) => p.ordem === 1);
    if (!p1) return;

    async function upsertEadModulo(
      prodId: string,
      nome: string,
      ordem: number,
    ) {
      const [inserted] = await tx
        .insert(eadModulo)
        .values({ produtoId: prodId, nome, ordem })
        .onConflictDoNothing()
        .returning();
      if (inserted) return inserted;
      const [existing] = await tx
        .select()
        .from(eadModulo)
        .where(and(eq(eadModulo.produtoId, prodId), eq(eadModulo.nome, nome)));
      return existing;
    }

    const mod1 = await upsertEadModulo(p1.id, "Introdução ao Produto", 1);
    const mod2 = await upsertEadModulo(p1.id, "Funcionalidades Avançadas", 2);

    if (mod1) {
      await tx
        .insert(aula)
        .values([
          {
            eadModuloId: mod1.id,
            titulo: "Bem-vindo ao EAD",
            youtubeId: "dQw4w9WgXcQ",
            descricaoMd: "# Bem-vindo\n\nNesta aula você conhece a plataforma.\n",
            ordem: 1,
          },
          {
            eadModuloId: mod1.id,
            titulo: "Primeiros Passos",
            youtubeId: "9bZkp7q19f0",
            descricaoMd: "# Primeiros Passos\n\nConfigure sua conta e explore o painel.\n",
            ordem: 2,
          },
        ])
        .onConflictDoNothing();
    }

    if (mod2) {
      await tx
        .insert(aula)
        .values([
          {
            eadModuloId: mod2.id,
            titulo: "Configuração Avançada",
            youtubeId: "M7lc1UVf-VE",
            descricaoMd: "# Configuração Avançada\n\nAprofunde-se nas configurações do sistema.\n",
            ordem: 1,
          },
          {
            eadModuloId: mod2.id,
            titulo: "Integrações e API",
            youtubeId: "ZZ5LpwO-An4",
            descricaoMd: "# Integrações\n\nConecte o produto a outros sistemas.\n",
            ordem: 2,
          },
        ])
        .onConflictDoNothing();
    }

    // Prova de alicerce (sem fluxo nesta fase — dados inertes para validação)
    const [provaExistente] = await tx
      .select()
      .from(prova)
      .where(eq(prova.produtoId, p1.id));

    if (!provaExistente) {
      const [novaProva] = await tx
        .insert(prova)
        .values({ produtoId: p1.id, notaCorte: 70 })
        .returning();

      if (novaProva) {
        await tx.insert(questao).values([
          {
            provaId: novaProva.id,
            enunciado: "Qual é o objetivo principal do produto?",
            alternativas: JSON.stringify([
              "Gestão tributária",
              "Gestão de RH",
              "Gestão de estoque",
              "Gestão de marketing",
            ]),
            gabarito: 0,
            ordem: 1,
          },
          {
            provaId: novaProva.id,
            enunciado: "Como acessar o painel de configurações?",
            alternativas: JSON.stringify([
              "Pelo menu lateral",
              "Pelo rodapé",
              "Pela barra de título",
              "Pelo ícone de ajuda",
            ]),
            gabarito: 0,
            ordem: 2,
          },
        ]);
      }
    }

    // 2º usuário padrão (mesmo escritório) para validação de isolamento de progresso
    const usuarios = await tx.select().from(usuario);
    const alfaEscritorio = await tx
      .select()
      .from(escritorio)
      .where(eq(escritorio.cnpj, "11222333000181"));
    const alfa = alfaEscritorio[0];

    if (alfa && !usuarios.find((u) => u.email === "padrao2@exemplo.dev")) {
      await tx
        .insert(usuario)
        .values({
          nome: "Pedro",
          sobrenome: "Padrão2",
          email: "padrao2@exemplo.dev",
          papel: "padrao",
          origem: "sistema",
          escritorioId: alfa.id,
          idOrigem: "00000000-0000-0000-0000-000000000010",
        })
        .onConflictDoNothing();
    }
  });
  console.log("Seed EAD concluído: 2 módulos, 4 aulas, 1 prova de alicerce, 2º usuário padrão.");
}

async function seedDashboard() {
  await withSystem(async (tx) => {
    const prods = await tx.select().from(produto);
    const p1 = prods.find((p) => p.ordem === 1);
    const p2 = prods.find((p) => p.ordem === 2);
    const devUser = (await tx.select().from(usuario)).find(
      (u) => u.email === "dev@exemplo.dev",
    );
    if (!p1 || !p2 || !devUser) return;

    // Release notes (idempotente: só insere se ainda não há nenhuma)
    const notasExistentes = await tx.select().from(releaseNote);
    if (notasExistentes.length === 0) {
      const mdComInterna = `## Melhorias de junho\n\n- Novo painel de apuração\n- Correções de estabilidade\n\n:::nota-interna\nXYZNOTAINTERNA — script de migração manual necessário para clientes da base legada; acionar o time de dados antes de comunicar.\n:::\n`;
      const mdSimples = `## Primeira versão das notas\n\nLançamento do canal de atualizações do produto.\n`;
      const mdProduto2 = `## Atualização do módulo de recuperação\n\nNova triagem automática de créditos.\n`;

      await tx.insert(releaseNote).values([
        {
          produtoId: p1.id,
          data: new Date().toISOString().slice(0, 10),
          versao: "2.4.0",
          conteudoMd: mdComInterna,
          conteudoPublico: sanitizarMarkdown(mdComInterna, "padrao"),
          criadoPor: devUser.id,
        },
        {
          produtoId: p1.id,
          data: "2026-05-20",
          conteudoMd: mdSimples,
          conteudoPublico: sanitizarMarkdown(mdSimples, "padrao"),
          criadoPor: devUser.id,
        },
        {
          produtoId: p2.id,
          data: "2026-06-02",
          versao: "1.9.0",
          conteudoMd: mdProduto2,
          conteudoPublico: sanitizarMarkdown(mdProduto2, "padrao"),
          criadoPor: devUser.id,
        },
      ]);
    }

    // Eventos: 1 futuro e 1 passado (insumo do quickstart US4/US5)
    const eventosExistentes = await tx.select().from(evento);
    if (eventosExistentes.length === 0) {
      const amanha10h = new Date();
      amanha10h.setDate(amanha10h.getDate() + 7);
      amanha10h.setHours(10, 0, 0, 0);
      const amanha11h = new Date(amanha10h);
      amanha11h.setHours(11, 30);

      const passadoInicio = new Date();
      passadoInicio.setDate(passadoInicio.getDate() - 7);
      passadoInicio.setHours(15, 0, 0, 0);
      const passadoFim = new Date(passadoInicio);
      passadoFim.setHours(16, 0);

      await tx.insert(evento).values([
        {
          titulo: "Live de novidades da plataforma",
          descricao: "Apresentação das novidades do trimestre para os escritórios.",
          inicio: amanha10h,
          fim: amanha11h,
          criadoPor: devUser.id,
        },
        {
          titulo: "Treinamento de apuração (encerrado)",
          descricao: "Sessão prática de apuração — registro histórico.",
          inicio: passadoInicio,
          fim: passadoFim,
          criadoPor: devUser.id,
        },
      ]);
    }
  });
  console.log(
    "Seed do dashboard concluído: 3 release notes (1 com nota interna) e 2 eventos (1 futuro, 1 passado).",
  );
}

async function main() {
  if (process.argv.includes("--bootstrap")) {
    await bootstrap();
  } else {
    await seedDev();
    await seedConteudo();
    await seedEad();
    await seedDashboard();
  }
}

main()
  .catch((err) => {
    console.error("Falha no seed:", err);
    process.exitCode = 1;
  })
  .finally(() => endPool());
