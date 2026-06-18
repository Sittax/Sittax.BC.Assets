# Data Model — Fundação: Identidade, Sessão e Casca de Navegação

Schema Drizzle em `src/lib/db/schema.ts`; migrações em `drizzle/`. Policies RLS em
migração SQL custom. Alinhado ao §10 do escopo, estendido pelas decisões do clarify
(CNPJ, mapeamento, usuário sem escritório). Convenção: snake_case no banco, ids UUID
(`gen_random_uuid()`), timestamps `timestamptz` com default `now()`.

## Tabelas

### escritorio

| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| cnpj | varchar(14) UNIQUE NOT NULL | 14 dígitos normalizados (R9); chave de espelhamento |
| nome | text NOT NULL | Se origem mandar vazio: CNPJ formatado (R9) |
| criado_em | timestamptz | |

### usuario

| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| escritorio_id | uuid FK→escritorio NULL | CHECK: `papel = 'padrao'` → NOT NULL (FR-012) |
| nome | text NOT NULL | |
| sobrenome | text NULL | vem da origem; opcional p/ só central |
| email | citext UNIQUE NOT NULL | chave de identidade (R1); normalizado lowercase |
| papel | enum `papel` NOT NULL | `padrao \| suporte \| dev \| master` |
| origem | enum `origem` NOT NULL | `sistema` (espelhado) \| `central` (local) |
| senha_hash | text NULL | só quando `origem = 'central'` (CHECK) |
| ativo | boolean NOT NULL default true | desativação só p/ origem central (FR-024) |
| id_origem | text NULL | informativo, do primeiro sistema que validou (R1) |
| produto_selecionado_id | uuid FK→produto NULL | seletor grudento (R7) |
| ultimo_login_em | timestamptz NULL | |
| criado_em | timestamptz | |

CHECKs adicionais: `origem = 'central'` → `senha_hash NOT NULL`; `origem = 'sistema'` →
`senha_hash IS NULL`. Papel `master` só com `origem = 'central'` (Master é sempre local).

### produto

| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| nome | text UNIQUE NOT NULL | catálogo dos 6, via seed |
| ordem | int NOT NULL | ordem no seletor (CHK017) |

### escritorio_produto

| Coluna | Tipo | Regras |
|---|---|---|
| escritorio_id | uuid FK→escritorio | PK composta |
| produto_id | uuid FK→produto | PK composta |

Vínculo informativo (FR-013) — nenhuma regra de bloqueio lê esta tabela no v1.

### acesso_log

| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| usuario_id | uuid FK→usuario NOT NULL | |
| produto_id | uuid FK→produto NULL | NULL no evento de login (R10) |
| data | timestamptz NOT NULL default now() | |

Append-only (sem UPDATE/DELETE nas policies). Sem retenção nesta fase (R10).

### papel_mapeamento

| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| role_origem | text NOT NULL | ex.: `ADMINISTRADOR` |
| nivel_origem | int NULL | NULL = curinga de nível (R8) |
| papel_central | enum `papel_espelhavel` NOT NULL | `padrao \| suporte \| dev` (nunca master) |

UNIQUE (`role_origem`, `nivel_origem`). Resolução: exato → curinga → fallback `padrao`.

## Relacionamentos

```
escritorio 1──N usuario            (usuario.escritorio_id, NULL p/ suporte+ interno)
escritorio N──N produto            (escritorio_produto)
usuario    N──1 produto            (produto_selecionado_id)
usuario    1──N acesso_log
```

## Policies RLS (migração `drizzle/NNNN_rls-policies.sql`)

Contexto: `app.user_id` e `app.papel` via `withUser`; papel `system` via `withSystem`
(login/espelhamento/seed — R5). `FORCE ROW LEVEL SECURITY` em todas; app conecta como
role `central_app` (não-owner, sem BYPASSRLS). Sem contexto setado → nenhuma linha.

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| escritorio | qualquer papel autenticado (dado não sensível na fase) | `master` (CRUD); `system` (espelhamento cria/atualiza) |
| usuario | próprio registro; `master` vê todos | `master` (só central: CHECK origem='central' na policy); `system` (espelhamento); UPDATE de `produto_selecionado_id` pelo próprio usuário |
| produto | qualquer papel autenticado | nenhum (catálogo via seed/migração nesta fase) |
| escritorio_produto | qualquer papel autenticado | `master` |
| acesso_log | `master` | INSERT: `system` e usuário autenticado (próprio id); sem UPDATE/DELETE |
| papel_mapeamento | `master` | `master` |

Notas:
- Desativação (`ativo=false`) é UPDATE do `master` restrito a `origem='central'` na
  policy — usuário espelhado é imutável localmente (FR-025) exceto pelo `system`.
- A exclusão de escritório com usuários é impedida por FK `RESTRICT` (FR-026) — a
  policy permite o DELETE ao master; o banco garante a integridade.

## Estados e transições

**usuario.papel (origem = sistema)**: reescrito a cada login pelo espelhamento
(tradução do mapeamento vigente). Nunca editável pela interface.

**usuario.ativo (origem = central)**: `true ⇄ false` pelo Master. `false` →
login local negado + sessões existentes rejeitadas no próximo acesso (R2).

**Sessão (cookie, fora do banco)**: criada no login → renovada por uso (janela 7d) →
expira por inatividade, teto absoluto (30d), logout, ou usuário inativo.

## Seeds de desenvolvimento (`scripts/seed.ts`)

- 6 produtos (nomes reais do catálogo Sittax, ordem definida).
- 2 escritórios fictícios (CNPJs válidos de teste) com produtos vinculados.
- 4 usuários, um por papel: padrão e suporte espelhados-fictícios (`origem='sistema'`),
  dev e master locais (`origem='central'`, senha de dev documentada no `.env.example`).
- Mapa de papéis: entradas placeholder (ex.: `ADMINISTRADOR/10 → dev`) até o PO
  fornecer o mapa real — substituíveis pela tela do Master.
- Bootstrap de produção: o seed de produção cria **apenas** o primeiro Master e os 6
  produtos (exceção de bootstrap documentada na spec).
