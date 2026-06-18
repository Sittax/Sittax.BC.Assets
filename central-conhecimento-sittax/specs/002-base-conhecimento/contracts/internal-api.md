# Contracts — Superfície interna da Base de Conhecimento

Toda entrada validada com Zod; toda operação revalida sessão + papel no servidor e
roda via `withUser`/`withSystem` (Fase 1). **Regra transversal**: qualquer resposta
que contenha conteúdo de tópico passa por `sanitizarMarkdown(md, papel)` — função
única (R1). Páginas server-rendered são parte do contrato de saída.

## Páginas (server-rendered, dentro da casca)

| Rota | Papel | Comportamento |
|---|---|---|
| `/base` | autenticado | Árvore do produto ativo; redireciona ao 1º tópico (ordem) ou estado vazio |
| `/base/[slug]` | autenticado | Tópico (MD saneado por papel) + árvore + breadcrumb + Anterior/Próximo; slug de outro produto → seletor passa ao produto dono (R7); slug inexistente → 404 |
| `/base/[slug]/editar` | suporte+ | Editor Milkdown; papel padrão → 404 (R6 da Fase 1) |
| `/base/importar` | suporte+ | Upload de zip da vault + relatório; papel padrão → 404 |

## Route Handlers

### GET /api/busca?q={termo}

Busca no produto ativo da sessão (FR-028/FR-029). Exige sessão.

| Caso | Resposta |
|---|---|
| 200 | `{ resultados: [{ slug, titulo, trecho }] }` — padrão: só `tsv_publico`/`conteudo_publico`; suporte+: `tsv_completo`; SEMPRE filtrado por `produto_id` ativo |
| 200 (sem ocorrência) | `{ resultados: [] }` |
| 400 | termo < 3 caracteres (`{ erro: "termo_curto" }`) |
| 401 | sem sessão |

Nunca inclui resultado, trecho ou contagem de outro produto, nem byte interno para
papel padrão (teste bloqueante — FR-013).

### POST /api/arquivos (suporte+)

Multipart `file` (image/*, ≤ 10 MB). 201 → `{ id, url: "/api/arquivos/{id}" }`;
400 tipo/tamanho inválido; 403 papel padrão.

### GET /api/arquivos/{id}

Exige apenas sessão válida (débito v1 — FR-021). 200 streaming com `content-type`
do upload; 401 sem sessão; 404 id inexistente.

### POST /api/importar-obsidian (suporte+)

Multipart `vault` (zip, ≤ 100 MB) + `produtoId`. 200 →
`{ topicos, imagens, avisos: string[] }` (relatório FR-026); 400 zip/produto
inválido; 403 papel padrão. CLI `scripts/import-obsidian.ts` reusa o mesmo motor.

## Server Actions (`src/lib/actions/`)

Todas revalidam papel ∈ {suporte, dev, master} (exceto onde indicado) e devolvem
`{ ok, mensagem? }` (padrão da Fase 1).

### topicos.ts

| Action | Entrada (Zod) | Regras |
|---|---|---|
| `salvarTopico` | `{ id, titulo?, conteudoMd }` | valida directives por papel (R2): suporte com mudança em `nota-tecnica` → rejeita com mensagem clara; regenera `conteudo_publico` na MESMA transação (R3); reslug se título mudou |
| `criarTopico` | `{ moduloId, parentId?, titulo }` | valida profundidade ≤5 (R8); slug único por produto |
| `moverTopico` | `{ id, novoModuloId?, novoParentId?, novaOrdem }` | anti-ciclo + profundidade; `novoModuloId` MUST pertencer ao MESMO produto do tópico (mover entre produtos → rejeitado com orientação; caminho é exportar/reimportar — FR-016) |
| `excluirTopico` | `{ id }` | só sem filhos; senão orientação |

### modulos.ts

| Action | Entrada | Regras |
|---|---|---|
| `criarModulo` / `renomearModulo` / `reordenarModulo` | `{ produtoId, nome }` / `{ id, nome }` / `{ id, novaOrdem }` | nome único por produto |
| `excluirModulo` | `{ id }` | só vazio; com tópicos → orientação (FR-018) |

## Contrato interno de sanitização (`src/lib/conteudo/sanitizar.ts`)

- `sanitizarMarkdown(md: string, papel: Papel): string` — pura; remove nós
  `nota-interna`/`nota-tecnica` quando papel = `padrao`; fail-closed em directive
  malformada (FR-014). É proibido (defeito bloqueante) devolver conteúdo de tópico
  por qualquer caminho que não a invoque ou não use coluna derivada dela.
- `extrairNotasTecnicas(md: string): string[]` — base da validação no save (R2).

## Contrato de UI (resumo; fonte: docs/layout-navegacao-claude-design.md §5/§6)

- Painel da árvore (~260px) dentro da Base, botões "Ocultar árvore"/"Mostrar
  árvore"; tópico atual destacado, ancestrais abertos; mobile: drawer/accordion.
- Breadcrumb `Produto › Módulo › Tópico` clicável; Anterior/Próximo entre irmãos.
- Blocos internos renderizados com distinção visual (suporte+); `:::video` como
  embed responsivo.
- Campo de busca da top bar habilitado: resultados (título + trecho) do produto
  ativo, clicáveis.
