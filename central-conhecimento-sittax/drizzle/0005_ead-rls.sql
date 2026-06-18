-- Feature 003: RLS para as 8 tabelas EAD
-- Decisão R7 do research: own-row em inscricao_ead/progresso_aula;
-- UPDATE/DELETE negados a TODOS em inscricao_ead/progresso_aula (materializa SC-003);
-- alicerce (prova/questao/tentativa/certificado) legível só por dev/master, sem escrita.

-- ─── ead_modulo ───────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON "ead_modulo" TO central_app;

ALTER TABLE "ead_modulo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ead_modulo" FORCE ROW LEVEL SECURITY;

CREATE POLICY "ead_modulo_select_autenticado"
  ON "ead_modulo" FOR SELECT
  USING (current_setting('app.papel', true) IN ('padrao', 'suporte', 'dev', 'master', 'system'));

CREATE POLICY "ead_modulo_write_dev_mais"
  ON "ead_modulo" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

CREATE POLICY "ead_modulo_update_dev_mais"
  ON "ead_modulo" FOR UPDATE
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

CREATE POLICY "ead_modulo_delete_dev_mais"
  ON "ead_modulo" FOR DELETE
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

-- ─── aula ─────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON "aula" TO central_app;

ALTER TABLE "aula" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aula" FORCE ROW LEVEL SECURITY;

CREATE POLICY "aula_select_autenticado"
  ON "aula" FOR SELECT
  USING (current_setting('app.papel', true) IN ('padrao', 'suporte', 'dev', 'master', 'system'));

CREATE POLICY "aula_write_dev_mais"
  ON "aula" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

CREATE POLICY "aula_update_dev_mais"
  ON "aula" FOR UPDATE
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

CREATE POLICY "aula_delete_dev_mais"
  ON "aula" FOR DELETE
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

-- ─── inscricao_ead ────────────────────────────────────────────────────────────
-- SELECT: dono + dev/master (métricas v2)
-- INSERT: só o dono
-- UPDATE/DELETE: negados a todos nesta fase (materializa SC-003 — nenhum caminho conclui)
GRANT SELECT, INSERT ON "inscricao_ead" TO central_app;

ALTER TABLE "inscricao_ead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inscricao_ead" FORCE ROW LEVEL SECURITY;

CREATE POLICY "inscricao_ead_select_proprio_ou_admin"
  ON "inscricao_ead" FOR SELECT
  USING (
    usuario_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) IN ('dev', 'master', 'system')
  );

CREATE POLICY "inscricao_ead_insert_proprio"
  ON "inscricao_ead" FOR INSERT
  WITH CHECK (
    usuario_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = 'system'
  );

-- ─── progresso_aula ───────────────────────────────────────────────────────────
-- SELECT: dono + dev/master; INSERT: só o dono; UPDATE/DELETE: negados
GRANT SELECT, INSERT ON "progresso_aula" TO central_app;

ALTER TABLE "progresso_aula" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "progresso_aula" FORCE ROW LEVEL SECURITY;

CREATE POLICY "progresso_aula_select_proprio_ou_admin"
  ON "progresso_aula" FOR SELECT
  USING (
    usuario_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) IN ('dev', 'master', 'system')
  );

CREATE POLICY "progresso_aula_insert_proprio"
  ON "progresso_aula" FOR INSERT
  WITH CHECK (
    usuario_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = 'system'
  );

-- ─── prova (alicerce — sem fluxo nesta fase) ──────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON "prova" TO central_app;

ALTER TABLE "prova" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prova" FORCE ROW LEVEL SECURITY;

CREATE POLICY "prova_select_dev_mais"
  ON "prova" FOR SELECT
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

CREATE POLICY "prova_write_system"
  ON "prova" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) = 'system');

-- ─── questao (alicerce) ────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON "questao" TO central_app;

ALTER TABLE "questao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questao" FORCE ROW LEVEL SECURITY;

CREATE POLICY "questao_select_dev_mais"
  ON "questao" FOR SELECT
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

CREATE POLICY "questao_write_system"
  ON "questao" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) = 'system');

-- ─── tentativa (alicerce) ─────────────────────────────────────────────────────
GRANT SELECT, INSERT ON "tentativa" TO central_app;

ALTER TABLE "tentativa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tentativa" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tentativa_select_dev_mais"
  ON "tentativa" FOR SELECT
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

-- ─── certificado (alicerce) ───────────────────────────────────────────────────
GRANT SELECT, INSERT ON "certificado" TO central_app;

ALTER TABLE "certificado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "certificado" FORCE ROW LEVEL SECURITY;

CREATE POLICY "certificado_select_dev_mais"
  ON "certificado" FOR SELECT
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));
