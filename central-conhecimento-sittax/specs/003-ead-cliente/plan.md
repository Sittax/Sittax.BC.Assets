# Implementation Plan: EAD do Cliente — Trilha, Inscrição, Progresso e Alicerce da Avaliação

**Branch**: `003-ead-cliente` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-ead-cliente/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Módulo EAD do cliente sobre a fundação das Features 001/002: hierarquia
`Produto → Módulo de EAD → Aula (ordenada)` com aula = vídeo do YouTube não listado
(embed via IFrame Player API) + descrição opcional em markdown (renderizada com a
mesma função única de sanitização da 002); inscrição explícita "Iniciar EAD"
(gratuita, 1 ativa por usuário×produto); progresso marcado pelo evento `ended` do
player via chamada autenticada e idempotente; % vivo = aulas vistas ÷ total atual,
exibido só em inscrições em andamento — que nesta fase **nunca** concluem; telas de
CRUD de módulos e aulas exclusivas de dev (Master herda), com gate no servidor.
**Alicerce da avaliação** (decisão do PO no clarify de 2026-06-11): as tabelas de
prova, questão, tentativa e certificado + campos de conclusão na inscrição entram na
migração desta fase, **sem** telas, endpoints ou fluxo — prova/conclusão/certificado/
positivado são a v2 do módulo, com direção técnica já registrada no research (R9).
Testes Vitest obrigatórios da fase: RLS por usuário em progresso/inscrição,
idempotência da aula vista, gate de gestão e ausência de caminho de conclusão.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS; Next.js 15 (App Router) — mesma stack das Fases 1–2 (decisão do PO: "mesma stack")

**Primary Dependencies**: somente as já existentes (Drizzle, pg, iron-session, Zod,
lucide-react, react-markdown + remark-directive, Vitest). **Nenhuma dependência
nova**: o player usa a YouTube IFrame Player API carregada por um client component
próprio (R1); a descrição de aula reusa `sanitizarMarkdown` + `MarkdownTopico` da 002

**Storage**: PostgreSQL 16 (mesmo banco/RLS) — migração `0004_ead` com 8 tabelas:
`ead_modulo`, `aula`, `progresso_aula`, `inscricao_ead` (operacionais nesta fase) +
`prova`, `questao`, `tentativa`, `certificado` (alicerce, sem fluxo); migração
`0005_ead-rls` com as policies. Checks do escopo §10 desde já (`interno`/
`tema_interno`, FK dupla exclusiva em `prova`)

**Testing**: Vitest contra Postgres real (infra das fases anteriores). Suíte crítica
nova: `tests/ead.test.ts` — isolamento por usuário (progresso/inscrição via RLS),
idempotência da marcação de aula vista, inscrição única por usuário×produto,
nenhum caminho desta fase grava `status = 'concluido'` (SC-003), gate de gestão
negando suporte/padrão. `tests/rls.test.ts` estendido para as novas tabelas.
Testes de conclusão imutável e positivado acompanham a v2 (FR-016)

**Target Platform**: idêntico às fases anteriores (Linux on-prem via Docker Compose; web responsivo)

**Project Type**: web full-stack em projeto único (mesmo repo/app)

**Performance Goals**: trilha server-render <300ms em rede local (padrão das fases
anteriores); marcação de aula vista percebida como instantânea (<500ms do evento
`ended` ao % atualizado); cálculo de % por consulta agregada simples (sem coluna
armazenada)

**Constraints**: decisões travadas (escopo §6.2 + clarify 2026-06-11): YouTube não
listado com seek liberado (trade-off de link aceito); % é indicador vivo derivado,
nunca armazenado nem >100%; inscrição é pré-condição de qualquer progresso; conclusão
**inexiste nesta fase** (nem por 100% de aulas); alicerce não pode exigir refatoração
ao ligar a v2 (FR-013/SC-006); sem estado de rascunho para módulos/aulas

**Scale/Scope**: ~5 superfícies (trilha do produto, página de aula com player,
gestão de módulos, gestão de aulas, botão/fluxo de inscrição embutido na trilha),
8 tabelas novas (4 operacionais + 4 alicerce), 1 route handler de progresso +
ações de servidor, seed estendido com 1 EAD completo (§7.1 do escopo)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Avaliação |
|---|---|---|
| I | Separar dado de regra | ✅ Aula vista, inscrição e datas são fatos gravados; % é cálculo derivado em consulta única (nunca armazenado); permissão de gestão decidida no servidor (RLS + gate de papel), não nas telas |
| II | Autorização via RLS, contexto em toda transação | ✅ As 8 tabelas novas ganham policies RLS (`0005_ead-rls`); toda query via `withUser`/`withSystem` existentes; progresso e inscrição são own-row por `app.user_id` |
| III | Conteúdo interno nunca sai do servidor (NÃO NEGOCIÁVEL) | ✅ `descricao_md` de aula passa pela MESMA `sanitizarMarkdown(md, papel)` da 002 antes de sair do servidor (R6) — reuso da função única; nenhum markdown novo trafega sem ela |
| IV | Conclusão é fato imutável | ✅ Nesta fase, por decisão do PO, **nenhuma conclusão é gravada** (FR-011/FR-014); os campos `status`/`data_conclusao` nascem prontos para a regra imutável da v2 (FR-013), e o teste de imutabilidade move com ela (FR-016). Nenhum caminho de código pode escrever `concluido` — coberto por teste |
| V | Produto é dimensão suprema | ✅ EAD do cliente é por produto (check `interno = false → produto_id NOT NULL`); trilha filtra pelo produto ativo do seletor; `tema_interno` modelado como exceção declarada para o EAD interno futuro |
| VI | Papel nasce na origem; permissão no servidor | ✅ Gestão = dev/master com gate em toda action/route + policy RLS de escrita; esconder telas é cortesia. Progresso/inscrição exigem sessão e gravam só no próprio usuário |
| VII | Reaproveitar antes de criar | ✅ Casca, sessão, helper RLS, seletor de produto, `sanitizarMarkdown`, `MarkdownTopico`, infra de teste e padrão de actions da 002 reutilizados; player é o único componente novo de integração; modelo já serve o EAD interno (v2+) sem refatorar |
| VIII | Tudo operável pela interface | ✅ Módulos e aulas têm CRUD por tela (dev). As entidades do alicerce (prova/questão/tentativa/certificado) não têm tela NESTA fase porque não têm operação nesta fase — o fluxo inteiro é a v2 do módulo (decisão de fase do PO, registrada no clarify); a v2 nasce com os CRUDs correspondentes |
| IX | Nascida para evoluir | ✅ Migrações versionadas `0004_ead`/`0005_ead-rls`; CHANGELOG; seed com 1 EAD completo (requisito do §7.1); testes críticos da fase (RLS, idempotência, ausência de conclusão); pontos de extensão modelados desligados (alicerce, `interno`/`tema_interno`/`nivel`) |
| X | v1 de pé | ✅ Prova/conclusão/certificado/positivado adiados explicitamente como marco próprio (v2 do módulo); sem rascunho, sem reciclagem; fase entrega consumo + alicerce coesos |
| XI | Human in the loop | ✅ Fase 002 aceita pelo PO; spec 003 passou por clarify (2 decisões do PO em 2026-06-11, incluindo o corte de escopo); conflito spec×input do plano resolvido com o PO antes deste plano; PO valida via quickstart |

**Resultado pré-Phase 0**: PASS.

**Resultado pós-Phase 1**: PASS — data-model e contracts mantêm os princípios;
nenhuma entrada na Complexity Tracking. Atenção registrada: a policy RLS de
`progresso_aula`/`inscricao_ead` precisa permitir leitura agregada futura pelo
Master (métricas v2) — modelada desde já como policy de leitura por papel (R7),
sem código morto.

## Project Structure

### Documentation (this feature)

```text
specs/003-ead-cliente/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── internal-api.md  # Superfície HTTP/actions desta feature
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (shell)/ead/
│   │   ├── page.tsx                    # Trilha do produto ativo (módulos→aulas,
│   │   │                               #   botão Iniciar EAD, % em andamento)
│   │   ├── aula/[id]/page.tsx          # Página da aula: player + descrição saneada
│   │   ├── gestao/page.tsx             # CRUD de módulos e aulas (gate dev+)
│   │   └── componentes/                # TrilhaEad, CartaoModulo, ListaAulas,
│   │                                   # PlayerYouTube (client), GestaoEad
│   └── api/
│       └── ead/progresso/route.ts      # POST {aulaId} — marca aula vista (idempotente)
├── lib/
│   ├── ead/
│   │   ├── progresso.ts                # % vivo (consulta agregada), aulas vistas
│   │   ├── trilha.ts                   # módulos+aulas do produto, ant/próx aula
│   │   └── youtube.ts                  # extração/validação de ID do YouTube (Zod)
│   └── actions/
│       ├── inscricoes.ts               # iniciarEad (1 ativa por usuário×produto)
│       └── ead-gestao.ts               # CRUD módulo/aula (gate dev+)
drizzle/0004_ead.sql                    # 8 tabelas + checks (gerada + ajustes)
drizzle/0005_ead-rls.sql                # policies RLS custom
scripts/seed.ts                         # estendido: 1 EAD completo (§7.1)
tests/
├── ead.test.ts                         # REGRAS CRÍTICAS da fase (ver Technical Context)
└── rls.test.ts                         # estendido p/ as 8 tabelas novas
```

**Structure Decision**: mesma estrutura das fases anteriores (projeto único
Next.js). Lógica de domínio do EAD em `src/lib/ead/`; mutações por server actions
(`inscricoes.ts`, `ead-gestao.ts`) exceto a marcação de progresso, que é um route
handler `POST` chamado pelo client component do player (evento `ended` não nasce de
formulário). O alicerce da avaliação vive apenas em `schema.ts` + migrações.

## Dependências abertas (não bloqueiam o design)

- Vídeos reais (YouTube não listado) são cadastrados pelo dev após a implementação;
  o seed usa IDs de vídeos públicos quaisquer para validação local.
- Direção técnica da v2 (prova/conclusão/certificado/positivado) registrada em
  research R9 — não gera código nesta fase.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

(vazio — nenhuma violação)
