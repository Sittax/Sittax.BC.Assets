-- Inscrição passa a ser por módulo EAD (não por produto inteiro)
ALTER TABLE "inscricao_ead" ADD COLUMN IF NOT EXISTS "ead_modulo_id" uuid REFERENCES "ead_modulo"("id");

-- Remove índice único antigo (por produto)
DROP INDEX IF EXISTS "inscricao_ead_usuario_produto_uq";

-- Novo índice único por módulo
CREATE UNIQUE INDEX IF NOT EXISTS "inscricao_ead_usuario_modulo_uq"
  ON "inscricao_ead" ("usuario_id", "ead_modulo_id") WHERE interno = false;
