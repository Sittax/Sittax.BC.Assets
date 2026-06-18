-- Corrige a policy: todos os papéis autenticados podem ler;
-- apenas dev/master/system podem escrever.
DROP POLICY destaque_base_dev_master ON destaque_base;

CREATE POLICY destaque_base_leitura ON destaque_base
  FOR SELECT
  USING (
    current_setting('app.papel', TRUE) IN ('padrao', 'suporte', 'dev', 'master', 'system')
  );

CREATE POLICY destaque_base_escrita ON destaque_base
  FOR ALL
  USING (current_setting('app.papel', TRUE) IN ('dev', 'master', 'system'))
  WITH CHECK (current_setting('app.papel', TRUE) IN ('dev', 'master', 'system'));
