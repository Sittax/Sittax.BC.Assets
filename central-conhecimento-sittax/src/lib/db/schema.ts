import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// As colunas tsvector geradas (tsv_publico, tsv_completo) são definidas
// diretamente no SQL da migração (0002_conteudo.sql) porque o drizzle-kit não
// suporta GENERATED ALWAYS AS para tsvector. O schema Drizzle não as declara.


// Papel "padrao" = usuário de escritório (renomeado de "cliente" por decisão do
// PO em 2026-06-10; "cliente" designa só a entidade comercial/escritório).
export const papelEnum = pgEnum("papel", ["padrao", "suporte", "dev", "master"]);
export const papelEspelhavelEnum = pgEnum("papel_espelhavel", [
  "padrao",
  "suporte",
  "dev",
]);
export const origemEnum = pgEnum("origem", ["sistema", "central"]);

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const escritorio = pgTable("escritorio", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // 14 dígitos normalizados (R9); chave de espelhamento
  cnpj: varchar("cnpj", { length: 14 }).notNull().unique(),
  nome: text("nome").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const produto = pgTable("produto", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nome: text("nome").notNull().unique(),
  // ordem de exibição no seletor (CHK017)
  ordem: integer("ordem").notNull(),
});

export const usuario = pgTable(
  "usuario",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    escritorioId: uuid("escritorio_id").references(() => escritorio.id, {
      // FR-026: exclusão de escritório com usuários é impedida pelo banco
      onDelete: "restrict",
    }),
    nome: text("nome").notNull(),
    sobrenome: text("sobrenome"),
    // chave de identidade entre origem e registro local (R1)
    email: citext("email").notNull().unique(),
    papel: papelEnum("papel").notNull(),
    origem: origemEnum("origem").notNull(),
    senhaHash: text("senha_hash"),
    ativo: boolean("ativo").notNull().default(true),
    // informativo: id no primeiro sistema de origem que validou (R1)
    idOrigem: text("id_origem"),
    produtoSelecionadoId: uuid("produto_selecionado_id").references(
      () => produto.id,
    ),
    ultimoLoginEm: timestamp("ultimo_login_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // FR-012: papel padrão pertence a exatamente um escritório
    check(
      "usuario_padrao_tem_escritorio",
      sql`${t.papel} <> 'padrao' OR ${t.escritorioId} IS NOT NULL`,
    ),
    check(
      "usuario_central_tem_senha",
      sql`${t.origem} <> 'central' OR ${t.senhaHash} IS NOT NULL`,
    ),
    check(
      "usuario_sistema_sem_senha",
      sql`${t.origem} <> 'sistema' OR ${t.senhaHash} IS NULL`,
    ),
    // Master é sempre local (nunca vem da origem)
    check(
      "usuario_master_origem_central",
      sql`${t.papel} <> 'master' OR ${t.origem} = 'central'`,
    ),
  ],
);

export const escritorioProduto = pgTable(
  "escritorio_produto",
  {
    escritorioId: uuid("escritorio_id")
      .notNull()
      .references(() => escritorio.id, { onDelete: "cascade" }),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produto.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.escritorioId, t.produtoId] })],
);

export const acessoLog = pgTable("acesso_log", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuario.id),
  // NULL no evento de login (R10)
  produtoId: uuid("produto_id").references(() => produto.id),
  data: timestamp("data", { withTimezone: true }).notNull().defaultNow(),
});

export const papelMapeamento = pgTable(
  "papel_mapeamento",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    roleOrigem: text("role_origem").notNull(),
    // NULL = curinga de nível (R8)
    nivelOrigem: integer("nivel_origem"),
    papelCentral: papelEspelhavelEnum("papel_central").notNull(),
  },
  (t) => [
    // NULLS NOT DISTINCT: só um curinga por role
    unique("papel_mapeamento_role_nivel_unique")
      .on(t.roleOrigem, t.nivelOrigem)
      .nullsNotDistinct(),
  ],
);

// ─── Feature 002: Base de Conhecimento ───────────────────────────────────────

export const modulo = pgTable(
  "modulo",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produto.id, { onDelete: "restrict" }),
    nome: text("nome").notNull(),
    ordem: integer("ordem").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("modulo_produto_nome_unique").on(t.produtoId, t.nome)],
);

export const topico = pgTable(
  "topico",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    moduloId: uuid("modulo_id")
      .notNull()
      .references(() => modulo.id, { onDelete: "restrict" }),
    // produto_id denormalizado = produto do módulo (R7)
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produto.id, { onDelete: "restrict" }),
    parentId: uuid("parent_id"),
    titulo: text("titulo").notNull(),
    slug: text("slug").notNull(),
    conteudoMd: text("conteudo_md").notNull().default(""),
    // DERIVADA: sanitizarMarkdown(conteudo_md, 'padrao') — recalculada a cada save/import
    conteudoPublico: text("conteudo_publico").notNull().default(""),
    ordem: integer("ordem").notNull(),
    atualizadoPor: uuid("atualizado_por").references(() => usuario.id),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("topico_produto_slug_unique").on(t.produtoId, t.slug)],
);

export const arquivo = pgTable("arquivo", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nomeOriginal: text("nome_original").notNull(),
  mime: text("mime").notNull(),
  tamanho: integer("tamanho").notNull(),
  chaveStorage: text("chave_storage").notNull().unique(),
  criadoPor: uuid("criado_por")
    .notNull()
    .references(() => usuario.id),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Feature 003: EAD do Cliente ─────────────────────────────────────────────

export const inscricaoStatusEnum = pgEnum("inscricao_status", [
  "em_andamento",
  "concluido",
]);

export const eadModulo = pgTable(
  "ead_modulo",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    produtoId: uuid("produto_id").references(() => produto.id, {
      onDelete: "restrict",
    }),
    interno: boolean("interno").notNull().default(false),
    temaInterno: text("tema_interno"),
    nivel: integer("nivel"),
    nome: text("nome").notNull(),
    capaUrl: text("capa_url"),
    descricaoMd: text("descricao_md").notNull().default(""),
    ordem: integer("ordem").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("ead_modulo_produto_nome_unique").on(t.produtoId, t.nome),
    check(
      "ead_modulo_cliente_tem_produto",
      sql`${t.interno} = true OR ${t.produtoId} IS NOT NULL`,
    ),
    check(
      "ead_modulo_interno_tem_tema",
      sql`${t.interno} = false OR ${t.temaInterno} IS NOT NULL`,
    ),
  ],
);

export const aula = pgTable("aula", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eadModuloId: uuid("ead_modulo_id")
    .notNull()
    .references(() => eadModulo.id, { onDelete: "restrict" }),
  titulo: text("titulo").notNull(),
  youtubeId: varchar("youtube_id", { length: 11 }).notNull(),
  descricaoMd: text("descricao_md").notNull().default(""),
  ordem: integer("ordem").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Produtos VINCULADOS adicionais de um EAD de cliente (M:N) — para temas que
// abrangem mais de um produto. O produto PRINCIPAL continua em
// ead_modulo.produto_id; esta tabela guarda apenas os extras. Exceção
// declarada ao §4 do escopo (ver docs §6.2).
export const eadModuloProduto = pgTable(
  "ead_modulo_produto",
  {
    eadModuloId: uuid("ead_modulo_id")
      .notNull()
      .references(() => eadModulo.id, { onDelete: "cascade" }),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produto.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.eadModuloId, t.produtoId] })],
);

export const inscricaoEad = pgTable(
  "inscricao_ead",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id),
    produtoId: uuid("produto_id").references(() => produto.id),
    eadModuloId: uuid("ead_modulo_id").references(() => eadModulo.id),
    interno: boolean("interno").notNull().default(false),
    status: inscricaoStatusEnum("status").notNull().default("em_andamento"),
    dataInicio: timestamp("data_inicio", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dataConclusao: timestamp("data_conclusao", { withTimezone: true }),
  },
  (t) => [
    check(
      "inscricao_cliente_tem_produto",
      sql`${t.interno} = true OR ${t.produtoId} IS NOT NULL`,
    ),
    check(
      "inscricao_concluida_tem_data",
      sql`${t.status} <> 'concluido' OR ${t.dataConclusao} IS NOT NULL`,
    ),
  ],
);

export const progressoAula = pgTable(
  "progresso_aula",
  {
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id),
    aulaId: uuid("aula_id")
      .notNull()
      .references(() => aula.id, { onDelete: "cascade" }),
    vistaEm: timestamp("vista_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.aulaId] })],
);

// ─── Alicerce da avaliação (sem fluxo nesta fase — FR-012/FR-014) ─────────────

export const prova = pgTable(
  "prova",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    produtoId: uuid("produto_id")
      .unique()
      .references(() => produto.id),
    eadModuloId: uuid("ead_modulo_id").references(() => eadModulo.id),
    notaCorte: integer("nota_corte").notNull(),
  },
  (t) => [
    check("prova_nota_corte_range", sql`${t.notaCorte} BETWEEN 0 AND 100`),
    check(
      "prova_fk_exclusiva",
      sql`num_nonnulls(${t.produtoId}, ${t.eadModuloId}) = 1`,
    ),
  ],
);

export const questao = pgTable("questao", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  provaId: uuid("prova_id")
    .notNull()
    .references(() => prova.id, { onDelete: "cascade" }),
  enunciado: text("enunciado").notNull(),
  alternativas: jsonb("alternativas").notNull(),
  gabarito: integer("gabarito").notNull(),
  ordem: integer("ordem").notNull(),
});

export const tentativa = pgTable("tentativa", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuario.id),
  provaId: uuid("prova_id")
    .notNull()
    .references(() => prova.id),
  nota: integer("nota").notNull(),
  aprovado: boolean("aprovado").notNull(),
  data: timestamp("data", { withTimezone: true }).notNull().defaultNow(),
});

export const certificado = pgTable("certificado", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuario.id),
  inscricaoId: uuid("inscricao_id")
    .notNull()
    .unique()
    .references(() => inscricaoEad.id),
  codigoValidacao: text("codigo_validacao").notNull().unique(),
  data: timestamp("data", { withTimezone: true }).notNull(),
});

// ─── Feature 004: Dashboard, Release Notes e Eventos ─────────────────────────

export const releaseNote = pgTable("release_note", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  produtoId: uuid("produto_id")
    .notNull()
    .references(() => produto.id, { onDelete: "restrict" }),
  // dev pode publicar nota retroativa; default hoje fica na UI
  data: date("data").notNull(),
  versao: text("versao"),
  conteudoMd: text("conteudo_md").notNull().default(""),
  // DERIVADA: sanitizarMarkdown(conteudo_md, 'padrao') — recalculada em todo save (R2)
  conteudoPublico: text("conteudo_publico").notNull().default(""),
  // Referência opcional a um tópico da base de conhecimento (link "Ver na base")
  topicoId: uuid("topico_id").references(() => topico.id, { onDelete: "set null" }),
  criadoPor: uuid("criado_por")
    .notNull()
    .references(() => usuario.id),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
  atualizadoPor: uuid("atualizado_por").references(() => usuario.id),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }),
});

export const evento = pgTable(
  "evento",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    titulo: text("titulo").notNull(),
    descricao: text("descricao").notNull().default(""),
    inicio: timestamp("inicio", { withTimezone: true }).notNull(),
    fim: timestamp("fim", { withTimezone: true }).notNull(),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => usuario.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // FR-016; pontualidade (mesmo dia) é regra de v1 validada no Zod (R3)
    check("evento_fim_apos_inicio", sql`${t.fim} > ${t.inicio}`),
  ],
);

// Até 4 tópicos fixados por produto como "Destaques da base" no dashboard.
// Quando ausente, o dashboard recua para os 4 mais recentes.
export const destaqueBase = pgTable(
  "destaque_base",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produto.id, { onDelete: "cascade" }),
    topicoId: uuid("topico_id")
      .notNull()
      .references(() => topico.id, { onDelete: "cascade" }),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [unique("destaque_base_produto_topico").on(t.produtoId, t.topicoId)],
);

// Fato "usuário abriu a página da aula" — base da retomada (R1).
// Distinto de progresso_aula (vista = evento `ended` do player).
export const aulaAcesso = pgTable(
  "aula_acesso",
  {
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id),
    aulaId: uuid("aula_id")
      .notNull()
      .references(() => aula.id, { onDelete: "cascade" }),
    acessadoEm: timestamp("acessado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.aulaId] })],
);

// ─── Feature: Materiais de Aula ─────────────────────────────────────────────
// Arquivos enviados por dev/master junto da aula; armazenados no MinIO;
// visíveis a qualquer autenticado que acesse a aula.
export const aulaMaterial = pgTable("aula_material", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  aulaId: uuid("aula_id")
    .notNull()
    .references(() => aula.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  url: text("url").notNull(),
  mime: text("mime").notNull().default(""),
  tamanhoBytes: integer("tamanho_bytes"),
  ordem: integer("ordem").notNull().default(0),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Feature: Anotações de Aula ─────────────────────────────────────────────
// Privadas por usuário (RLS own-row). Texto markdown. Várias por aula.
export const aulaAnotacao = pgTable("aula_anotacao", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  aulaId: uuid("aula_id")
    .notNull()
    .references(() => aula.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuario.id, { onDelete: "cascade" }),
  conteudoMd: text("conteudo_md").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});
