# Research — Base de Conhecimento

Decisões da Phase 0. As escolhas de stack travadas pelo PO no clarify (markdown no
Postgres, unified/remark+remark-directive, Milkdown, react-markdown, MinIO) não são
reavaliadas aqui — este documento fecha o COMO de cada uma.

## R1. Função única de sanitização (Princípio III)

- **Decision**: `sanitizarMarkdown(md: string, papel: Papel): string` em
  `src/lib/conteudo/sanitizar.ts` — pipeline `unified()` + `remark-parse` +
  `remark-directive` + transformador próprio + `remark-stringify`. O transformador
  remove do AST todo nó `containerDirective` com nome `nota-interna` ou
  `nota-tecnica` quando `papel === 'padrao'`; para suporte+ os nós passam intactos.
  A função é **pura** (string → string), exportada e coberta por teste. TODO ponto
  de saída de conteúdo a consome: render de página, geração da coluna derivada
  `conteudo_publico` (R3) e, por consequência, a busca.
- **Fail-closed (FR-014)**: pelo `remark-directive`, um container `:::` sem fence de
  fechamento engole o conteúdo até o fim do bloco pai — ou seja, conteúdo sob
  directive malformada continua DENTRO do nó removido (nunca vaza). Teste cobre o
  caso explícito.
- **Rationale**: AST em vez de regex — remoção estrutural não é enganável por
  variações de sintaxe; uma função, um teste, um ponto de auditoria.
- **Alternatives considered**: regex sobre o texto (frágil, contornável); filtrar no
  cliente (proibido pela constituição); sanitizar por endpoint (duplicação que o
  Princípio III veta).

## R2. Validação de permissão por directive no save

- **Decision**: `extrairNotasTecnicas(md): string[]` em
  `src/lib/conteudo/directives.ts` — parseia o AST e serializa cada nó
  `nota-tecnica` normalizado. No save de **suporte**: compara o multiconjunto de
  notas técnicas do markdown novo com o do markdown atual do tópico; qualquer
  diferença (criou, alterou, moveu conteúdo interno do bloco, excluiu) → rejeição
  com mensagem clara, nada persiste. Dev e Master: sem restrição. A comparação é
  por conteúdo serializado, não por posição — suporte pode editar o resto da
  página livremente (cenário 3 da US3).
- **Rationale**: o editor é texto livre (Milkdown ou colagem); só o servidor decide.
  Comparar multiconjuntos é simples, determinístico e testável.
- **Alternatives considered**: diff posicional (frágil a reordenação legítima);
  bloquear qualquer save com nota-tecnica presente (impede suporte de editar
  páginas que já têm nota técnica — viola cenário 3).

## R3. Busca por papel — coluna derivada + Postgres FTS

- **Decision**: `topico` guarda `conteudo_md` (fonte) e `conteudo_publico`
  (derivada: `sanitizarMarkdown(conteudo_md, 'padrao')`, recalculada em TODO
  save/import pela MESMA função do R1). Busca full-text nativa do Postgres
  (config `portuguese`): colunas geradas `tsv_publico = to_tsvector(titulo +
  conteudo_publico)` e `tsv_completo = to_tsvector(titulo + conteudo_md)`, ambas
  com índice GIN. A consulta (em `src/lib/conteudo/busca.ts`, via `withUser`)
  seleciona o vetor conforme o papel: padrão → `tsv_publico` e trecho
  (`ts_headline`) sobre `conteudo_publico`; suporte+ → `tsv_completo` sobre
  `conteudo_md`. Filtro obrigatório por `produto_id` do produto ativo (FR-028).
- **Rationale**: para papel padrão, o termo interno **não existe no universo
  pesquisado** — não há resultado, trecho nem contagem a vazar (FR-029/SC-007);
  manter a derivação na mesma função única preserva o Princípio III sem segundo
  pipeline. FTS nativa atende <1s na escala (SC-008) sem dependência externa.
- **Alternatives considered**: sanitizar resultados na hora da busca (executa o
  pipeline a cada query — caro e fácil de esquecer num endpoint novo); motor
  externo (Elastic/Meili — infra a mais, contra o on-prem enxuto); ILIKE simples
  (sem ranking/trecho; FTS custa o mesmo aqui).

## R4. Imagens — MinIO via SDK S3, servidas pelo app

- **Decision**: cliente `@aws-sdk/client-s3` em `src/lib/storage/minio.ts`
  (endpoint/credenciais/bucket por env: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`,
  `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_FORCE_PATH_STYLE=true`). Upload:
  `POST /api/arquivos` (multipart, gate suporte+ editor), registra metadados na
  tabela `arquivo` e devolve a URL interna `/api/arquivos/{id}`. Serve:
  `GET /api/arquivos/{id}` exige sessão válida (qualquer papel) e faz streaming do
  objeto com `content-type` correto. Débito v1 (FR-021): o serve NÃO checa papel —
  registrado no roadmap (escopo §9) para v2 (flag `interna` + checagem).
- **Rationale**: o app é o único ponto de saída (bucket privado, nunca exposto);
  URL estável por id permite a correção de v2 sem reescrever conteúdo.
- **Alternatives considered**: URL pré-assinada do MinIO (expira e vaza fora do
  controle de sessão do app); filesystem local (compose já tem MinIO e ele resolve
  backup/volume melhor).

## R5. Importador Obsidian — motor único, tela + CLI

- **Decision**: motor em `src/lib/conteudo/importer.ts`: recebe a vault como zip
  (buffer) + produto destino; percorre entradas com `adm-zip`; pastas → módulos
  (1º nível) e subpastas/arquivos → tópicos/subtópicos (achatando além de 5 níveis,
  com aviso); `gray-matter` lê frontmatter (título; demais campos ignorados);
  `[[wikilinks]]` resolvidos por nome de arquivo → link interno `/base/{slug}`
  (sem destino → texto simples + aviso); imagens referenciadas migradas ao MinIO e
  referências reescritas; tudo inserido via Drizzle dentro do contexto RLS;
  devolve relatório `{topicos, imagens, avisos[]}`. Consumidores: tela
  `/base/importar` (upload zip, gate suporte/dev — Princípio VIII) e script
  `scripts/import-obsidian.ts` (CLI lê pasta local, zipa em memória e chama o
  mesmo motor via `withSystem`; conveniência para cargas grandes).
- **Rationale**: um motor, dois invólucros — sem duplicação; zip é o formato
  natural de "pasta pela interface" no navegador.
- **Alternatives considered**: só CLI (violaria Princípio VIII); upload de
  diretório via API do navegador (suporte irregular entre browsers; zip é trivial
  de gerar no Obsidian/SO).

## R6. RLS das novas tabelas e o limite de coluna

- **Decision**: policies por papel — `modulo`/`topico`: SELECT para qualquer papel
  autenticado; INSERT/UPDATE/DELETE para suporte, dev, master e system (import via
  CLI); `arquivo`: SELECT qualquer autenticado (débito v1 do serve), INSERT
  suporte/dev/master/system. **Limite documentado**: RLS é por LINHA — uma sessão
  padrão com acesso SQL direto à linha de `topico` veria `conteudo_md` completo.
  Mitigação em camadas: (1) nenhuma query existe fora do helper `withUser` (já é
  defeito bloqueante pelo Princípio II); (2) o código de leitura para papel padrão
  seleciona apenas `conteudo_publico`/`tsv_publico` — selecionar `conteudo_md` em
  caminho de papel padrão é defeito bloqueante de review desta feature; (3) a
  saída HTTP passa pela função única de qualquer forma. O Princípio III é
  garantido na fronteira do servidor, que é onde ele se aplica.
- **Alternatives considered**: separar `conteudo_md` em tabela própria com policy
  SELECT só suporte+ (mais forte, porém quebra `tsv_completo`/joins e complica o
  save; reavaliar se a disciplina do item 2 falhar em review); GRANT por coluna
  (exigiria segunda role de conexão — complexidade de pool sem ganho real agora).

## R7. Rotas e identidade do tópico — slug por produto

- **Decision**: `topico.slug` único por produto (`UNIQUE(produto_id, slug)`),
  gerado do título com `github-slugger` (colisão → sufixo `-2`, `-3`…); rota de
  leitura `/base/[slug]` resolve dentro do produto ativo. URL direta de tópico de
  outro produto: a página resolve o produto dono do slug e **o seletor passa a ser
  esse produto** (edge case da spec; o seletor é a dimensão, a URL identifica o
  conteúdo). `topico.produto_id` é denormalizado (igual ao do módulo) para
  sustentar o UNIQUE, o filtro de busca e as policies com simplicidade — a action
  de mover mantém a consistência (único ponto de escrita da árvore).
- **Alternatives considered**: rota por UUID (URLs feias, wikilinks do import sem
  correspondência natural); slug global único (colisões entre produtos
  inevitáveis no import).

## R8. Árvore — profundidade, ciclo e ordenação

- **Decision**: regras da árvore concentradas em `src/lib/conteudo/arvore.ts`,
  consumidas pelas actions (único ponto de escrita): profundidade calculada
  subindo os pais (máx. **5 níveis** de tópico abaixo do módulo — criar/mover além
  rejeita com orientação); mover para descendente de si mesmo rejeita (anti-ciclo);
  `ordem` inteira por nível com reordenação em lote; exclusão só de tópico sem
  filhos e módulo sem tópicos (FR-018; FKs `RESTRICT` no banco como defesa).
- **Rationale**: escala pequena → validação na aplicação com FK RESTRICT por baixo
  é suficiente e testável; trigger plpgsql seria segunda implementação da mesma
  regra (Princípio I).
- **Alternatives considered**: trigger de profundidade/ciclo no banco (duplica
  regra); ltree (poder a mais para 5 níveis).

## R9. Milkdown com directives e menu "/"

- **Decision**: Milkdown (`@milkdown/core` + `preset-commonmark` + `plugin-slash`)
  — ele é remark-based, então `remark-directive` entra como plugin de sintaxe, com
  nós customizados para `nota-interna`/`nota-tecnica`/`video` renderizados como
  blocos destacados no editor; itens do menu `/` inserem os três blocos (o item
  `nota-tecnica` só aparece para dev/master — cortesia; a regra é o R2 no save).
  O editor salva markdown puro (fonte da verdade); nada do editor afeta segurança.
- **Rationale**: decisão do PO; Milkdown fala remark nativamente — mesma gramática
  do pipeline do servidor, sem conversões.
- **Alternatives considered**: textarea + preview (UX pobre para o time de
  suporte); TipTap (não é markdown-nativo; conversão md↔json adiciona risco).

## R10. Renderização na leitura

- **Decision**: página de tópico server-rendered busca `conteudo_md`, aplica
  `sanitizarMarkdown(md, papel)` no servidor e entrega o MD saneado ao componente
  cliente `MarkdownTopico` (`react-markdown` + `remark-directive`), que mapeia:
  `nota-interna`/`nota-tecnica` → blocos com distinção visual (só chegam para
  suporte+); `video` → embed de iframe (mesma premissa de vídeo não listado do
  escopo §6.2). Nenhum HTML bruto habilitado (sem `rehype-raw`) — markdown puro.
- **Rationale**: o cliente nunca recebe o que não pode ver; react-markdown é a
  decisão do PO e não interpreta HTML por padrão (XSS contido).

## R11. Testes das regras críticas

- **Decision**: reaproveita a infra da Fase 1 (`tests/helpers/db.ts`, Postgres do
  compose, `central_test`). `tests/sanitizacao.test.ts`: unitários da função única
  (padrão remove, suporte mantém, malformada fail-closed) + integração: tópico com
  nota interna/técnica lido como padrão → zero bytes internos; busca como padrão
  por termo só-interno → zero resultados/trechos; busca com produto X não retorna
  tópico do produto Y; suporte+ encontra tudo. `tests/directives-save.test.ts`:
  suporte cria/altera/exclui nota-tecnica → rejeitado; nota-tecnica pré-existente
  inalterada + edição do resto → aceito; dev → aceito. `tests/rls.test.ts` ganha
  matriz das novas tabelas. MinIO nos testes: motor de import recebe a interface
  de storage injetada (fake em memória) — o streaming real é validado no
  quickstart.
- **Rationale**: Princípio IX manda teste nas regras críticas; storage fake evita
  dependência do MinIO em CI sem perder a cobertura da regra de negócio.
