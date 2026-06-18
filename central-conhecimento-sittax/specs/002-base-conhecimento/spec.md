# Feature Specification: Base de Conhecimento — Conteúdo, Blocos Internos, Edição e Import

**Feature Branch**: `002-base-conhecimento`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "Construir o módulo Base de Conhecimento sobre a fundação existente: hierarquia Produto → Módulo → Tópico (→ subtópicos) com páginas em markdown; leitura com árvore lateral recolhível, breadcrumb e anterior/próximo; blocos especiais :::nota-interna/:::nota-tecnica (só suporte+) e :::video, com sanitização server-side obrigatória; edição de texto e árvore por suporte e dev com validação de permissão por bloco no salvamento; upload de imagens servidas só a sessão autenticada; importador de vault do Obsidian."

**Fontes da verdade**: regra de negócio em `docs/escopo-plataforma-conhecimento-v2.md` (§6.1); UI/navegação em `docs/layout-navegacao-claude-design.md` (§5); governança em `.specify/memory/constitution.md` (Princípio III é NÃO NEGOCIÁVEL nesta feature). Nomenclatura: papel de usuário comum = **padrão** (decisão #13 do escopo); "cliente" designa só a entidade comercial.

## Clarifications

### Session 2026-06-10

- Q: A busca faz parte desta fase ou fica para fase futura? → A: **Nesta fase**: busca
  textual sobre títulos e conteúdo dos tópicos do produto ativo, com resultados
  saneados por papel (conteúdo interno jamais aparece para papel padrão).
- Q: Qual o limite de profundidade de subtópicos abaixo de Módulo → Tópico? → A:
  **5 níveis de tópico** abaixo do módulo; criar/mover além disso é rejeitado, e o
  importador achata níveis mais profundos com aviso no relatório.
- Q: O que acontece ao excluir um módulo que contém tópicos? → A: **Bloqueada com
  orientação** — só módulo vazio pode ser excluído (mesma regra da exclusão de tópico
  com filhos e do escritório com usuários na Feature 001).
- Decisões técnicas confirmadas pelo PO (registradas para o plano; não reabrir):
  markdown como texto no Postgres (sem CMS externo); sanitização server-side com
  pipeline remark + remark-directive em **função única** reutilizada por todos os
  endpoints; editor Milkdown; renderização no front com react-markdown +
  remark-directive sobre markdown já saneado; imagens em filesystem/MinIO servidas
  pelo app.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Leitura navegável da base do produto ativo (Priority: P1)

Um usuário logado abre o módulo Base de conhecimento e lê a documentação do produto selecionado no seletor global. Dentro da tela há um painel lateral recolhível com a árvore `Módulo → Tópico → subtópicos` do produto ativo; o tópico atual fica destacado com os ancestrais abertos. No topo, um breadcrumb clicável `Produto › Módulo › Tópico`; no rodapé, navegação Anterior/Próximo entre tópicos irmãos. O conteúdo do tópico é markdown renderizado, incluindo vídeos embutidos via bloco `:::video`.

**Why this priority**: É o valor central do módulo — sem leitura navegável não existe base de conhecimento. Todas as demais histórias (segurança, edição, import) qualificam ou alimentam esta.

**Independent Test**: Com conteúdo semeado em dois produtos, navegar pela árvore, breadcrumb e Anterior/Próximo como papel padrão e confirmar que tudo responde ao produto do seletor global (quickstart desta feature).

**Acceptance Scenarios**:

1. **Given** um produto selecionado com conteúdo publicado, **When** o usuário abre a Base, **Then** vê a árvore do produto ativo no painel lateral e o conteúdo de um tópico na área principal.
2. **Given** um tópico aberto, **When** a tela renderiza, **Then** o tópico atual aparece destacado na árvore com todos os ancestrais expandidos.
3. **Given** um tópico aberto, **When** o usuário clica em "Ocultar árvore", **Then** o conteúdo passa a ocupar a largura total e o botão vira "Mostrar árvore" (o estado vale enquanto navega na Base).
4. **Given** um tópico aberto, **When** o usuário clica em um nível do breadcrumb `Produto › Módulo › Tópico`, **Then** navega para aquele nível.
5. **Given** um tópico com irmãos no mesmo módulo, **When** o usuário usa Anterior/Próximo, **Then** navega entre os irmãos na ordem definida da árvore; no primeiro/último irmão o controle correspondente fica desabilitado/oculto.
6. **Given** o usuário troca o produto no seletor global, **When** a Base recarrega, **Then** árvore e conteúdo passam a ser os do novo produto.
7. **Given** um tópico com bloco `:::video`, **When** a página renderiza, **Then** o vídeo aparece embutido na posição do bloco.
8. **Given** uma tela móvel, **When** o usuário abre a Base, **Then** a árvore aparece como gaveta/acordeão recolhido no topo da tela (doc de layout §6).

---

### User Story 2 - Blocos internos jamais chegam ao papel padrão (Priority: P1)

Tópicos podem conter blocos `:::nota-interna` e `:::nota-tecnica`, visíveis apenas para suporte, desenvolvedor e Master. Para uma sessão de papel padrão, o texto desses blocos é removido **no servidor, antes de a resposta sair da API** — não aparece em nenhum byte de nenhuma resposta (página, busca ou qualquer outro endpoint). Para suporte+ os blocos aparecem com distinção visual clara.

**Why this priority**: Princípio III da constituição (NÃO NEGOCIÁVEL). Vazamento de nota interna para um escritório-cliente é o pior defeito possível do módulo; a regra nasce junto com a primeira tela de leitura.

**Independent Test**: Teste automatizado obrigatório: cria tópico com nota interna e nota técnica, requisita como papel padrão e verifica que o texto interno não aparece em nenhum byte da resposta; requisita como suporte e verifica presença.

**Acceptance Scenarios**:

1. **Given** um tópico com `:::nota-interna` e `:::nota-tecnica`, **When** uma sessão de papel padrão requisita a página (ou qualquer endpoint que devolva conteúdo), **Then** nenhum byte do texto interno está presente em nenhuma resposta do servidor.
2. **Given** o mesmo tópico, **When** uma sessão suporte, dev ou Master requisita, **Then** os blocos internos aparecem com distinção visual (identificação do tipo de bloco).
3. **Given** a regra de sanitização, **When** qualquer novo endpoint desta feature devolve conteúdo de tópico, **Then** ele passa pela mesma função única de sanitização server-side (não há segundo caminho).
4. **Given** a suíte de testes, **When** ela roda, **Then** existe teste automatizado cobrindo o cenário 1 de ponta a ponta, e a feature não é aceita com esse teste vermelho.

---

### User Story 3 - Edição de texto e árvore por suporte e dev (Priority: P2)

Suporte e desenvolvedor (Master herda) editam o conteúdo dos tópicos em um editor de blocos markdown-nativo com menu de `/`, e gerenciam a árvore: criar, renomear, mover, ordenar e definir pai/filho de módulos e tópicos. A permissão por bloco é validada no salvamento: suporte pode criar/editar `:::nota-interna`, mas **não** `:::nota-tecnica` (exclusiva de dev) — como o editor é texto livre, o servidor rejeita a gravação de suporte que crie ou altere um bloco `nota-tecnica`, com mensagem clara.

**Why this priority**: Sem edição a base só nasce via import; a regra de permissão por bloco é a segunda regra de negócio crítica do módulo. Depende da leitura (US1) para visualizar o resultado.

**Independent Test**: Como suporte, criar tópico com texto e nota interna (sucesso), tentar salvar nota técnica (rejeição com mensagem); como dev, salvar nota técnica (sucesso); reorganizar a árvore e confirmar a nova ordem na leitura.

**Acceptance Scenarios**:

1. **Given** uma sessão de suporte ou dev, **When** abre um tópico na leitura, **Then** vê um botão **Editar** que abre o tópico em editor de blocos com menu de `/`, podendo alterar e salvar; papel padrão não vê o botão (e o acesso direto ao endereço de edição é negado pelo servidor).
2. **Given** uma sessão de suporte, **When** salva markdown que cria ou altera um bloco `:::nota-tecnica`, **Then** a gravação é rejeitada no servidor com mensagem clara, sem persistir nada.
3. **Given** uma sessão de suporte, **When** salva markdown contendo um bloco `:::nota-tecnica` pré-existente e inalterado, **Then** a gravação é aceita (editar o resto da página não exige apagar a nota técnica de outrem).
4. **Given** uma sessão de dev, **When** salva markdown com `:::nota-tecnica`, **Then** a gravação é aceita.
5. **Given** uma sessão de suporte ou dev, **When** cria, renomeia, move, reordena ou redefine pai/filho de módulos e tópicos do produto, **Then** a árvore reflete a mudança imediatamente na leitura.
6. **Given** uma sessão de papel padrão, **When** tenta acessar qualquer tela ou operação de edição (inclusive por endereço direto), **Then** o servidor nega.
7. **Given** uma tentativa de mover um tópico para dentro de um descendente dele mesmo, **When** o usuário confirma, **Then** a operação é rejeitada com orientação (não há ciclos na árvore).

---

### User Story 4 - Imagens no conteúdo (Priority: P3)

Quem edita envia imagens pelo próprio editor; a plataforma as armazena e as serve apenas para sessões autenticadas. As imagens aparecem no conteúdo renderizado.

**Why this priority**: Documentação real precisa de prints e diagramas, mas a base funciona sem imagens — complementa a edição (US3).

**Independent Test**: Subir imagem pelo editor, vê-la renderizada no tópico; requisitar a URL da imagem sem sessão e confirmar a negativa; com sessão de qualquer papel, confirmar o acesso.

**Acceptance Scenarios**:

1. **Given** uma sessão de suporte ou dev no editor, **When** envia uma imagem, **Then** ela é armazenada pela plataforma e inserida no markdown do tópico.
2. **Given** uma imagem armazenada, **When** uma requisição sem sessão válida tenta acessá-la, **Then** o acesso é negado.
3. **Given** uma imagem armazenada, **When** qualquer sessão autenticada a requisita, **Then** a imagem é servida — inclusive imagens usadas dentro de notas internas (débito aceito do v1, registrado; correção com checagem de papel fica para v2).

---

### User Story 5 - Importador de vault do Obsidian (Priority: P3)

Um editor (suporte ou dev) importa uma pasta de arquivos `.md` exportada do Obsidian para dentro de um produto: as pastas viram hierarquia de módulos/tópicos, o frontmatter é aproveitado (ex.: título, ordem), os `[[wikilinks]]` são convertidos em links internos entre tópicos e as imagens referenciadas são migradas para o armazenamento da plataforma. Ao final, um relatório resume o que foi importado e o que precisou de atenção.

**Why this priority**: É o caminho de carga do acervo já existente — acelera a adoção, mas a base funciona sem ele (conteúdo pode nascer pelo editor).

**Independent Test**: Importar uma vault real do Obsidian (com subpastas, frontmatter, wikilinks e imagens) para um produto e conferir hierarquia, links e imagens na leitura, mais o relatório da operação.

**Acceptance Scenarios**:

1. **Given** uma vault do Obsidian com subpastas e arquivos `.md`, **When** o editor a importa para um produto escolhido, **Then** as pastas viram a hierarquia módulo→tópico→subtópicos e cada arquivo vira um tópico com seu conteúdo.
2. **Given** arquivos com frontmatter, **When** a importação roda, **Then** os metadados reconhecidos são aproveitados (título do tópico; demais campos ignorados sem erro).
3. **Given** conteúdo com `[[wikilinks]]` entre arquivos da vault, **When** a importação conclui, **Then** os wikilinks viram links internos navegáveis entre os tópicos importados; wikilinks sem destino viram texto simples e entram no relatório como aviso.
4. **Given** imagens referenciadas nos arquivos, **When** a importação conclui, **Then** as imagens foram migradas para o armazenamento da plataforma e as referências apontam para elas.
5. **Given** o término da importação, **When** o editor consulta o resultado, **Then** vê relatório com totais (tópicos, imagens) e avisos (links quebrados, arquivos ignorados).

---

### User Story 6 - Busca na base do produto ativo (Priority: P2)

O usuário digita um termo no campo de busca da top bar (habilitado a partir desta fase) e recebe os tópicos do produto ativo cujo título ou conteúdo contém o termo, com título e trecho clicáveis. Os resultados respeitam o papel: para papel padrão, a busca opera exclusivamente sobre conteúdo já saneado — termo que só ocorre dentro de nota interna/técnica não gera resultado nem trecho.

**Why this priority**: A busca multiplica o valor da leitura (US1) e é a segunda superfície por onde conteúdo interno poderia vazar — nasce junto com a regra de sanitização (US2), consumindo a mesma função única.

**Independent Test**: Com conteúdo semeado (incluindo um termo que só existe dentro de nota interna), buscar como papel padrão (zero resultados internos) e como suporte (resultado presente); teste automatizado cobre o caso de vazamento.

**Acceptance Scenarios**:

1. **Given** um produto ativo com conteúdo, **When** o usuário busca um termo presente em título ou corpo de tópicos, **Then** vê lista de resultados (título + trecho) do produto ativo e clicar abre o tópico.
2. **Given** uma sessão de papel padrão e um termo que só ocorre dentro de `:::nota-interna` ou `:::nota-tecnica`, **When** ela busca, **Then** recebe zero resultados desse conteúdo e nenhum byte interno aparece em nenhum trecho.
3. **Given** uma sessão suporte+, **When** busca um termo presente em nota interna, **Then** o resultado aparece com o trecho correspondente.
4. **Given** um termo sem nenhuma ocorrência, **When** o usuário busca, **Then** vê estado vazio claro, sem erro.
5. **Given** o produto X selecionado e um termo que só ocorre em tópicos do produto Y, **When** o usuário busca, **Then** recebe zero resultados — nem título, nem trecho, nem contagem de outro produto (a busca é estritamente do produto ativo, Princípio V).

---

### Edge Cases

- Produto selecionado sem nenhum conteúdo: a Base mostra estado vazio claro ("ainda não há conteúdo para este produto"), sem erro.
- Markdown com directive malformada (ex.: `:::nota-interna` sem fechamento): a renderização não quebra a página; na dúvida, o conteúdo do bloco malformado é tratado como interno (falha fechada — nunca vaza para papel padrão).
- Tópico aberto por URL direta de outro produto (não o selecionado): a tela resolve de forma consistente — o produto do tópico passa a ser o selecionado (o seletor é a dimensão suprema, e a URL identifica o conteúdo).
- Exclusão de tópico com filhos: bloqueada com orientação (mover ou excluir os filhos antes) — nenhum conteúdo órfão.
- Dois editores salvam o mesmo tópico quase ao mesmo tempo: vale a última gravação (escala pequena, sem trava de edição no v1); nenhum estado corrompido.
- Import executado duas vezes da mesma vault: a importação cria sempre conteúdo novo sob o destino escolhido; quando o identificador gerado de um tópico colide com tópico já existente do produto, ele recebe sufixo e entra no relatório como aviso de "possível duplicata" — desfazer é operação manual de árvore (sem merge automático no v1).
- Imagem referenciada no markdown que não existe no armazenamento: a página renderiza com o placeholder padrão de imagem quebrada do navegador, sem quebrar o restante.
- Anterior/Próximo em tópico sem irmãos: controles desabilitados/ocultos, sem erro.
- Criar ou mover tópico que exceda 5 níveis abaixo do módulo: operação rejeitada com
  orientação (a profundidade máxima é regra, não sugestão).
- Exclusão de módulo com tópicos: bloqueada com orientação (mover ou excluir os
  tópicos antes); módulo vazio pode ser excluído.
- Busca com termo muito curto (1–2 caracteres) ou só espaços: a interface orienta um
  termo mínimo, sem disparar consulta.

## Requirements *(mandatory)*

### Functional Requirements

**Conteúdo e hierarquia**

- **FR-001**: A plataforma MUST organizar o conteúdo na hierarquia `Produto → Módulo → Tópico (→ subtópicos aninhados)`, em que tópico é uma página de conteúdo markdown armazenada como texto no banco de dados da plataforma.
- **FR-002**: Cada módulo e tópico MUST ter posição ordenável dentro do seu nível, e tópicos MAY ter tópicos filhos (aninhamento), sem ciclos, até a profundidade máxima de **5 níveis de tópico abaixo do módulo**; criar ou mover além disso MUST ser rejeitado com orientação.
- **FR-003**: A Base MUST exibir exclusivamente o conteúdo do produto ativo no seletor global; trocar o produto MUST trocar árvore e conteúdo (Princípio V).

**Leitura e navegação** (conforme doc de layout §5)

- **FR-004**: A tela da Base MUST ter painel lateral com a árvore do produto ativo, recolhível por controle "Ocultar árvore"/"Mostrar árvore"; a árvore só existe dentro da Base — some nos demais módulos.
- **FR-005**: A árvore MUST destacar o tópico atual e manter os ancestrais abertos.
- **FR-006**: Cada tópico MUST exibir breadcrumb clicável `Produto › Módulo › Tópico` no topo.
- **FR-007**: Cada tópico MUST oferecer navegação Anterior/Próximo entre tópicos irmãos do mesmo nível, na ordem da árvore.
- **FR-008**: O markdown MUST ser renderizado com suporte aos blocos especiais; `:::video` MUST embutir o vídeo referenciado na posição do bloco.
- **FR-009**: Em telas móveis, a árvore MUST aparecer como gaveta/acordeão no topo da tela, recolhida por padrão (doc de layout §6).

**Blocos internos e sanitização (REGRA CRÍTICA — Princípio III, NÃO NEGOCIÁVEL)**

- **FR-010**: Os blocos `:::nota-interna` e `:::nota-tecnica` MUST ser visíveis apenas para suporte, desenvolvedor e Master, com distinção visual do tipo de bloco.
- **FR-011**: Para sessão de papel padrão, a remoção dos blocos internos MUST acontecer no servidor, antes de o conteúdo sair da API: o texto interno MUST NOT aparecer em nenhum byte de nenhuma resposta — corpo de página, resultado de busca ou qualquer outro endpoint. Filtrar apenas na interface não atende.
- **FR-012**: A sanitização MUST ser uma função única server-side, reutilizada por todo endpoint que devolva conteúdo de tópico (atual ou futuro); criar um segundo caminho de saída de conteúdo sem ela é defeito bloqueante.
- **FR-013**: Um teste automatizado MUST cobrir: tópico com nota interna e nota técnica é requisitado como papel padrão — em página E em busca — e nenhum byte do texto interno aparece em nenhuma resposta; como suporte+, o conteúdo aparece. A feature MUST NOT ser aceita com esse teste falhando.
- **FR-014**: Directive interna malformada (sem fechamento) MUST falhar fechada: na renderização para papel padrão, o conteúdo a partir da abertura do bloco malformado não é exibido.

**Edição**

- **FR-015**: Suporte e desenvolvedor (Master herda) MUST poder editar o conteúdo dos tópicos em editor de blocos markdown-nativo com menu de `/`; papel padrão MUST NOT ter acesso a nenhuma tela ou operação de edição (negado no servidor).
- **FR-016**: Suporte e desenvolvedor MUST poder gerenciar a árvore do produto: criar, renomear, mover, reordenar e definir pai/filho de módulos e tópicos; mover para um descendente de si mesmo MUST ser rejeitado. Mover tópico é restrito a módulos do MESMO produto no v1 — mover entre produtos não é suportado (o caminho é exportar/reimportar) e MUST ser rejeitado com orientação.
- **FR-017**: A permissão por bloco MUST ser validada no salvamento, no servidor: gravação de sessão de suporte que **crie ou altere** um bloco `:::nota-tecnica` MUST ser rejeitada com mensagem clara, sem persistir nada; blocos `nota-tecnica` pré-existentes e inalterados MUST NOT impedir o suporte de salvar o restante da página. Dev e Master MUST poder criar/editar ambos os blocos.
- **FR-018**: Exclusão de tópico com filhos e exclusão de módulo com tópicos MUST ser impedidas com orientação (mover ou excluir o conteúdo antes); exclusão de tópico sem filhos e de módulo vazio MUST ser permitida a suporte e dev.

**Imagens**

- **FR-019**: O editor MUST permitir upload de imagens, armazenadas pela própria plataforma e inseridas no markdown do tópico.
- **FR-020**: Imagens MUST ser servidas somente para sessões autenticadas; requisição sem sessão válida MUST ser negada.
- **FR-021**: Débito aceito do v1 (registrado): imagem embutida em nota interna fica acessível por URL direta a qualquer usuário logado, sem checagem de papel; a correção (checagem de papel no serve) é compromisso de v2 e MUST constar do roadmap.

**Importador Obsidian**

- **FR-022**: Suporte e desenvolvedor MUST poder importar uma pasta de arquivos `.md` (vault do Obsidian) para um produto escolhido: pastas viram hierarquia módulo→tópico, cada arquivo vira um tópico; pastas mais profundas que o limite de 5 níveis de tópico são achatadas no último nível permitido, com aviso no relatório.
- **FR-023**: A importação MUST aproveitar o frontmatter reconhecido (no mínimo o título); campos não reconhecidos são ignorados sem erro.
- **FR-024**: A importação MUST converter `[[wikilinks]]` com destino na vault em links internos entre os tópicos importados; wikilinks sem destino viram texto simples e geram aviso.
- **FR-025**: A importação MUST migrar as imagens referenciadas para o armazenamento da plataforma e reescrever as referências.
- **FR-026**: Ao final, a importação MUST apresentar relatório com totais e avisos (tópicos criados, imagens migradas, links quebrados, arquivos ignorados).

**Autorização**

- **FR-027**: Toda permissão desta feature MUST ser verificada no servidor a cada operação, na camada única de autorização da plataforma (Princípios II e VI); esconder controles na interface é cortesia, nunca a regra.

**Busca**

- **FR-028**: O campo de busca da top bar MUST passar a funcionar nesta fase: busca textual sobre títulos e conteúdo dos tópicos do **produto ativo**, com resultados (título + trecho) clicáveis que abrem o tópico. Tópicos de outros produtos MUST NOT aparecer em resultados, trechos ou contagens — o isolamento por produto MUST ser coberto pelo mesmo teste automatizado do FR-013.
- **FR-029**: A busca MUST respeitar o papel da sessão: para papel padrão, a consulta opera exclusivamente sobre conteúdo já saneado pela função única (FR-012) — termo que só ocorre em bloco interno MUST NOT gerar resultado nem trecho; suporte+ MUST encontrar também o conteúdo interno.
- **FR-030**: Busca sem nenhuma ocorrência MUST exibir estado vazio claro; termo abaixo do mínimo (1–2 caracteres ou vazio) MUST ser orientado sem disparar consulta.

### Key Entities

- **Módulo (de conteúdo)**: agrupador de tópicos dentro de um produto; tem nome e ordem. Pertence a exatamente um produto.
- **Tópico**: página de conteúdo em markdown; tem título, conteúdo, ordem, módulo e pai opcional (subtópico). A hierarquia não admite ciclos e tem profundidade máxima de 5 níveis de tópico abaixo do módulo.
- **Imagem/Anexo**: arquivo enviado pelo editor, armazenado pela plataforma, referenciado pelo markdown; servido apenas a sessão autenticada.
- **Importação**: operação que transforma uma vault do Obsidian em hierarquia de conteúdo de um produto, com relatório de resultado (totais e avisos).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das respostas do servidor a sessões de papel padrão, nenhum byte de conteúdo de `:::nota-interna`/`:::nota-tecnica` está presente — verificado por teste automatizado que bloqueia a aceitação da feature.
- **SC-002**: 100% das tentativas de suporte de criar/alterar `:::nota-tecnica` são rejeitadas com mensagem clara, e 100% das gravações equivalentes de dev são aceitas.
- **SC-003**: Um leitor alcança qualquer tópico do produto ativo a partir da tela inicial da Base usando só árvore e breadcrumb, sem instrução prévia; árvore, breadcrumb e Anterior/Próximo se comportam conforme o doc de layout §5 em desktop e mobile.
- **SC-004**: A importação de uma vault real do Obsidian preserva 100% da hierarquia de pastas e 100% das imagens referenciadas, com relatório fiel (totais + avisos).
- **SC-005**: Tópicos abrem com resposta percebida instantânea em rede local (mesma régua da casca: <300ms de server-render em condições normais).
- **SC-006**: Trocar o produto no seletor reflete árvore e conteúdo do novo produto em 100% das navegações.
- **SC-007**: Em 100% das buscas de sessões de papel padrão, termos que só ocorrem em blocos internos retornam zero resultados e zero trechos — verificado pelo mesmo teste automatizado bloqueante do SC-001.
- **SC-008**: Buscas no acervo da fase (escala pequena, milhares de tópicos) retornam resultados com resposta percebida instantânea em rede local (<1s).

## Assumptions

- **Busca nesta fase (clarify 2026-06-10)**: o campo da top bar é habilitado e busca títulos e conteúdo dos tópicos do produto ativo (Base apenas — outros módulos não são pesquisáveis no v1); o endpoint de busca consome a mesma função única de sanitização (FR-012/FR-029).
- **Sem versionamento/histórico de edições no v1**: salvar substitui o conteúdo; histórico é candidato a fase futura.
- **Sem fluxo de rascunho/publicação**: salvar publica imediatamente (a base é interna à empresa e a escala é pequena).
- **Edição concorrente**: vale a última gravação; sem trava de edição no v1.
- **`:::video`**: embute vídeos por URL/ID (mesma premissa de vídeos não listados do escopo §6.2); o bloco não é interno — é visível a todos os papéis.
- **Quem importa**: a importação é dos mesmos donos da edição (suporte e dev; Master herda).
- **Origem do import**: a vault chega como pasta/arquivo enviado pela interface; importação é operação pela interface (Princípio VIII), não comando de servidor.
- **Fundação reutilizada**: sessão, papéis, seletor de produto grudento e a casca da Feature 001 são pré-requisitos e não mudam aqui; as novas tabelas de conteúdo entram na mesma camada única de autorização.
- **Conteúdo por produto**: todo conteúdo da Base pertence a um produto (dimensão suprema); não há conteúdo "global" no v1.
