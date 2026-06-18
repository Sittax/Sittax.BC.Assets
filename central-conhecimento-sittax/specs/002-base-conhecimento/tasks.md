---

description: "Task list for Base de Conhecimento — Conteúdo, Blocos Internos, Edição, Busca e Import"
---

# Tasks: Base de Conhecimento

**Input**: Design documents from `/specs/002-base-conhecimento/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/internal-api.md, quickstart.md

**Tests**: OBRIGATÓRIOS nesta feature (Constituição, Princípios III e IX): a fase toca
sanitização de conteúdo interno e RLS — `tests/sanitizacao.test.ts` (página + busca +
isolamento por produto) e `tests/directives-save.test.ts` são REGRA CRÍTICA e
bloqueantes; `tests/rls.test.ts` é estendido para as novas tabelas.

**Organization**: Tarefas agrupadas por user story da spec (US1 leitura, US2
sanitização, US3 edição, US6 busca, US4 imagens, US5 import), com Setup e
Foundational antes. Caminhos conforme plan.md (mesmo projeto Next.js da Fase 1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 (leitura), US2 (blocos internos), US3 (edição), US6 (busca), US4 (imagens), US5 (import)
- Papel de usuário comum = **padrão** (`padrao` em código); "cliente" = entidade comercial

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependências, configuração do MinIO e cliente de storage

- [X] T001 Instalar dependências novas no `package.json`: `unified`, `remark-parse`, `remark-stringify`, `remark-directive`, `react-markdown`, `@milkdown/core`, `@milkdown/preset-commonmark`, `@milkdown/plugin-slash`, `@milkdown/react`, `@aws-sdk/client-s3`, `adm-zip` (+`@types/adm-zip`), `gray-matter`, `github-slugger`; rodar `npm install` e validar `npm run typecheck`
- [X] T002 [P] Acrescentar as vars do MinIO em `src/lib/config.ts` (Zod: `MINIO_ENDPOINT` URL, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` não vazios, `MINIO_BUCKET`, `MINIO_FORCE_PATH_STYLE` default true) e documentá-las no `.env.example` (sem valores reais)
- [X] T003 [P] Implementar `src/lib/storage/minio.ts`: cliente `@aws-sdk/client-s3` apontando para o MinIO + interface `Storage` injetável (`salvar(chave, buffer, mime)`, `abrirStream(chave)`) com implementação real e fake em memória para testes (research R4/R11); criação idempotente do bucket no boot do cliente

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema + RLS das novas tabelas, função única de sanitização e regras da árvore — nada de user story antes disso

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase completa

- [X] T004 Estender `src/lib/db/schema.ts` com `modulo`, `topico` e `arquivo` conforme data-model.md: FKs `RESTRICT`, `UNIQUE(produto_id, nome)` em modulo, `UNIQUE(produto_id, slug)` em topico, `produto_id` denormalizado em topico, `conteudo_md`/`conteudo_publico`, `chave_storage UNIQUE` em arquivo
- [X] T005 Gerar `drizzle/0002_conteudo.sql` via drizzle-kit (`--name conteudo`) e acrescentar no SQL as colunas geradas `tsv_publico`/`tsv_completo` (`to_tsvector('portuguese', …) STORED`) + índices GIN (research R3); validar `npm run db:migrate` contra o Postgres do compose
- [X] T006 Escrever migração custom `drizzle/0003_conteudo-rls.sql`: GRANTs mínimos ao `central_app`, `ENABLE/FORCE ROW LEVEL SECURITY` e policies conforme tabela do data-model.md (SELECT qualquer autenticado; escrita suporte/dev/master/system; arquivo sem UPDATE/DELETE)
- [X] T007 [P] Implementar `src/lib/conteudo/sanitizar.ts` — FUNÇÃO ÚNICA `sanitizarMarkdown(md, papel)`: pipeline unified + remark-parse + remark-directive + transformador que remove nós `nota-interna`/`nota-tecnica` quando papel = `padrao` + remark-stringify; fail-closed para directive malformada (research R1, FR-011/FR-012/FR-014)
- [X] T008 [P] Implementar `src/lib/conteudo/directives.ts`: `extrairNotasTecnicas(md)` (serialização normalizada dos nós) e comparação de multiconjunto para o save (research R2, FR-017)
- [X] T009 [P] Implementar `src/lib/conteudo/slug.ts` (github-slugger + sufixo `-2`, único por produto — R7) e `src/lib/conteudo/arvore.ts` (profundidade ≤5, anti-ciclo, reordenação por nível, regras de exclusão de nó vazio — R8, FR-002/FR-016/FR-018)
- [X] T010 Estender `scripts/seed.ts` com conteúdo dev conforme data-model.md: 2 módulos/~6 tópicos (subtópicos até nível 3) no produto 1 — incluindo tópicos com `:::nota-interna`, `:::nota-tecnica` e `:::video` —, 1 módulo/2 tópicos no produto 2 (isolamento da busca); `conteudo_publico` gerado pela função única
- [X] T011 Escrever a parte unitária de `tests/sanitizacao.test.ts` (REGRA CRÍTICA — Princípio III): padrão remove interna+técnica (zero bytes), suporte/dev/master mantêm, `:::video` preservado para todos, directive sem fechamento fail-closed
- [X] T012 Estender `tests/rls.test.ts` com a matriz das novas tabelas: SELECT por qualquer papel autenticado; escrita negada a padrão; escrita permitida a suporte/dev/master/system; sem contexto → zero linhas; arquivo sem UPDATE/DELETE

**Checkpoint**: migrações verdes, função única testada, seeds com conteúdo — user stories liberadas

---

## Phase 3: User Story 1 - Leitura navegável da base do produto ativo (Priority: P1) 🎯 MVP

**Goal**: Ler a documentação do produto ativo com árvore lateral recolhível, breadcrumb, Anterior/Próximo e markdown renderizado (incluindo `:::video`)

**Independent Test**: Com seeds, navegar pela árvore/breadcrumb/Anterior-Próximo nos 2 produtos e validar o comportamento do doc de layout §5 em desktop e mobile (quickstart V1)

- [X] T013 [US1] Implementar `src/lib/conteudo/consultas.ts`: árvore completa do produto (módulos→tópicos aninhados ordenados), tópico por slug (resolvendo produto dono — R7), irmãos anterior/próximo e trilha do breadcrumb, tudo via `withUser`
- [X] T014 [P] [US1] Implementar `src/components/markdown/MarkdownTopico.tsx`: react-markdown + remark-directive sobre MD já saneado; mapeia `nota-interna`/`nota-tecnica` para blocos destacados e `video` para embed responsivo; sem HTML bruto (research R10)
- [X] T015 [P] [US1] Implementar componentes em `src/app/(shell)/base/componentes/`: `ArvorePainel.tsx` (painel ~260px recolhível "Ocultar/Mostrar árvore", tópico atual destacado, ancestrais abertos, drawer/accordion em mobile), `Breadcrumb.tsx` (Produto › Módulo › Tópico clicável) e `AnteriorProximo.tsx` (irmãos na ordem, desabilitado nas pontas) + CSS correspondente em `src/app/globals.css` (doc layout §5/§6)
- [X] T016 [US1] Implementar `src/app/(shell)/base/page.tsx` (redireciona ao 1º tópico do produto ativo ou estado vazio claro) e `src/app/(shell)/base/[slug]/page.tsx` (server-rendered: carrega tópico, aplica `sanitizarMarkdown(md, papel)` NO SERVIDOR, monta árvore+breadcrumb+anterior/próximo; para suporte+ exibe botão **Editar** levando a `/base/[slug]/editar` — cortesia; o gate real é o da página de edição)
- [X] T017 [US1] Tratar bordas de rota em `src/app/(shell)/base/[slug]/page.tsx`: slug de outro produto → atualiza `produto_selecionado_id` para o produto dono (R7, edge case da spec); slug inexistente → `notFound()`

**Checkpoint**: leitura completa e navegável (MVP junto com US2)

---

## Phase 4: User Story 2 - Blocos internos jamais chegam ao papel padrão (Priority: P1) 🎯 MVP

**Goal**: Sanitização server-side integrada à leitura, com teste bloqueante e distinção visual para suporte+

**Independent Test**: Teste automatizado: tópico com notas lido como padrão → zero bytes internos; como suporte → visível (quickstart V2)

- [X] T018 [US2] Estender `tests/sanitizacao.test.ts` com a integração de leitura (REGRA CRÍTICA — FR-013): tópico do seed com nota interna+técnica consultado e sanitizado pelo caminho real (`consultas.ts` + função única) como padrão → nenhum byte interno na saída nem em `conteudo_publico`; como suporte/dev/master → blocos presentes
- [X] T019 [P] [US2] Distinção visual dos blocos internos em `MarkdownTopico.tsx` + `src/app/globals.css`: rótulo e estilo distintos para "Nota interna" (suporte+) e "Nota técnica" (suporte+, criação só dev), conforme FR-010

**Checkpoint**: Princípio III comprovado por teste bloqueante — MVP entregável (US1+US2)

---

## Phase 5: User Story 3 - Edição de texto e árvore por suporte e dev (Priority: P2)

**Goal**: Editor Milkdown com menu `/`, gerência da árvore e validação de permissão por directive no save

**Independent Test**: Como suporte: editar texto + nota interna (OK), tentar nota técnica (rejeitado com mensagem); como dev: nota técnica OK; reorganizar árvore e validar limites (quickstart V4)

- [X] T020 [US3] Implementar `src/lib/actions/topicos.ts`: `salvarTopico` (gate suporte+; validação por directive via `directives.ts` — suporte com mudança em `nota-tecnica` rejeitado com mensagem clara, FR-017; regenera `conteudo_publico` pela função única NA MESMA transação — R3; reslug se título mudou), `criarTopico`, `moverTopico` (anti-ciclo + profundidade ≤5 via `arvore.ts`), `excluirTopico` (só sem filhos, senão orientação)
- [X] T021 [P] [US3] Implementar `src/lib/actions/modulos.ts`: `criarModulo`, `renomearModulo`, `reordenarModulo`, `excluirModulo` (só vazio — FR-018), nome único por produto
- [X] T022 [US3] Implementar editor em `src/app/(shell)/base/componentes/EditorTopico.tsx` (Milkdown: preset-commonmark + remark-directive + plugin-slash com itens para os 3 blocos; item `nota-tecnica` visível só para dev/master — cortesia, a regra é o servidor) e página `src/app/(shell)/base/[slug]/editar/page.tsx` (gate server-side suporte+ senão `notFound()`; salva via `salvarTopico` exibindo o erro de permissão)
- [X] T023 [P] [US3] Implementar gerência da árvore em `src/app/(shell)/base/componentes/GerenciaArvore.tsx` (visível só suporte+ no painel da árvore): criar/renomear/mover/reordenar módulos e tópicos e excluir com orientações de bloqueio (filhos/não-vazio/profundidade/ciclo)
- [X] T024 [US3] Escrever `tests/directives-save.test.ts` (REGRA CRÍTICA — FR-017/SC-002): suporte cria/altera/exclui `nota-tecnica` → rejeitado sem persistir; `nota-tecnica` pré-existente inalterada + edição do resto → aceito; dev/master → aceito; papel padrão → negado em qualquer action; mover além de 5 níveis e para descendente → rejeitados; excluir tópico com filhos e módulo com tópicos → rejeitados com orientação (FR-018); mover para módulo de outro produto → rejeitado (U1)

**Checkpoint**: edição completa com as duas regras críticas testadas

---

## Phase 6: User Story 6 - Busca na base do produto ativo (Priority: P2)

**Goal**: Campo da top bar habilitado; busca FTS por papel (coluna derivada) restrita ao produto ativo

**Independent Test**: Termo só-interno como padrão → zero resultados; como suporte → encontra; produto X não retorna tópico do produto Y (quickstart V3)

- [X] T025 [US6] Implementar `src/lib/conteudo/busca.ts` (consulta FTS via `withUser`: padrão → `tsv_publico` + `ts_headline` sobre `conteudo_publico`; suporte+ → `tsv_completo` sobre `conteudo_md`; filtro OBRIGATÓRIO por `produto_id` ativo — R3, FR-028/FR-029) e o route handler `src/app/api/busca/route.ts` (GET `?q=`, Zod, sessão obrigatória, termo ≥3, contrato do internal-api.md)
- [X] T026 [US6] Substituir a busca desabilitada da top bar por `src/components/shell/BuscaTopBar.tsx` (client: debounce, dropdown de resultados título+trecho clicáveis abrindo `/base/{slug}`, estado vazio claro, orientação para termo curto — FR-030) integrado em `src/components/shell/TopBar.tsx`
- [X] T027 [US6] Estender `tests/sanitizacao.test.ts` com a parte de busca (REGRA CRÍTICA — FR-013/SC-007): termo só-interno como padrão → zero resultados/trechos/contagem; suporte encontra com trecho; termo do produto 2 com produto 1 ativo → zero resultados (isolamento — US6 cenário 5)

**Checkpoint**: busca verde nos três eixos (papel, produto, vazio)

---

## Phase 7: User Story 4 - Imagens no conteúdo (Priority: P3)

**Goal**: Upload pelo editor, armazenamento no MinIO, serve autenticado pelo app

**Independent Test**: Subir imagem e vê-la no tópico; URL sem sessão → negada; logado → serve (quickstart V5)

- [X] T028 [US4] Implementar `src/app/api/arquivos/route.ts` (POST multipart: gate suporte+, valida `image/*` ≤10MB, salva no MinIO via `storage/minio.ts`, registra na tabela `arquivo` via `withUser`, devolve `{id, url}`) e `src/app/api/arquivos/[id]/route.ts` (GET: exige só sessão válida — débito v1 FR-021; streaming com content-type; 404 inexistente)
- [X] T029 [US4] Integrar upload ao `EditorTopico.tsx`: botão/cole de imagem → POST `/api/arquivos` → insere `![](/api/arquivos/{id})` no markdown

**Checkpoint**: imagens de ponta a ponta com débito v1 registrado

---

## Phase 8: User Story 5 - Importador de vault do Obsidian (Priority: P3)

**Goal**: Motor único (zip→hierarquia→Drizzle) consumido pela tela e pelo CLI, com relatório

**Independent Test**: Importar vault de fixture (subpastas, frontmatter, wikilinks, imagens, 7 níveis) e conferir hierarquia/links/imagens/relatório (quickstart V6)

- [X] T030 [US5] Implementar `src/lib/conteudo/importer.ts`: adm-zip percorre a vault; pastas→módulos/tópicos (achata além de 5 níveis com aviso — FR-022); gray-matter aproveita título do frontmatter (FR-023); `[[wikilinks]]` resolvidos por nome de arquivo → links `/base/{slug}` (sem destino → texto + aviso, FR-024); imagens migradas via interface `Storage` e referências reescritas (FR-025); para CADA tópico inserido, `conteudo_publico` gerado via `sanitizarMarkdown(md, 'padrao')` na mesma operação (data-model — sem isso o tópico importado vaza na busca); slug colidindo com tópico existente do produto → sufixado e contado como "possível duplicata" no relatório; inserção via Drizzle no contexto RLS; retorna relatório `{topicos, imagens, avisos}` (FR-026)
- [X] T031 [P] [US5] Implementar `src/app/api/importar-obsidian/route.ts` (POST zip ≤100MB + produtoId, gate suporte+) e a tela `src/app/(shell)/base/importar/page.tsx` (upload, escolha do produto, exibição do relatório; papel padrão → 404)
- [X] T032 [P] [US5] Implementar `scripts/import-obsidian.ts` (CLI: lê pasta local, zipa em memória e chama o MESMO motor via `withSystem` — conveniência; a interface é o caminho oficial, Princípio VIII)
- [X] T033 [US5] Escrever `tests/importer.test.ts` com vault de fixture em `tests/fixtures/vault/` (subpastas, frontmatter, wikilink válido e quebrado, imagem, ramo com 7 níveis): hierarquia preservada, achatamento com aviso, links internos resolvidos, imagens no storage fake, relatório fiel (SC-004)

**Checkpoint**: todas as user stories entregues

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T034 Passada de conformidade visual/responsiva contra `docs/layout-navegacao-claude-design.md` §5/§6/§9: árvore aberta/recolhida, leitura plena, drawer mobile, breadcrumb, blocos internos e busca na top bar
- [X] T035 Executar os 6 cenários do `specs/002-base-conhecimento/quickstart.md` (V1–V6) e registrar o resultado por cenário no próprio quickstart (checkboxes); validação do PO
- [X] T036 Registrar versão `0.2.0` no `CHANGELOG.md` (base de conhecimento: leitura, sanitização, edição, busca, imagens, import) com o débito FR-021 explícito; revisar `.env.example`/README contra o implementado

---

## Dependencies & Execution Order

```
Phase 1 (Setup) ──► Phase 2 (Foundational) ──► US1 (P1) ──► US2 (P1) ──► US3 (P2) ──► US6 (P2) ──► US4 (P3) ──► US5 (P3) ──► Polish
```

- **US1 → US2**: a integração da sanitização testa o caminho real de leitura (T018 usa T013/T016).
- **US3 depende de US1**: o editor abre a partir da leitura e o save regenera o que a leitura mostra.
- **US6 depende da Foundational** (colunas tsv) e de US1 (resultados abrem `/base/{slug}`).
- **US4 depende de US3** (upload vive no editor); o serve (T028) só depende do Setup.
- **US5 depende da Foundational + Setup** (storage, slug, árvore); os links do import abrem telas de US1.
- Dentro de cada fase, tarefas [P] podem rodar em paralelo (arquivos distintos).

**Parallel examples**:

- Phase 1: T002 + T003 após T001.
- Phase 2: T007 + T008 + T009 em paralelo após T004; T011 + T012 após T005–T010.
- US1: T014 + T015 em paralelo após T013; T016–T017 depois.
- US3: T021 + T023 em paralelo com T020/T022; T024 por último.
- US5: T031 + T032 em paralelo após T030.

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + US1 + US2** (leitura navegável com a regra de segurança
do Princípio III comprovada por teste bloqueante). Cada checkpoint é um incremento
validável pelo PO (Princípio XI). Os testes críticos (T011, T018, T024, T027) são
bloqueantes: fase não fecha com teste vermelho (Princípios III e IX).
