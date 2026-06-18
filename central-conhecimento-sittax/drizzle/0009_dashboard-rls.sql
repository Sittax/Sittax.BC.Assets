-- Feature 004: RLS de release_note, evento e aula_acesso
-- R4: visibilidade temporal de evento decidida AQUI (padrão só vê fim >= now()).
-- R5: release_note SEM policy/GRANT de DELETE (operação não existe — FR-012);
--     aula_acesso own-row com UPDATE próprio (upsert), sem DELETE (cascade via aula).

-- ─── release_note ─────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON "release_note" TO central_app;

ALTER TABLE "release_note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "release_note" FORCE ROW LEVEL SECURITY;

-- O conteúdo interno é protegido pela ESCOLHA DE COLUNA (conteudo_publico para
-- padrão), não pela linha — a linha é legível por qualquer sessão autenticada.
CREATE POLICY "release_note_select_autenticado"
  ON "release_note" FOR SELECT
  USING (current_setting('app.papel', true) IN ('padrao', 'suporte', 'dev', 'master', 'system'));

CREATE POLICY "release_note_insert_dev_mais"
  ON "release_note" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

CREATE POLICY "release_note_update_dev_mais"
  ON "release_note" FOR UPDATE
  USING (current_setting('app.papel', true) IN ('dev', 'master', 'system'));

-- ─── evento ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON "evento" TO central_app;

ALTER TABLE "evento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evento" FORCE ROW LEVEL SECURITY;

-- Clarify 2026-06-11: padrão só vê eventos futuros/em andamento; suporte+ vê
-- tudo (histórico da tela de gestão). Regra num lugar só (Constituição I/II).
CREATE POLICY "evento_select_por_papel"
  ON "evento" FOR SELECT
  USING (
    current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system')
    OR (current_setting('app.papel', true) = 'padrao' AND fim >= now())
  );

CREATE POLICY "evento_insert_suporte_mais"
  ON "evento" FOR INSERT
  WITH CHECK (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));

CREATE POLICY "evento_update_suporte_mais"
  ON "evento" FOR UPDATE
  USING (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));

CREATE POLICY "evento_delete_suporte_mais"
  ON "evento" FOR DELETE
  USING (current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system'));

-- ─── aula_acesso ──────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON "aula_acesso" TO central_app;

ALTER TABLE "aula_acesso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aula_acesso" FORCE ROW LEVEL SECURITY;

CREATE POLICY "aula_acesso_select_proprio"
  ON "aula_acesso" FOR SELECT
  USING (
    usuario_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = 'system'
  );

CREATE POLICY "aula_acesso_insert_proprio"
  ON "aula_acesso" FOR INSERT
  WITH CHECK (
    usuario_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = 'system'
  );

-- UPDATE own-row é necessário para o upsert de acessado_em (R1)
CREATE POLICY "aula_acesso_update_proprio"
  ON "aula_acesso" FOR UPDATE
  USING (
    usuario_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = 'system'
  );
