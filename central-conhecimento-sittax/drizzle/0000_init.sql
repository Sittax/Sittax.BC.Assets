CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE TYPE "public"."origem" AS ENUM('sistema', 'central');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('padrao', 'suporte', 'dev', 'master');--> statement-breakpoint
CREATE TYPE "public"."papel_espelhavel" AS ENUM('padrao', 'suporte', 'dev');--> statement-breakpoint
CREATE TABLE "acesso_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"produto_id" uuid,
	"data" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escritorio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "escritorio_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "escritorio_produto" (
	"escritorio_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	CONSTRAINT "escritorio_produto_escritorio_id_produto_id_pk" PRIMARY KEY("escritorio_id","produto_id")
);
--> statement-breakpoint
CREATE TABLE "papel_mapeamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_origem" text NOT NULL,
	"nivel_origem" integer,
	"papel_central" "papel_espelhavel" NOT NULL,
	CONSTRAINT "papel_mapeamento_role_nivel_unique" UNIQUE NULLS NOT DISTINCT("role_origem","nivel_origem")
);
--> statement-breakpoint
CREATE TABLE "produto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	CONSTRAINT "produto_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid,
	"nome" text NOT NULL,
	"sobrenome" text,
	"email" "citext" NOT NULL,
	"papel" "papel" NOT NULL,
	"origem" "origem" NOT NULL,
	"senha_hash" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"id_origem" text,
	"produto_selecionado_id" uuid,
	"ultimo_login_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email"),
	CONSTRAINT "usuario_padrao_tem_escritorio" CHECK ("usuario"."papel" <> 'padrao' OR "usuario"."escritorio_id" IS NOT NULL),
	CONSTRAINT "usuario_central_tem_senha" CHECK ("usuario"."origem" <> 'central' OR "usuario"."senha_hash" IS NOT NULL),
	CONSTRAINT "usuario_sistema_sem_senha" CHECK ("usuario"."origem" <> 'sistema' OR "usuario"."senha_hash" IS NULL),
	CONSTRAINT "usuario_master_origem_central" CHECK ("usuario"."papel" <> 'master' OR "usuario"."origem" = 'central')
);
--> statement-breakpoint
ALTER TABLE "acesso_log" ADD CONSTRAINT "acesso_log_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acesso_log" ADD CONSTRAINT "acesso_log_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escritorio_produto" ADD CONSTRAINT "escritorio_produto_escritorio_id_escritorio_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escritorio_produto" ADD CONSTRAINT "escritorio_produto_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_escritorio_id_escritorio_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorio"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_produto_selecionado_id_produto_id_fk" FOREIGN KEY ("produto_selecionado_id") REFERENCES "public"."produto"("id") ON DELETE no action ON UPDATE no action;