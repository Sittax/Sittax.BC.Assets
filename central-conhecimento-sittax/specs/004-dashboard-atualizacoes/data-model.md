# Data Model — Feature 004: Dashboard, Release Notes e Eventos

Migrações: `drizzle/0008_dashboard.sql` (tabelas + checks) e
`drizzle/0009_dashboard-rls.sql` (policies). Schema Drizzle em `src/lib/db/schema.ts`
(seção "Feature 004"). Convenções das fases anteriores: PK uuid `gen_random_uuid()`,
timestamps `withTimezone`, nomes em pt-BR snake_case.

## Tabelas novas

### `release_note`

Comunicação de mudança de um produto (spec FR-009/FR-010; escopo §6.5).

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `produto_id` | uuid NOT NULL | FK `produto` ON DELETE RESTRICT — nota pertence a exatamente 1 produto |
| `data` | date NOT NULL | data da nota (dev pode publicar retroativa; default hoje na UI) |
| `versao` | text NULL | versão opcional (FR-010) |
| `conteudo_md` | text NOT NULL default `''` | fonte markdown; pode conter `:::nota-interna` (FR-011) |
| `conteudo_publico` | text NOT NULL default `''` | DERIVADA: `sanitizarMarkdown(conteudo_md, 'padrao')`, recalculada em todo save (R2) |
| `criado_por` | uuid NOT NULL | FK `usuario` |
| `criado_em` | timestamptz NOT NULL | default now |
| `atualizado_por` | uuid NULL | FK `usuario` |
| `atualizado_em` | timestamptz NULL | |

Índice: `(produto_id, data DESC)` — listagem do produto ativo e bloco Novidades.
Ordenação canônica de leitura: `data DESC, criado_em DESC` (R8).

**RLS** (`0009`): SELECT para qualquer sessão autenticada (padrão/suporte/dev/
master/system) — o conteúdo interno é protegido pela escolha de coluna, não pela
linha; INSERT/UPDATE só `dev/master/system`; **DELETE sem policy** (operação não
existe — FR-012/R5).

### `evento`

Registro informativo geral, sem produto (spec FR-013; exceção declarada ao
princípio V).

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `titulo` | text NOT NULL | |
| `descricao` | text NOT NULL default `''` | texto simples (sem markdown nesta fase) |
| `inicio` | timestamptz NOT NULL | data + horário de início |
| `fim` | timestamptz NOT NULL | data + horário de fim |
| `criado_por` | uuid NOT NULL | FK `usuario` |
| `criado_em` | timestamptz NOT NULL | default now |

Checks: `evento_fim_apos_inicio` → `fim > inicio` (FR-016). Pontualidade (mesmo dia)
validada no Zod da action, não no banco (R3).

**RLS** (`0009`): SELECT — suporte/dev/master/system veem tudo (histórico da
gestão); padrão só `fim >= now()` (clarify 2026-06-11, R4). INSERT/UPDATE/DELETE:
`suporte/dev/master/system` (FR-014).

### `aula_acesso`

Fato "usuário abriu a página da aula" — base da retomada (R1). Distinto de
`progresso_aula` (vista = evento `ended` do player).

| Coluna | Tipo | Regras |
|---|---|---|
| `usuario_id` | uuid NOT NULL | FK `usuario`; PK composta com `aula_id` |
| `aula_id` | uuid NOT NULL | FK `aula` ON DELETE CASCADE (aula removida → registro some → fallback) |
| `acessado_em` | timestamptz NOT NULL | default now; upsert `ON CONFLICT DO UPDATE SET acessado_em = now()` |

**RLS** (`0009`): own-row — SELECT/INSERT/UPDATE apenas onde
`usuario_id = app.user_id` (+ `system`); sem DELETE (cascade via `aula` não passa
por policy). UPDATE own-row é necessário para o upsert — não conflita com nenhuma
garantia da 003 (`inscricao_ead` e `progresso_aula` permanecem intocadas).

## Tabelas existentes — uso (sem alteração de schema)

- `inscricao_ead` — LEITURA: inscrições `em_andamento` (interno = false) do usuário,
  juntadas a `ead_modulo.produto_id = produto ativo` para o bloco Continue. Nenhum
  UPDATE (policy da 003 preservada — Constituição IV).
- `ead_modulo` / `aula` — LEITURA: nome/capa do módulo, ordem das aulas (fallback de
  retomada = primeira aula por `ordem`).
- `progresso_aula` — LEITURA: % vivo via `_percentualNaTx` reusado da 003.
- `produto` / `usuario.produto_selecionado_id` — produto ativo da sessão (grudento,
  Fase 1).

## Derivações (nunca armazenadas)

- **Retomada por módulo** = aula com `max(acessado_em)` em `aula_acesso` restrita às
  aulas do módulo; fallback primeira aula na ordem (R1).
- **% de progresso** = `_percentualNaTx` (003) — aulas vistas ÷ total atual.
- **"Próximo" evento** = `fim >= now()` ordenado por `inicio ASC` — derivado do
  relógio, jamais flag (R4; princípio I).

## Diagrama (novas relações)

```text
produto 1───n release_note (produto_id NOT NULL)
usuario 1───n release_note (criado_por / atualizado_por)
usuario 1───n evento (criado_por)            [evento NÃO referencia produto]
usuario 1───n aula_acesso n───1 aula (CASCADE)
```
