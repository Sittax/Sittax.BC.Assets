# Implementation Plan: Base de Conhecimento — Conteúdo, Blocos Internos, Edição, Busca e Import

**Branch**: `002-base-conhecimento` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-base-conhecimento/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Módulo Base de Conhecimento sobre a fundação da Feature 001: hierarquia
`Produto → Módulo → Tópico (→ subtópicos, máx. 5 níveis)` com markdown como texto no
Postgres; leitura com árvore lateral recolhível, breadcrumb e Anterior/Próximo;
blocos `:::nota-interna`/`:::nota-tecnica` (só suporte+) e `:::video`, com
**sanitização server-side em função única** (unified/remark + remark-directive) usada
por TODO endpoint que devolve conteúdo — inclusive a **busca** (que entra nesta fase,
operando sobre coluna derivada já saneada para papel padrão); edição de texto
(Milkdown) e árvore por suporte/dev com validação de permissão por directive no save;
imagens no MinIO via SDK S3 servidas por rota autenticada; importador de vault
Obsidian (motor único usado pela tela de upload e por script CLI). Testes Vitest
obrigatórios: sanitização (página + busca, padrão × suporte, isolamento por produto)
e validação por directive no save.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS; Next.js 15 (App Router) — mesma stack da Fase 1

**Primary Dependencies**: já existentes (Drizzle, pg, iron-session, Zod, lucide-react) +
novos: `unified`/`remark-parse`/`remark-stringify`/`remark-directive` (pipeline de
sanitização e validação no servidor), `react-markdown` + `remark-directive`
(renderização no cliente sobre MD já saneado), `@milkdown/*` (editor de blocos
markdown-nativo com menu `/`), `@aws-sdk/client-s3` (MinIO), `adm-zip` (vault .zip no
import), `gray-matter` (frontmatter), `github-slugger` (slugs)

**Storage**: PostgreSQL 16 (mesmo banco/RLS da Fase 1) — novas tabelas `modulo`,
`topico` (com coluna derivada `conteudo_publico` gerada pela função única de
sanitização + colunas tsvector para busca FTS) e `arquivo`; binários de imagem no
MinIO (compose já provisiona), bucket configurado por env

**Testing**: Vitest contra Postgres real (infra de teste da Fase 1 reaproveitada).
Suítes críticas novas: `tests/sanitizacao.test.ts` (Princípio III — página e busca,
papel padrão × suporte+, isolamento por produto, directive malformada fail-closed) e
`tests/directives-save.test.ts` (suporte bloqueado em `nota-tecnica`, dev liberado,
nota-tecnica pré-existente inalterada não bloqueia). `tests/rls.test.ts` estendido
para as novas tabelas

**Target Platform**: idêntico à Fase 1 (Linux on-prem via Docker Compose; web responsivo)

**Project Type**: web full-stack em projeto único (mesmo repo/app da Fase 1)

**Performance Goals**: tópico server-render <300ms em rede local (SC-005); busca <1s
no acervo da fase (SC-008, milhares de tópicos — FTS com índice GIN); import de vault
real (centenas de arquivos) em minutos com relatório

**Constraints**: decisões do PO travadas no clarify (não reabrir): markdown texto no
Postgres; sanitização unified/remark+remark-directive em função única; Milkdown;
react-markdown no front; imagens filesystem/MinIO servidas pelo app. Débito v1
aceito: imagem em nota interna acessível por URL direta a qualquer logado (FR-021,
roadmap v2). Profundidade máx. 5 níveis de tópico. Exclusões só de nós vazios

**Scale/Scope**: ~6 telas/superfícies (leitura da Base, editor, gerência de árvore,
resultados de busca, upload/serve de imagem, tela de import), 3 tabelas novas,
2 route handlers de API + ações de servidor, 1 motor de import com CLI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Avaliação |
|---|---|---|
| I | Separar dado de regra | ✅ Conteúdo (markdown) é dado; visibilidade de bloco interno decidida só na função única de sanitização + RLS; permissão por directive validada num único validador no save |
| II | Autorização via RLS, contexto em toda transação | ✅ Novas tabelas com policies RLS; toda query via `withUser`/`withSystem` existentes; nenhuma query fora do helper. Nota R6: RLS é por linha — a defesa de coluna (`conteudo_md` completo) é a disciplina do helper + função única, documentada |
| III | Conteúdo interno nunca sai do servidor (NÃO NEGOCIÁVEL) | ✅ `sanitizarMarkdown(md, papel)` única, server-side, exportada e testada; busca de papel padrão opera SÓ sobre `conteudo_publico` (coluna derivada gerada pela MESMA função no save); teste automatizado bloqueante cobre página + busca + isolamento por produto (FR-013/SC-001/SC-007) |
| IV | Conclusão é fato imutável | ✅ N/A nesta fase (sem EAD) |
| V | Produto é dimensão suprema | ✅ Todo módulo/tópico pertence a um produto; árvore, leitura e busca filtram pelo produto ativo; sem conteúdo "global" |
| VI | Papel nasce na origem; permissão no servidor | ✅ Papéis da Fase 1 reutilizados; gates server-side (edição suporte/dev, leitura autenticada); validação por directive no servidor, nunca só no editor |
| VII | Reaproveitar antes de criar | ✅ Casca, sessão, helper RLS, seletor de produto e infra de teste da Fase 1 reutilizados; um único motor de import (tela + CLI); uma única função de sanitização |
| VIII | Tudo operável pela interface | ✅ Edição de texto/árvore e import via telas (suporte/dev); o script CLI de import é conveniência adicional, nunca o único caminho |
| IX | Nascida para evoluir | ✅ Migração Drizzle versionada (`0002_conteudo` + policies), CHANGELOG, seeds de conteúdo dev, testes críticos obrigatórios (sanitização e directives-save) |
| X | v1 de pé | ✅ Sem versionamento/histórico, sem rascunho, busca simples FTS (sem ranking sofisticado), import sem merge — adiamentos explícitos na spec |
| XI | Human in the loop | ✅ Fase 1 aceita pelo PO (2026-06-10); spec passou por clarify; PO valida esta fase ao final via quickstart |

**Resultado pré-Phase 0**: PASS.

**Resultado pós-Phase 1**: PASS — design (data-model, contracts) mantém os princípios;
nenhuma entrada na Complexity Tracking. O ponto de atenção R6 (RLS é por linha, não
por coluna) está documentado no research com a mitigação em camadas.

## Project Structure

### Documentation (this feature)

```text
specs/002-base-conhecimento/
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
│   ├── (shell)/base/
│   │   ├── page.tsx                  # Raiz da Base (estado vazio / 1º tópico do produto)
│   │   ├── [slug]/page.tsx           # Leitura de tópico (árvore + breadcrumb + ant/prox)
│   │   ├── [slug]/editar/page.tsx    # Editor Milkdown (gate suporte+)
│   │   └── componentes/              # ArvorePainel, Breadcrumb, AnteriorProximo,
│   │                                 # EditorTopico, GerenciaArvore, ResultadosBusca
│   ├── (shell)/base/importar/page.tsx # Tela de import Obsidian (gate suporte+)
│   └── api/
│       ├── busca/route.ts            # GET ?q= — resultados saneados por papel
│       ├── arquivos/route.ts         # POST upload (suporte+)
│       ├── arquivos/[id]/route.ts    # GET autenticado (streaming do MinIO)
│       └── importar-obsidian/route.ts# POST zip (suporte+) → relatório
├── lib/
│   ├── conteudo/
│   │   ├── sanitizar.ts              # FUNÇÃO ÚNICA sanitizarMarkdown(md, papel)
│   │   ├── directives.ts             # extração/comparação de nota-tecnica p/ save
│   │   ├── arvore.ts                 # profundidade (≤5), ciclo, ordem, mover
│   │   ├── slug.ts                   # slugs únicos por produto
│   │   ├── busca.ts                  # consulta FTS por papel/produto
│   │   └── importer.ts               # motor Obsidian (zip → hierarquia → Drizzle)
│   ├── storage/minio.ts              # cliente S3 + put/get streaming
│   └── actions/
│       ├── topicos.ts                # salvar (valida directives), criar, mover, excluir
│       └── modulos.ts                # criar, renomear, reordenar, excluir (vazio)
├── components/markdown/
│       └── MarkdownTopico.tsx        # react-markdown + remark-directive (MD já saneado)
scripts/import-obsidian.ts            # CLI reusa src/lib/conteudo/importer.ts
drizzle/0002_conteudo.sql             # tabelas + tsvector/GIN (gerada)
drizzle/0003_conteudo-rls.sql         # policies RLS custom
tests/
├── sanitizacao.test.ts               # REGRA CRÍTICA (Princípio III)
├── directives-save.test.ts           # REGRA CRÍTICA (permissão por bloco)
└── rls.test.ts                       # estendido p/ modulo/topico/arquivo
```

**Structure Decision**: mesma estrutura da Fase 1 (projeto único Next.js). Toda a
lógica de conteúdo vive em `src/lib/conteudo/` com a função de sanitização como
módulo próprio e importável (testável isoladamente e único ponto de saída de
conteúdo); UI consome via páginas server-rendered e actions.

## Dependências abertas (não bloqueiam o design)

- Conteúdo real (vault Obsidian da empresa) entra após a implementação, via tela de
  import — o quickstart usa uma vault de fixture.
- Variáveis de ambiente novas do MinIO documentadas no `.env.example` (R4).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

(vazio — nenhuma violação)
