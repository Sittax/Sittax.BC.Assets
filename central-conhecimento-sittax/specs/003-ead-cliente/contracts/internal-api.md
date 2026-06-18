# Contrato interno — Feature 003: EAD do Cliente

Superfície HTTP/actions desta feature. Padrões das fases anteriores: server actions
para mutações de formulário, route handlers para eventos/streaming; toda operação
roda dentro de `withUser` (RLS); erros de domínio retornam mensagem clara, nunca
stack.

## Páginas (App Router, server-rendered)

| Rota | Acesso | Conteúdo |
|---|---|---|
| `/ead` | sessão autenticada | Trilha do produto ativo: módulos→aulas em ordem; botão **Iniciar EAD** (se sem inscrição e produto com ≥1 aula); % vivo se inscrito; estado vazio se produto sem EAD |
| `/ead/aula/[id]` | sessão autenticada | Player YouTube (IFrame API) + descrição saneada (`sanitizarMarkdown`) + navegação anterior/próxima; aulas marcadas como vistas indicadas na lista |
| `/ead/gestao` | **dev/master** (gate server-side; outros papéis → negado) | CRUD de módulos e aulas do produto ativo |

## Route handlers

### `POST /api/ead/progresso`

Marca aula como vista (evento `ended` do player — R2).

- **Body**: `{ "aulaId": "<uuid>" }` (Zod)
- **Sessão**: obrigatória; `usuario_id` SEMPRE da sessão, nunca do body
- **Pré-condições (servidor)**: aula existe; usuário tem inscrição ativa
  (`interno = false`) no produto da aula
- **Efeito**: `INSERT ... ON CONFLICT DO NOTHING` em `progresso_aula`
- **Respostas**:
  - `200 { vista: true, percentual: number }` — gravado ou já existia (idempotente)
  - `401` sem sessão
  - `404` aula inexistente
  - `409 { erro: "sem_inscricao" }` — usuário não inscrito (nenhum progresso sem inscrição — FR-005)

## Server actions

### `src/lib/actions/inscricoes.ts`

| Action | Papéis | Regras |
|---|---|---|
| `iniciarEad(produtoId)` | qualquer autenticado | Cria inscrição `em_andamento` para o usuário da sessão; idempotente (`ON CONFLICT DO NOTHING` no unique parcial — clique repetido retoma); rejeita se o produto não tem aulas (R8) |

### `src/lib/actions/ead-gestao.ts` — todas com gate **dev/master** + RLS

| Action | Regras |
|---|---|
| `criarModuloEad(produtoId, nome)` | nome único no produto; ordem = última + 1 |
| `renomearModuloEad(id, nome)` | |
| `reordenarModulosEad(produtoId, ids[])` | |
| `excluirModuloEad(id)` | só módulo **vazio** (sem aulas) — padrão da 002 |
| `criarAula(eadModuloId, { titulo, youtube, descricaoMd? })` | `youtube` aceita URL ou ID; extração/validação via `lib/ead/youtube.ts` (R4) |
| `editarAula(id, { titulo?, youtube?, descricaoMd? })` | |
| `reordenarAulas(eadModuloId, ids[])` | |
| `excluirAula(id)` | permitida com progresso existente (cascade em `progresso_aula`); % dos inscritos recalcula sozinho (derivado — R3) |

**Invariantes transversais**:

- Nenhuma action/handler grava `status = 'concluido'` ou `data_conclusao` — além do
  código, a policy RLS nega UPDATE em `inscricao_ead` (R7/SC-003).
- Tentativa de gestão por suporte/padrão: erro de autorização do servidor (FR-004),
  testado em `tests/ead.test.ts`.
- Markdown de descrição nunca sai do servidor sem `sanitizarMarkdown` (R6).
