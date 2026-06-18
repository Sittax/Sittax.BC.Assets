-- Feature 003 (evolução): produtos vinculados adicionais de um EAD de cliente
-- (M:N). Principal permanece em ead_modulo.produto_id; aqui ficam os extras.
-- Exceção declarada ao §4 do escopo (tema que abrange mais de um produto).

--> statement-breakpoint
CREATE TABLE "ead_modulo_produto" (
	"ead_modulo_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	CONSTRAINT "ead_modulo_produto_pk" PRIMARY KEY("ead_modulo_id","produto_id")
);
--> statement-breakpoint
ALTER TABLE "ead_modulo_produto" ADD CONSTRAINT "ead_modulo_produto_ead_modulo_id_fk" FOREIGN KEY ("ead_modulo_id") REFERENCES "public"."ead_modulo"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ead_modulo_produto" ADD CONSTRAINT "ead_modulo_produto_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- RLS: leitura por qualquer sessão autenticada; escrita só dev/master (gestão de EAD)
GRANT SELECT, INSERT, DELETE ON "ead_modulo_produto" TO central_app;
--> statement-breakpoint
ALTER TABLE "ead_modulo_produto" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ead_modulo_produto" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ead_modulo_produto_select_autenticado"
  ON "ead_modulo_produto" FOR SELECT
  USING (current_setting('app.papel', true) IN ('padrao', 'suporte', 'dev', 'master', 'system'));
--> statement-breakpoint
CREATE POLICY "ead_modulo_produto_insert_dev_mais"
  ON "ead_modulo_produto" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) IN ('dev', 'master', 'system'));
--> statement-breakpoint
CREATE POLICY "ead_modulo_produto_delete_dev_mais"
  ON "ead_modulo_produto" FOR DELETE
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));