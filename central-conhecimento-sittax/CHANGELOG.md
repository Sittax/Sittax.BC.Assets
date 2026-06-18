# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [0.4.0] - 2026-06-11

Dashboard, Release Notes e Eventos (Feature 004): tela inicial real com retomada
de EAD, canal de atualizações por produto e eventos gerais.

### Added

- **Dashboard real** (US1): `/dashboard` deixa de ser placeholder e vira a tela
  inicial com três blocos. "Continue de onde parou" lista as inscrições em
  andamento do produto ativo com % vivo e link direto para a **última aula
  acessada** (nova tabela own-row `aula_acesso`, upsert no render da página da
  aula); sem EAD em andamento, sugere os EADs disponíveis do produto.
- **Release notes** (US2/US3): página `/atualizacoes` com a lista cronológica
  do produto ativo e bloco "Novidades" no dashboard (5 mais recentes + "ver
  todas"). Cada nota tem produto, data, versão opcional e markdown livre com o
  par `conteudo_md`/`conteudo_publico` derivado pela MESMA `sanitizarMarkdown`
  da base — bloco `:::nota-interna` visível só para suporte+, **0 bytes** para
  papel padrão. Criação/edição exclusivas de dev/master (`/atualizacoes/nova` e
  `/atualizacoes/[id]/editar`, editor Milkdown reaproveitado); **sem exclusão**
  (decisão de spec — RLS sequer tem policy de DELETE).
- **Eventos** (US4/US5): registro informativo geral (título, descrição, data,
  início/fim) **sem produto** — bloco "Próximos eventos" idêntico para qualquer
  produto ativo. Gestão por suporte+ em `/dashboard/eventos` com histórico de
  passados (nada é apagado automaticamente); papel padrão não vê evento passado
  — regra codificada na policy RLS, não na tela. Check `fim > inicio` no banco;
  pontualidade (mesmo dia) validada na borda (Zod).
- **Migrações** `0008_dashboard` (3 tabelas + checks + índice) e
  `0009_dashboard-rls` (policies, incl. visibilidade temporal de evento).
- **Seed** estendido: 3 release notes (1 com nota interna) e 2 eventos
  (1 futuro, 1 passado).
- **Testes**: `tests/dashboard.test.ts` (retomada, sanitização byte-level de
  nota, visibilidade temporal, validações de evento, regressão da imutabilidade
  de inscrição) e `tests/rls.test.ts` estendido para as 3 tabelas novas.

### Fixed

- **Espelhamento de papel** (`mirror.ts`): papel com mapeamento vigente agora
  ressincroniza SEMPRE no relogin (inclusive downgrade), como manda o escopo
  §2/§3; apenas o fallback sem mapeamento preserva promoção manual. (Bug da
  Fase 001/003 que o ambiente sem Docker mantinha invisível.)
- Testes da Fase 003 atualizados à semântica real: DELETE filtrado por policy
  retorna 0 linhas (não `42501`) e a inscrição idempotente usa a chave por
  módulo da migração `0007`.

## [0.3.0] - 2026-06-11

Módulo EAD do Cliente (Feature 003): trilha, inscrição, progresso e alicerce da avaliação.

### Added

- **Trilha EAD do cliente** (US1): hierarquia `Produto → Módulo EAD → Aula`
  com página `/ead` exibindo módulos e aulas ordenados, botão **Iniciar EAD**
  (visível apenas sem inscrição e com ≥1 aula), % de progresso vivo para
  inscritos, aulas marcadas como vistas.
- **Inscrição explícita** (US1): action `iniciarEad` com `ON CONFLICT DO NOTHING`
  (idempotente — clique repetido retoma sem duplicar), pré-condição de ≥1 aula
  no produto validada no servidor.
- **Marcação de progresso** (US1): `POST /api/ead/progresso` autenticado e
  idempotente; YouTube IFrame Player API em `PlayerYouTube.tsx` (client component,
  carregamento único por página), evento `ended` dispara a marcação; % calculado
  como `COUNT(vistas) / COUNT(aulas)` — derivado, nunca armazenado, recalcula
  automaticamente após exclusão de aulas.
- **Página de aula** (`/ead/aula/[id]`): player YouTube + descrição renderizada
  server-side com `sanitizarMarkdown` + `MarkdownTopico`; navegação
  anterior/próxima na trilha do produto.
- **Gestão de módulos e aulas** (US2): CRUD completo por telas em `/ead/gestao`
  com gate server-side dev/master; campo de vídeo aceita URL ou ID (extração via
  `lib/ead/youtube.ts`); exclusão de módulo só se vazio; exclusão de aula remove
  progresso em cascata; botão "Gerenciar" exibido na trilha apenas para dev/master.
- **Alicerce da avaliação** (FR-012/FR-014): tabelas `prova`, `questao`,
  `tentativa`, `certificado` criadas nas migrações desta fase, sem telas ou fluxo
  — prontas para a v2 do módulo (prova/conclusão/certificado/positivado).
- **Migrações** `0004_ead` (8 tabelas + enum `inscricao_status` + checks +
  índice único parcial) e `0005_ead-rls` (RLS: own-row em inscrição/progresso,
  UPDATE/DELETE negados a todos em `inscricao_ead`/`progresso_aula` — materializa
  SC-003, alicerce legível só por dev/master).
- **Suítes de teste** obrigatórias: `tests/ead.test.ts` (idempotência, isolamento,
  nenhum caminho grava `concluido`), `tests/ead-gestao.test.ts` (gate dev/master,
  exclusão de módulo vazio, cascata de progresso), `tests/rls.test.ts` estendido
  com as 8 tabelas novas.

## [0.2.0] - 2026-06-11

Base de Conhecimento (Feature 002).

### Added

- **Leitura navegável** (US1): hierarquia `Produto → Módulo → Tópico` com
  painel lateral recolhível (~260px, "Ocultar/Mostrar árvore"), tópico atual
  destacado e ancestrais abertos; breadcrumb `Produto › Módulo › Tópico`
  clicável; Anterior/Próximo entre irmãos; `:::video` como embed responsivo;
  mobile: árvore como drawer no topo.
- **Sanitização server-side** (US2 / Princípio III): função única
  `sanitizarMarkdown(md, papel)` em `src/lib/conteudo/sanitizar.ts` remove
  `:::nota-interna` e `:::nota-tecnica` para papel padrão; fail-closed para
  directive mal-formada; blocos visíveis com distinção visual para suporte+.
  Teste bloqueante cobre página, busca e isolamento por produto.
- **Edição de texto e árvore** (US3): editor Milkdown com preset commonmark;
  permissão por directive no save (suporte bloqueado em `nota-tecnica`);
  regeneração de `conteudo_publico` na mesma transação; create/rename/move/
  delete de módulos e tópicos com regras de profundidade (≤5) e anti-ciclo.
  Teste bloqueante cobre todos os cenários de rejeição e aceitação.
- **Busca FTS** (US6): campo da top bar habilitado; `GET /api/busca?q=` com
  FTS Postgres por papel (padrão: `tsv_publico`; suporte+: `tsv_completo`);
  filtro obrigatório por produto ativo; dropdown com título + trecho
  clicáveis; orientação para termo < 3 caracteres. Teste bloqueante cobre
  papel × produto × isolamento.
- **Imagens no conteúdo** (US4): `POST /api/arquivos` (multipart, gate
  suporte+, `image/*`, ≤10 MB); armazenamento no MinIO via interface
  `Storage`; `GET /api/arquivos/{id}` com streaming autenticado e
  `content-type` correto; integração no EditorTopico (botão "Inserir imagem").
- **Importador Obsidian** (US5): motor único `importarObsidian()` — adm-zip
  + gray-matter + wikilink resolution + reescrita de imagens + sanitização na
  inserção; tela `/base/importar` (upload zip + relatório); CLI
  `scripts/import-obsidian.ts` (conveniência); slug único com sufixo em
  colisão; aviso de possível duplicata no reimport.
- **Banco de dados**: tabelas `modulo`, `topico` (com `conteudo_publico`
  derivada + colunas `tsv_publico`/`tsv_completo` geradas + índices GIN) e
  `arquivo`; migrations `0002_conteudo.sql` e `0003_conteudo-rls.sql`; seeds
  de conteúdo dev (2 módulos/~6 tópicos no produto 1 + 1 módulo/2 tópicos
  no produto 2 para testes de isolamento da busca).
- **Testes críticos** (Constituição III e IX): `tests/sanitizacao.test.ts`
  (unitários + integração de leitura + busca FTS × papel × isolamento),
  `tests/directives-save.test.ts` (permissão por directive, árvore, RLS),
  `tests/rls.test.ts` estendido para `modulo`, `topico` e `arquivo`,
  `tests/importer.test.ts` (motor de import com MemoryStorage).

### Notes

- **Débito v1 (FR-021)**: `GET /api/arquivos/{id}` exige apenas sessão
  válida — sem checagem de papel. v2 adiciona flag `interna` na tabela
  `arquivo` e checagem no serve (roadmap §9).
- `conteudo_publico` é derivada gerenciada pelas actions/importer —
  Drizzle não a declara como GENERATED (limitação do drizzle-kit para
  tsvector; as colunas geradas estão no SQL da migração).

## [0.1.0] - 2026-06-10

Fundação da Central de Conhecimento (Feature 001).

### Added

- **Identidade via SSO**: login com e-mail/senha validado em sequência nos 6
  sistemas Sittax (timeout por sistema + teto total configuráveis), com
  classificação de falha (credencial inválida / indisponível / misto com
  aviso parcial) e mensagens que nunca revelam qual sistema respondeu.
- **Espelhamento**: usuário e escritório criados/ressincronizados a cada
  login; tradução role/nível → papel via mapeamento configurável (fallback
  `padrao`); CNPJ normalizado como chave; regra de CNPJ vazio (bloqueia
  padrão, libera suporte+). Usuários "só central" com senha Argon2id,
  validação local-first e rate-limit.
- **Sessão própria**: cookie httpOnly assinado (iron-session), janela
  deslizante de 7 dias + teto absoluto de 30 (configuráveis); independente
  do JWT de origem; desativação derruba no próximo acesso.
- **Autorização por RLS**: role `central_app` sem BYPASSRLS, `FORCE ROW
  LEVEL SECURITY` em todas as tabelas, contexto por transação via helper
  único `withUser`/`withSystem`; `acesso_log` append-only.
- **Casca de navegação**: top bar (logo, seletor de produto grudento, busca
  desabilitada, avatar), rail recolhido com fly-out (mobile: barra
  inferior), placeholders dos 5 módulos, EAD interno restrito a suporte+
  (404 server-side).
- **Gerência do Master**: CRUD de escritórios (CNPJ validado, produtos
  contratados), usuários só central (espelhados em modo leitura),
  mapeamento de papéis e visualização paginada do registro de acesso.
- **Registro bruto de acesso**: um evento por login (sem produto) e por
  troca de produto (com produto); sem lógica sobre os dados.
- Infra: Docker Compose (postgres 16 + minio + app standalone), migrações
  Drizzle versionadas, seeds de dev e `--bootstrap`, testes críticos de RLS
  e espelhamento (Vitest contra Postgres real).

### Notes

- O papel antes chamado "cliente" chama-se **padrão** (`padrao`); "cliente"
  designa apenas a entidade comercial (escritório).
- Catálogo oficial no seed (ordem do seletor): Sittax Simples, Sittax
  Recupera, Sittax ST, Sittax Token, Sittax Monitora, Sittax Certificado.
- CRUD de produtos: débito registrado no roadmap (escopo §9) para antes do
  fechamento do v1.
