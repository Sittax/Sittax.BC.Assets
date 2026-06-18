# Tasks: EAD do Cliente — Trilha, Inscrição, Progresso e Alicerce da Avaliação

**Input**: Design documents from `/specs/003-ead-cliente/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/internal-api.md, quickstart.md

**Tests**: OBRIGATÓRIOS nesta feature (Constituição, Princípio IX + FR-016): RLS das
tabelas novas, idempotência da aula vista, ausência de caminho de conclusão e gate de
gestão. Escritos ANTES da implementação correspondente (devem falhar primeiro).
Testes de conclusão imutável e positivado pertencem à v2 do módulo (research R9).

**Organization**: Tasks agrupadas por user story (US1 = inscrição/progresso, US2 =
gestão dev), com Setup e Foundational antes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 ou US2 (rastreabilidade com a spec)

## Path Conventions

Projeto único Next.js (mesma estrutura das fases 1–2): `src/`, `tests/`,
`drizzle/`, `scripts/` na raiz do repositório.

---

## Phase 1: Setup (schema, migrações e seed)

**Purpose**: dado modelado e versionado — inclui o alicerce da avaliação (FR-012/013)

- [X] T001 Adicionar ao `src/lib/db/schema.ts` as 8 tabelas da feature (`ead_modulo`, `aula`, `inscricao_ead` + enum `inscricao_status`, `progresso_aula`, `prova`, `questao`, `tentativa`, `certificado`) conforme `data-model.md`, com FKs, uniques e checks expressáveis no Drizzle
- [X] T002 Gerar a migração `drizzle/0004_ead.sql` (drizzle-kit) e ajustar manualmente o que o kit não cobre: índice único parcial `inscricao_ead (usuario_id, produto_id) WHERE interno = false` (R5), checks `num_nonnulls(produto_id, ead_modulo_id) = 1` em `prova` e `interno`/`tema_interno` em `ead_modulo`/`inscricao_ead` (escopo §10); conferir que o drizzle-kit registrou a entrada no `drizzle/meta/_journal.json`
- [X] T003 Criar a migração `drizzle/0005_ead-rls.sql` com as policies da tabela do research R7 — destaque: UPDATE/DELETE **negados a todos** em `inscricao_ead` e `progresso_aula` (materializa SC-003); alicerce legível só por dev/master e sem escrita
- [X] T004 Estender `scripts/seed.ts` com 1 EAD completo no produto de exemplo (2 módulos, 4 aulas com IDs públicos do YouTube) + prova inerte com 2 questões e nota de corte (dados de alicerce, sem fluxo) — requisito §7.1 do escopo (R10); incluir um 2º usuário de papel padrão (mesmo escritório) para a validação de isolamento de progresso do quickstart (Cenário 1, passo 7)

**Checkpoint**: `npm run db:migrate && npm run db:seed` verdes no ambiente com Postgres

---

## Phase 2: Foundational (domínio e teste de RLS)

**Purpose**: lógica de domínio pura e proteção de banco que TODAS as stories usam

**⚠️ CRITICAL**: nenhuma story começa antes desta fase terminar

- [X] T005 [P] Criar `src/lib/ead/youtube.ts`: extração/validação de ID do YouTube via Zod (URL `watch?v=`, `youtu.be/`, ID puro `[A-Za-z0-9_-]{11}`) e montagem da URL de embed `youtube-nocookie` (R4), com testes unitários inline na suíte de T009
- [X] T006 [P] Criar `src/lib/ead/trilha.ts`: consulta dos módulos+aulas do produto ativo (ordenados), aula anterior/próxima, flag de aula vista por usuário — tudo via `withUser`
- [X] T007 [P] Criar `src/lib/ead/progresso.ts`: `percentualProgresso(usuarioId, produtoId)` em consulta agregada única (aulas vistas existentes ÷ total atual — R3) e `marcarAulaVista` (INSERT `ON CONFLICT DO NOTHING`, pré-condições de aula existente + inscrição ativa — R2) e `inscricoesEmAndamento(usuarioId)` — consulta das inscrições em andamento do usuário com % de cada uma (FR-007, dado para o futuro bloco "EADs em aberto" do dashboard)
- [X] T008 Estender `tests/rls.test.ts` para as 8 tabelas novas (REGRA CRÍTICA — Princípio II/IX): own-row em `inscricao_ead`/`progresso_aula` (usuário A não lê nem grava dados de B), escrita em `ead_modulo`/`aula` negada a padrão/suporte, UPDATE em `inscricao_ead` negado até para o dono, alicerce ilegível para papel padrão

**Checkpoint**: fundação pronta — US1 e US2 podem seguir em paralelo

---

## Phase 3: User Story 1 - Inscrever-se e assistir aulas com progresso (Priority: P1) 🎯 MVP

**Goal**: usuário padrão se inscreve ("Iniciar EAD"), assiste aulas (evento `ended`
do player) e acompanha o % vivo — que nunca conclui nesta fase.

**Independent Test**: quickstart Cenários 1 e 2 — com seed, inscrever-se, terminar
uma aula, ver % subir; repetir término sem inflar %; 100% permanece "em andamento";
sem inscrição nada é gravado.

### Tests for User Story 1 (escrever primeiro, devem FALHAR)

- [X] T009 [P] [US1] Criar `tests/ead.test.ts` (REGRAS CRÍTICAS — FR-016/SC-003): inscrição única por usuário×produto (clique repetido retoma), marcação idempotente (2× `ended` = 1 registro, % estável), `marcarAulaVista` sem inscrição falha e nada grava, % deriva do total atual (remover aula recalcula; nunca >100%), **nenhum caminho grava `status='concluido'`** (tentativa de UPDATE falha pela policy), inscrição com 100% das aulas segue `em_andamento`; casos de validação de `youtube.ts`

### Implementation for User Story 1

- [X] T010 [US1] Criar `src/lib/actions/inscricoes.ts` com `iniciarEad(produtoId)`: sessão obrigatória, rejeita produto sem aulas (R8), `ON CONFLICT DO NOTHING` devolvendo inscrição existente (contrato em `contracts/internal-api.md`)
- [X] T011 [US1] Criar `src/app/api/ead/progresso/route.ts` (`POST {aulaId}`): Zod no body, `usuario_id` da sessão, usa `marcarAulaVista` de T007; respostas 200 `{vista, percentual}` / 401 / 404 / 409 `sem_inscricao`
- [X] T012 [P] [US1] Criar `src/app/(shell)/ead/componentes/PlayerYouTube.tsx` (client): carrega IFrame API uma única vez (guard no `window`), instancia player por `youtubeId`, no `onStateChange === ENDED` chama `POST /api/ead/progresso` e propaga o novo % (R1); vídeo indisponível/removido exibe o erro nativo do embed do YouTube, sem tratamento adicional (edge case aceito na spec)
- [X] T013 [US1] Criar `src/app/(shell)/ead/page.tsx` + componentes `TrilhaEad`/`CartaoModulo`/`ListaAulas` em `src/app/(shell)/ead/componentes/`: trilha do produto ativo com módulos→aulas ordenados, botão **Iniciar EAD** (só sem inscrição e com ≥1 aula — R8), % vivo para inscritos, aulas vistas marcadas, estado vazio para produto sem EAD
- [X] T014 [US1] Criar `src/app/(shell)/ead/aula/[id]/page.tsx`: `PlayerYouTube` + descrição renderizada server-side com `sanitizarMarkdown(descricao_md, papel)` da 002 + `MarkdownTopico` (R6 — Princípio III) + navegação anterior/próxima via `trilha.ts`
- [X] T015 [US1] Garantir na UI os estados da spec: não inscrito vê aulas sem % e sem registro (cenário 5 da US1), inscrito a 100% segue "em andamento" com % visível (cenário 7), botão some após inscrição; conferir item **EAD** do rail apontando para `/ead`

**Checkpoint**: US1 completa — quickstart Cenários 1 e 2 passam; MVP demonstrável

---

## Phase 4: User Story 2 - Gestão de módulos e aulas por dev (Priority: P2)

**Goal**: dev (Master herda) cria/edita/reordena/exclui módulos e aulas por telas;
suporte e padrão são negados no servidor.

**Independent Test**: quickstart Cenário 3 — como dev, criar módulo/aula colando URL
e ver na trilha; como suporte/padrão, ter acesso negado; % dos inscritos reage a
aulas adicionadas/removidas.

### Tests for User Story 2 (escrever primeiro, devem FALHAR)

- [X] T016 [P] [US2] Criar `tests/ead-gestao.test.ts` (REGRA CRÍTICA — FR-004/SC-004): cada action de gestão negada para suporte e padrão e permitida para dev/master; exclusão de módulo só vazio; criação de aula com URL extrai ID e com entrada inválida falha; excluir aula vista remove progresso em cascata e o % do inscrito recalcula

### Implementation for User Story 2

- [X] T017 [US2] Criar `src/lib/actions/ead-gestao.ts` com as 8 actions do contrato (`criarModuloEad`, `renomearModuloEad`, `reordenarModulosEad`, `excluirModuloEad` [só vazio], `criarAula`, `editarAula`, `reordenarAulas`, `excluirAula`), todas com gate dev/master + Zod + `withUser`
- [X] T018 [US2] Criar `src/app/(shell)/ead/gestao/page.tsx` + componente `GestaoEad` em `src/app/(shell)/ead/componentes/`: CRUD de módulos e aulas do produto ativo (campo de vídeo aceita URL ou ID), reordenação, gate server-side na página (negado → redirect/erro claro)
- [X] T019 [US2] Expor o acesso à gestão na UI apenas para dev/master (cortesia — ex.: botão "Gerenciar" na trilha), mantendo a regra no servidor (Princípio VI)

**Checkpoint**: US1 e US2 independentes e funcionais — quickstart Cenários 1–3 passam

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T020 [P] Atualizar `CHANGELOG.md` (minor da plataforma: módulo EAD do cliente — trilha, inscrição, progresso, gestão dev, alicerce da avaliação) e conferir que nenhuma env nova é necessária
- [X] T021 Rodar a suíte completa (`npm test`) e o `quickstart.md` (Cenários 1–4, incluindo a inspeção do alicerce/SC-006) no ambiente com Postgres; registrar resultado para validação do PO (Princípio XI)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 → T003; T004 depende de T001 (tipos do schema)
- **Foundational (Phase 2)**: depende do Setup; T005/T006/T007 em paralelo; T008 depende de T003
- **US1 (Phase 3)**: depende da Phase 2; T009 antes da implementação; T010/T011 antes de T013/T014; T012 paralelo a T010/T011
- **US2 (Phase 4)**: depende da Phase 2 (não de US1); T016 antes de T017 → T018 → T019
- **Polish (Phase 5)**: depois de US1 + US2

### User Story Dependencies

- **US1 (P1)**: independente — testável com dados do seed (T004)
- **US2 (P2)**: independente de US1 (gestão opera sobre as mesmas tabelas da fundação); o teste de "% reage a aula nova" usa inscrição criada no próprio teste

### Parallel Opportunities

```text
Phase 2:  T005 ─┐
          T006 ─┼─ paralelos (arquivos distintos)
          T007 ─┘
Pós-Phase 2 (duas pessoas): Dev A → US1 (T009…T015) | Dev B → US2 (T016…T019)
Dentro da US1: T009 ∥ (depois) T012 ∥ T010/T011
```

---

## Implementation Strategy

**MVP First**: Phases 1–3 (Setup + Foundational + US1) = MVP demonstrável — usuário
se inscreve, assiste e vê o % vivo. **PARAR e validar** com o quickstart (Cenários
1–2) antes da US2.

**Incremental**: US2 em seguida (gestão dev) → Polish → validação do PO via
quickstart completo. A v2 do módulo (prova/conclusão/certificado/positivado) é um
marco próprio, já com direção técnica fixada em research R9.
