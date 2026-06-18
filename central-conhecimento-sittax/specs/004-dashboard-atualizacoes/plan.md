# Implementation Plan: Dashboard, Release Notes e Eventos

**Branch**: `004-dashboard-atualizacoes` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-dashboard-atualizacoes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Dashboard como tela inicial real (preenche o placeholder `/dashboard` da Fase 1) com
três blocos: **Continue de onde parou** (inscrições em andamento do produto ativo,
card com nome, % vivo reusado da 003 e link para a **última aula acessada** — fato
novo registrado em tabela própria `aula_acesso`, upsert no render da página da aula);
**Novidades** (até 5 release notes mais recentes do produto ativo + "ver todas");
**Próximos eventos** (eventos gerais, sem produto, futuros e em andamento — a
visibilidade "padrão não vê passado" é decidida na RLS, num lugar só). **Release
notes** preenchem o placeholder `/atualizacoes`: lista cronológica do produto ativo
com o mesmo par `conteudo_md`/`conteudo_publico` derivado da 002 (sanitização única
no save + leitura por papel), criação/edição só dev (gate servidor + RLS). **Eventos**
têm CRUD suporte+ em tela de gestão própria com histórico. 3 tabelas novas
(`release_note`, `evento`, `aula_acesso`), 2 migrações, zero dependências novas.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS; Next.js 15 (App Router) — mesma stack das Fases 1–3

**Primary Dependencies**: somente as já existentes (Drizzle, pg, iron-session, Zod,
lucide-react, react-markdown + remark-directive, unified/remark no servidor, Vitest).
**Nenhuma dependência nova**: editor de nota reaproveita o padrão `EditorTopico`/
`BaseEditor` da 002; renderização reusa `MarkdownTopico`; sanitização reusa
`sanitizarMarkdown` (função única)

**Storage**: PostgreSQL 16 (mesmo banco/RLS) — migração `0008_dashboard` com 3
tabelas: `release_note` (par md/público derivado, FK produto), `evento` (geral, sem
produto, `inicio`/`fim` timestamptz + check `fim > inicio`), `aula_acesso` (own-row,
PK usuário×aula, upsert de `acessado_em`); migração `0009_dashboard-rls` com as
policies (incl. a regra "padrão só vê evento com `fim >= now()`")

**Testing**: Vitest contra Postgres real (infra das fases anteriores). Suíte crítica
nova: `tests/dashboard.test.ts` — sanitização byte-level de release note para papel
padrão (SC-003), escrita de nota negada a suporte/padrão e de evento negada a padrão
(RLS + gate), evento passado invisível para padrão e visível no histórico para
suporte+, check `fim > inicio`, retomada (última acessada / fallback primeira aula /
aula removida). `tests/rls.test.ts` estendido para as 3 tabelas novas

**Target Platform**: idêntico às fases anteriores (Linux on-prem via Docker Compose; web responsivo)

**Project Type**: web full-stack em projeto único (mesmo repo/app)

**Performance Goals**: dashboard server-render completo <2s (SC-006) com 1 transação
RLS por bloco no máximo (consultas agregadas, sem N+1 além do padrão existente de %);
registro de acesso à aula não bloqueia o render perceptível (<50ms, upsert único)

**Constraints**: decisões travadas (spec + clarify 2026-06-11): eventos passados
saem do dashboard mas ficam em histórico na gestão (suporte+) — nada é apagado;
release note sem exclusão (só criar/editar); evento pontual (mesmo dia, validação na
borda Zod; banco só garante `fim > inicio`); bloco Novidades limitado a 5; inscrição
em EAD permanece imutável (UPDATE segue negado em `inscricao_ead` — a retomada vive
em tabela própria, sem tocar na garantia SC-003 da 003)

**Scale/Scope**: ~5 superfícies (dashboard com 3 blocos, página de atualizações,
criar/editar nota, gestão de eventos com histórico, registro de acesso embutido na
página da aula), 3 tabelas novas, ~3 arquivos de actions/consultas novos, seed
estendido (notas + eventos), CHANGELOG

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Avaliação |
|---|---|---|
| I | Separar dado de regra | ✅ Acesso à aula, nota e evento são fatos gravados; "próximos eventos" e "padrão não vê passado" são regra calculada num lugar só (policy RLS, R4); retomada é derivada (max de `acessado_em`), nunca armazenada como ponteiro mutável em inscrição |
| II | Autorização via RLS, contexto em toda transação | ✅ As 3 tabelas novas ganham policies em `0009_dashboard-rls`; toda query via `withUser` existente; `aula_acesso` é own-row (select/insert/update do próprio usuário) |
| III | Conteúdo interno nunca sai do servidor (NÃO NEGOCIÁVEL) | ✅ Release note reusa o padrão derivado da 002: `conteudo_publico = sanitizarMarkdown(md, 'padrao')` recalculado em todo save; leitura escolhe a coluna pelo papel da sessão; teste byte-level novo cobre nota com `:::nota-interna` (SC-003) |
| IV | Conclusão é fato imutável | ✅ Nenhum caminho novo escreve em `inscricao_ead` (UPDATE segue negado pela policy da 003); o bloco do dashboard apenas LÊ status; retomada em tabela própria não toca a inscrição |
| V | Produto é dimensão suprema | ✅ Release note exige `produto_id`; blocos Continue/Novidades filtram pelo produto ativo. **Evento sem produto é exceção declarada** (spec FR-013, divergência registrada no cabeçalho da spec e validada pelo PO) — não é "produto fantasma": a coluna não existe |
| VI | Papel nasce na origem; permissão no servidor | ✅ Nota: gate dev+ em toda action + policy de escrita dev/master; evento: gate suporte+ + policy; botões ocultos são cortesia (FR-018); visibilidade de evento passado para padrão decidida na RLS, não na tela |
| VII | Reaproveitar antes de criar | ✅ Reusa `sanitizarMarkdown`, padrão de coluna derivada, `MarkdownTopico`, `BaseEditor`/padrão de editor da 002, `percentualProgresso`/trilha da 003, `withUser`, padrão de actions com gate, infra de teste e seed. Únicos mecanismos novos: `aula_acesso` (justificado em R1 — alternativa violaria a imutabilidade da inscrição) e tabela `evento` (entidade nova de negócio) |
| VIII | Tudo operável pela interface | ✅ Nota: criar/editar por tela (dev+); evento: criar/editar/excluir por tela com histórico (suporte+); nota não tem exclusão **por decisão de spec** (FR-012 — operação não existe no negócio nesta fase, não é lacuna de tela) |
| IX | Nascida para evoluir | ✅ Migrações versionadas `0008`/`0009`; CHANGELOG; seed com notas e eventos; testes críticos novos (sanitização de nota, RLS das 3 tabelas, visibilidade temporal de evento); par md/público preparado para qualquer endpoint futuro |
| X | v1 de pé | ✅ Fora do escopo explícito: lives/streaming, RSVP, notificações, EAD interno no bloco, Redmine; bloco Novidades fixo em 5; evento pontual sem recorrência |
| XI | Human in the loop | ✅ Spec re-especificada pelo PO em 2026-06-11 (substituiu a versão calendário/modal) com clarify resolvido (histórico de eventos); divergências do escopo §6.4 declaradas na spec; PO valida via quickstart |

**Resultado pré-Phase 0**: PASS.

**Resultado pós-Phase 1**: PASS — data-model e contracts mantêm os princípios; nenhuma
entrada na Complexity Tracking. Atenção registrada: `docs/escopo-plataforma-
conhecimento-v2.md` §6.4 deve ser atualizado pelo PO para refletir eventos gerais
(sem live) e o fim do modal agregado — a spec declara a divergência, e a constituição
manda a mudança de regra começar pelo doc de escopo.

## Project Structure

### Documentation (this feature)

```text
specs/004-dashboard-atualizacoes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── internal-api.md  # Superfície de actions/consultas desta feature
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/(shell)/
│   ├── dashboard/
│   │   ├── page.tsx                    # Tela inicial real: 3 blocos (substitui placeholder)
│   │   ├── eventos/page.tsx            # Gestão de eventos c/ histórico (gate suporte+)
│   │   └── componentes/                # BlocoContinuar, BlocoNovidades, BlocoEventos,
│   │                                   # GestaoEventos (forms criar/editar/excluir)
│   ├── atualizacoes/
│   │   ├── page.tsx                    # Lista cronológica do produto ativo (substitui placeholder)
│   │   ├── nova/page.tsx               # Criar nota (gate dev+)
│   │   ├── [id]/editar/page.tsx        # Editar nota (gate dev+)
│   │   └── componentes/                # ListaNotas, NotaCard, EditorNota (reusa BaseEditor)
│   └── (shell)/ead/aula/[id]/page.tsx  # ALTERADA: registra acesso (upsert aula_acesso)
├── lib/
│   ├── dashboard/
│   │   └── consultas.ts                # continuarDeOndeParou, eadsDisponiveis,
│   │                                   # proximosEventos (RLS filtra o passado p/ padrão)
│   ├── notas/
│   │   └── consultas.ts                # notasDoProduto (coluna por papel), notasRecentes(5)
│   ├── ead/
│   │   └── acesso.ts                   # registrarAcessoAula (upsert), ultimaAulaAcessada
│   └── actions/
│       ├── release-notes.ts            # criarNota, atualizarNota (gate dev+)
│       └── eventos.ts                  # criarEvento, atualizarEvento, excluirEvento (gate suporte+)
drizzle/0008_dashboard.sql              # release_note, evento, aula_acesso + checks
drizzle/0009_dashboard-rls.sql          # policies (incl. visibilidade temporal de evento)
scripts/seed.ts                         # estendido: 2+ notas por produto (1 c/ nota-interna), 2 eventos
tests/
├── dashboard.test.ts                   # REGRAS CRÍTICAS da fase (ver Technical Context)
└── rls.test.ts                         # estendido p/ as 3 tabelas novas
```

**Structure Decision**: mesma estrutura das fases anteriores (projeto único Next.js,
server components + server actions com gate; sem route handlers novos — o registro de
acesso acontece no render server-side da página da aula, dentro da mesma transação
RLS, sem chamada extra do client). Consultas de leitura em `src/lib/{dashboard,notas}`,
mutações em `src/lib/actions/`, seguindo o padrão da 002/003.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

(vazio — nenhuma violação)
