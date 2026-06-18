CREATE TABLE "arquivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome_original" text NOT NULL,
	"mime" text NOT NULL,
	"tamanho" integer NOT NULL,
	"chave_storage" text NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arquivo_chave_storage_unique" UNIQUE("chave_storage")
);
--> statement-breakpoint
CREATE TABLE "modulo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modulo_produto_nome_unique" UNIQUE("produto_id","nome")
);
--> statement-breakpoint
CREATE TABLE "topico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modulo_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	"parent_id" uuid,
	"titulo" text NOT NULL,
	"slug" text NOT NULL,
	"conteudo_md" text DEFAULT '' NOT NULL,
	"conteudo_publico" text DEFAULT '' NOT NULL,
	"ordem" integer NOT NULL,
	"atualizado_por" uuid,
	"atualizado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topico_produto_slug_unique" UNIQUE("produto_id","slug")
);
--> statement-breakpoint
ALTER TABLE "arquivo" ADD CONSTRAINT "arquivo_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulo" ADD CONSTRAINT "modulo_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topico" ADD CONSTRAINT "topico_modulo_id_modulo_id_fk" FOREIGN KEY ("modulo_id") REFERENCES "public"."modulo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topico" ADD CONSTRAINT "topico_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topico" ADD CONSTRAINT "topico_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- self-referência de subtópico (parent_id) com ON DELETE RESTRICT
ALTER TABLE "topico" ADD CONSTRAINT "topico_parent_id_topico_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topico"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- colunas tsvector geradas para busca FTS (research R3)
ALTER TABLE "topico"
  ADD COLUMN "tsv_publico" tsvector
    GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(titulo, '') || ' ' || coalesce(conteudo_publico, ''))) STORED,
  ADD COLUMN "tsv_completo" tsvector
    GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(titulo, '') || ' ' || coalesce(conteudo_md, ''))) STORED;
--> statement-breakpoint
-- índices GIN para FTS eficiente
CREATE INDEX "topico_tsv_publico_gin_idx" ON "topico" USING GIN ("tsv_publico");
CREATE INDEX "topico_tsv_completo_gin_idx" ON "topico" USING GIN ("tsv_completo");