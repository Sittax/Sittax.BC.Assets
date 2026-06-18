-- Feature 003 (complemento): capa e descrição por módulo EAD
ALTER TABLE "ead_modulo" ADD COLUMN IF NOT EXISTS "capa_url" text;
ALTER TABLE "ead_modulo" ADD COLUMN IF NOT EXISTS "descricao_md" text NOT NULL DEFAULT '';
