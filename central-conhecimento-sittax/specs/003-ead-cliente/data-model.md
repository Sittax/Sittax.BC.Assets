# Data Model — Feature 003: EAD do Cliente

Migrações: `drizzle/0004_ead.sql` (tabelas + checks) e `drizzle/0005_ead-rls.sql`
(policies — ver research R7). Convenções das fases anteriores: UUID `gen_random_uuid()`,
timestamps `with time zone`, nomes em pt-BR snake_case.

## Tabelas operacionais nesta fase

### `ead_modulo`

Agrupador de aulas. Já nasce com as colunas do EAD interno (escopo §10) — nesta
fase só se usa `interno = false`.

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `produto_id` | uuid FK→`produto` | nullable; `ON DELETE RESTRICT` |
| `interno` | boolean | NOT NULL, default `false` |
| `tema_interno` | text | nullable (uso na fase do EAD interno) |
| `nivel` | integer | nullable (uso na fase do EAD interno) |
| `nome` | text | NOT NULL |
| `ordem` | integer | NOT NULL |
| `criado_em` | timestamptz | NOT NULL, default now |

Checks (escopo §10):
- `ead_modulo_cliente_tem_produto`: `interno = true OR produto_id IS NOT NULL`
- `ead_modulo_interno_tem_tema`: `interno = false OR tema_interno IS NOT NULL`

Unique: `(produto_id, nome)` (nomes de módulo únicos dentro do produto).

### `aula`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `ead_modulo_id` | uuid FK→`ead_modulo` | NOT NULL, `ON DELETE RESTRICT` (módulo só é excluído vazio, padrão da 002) |
| `titulo` | text | NOT NULL |
| `youtube_id` | varchar(11) | NOT NULL; formato validado na aplicação (R4) |
| `descricao_md` | text | NOT NULL, default `''` (renderizada via `sanitizarMarkdown` — R6) |
| `ordem` | integer | NOT NULL |
| `criado_em` | timestamptz | NOT NULL, default now |

### `inscricao_ead`

Vínculo usuário↔EAD criado por "Iniciar EAD". Campos de conclusão já existem
(alicerce — FR-013), mas **nenhum caminho desta fase os preenche** (policy nega
UPDATE — R7).

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `usuario_id` | uuid FK→`usuario` | NOT NULL |
| `produto_id` | uuid FK→`produto` | nullable (NULL só no EAD interno futuro) |
| `interno` | boolean | NOT NULL, default `false` |
| `status` | enum `inscricao_status` (`em_andamento`, `concluido`) | NOT NULL, default `em_andamento` |
| `data_inicio` | timestamptz | NOT NULL, default now |
| `data_conclusao` | timestamptz | nullable |

Checks:
- `inscricao_cliente_tem_produto`: `interno = true OR produto_id IS NOT NULL`
- `inscricao_concluida_tem_data`: `status <> 'concluido' OR data_conclusao IS NOT NULL`

Unique parcial (R5): `UNIQUE (usuario_id, produto_id) WHERE interno = false`.

**Transições de estado**: nesta fase, nenhuma — toda inscrição nasce e permanece
`em_andamento`. A transição única `em_andamento → concluido` (irreversível) é
ligada na v2 do módulo (research R9).

### `progresso_aula`

Fato "aula vista" (idempotente — FR-009).

| Coluna | Tipo | Regras |
|---|---|---|
| `usuario_id` | uuid FK→`usuario` | NOT NULL |
| `aula_id` | uuid FK→`aula` | NOT NULL, `ON DELETE CASCADE` (aula removida deixa de contar — R3) |
| `vista_em` | timestamptz | NOT NULL, default now |

PK composta `(usuario_id, aula_id)` — a própria PK dá o `ON CONFLICT DO NOTHING` (R2).

## Tabelas de alicerce (sem fluxo nesta fase — FR-012/FR-014)

### `prova`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `produto_id` | uuid FK→`produto` | nullable; **UNIQUE** (no máx. 1 prova por produto — FR-012) |
| `ead_modulo_id` | uuid FK→`ead_modulo` | nullable (eixo do EAD interno futuro) |
| `nota_corte` | integer | NOT NULL; percentual 0–100 (`CHECK BETWEEN 0 AND 100`) |

Check (escopo §10, sem FK polimórfica): `num_nonnulls(produto_id, ead_modulo_id) = 1`.

### `questao`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `prova_id` | uuid FK→`prova` | NOT NULL, `ON DELETE CASCADE` |
| `enunciado` | text | NOT NULL |
| `alternativas` | jsonb | NOT NULL — array de strings (≥2) |
| `gabarito` | integer | NOT NULL — índice da alternativa correta |
| `ordem` | integer | NOT NULL |

### `tentativa`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `usuario_id` | uuid FK→`usuario` | NOT NULL |
| `prova_id` | uuid FK→`prova` | NOT NULL |
| `nota` | integer | NOT NULL (0–100) |
| `aprovado` | boolean | NOT NULL |
| `data` | timestamptz | NOT NULL, default now |

### `certificado`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `usuario_id` | uuid FK→`usuario` | NOT NULL |
| `inscricao_id` | uuid FK→`inscricao_ead` | NOT NULL, UNIQUE (1 certificado por conclusão) |
| `codigo_validacao` | text | NOT NULL, UNIQUE |
| `data` | timestamptz | NOT NULL |

> `referencia` do escopo §10 materializada como `inscricao_id`: a inscrição já
> carrega usuário+produto+interno, e a unicidade 1:1 com a conclusão sai de graça.

## Relacionamentos (resumo)

```
produto 1—n ead_modulo (interno=false) 1—n aula
usuario 1—n inscricao_ead n—1 produto
usuario 1—n progresso_aula n—1 aula
produto 1—0..1 prova 1—n questao          (alicerce)
usuario 1—n tentativa n—1 prova           (alicerce)
inscricao_ead 1—0..1 certificado          (alicerce)
```

## Derivados (nunca armazenados)

- **% de progresso** (FR-010): `COUNT(progresso_aula ⋈ aula do produto) ÷
  COUNT(aula do produto)` — consulta única em `src/lib/ead/progresso.ts` (R3).
- **Positivado** (v2): view agregada `conclusões × escritorio_produto` (R9).
