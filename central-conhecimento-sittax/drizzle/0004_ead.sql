-- Feature 003: EAD do Cliente — 8 tabelas + enum + checks + índice parcial
-- Gerada a partir do schema.ts com ajustes manuais para checks e índice parcial
-- (drizzle-kit não cobre CHECK com num_nonnulls nem UNIQUE parcial WHERE)

--> statement-breakpoint
CREATE TYPE "public"."inscricao_status" AS ENUM('em_andamento', 'concluido');
--> statement-breakpoint
CREATE TABLE "ead_modulo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid,
	"interno" boolean DEFAULT false NOT NULL,
	"tema_interno" text,
	"nivel" integer,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ead_modulo_produto_nome_unique" UNIQUE("produto_id","nome"),
	CONSTRAINT "ead_modulo_cliente_tem_produto" CHECK (interno = true OR produto_id IS NOT NULL),
	CONSTRAINT "ead_modulo_interno_tem_tema" CHECK (interno = false OR tema_interno IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "aula" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ead_modulo_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"youtube_id" varchar(11) NOT NULL,
	"descricao_md" text DEFAULT '' NOT NULL,
	"ordem" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inscricao_ead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"produto_id" uuid,
	"interno" boolean DEFAULT false NOT NULL,
	"status" "inscricao_status" DEFAULT 'em_andamento' NOT NULL,
	"data_inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"data_conclusao" timestamp with time zone,
	CONSTRAINT "inscricao_cliente_tem_produto" CHECK (interno = true OR produto_id IS NOT NULL),
	CONSTRAINT "inscricao_concluida_tem_data" CHECK (status <> 'concluido' OR data_conclusao IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "progresso_aula" (
	"usuario_id" uuid NOT NULL,
	"aula_id" uuid NOT NULL,
	"vista_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progresso_aula_usuario_id_aula_id_pk" PRIMARY KEY("usuario_id","aula_id")
);
--> statement-breakpoint
-- Alicerce da avaliação (sem fluxo nesta fase)
CREATE TABLE "prova" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid,
	"ead_modulo_id" uuid,
	"nota_corte" integer NOT NULL,
	CONSTRAINT "prova_produto_id_unique" UNIQUE("produto_id"),
	CONSTRAINT "prova_nota_corte_range" CHECK (nota_corte BETWEEN 0 AND 100),
	CONSTRAINT "prova_fk_exclusiva" CHECK (num_nonnulls(produto_id, ead_modulo_id) = 1)
);
--> statement-breakpoint
CREATE TABLE "questao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prova_id" uuid NOT NULL,
	"enunciado" text NOT NULL,
	"alternativas" jsonb NOT NULL,
	"gabarito" integer NOT NULL,
	"ordem" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentativa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"prova_id" uuid NOT NULL,
	"nota" integer NOT NULL,
	"aprovado" boolean NOT NULL,
	"data" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"inscricao_id" uuid NOT NULL,
	"codigo_validacao" text NOT NULL,
	"data" timestamp with time zone NOT NULL,
	CONSTRAINT "certificado_inscricao_id_unique" UNIQUE("inscricao_id"),
	CONSTRAINT "certificado_codigo_validacao_unique" UNIQUE("codigo_validacao")
);
--> statement-breakpoint
ALTER TABLE "ead_modulo" ADD CONSTRAINT "ead_modulo_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aula" ADD CONSTRAINT "aula_ead_modulo_id_ead_modulo_id_fk" FOREIGN KEY ("ead_modulo_id") REFERENCES "public"."ead_modulo"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inscricao_ead" ADD CONSTRAINT "inscricao_ead_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inscricao_ead" ADD CONSTRAINT "inscricao_ead_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "progresso_aula" ADD CONSTRAINT "progresso_aula_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "progresso_aula" ADD CONSTRAINT "progresso_aula_aula_id_aula_id_fk" FOREIGN KEY ("aula_id") REFERENCES "public"."aula"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "prova" ADD CONSTRAINT "prova_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "prova" ADD CONSTRAINT "prova_ead_modulo_id_ead_modulo_id_fk" FOREIGN KEY ("ead_modulo_id") REFERENCES "public"."ead_modulo"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "questao" ADD CONSTRAINT "questao_prova_id_prova_id_fk" FOREIGN KEY ("prova_id") REFERENCES "public"."prova"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tentativa" ADD CONSTRAINT "tentativa_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tentativa" ADD CONSTRAINT "tentativa_prova_id_prova_id_fk" FOREIGN KEY ("prova_id") REFERENCES "public"."prova"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "certificado" ADD CONSTRAINT "certificado_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "certificado" ADD CONSTRAINT "certificado_inscricao_id_inscricao_ead_id_fk" FOREIGN KEY ("inscricao_id") REFERENCES "public"."inscricao_ead"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Índice único parcial para inscrição de produto (R5): um usuário, um EAD de produto ativo
CREATE UNIQUE INDEX "inscricao_ead_usuario_produto_uq" ON "inscricao_ead" ("usuario_id", "produto_id") WHERE interno = false;
