# Feature Specification: Dashboard, Release Notes e Eventos

**Feature Branch**: `004-dashboard-atualizacoes`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "Construir o módulo Dashboard + Release Notes + Eventos sobre a fundação existente. Dashboard (tela inicial logada) com blocos 'Continue de onde parou', 'Novidades' (3-5 release notes do produto ativo) e 'Próximos eventos'. Release notes por produto, markdown com sanitização única, escrita só dev. Eventos gerais (sem produto), CRUD suporte+, sem live/streaming no v1."

**Fontes da verdade**: regra de negócio em `docs/escopo-plataforma-conhecimento-v2.md` (§6.4 Dashboard, §6.5 Release notes); UI/navegação em `docs/layout-navegacao-claude-design.md` (Dashboard e Atualizações são módulos de largura total, com itens próprios no rail, visíveis a todos os papéis).

**Divergências declaradas em relação ao escopo §6.4** (decisão do PO nesta especificação, não silenciadas conforme a constituição): o "calendário de novidades" e os "links de lives" do escopo dão lugar a um bloco de **Eventos gerais** (registro informativo, sem transmissão); o "modal de novidades recentes" (feed agregado multi-produto) dá lugar ao bloco **Novidades** do produto ativo com link para a página de release notes. Quem gerencia eventos é **suporte+** (no escopo, "quem posta" no dashboard era dev); release notes permanecem exclusivas de dev.

## Clarifications

### Session 2026-06-11

- Q: Eventos passados somem definitivamente ou ficam acessíveis em um histórico? → A: Somem do dashboard, mas permanecem em histórico na tela de gestão de eventos (suporte+); papel padrão vê apenas eventos futuros e em andamento. Nada é apagado automaticamente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continuar EADs pelo dashboard (Priority: P1)

Ao entrar na plataforma, o usuário cai no dashboard (que substitui a tela inicial atual) e vê o bloco "Continue de onde parou" com os EADs que ele tem em andamento **no produto ativo da sessão**: cada card mostra o nome do curso, o percentual de progresso e um link que abre diretamente a última aula que ele acessou. Se ele não tem nenhum EAD em andamento no produto ativo, o bloco sugere os EADs disponíveis daquele produto.

**Why this priority**: É o valor central do dashboard como tela inicial: reduzir o atrito de continuar um treinamento. Reusa dados que já existem (inscrições e progresso da Feature 003) e entrega valor sozinho, mesmo sem os demais blocos.

**Independent Test**: Com um usuário inscrito em um EAD do produto ativo (aulas 1 e 2 acessadas) e em um EAD de outro produto, abrir o dashboard e verificar que só o EAD do produto ativo aparece e que o link abre a aula 2 (última acessada).

**Acceptance Scenarios**:

1. **Given** um usuário com inscrição em andamento num EAD do produto ativo, cuja última aula acessada foi a aula 2, **When** ele clica no card do EAD no dashboard, **Then** ele é levado diretamente à aula 2.
2. **Given** um usuário com uma inscrição em andamento e outra concluída no produto ativo, **When** ele abre o dashboard, **Then** apenas a inscrição em andamento aparece, com nome do curso e percentual de progresso.
3. **Given** um usuário inscrito num EAD do produto B, **When** ele abre o dashboard com o produto A ativo, **Then** esse EAD não aparece no bloco; ao trocar o produto ativo para B, ele aparece.
4. **Given** um usuário sem nenhum EAD em andamento no produto ativo, **When** ele abre o dashboard, **Then** o bloco sugere os EADs disponíveis do produto ativo para ele iniciar.
5. **Given** um usuário inscrito que nunca abriu uma aula, **When** ele clica no card, **Then** ele é levado à primeira aula do EAD.

---

### User Story 2 - Consultar novidades e release notes do produto ativo (Priority: P2)

Qualquer usuário logado vê no dashboard o bloco "Novidades" com as release notes mais recentes do produto ativo e, pelo link "ver todas", chega à página de release notes: a lista cronológica completa das notas daquele produto, com conteúdo formatado. Usuários de papel padrão jamais veem conteúdo interno embutido nas notas; suporte+ vê os blocos internos.

**Why this priority**: É o canal oficial de comunicação de mudanças dos produtos. A leitura pode ser validada com dados semeados, independente da tela de gestão.

**Independent Test**: Com notas cadastradas para dois produtos (uma contendo bloco interno), verificar como padrão que o bloco e a página mostram só as notas do produto ativo, sem nenhum vestígio do conteúdo interno; como suporte, verificar que o bloco interno aparece.

**Acceptance Scenarios**:

1. **Given** seis notas cadastradas no produto ativo, **When** o usuário abre o dashboard, **Then** o bloco "Novidades" exibe as 5 mais recentes e o link "ver todas" leva à página de release notes com a lista completa em ordem cronológica decrescente.
2. **Given** notas nos produtos A e B, **When** o usuário está com o produto A ativo, **Then** bloco e página exibem exclusivamente notas de A; ao trocar para B, passam a exibir as de B.
3. **Given** uma nota contendo um bloco `:::nota-interna`, **When** um usuário de papel padrão a visualiza (no bloco, na página ou em qualquer resposta do servidor), **Then** nenhum byte do conteúdo interno está presente; **When** um usuário suporte+ a visualiza, **Then** o bloco interno aparece identificado como interno.
4. **Given** um produto ativo sem nenhuma nota, **When** o usuário abre o dashboard e a página de release notes, **Then** ambos exibem estado vazio claro, sem erro.
5. **Given** uma nota com versão preenchida e outra sem, **When** o usuário visualiza a lista, **Then** a versão aparece junto à data na primeira e a segunda exibe apenas a data, sem campo vazio.

---

### User Story 3 - Dev cria e edita release notes (Priority: P3)

Um usuário dev (ou Master, por herança) cria e edita release notes pela própria interface, usando markdown. Cada nota pertence a um produto e tem data, versão opcional e conteúdo markdown livre, que pode incluir blocos internos. Para os demais papéis os botões de criar/editar nem aparecem — e o gate real é do servidor.

**Why this priority**: Sem cadastro pela interface não há conteúdo real para o bloco Novidades nem para a página (princípio "Tudo Operável pela Interface"). Vem depois da leitura porque esta é validável com dados semeados.

**Independent Test**: Logado como dev, criar uma nota e verificar que aparece no bloco e na página; logado como padrão e como suporte, verificar ausência dos controles e rejeição de tentativa direta de escrita.

**Acceptance Scenarios**:

1. **Given** um usuário dev na página de release notes, **When** ele cria uma nota informando produto, data, versão opcional e conteúdo markdown, **Then** a nota é salva e aparece imediatamente na página e no bloco "Novidades" do produto correspondente.
2. **Given** um usuário dev, **When** ele edita uma nota existente, **Then** a alteração reflete na página e no bloco.
3. **Given** um usuário de papel padrão ou suporte, **When** a página de release notes é exibida, **Then** nenhum botão de criar/editar aparece.
4. **Given** uma sessão de papel padrão ou suporte, **When** uma operação de criação/edição de nota é enviada diretamente ao servidor (fora da UI), **Then** o servidor rejeita com mensagem clara.

---

### User Story 4 - Ver próximos eventos no dashboard (Priority: P4)

O dashboard exibe o bloco "Próximos eventos": lista dos eventos futuros com título, data e horário de início e fim. Evento é registro informativo geral — não pertence a produto e aparece para todos os usuários, independentemente do produto ativo.

**Why this priority**: Completa o dashboard como central de comunicação; é independente das release notes (feeds distintos) e pode ser validado com eventos semeados.

**Independent Test**: Com um evento futuro e um passado cadastrados, abrir o dashboard com produtos ativos diferentes e verificar que o evento futuro aparece em ambos (com data e horário) e o passado não aparece no bloco.

**Acceptance Scenarios**:

1. **Given** eventos futuros cadastrados, **When** qualquer usuário abre o dashboard, **Then** o bloco lista os próximos eventos em ordem cronológica crescente, com título, data e horário de início e fim.
2. **Given** o usuário troca o produto ativo, **When** o dashboard atualiza, **Then** o bloco de eventos permanece idêntico (eventos não pertencem a produto).
3. **Given** um evento cuja data/horário de fim já passou, **When** qualquer usuário abre o dashboard, **Then** o evento não aparece no bloco; **When** um usuário suporte+ abre a tela de gestão de eventos, **Then** o evento passado permanece visível no histórico.
4. **Given** nenhum evento futuro cadastrado, **When** o usuário abre o dashboard, **Then** o bloco exibe estado vazio claro.
5. **Given** um evento clicado, **When** o usuário o visualiza, **Then** vê também a descrição completa.

---

### User Story 5 - Suporte+ gerencia eventos (Priority: P5)

Um usuário suporte ou dev (Master herda) cria, edita e exclui eventos pela interface, informando título, descrição, data e horários de início e fim. Para papel padrão, nenhum controle de gestão aparece — e o gate real é do servidor.

**Why this priority**: Sem cadastro pela interface o bloco de eventos não tem conteúdo real. Vem por último porque a exibição (US4) é validável com dados semeados.

**Independent Test**: Logado como suporte, cadastrar, editar e excluir um evento e verificar o reflexo no dashboard; logado como padrão, verificar ausência de controles e rejeição de escrita direta.

**Acceptance Scenarios**:

1. **Given** um usuário suporte, **When** ele cadastra um evento com título, descrição, data e horários de início e fim, **Then** o evento aparece no bloco "Próximos eventos" de todos os usuários.
2. **Given** um usuário suporte, **When** ele edita ou exclui um evento, **Then** a alteração reflete no dashboard.
3. **Given** um usuário de papel padrão, **When** ele vê o bloco de eventos, **Then** nenhum controle de criar/editar/excluir aparece.
4. **Given** uma sessão de papel padrão, **When** uma operação de escrita de evento é enviada diretamente ao servidor, **Then** o servidor rejeita com mensagem clara.

---

### Edge Cases

- Usuário sem EAD em andamento e produto ativo sem EADs disponíveis: bloco "Continue de onde parou" exibe estado vazio claro.
- EAD concluído (evento imutável, §6.2 do escopo): nunca aparece em "Continue de onde parou", mesmo que aulas novas tenham sido adicionadas depois.
- Última aula acessada foi removida do EAD: o link recai para a primeira aula disponível na ordem atual.
- Release note com bloco interno em resultado de qualquer endpoint (bloco do dashboard, página, futuros consumidores): a sanitização é a mesma função única — nenhum byte interno chega a sessão de papel padrão.
- Evento com horário de fim em andamento (já começou, não terminou): permanece visível no bloco até o horário de fim.
- Evento com fim anterior ao início: rejeitado na gravação com mensagem clara.
- Usuário de papel sem permissão acessa diretamente rota/URL de gestão (nota ou evento): o servidor nega, independentemente da UI.
- Troca do produto ativo com o dashboard aberto: blocos "Continue de onde parou" e "Novidades" refletem o novo produto; bloco de eventos não muda.

## Requirements *(mandatory)*

### Functional Requirements

#### Dashboard

- **FR-001**: O dashboard MUST ser a tela inicial exibida após o login, substituindo a tela inicial atual, em largura total conforme `docs/layout-navegacao-claude-design.md`.
- **FR-002**: O bloco "Continue de onde parou" MUST listar as inscrições em andamento do usuário **no produto ativo da sessão**, cada card com nome do curso, percentual de progresso e link que abre diretamente a última aula acessada pelo usuário (ou a primeira aula, se nenhuma foi acessada).
- **FR-003**: Inscrições concluídas (evento imutável) MUST NOT aparecer no bloco "Continue de onde parou".
- **FR-004**: Quando o usuário não tem EAD em andamento no produto ativo, o bloco MUST sugerir os EADs disponíveis desse produto.
- **FR-005**: O bloco "Novidades" MUST exibir as release notes mais recentes do produto ativo (até 5), com link "ver todas" para a página de release notes.
- **FR-006**: O bloco "Próximos eventos" MUST listar os eventos futuros (e em andamento) em ordem cronológica crescente, com título, data e horários de início e fim, independentemente do produto ativo.
- **FR-007**: Todos os blocos MUST respeitar o produto ativo da sessão (quando aplicável) e o papel do usuário — conteúdo interno jamais aparece para papel padrão.
- **FR-008**: Trocar o produto ativo MUST atualizar os blocos "Continue de onde parou" e "Novidades"; o bloco de eventos não é afetado.

#### Release notes

- **FR-009**: A plataforma MUST ter uma página própria de release notes listando, em ordem cronológica decrescente, as notas do produto ativo, com conteúdo markdown renderizado.
- **FR-010**: Cada release note MUST pertencer a exatamente um produto e ter data, versão opcional e conteúdo markdown livre.
- **FR-011**: O conteúdo das release notes MUST passar pela mesma função única de sanitização server-side da Base de Conhecimento: a nota é visível a qualquer usuário logado, mas blocos `:::nota-interna` são visíveis apenas a suporte+ — para papel padrão, o conteúdo interno não está presente em nenhum byte de nenhuma resposta do servidor.
- **FR-012**: Criação e edição de release notes MUST ser exclusivas do papel dev (Master herda); os botões na UI são cortesia — o gate real MUST ser verificado no servidor em toda operação de escrita.

#### Eventos

- **FR-013**: Evento MUST ser um registro informativo com título, descrição, data, horário de início e horário de fim; MUST NOT pertencer a produto — aparece para todos os usuários, independentemente do produto ativo.
- **FR-014**: Criação, edição e exclusão de eventos MUST ser permitidas a suporte e dev (Master herda), pela interface; o gate real MUST ser verificado no servidor.
- **FR-015**: Eventos cujo horário de fim já passou MUST sair do bloco "Próximos eventos" do dashboard para todos os usuários; eles MUST permanecer registrados e visíveis como histórico na tela de gestão de eventos (suporte+). Nenhum evento é apagado automaticamente; papel padrão vê apenas eventos futuros e em andamento.
- **FR-016**: A gravação de evento MUST rejeitar horário de fim anterior ao de início, com mensagem clara.

#### Regras herdadas (não negociáveis, transversais)

- **FR-017**: Toda leitura e escrita das novas entidades (release notes, eventos) MUST passar pela autorização centralizada da plataforma — o mesmo portão único de quem-vê-o-quê dos demais módulos, aplicado às tabelas novas.
- **FR-018**: Controles de escrita ocultados na UI são cortesia de experiência; toda permissão MUST ser verificada no servidor em toda requisição.
- **FR-019**: O produto ativo MUST seguir o comportamento "grudento" existente da sessão (persistir entre telas e visitas, como nos demais módulos).
- **FR-020**: A entrega MUST incluir as regras críticas cobertas por testes automatizados (sanitização das notas para papel padrão e autorização das novas entidades) e registro da mudança no histórico de versões da plataforma.

### Key Entities

- **Release note**: comunicação de mudança de um produto; atributos: produto (obrigatório), data, versão (opcional), conteúdo markdown (pode conter blocos internos). Alimenta o bloco "Novidades" e a página de release notes.
- **Evento**: registro informativo geral; atributos: título, descrição, data, horário de início, horário de fim. Sem vínculo com produto. Alimenta o bloco "Próximos eventos".
- **Inscrição em EAD** *(existente, Feature 003)*: consumida (não alterada) pelo bloco "Continue de onde parou" — interessam as inscrições em andamento do produto ativo, o percentual de progresso e a última aula acessada pelo usuário.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A partir do dashboard, o usuário chega à última aula acessada de um EAD em andamento com **1 clique**, em **100%** dos casos.
- **SC-002**: Com qualquer produto ativo, **100%** dos itens dos blocos "Continue de onde parou" e "Novidades" pertencem ao produto ativo, e o bloco "Próximos eventos" exibe os mesmos eventos para qualquer produto ativo.
- **SC-003**: Em sessões de papel padrão, **0 bytes** de conteúdo interno de release notes aparecem em qualquer resposta do servidor (verificado por teste automatizado).
- **SC-004**: Em sessões sem permissão de escrita, **0** controles de criação/edição/exclusão são exibidos e **100%** das tentativas diretas de escrita são rejeitadas pelo servidor.
- **SC-005**: Um dev publica uma release note nova e um suporte cadastra um evento, ambos exclusivamente pela interface, cada um em menos de **2 minutos**.
- **SC-006**: O dashboard completo (três blocos) carrega em até **2 segundos** em condições normais de uso.

## Out of Scope

- Transmissão/live ou streaming de eventos (registro é apenas informativo no v1).
- Inscrição/RSVP em eventos.
- Notificações (push, e-mail) de novidades, notas ou eventos.
- EAD interno (o bloco "Continue de onde parou" desta feature trata do EAD de cliente, organizado por produto).
- Integração/migração com Redmine para release notes (futuro declarado no escopo §6.5).

## Assumptions

- **"Última aula acessada"**: a aula mais recentemente aberta pelo usuário naquela inscrição; se a informação não existir (usuário nunca abriu aula), o link leva à primeira aula na ordem do EAD. Se a aula registrada tiver sido removida, recai para a primeira aula disponível.
- **Limite do bloco "Novidades"**: exibe até **5** notas mais recentes (faixa 3-5 do pedido resolvida no teto; com menos notas cadastradas, exibe as existentes).
- **"Em andamento"**: inscrição criada (Iniciar EAD) e ainda sem o evento imutável de conclusão, conforme §6.2 do escopo.
- **Sugestão de EADs disponíveis** (bloco vazio): lista os EADs do produto ativo em que o usuário ainda não está inscrito ou não concluiu.
- **Evento é pontual** (uma data, início e fim no mesmo dia); recorrência e eventos multi-dia ficam fora do v1.
- **Blocos internos em release notes**: a regra de criação por directive da base se mantém (`nota-tecnica` só dev) — como o autor de nota é sempre dev, não há novo caso de validação de permissão no save além do existente.
