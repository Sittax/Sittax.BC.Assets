# Research — Feature 004: Dashboard, Release Notes e Eventos

Decisões técnicas da fase. Nenhum NEEDS CLARIFICATION restante no Technical Context.

## R1 — "Última aula acessada": tabela própria `aula_acesso`, nunca coluna em `inscricao_ead`

**Decision**: registrar o fato "usuário abriu a aula X" numa tabela own-row
`aula_acesso (usuario_id, aula_id, acessado_em)` com PK composta e upsert
`ON CONFLICT DO UPDATE SET acessado_em = now()`, gravado no render server-side da
página da aula (`/ead/aula/[id]`), dentro da transação `withUser` que a página já
abre. A retomada de um módulo = aula com `max(acessado_em)` entre as aulas do
módulo; fallback: primeira aula na ordem (usuário nunca abriu aula, ou a última
acessada foi removida — o `ON DELETE CASCADE` da FK para `aula` apaga o registro e o
fallback recai na próxima mais recente ou na primeira).

**Rationale**: a alternativa óbvia (colunas `ultima_aula_id`/`ultimo_acesso_em` em
`inscricao_ead`) exigiria abrir UPDATE na tabela de inscrição — cuja policy da Fase
003 nega UPDATE a TODOS justamente para materializar "nenhum caminho conclui/altera
inscrição" (SC-003 da 003, Constituição IV). Tabela própria preserva essa garantia
intacta e é own-row simples. "Acessada" ≠ "vista": `progresso_aula` registra o evento
`ended` do player (engajamento); `aula_acesso` registra abertura da página (retomada).
São fatos distintos com semânticas distintas — usar `max(vista_em)` levaria o usuário
de volta à última aula *terminada*, não à que ele estava assistindo.

**Alternatives considered**: (a) colunas em `inscricao_ead` — rejeitada (acima);
(b) reusar `max(vista_em)` de `progresso_aula` — rejeitada (semântica errada: quem
parou no meio da aula 3 voltaria à aula 2); (c) acrescentar em `acesso_log` —
rejeitada (log bruto de acesso a produto, sem aula_id, append-only; consultas de
retomada exigiriam varrer log); (d) UPDATE permitido só nas colunas novas via
trigger/coluna — complexidade injustificável vs. tabela own-row.

## R2 — Release note reusa o padrão de coluna derivada da 002 (par `conteudo_md`/`conteudo_publico`)

**Decision**: `release_note` tem `conteudo_md` (fonte, com possíveis
`:::nota-interna`) e `conteudo_publico` (derivada: `sanitizarMarkdown(md, 'padrao')`
recalculada em **todo** save pelas actions). A leitura escolhe a coluna pelo papel da
sessão (padrão → `conteudo_publico`; suporte+ → `conteudo_md`), exatamente como
`topico` na 002. Renderização com o `MarkdownTopico` existente (react-markdown +
remark-directive), que já estiliza os blocos internos para suporte+.

**Rationale**: é a MESMA função única de sanitização exigida pela Constituição III e
pela spec (FR-011); o padrão derivado já tem teste de regressão byte-level na 002 — o
teste novo da 004 replica a verificação para nota. Sanitizar na leitura (on-the-fly)
foi rejeitado na 002 (R-custo por request, risco de endpoint esquecer); manter o
mesmo desenho evita dois regimes de sanitização no código.

**Alternatives considered**: sanitização on-the-fly por request — rejeitada (mesmos
motivos da 002); markdown sem suporte a directives em nota — rejeitada (spec FR-011
exige `:::nota-interna` em release note).

## R3 — Evento: `inicio`/`fim` timestamptz; pontualidade validada na borda

**Decision**: `evento (id, titulo, descricao, inicio timestamptz, fim timestamptz,
criado_por, criado_em)` com check de banco `evento_fim_apos_inicio (fim > inicio)`.
A regra "evento é pontual (mesmo dia)" — premissa da spec — é validada no Zod das
actions (refine comparando as datas locais), **não** no banco.

**Rationale**: dois timestamptz cobrem data + horário de início e fim (FR-013) sem
coluna redundante de "data". O check de integridade essencial (fim > inicio, FR-016)
fica no banco porque protege qualquer caminho de escrita; a pontualidade é regra de
v1 que pode cair (evento multi-dia futuro) — prendê-la em check exigiria migração
para relaxar, contra o princípio IX.

**Alternatives considered**: `data date + hora_inicio time + hora_fim time` —
rejeitada (não generaliza para multi-dia, aritmética de fuso mais frágil); check de
mesmo dia no banco — rejeitada (acima).

## R4 — Visibilidade temporal de evento decidida na RLS (padrão não vê passado)

**Decision**: a policy de SELECT de `evento` codifica a regra do clarify de
2026-06-11: papel padrão só enxerga `fim >= now()`; suporte/dev/master/system veem
tudo (histórico da tela de gestão). O dashboard não filtra papel — apenas ordena e
limita; a gestão lista tudo que a RLS lhe entrega, separando futuro × histórico na
apresentação.

```sql
CREATE POLICY "evento_select_por_papel" ON "evento" FOR SELECT
  USING (
    current_setting('app.papel', true) IN ('suporte', 'dev', 'master', 'system')
    OR (current_setting('app.papel', true) = 'padrao' AND fim >= now())
  );
```

**Rationale**: Constituição I/II — "quem vê o quê" decidido num lugar só, auditável e
testável (o teste da fase verifica padrão × suporte sobre o mesmo evento passado).
Filtrar `fim >= now()` na query do dashboard deixaria a regra duplicável/esquecível
em telas futuras.

**Alternatives considered**: filtro na consulta do dashboard — rejeitada (regra fora
do portão único); flag `arquivado` mantida por job — rejeitada (estado derivável do
relógio não vira dado; princípio I).

## R5 — Escritas: nota = dev+ | evento = suporte+; sem exclusão de nota

**Decision**: policies de INSERT/UPDATE de `release_note` para `dev/master/system` e
**nenhuma policy de DELETE** (espelha FR-012 — a operação não existe no negócio);
`evento` com INSERT/UPDATE/DELETE para `suporte/dev/master/system`. Actions com gate
de papel no início (padrão `gateDevMais` da 003; novo `gateSuporteMais`), Zod na
borda, erro genérico de permissão.

**Rationale**: mesma arquitetura de defesa em camadas das fases anteriores (gate na
action = mensagem clara; RLS = garantia real). Negar DELETE de nota também na RLS
materializa a decisão de spec no banco — ninguém "implementa a exclusão sem querer".

**Alternatives considered**: permitir DELETE de nota só a master — rejeitada (spec
não prevê a operação; adicionável por migração quando o PO pedir).

## R6 — Blocos do dashboard: consultas dedicadas, reusando a máquina da 003

**Decision**: `src/lib/dashboard/consultas.ts` com três leituras server-side:
`continuarDeOndeParou(produtoId, userId, papel)` (inscrições `em_andamento` do
usuário cujos módulos pertencem ao produto ativo, com nome/capa do módulo, `%` via
`_percentualNaTx` reusado da 003 e `retomadaAulaId` via R1 — tudo numa transação);
`eadsDisponiveis(produtoId, userId, papel)` (módulos do produto sem inscrição do
usuário — sugestão quando o bloco está vazio); `proximosEventos(userId, papel)`
(ordenado por `inicio` asc; a RLS já corta o passado para padrão; o dashboard exibe
os próximos N=5). Notas em `src/lib/notas/consultas.ts`: `notasDoProduto` (lista
completa, coluna por papel) e `notasRecentes` (limit 5 para o bloco).

**Rationale**: o placeholder `/dashboard` e `/atualizacoes` já existem na casca
(rail/rotas da Fase 1) — a feature só preenche; o produto ativo vem de
`sessao.usuario.produtoSelecionadoId`, padrão idêntico a `/ead/page.tsx`
("grudento", FR-019, já resolvido na Fase 1). Reuso de `_percentualNaTx` evita
recalcular % com regra divergente da trilha.

**Alternatives considered**: endpoint agregador único do dashboard — desnecessário
(server component compõe as consultas); duplicar cálculo de % — rejeitada (regra num
lugar só).

## R7 — Registro de acesso no render da página da aula (sem route handler novo)

**Decision**: `registrarAcessoAula` é chamado dentro do server component
`/ead/aula/[id]/page.tsx`, na mesma transação `withUser` que carrega a aula. Sem
chamada client→server adicional. Pré-condição: inscrição ativa no módulo da aula
(mesma checagem de `marcarAulaVista`); sem inscrição, não registra (não quebra o
render).

**Rationale**: o acesso é, por definição, o render da página — registrá-lo ali é
exato e barato (1 upsert own-row); um route handler chamado pelo client poderia ser
bloqueado/duplicado e adicionaria superfície sem valor. GET com efeito colateral é
aceitável aqui: é telemetria own-row idempotente (upsert), não mudança de estado de
negócio — mesmo trade-off do `ultimo_login_em` da Fase 1.

**Alternatives considered**: route handler POST disparado pelo player — rejeitado
(já existe para `ended`; acesso ≠ vista); middleware — rejeitado (fora da transação
RLS da página, regra espalhada).

## R8 — Ordenações e limites (resolvendo as premissas da spec)

**Decision**: bloco Novidades e página de atualizações ordenam por `data DESC,
criado_em DESC` (desempate estável para notas retroativas do mesmo dia); bloco
Novidades limita a 5 (premissa da spec, teto da faixa 3–5); bloco Próximos eventos
ordena `inicio ASC` e exibe os próximos 5 com a gestão linkada para suporte+; página
de atualizações lista tudo (volume v1 é baixo; paginação quando o PO sentir dor —
registrado como evolução natural, não débito).

**Rationale**: limites fixos simples atendem SC-002/SC-006 sem estado de UI novo.

## R9 — Direção registrada para o futuro (não gera código nesta fase)

- **Modal/feed agregado multi-produto** (§6.4 do escopo): se voltar, nasce como
  consulta sobre `release_note` cruzada com os produtos do usuário — o modelo desta
  fase já suporta (nota tem produto; nenhuma desnormalização bloqueia).
- **Evento multi-dia/recorrência**: relaxar o Zod (e nada mais) para multi-dia;
  recorrência exigiria entidade própria — adiada explicitamente.
- **Atualização do doc de escopo**: §6.4 precisa ser emendado pelo PO (eventos
  gerais suporte+ sem live; sem modal) — a spec declara a divergência; a constituição
  manda a regra mudar primeiro no doc.
