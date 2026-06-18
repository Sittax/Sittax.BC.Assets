# Feature Specification: EAD do Cliente

**Feature Branch**: `003-ead-cliente`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "Construir o módulo EAD do cliente. Estrutura por produto (Módulo → Aula ordenada, vídeo YouTube não listado + descrição markdown), gestão exclusiva de dev, inscrição gratuita 'Iniciar EAD', progresso por evento de término do player, prova final com nota de corte, conclusão imutável com certificado validável por código público, e positivado por escritório/produto contratado."

**Fontes da verdade**: regra de negócio em `docs/escopo-plataforma-conhecimento-v2.md` (§5 Métricas, §6.2 EAD do cliente, §10 modelo de dados, §11 princípios); UI/navegação em `docs/layout-navegacao-claude-design.md`.

## Clarifications

### Session 2026-06-16

- Q: A tela de EAD deve mostrar só os cursos do produto selecionado? → A: Não. Reorganizada em dois blocos: **Bloco 1 "Cursos de {produto selecionado}"** (principal) e **Bloco 2 "Outros cursos recomendados"** com EADs de **outros produtos contratados** pelo escritório (etiqueta de produto em cada card; some se houver só um contratado ou usuário sem escritório). É **exceção declarada ao Princípio V** (produto = dimensão suprema), análoga à do EAD interno — cruzamento intencional, restrito a contratados, **sem lógica de lead**. Só organização/visual: inscrição, progresso e conclusão não mudam.

### Session 2026-06-11

- Q: Qual feedback o usuário vê após submeter a prova? → A: A realização da prova foi **adiada para uma fase futura (v2 do módulo)**; nesta fase constrói-se apenas o **alicerce** (modelagem de dados de prova, questão, tentativa e certificado), sem telas nem fluxo de prova.
- Q: Com a prova adiada, o que acontece com conclusão, certificado e positivado? → A: **Adiamento em cascata** (opção A): conclusão, emissão de certificado, página pública de validação e positivado vão para a fase futura junto com a prova; nesta fase ficam apenas modelados. Inscrições permanecem "em andamento" mesmo com 100% das aulas vistas — coerente com a regra de negócio (conclusão = todas as aulas **+** aprovação na prova; sem prova, não há conclusão).

> **Escopo desta fase, em resumo**: trilha por produto (módulos → aulas), gestão de módulos e aulas por dev, inscrição "Iniciar EAD", progresso por evento de término do player, % vivo — **mais** o alicerce de dados de prova/conclusão/certificado/positivado (migração versionada, campos prontos), **sem** fluxo de prova, conclusão, certificado ou painel de positivado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inscrever-se e assistir aulas com progresso (Priority: P1)

Um usuário de escritório (papel padrão) seleciona um produto, abre o módulo EAD no rail e vê a trilha do produto (módulos com aulas ordenadas). Ele clica em **Iniciar EAD** (gratuito), o vínculo de inscrição é criado e, a partir daí, cada aula que ele assiste até o fim conta como vista. O percentual de progresso (aulas vistas ÷ total atual de aulas) aparece enquanto a inscrição está em andamento.

**Why this priority**: é o coração do módulo — sem inscrição e progresso não existe a futura prova, conclusão, certificado nem positivado. Entrega valor imediato: o cliente consegue se capacitar.

**Independent Test**: com um EAD populado (via seed), um usuário padrão se inscreve, assiste uma aula até o fim e verifica o % atualizado. Não depende das telas de gestão.

**Acceptance Scenarios**:

1. **Given** um usuário padrão autenticado com um produto selecionado que possui EAD com aulas, **When** ele abre o módulo EAD, **Then** vê os módulos e aulas em ordem e o botão **Iniciar EAD** (pois ainda não está inscrito).
2. **Given** um usuário não inscrito, **When** ele clica em **Iniciar EAD**, **Then** a inscrição é criada com status "em andamento" e data de início, sem qualquer cobrança, e o botão dá lugar à trilha com progresso 0%.
3. **Given** um usuário inscrito assistindo uma aula, **When** o vídeo chega ao fim (evento de término do player), **Then** a aula é marcada como vista e o % de progresso é recalculado como aulas vistas ÷ total atual de aulas.
4. **Given** um usuário inscrito que avançou o vídeo (seek) até perto do fim, **When** o evento de término dispara, **Then** a aula conta como vista — o % mede engajamento, não esforço.
5. **Given** um usuário **não** inscrito, **When** ele navega pelas aulas do EAD, **Then** nenhum progresso é registrado e nenhum % é exibido.
6. **Given** um usuário inscrito com inscrição em andamento, **When** os dados da inscrição são consultados, **Then** o EAD está disponível para o futuro bloco "EADs em aberto" do dashboard (o bloco em si é de fase futura; nesta fase basta o dado existir e ser consultável).
7. **Given** um usuário inscrito que viu todas as aulas (100%), **When** o progresso é consultado, **Then** a inscrição permanece com status "em andamento" e o % exibe 100% — não existe conclusão nesta fase (depende da prova, adiada).

---

### User Story 2 - Gestão de módulos e aulas por dev (Priority: P2)

Um desenvolvedor (ou Master, que herda) gerencia, por telas de CRUD, a estrutura do EAD de cada produto: módulos e aulas (título, vídeo do YouTube, descrição opcional em markdown, ordem). Suporte e padrão não acessam essas telas. A gestão de prova, questões e nota de corte fica para a fase futura, junto com o fluxo de prova.

**Why this priority**: sem gestão pela interface a feature viola o princípio VIII ("tudo operável pela interface"), mas o consumo (US1) pode ser validado antes com dados de seed — por isso P2.

**Independent Test**: logado como dev, criar módulo → aula e ver o resultado refletido na trilha; logado como suporte e como padrão, confirmar que as telas e operações de gestão são negadas.

**Acceptance Scenarios**:

1. **Given** um dev autenticado, **When** ele cria/edita/reordena/remove módulos e aulas de um produto, **Then** as mudanças aparecem na trilha do EAD daquele produto na ordem definida.
2. **Given** um usuário suporte ou padrão, **When** ele tenta acessar qualquer tela ou operação de gestão do EAD, **Then** o acesso é negado no servidor — esconder a opção na interface é cortesia, não a regra.
3. **Given** um EAD com inscrições em andamento, **When** o dev adiciona ou remove aulas, **Then** o % de cada inscrito é recalculado sobre o total atual de aulas (indicador vivo), sem nunca exceder 100%.

---

### Edge Cases

- **Aula removida após inscrições em andamento**: o % é indicador vivo sobre o total **atual** — aulas removidas saem do denominador e do numerador; o % nunca excede 100%.
- **100% das aulas vistas**: a inscrição permanece "em andamento" (a conclusão depende da prova, adiada para fase futura); o % continua sendo exibido.
- **EAD sem aulas (estrutura vazia)**: a trilha não oferece "Iniciar EAD" enquanto o produto não tiver ao menos 1 aula.
- **Clique repetido em "Iniciar EAD" / inscrição duplicada**: um usuário tem no máximo uma inscrição ativa por EAD de produto; novo clique apenas retoma a trilha.
- **Evento de término repetido na mesma aula**: marcar aula já vista é idempotente — não duplica registro nem infla o %.
- **Aula vista que depois é removida e readicionada**: o registro de aula vista pertence à aula; se a aula é excluída, o registro deixa de contar; uma aula nova (mesmo com mesmo título) começa como não vista.
- **Vídeo do YouTube indisponível/removido**: a aula exibe o estado de erro do player; o trade-off de vídeo não listado acessível por link é aceito (o valor estará na prova + certificado, fase futura).
- **Usuário de outro escritório**: progresso e inscrições são do usuário; nenhum usuário enxerga ou altera o progresso de outro.

## Requirements *(mandatory)*

### Functional Requirements

**Estrutura e gestão (só dev; Master herda)**

- **FR-001**: O sistema MUST organizar o EAD do cliente por produto, na hierarquia Produto → Módulo → Aula, com módulos e aulas ordenados explicitamente.
- **FR-002**: Cada aula MUST ter título, vídeo do YouTube (não listado, exibido por embed) e descrição opcional em markdown.
- **FR-003**: O sistema MUST oferecer telas de CRUD para módulos e aulas, acessíveis exclusivamente ao papel dev (Master herda); suporte e padrão apenas consomem.
- **FR-004**: Toda operação de gestão MUST ser autorizada no servidor; tentativa de acesso por suporte ou padrão é rejeitada independentemente da interface.

**Inscrição**

- **FR-005**: O sistema MUST exigir a ação explícita "Iniciar EAD" (gratuita) para criar o vínculo usuário↔EAD; antes dela nenhum progresso é contado.
- **FR-006**: A inscrição MUST registrar usuário, produto, data de início e status (nesta fase, sempre "em andamento"), permitindo no máximo uma inscrição ativa por usuário por EAD de produto.
- **FR-007**: Inscrições em andamento MUST ser consultáveis por usuário para alimentar o futuro bloco "EADs em aberto" do dashboard (o bloco em si está fora desta fase; o dado deve existir).

**Progresso**

- **FR-008**: Uma aula MUST ser marcada como vista pelo evento de término do player de vídeo; avançar o vídeo (seek) é permitido — o indicador mede engajamento, não esforço.
- **FR-009**: A marcação de aula vista MUST ser idempotente por usuário e aula.
- **FR-010**: O % de progresso MUST ser calculado como aulas vistas ÷ total atual de aulas do produto (indicador vivo, considerando apenas aulas existentes) e MUST ser exibido somente para inscrições em andamento.
- **FR-011**: Uma inscrição com 100% das aulas vistas MUST permanecer com status "em andamento" — nesta fase nenhuma inscrição é marcada como concluída (conclusão exige aprovação na prova, adiada).

**Alicerce de prova, conclusão, certificado e positivado (sem fluxo nesta fase)**

- **FR-012**: O modelo de dados MUST contemplar, via migração versionada, as entidades da avaliação futura: prova (no máximo uma por produto, com nota de corte), questão (múltipla escolha: enunciado, alternativas, gabarito), tentativa (usuário, nota, aprovado, data) e certificado (usuário, referência, código de validação único, data).
- **FR-013**: A inscrição MUST já portar os campos da conclusão futura (status e data de conclusão), preparados para a regra de conclusão imutável (§6.2 do escopo, princípio IV) — ligar a regra na fase futura não pode exigir refatoração do dado.
- **FR-014**: Nesta fase o sistema MUST NOT expor telas, endpoints ou fluxos de realização de prova, emissão/validação de certificado ou painel de positivado; o positivado permanecerá derivável das conclusões futuras + vínculo escritório↔produto, sem cadastro próprio.

**Transversais**

- **FR-015**: Todo acesso a dados do EAD (inscrições, progresso) MUST respeitar a autorização centralizada por papel e usuário: cada usuário enxerga e altera apenas o próprio progresso e inscrições.
- **FR-017** *(organização da tela — exceção declarada ao Princípio V)*: A tela de EAD do cliente MUST apresentar dois blocos: **(1)** cursos do produto selecionado (principal) e **(2)** "Outros cursos recomendados" com EADs de **outros produtos contratados** pelo escritório do usuário (nunca o selecionado, nunca produto não contratado), cada card identificando o produto. O Bloco 2 MUST ser omitido quando não há outro produto contratado (incluindo usuário sem escritório). É exceção declarada e documentada (docs/escopo §4 e §6.2); usa apenas o vínculo escritório↔produtos existente — sem lógica de lead. Inscrição, progresso e conclusão MUST NOT ser afetados.
- **FR-016**: As regras desta fase com teste automatizado obrigatório: isolamento por usuário do progresso/inscrição (RLS) e idempotência da aula vista. Os testes de conclusão imutável e não-regressão do positivado (constituição IV/IX) acompanham a fase futura da prova, quando essas regras ganharem comportamento.

### Key Entities

- **EAD/Módulo de EAD**: agrupador de aulas, com nome e ordem; tem um **produto principal** e pode ser **vinculado a outros produtos** (tema multi-produto, M:N) — aparece na trilha do principal e dos vinculados (exceção declarada ao Princípio V, docs/escopo §4 e §6.2).
- **Aula**: unidade de conteúdo de um módulo — título, vídeo do YouTube, descrição opcional em markdown, ordem.
- **Inscrição**: vínculo usuário↔EAD de produto criado por "Iniciar EAD" — data de início, status (nesta fase sempre "em andamento") e campos de conclusão (status "concluído" + data) reservados para a fase futura, quando a conclusão imutável for ligada.
- **Progresso de aula**: registro por usuário e aula de que a aula foi vista (idempotente).
- **Prova** *(alicerce — fase futura)*: avaliação final do produto, com nota de corte; no máximo uma por produto.
- **Questão** *(alicerce — fase futura)*: questão de múltipla escolha da prova — enunciado, alternativas, gabarito.
- **Tentativa** *(alicerce — fase futura)*: registro de cada realização da prova por um usuário — nota, aprovado, data.
- **Certificado** *(alicerce — fase futura)*: documento emitido na conclusão — usuário, referência, código de validação único, data; será consultável publicamente pelo código.
- **Positivado** *(derivado — fase futura)*: estado por escritório e produto contratado — verdadeiro quando ≥1 usuário concluir; nunca regride; sem cadastro próprio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário padrão consegue, sem instrução prévia, inscrever-se num EAD e ver o primeiro % de progresso refletido imediatamente após terminar a primeira aula.
- **SC-002**: O % de progresso aparece exclusivamente em inscrições em andamento de usuários inscritos — zero ocorrências de % para usuários não inscritos.
- **SC-003**: Em teste automatizado, 100% das inscrições com todas as aulas vistas permanecem com status "em andamento" — nenhum caminho desta fase marca conclusão.
- **SC-004**: 100% das tentativas de acesso de suporte e padrão às operações de gestão do EAD são negadas no servidor (critério de aceite d).
- **SC-005**: Módulos e aulas são gerenciáveis pela interface por um dev, sem SQL ou deploy; o evento de término repetido numa aula já vista não altera o % (idempotência verificada por teste).
- **SC-006**: A migração desta fase cria as entidades do alicerce (prova, questão, tentativa, certificado e campos de conclusão na inscrição), verificável por inspeção do schema — ligar a fase futura não exigirá alteração das tabelas desta fase.

## Assumptions

- **Prova, conclusão, certificado, validação pública e positivado estão adiados em cascata** para a fase futura (v2 do módulo EAD), por decisão do PO em 2026-06-11 (ver Clarifications); esta spec entrega o consumo de aulas + o alicerce de dados. Os critérios de aceite originais (a) certificado validável e (b) aula nova não despositiva referem-se à fase futura; permanecem como regra de negócio no escopo §6.2.
- **Aula removida sai do cálculo do %**: o % é "indicador vivo sobre o total atual de aulas"; aulas removidas deixam de contar no numerador e denominador.
- **"EADs em aberto" no dashboard fica fora desta fase**: apenas o dado de inscrições em andamento precisa existir e ser consultável (conforme o pedido).
- **EAD interno fica fora desta fase** (§6.3); a estrutura, porém, é compartilhada (modelo já prevê `interno`/`tema_interno`), e nada nesta spec pode inviabilizar esse reuso.
- **Trade-off aceito do vídeo não listado** (§6.2): quem tiver o link assiste ao vídeo; o valor protegido será a prova + certificado (fase futura).
- **Sem estado de rascunho para módulos/aulas no v1**: o que o dev cria fica visível imediatamente na trilha (princípio X — v1 de pé; rascunho seria mecanismo novo sem pedido).
- **Reciclagem não existe no v1**: se um dia existir, será uma inscrição nova (citado no escopo §6.2); nenhum requisito desta spec a antecipa.
