# Quickstart — Base de Conhecimento

Guia de validação ponta a ponta da Feature 002. Schema em
[data-model.md](./data-model.md); endpoints em
[contracts/internal-api.md](./contracts/internal-api.md). Pressupõe a Feature 001
aceita e o ambiente do quickstart dela funcionando.

## Setup

```bash
docker compose up -d postgres minio
# .env: adicionar MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY,
#       MINIO_BUCKET, MINIO_FORCE_PATH_STYLE (ver .env.example)
npm install
npm run db:migrate          # 0002_conteudo + 0003_conteudo-rls
npm run db:seed             # + módulos/tópicos de exemplo (notas internas, video)
npm run dev                 # http://localhost:3000
```

## Cenários de validação

### V1 — Leitura e navegação (US1)

1. Logar (qualquer papel) e abrir a Base com o produto 1 ativo.
2. Esperado: árvore no painel lateral (tópico atual destacado, ancestrais
   abertos); "Ocultar/Mostrar árvore" funciona; breadcrumb clicável;
   Anterior/Próximo percorre irmãos na ordem; `:::video` embutido.
3. Trocar o produto no seletor → árvore e conteúdo trocam; produto sem conteúdo →
   estado vazio claro. Em janela móvel: árvore vira drawer no topo.

### V2 — Sanitização de blocos internos (US2 / SC-001)

1. Logar como papel padrão e abrir o tópico do seed com nota interna e técnica.
2. Esperado: nenhum vestígio do conteúdo interno — conferir inclusive o fonte da
   página/respostas de rede (zero bytes).
3. Logar como suporte: blocos visíveis com distinção visual (interna ≠ técnica).

### V3 — Busca por papel e por produto (US6 / SC-007)

1. Como padrão, buscar um termo que só existe dentro de nota interna do seed.
2. Esperado: zero resultados (sem título, trecho ou contagem). Como suporte: o
   resultado aparece com trecho.
3. Com produto 1 ativo, buscar termo que só existe no produto 2 → zero
   resultados. Termo comum → resultados clicáveis abrem o tópico.

### V4 — Edição e permissão por directive (US3 / SC-002)

1. Como suporte, editar um tópico no Milkdown (menu `/`): alterar texto e criar
   `:::nota-interna` → salvar OK; tentar criar/alterar `:::nota-tecnica` →
   rejeição com mensagem clara, nada persistido.
2. Editar página que JÁ tem nota técnica sem tocá-la → salvar OK.
3. Como dev, criar/alterar `:::nota-tecnica` → OK.
4. Gerência da árvore: criar/renomear/mover/reordenar módulos e tópicos; mover
   para o próprio descendente → rejeitado; criar no 6º nível → rejeitado;
   excluir tópico com filhos ou módulo com tópicos → orientação.
5. Como papel padrão: `/base/{slug}/editar` e `/base/importar` → 404.

### V5 — Imagens (US4)

1. Como suporte, subir imagem pelo editor → aparece renderizada no tópico.
2. Copiar a URL `/api/arquivos/{id}`: em janela anônima (sem sessão) → negado;
   logado com qualquer papel → serve (débito v1 registrado).

### V6 — Import Obsidian (US5 / SC-004)

1. Zipar a vault de fixture (subpastas, frontmatter, `[[wikilinks]]`, imagens,
   pasta com 7 níveis) e importar em `/base/importar` para o produto 2.
2. Esperado: hierarquia preservada (além de 5 níveis: achatado com aviso);
   wikilinks viram links internos navegáveis (quebrados → texto + aviso);
   imagens migradas para o MinIO e renderizando; relatório com totais e avisos.
3. (Opcional) `npx tsx scripts/import-obsidian.ts <pasta> <produtoId>` produz o
   mesmo resultado via CLI.

## Testes automatizados (regras críticas — Constituição III e IX)

```bash
docker compose up -d postgres
npm run test    # + tests/sanitizacao.test.ts, tests/directives-save.test.ts,
                #   tests/rls.test.ts estendido
```

**Esperado: 100% verde antes de qualquer validação manual.** O teste de
sanitização é bloqueante: página E busca, papel padrão × suporte+, isolamento por
produto e directive malformada fail-closed.
