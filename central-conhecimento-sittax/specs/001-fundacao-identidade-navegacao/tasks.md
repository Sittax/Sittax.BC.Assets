---

description: "Task list for Fundação — Identidade, Sessão e Casca de Navegação"
---

# Tasks: Fundação — Identidade, Sessão e Casca de Navegação

**Input**: Design documents from `/specs/001-fundacao-identidade-navegacao/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/internal-api.md, quickstart.md

**Tests**: OBRIGATÓRIOS nesta feature (Constituição, Princípio IX): a fase toca RLS e
espelhamento de papel — `tests/rls.test.ts` e `tests/espelhamento.test.ts` são parte do
escopo, não opcionais.

**Organization**: Tarefas agrupadas por user story (US1–US4 da spec), com Setup e
Foundational antes. Caminhos conforme `plan.md` (projeto único Next.js na raiz do repo).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (login/sessão), US2 (casca), US3 (gerência), US4 (registro de acesso)
- **Nota (PO, 2026-06-10)**: o papel antes chamado "cliente" foi renomeado para **padrão**
  (valor `padrao` em enums/código); "cliente" agora designa só a entidade comercial (escritório)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Projeto Next.js inicializado, ambiente e configuração validada

- [X] T001 Inicializar projeto Next.js 15 (App Router) com TypeScript na raiz do repo (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css` com tokens do brief visual: `--brand-orange #F37021`, `--brand-orange-soft #FDEBDD`, `--text-muted #8A8F98`, `--surface #FFFFFF`, `--bg #F4F5F7`)
- [X] T002 [P] Criar `docker-compose.yml` na raiz (serviços: postgres:16 com volume e healthcheck, minio para fases futuras, app em modo standalone) e `.dockerignore`
- [X] T003 [P] Criar `.env.example` documentando todas as vars sem valores reais: `DATABASE_URL`, `SESSION_SECRET`, `SSO_BASE_URLS` (6 URLs HTTPS separadas por vírgula), `SSO_TIMEOUT_MS=3000`, `SSO_TOTAL_TIMEOUT_MS=10000`, `SESSION_IDLE_DAYS=7`, `SESSION_MAX_DAYS=30`
- [X] T004 Implementar `src/lib/config.ts`: parse/validação Zod das env vars na inicialização — exatamente 6 URLs com protocolo `https:`, segredo ≥32 chars, números positivos; falha de validação derruba o boot com mensagem clara (research R3, adendo PO)
- [X] T005 [P] Instalar e configurar Drizzle (`drizzle.config.ts` apontando para `src/lib/db/schema.ts` e `drizzle/`), Vitest (`vitest.config.ts`, database `central_test`) e scripts npm: `db:migrate`, `db:seed`, `test`
- [X] T006 [P] Criar `CHANGELOG.md` (Keep a Changelog, seção `[Unreleased]`) e `README.md` mínimo apontando para `specs/001-fundacao-identidade-navegacao/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Banco com RLS, helper único de acesso, sessão e seeds — nada de user story antes disso

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase completa

- [X] T007 Definir schema Drizzle completo em `src/lib/db/schema.ts` conforme data-model.md: enums (`papel`, `papel_espelhavel`, `origem`) e tabelas `escritorio`, `usuario`, `produto`, `escritorio_produto`, `acesso_log`, `papel_mapeamento` com todos os CHECKs (padrao→escritório; central→senha_hash; sistema→sem senha; master→origem central) e UNIQUEs (cnpj, email citext, role+nivel)
- [X] T008 Gerar migração inicial via drizzle-kit em `drizzle/0000_init.sql` (incluindo extensão citext) e validar `npm run db:migrate` contra o Postgres do compose
- [X] T009 Escrever migração custom `drizzle/0001_rls-policies.sql`: role `central_app` (não-owner, sem BYPASSRLS), `ENABLE/FORCE ROW LEVEL SECURITY` em todas as tabelas e policies por papel conforme tabela do data-model.md (incluindo papel `system`, acesso_log append-only, usuário espelhado imutável exceto via system, FK RESTRICT em escritorio←usuario)
- [X] T010 [P] Implementar `src/lib/db/client.ts`: pool `pg` (conexão como `central_app`) + instância drizzle; exportado apenas para `rls.ts`
- [X] T011 Implementar `src/lib/db/rls.ts`: `withUser(userId, papel, fn)` — transação + `set_config('app.user_id'/'app.papel', $, true)` parametrizado — e `withSystem(fn)` (papel `system`, uso restrito a login/espelhamento/seed); nenhum outro módulo importa `client.ts` (research R5)
- [X] T012 [P] Implementar `src/lib/auth/session.ts` com iron-session: payload `{userId, papel, loginAt, lastActivityAt}`; `getSession()` valida janela deslizante (`SESSION_IDLE_DAYS`) + teto (`SESSION_MAX_DAYS`) + `usuario.ativo` no banco e renova `lastActivityAt`; `createSession()`/`destroySession()` (research R2)
- [X] T013 Implementar `scripts/seed.ts` (dev: 6 produtos com ordem, 2 escritórios com CNPJs de teste válidos e produtos vinculados, 4 usuários um por papel, mapa de papéis placeholder `ADMINISTRADOR/10→dev`; produção: flag `--bootstrap` cria só 6 produtos + primeiro Master) usando `withSystem`
- [X] T014 Escrever `tests/rls.test.ts` (REGRA CRÍTICA — Princípio IX): para cada papel × tabela, afirma SELECT/INSERT/UPDATE/DELETE permitidos e negados conforme data-model.md; query sem contexto setado retorna zero linhas/erro; usuário espelhado não é editável pelo master; acesso_log não aceita UPDATE/DELETE

**Checkpoint**: Banco migrado, RLS testado verde, seeds rodando — user stories liberadas

---

## Phase 3: User Story 1 - Login com credencial existente e sessão própria (Priority: P1) 🎯 MVP

**Goal**: Usuário dos 6 sistemas (ou só central) loga, papel/escritório são espelhados via mapeamento, sessão própria independente do SSO

**Independent Test**: Com mock HTTP dos 6 sistemas (e seeds), logar com cada papel e verificar espelhamento; derrubar o mock e confirmar que sessão ativa segue e novo login falha com mensagem clara (quickstart V1/V2)

- [X] T015 [P] [US1] Implementar `src/lib/auth/sso-client.ts`: sequência das 6 URLs (`SSO_BASE_URLS`), `fetch` com `AbortSignal.timeout(SSO_TIMEOUT_MS)` por sistema e teto total `SSO_TOTAL_TIMEOUT_MS`; decodifica claims do JWT sem verificar assinatura (research R4); classifica por sistema: 400/401/403→recusa autoritativa; timeout/rede/5xx/resposta malformada→inacessível; agrega resultado (validado | recusado | indisponível | misto) conforme FR-007/FR-029
- [X] T016 [P] [US1] Implementar `src/lib/auth/mirror.ts`: tradução role/nivel via `papel_mapeamento` (exato→curinga→fallback `padrao`, research R8); normalização de CNPJ (14 dígitos) e e-mail (trim+lowercase, chave de identidade R1); regra CNPJ vazio (bloqueia padrão, libera suporte+, FR-028); nome de escritório vazio→CNPJ formatado (R9); upsert de escritório e usuário (`origem='sistema'`, `id_origem`) via `withSystem`
- [X] T017 [P] [US1] Implementar `src/lib/auth/local.ts`: verificação Argon2id (`@node-rs/argon2`) para `origem='central'`, checagem de `ativo`, rate-limit em memória por e-mail+IP (5 falhas→1 min, research R11)
- [X] T018 [US1] Implementar `src/app/api/auth/login/route.ts` conforme contracts/internal-api.md: valida body com Zod; roteia local (e-mail de usuário `origem='central'`) vs SSO; executa espelhamento; cria sessão; grava `acesso_log` (sem produto, R10); retorna 200/401 (inclusive `credencial_invalida_parcial` com aviso de indisponibilidade parcial)/403 (`sem_escritorio`, `usuario_inativo`)/503/429 com mensagens PT-BR que nunca revelam qual sistema validou/recusou/caiu
- [X] T019 [P] [US1] Implementar `src/app/api/auth/logout/route.ts`: destrói sessão, 200 idempotente
- [X] T020 [US1] Implementar tela de login `src/app/login/page.tsx` (fora da casca): formulário e-mail/senha, estados de erro distintos para cada código do contrato (incluindo aviso de indisponibilidade parcial), redirect pós-login para `/dashboard`, identidade visual do brief
- [X] T021 [US1] Escrever `tests/espelhamento.test.ts` (REGRA CRÍTICA — Princípio IX) com mock HTTP local dos 6 sistemas (`node:http` + fixtures do contrato `docs/sso-login-endpoint.md`): primeiro login cria usuário+escritório; papel ressincroniza no relogin; não mapeado→padrão; CNPJ vazio bloqueia padrão e libera suporte+; nome vazio→CNPJ formatado; classificação credencial inválida × indisponível × misto; teto total de tempo; login grava acesso_log sem produto

**Checkpoint**: US1 entregável e testável sozinha (MVP) — login funciona de ponta a ponta

---

## Phase 4: User Story 2 - Casca de navegação com visibilidade por papel (Priority: P2)

**Goal**: Top bar + rail conforme doc de layout, placeholders dos 5 módulos, EAD interno só suporte+ (gate no servidor), seletor grudento

**Independent Test**: Logar com os 4 papéis do seed e percorrer o rail; papel padrão recebe 404 em `/ead-interno`; produto persiste entre módulos/sessões/navegadores (quickstart V3/V4)

- [X] T022 [US2] Implementar `src/app/(shell)/layout.tsx`: exige `getSession()` válida (senão redirect `/login`); carrega usuário via `withUser`; resolve produto selecionado (default: primeiro contratado do escritório ou primeiro do catálogo, R7); monta lista de módulos do rail filtrada por papel **no servidor** (EAD interno só suporte+); renderiza TopBar + Rail + área de conteúdo
- [X] T023 [P] [US2] Implementar `src/components/shell/TopBar.tsx` e `src/components/shell/AvatarMenu.tsx`: logo duas cores estilo Sittax, campo de busca desabilitado com tooltip "disponível em breve", avatar com menu (nome, papel, escritório quando houver, ação sair chamando `/api/auth/logout`)
- [X] T024 [P] [US2] Implementar `src/components/shell/ProductSelector.tsx`: pill+dropdown com os 6 produtos na ordem do catálogo (independe de contrato); estado desabilitado/atenuado com tooltip "EAD interno é organizado por temas" quando a rota ativa é `/ead-interno`, voltando à seleção anterior ao sair
- [X] T025 [P] [US2] Implementar `src/components/shell/Rail.tsx`: recolhido ~64px só ícones (lucide: layout-dashboard, book-open, graduation-cap, megaphone, shield-check), fly-out overlay no hover desktop/tap em touch (sem empurrar conteúdo), tooltip+aria-label por item, item ativo com barra laranja + fundo `--brand-orange-soft`; em mobile vira barra inferior (doc layout §2/§6)
- [X] T026 [P] [US2] Criar placeholders `src/app/(shell)/dashboard/page.tsx`, `src/app/(shell)/base/page.tsx`, `src/app/(shell)/ead/page.tsx`, `src/app/(shell)/atualizacoes/page.tsx` (título do módulo + aviso de fase)
- [X] T027 [US2] Criar `src/app/(shell)/ead-interno/page.tsx`: gate server-side `papel ∈ {suporte, dev, master}` senão `notFound()` 404 (research R6); placeholder com nota de que o seletor de produto não se aplica
- [X] T028 [US2] Implementar server action `src/lib/actions/produto-selecionado.ts`: `selecionarProduto(produtoId)` — atualiza `usuario.produto_selecionado_id` via `withUser` (RLS: próprio usuário) e grava `acesso_log` com produto (R10); conectar ao ProductSelector

**Checkpoint**: Casca completa e navegável com os 4 papéis

---

## Phase 5: User Story 3 - Gerência do Master (Priority: P3)

**Goal**: CRUD pela interface de escritórios (com produtos contratados), usuários só central e mapeamento de papéis; espelhados read-only

**Independent Test**: Como master, criar escritório+usuário suporte só central, logar com ele e ver EAD interno; demais papéis recebem 404 na gerência (quickstart V5)

- [X] T029 [US3] Implementar `src/app/(shell)/gerencia/layout.tsx`: gate server-side `papel === 'master'` senão `notFound()`; sub-navegação Escritórios / Usuários / Mapeamento de papéis
- [X] T030 [P] [US3] Implementar `src/lib/actions/escritorios.ts` (criar com CNPJ validado 14 dígitos+DV, editar nome, excluir com tratamento do FK RESTRICT orientando desativar/migrar usuários, vincular/desvincular produto, listar com produtos e contagem de usuários) e a tela `src/app/(shell)/gerencia/escritorios/page.tsx`
- [X] T031 [P] [US3] Implementar `src/lib/actions/usuarios.ts` (criar usuário `origem='central'` com senha Argon2id e papel local — padrão exige escritório; editar; desativar/reativar; listar todos) e a tela `src/app/(shell)/gerencia/usuarios/page.tsx` com espelhados em modo somente leitura + badge "espelhado da origem" sem botão de editar papel (FR-025)
- [X] T032 [P] [US3] Implementar `src/lib/actions/mapeamento.ts` (criar/editar/excluir entradas role+nivel?→papel, nunca master; listar exibindo o fallback fixo "não mapeado → padrão") e a tela `src/app/(shell)/gerencia/mapeamento/page.tsx`

**Checkpoint**: Zero SQL para operar a fase (SC-004)

---

## Phase 6: User Story 4 - Registro bruto de acesso (Priority: P4)

**Goal**: Todo login e troca de produto registrados; nenhuma lógica sobre os dados

**Independent Test**: Logins e trocas geram exatamente um registro cada, visíveis ao Master (quickstart V6)

- [X] T033 [US4] Criar visualização somente leitura `src/app/(shell)/gerencia/acessos/page.tsx` (lista paginada: usuário, produto quando houver, data — sem filtros analíticos, é inspeção bruta) e adicionar item na sub-navegação de `src/app/(shell)/gerencia/layout.tsx`
- [X] T034 [US4] Acrescentar a `tests/espelhamento.test.ts` asserções de US4: login gera 1 registro sem produto; `selecionarProduto` gera 1 registro com produto; seleção automática inicial não gera registro (R10)

**Checkpoint**: Todas as user stories entregues

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T035 Passada de conformidade visual/responsiva contra `docs/layout-navegacao-claude-design.md` §9 (estados: rail recolhido/hover/ativo, mobile barra inferior, tablet tap) e tokens do brief em `src/app/globals.css`
- [X] T036 Executar os 6 cenários do `specs/001-fundacao-identidade-navegacao/quickstart.md` (V1–V6) com seeds + homologação/mock e registrar resultado por cenário no próprio quickstart (checkboxes)
- [X] T037 Registrar versão `0.1.0` no `CHANGELOG.md` (fundação: identidade SSO, sessão, casca, gerência, acesso_log) e revisar `.env.example`/README contra o que foi implementado

---

## Dependencies & Execution Order

```
Phase 1 (Setup) ──► Phase 2 (Foundational) ──► US1 (P1) ──► US2 (P2) ──► US3 (P3) ──► US4 (P4) ──► Polish
```

- **US1 → US2**: a casca exige sessão e papel (T022 usa T012/T018).
- **US2 → US3**: as telas de gerência vivem dentro da casca (T029 usa T022).
- **US3 → US4**: a visualização de acessos entra na navegação da gerência (T033 usa T029). A *gravação* do log, porém, já nasce em US1 (T018) e US2 (T028).
- Dentro de cada fase, tarefas [P] podem rodar em paralelo (arquivos distintos).

**Parallel examples**:

- Phase 1: T002 + T003 + T005 + T006 após T001.
- Phase 2: T010 + T012 em paralelo após T009.
- US1: T015 + T016 + T017 + T019 em paralelo; T018 depois de T015–T017; T020–T021 depois de T018.
- US2: T023 + T024 + T025 + T026 em paralelo após T022.
- US3: T030 + T031 + T032 em paralelo após T029.

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + US1** (login espelhado com sessão própria, testado). Cada
checkpoint é um incremento validável pelo PO (Princípio XI) — parar, demonstrar via
quickstart, e só então avançar. Os testes críticos (T014, T021) são bloqueantes: fase
não fecha com teste vermelho (Princípio IX).
