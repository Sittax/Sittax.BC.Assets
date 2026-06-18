# Quickstart — Feature 004: Dashboard, Release Notes e Eventos

Guia de validação ponta-a-ponta para o PO. Pré-requisitos e infra idênticos às fases
anteriores (Docker Compose com Postgres 16 + MinIO; `.env` conforme `.env.example`).

## Setup

```bash
npm install
docker compose up -d          # Postgres + MinIO
npm run db:migrate            # aplica até 0009_dashboard-rls
npm run db:seed               # usuários de cada papel + EAD completo + notas + eventos
npm run dev                   # http://localhost:3000
```

O seed desta fase acrescenta: ≥2 release notes por produto semeado (a mais recente
contendo um bloco `:::nota-interna` de teste), 1 evento futuro e 1 evento passado.
Usuários de teste (senhas no seed): um por papel (padrao, suporte, dev, master).

## Testes automatizados (regras críticas)

```bash
npm test                      # suíte completa
npx vitest run tests/dashboard.test.ts   # só as regras críticas da fase
```

Esperado: verde em sanitização de nota (byte-level p/ padrão), RLS das 3 tabelas
novas, visibilidade temporal de evento (padrão × suporte), check `fim > inicio`,
retomada (última acessada/fallbacks) e regressão da imutabilidade de `inscricao_ead`.

## Validação manual por história

### US1 — Continue de onde parou (P1)

1. Logue como **padrao**; garanta produto ativo = produto do seed.
2. No EAD do seed, inicie o EAD e abra a aula 2 (não precisa terminar o vídeo).
3. Volte ao Dashboard → bloco "Continue de onde parou" mostra o card do EAD com %
   e, ao clicar, **abre direto a aula 2**. ✅ SC-001
4. Conclua nada; troque o produto ativo para outro produto → o card some (bloco
   sugere EADs do novo produto, se houver). ✅ FR-002/FR-004
5. Usuário sem inscrição no produto ativo → bloco exibe sugestões de EADs
   disponíveis (ou vazio claro se não houver).

### US2 — Novidades e página de release notes (P2)

1. Como **padrao**, Dashboard → bloco "Novidades" lista até 5 notas do produto
   ativo; "ver todas" leva a `/atualizacoes` com a lista cronológica completa.
2. Abra a nota do seed que contém `:::nota-interna` → o trecho interno **não
   aparece** (confira também o código-fonte da página: nenhum byte). ✅ SC-003
3. Logue como **suporte** → o mesmo trecho aparece com o destaque de bloco interno.
4. Troque o produto ativo → bloco e página passam a mostrar só as notas do novo
   produto. ✅ SC-002
5. Produto sem notas → estados vazios claros (bloco e página).

### US3 — Dev cria/edita nota (P3)

1. Como **padrao** e **suporte**: `/atualizacoes` não mostra "Nova nota"/"Editar";
   acessar `/atualizacoes/nova` direto → não encontrado. ✅ SC-004
2. Como **dev**: criar nota (produto, data, versão opcional, markdown) → aparece
   imediatamente na página e no bloco Novidades. Editar → reflete. ✅ SC-005 (<2min)
3. Não existe botão nem caminho de excluir nota (decisão de spec).

### US4 — Próximos eventos (P4)

1. Como **padrao**, Dashboard → bloco "Próximos eventos" lista o evento futuro do
   seed (título, data, horário início–fim), ordenado por início; o evento passado
   do seed **não aparece**.
2. Troque o produto ativo → bloco de eventos **não muda**. ✅ SC-002
3. Sem eventos futuros → estado vazio claro.

### US5 — Suporte+ gerencia eventos (P5)

1. Como **suporte**: Dashboard mostra link de gestão → `/dashboard/eventos`; o
   evento **passado** do seed aparece no histórico. ✅ clarify 2026-06-11
2. Criar evento (título, descrição, data, início, fim) → aparece no bloco de todos
   os papéis. Editar e excluir → refletem. ✅ SC-005 (<2min)
3. Tentar salvar fim ≤ início → mensagem clara de rejeição. ✅ FR-016
4. Como **padrao**: nenhum controle de gestão; `/dashboard/eventos` → não
   encontrado. ✅ SC-004

## Encerramento da fase

- `CHANGELOG.md` atualizado (versão MINOR) com Dashboard, Release Notes e Eventos.
- Validação do PO sobre este quickstart (Constituição XI) antes de planejar a
  próxima fase.
- Pendência registrada para o PO: emendar `docs/escopo-plataforma-conhecimento-v2.md`
  §6.4 (eventos gerais suporte+, sem modal/lives) — divergência declarada na spec.
