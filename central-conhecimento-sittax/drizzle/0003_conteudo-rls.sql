-- Feature 002: RLS para modulo, topico e arquivo
-- GRANTs mínimos ao central_app + ENABLE/FORCE ROW LEVEL SECURITY + policies

-- ─── modulo ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON "modulo" TO central_app;

ALTER TABLE "modulo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "modulo" FORCE ROW LEVEL SECURITY;

-- qualquer papel autenticado pode ler
CREATE POLICY "modulo_select_autenticado"
  ON "modulo" FOR SELECT
  USING (current_setting('app.papel', true) IN ('padrao', 'suporte', 'dev', 'master', 'system'));

-- escrita: suporte, dev, master, system (import CLI)
CREATE POLICY "modulo_write_suporte_mais"
  ON "modulo" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));

CREATE POLICY "modulo_update_suporte_mais"
  ON "modulo" FOR UPDATE
  USING (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));

CREATE POLICY "modulo_delete_suporte_mais"
  ON "modulo" FOR DELETE
  USING (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));

-- ─── topico ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON "topico" TO central_app;

ALTER TABLE "topico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "topico" FORCE ROW LEVEL SECURITY;

CREATE POLICY "topico_select_autenticado"
  ON "topico" FOR SELECT
  USING (current_setting('app.papel', true) IN ('padrao', 'suporte', 'dev', 'master', 'system'));

CREATE POLICY "topico_write_suporte_mais"
  ON "topico" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));

CREATE POLICY "topico_update_suporte_mais"
  ON "topico" FOR UPDATE
  USING (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));

CREATE POLICY "topico_delete_suporte_mais"
  ON "topico" FOR DELETE
  USING (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));

-- ─── arquivo ─────────────────────────────────────────────────────────────────
-- SELECT: qualquer autenticado (débito v1 — o serve exige só sessão — FR-021)
-- INSERT: suporte, dev, master, system
-- sem UPDATE/DELETE no v1 (arquivo imutável após upload)
GRANT SELECT, INSERT ON "arquivo" TO central_app;

ALTER TABLE "arquivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "arquivo" FORCE ROW LEVEL SECURITY;

CREATE POLICY "arquivo_select_autenticado"
  ON "arquivo" FOR SELECT
  USING (current_setting('app.papel', true) IN ('padrao', 'suporte', 'dev', 'master', 'system'));

CREATE POLICY "arquivo_insert_suporte_mais"
  ON "arquivo" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));
