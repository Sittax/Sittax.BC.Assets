-- Feature 004: Dashboard, Release Notes e Eventos — 3 tabelas + checks + índice
-- Gerada a partir do schema.ts com ajustes manuais (índice composto DESC)

--> statement-breakpoint
CREATE TABLE "release_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid NOT NULL,
	"data" date NOT NULL,
	"versao" text,
	"conteudo_md" text DEFAULT '' NOT NULL,
	"conteudo_publico" text DEFAULT '' NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"atualizado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "evento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_fim_apos_inicio" CHECK (fim > inicio)
);
--> statement-breakpoint
CREATE TABLE "aula_acesso" (
	"usuario_id" uuid NOT NULL,
	"aula_id" uuid NOT NULL,
	"acessado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aula_acesso_usuario_id_aula_id_pk" PRIMARY KEY("usuario_id","aula_id")
);
--> statement-breakpoint
ALTER TABLE "release_note" ADD CONSTRAINT "release_note_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "release_note" ADD CONSTRAINT "release_note_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "release_note" ADD CONSTRAINT "release_note_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "evento" ADD CONSTRAINT "evento_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aula_acesso" ADD CONSTRAINT "aula_acesso_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aula_acesso" ADD CONSTRAINT "aula_acesso_aula_id_aula_id_fk" FOREIGN KEY ("aula_id") REFERENCES "public"."aula"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Listagem do produto ativo e bloco Novidades (ordenação canônica data DESC)
CREATE INDEX "release_note_produto_data_idx" ON "release_note" ("produto_id", "data" DESC);
