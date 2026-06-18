# Feature Specification: Fundação — Identidade, Sessão e Casca de Navegação

**Feature Branch**: `001-fundacao-identidade-navegacao`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "Construir a fundação da Central de Conhecimento: identidade, sessão e a casca de navegação — login validado diretamente nos endpoints SSO dos 6 sistemas Sittax, papel espelhado via mapeamento configurável, sessão própria, entidades base (escritório, usuário, produtos contratados, registro de acesso), casca com top bar + rail de módulos com visibilidade por papel, e gerência do Master (escritórios e usuários só central)."

**Fontes da verdade**: regra de negócio em `docs/escopo-plataforma-conhecimento-v2.md` (§1–§4, §10); UI/navegação em `docs/layout-navegacao-claude-design.md`; contrato de integração SSO em `docs/sso-login-endpoint.md`.

## Clarifications

### Session 2026-06-09

- Q: Como a credencial é validada nos 6 sistemas (a spec citava o orquestrador n8n)? →
  A: **Sem n8n, sem orquestrador.** A plataforma chama diretamente o endpoint SSO
  compartilhado (`POST {base_url}/api/auth/login`, body `{usuario, senha}`) de cada um
  dos 6 sistemas, **em sequência, até um validar**. O retorno traz JWT + dados do
  usuário (id, nome, sobrenome, email, nivel, role) e claims (EscritorioCnpj,
  EscritorioNome, Role, Nivel, Inadimplencia, exp). Contrato: `docs/sso-login-endpoint.md`.
- Q: De onde vêm as 6 URLs dos sistemas? → A: Exclusivamente de variáveis de ambiente —
  nunca em código ou spec; há ambiente de homologação para desenvolvimento. Nenhuma
  credencial ou URL real entra em código, spec ou documentação.
- Q: Como role/nivel da origem viram papel da central (padrão/suporte/dev)? → A: Por
  **mapeamento configurável** (tabela/configuração editável, não fixo em código). O mapa
  real será fornecido pelo Product Owner antes do `/speckit-plan`.
- Q: Usuário válido com `EscritorioCnpj` vazio? → A: Login **bloqueado** com mensagem
  clara ("usuário sem escritório vinculado — contate o suporte"), **exceto** se o papel
  traduzido for suporte+ — funcionários internos não têm escritório.
- Q: Como expira a sessão própria da central em relação ao `exp` do JWT de origem? → A:
  **Deslizante + teto absoluto**: expira por inatividade (prazo configurável, padrão 7
  dias), renovada a cada uso, com vida máxima absoluta (configurável, padrão 30 dias)
  que força revalidação na origem. Independente do `exp` do token de origem.
- Q: Quando a sequência dos 6 endpoints falha, qual mensagem o usuário vê? → A:
  **Distinguir por resposta autoritativa**: se ao menos um sistema respondeu "credencial
  inválida", exibe a mensagem genérica de credencial inválida; se nenhum sistema
  conseguiu responder (timeout/erro em todos), exibe indisponibilidade temporária.
  **Refinamento (PO)**: no cenário misto — ao menos um sistema recusou a credencial E ao
  menos um inacessível na mesma tentativa — exibe credencial inválida **acrescida de
  aviso de indisponibilidade parcial**, orientando a tentar novamente em instantes caso
  a senha pertença ao sistema indisponível. Nunca revelar qual sistema validou, recusou
  ou está fora do ar.
- Q: Qual o orçamento de tempo da tentativa de login que percorre os 6 sistemas? → A:
  **Teto total de ~10s** para a tentativa inteira, com timeout curto por sistema
  (configurável, ex.: 3s). Estourado o teto sem resposta autoritativa, trata como
  indisponibilidade. Valores configuráveis por ambiente, sem deploy.
- Q: Combinação `role`/`nivel` validada na origem mas sem entrada no mapeamento
  configurável? → A: **Assumir padrão** (menor privilégio). O usuário entra como
  padrão; nenhum alerta automático nesta fase. Consequência aceita: funcionário interno
  não mapeado e sem escritório cai na regra do CNPJ vazio e é bloqueado com a mensagem
  "usuário sem escritório vinculado — contate o suporte".
- Q: Colisão de e-mail entre usuário só central e os 6 sistemas — quem tem precedência?
  → A: **O cadastro local (local-first)**: e-mail de usuário `origem='central'` é sempre
  validado localmente, sem consultar o SSO. Migração para credencial da origem é
  operação manual do Master (desativar o local; SSO espelha no próximo login). A
  sinalização automática ao Master prevista anteriormente foi descartada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Login com credencial existente e sessão própria (Priority: P1)

Um usuário de qualquer um dos 6 produtos da empresa acessa a Central de Conhecimento e
entra com o mesmo e-mail e senha que já usa. A plataforma valida a credencial chamando
diretamente o endpoint de login compartilhado dos 6 sistemas, em sequência, até um
validar. Do retorno válido ela extrai identidade, papel de origem (role/nivel) e
escritório (CNPJ e nome), traduz o papel de origem para o papel da central pelo
mapeamento configurável, espelha tudo localmente (criando usuário e escritório no
primeiro acesso, atualizando-os nos seguintes) e abre uma sessão própria. Daí em diante,
nenhuma ação do usuário depende dos sistemas de origem até o próximo login — o JWT
devolvido pela origem não é reutilizado pela central.

**Why this priority**: É a porta de entrada — nada na plataforma existe para um usuário
que não consegue entrar. Também materializa as duas regras mais estruturais da fase:
papel espelhado (nunca cadastrado) e sessão independente dos sistemas de origem.

**Independent Test**: Com os 6 endpoints SSO simulados (ou o ambiente de homologação),
fazer login com um usuário de cada papel e verificar: sessão criada, papel traduzido
pelo mapeamento e escritório espelhados corretamente; em seguida derrubar os endpoints e
confirmar que a navegação da sessão ativa continua funcionando e que um novo login falha
com mensagem clara.

**Acceptance Scenarios**:

1. **Given** um usuário que existe em ao menos um dos 6 sistemas e nunca acessou a
   central, **When** ele entra com seu e-mail/senha, **Then** a plataforma valida nos
   endpoints SSO em sequência, cria seu registro local com papel traduzido e escritório
   espelhados da origem e abre sessão.
2. **Given** um usuário espelhado cujo papel mudou no sistema de origem (ex.: padrão →
   suporte), **When** ele faz um novo login, **Then** o papel local é ressincronizado
   (pelo mapeamento vigente) e a navegação reflete o novo papel imediatamente.
3. **Given** um usuário com sessão ativa, **When** os 6 sistemas de origem ficam
   indisponíveis, **Then** todas as telas da fase continuam funcionando normalmente para
   essa sessão.
4. **Given** os 6 endpoints SSO indisponíveis, **When** alguém tenta um novo login,
   **Then** recebe mensagem clara de indisponibilidade temporária (sem expor detalhe
   técnico) e nenhuma sessão é criada.
5. **Given** uma credencial que nenhum dos 6 sistemas reconhece, **When** o usuário tenta
   entrar, **Then** recebe mensagem genérica de credencial inválida (sem revelar em quais
   sistemas a busca falhou).
6. **Given** um usuário "só central" cadastrado pelo Master, **When** ele entra com seu
   e-mail/senha, **Then** a validação acontece na própria plataforma (sem consultar os
   sistemas de origem) e a sessão abre com o papel local definido pelo Master.
7. **Given** um usuário validado na origem cujo papel traduzido é **padrão** e cujo
   claim de escritório (`EscritorioCnpj`) vem vazio, **When** ele tenta entrar, **Then**
   o login é bloqueado com a mensagem "usuário sem escritório vinculado — contate o
   suporte" e nenhuma sessão é criada.
8. **Given** um usuário validado na origem cujo papel traduzido é **suporte+** e sem
   escritório no claim, **When** ele entra, **Then** a sessão abre normalmente, sem
   vínculo de escritório (funcionários internos não têm escritório).

---

### User Story 2 - Casca de navegação com visibilidade por papel (Priority: P2)

Logado, o usuário vê a casca da plataforma conforme o documento de layout: top bar com
logo, seletor de produto e avatar; rail lateral de ícones recolhido à esquerda. O rail
lista Dashboard, Base de conhecimento, EAD, Atualizações e — apenas para suporte,
desenvolvedor e Master — EAD interno. Cada módulo abre uma tela placeholder. O seletor
de produto mostra os 6 produtos e é "grudento": a escolha vale para toda a plataforma e
permanece até ser trocada.

**Why this priority**: A casca é o esqueleto sobre o qual todos os módulos futuros serão
pendurados; o controle de visibilidade por papel é o primeiro teste real do espelhamento
feito na US1. Depende da US1 (precisa de sessão e papel).

**Independent Test**: Logar com um usuário de cada um dos 4 papéis e percorrer o rail:
usuários padrão não veem EAD interno (nem pela interface, nem acessando o endereço da tela
diretamente); suporte+ veem. Trocar o produto no seletor, navegar entre módulos e sair/
voltar, confirmando que a seleção persiste.

**Acceptance Scenarios**:

1. **Given** uma sessão de usuário padrão, **When** a casca carrega, **Then** o rail exibe
   Dashboard, Base de conhecimento, EAD e Atualizações — sem EAD interno.
2. **Given** uma sessão de suporte, desenvolvedor ou Master, **When** a casca carrega,
   **Then** o item EAD interno aparece no rail.
3. **Given** uma sessão de usuário padrão, **When** ela tenta acessar diretamente o endereço da
   tela de EAD interno, **Then** o servidor nega o acesso (esconder o item no rail é
   cortesia; a regra é a checagem no servidor).
4. **Given** o rail recolhido (padrão, só ícones), **When** o usuário passa o mouse sobre
   ele, **Then** um fly-out em overlay mostra os rótulos sem empurrar o conteúdo; ao sair
   do hover, recolhe. Em telas de toque, um toque revela os rótulos.
5. **Given** qualquer módulo ativo, **When** o usuário o seleciona no rail, **Then** o
   item ativo fica marcado (indicador laranja) e a área de conteúdo mostra o placeholder
   do módulo.
6. **Given** um produto selecionado no seletor da top bar, **When** o usuário navega
   entre módulos ou encerra e reabre a sessão, **Then** o produto selecionado permanece o
   mesmo até ele trocar.
7. **Given** o seletor de produto aberto, **When** o usuário o consulta, **Then** vê os 6
   produtos da empresa, independentemente de quais o escritório dele contrata.
8. **Given** uma sessão de suporte+ com o módulo EAD interno ativo, **When** a casca
   renderiza, **Then** o seletor de produto aparece desabilitado/atenuado com a
   explicação de que o EAD interno é organizado por temas; ao sair do módulo, o seletor
   volta ao normal com o produto que estava selecionado.
9. **Given** o menu do avatar aberto, **When** o usuário o consulta, **Then** vê seu
   nome, papel e escritório (quando houver), e consegue encerrar a sessão.

---

### User Story 3 - Gerência do Master: escritórios e usuários só central (Priority: P3)

O Master administra, inteiramente pela interface, os escritórios (criar, editar,
vincular/desvincular produtos contratados) e os usuários "só central" (criar, editar,
desativar usuários que não existem nos 6 sistemas, com papel definido localmente).
Usuários espelhados dos 6 sistemas aparecem na listagem em modo somente leitura, com
indicação de que a fonte da verdade é o sistema de origem.

**Why this priority**: Sem essas telas, operar a fase exigiria SQL — o que viola a regra
"tudo operável pela interface". Vem depois da casca porque as telas vivem dentro dela.

**Independent Test**: Logar como Master, criar um escritório, vincular produtos a ele,
criar um usuário só central com papel suporte, logar com esse usuário e verificar acesso
ao EAD interno; tentar as mesmas telas com os demais papéis e confirmar a negativa.

**Acceptance Scenarios**:

1. **Given** uma sessão de Master, **When** ele acessa a gerência, **Then** consegue
   criar, editar e listar escritórios e vincular/desvincular produtos contratados de cada
   um, tudo pela interface.
2. **Given** uma sessão de Master, **When** ele cadastra um usuário só central, **Then**
   informa nome, e-mail, senha, escritório e papel local, e esse usuário passa a
   conseguir logar imediatamente.
3. **Given** um usuário só central desativado pelo Master, **When** esse usuário tenta
   logar, **Then** o acesso é negado; sessões já abertas desse usuário deixam de
   funcionar no próximo acesso ao servidor.
4. **Given** a listagem de usuários, **When** o Master abre um usuário espelhado dos 6
   sistemas, **Then** os dados aparecem em modo somente leitura, com papel marcado como
   espelhado da origem (sem botão de edição de papel).
5. **Given** uma sessão de papel padrão, suporte ou desenvolvedor, **When** ela tenta acessar
   qualquer tela ou operação de gerência do Master (inclusive por endereço direto),
   **Then** o servidor nega a operação.
6. **Given** um escritório com usuários vinculados, **When** o Master tenta excluí-lo,
   **Then** a plataforma impede a exclusão e orienta a desativar/migrar os usuários antes
   (nenhum dado de acesso é órfão).
7. **Given** uma sessão de Master, **When** ele acessa a configuração do mapeamento de
   papéis, **Then** consegue consultar e editar pela interface a tradução role/nivel da
   origem → papel da central, sem deploy.

---

### User Story 4 - Registro bruto de acesso (Priority: P4)

Todo acesso à plataforma fica registrado — qual usuário, qual produto estava selecionado
(quando houver) e quando. É só o registro bruto: nenhuma métrica, painel ou lógica é
construída sobre ele nesta fase.

**Why this priority**: É o dado que alimentará métricas e (num futuro distante) o sinal
de lead. Barato de capturar agora, caro de reconstituir depois. Não bloqueia nada das
histórias anteriores.

**Independent Test**: Realizar logins e trocas de produto com usuários distintos e
verificar, pela própria interface de gerência ou por inspeção controlada, que cada
evento gerou um registro com usuário, produto e data.

**Acceptance Scenarios**:

1. **Given** um login bem-sucedido, **When** a sessão abre, **Then** um registro de
   acesso é gravado com o usuário e a data.
2. **Given** uma sessão ativa, **When** o usuário troca o produto no seletor, **Then** um
   registro é gravado com o usuário, o produto selecionado e a data.
3. **Given** os registros gravados, **When** qualquer tela da fase é usada, **Then**
   nenhuma lógica de negócio é executada sobre eles (apenas armazenamento).

---

### Edge Cases

- Um dos sistemas responde com lentidão extrema durante o login: a plataforma aplica um
  limite de espera por sistema e segue para o próximo da sequência, respeitando o teto
  total da tentativa (~10s, FR-029); o usuário nunca fica pendurado indefinidamente.
- Resposta de um sistema inválida ou malformada (sem token, ou token sem os claims
  essenciais): é tratada como falha **daquele** sistema — a sequência continua nos
  demais; nada é espelhado pela metade.
- Usuário espelhado cujo escritório (CNPJ) informado pela origem ainda não existe na
  central: o escritório é criado automaticamente no espelhamento, com CNPJ e nome vindos
  dos claims (sem intervenção do Master).
- Usuário espelhado que muda de escritório na origem: o vínculo local é atualizado no
  próximo login.
- Usuário com papel traduzido padrão e claim de escritório vazio: login bloqueado com
  "usuário sem escritório vinculado — contate o suporte" (ver Clarifications); suporte+
  sem escritório entra normalmente.
- Combinação role/nivel da origem sem entrada no mapeamento configurável: o usuário
  entra como **padrão** (menor privilégio, FR-002). Se além de não mapeado vier sem
  escritório, é bloqueado pela regra do CNPJ vazio (FR-028) — comportamento aceito.
- E-mail de usuário só central que coincide com um e-mail que mais tarde aparece nos 6
  sistemas: **o cadastro local tem precedência** — login desse e-mail é sempre validado
  localmente; o SSO não é consultado para usuários de origem central. Se a pessoa
  precisar passar a usar a credencial da origem, o Master resolve manualmente:
  desativa o usuário só central e o próximo login via SSO cria o registro espelhado.
  Não há fusão automática de cadastros nem detecção automática da coincidência.
- Sessão expirada: a próxima ação do usuário redireciona para o login, sem perda
  silenciosa de trabalho (nesta fase não há formulários longos fora da gerência).
- Dois logins simultâneos do mesmo usuário: ambos funcionam; o último login ganha na
  ressincronização do papel.
- Usuário com papel rebaixado na origem (suporte → padrão) com sessão ainda ativa: a
  sessão atual mantém o papel com que abriu; o rebaixamento vale a partir do próximo
  login (revalidação ocorre no login, conforme §3 do escopo).

## Requirements *(mandatory)*

### Functional Requirements

**Identidade e login**

- **FR-001**: A plataforma MUST autenticar usuários por e-mail e senha (o e-mail é o
  identificador de login, enviado no campo `usuario` do endpoint SSO) e, da resposta
  válida, extrair também o escritório vinculado — o cliente, identificado pelo CNPJ dos
  claims (FR-003/FR-012) —, validando a credencial diretamente no endpoint de login
  compartilhado dos 6 sistemas de origem
  (contrato em `docs/sso-login-endpoint.md`), **em sequência, até um sistema validar** —
  sem orquestrador intermediário. As 6 URLs base MUST vir de configuração por variável
  de ambiente; nenhuma URL ou credencial real MAY existir em código, spec ou
  documentação.
- **FR-002**: A plataforma MUST traduzir o papel de origem (`role`/`nivel`) para o papel
  da central (padrão, suporte ou desenvolvedor) por meio de um **mapeamento
  configurável** — editável pela interface (dono: Master), nunca fixo em código — e
  ressincronizar o papel a cada login. Vale o papel do primeiro sistema que validar a
  credencial (premissa: papéis não conflitam entre sistemas). Combinação `role`/`nivel`
  sem entrada no mapeamento MUST ser traduzida para **padrão** (menor privilégio).
- **FR-003**: No primeiro login de um usuário espelhado, a plataforma MUST criar
  automaticamente seu registro local e, se necessário, o do seu escritório
  (identificado pelo CNPJ vindo dos claims, com o nome informado), marcando a origem
  como "sistema".
- **FR-004**: A plataforma MUST manter sessão própria após o login. O JWT devolvido pelo
  sistema de origem MUST NOT ser reutilizado nas requisições da central, e a expiração
  da sessão da central é independente da expiração (`exp`) do token de origem: a sessão
  expira por inatividade (prazo configurável, padrão 7 dias, renovado a cada uso) e tem
  vida máxima absoluta (configurável, padrão 30 dias), após a qual o usuário revalida na
  origem por novo login. Nenhuma requisição posterior ao login MAY depender dos sistemas
  de origem; a indisponibilidade deles MUST impedir apenas novos logins, nunca derrubar
  sessões ativas.
- **FR-005**: A plataforma MUST suportar usuários "só central" (que não existem nos 6
  sistemas), com credencial validada localmente e papel definido localmente pelo Master,
  marcados com origem "central".
- **FR-006**: A plataforma MUST suportar 4 papéis — padrão, suporte, desenvolvedor e
  Master — sendo Master um papel exclusivamente local (nunca vem da origem).
- **FR-007**: Falhas de login MUST exibir mensagens distintas e não técnicas, no mínimo
  para: credencial inválida (mensagem genérica, sem revelar sistemas consultados),
  indisponibilidade dos sistemas de origem (temporária) e usuário sem escritório
  vinculado ("usuário sem escritório vinculado — contate o suporte"). Regra de
  desambiguação: todos os sistemas consultados recusaram a credencial → credencial
  inválida; nenhum sistema conseguiu responder → indisponibilidade temporária; cenário
  misto (ao menos um recusou E ao menos um inacessível) → credencial inválida acrescida
  de aviso de indisponibilidade parcial, orientando a tentar novamente em instantes caso
  a senha pertença ao sistema indisponível. Em nenhum caso a mensagem MAY revelar qual
  sistema validou, recusou ou está fora do ar.
- **FR-008**: O usuário MUST poder encerrar a própria sessão pelo menu do avatar.
- **FR-028**: Um usuário validado na origem cujo papel traduzido seja **padrão** e cujo
  claim de escritório venha vazio MUST ter o login bloqueado com a mensagem do FR-007;
  se o papel traduzido for suporte, desenvolvedor ou Master (suporte+), o login MUST
  prosseguir sem vínculo de escritório.
- **FR-029**: A tentativa de login MUST respeitar um teto total de tempo (~10 segundos)
  para percorrer a sequência dos 6 sistemas, com limite de espera curto por sistema
  (configurável, ex.: 3 segundos). Estourado o teto sem nenhuma resposta autoritativa, a
  tentativa MUST ser tratada como indisponibilidade (FR-007). Ambos os valores MUST ser
  configuráveis por ambiente, sem deploy de código.

**Autorização**

- **FR-009**: Toda permissão MUST ser verificada no servidor a cada operação; ocultar
  itens na interface é cortesia de experiência, nunca a regra de segurança. Acesso
  direto por endereço a telas/operações não permitidas MUST ser negado pelo servidor.
- **FR-010**: O módulo EAD interno MUST ser acessível apenas a suporte, desenvolvedor e
  Master ("suporte+"), tanto no item do rail quanto no acesso direto.
- **FR-011**: As telas e operações de gerência (escritórios, usuários e mapeamento de
  papéis) MUST ser acessíveis apenas ao Master.

**Entidades e dados**

- **FR-012**: Um escritório MUST poder ter vários usuários; cada usuário de papel
  **padrão** MUST pertencer a exatamente um escritório; usuários suporte+ MAY não ter
  escritório (funcionários internos). O escritório MUST ser identificável pelo CNPJ.
- **FR-013**: A plataforma MUST armazenar os produtos contratados de cada escritório como
  dado informativo; nesta fase (e em todo o v1) esse vínculo MUST NOT bloquear nenhum
  acesso ou conteúdo.
- **FR-014**: A plataforma MUST registrar todo acesso (login e troca de produto
  selecionado) com usuário, produto selecionado (quando houver) e data — registro bruto,
  sem nenhuma lógica construída sobre ele nesta fase.

**Casca e navegação** (conforme `docs/layout-navegacao-claude-design.md`)

- **FR-015**: A casca MUST ter três regiões fixas: top bar (logo, seletor de produto,
  busca e avatar), rail lateral de ícones e área de conteúdo.
- **FR-016**: O rail MUST iniciar recolhido (apenas ícones), expandir como overlay no
  hover em desktop (sem empurrar o conteúdo) e por toque em telas de toque; cada ícone
  MUST ter tooltip e rótulo acessível; o item ativo MUST ser destacado em laranja
  conforme os tokens do brief visual.
- **FR-017**: O rail MUST listar, nesta ordem: Dashboard, Base de conhecimento, EAD,
  Atualizações e EAD interno (este último visível só para suporte+).
- **FR-018**: Cada módulo MUST abrir como tela placeholder identificada nesta fase; a
  navegação entre módulos MUST funcionar de ponta a ponta.
- **FR-019**: O seletor de produto MUST exibir os 6 produtos da empresa
  (independentemente de contrato) e atuar como filtro global "grudento": a seleção
  persiste entre telas e entre sessões do mesmo usuário, até ser trocada.
- **FR-020**: Dentro do módulo EAD interno, o seletor de produto MUST aparecer
  desabilitado/atenuado com explicação ("EAD interno é organizado por temas") e voltar
  ao normal — com a seleção anterior — ao sair do módulo.
- **FR-021**: O menu do avatar MUST exibir nome, papel e escritório (quando houver) do
  usuário e a ação de sair.
- **FR-022**: A casca MUST ser responsiva conforme o doc de layout: em mobile, o rail
  vira barra inferior de ícones.

**Gerência do Master**

- **FR-023**: O Master MUST poder criar, editar e listar escritórios e
  vincular/desvincular produtos contratados de cada escritório, inteiramente pela
  interface.
- **FR-024**: O Master MUST poder criar, editar e desativar usuários só central,
  definindo nome, e-mail, senha, escritório e papel local. Usuário desativado MUST NOT
  conseguir logar, e suas sessões existentes MUST deixar de valer no próximo acesso ao
  servidor.
- **FR-025**: Usuários espelhados dos 6 sistemas MUST aparecer na gerência em modo
  somente leitura, com indicação visível de que papel e dados vêm do sistema de origem.
- **FR-026**: A exclusão de escritório com usuários vinculados MUST ser impedida, com
  orientação ao Master sobre como proceder.
- **FR-027**: Nenhuma operação de negócio desta fase MAY exigir acesso direto ao banco de
  dados ou novo deploy; tudo MUST ser operável pela interface pelo papel dono da
  operação. Isso inclui o mapeamento role/nivel → papel da central (FR-002).

### Key Entities

- **Escritório**: o cliente da empresa. Identificado por CNPJ (chave de espelhamento
  vinda dos claims da origem), tem nome, vários usuários e um conjunto de produtos
  contratados (dado informativo no v1).
- **Usuário**: pessoa que acessa a central. Tem nome, e-mail, papel (padrão, suporte,
  desenvolvedor ou Master), origem (espelhado do sistema / cadastro local da central).
  Usuário padrão pertence a exatamente um escritório; suporte+ pode não ter escritório.
  Quando origem = sistema, papel e dados são ressincronizados a cada login e não são
  editáveis localmente.
- **Produto**: um dos 6 produtos da empresa. Catálogo fixo nesta fase; é a dimensão de
  navegação do conteúdo de cliente.
- **Vínculo escritório–produto**: quais produtos cada escritório contrata. Autoritativo
  como dado, sem efeito de bloqueio no v1.
- **Mapeamento de papel**: tradução configurável de `role`/`nivel` dos sistemas de
  origem para o papel da central (padrão, suporte ou desenvolvedor). Editável pela
  interface; dono: Master. O conteúdo real do mapa é fornecido pelo Product Owner.
- **Registro de acesso**: evento bruto de uso — usuário, produto selecionado (opcional) e
  data. Sem lógica derivada nesta fase.
- **Sessão**: vínculo autenticado entre usuário e plataforma após o login, independente
  dos sistemas de origem e do `exp` do token deles, carregando o papel vigente no
  momento do login.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para 100% dos 4 papéis, o login apresenta a navegação correta: EAD interno
  visível e acessível para suporte, desenvolvedor e Master; invisível e negado no
  servidor para o papel padrão.
- **SC-002**: Com os 6 sistemas de origem indisponíveis, 100% das sessões ativas
  continuam operando todas as telas da fase, e 100% das tentativas de novo login
  recebem mensagem clara de indisponibilidade em até 10 segundos.
- **SC-003**: Uma mudança de papel feita no sistema de origem reflete na central no
  próximo login do usuário em 100% dos casos, sem qualquer ação administrativa.
- **SC-004**: O Master executa 100% das operações desta fase (escritórios, produtos
  contratados, usuários só central, mapeamento de papéis) pela interface, sem nenhum
  acesso direto ao banco e sem deploy.
- **SC-005**: Em condições normais dos sistemas de origem, o usuário completa o login e
  vê a tela inicial em até 10 segundos.
- **SC-006**: O produto selecionado persiste em 100% das navegações entre módulos e
  entre sessões do mesmo usuário, até ser trocado.
- **SC-007**: 100% dos logins e trocas de produto geram registro de acesso com usuário,
  produto (quando aplicável) e data.
- **SC-008**: Um usuário que conhece as ferramentas da empresa entra pela primeira vez e
  alcança qualquer módulo do rail sem instrução ou treinamento prévio.

## Assumptions

- **Primeiro Master**: o primeiro usuário Master é provisionado na implantação da
  plataforma (semente inicial); a partir dele, todos os demais usuários só central são
  criados pela interface. Esse bootstrap é a única exceção aceita ao "tudo pela
  interface", por ser anterior à existência da própria interface.
- **Papel Master é sempre local**: os sistemas de origem só devolvem role/nivel
  traduzíveis para padrão, suporte ou desenvolvedor; Master existe apenas como papel
  local da central.
- **Mapa de papéis fornecido pelo PO**: a estrutura do mapeamento role/nivel → papel é
  desta fase; o conteúdo real do mapa será fornecido pelo Product Owner antes do
  `/speckit-plan` e carregado como dado (semente/configuração), não como código.
- **Claims não usados nesta fase**: `Inadimplencia` e `primeiro_acesso` são recebidos no
  retorno do SSO mas não disparam nenhuma regra nesta fase (poderão alimentar regras
  futuras; registrá-los é opcional).
- **Ambiente de desenvolvimento**: desenvolvimento e testes usam o ambiente de
  homologação do SSO (URL própria, também via variável de ambiente), nunca produção.
- **Catálogo de produtos**: os 6 produtos são dados de configuração/semente nesta fase;
  não há tela de CRUD de produtos no escopo desta fase (o catálogo é estável; gerência
  de produtos pode entrar em fase futura se necessário).
- **Busca na top bar**: o campo de busca aparece na casca (conforme layout), mas sem
  função nesta fase — a busca real pertence à fase da base de conhecimento. Estado
  desabilitado/placeholder é aceitável.
- **Produto inicial**: no primeiro acesso de um usuário sem seleção anterior, a
  plataforma seleciona o primeiro produto contratado do escritório dele (ou o primeiro
  do catálogo, se o escritório não contratar nenhum ou o usuário não tiver escritório);
  a partir daí vale a regra do "grudento".
- **Senhas de usuários só central**: a central guarda credenciais apenas desses
  usuários, com armazenamento seguro padrão de mercado; usuários espelhados não têm
  senha na central (a validação é sempre na origem, via endpoint SSO).
- **Duração da sessão**: política deslizante + teto absoluto (ver Clarifications); os
  prazos (padrões 7 e 30 dias) são configuração da plataforma, ajustáveis sem deploy de
  código.
- **Módulos placeholder**: Dashboard, Base de conhecimento, EAD, Atualizações e EAD
  interno são telas identificadas, sem conteúdo funcional nesta fase.
