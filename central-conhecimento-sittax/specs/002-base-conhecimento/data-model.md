# Data Model — Base de Conhecimento

Extensão do schema da Feature 001 (`src/lib/db/schema.ts`); migrações
`drizzle/0002_conteudo.sql` (drizzle-kit) e `drizzle/0003_conteudo-rls.sql`
(custom). Convenções da Fase 1: snake_case, uuid `gen_random_uuid()`,
`timestamptz` default `now()`.

## Tabelas

### modulo

| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| produto_id | uuid FK→produto NOT NULL | ON DELETE RESTRICT |
| nome | text NOT NULL | |
| ordem | int NOT NULL | posição no nível |
| criado_em | timestamptz | |

UNIQUE (`produto_id`, `nome`). Exclusão de módulo com tópicos: impedida (FK
RESTRICT em `topico.modulo_id` + checagem na action com orientação).

### topico

| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| modulo_id | uuid FK→modulo NOT NULL | ON DELETE RESTRICT |
| produto_id | uuid FK→produto NOT NULL | denormalizado = produto do módulo (R7); mantido pelas actions |
| parent_id | uuid FK→topico NULL | subtópico; ON DELETE RESTRICT; sem ciclos; profundidade máx. 5 (R8, validação na action) |
| titulo | text NOT NULL | |
| slug | text NOT NULL | gerado do título (R7) |
| conteudo_md | text NOT NULL default '' | fonte da verdade (markdown) |
| conteudo_publico | text NOT NULL default '' | DERIVADA: `sanitizarMarkdown(conteudo_md,'padrao')` — recalculada em todo save/import pela função única (R1/R3) |
| ordem | int NOT NULL | posição entre irmãos |
| atualizado_por | uuid FK→usuario NULL | |
| atualizado_em | timestamptz | |
| criado_em | timestamptz | |

UNIQUE (`produto_id`, `slug`). Colunas geradas (no SQL da migração):
`tsv_publico tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', titulo || ' ' || conteudo_publico)) STORED` e
`tsv_completo tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', titulo || ' ' || conteudo_md)) STORED`,
ambas com índice GIN (busca R3).

### arquivo

| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| nome_original | text NOT NULL | |
| mime | text NOT NULL | image/* no v1 |
| tamanho | int NOT NULL | bytes |
| chave_storage | text UNIQUE NOT NULL | chave do objeto no MinIO |
| criado_por | uuid FK→usuario NOT NULL | |
| criado_em | timestamptz | |

Sem flag de papel no v1 (débito FR-021; v2 adiciona `interna boolean` + checagem
no serve).

## Relacionamentos

```
produto 1──N modulo 1──N topico (parent_id auto-referência, ≤5 níveis)
produto 1──N topico            (denormalizado p/ slug único, busca e RLS)
usuario 1──N arquivo / topico.atualizado_por
```

## Policies RLS (migração `drizzle/0003_conteudo-rls.sql`)

Mesmo contexto da Fase 1 (`app.papel`/`app.user_id` via withUser/withSystem);
`ENABLE/FORCE ROW LEVEL SECURITY`; GRANTs mínimos ao `central_app`.

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| modulo | qualquer papel autenticado | suporte, dev, master, system (import CLI) |
| topico | qualquer papel autenticado | suporte, dev, master, system |
| arquivo | qualquer papel autenticado (débito v1 — serve só exige sessão) | INSERT: suporte, dev, master, system; sem UPDATE/DELETE no v1 |

Limite documentado (R6): RLS é por linha; a proteção do `conteudo_md` para papel
padrão é a fronteira da API (função única) + disciplina de leitura
(`conteudo_publico` nos caminhos de padrão — defeito bloqueante de review).

## Estados e regras de transição

- **topico.conteudo_md**: substituído a cada save (sem versionamento no v1);
  `conteudo_publico` SEMPRE regenerado na mesma transação pela função única.
- **Save de suporte**: rejeitado se o multiconjunto de blocos `nota-tecnica`
  mudar (R2); dev/master livres.
- **Árvore**: mover/criar valida profundidade ≤5 e anti-ciclo (R8); excluir só
  tópico sem filhos / módulo vazio.
- **arquivo**: imutável após upload no v1.

## Seeds de desenvolvimento (extensão de `scripts/seed.ts`)

- 2 módulos e ~6 tópicos (com subtópicos até nível 3) no produto 1, incluindo um
  tópico com `:::nota-interna`, um com `:::nota-tecnica` e um com `:::video`;
  1 módulo/2 tópicos no produto 2 (para o teste de isolamento da busca).
