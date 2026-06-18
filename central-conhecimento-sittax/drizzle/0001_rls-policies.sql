-- Migração custom: role da aplicação + Row-Level Security (Constituição II).
-- Contexto por transação via withUser/withSystem (src/lib/db/rls.ts):
--   app.user_id  — uuid do usuário da sessão
--   app.papel    — 'padrao' | 'suporte' | 'dev' | 'master' | 'system'
-- O papel 'system' não existe no enum "papel": é o contexto restrito de
-- login/espelhamento/seed (research R5). Sem contexto setado → nenhuma linha.
-- Extensão documentada ao data-model: além do espelhamento, o 'system' tem
-- INSERT/UPDATE nas tabelas de catálogo/mapeamento porque o seed (T013) roda
-- via withSystem.

-- Funções de leitura do contexto (fail-closed: sem contexto → NULL)
CREATE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS
  $fn$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $fn$;--> statement-breakpoint

CREATE FUNCTION app_papel() RETURNS text
  LANGUAGE sql STABLE AS
  $fn$ SELECT NULLIF(current_setting('app.papel', true), '') $fn$;--> statement-breakpoint

-- Role da aplicação: não-owner, sem BYPASSRLS. A senha NUNCA entra em
-- migração — é definida fora do código (scripts/migrate.ts a partir do
-- DATABASE_URL do ambiente).
DO $do$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'central_app') THEN
    CREATE ROLE central_app LOGIN NOBYPASSRLS;
  END IF;
END $do$;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO central_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON escritorio TO central_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON usuario TO central_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON produto TO central_app;--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON escritorio_produto TO central_app;--> statement-breakpoint
-- acesso_log é append-only: nem GRANT de UPDATE/DELETE existe
GRANT SELECT, INSERT ON acesso_log TO central_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON papel_mapeamento TO central_app;--> statement-breakpoint

ALTER TABLE escritorio ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE escritorio FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE usuario FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE produto ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE produto FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE escritorio_produto ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE escritorio_produto FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE acesso_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE acesso_log FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE papel_mapeamento ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE papel_mapeamento FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- ============================== escritorio ==============================
-- SELECT: qualquer papel autenticado (dado não sensível na fase)
CREATE POLICY escritorio_sel ON escritorio FOR SELECT TO central_app
  USING (app_papel() IN ('padrao', 'suporte', 'dev', 'master', 'system'));--> statement-breakpoint
-- Escrita: master (CRUD pela gerência); system (espelhamento cria/atualiza)
CREATE POLICY escritorio_ins ON escritorio FOR INSERT TO central_app
  WITH CHECK (app_papel() IN ('master', 'system'));--> statement-breakpoint
CREATE POLICY escritorio_upd ON escritorio FOR UPDATE TO central_app
  USING (app_papel() IN ('master', 'system'))
  WITH CHECK (app_papel() IN ('master', 'system'));--> statement-breakpoint
-- DELETE só master; integridade com usuários garantida pelo FK RESTRICT (FR-026)
CREATE POLICY escritorio_del ON escritorio FOR DELETE TO central_app
  USING (app_papel() = 'master');--> statement-breakpoint

-- ================================ usuario ===============================
-- SELECT: o próprio registro; master e system veem todos
CREATE POLICY usuario_sel ON usuario FOR SELECT TO central_app
  USING (
    app_papel() IN ('master', 'system')
    OR id = app_user_id()
  );--> statement-breakpoint
-- INSERT: system (espelhamento); master apenas usuários só central
CREATE POLICY usuario_ins ON usuario FOR INSERT TO central_app
  WITH CHECK (
    app_papel() = 'system'
    OR (app_papel() = 'master' AND origem = 'central')
  );--> statement-breakpoint
-- UPDATE: system (ressincronização); master apenas origem central (FR-025 —
-- usuário espelhado é imutável localmente); o próprio usuário pode atualizar
-- a própria linha SEM trocar o próprio papel (a aplicação expõe somente
-- produto_selecionado_id — R7)
CREATE POLICY usuario_upd ON usuario FOR UPDATE TO central_app
  USING (
    app_papel() = 'system'
    OR (app_papel() = 'master' AND origem = 'central')
    OR id = app_user_id()
  )
  WITH CHECK (
    app_papel() = 'system'
    OR (app_papel() = 'master' AND origem = 'central')
    OR (id = app_user_id() AND papel::text = app_papel())
  );--> statement-breakpoint
-- (sem policy de DELETE: usuário não é excluído nesta fase, só desativado)

-- ================================ produto ===============================
CREATE POLICY produto_sel ON produto FOR SELECT TO central_app
  USING (app_papel() IN ('padrao', 'suporte', 'dev', 'master', 'system'));--> statement-breakpoint
-- Catálogo entra por seed/bootstrap (system); sem CRUD de produto nesta fase
-- (débito registrado no roadmap — docs/escopo §9)
CREATE POLICY produto_ins ON produto FOR INSERT TO central_app
  WITH CHECK (app_papel() = 'system');--> statement-breakpoint
CREATE POLICY produto_upd ON produto FOR UPDATE TO central_app
  USING (app_papel() = 'system')
  WITH CHECK (app_papel() = 'system');--> statement-breakpoint

-- =========================== escritorio_produto =========================
CREATE POLICY escritorio_produto_sel ON escritorio_produto FOR SELECT TO central_app
  USING (app_papel() IN ('padrao', 'suporte', 'dev', 'master', 'system'));--> statement-breakpoint
CREATE POLICY escritorio_produto_ins ON escritorio_produto FOR INSERT TO central_app
  WITH CHECK (app_papel() IN ('master', 'system'));--> statement-breakpoint
CREATE POLICY escritorio_produto_del ON escritorio_produto FOR DELETE TO central_app
  USING (app_papel() = 'master');--> statement-breakpoint

-- =============================== acesso_log =============================
-- Append-only: INSERT pelo system (evento de login) ou pelo próprio usuário
-- autenticado (troca de produto); leitura só do master; sem UPDATE/DELETE
CREATE POLICY acesso_log_sel ON acesso_log FOR SELECT TO central_app
  USING (app_papel() = 'master');--> statement-breakpoint
CREATE POLICY acesso_log_ins ON acesso_log FOR INSERT TO central_app
  WITH CHECK (
    app_papel() = 'system'
    OR (
      app_papel() IN ('padrao', 'suporte', 'dev', 'master')
      AND usuario_id = app_user_id()
    )
  );--> statement-breakpoint

-- ============================ papel_mapeamento ==========================
-- SELECT: master (gerência) e system (tradução de papel no login)
CREATE POLICY papel_mapeamento_sel ON papel_mapeamento FOR SELECT TO central_app
  USING (app_papel() IN ('master', 'system'));--> statement-breakpoint
CREATE POLICY papel_mapeamento_ins ON papel_mapeamento FOR INSERT TO central_app
  WITH CHECK (app_papel() IN ('master', 'system'));--> statement-breakpoint
CREATE POLICY papel_mapeamento_upd ON papel_mapeamento FOR UPDATE TO central_app
  USING (app_papel() = 'master')
  WITH CHECK (app_papel() = 'master');--> statement-breakpoint
CREATE POLICY papel_mapeamento_del ON papel_mapeamento FOR DELETE TO central_app
  USING (app_papel() = 'master');
