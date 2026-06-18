-- Destaques manuais da base de conhecimento por produto (até 4)
CREATE TABLE destaque_base (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id  uuid        NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
  topico_id   uuid        NOT NULL REFERENCES topico(id) ON DELETE CASCADE,
  ordem       integer     NOT NULL DEFAULT 0,
  UNIQUE(produto_id, topico_id)
);

CREATE INDEX destaque_base_produto_idx ON destaque_base(produto_id);

-- dev e master podem ler e escrever; demais papéis não têm acesso
ALTER TABLE destaque_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY destaque_base_dev_master ON destaque_base
  USING (
    current_setting('app.papel', TRUE) IN ('dev', 'master')
  )
  WITH CHECK (
    current_setting('app.papel', TRUE) IN ('dev', 'master')
  );
