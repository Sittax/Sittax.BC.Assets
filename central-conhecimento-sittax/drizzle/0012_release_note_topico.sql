-- Adiciona referência opcional de uma release note a um tópico da base de conhecimento
ALTER TABLE release_note
  ADD COLUMN topico_id uuid REFERENCES topico(id) ON DELETE SET NULL;

-- Índice para lookup reverso (quais notas referenciam este tópico?)
CREATE INDEX release_note_topico_idx ON release_note(topico_id) WHERE topico_id IS NOT NULL;
