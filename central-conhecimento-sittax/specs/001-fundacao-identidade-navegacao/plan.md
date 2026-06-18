# Implementation Plan: Fundação — Identidade, Sessão e Casca de Navegação

**Branch**: `001-fundacao-identidade-navegacao` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-fundacao-identidade-navegacao/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Fundação da Central de Conhecimento: autenticação contra os 6 sistemas Sittax via
endpoint SSO compartilhado (sequencial, sem orquestrador), espelhamento de papel por
mapeamento configurável, sessão própria em cookie httpOnly assinado (deslizante 7d +
teto 30d), casca de navegação (top bar + rail) com visibilidade por papel checada no
servidor, gerência do Master (escritórios, usuários só central, mapeamento de papéis) e
registro bruto de acesso. Abordagem técnica: um único projeto full-stack Next.js (App
Router) + TypeScript, PostgreSQL on-prem com RLS como camada única de autorização
(helper `withUser` com `SET LOCAL`), Drizzle ORM para schema/migrações versionadas,
deploy on-prem via Docker Compose, testes Vitest nas regras críticas (RLS por papel e
espelhamento).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS; Next.js 15 (App Router)

**Primary Dependencies**: Next.js, Drizzle ORM + drizzle-kit (schema/migrações), `pg`
(driver Postgres com pool), iron-session (cookie httpOnly assinado/criptografado),
Zod (validação de entrada), lucide-react (ícones do rail, conforme doc de layout)

**Storage**: PostgreSQL 16 on-prem (container Docker Compose). RLS habilitado nas
tabelas de negócio; policies leem `current_setting('app.user_id')` / `app.papel`.
Nenhuma query fora do helper `withUser(userId, papel, fn)` (transação + `SET LOCAL`)

**Testing**: Vitest. Suíte crítica desta fase: (1) RLS por papel — queries com contexto
de cada papel verificando visibilidade/negação; (2) fluxo de espelhamento — primeiro
login cria usuário/escritório, papel ressincroniza, fallback padrão p/ não mapeado,
bloqueio por CNPJ vazio. SSO de origem simulado com mock HTTP local nos testes

**Target Platform**: Servidor Linux on-prem via Docker Compose (app Next.js standalone +
Postgres + MinIO já provisionado para fases futuras). Web responsivo (desktop/tablet/
mobile), sem app nativo

**Project Type**: Web full-stack em projeto único (Next.js App Router serve UI e API)

**Performance Goals**: Login completo ≤10s no pior caso (teto total da tentativa SSO,
FR-029; timeout 3s/sistema configurável); navegação da casca com resposta percebida
instantânea (<300ms server-render em rede local); escala pequena (centenas de
escritórios, poucos milhares de usuários)

**Constraints**: Sem Supabase e sem serviços de nuvem externos; toda configuração por
variável de ambiente (6 URLs SSO, segredo de sessão, credenciais de banco, timeouts,
prazos de sessão); nenhuma credencial/URL real em código; homologação SSO para
desenvolvimento; tudo operável pela interface (zero SQL em operação de negócio)

**Scale/Scope**: ~10 telas (login, 5 placeholders de módulo, 4 telas de gerência),
6 tabelas de negócio + mapeamento, 1 integração externa (SSO dos 6 sistemas)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Avaliação |
|---|---|---|
| I | Separar dado de regra | ✅ Papel/contrato armazenados como fato; permissão decidida só nas policies RLS + checagem de sessão. Mapeamento role/nivel é dado (tabela), não código |
| II | Autorização via RLS, contexto em toda transação | ✅ Helper único `withUser` em `src/lib/db/rls.ts`; policies em migração SQL; teste automatizado de RLS por papel. Nenhuma query fora do helper (gate de review) |
| III | Conteúdo interno nunca sai do servidor | ✅ N/A nesta fase (não há markdown/conteúdo ainda). A fundação não cria nenhum endpoint que sirva conteúdo; a função única de sanitização nasce na fase da base de conhecimento |
| IV | Conclusão é fato imutável | ✅ N/A nesta fase (sem EAD). Nenhuma decisão aqui conflita; `acesso_log` é só registro bruto |
| V | Produto é dimensão suprema | ✅ Seletor global grudento modelado (`usuario.produto_selecionado_id`); EAD interno como exceção declarada (seletor desabilitado no módulo) |
| VI | Papel nasce na origem; permissão no servidor | ✅ Espelhamento a cada login; papel local só p/ origem `central`; toda tela/ação checa sessão+papel no servidor (layout server-side + RLS); esconder item do rail é cortesia |
| VII | Reaproveitar antes de criar | ✅ Fase de fundação — nada a reusar ainda; estrutura preparada p/ reuso (shell único, helper único) |
| VIII | Tudo operável pela interface | ✅ CRUD de escritórios, usuários só central e mapeamento de papéis para o Master; produtos e 1º Master via seed (exceção de bootstrap documentada na spec) |
| IX | Nascida para evoluir | ✅ Migrações Drizzle versionadas; `CHANGELOG.md` semântico; seeds de dev; config por env; testes críticos (RLS, espelhamento) |
| X | v1 de pé | ✅ Módulos como placeholders; nada ambicioso embutido (sem busca funcional, sem métricas) |
| XI | Human in the loop | ✅ Plano segue spec validada via clarify; PO valida esta fase antes da próxima |

**Resultado pré-Phase 0**: PASS (sem violações; III e IV não se aplicam ao escopo da fase).

**Resultado pós-Phase 1**: PASS — o design (data-model, contracts) mantém todas as
decisões dentro dos princípios; nenhuma entrada na Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-fundacao-identidade-navegacao/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── internal-api.md  # Superfície HTTP/actions da central (SSO externo: docs/sso-login-endpoint.md)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── login/page.tsx              # Tela de login (fora da casca)
│   ├── (shell)/                    # Layout autenticado: top bar + rail
│   │   ├── layout.tsx              # Carrega sessão, monta casca, visibilidade por papel
│   │   ├── dashboard/page.tsx      # Placeholder
│   │   ├── base/page.tsx           # Placeholder
│   │   ├── ead/page.tsx            # Placeholder
│   │   ├── atualizacoes/page.tsx   # Placeholder
│   │   ├── ead-interno/page.tsx    # Placeholder (gate suporte+ no servidor)
│   │   └── gerencia/               # Master only (gate no layout + RLS)
│   │       ├── layout.tsx
│   │       ├── escritorios/page.tsx
│   │       ├── usuarios/page.tsx
│   │       └── mapeamento/page.tsx
│   ├── api/auth/login/route.ts     # Login da central (chama SSO client)
│   └── api/auth/logout/route.ts
├── components/shell/               # TopBar, ProductSelector, Rail, AvatarMenu
├── lib/
│   ├── config.ts                   # Leitura/validação de env vars (Zod)
│   ├── db/
│   │   ├── client.ts               # Pool pg + drizzle
│   │   ├── schema.ts               # Schema Drizzle (fonte das migrações)
│   │   └── rls.ts                  # withUser(userId, papel, fn) — helper ÚNICO
│   ├── auth/
│   │   ├── sso-client.ts           # Sequência dos 6 sistemas, timeouts, classificação de falha
│   │   ├── mirror.ts               # Espelhamento usuário/escritório + tradução de papel
│   │   └── session.ts              # iron-session: criar/ler/renovar/destruir sessão
│   └── actions/                    # Server actions da gerência (CRUD)
drizzle/                            # Migrações SQL versionadas (inclui policies RLS)
scripts/seed.ts                     # Seeds dev: 2 escritórios, 4 usuários (1/papel), 6 produtos, mapa de papéis
tests/
├── rls.test.ts                     # RLS por papel (regra crítica, princípio IX)
└── espelhamento.test.ts            # Fluxo de espelhamento (mock HTTP do SSO)
docker-compose.yml                  # app + postgres + minio
.env.example                        # Todas as vars documentadas, sem valores reais
CHANGELOG.md
```

**Structure Decision**: Projeto único Next.js full-stack (Option 1 adaptada a App
Router). UI e API vivem no mesmo deploy; a separação de camadas é por diretório
(`lib/db`, `lib/auth`, `components`). RLS + `withUser` concentram autorização no banco;
os layouts do App Router fazem o gate de tela no servidor (cortesia + defesa em
profundidade, nunca a regra sozinha).

## Dependências abertas (não bloqueiam o design)

- **Conteúdo do mapa role/nivel → papel**: estrutura e fallback (padrão) já definidos
  na spec/data-model; o conteúdo real entra como seed/configuração quando o PO
  fornecer — editável depois pela tela de mapeamento do Master.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

(vazio — nenhuma violação)
