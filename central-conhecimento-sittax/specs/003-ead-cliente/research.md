# Research — Feature 003: EAD do Cliente

Decisões técnicas da fase. Nenhum NEEDS CLARIFICATION restou no Technical Context;
os itens abaixo consolidam escolhas e suas alternativas.

## R1 — Player: YouTube IFrame Player API sem dependência nova

**Decision**: carregar a IFrame Player API (`https://www.youtube.com/iframe_api`)
num client component próprio (`PlayerYouTube`), escutando `onStateChange` e
disparando a marcação quando `event.data === YT.PlayerState.ENDED` (valor `0`).
O carregamento do script é único por página (guard no `window`) e o componente
recebe apenas `youtubeId` + `aulaId`.

**Rationale**: decisão do PO ("YouTube IFrame Player API, marcando progresso no
evento ended via chamada autenticada"); a API nativa cobre 100% da necessidade
(embed + evento de término) sem custo de manutenção de wrapper.

**Alternatives considered**: `react-youtube` (wrapper fino, mas dependência a mais
para um único componente); `youtube-player` (idem); rastrear `currentTime` por
polling para % parcial (rejeitado — a regra é binária por evento `ended`, seek
liberado; § 6.2 do escopo).

## R2 — Marcação de aula vista: route handler autenticado e idempotente

**Decision**: `POST /api/ead/progresso` com body `{ aulaId }`, sessão obrigatória.
Implementação: `INSERT INTO progresso_aula (usuario_id, aula_id) ... ON CONFLICT
DO NOTHING`, com `usuario_id` vindo **da sessão** (nunca do body), dentro de
`withUser`. Pré-condições no servidor: aula existe e o usuário tem inscrição ativa
no produto da aula — sem inscrição, 409 e nada é gravado (FR-005).

**Rationale**: o evento `ended` nasce no cliente (não é formulário → route handler,
não server action); `ON CONFLICT DO NOTHING` dá idempotência (FR-009) sem
read-modify-write; RLS own-row garante que nem um body forjado grava para outro
usuário.

**Alternatives considered**: server action chamada do client component (funciona,
mas semanticamente é um endpoint de evento, e o route handler facilita teste de
contrato); marcar como visto no front e sincronizar depois (rejeitado — progresso é
fato do servidor).

## R3 — % de progresso: sempre derivado, nunca armazenado

**Decision**: função única `percentualProgresso(usuarioId, produtoId)` em
`src/lib/ead/progresso.ts`: `COUNT(progresso_aula JOIN aula existente no produto)
÷ COUNT(aula do produto)`, em uma consulta agregada. Exibido apenas quando existe
inscrição em andamento (única situação possível nesta fase).

**Rationale**: "% é indicador vivo sobre o total atual" (§5/§6.2): aulas removidas
saem de numerador e denominador por construção (o JOIN só conta aulas existentes —
FK com `ON DELETE CASCADE` em `progresso_aula` remove registros órfãos); nunca
excede 100%; nada para recalcular ou invalidar.

**Alternatives considered**: coluna `percentual` na inscrição (rejeitado — viraria
cache a invalidar e contradiz Princípio I); view materializada (desnecessário na
escala da fase).

## R4 — `youtube_id`: armazenar o ID, aceitar URL na gestão

**Decision**: persistir somente o ID do vídeo (11 caracteres). Na tela de gestão o
dev cola URL ou ID; `src/lib/ead/youtube.ts` extrai/valida com Zod (padrões
`youtube.com/watch?v=`, `youtu.be/`, ID puro `[A-Za-z0-9_-]{11}`). Embed monta
`https://www.youtube-nocookie.com/embed/{id}?enablejsapi=1`.

**Rationale**: dado canônico mínimo; URLs variam, ID não. `youtube-nocookie`
reduz cookies de terceiros sem afetar a IFrame API.

**Alternatives considered**: armazenar URL crua (rejeitado — parsing em todo
render); validar existência do vídeo via API do YouTube (rejeitado — exigiria API
key e quota; erro de vídeo aparece no próprio player, edge case aceito na spec).

## R5 — Inscrição única ativa por usuário×produto

**Decision**: índice único parcial `UNIQUE (usuario_id, produto_id) WHERE interno =
false` em `inscricao_ead`; a action `iniciarEad` usa `ON CONFLICT DO NOTHING` e
devolve a inscrição existente (clique repetido apenas retoma — edge case da spec).

**Rationale**: FR-006 ("no máximo uma inscrição ativa por usuário por EAD de
produto") garantido pelo banco, não por checagem de aplicação; o índice parcial já
deixa espaço para o EAD interno (v2+), cuja unicidade será por outro eixo
(`ead_modulo_id`/tema — decidido na fase dele).

**Alternatives considered**: unique total nas duas colunas (quebraria "reciclagem
= inscrição nova" no futuro e o EAD interno com produto NULL); checagem só na
action (race condition).

## R6 — Descrição de aula passa pela função única de sanitização

**Decision**: `descricao_md` é renderizada server-side com `sanitizarMarkdown(md,
papel)` (a MESMA função da 002) + `MarkdownTopico` no cliente. Sem coluna derivada
`*_publico` (não há busca sobre descrição nesta fase): a sanitização roda no render
da página da aula.

**Rationale**: Princípio III é "vale para qualquer endpoint futuro" — descrição de
aula é markdown servido a sessão de cliente, então passa pelo portão único.
Princípio VII: zero código novo de sanitização.

**Alternatives considered**: proibir directives na descrição (rejeitado — criaria
um segundo regime de markdown); coluna derivada como na 002 (desnecessário sem
busca; se a busca um dia indexar descrições, replica-se o padrão da 002).

## R7 — RLS das tabelas novas

**Decision** (policies em `0005_ead-rls.sql`, todas lendo
`current_setting('app.user_id')` / `current_setting('app.papel')`):

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `ead_modulo`, `aula` | qualquer sessão autenticada | só `dev`/`master` |
| `inscricao_ead` | dono da linha; `dev`/`master` leem tudo (métricas v2) | INSERT só o dono; UPDATE/DELETE negados a todos nesta fase |
| `progresso_aula` | dono da linha; `dev`/`master` leem tudo | INSERT só o dono; UPDATE/DELETE negados |
| `prova`, `questao`, `tentativa`, `certificado` (alicerce) | `dev`/`master` | negados a todos (fluxo é v2) |

**Rationale**: own-row para dados pessoais (Princípio II); negar UPDATE em
`inscricao_ead` no nível de policy é a materialização mais forte de "nenhum caminho
desta fase conclui" (FR-011/SC-003) — nem um bug de action conseguiria gravar
`concluido`; a v2 introduz a transição única via policy/função dedicada.

**Alternatives considered**: confiar só no código da action (mais fraco); trigger
de imutabilidade já nesta fase (pertence à v2, quando existir transição a proteger;
a policy de negação cobre o presente).

## R8 — Trilha "Iniciar EAD" oculto sem aulas

**Decision**: a trilha só oferece "Iniciar EAD" se o produto tem ≥1 aula; a action
`iniciarEad` revalida no servidor (`COUNT(aula) > 0`, senão erro de domínio).

**Rationale**: edge case da spec; checagem dupla (UI + servidor) segue Princípio VI
(UI é cortesia).

## R9 — Direção técnica fixada para a v2 do módulo (registro, sem código nesta fase)

Decisões do PO (input do `/speckit-plan`, 2026-06-11) para quando a v2 (prova/
conclusão/certificado/positivado) for planejada — registradas para não virar
decisão de corredor:

- **Conclusão**: transação que, no evento de aprovação ou de última aula vista,
  verifica as duas condições e grava `status = 'concluido'` + `data_conclusao` +
  emite certificado, de forma **idempotente** (conclusão já gravada nunca é
  regravada nem revertida — Princípio IV).
- **Certificado**: página pública de validação por `codigo_validacao` + geração de
  **PDF simples no servidor**.
- **Positivado**: **view/consulta SQL agregada** (conclusões × `escritorio_produto`)
  exibida no painel de métricas do Master — derivado, sem tabela própria.
- **Testes obrigatórios da v2**: imutabilidade da conclusão (adicionar aula após
  concluir não altera status/data/certificado) e cálculo de positivado (incluindo
  não-regressão e produto não contratado).

O alicerce desta fase (tabelas + campos + checks) foi desenhado para que essa v2
seja "ligar lógica", não migrar dado (FR-013/SC-006).

## R10 — Migrações e seed

**Decision**: `0004_ead.sql` (drizzle-kit generate a partir do `schema.ts` + ajustes
manuais para checks/índice parcial, como na 002) e `0005_ead-rls.sql` (manual).
`scripts/seed.ts` estendido com 1 EAD completo por produto de exemplo: 2 módulos,
4 aulas com IDs de vídeo públicos, 1 prova de alicerce com 2 questões (dados
inertes, sem fluxo) — cumpre o requisito de seed do §7.1 do escopo.

**Rationale**: mesmo fluxo de migração das fases anteriores; seed com prova inerte
permite à v2 nascer testável sem novo seed.
