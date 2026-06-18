-- Feature: Materiais de aula + Anotações de aula
-- Materiais: dev/master escrevem; todos os autenticados leem.
-- Anotações: RLS own-row — cada usuário vê e escreve só as próprias.

--> statement-breakpoint
CREATE TABLE "aula_material" (
  "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "aula_id"      uuid        NOT NULL REFERENCES "public"."aula"("id") ON DELETE cascade,
  "nome"         text        NOT NULL,
  "url"          text        NOT NULL,
  "mime"         text        NOT NULL DEFAULT '',
  "tamanho_bytes" integer,
  "ordem"        integer     NOT NULL DEFAULT 0,
  "criado_em"    timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aula_anotacao" (
  "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "aula_id"      uuid        NOT NULL REFERENCES "public"."aula"("id") ON DELETE cascade,
  "usuario_id"   uuid        NOT NULL REFERENCES "public"."usuario"("id") ON DELETE cascade,
  "conteudo_md"  text        NOT NULL,
  "criado_em"    timestamptz NOT NULL DEFAULT now(),
  "atualizado_em" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- RLS: aula_material — leitura por todos autenticados, escrita só dev/master
GRANT SELECT, INSERT, UPDATE, DELETE ON "aula_material" TO central_app;
--> statement-breakpoint
ALTER TABLE "aula_material" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "aula_material" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "aula_material_select_autenticado"
  ON "aula_material" FOR SELECT
  USING (current_setting('app.papel', true) IN ('padrao', 'suporte', 'dev', 'master', 'system'));
--> statement-breakpoint
CREATE POLICY "aula_material_write_dev_mais"
  ON "aula_material" FOR ALL
  USING  (current_setting('app.papel', true) IN ('dev', 'master', 'system'))
  WITH CHECK (current_setting('app.papel', true) IN ('dev', 'master', 'system'));
--> statement-breakpoint
-- RLS: aula_anotacao — own-row
GRANT SELECT, INSERT, UPDATE, DELETE ON "aula_anotacao" TO central_app;
--> statement-breakpoint
ALTER TABLE "aula_anotacao" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "aula_anotacao" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "aula_anotacao_own"
  ON "aula_anotacao" FOR ALL
  USING  (usuario_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (usuario_id = current_setting('app.user_id', true)::uuid);
