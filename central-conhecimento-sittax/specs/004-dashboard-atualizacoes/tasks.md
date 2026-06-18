# Tasks: Dashboard, Release Notes e Eventos

**Input**: Design documents from `/specs/004-dashboard-atualizacoes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/internal-api.md, quickstart.md

**Tests**: OBRIGATÓRIOS nesta feature (Constituição IX + spec FR-020): sanitização de
release note, RLS das 3 tabelas novas, visibilidade temporal de evento e regressão da
imutabilidade de `inscricao_ead`. As tarefas de teste de cada história devem ser
escritas ANTES da implementação correspondente e falhar primeiro.

**Organization**: tarefas agrupadas por user story (spec.md), cada fase é um
incremento independentemente testável.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (schema e migrações)

**Purpose**: criar as 3 tabelas e suas policies — pré-requisito de tudo

- [X] T001 Adicionar seção "Feature 004" em src/lib/db/schema.ts com as tabelas `release_note` (par conteudo_md/conteudo_publico, FK produto NOT NULL, data, versao NULL, criado_por/atualizado_por), `evento` (titulo, descricao, inicio/fim timestamptz, check `fim > inicio`, criado_por) e `aula_acesso` (PK usuario_id×aula_id, acessado_em, FK aula ON DELETE CASCADE), conforme data-model.md
- [X] T002 Criar migração drizzle/0008_dashboard.sql (tabelas + checks + índice `(produto_id, data DESC)` em release_note) e registrar em drizzle/meta/_journal.json, seguindo o padrão das migrações 0004/0006
- [X] T003 Criar migração drizzle/0009_dashboard-rls.sql: GRANTs + ENABLE/FORCE RLS nas 3 tabelas; `release_note` SELECT autenticado, INSERT/UPDATE dev/master/system, SEM policy de DELETE (R5); `evento` SELECT por papel com corte temporal para padrão (`fim >= now()`, R4), INSERT/UPDATE/DELETE suporte/dev/master/system; `aula_acesso` own-row SELECT/INSERT/UPDATE (+system), sem DELETE — seguir o padrão de 0005_ead-rls.sql
- [X] T004 Aplicar migrações no banco local (`npm run db:migrate`) e verificar que sobem limpas sobre uma base com 0000–0007

---

## Phase 2: Foundational (testes de portão — bloqueia as histórias)

**Purpose**: provar as policies independentemente de UI; nenhuma história começa sem RLS verde

- [X] T005 Estender tests/rls.test.ts para as 3 tabelas novas: escrita de `release_note` negada a padrão/suporte e DELETE negado até a dev/master; escrita de `evento` negada a padrão e permitida a suporte; `aula_acesso` own-row (usuário não lê nem escreve linha de outro); SELECT de `evento` passado negado a padrão e permitido a suporte (R4)

**Checkpoint**: RLS das 3 tabelas comprovada — histórias podem começar (US1 não depende de US2–US5)

---

## Phase 3: User Story 1 - Continuar EADs pelo dashboard (Priority: P1) 🎯 MVP

**Goal**: dashboard real como tela inicial com o bloco "Continue de onde parou" — inscrições em andamento do produto ativo com %, link para a última aula acessada e sugestões quando vazio

**Independent Test**: usuário inscrito em EAD do produto ativo (aula 2 acessada) e em EAD de outro produto → dashboard mostra só o primeiro e o card abre direto a aula 2; sem inscrições no produto → sugestões de EADs disponíveis

- [X] T006 [US1] Escrever testes da retomada em tests/dashboard.test.ts (falhando primeiro): última acessada vence; sem acesso → primeira aula na ordem; aula removida → cascade + fallback; upsert idempotente atualiza acessado_em; regressão: UPDATE em inscricao_ead segue impossível (garantia da 003)
- [X] T007 [P] [US1] Criar src/lib/ead/acesso.ts com `registrarAcessoAula(aulaId, userId, papel)` (upsert ON CONFLICT DO UPDATE, no-op silencioso sem inscrição em_andamento no módulo) e `ultimaAulaAcessada(moduloId, userId, tx)` (max(acessado_em) entre as aulas do módulo), conforme contracts/internal-api.md
- [X] T008 [US1] Alterar src/app/(shell)/ead/aula/[id]/page.tsx para chamar `registrarAcessoAula` no render server-side (R7), sem quebrar a página quando não há inscrição
- [X] T009 [US1] Criar src/lib/dashboard/consultas.ts com `continuarDeOndeParou(produtoId, userId, papel)` (inscrições em_andamento × módulos do produto ativo, nome/capa, % via `_percentualNaTx` da 003, retomadaAulaId via R1, numa transação) e `eadsDisponiveis(produtoId, userId, papel)` (módulos do produto sem inscrição do usuário)
- [X] T010 [P] [US1] Criar src/app/(shell)/dashboard/componentes/BlocoContinuar.tsx: cards (nome, capa, % vivo, botão que navega para /ead/aula/[retomadaAulaId]) + estado vazio com sugestões de EADs disponíveis (link para /ead/[moduloId]) + estado "selecione um produto"
- [X] T011 [US1] Substituir o placeholder src/app/(shell)/dashboard/page.tsx pela tela real (server component, `force-dynamic`, padrão de sessão/produto ativo de /ead/page.tsx) renderizando o BlocoContinuar; estilos dos cards do dashboard em src/app/globals.css

**Checkpoint**: US1 funcional e testável isolada — MVP do dashboard de pé

---

## Phase 4: User Story 2 - Novidades e página de release notes (Priority: P2)

**Goal**: bloco "Novidades" (até 5 notas do produto ativo) + página /atualizacoes com a lista cronológica completa, com sanitização única por papel

**Independent Test**: com notas semeadas em 2 produtos (uma com `:::nota-interna`), padrão vê só as notas do produto ativo sem nenhum byte interno; suporte vê o bloco interno; trocar produto muda bloco e página

- [X] T012 [US2] Escrever teste de sanitização em tests/dashboard.test.ts (falhando primeiro): nota criada com `:::nota-interna` via system → `notasDoProduto`/`notasRecentes` para sessão padrão retornam conteúdo sem nenhum byte do texto interno (SC-003); para suporte, retornam o conteúdo completo
- [X] T013 [P] [US2] Criar src/lib/notas/consultas.ts com `notasDoProduto(produtoId, userId, papel)` e `notasRecentes(produtoId, userId, papel, limite = 5)` — ORDER BY data DESC, criado_em DESC; coluna por papel (padrao → conteudo_publico, suporte+ → conteudo_md) conforme R2/contracts
- [X] T014 [P] [US2] Criar src/app/(shell)/atualizacoes/componentes/NotaCard.tsx (data, versão opcional sem campo vazio, conteúdo via MarkdownTopico existente) e ListaNotas.tsx (lista cronológica + estado vazio)
- [X] T015 [US2] Substituir o placeholder src/app/(shell)/atualizacoes/page.tsx pela lista do produto ativo (sessão + produto grudento, estado "selecione um produto"), usando ListaNotas
- [X] T016 [US2] Criar src/app/(shell)/dashboard/componentes/BlocoNovidades.tsx (até 5 notas, link "ver todas" → /atualizacoes, estado vazio) e integrá-lo em src/app/(shell)/dashboard/page.tsx
- [X] T017 [US2] Estender scripts/seed.ts: ≥2 release notes por produto semeado, a mais recente com bloco `:::nota-interna` de teste e uma com versão preenchida (insumo do quickstart US2)

**Checkpoint**: US1 + US2 funcionam de forma independente

---

## Phase 5: User Story 3 - Dev cria e edita release notes (Priority: P3)

**Goal**: criação/edição de nota pela interface (dev+; Master herda), com a derivada `conteudo_publico` recalculada em todo save; sem exclusão

**Independent Test**: dev cria nota → aparece na página e no bloco; padrão/suporte não veem botões e têm escrita rejeitada pelo servidor (gate + RLS já coberta em T005)

- [X] T018 [US3] Escrever testes das actions em tests/dashboard.test.ts (falhando primeiro): `criarNota`/`atualizarNota` negadas a sessão padrão e suporte (gate); save recalcula `conteudo_publico` (nota editada para incluir `:::nota-interna` → derivada não contém o texto interno); validação Zod de entrada inválida
- [X] T019 [US3] Criar src/lib/actions/release-notes.ts com `criarNota` e `atualizarNota` (gate dev+ no início, Zod na borda, `conteudo_publico = sanitizarMarkdown(conteudoMd, 'padrao')` em TODO save, atualizado_por/atualizado_em, revalidatePath de /atualizacoes e /dashboard), conforme contracts; NÃO criar `excluirNota`
- [X] T020 [P] [US3] Criar src/app/(shell)/atualizacoes/componentes/EditorNota.tsx reaproveitando o padrão do BaseEditor/EditorTopico da 002 (campos: produto, data com default hoje, versão opcional, markdown)
- [X] T021 [US3] Criar src/app/(shell)/atualizacoes/nova/page.tsx e src/app/(shell)/atualizacoes/[id]/editar/page.tsx com gate server-side dev+ (`notFound()` para os demais), usando EditorNota
- [X] T022 [US3] Adicionar botões "Nova nota"/"Editar" em src/app/(shell)/atualizacoes/page.tsx visíveis só para dev/master (cortesia de UI — FR-015/FR-018)

**Checkpoint**: ciclo completo das release notes (ler + escrever) de pé

---

## Phase 6: User Story 4 - Próximos eventos no dashboard (Priority: P4)

**Goal**: bloco "Próximos eventos" (globais, sem produto, futuros e em andamento, ordem por início), idêntico para qualquer produto ativo

**Independent Test**: com 1 evento futuro e 1 passado semeados, o bloco mostra só o futuro (data + horário início–fim) em qualquer produto ativo; sem eventos futuros → estado vazio

- [X] T023 [US4] Escrever teste do bloco em tests/dashboard.test.ts (falhando primeiro): `proximosEventos` para padrão não retorna evento com fim no passado e retorna evento em andamento (inicio < now < fim); ordenação por inicio ASC; resultado independe de produto
- [X] T024 [US4] Adicionar `proximosEventos(userId, papel, limite = 5)` em src/lib/dashboard/consultas.ts (ORDER BY inicio ASC; sem filtro de papel — a RLS de T003 corta o passado para padrão, R4)
- [X] T025 [US4] Criar src/app/(shell)/dashboard/componentes/BlocoEventos.tsx (título, descrição ao expandir/clicar, data e horário início–fim, estado vazio) e integrá-lo em src/app/(shell)/dashboard/page.tsx
- [X] T026 [US4] Estender scripts/seed.ts com 1 evento futuro e 1 evento passado (insumo do quickstart US4/US5)

**Checkpoint**: dashboard completo com os 3 blocos

---

## Phase 7: User Story 5 - Suporte+ gerencia eventos (Priority: P5)

**Goal**: CRUD de eventos pela interface (suporte+; Master herda) com histórico de passados na gestão (clarify 2026-06-11)

**Independent Test**: suporte cria/edita/exclui evento e vê o passado no histórico; padrão não vê controles e tem escrita e rota de gestão negadas

- [X] T027 [US5] Escrever testes das actions em tests/dashboard.test.ts (falhando primeiro): `criarEvento` negada a sessão padrão e permitida a suporte; `fim <= inicio` rejeitado com mensagem clara (Zod) e bloqueado pelo check do banco; evento multi-dia rejeitado (premissa v1, R3); `excluirEvento` por suporte funciona
- [X] T028 [US5] Criar src/lib/actions/eventos.ts com `criarEvento`, `atualizarEvento`, `excluirEvento` (gate suporte+ no início — novo `gateSuporteMais` no próprio arquivo, padrão de gateDevMais da 003; Zod com refine fim > inicio e mesmo dia local; revalidatePath de /dashboard e /dashboard/eventos), conforme contracts
- [X] T029 [US5] Criar src/app/(shell)/dashboard/eventos/page.tsx (gate server-side suporte+, `notFound()` para padrão) com componente GestaoEventos em src/app/(shell)/dashboard/componentes/: forms de criar/editar/excluir e listas separadas "Próximos" × "Histórico" (a RLS entrega tudo a suporte+)
- [X] T030 [US5] Adicionar link "Gerenciar eventos" no BlocoEventos visível só para suporte/dev/master (cortesia de UI), apontando para /dashboard/eventos

**Checkpoint**: todas as histórias funcionais de forma independente

---

## Phase 8: Polish & Cross-Cutting

- [X] T031 [P] Revisar/completar estilos dos blocos do dashboard, página de atualizações e gestão de eventos em src/app/globals.css (consistência com o padrão visual de docs/layout-navegacao-claude-design.md)
- [X] T032 [P] Atualizar CHANGELOG.md (versão MINOR) com Dashboard, Release Notes e Eventos
- [ ] T033 Rodar a suíte completa (`npm test`) e o roteiro de specs/004-dashboard-atualizacoes/quickstart.md ponta a ponta com os 4 papéis; registrar a pendência do PO de emendar docs/escopo-plataforma-conhecimento-v2.md §6.4 (divergência declarada na spec)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências — T001 → T002/T003 → T004 (migrações dependem do schema; aplicação depende das migrações)
- **Phase 2 (Foundational)**: depende de T004; BLOQUEIA todas as histórias
- **Histórias (Phases 3–7)**: todas dependem da Phase 2; entre si são independentes, com duas integrações pontuais: T016/T025 tocam dashboard/page.tsx criado em T011 (US1) — se US2/US4 forem feitas antes de US1, criar a página com o bloco respectivo e estados mínimos; T022 toca atualizacoes/page.tsx criado em T015 (US3 depois de US2 na prática)
- **Phase 8 (Polish)**: depende das histórias desejadas

### User Story Dependencies

- **US1 (P1)**: só Foundational — MVP
- **US2 (P2)**: só Foundational (dados via seed/system; não precisa de US3)
- **US3 (P3)**: usa a página criada em US2 (T015/T022 no mesmo arquivo)
- **US4 (P4)**: só Foundational (dados via seed); integra no dashboard/page.tsx
- **US5 (P5)**: usa o BlocoEventos de US4 (T030)

### Within Each Story

Testes (falhando) → lib/consultas → actions → componentes → página/integração.

### Parallel Opportunities

- T002 ∥ T003 (arquivos de migração distintos, após T001)
- Após T005: US1, US2 e US4 podem andar em paralelo (pessoas diferentes), com o cuidado do arquivo compartilhado dashboard/page.tsx (T011/T016/T025 — sequenciar só essas)
- Dentro de US1: T007 ∥ T010; dentro de US2: T013 ∥ T014; dentro de US3: T020 em paralelo com T019
- Polish: T031 ∥ T032

## Parallel Example: User Story 1

```bash
# Depois de T006 (testes falhando):
Task: "T007 criar src/lib/ead/acesso.ts"
Task: "T010 criar componentes/BlocoContinuar.tsx"
# Em seguida, sequencial: T008 (página da aula) → T009 (consultas) → T011 (dashboard/page.tsx)
```

## Implementation Strategy

**MVP first**: Phases 1–3 (Setup + RLS + US1) entregam o dashboard mínimo com
retomada — valida com o PO antes de seguir. Depois, incremental por prioridade:
US2 → US3 (ciclo completo de notas) → US4 → US5 (ciclo completo de eventos) →
Polish. Cada checkpoint é demonstrável de forma independente pelo quickstart.

## Notes

- Tarefas de teste (T005, T006, T012, T018, T023, T027) são inegociáveis
  (Constituição IX) e devem falhar antes da implementação correspondente.
- Nenhuma query fora de `withUser`/`withSystem`; nenhum UPDATE em `inscricao_ead`.
- `excluirNota` não existe — não implementar "por completude".
