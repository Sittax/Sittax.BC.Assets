# Escopo — Central de Conhecimento & Identidade (v2 — Spec Kit ready)

> Documento de escopo do v1, revisado. Base para a **constitution** e as primeiras specs no Spec Kit.
> Status: **todas as decisões resolvidas** (nenhuma pendência aberta).
> Documentos irmãos: `layout-navegacao-claude-design.md` (fonte da verdade de **UI/navegação**) e `brief-visual-claude-design.md` (identidade visual). Este documento é a fonte da verdade de **regra de negócio e dados**.

---

## 1. Propósito

Uma plataforma central que serve os **6 produtos internos** da empresa, funcionando como **camada de identidade + engajamento**. Em cima dela rodam a base de conhecimento, o EAD (cliente e interno), o dashboard e as release notes.

Ela existe para: capacitar e **certificar** os escritórios (clientes) via EAD, dar suporte/documentação organizada, e comunicar novidades e atualizações — tudo num lugar só, vendido como um hub de soluções.

---

## 2. Usuários e papéis

**Entidades**
- **Escritório** (cliente) → tem vários **usuários**.
- **Usuário** pertence a **um único** escritório.

**Origem do papel — premissa central**

O papel do usuário (padrão, suporte ou dev) **não é cadastrado na plataforma**: ele vem do cadastro do usuário **nas 6 plataformas de origem**, trazido pelo SSO no momento da validação do login (§3). A central **espelha** o papel; não o inventa. Sincronização ocorre a cada login.

**Premissa de consistência:** os papéis não conflitam entre sistemas — quem é usuário de escritório (papel padrão) é padrão em todos; quem é suporte+ (funcionário) é suporte+ em todos. Portanto **não existe regra de desempate**: vale o papel do primeiro sistema que validar a credencial. (Se essa premissa um dia quebrar, a regra a adotar é "vale o papel mais alto" — registrado aqui pra não virar decisão de corredor.)

**Exceção:** usuários e escritórios que existem **só na base de conhecimento** (não estão em nenhum dos 6 sistemas) podem ser cadastrados manualmente pelo Master, com papel definido localmente.

**Papéis** (escala crescente)

| Papel | Pode |
|---|---|
| **Padrão** | Ver conteúdo padrão, fazer EAD, ver dashboard — é o usuário comum dos escritórios-cliente |
| **Suporte** | Tudo do padrão + ver blocos internos + **editar texto e árvore da base de conhecimento** + criar `:::nota-interna` (mas **não** `:::nota-tecnica`) |
| **Desenvolvedor** | Tudo do suporte + criar `:::nota-tecnica` + **gerenciar EADs (cliente e interno)** + postar novidades/lives + escrever release notes |
| **Master (admin)** | Tudo + cadastrar usuários/escritórios exclusivos da central, vincular produtos contratados e configurar a plataforma |

> "suporte+" = Suporte, Desenvolvedor e Master (quem enxerga conteúdo interno).
>
> **Nomenclatura (decisão #13):** o papel de usuário comum chama-se **padrão** (`padrao` em código). O termo **"cliente" é reservado exclusivamente à entidade comercial** — o escritório, identificado por CNPJ. Expressões como "EAD do cliente" e "conteúdo de cliente" referem-se ao público dos escritórios, não ao papel.

### 2.1 Operação do usuário Master (requisito de v1)

O Master administra a plataforma **inteiramente pela interface**, sem tocar em banco ou código. No v1 isso significa telas de gerência para:

1. **Usuários "só central"** — cadastrar/editar/desativar usuários que não existem nos 6 sistemas, com papel definido localmente. (Usuários vindos dos 6 sistemas têm papel **espelhado** via SSO — o Master visualiza, mas a fonte da verdade é o sistema de origem.)
2. **Escritórios** — cadastrar/editar; vincular/desvincular **produtos contratados**.
3. **Métricas** — painel com acessos, % de conclusão por usuário/escritório/produto e positivados.
4. **Configurações da plataforma.**

As gerências de conteúdo ficam com os papéis donos delas (e o Master herda tudo): **base de conhecimento** com suporte+ (§6.1), **EADs e provas** com dev (§6.2/6.3), **release notes e novidades** com dev (§6.4/6.5).

**Critério de aceite geral:** toda entidade do modelo de dados (§10) que não seja log/registro automático tem tela de CRUD acessível pela interface ao papel dono dela. Se algo só puder ser feito via SQL, o v1 não está completo.

---

## 3. Identidade e acesso

- A plataforma é o **validador de identidade** dos usuários dos 6 sistemas.
- **Premissa v1 (revisada):** os 6 sistemas compartilham um **padrão único de SSO** — endpoint `POST /api/auth/login` (body `{usuario, senha}`), resposta com JWT + dados do usuário (`id`, `nome`, `sobrenome`, `email`, `nivel`, `role`) e claims no token incluindo `EscritorioCnpj`, `EscritorioNome`, `Role`, `Nivel` e `Inadimplencia`. Cada sistema tem sua **própria base URL** (6 URLs em variáveis de ambiente, nunca em código). A plataforma valida a credencial **chamando esses endpoints diretamente, em sequência, até um validar** — **sem orquestrador intermediário (n8n descartado para o login)**. Contrato detalhado: `docs/sso-login-endpoint.md`.
- **Tradução de papel:** o mapeamento `role`/`nivel` dos sistemas → papel da central (padrao/suporte/dev) é **configurável** (tabela/configuração editável, não fixo em código); o mapa real é fornecido pelo PO.
- **Caso de borda — escritório vazio no token:** login **bloqueado** com mensagem clara ("usuário sem escritório vinculado — contate o suporte"), **exceto** se o papel traduzido for suporte+ (funcionários internos não têm escritório).
- **Sessão própria:** a validação no SSO ocorre **uma única vez, no login**. A partir daí a plataforma cria e mantém **sessão própria** (cookie httpOnly), com expiração **deslizante por inatividade (padrão 7 dias) + teto absoluto (padrão 30 dias)** — prazos configuráveis sem deploy. Nenhuma requisição depende dos endpoints de SSO após o login; indisponibilidade do SSO impede apenas **novos** logins, nunca derruba sessões ativas. Papel/escritório ressincronizam no próximo login (o teto de 30 dias garante revalidação periódica).
- **Erros de login:** se ≥1 sistema respondeu "credencial inválida" → mensagem genérica de credencial inválida; se nenhum respondeu (todos timeout/erro) → mensagem de indisponibilidade; **caso misto** (recusa + sistema inacessível na mesma tentativa) → credencial inválida com aviso de indisponibilidade parcial. Nunca revelar qual sistema validou, recusou ou está fora do ar.
- A plataforma **armazena**: o usuário, o **papel espelhado** do sistema de origem (atualizado a cada login), o escritório dele, e os produtos contratados pelo escritório. Usuários "só central" têm papel de origem local (flag `origem`).
- **Não processa pagamento.** "Cobrar acesso" = exigir credencial válida, não cobrar dinheiro.
- Login é o mesmo das ferramentas que o usuário já possui.

---

## 4. Produto como dimensão suprema (do conteúdo de cliente)

- **Seletor de produto no cabeçalho** — filtro global e "grudento" (fica até trocar). Ao selecionar um produto, toda a plataforma passa a falar só dele.
- O seletor mostra **todos os 6 produtos** (vitrine/hub), não só os contratados — favorece descoberta/cross-sell.
- **Conteúdo totalmente aberto; só o comercial difere** (princípio "ver ≠ ter").
- O contrato é **dado**, não portão. Bloqueio por contrato fica para **v3+**, mas o vínculo escritório↔produtos já é modelado e a autorização é centralizada (§7), pra ligar depois sem refatorar.
- **Exceção declarada:** o **EAD interno** organiza-se por **tema interno** e **ignora o seletor de produto** (§6.3). Dentro desse módulo, o seletor fica desabilitado/atenuado.
- **Exceção declarada:** a tela de **EAD do cliente** mostra, em **bloco secundário** ("Outros cursos recomendados"), cursos de **outros produtos que o escritório contratou** (≠ produto selecionado), de propósito, para favorecer o aprendizado dos produtos já contratados (§6.2). Cruza a dimensão de produto intencionalmente; usa **apenas produtos contratados** (dado existente, §7) — **sem lógica de lead** (§8).
- **Exceção declarada (EAD do cliente):** a tela de EAD do cliente exibe, **abaixo** dos cursos do produto selecionado, um bloco secundário **"Outros cursos recomendados"** com EADs de **outros produtos que o escritório tem contratados** (nunca o já selecionado, nunca produto não contratado). Cruza a dimensão de produto **de propósito**, para favorecer o aprendizado dos produtos já contratados (§6.2). Usa apenas o vínculo escritório↔produtos (dado existente) — **sem lógica de lead**.

**Navegação — duas camadas separadas** (detalhes de UI no doc de layout, que é a fonte da verdade de navegação):
- **Seletor de produto** (top bar) → *qual produto* você está vendo (filtro global).
- **Rail de módulos** (lateral) → *qual seção* da plataforma: `Dashboard · Base de conhecimento · EAD · Atualizações · EAD interno (só suporte+)`.
- Regra mental: trocar de **produto** muda o *conteúdo*; trocar de **módulo** muda a *tela*. EAD interno é a única exceção.

---

## 5. Métricas (armazenadas pela ferramenta)

- **Acessos** (= entradas na central) por escritório e por usuário.
- **% de conclusão do EAD** por usuário e por produto. Agregados: por escritório e base toda. O % é um **indicador vivo** (`aulas vistas ÷ total atual de aulas`) e só é exibido para inscrições **em andamento**.
- **"Escritório fez o EAD" (positivado):** vira `sim` quando **≥1 usuário do escritório conclui o EAD** daquele produto (conclusão = todas as aulas **+** aprovação na prova, §6.2). Só vale para produtos **contratados**. Como deriva de um evento imutável, **positivado nunca regride**.

> **Fora do v1:** sinal de lead (acesso/inscrição em produto não contratado). Ver §8 e §9 — recurso de versão futura distante; o `acesso_log` já registra o dado bruto, mas nenhuma lógica de lead é construída agora.

---

## 6. Módulos

### 6.1 Base de conhecimento
- **Hierarquia:** `Produto → Módulo → Tópico (→ subtópicos)`. Tópico = página, estilo GitBook/Notion.
- **Armazenamento:** markdown como **texto no Postgres** (Estrada B).
- **Blocos internos:** via *container directives* `:::` — "markdown dentro de markdown".
  - `:::nota-interna` → visível só para **suporte+**; pode ser criada por **suporte e dev**.
  - `:::nota-tecnica` → visível só para **suporte+**; pode ser criada **só por dev**.
  - `:::video` → embed de vídeo.
- **Validação no save (regra de permissão por directive):** o editor é texto livre, então um suporte poderia digitar `:::nota-tecnica` na mão. O **backend valida no salvamento**: se a sessão é de suporte e o markdown salvo cria ou altera um bloco `nota-tecnica`, a gravação é rejeitada com mensagem clara. (Mesma lógica de "decisão num lugar só": a permissão é checada no servidor, nunca só escondendo o botão no editor.)
- **Sanitização server-side (regra de segurança):** a remoção dos blocos internos acontece **na API, antes de o markdown sair do servidor**. O pipeline é `remark` + `remark-directive` rodando no backend, com um transformador único que **deleta** os nós `nota-interna`/`nota-tecnica` quando a sessão é de papel padrão. O front recebe MD já saneado e renderiza com `react-markdown`. **Markdown com conteúdo suporte+ nunca trafega para sessão de cliente** — nem no corpo da página, nem em resultados de busca, nem em qualquer outro endpoint. Critério de aceite: teste automatizado que cria tópico com nota interna, requisita como papel padrão e verifica que o texto interno não aparece em **nenhum** byte da resposta.
- **Edição:** editor de blocos **markdown-nativo (Milkdown)**, com menu de `/`.
- **Renderização:** `react-markdown` + `remark-directive` no front (sobre MD já saneado).
- **Imagens:** enviadas pelo suporte, **armazenadas pela própria ferramenta** (filesystem do servidor / MinIO), servidas pelo app **somente para sessão autenticada**.
  - **Débito conhecido (aceito no v1):** imagem embutida em `:::nota-interna` fica acessível por URL direta a qualquer usuário **logado** (a URL não checa papel, só sessão). Correção planejada: flag `interna` no storage + verificação de papel no serve (v2).
- **Import:** importador dos MDs do **Obsidian** — pastas viram hierarquia, frontmatter aproveitado, `[[wikilinks]]` convertidos, imagens migradas.
- **Gerência:** definir pai/filho, vincular a módulo/produto, ordenar — **suporte e dev**.
- **Quem edita texto e árvore:** suporte e dev (Master herda). A diferença entre os dois está só nas directives (acima).

### 6.2 EAD do cliente
- **Inscrição ("Iniciar EAD"):** o usuário precisa clicar em **Iniciar EAD** — inscrição gratuita que cria o vínculo usuário↔EAD. Só a partir daí o progresso é contado e o EAD entra no bloco "EADs em aberto" do dashboard.
- **Hierarquia:** `Produto → Módulo → Aula (ordenada)`. Aula = vídeo (YouTube **não listado**, embed) + descrição opcional em markdown.
- **Vínculo de produtos (tema multi-produto):** um EAD de cliente tem um produto **principal** (`ead_modulo.produto_id`) e pode ser **vinculado a outros produtos** via `ead_modulo_produto` (M:N), para temas que abrangem mais de um produto. O EAD aparece na trilha do principal **e** dos vinculados. Editável só por dev/master. É **exceção declarada ao §4** (cruza a dimensão de produto de propósito).
- **Conclusão de aula:** evento `ended` da YouTube IFrame Player API. Seek liberado (o % é engajamento, não esforço). O botão "Concluir e avançar" na tela do player tem o mesmo efeito (idempotente).
- **Materiais de aula:** arquivos enviados por dev/master junto da aula (PDF, XLSX, etc.), armazenados no MinIO. Visíveis a qualquer autenticado que acesse a aula. Exibidos na aba "Materiais" do player. Tabela: `aula_material`.
- **Anotações de aula:** texto privado por usuário, escrito na aba "Anotações" do player. RLS own-row (cada usuário vê só as próprias). Várias por aula. Tabela: `aula_anotacao`.
- **Trade-off aceito:** vídeo do YouTube não listado é acessível por quem tiver o link; aceitável porque o valor está na prova + certificado, não no vídeo em si.
- **Progresso:** `aulas vistas ÷ total de aulas do produto` — indicador vivo, exibido só para inscrições em andamento.
- **Prova final por EAD (por produto)** → gera **certificado**.
- **Conclusão do EAD — evento imutável:** quando o usuário completa a última aula **e** é aprovado na prova, a plataforma grava `status = concluido` + `data_conclusao` na inscrição e emite o certificado. **Esse fato nunca é revertido** — nem por inclusão de aulas novas, nem por alteração de prova. Aulas adicionadas depois ficam disponíveis e contam como engajamento, mas não reabrem a conclusão. ("Reciclagem", se um dia existir, será uma inscrição nova.)
- **Positivado** dispara quando 1 usuário conclui (e, por derivar de evento imutável, nunca regride).
- **Certificado:** nome, escritório, curso/produto, data, código de validação. Emitido para qualquer EAD concluído.
- **Quem gerencia (estrutura, aulas, provas, questões, nota de corte):** **só dev** (Master herda). Suporte e padrão apenas consomem.
- **Organização da tela (dois blocos):** (1) **"Cursos de {produto selecionado}"** — bloco principal, os EADs do produto no seletor; (2) **"Outros cursos recomendados"** — bloco secundário com EADs de **outros produtos contratados** pelo escritório (cada card com etiqueta do produto). O bloco 2 **não aparece** se o escritório só tem um produto contratado, nem para usuário sem escritório. É **exceção declarada ao §4**: mostra conteúdo de produtos ≠ selecionado de propósito, usando só **contratados** — sem lógica de lead.
- **Organização da tela (dois blocos):** **Bloco 1 — "Cursos de {produto selecionado}"** (principal, em destaque) e **Bloco 2 — "Outros cursos recomendados"** (secundário, mais leve), com EADs de **outros produtos contratados** pelo escritório, cada card com etiqueta do produto. O Bloco 2 não aparece se o escritório só tem um produto contratado (ou para usuários sem escritório). **Exceção declarada ao Princípio V** (produto = dimensão suprema), análoga à do EAD interno (§4): o cruzamento de produtos é intencional e restrito a **contratados** — sem lógica de lead.

### 6.3 EAD interno — organizado por temas, com produto opcional
- **Decisão (era a pendência do §12 do v1):** o EAD interno organiza-se em **árvore própria de temas internos** (ex.: onboarding de suporte, processos, atendimento). Um EAD interno **pode**, opcionalmente, referenciar um produto (ex.: treinamento interno sobre o Sittax Simples) — útil para relatório — mas o produto não é obrigatório nem é o eixo de navegação.
- **Modelagem:** `ead_modulo` com `produto_id` *nullable* + `tema_interno` *nullable*; check: EAD de cliente (`interno = false`) **exige** `produto_id`; EAD interno exige ao menos `tema_interno`.
- **Navegação:** dentro do módulo EAD interno, o **seletor de produto é ignorado** (desabilitado/atenuado na UI); a tela organiza por tema, com filtro opcional por produto.
- **Reaproveita** a estrutura do EAD (módulo → aula + prova + certificado + inscrição "Iniciar EAD"). Visível só para **suporte+**, com item próprio no rail.
- **Foco:** avaliação — provas por **nível** e **registro de tentativas**.
- **Tentativas:** ilimitadas, todas registradas (sem trava/cooldown).
- **Níveis:** independentes no v1 (cada nível com sua prova e seu certificado).
- **Banco de questões:** prova fixa no v1 (sorteio = futuro).
- **Sem positivado** (conceito de cliente); conclusão e certificado por colaborador, seguindo a mesma regra de **conclusão imutável** do §6.2.
- **Quem gerencia:** **só dev** (Master herda). Suporte consome (assiste, faz prova, certifica).

### 6.4 Dashboard (tela inicial)
- **EADs em aberto:** bloco com os EADs em que o usuário se inscreveu e ainda não concluiu, cada um com **botão de atalho** pra retomar de onde parou.
- **Calendário de novidades.**
- **Links de lives** cadastráveis direto no dashboard (pelo dev).
- Enriquece com informações exclusivas do **produto selecionado**.
- **Modal "novidades recentes":** feed que agrega as release notes recentes dos produtos que o usuário acessa, por data.
- ⚠️ "Novidades/lives" (calendário) ≠ "release notes" (changelog) — feeds distintos.
- **Quem posta:** desenvolvedor (e Master).

### 6.5 Release notes (menu "Atualizações")
- **Por produto** (cada nota: produto, data, versão opcional, conteúdo MD).
- v1: um "MDzão" simples. Conexão/migração com **Redmine = futuro**.
- Aparece no dashboard (notas do produto selecionado + feed agregado).
- **Quem escreve:** desenvolvedor (e Master).

---

## 7. Stack e arquitetura

- **Banco:** PostgreSQL, **on-prem/interno** (sem Supabase).
- **Autorização centralizada** via **RLS (Row-Level Security)** do Postgres — o "portão único": quem vê o quê (papel, produto) decidido num lugar só.
- **Contexto de usuário em toda transação:** como o app usa pool de conexões, **toda** transação da API inicia com `SET LOCAL app.user_id` e `SET LOCAL app.papel`; as policies de RLS leem via `current_setting(...)`. Isso é encapsulado num **helper único** (ex.: `withUser(userId, fn)`) — nenhuma query roda fora dele.
- **Sanitização de conteúdo interno:** função única no backend (pipeline remark), reutilizada por todos os endpoints que servem markdown, inclusive busca (§6.1).
- **Integração de identidade:** chamada HTTP direta aos endpoints de SSO dos 6 sistemas **no login** (§3), sem orquestrador. O n8n **não participa do login**; permanece disponível como ferramenta da empresa para automações futuras não relacionadas à identidade.
- **Front:** editor markdown-nativo (Milkdown); renderização via `react-markdown` + `remark-directive`.
- **Imagens:** filesystem/MinIO servido pelo app (sessão obrigatória).
- **Vídeos:** YouTube não listado, embed + IFrame Player API (progresso).

### 7.1 Preparado para evoluir (requisito transversal)

A plataforma será modificada e versionada continuamente. O v1 já nasce com:

- **Migrações de banco versionadas** (ferramenta de migration padrão do stack escolhido) — todo schema change é um arquivo de migração commitado; nunca alteração manual em produção.
- **Versionamento semântico da plataforma** (`MAJOR.MINOR.PATCH`) com `CHANGELOG.md` no repositório. As release notes da §6.5 são o changelog *de cara para o usuário*; o `CHANGELOG.md` é o técnico.
- **Configuração por ambiente** (variáveis de ambiente, nunca valores fixos no código): as 6 base URLs do SSO, credenciais de banco, caminho do storage de imagens, prazos de sessão.
- **Seeds de desenvolvimento:** script que popula um banco local com dados fictícios (escritórios, usuários de cada papel, 1 EAD completo) pra qualquer dev futuro subir o projeto e testar em minutos.
- **Suíte de testes mínima nas regras críticas:** sanitização de blocos internos (§6.1), conclusão imutável (§6.2), RLS por papel (§7). São os testes que impedem regressão de segurança/regra de negócio em modificações futuras.
- **Pontos de extensão já modelados, desligados:** vínculo escritório↔produto (para bloqueio v3+), `acesso_log` com `produto_id` (para lead futuro), `tema_interno` (para crescer a árvore interna). Evoluir = ligar lógica, não refatorar dado.

---

## 8. Fora de escopo (v1)

- Pagamento/cobrança.
- **Sinal de lead** (radar comercial de interesse em produto não contratado) — **versão futura distante**; apenas o registro bruto de acesso existe no v1.
- App mobile nativo (só web responsivo).
- Edição colaborativa em tempo real.
- Comentários / fórum / social.
- Multi-idioma.
- Integração/migração com Redmine.
- **Bloqueio de conteúdo por contrato** (v3+; mas o dado já é modelado).
- Motor de avaliação avançado: banco de questões sorteado, níveis progressivos, quiz por módulo.
- Checagem de papel no serve de imagens (débito conhecido, v2).

---

## 9. Roadmap

- **v1** — plataforma de pé: identidade (SSO direto nos 6 sistemas + sessão própria), base de conhecimento (markdown + directives + sanitização server-side + Milkdown + import Obsidian), EAD cliente (vídeos + prova final + certificado + positivado), EAD interno (temas + provas por nível + tentativas ilimitadas), dashboard, release notes (MDzão), **telas de gerência do Master (§2.1)**, fundação de evolução (§7.1).
- **v2** — imagens internas com checagem de papel; motor de avaliação avançado (sorteio de questões, níveis progressivos, quiz por módulo); conexão com Redmine.
- **v3+** — bloqueio de conteúdo por contrato.
- **Futuro distante** — sinal de lead / radar comercial.

---

## 10. Modelo de dados (alto nível)

```
escritorio(id, nome)
usuario(id, escritorio_id→escritorio, nome, email, papel, origem)
  -- papel: padrao|suporte|dev|master
  -- origem: 'sistema' (espelhado via SSO, atualizado a cada login) | 'central' (cadastro local)
produto(id, nome)
escritorio_produto(escritorio_id, produto_id)               -- contratados (dado autoritativo)
acesso_log(id, usuario_id, produto_id?, data)               -- registro bruto (lead = futuro)

-- Base de conhecimento
modulo(id, produto_id, nome, ordem)
topico(id, modulo_id, parent_id→topico, titulo, conteudo_md, ordem)

-- EAD (cliente e interno)
ead_modulo(id, produto_id?, interno bool, tema_interno?, nivel?, nome, ordem)
  -- CHECK: interno = false → produto_id NOT NULL
  -- CHECK: interno = true  → tema_interno NOT NULL
aula(id, ead_modulo_id, titulo, youtube_id, descricao_md, ordem)
progresso_aula(usuario_id, aula_id, concluida)
inscricao_ead(id, usuario_id, produto_id?, interno bool, data_inicio,
              status, data_conclusao)                       -- conclusão = imutável

-- Avaliação
prova(id, produto_id?, ead_modulo_id?, nota_corte)
  -- CHECK: num_nonnulls(produto_id, ead_modulo_id) = 1     -- sem FK polimórfica
questao(id, prova_id, enunciado, alternativas, gabarito)
tentativa(id, usuario_id, prova_id, nota, aprovado, data)
certificado(id, usuario_id, referencia, codigo_validacao, data)

-- Dashboard / comunicação
release_note(id, produto_id, data, versao, conteudo_md)
novidade(id, produto_id?, tipo, titulo, data, link)         -- novidades + lives
```

---

## 11. Princípios (constitution)

1. **Separa dado de regra.** O que é fato (contrato, papel) é guardado; o que é permissão é decidido numa camada única.
2. **Autorização centralizada** (RLS) — uma mudança de regra muda num lugar só. **Nenhuma query roda sem contexto de usuário setado na transação** (helper único).
3. **Conteúdo interno nunca sai do servidor para cliente.** A sanitização dos blocos suporte+ é uma função única, server-side e coberta por teste — vale para páginas, busca e qualquer endpoint futuro.
4. **Conclusão é fato, não cálculo.** Conclusão de EAD, certificado e positivado são eventos imutáveis; indicadores vivos (% de progresso) nunca os revertem.
5. **Produto é a dimensão suprema do conteúdo de cliente.** Conteúdo interno pode existir fora dela (temas) e a tela de EAD do cliente recomenda cursos de outros produtos contratados (§6.2) — ambas **exceções declaradas**.
6. **v1 tem que ficar de pé.** Recurso ambicioso é marco próprio, não peso no primeiro release.
7. **Reaproveitar antes de criar** — EAD interno reusa a máquina do EAD do cliente; blocos internos reusam o controle de papel.
8. **Tudo operável pela interface.** O Master administra a plataforma sem SQL e sem deploy; toda entidade de negócio tem tela de gerência.
9. **Nascida para evoluir.** Migrações versionadas, changelog, seeds, testes nas regras críticas e pontos de extensão modelados desde o v1.
10. **O papel nasce no sistema de origem.** A central espelha o papel vindo dos 6 sistemas (via SSO, a cada login); papel local existe só para usuários exclusivos da central. Toda permissão é checada **no servidor** — esconder botão na UI nunca é a regra, é só cortesia.
11. **Human in the loop** — ler e entender cada artefato gerado antes de aprovar (é projeto de aprendizado).

### 11.1 Matriz de permissões (resumo de referência)

| Ação | Padrão | Suporte | Dev | Master |
|---|---|---|---|---|
| Ver conteúdo padrão, fazer EAD, dashboard | ✅ | ✅ | ✅ | ✅ |
| Ver `:::nota-interna` / `:::nota-tecnica` | — | ✅ | ✅ | ✅ |
| Editar texto e árvore da base | — | ✅ | ✅ | ✅ |
| Criar/editar `:::nota-interna` | — | ✅ | ✅ | ✅ |
| Criar/editar `:::nota-tecnica` | — | — | ✅ | ✅ |
| Gerenciar EAD cliente e interno (estrutura, aulas, provas) | — | — | ✅ | ✅ |
| Release notes, novidades e lives | — | — | ✅ | ✅ |
| Cadastrar usuários "só central" e escritórios; vincular produtos | — | — | — | ✅ |

---

## 12. Decisões resolvidas (histórico)

| # | Questão | Decisão |
|---|---|---|
| 1 | Blocos internos podiam vazar no front | Sanitização **server-side** com pipeline remark único + teste de regressão (§6.1, princípio 3) |
| 2 | EAD interno: por produto ou por tema? | **Árvore de temas**, produto opcional; ignora o seletor de produto (§6.3) |
| 3 | Positivado ambíguo (100% vs prova) | Positivado = **conclusão** (aulas + prova), evento imutável (§5, §6.2) |
| 4 | Progresso recalculado podia "desconcluir" | % é indicador vivo; **conclusão é snapshot imutável** (§6.2, princípio 4) |
| 5 | Sinal de lead | **Removido do v1** → futuro distante; só o log bruto permanece (§5, §8) |
| 6 | Dependência de serviço externo por request | **Sessão própria** pós-login; SSO só no login (§3) |
| 7 | FK polimórfica em `prova` | Duas colunas nullable + check de exclusividade (§10) |
| 8 | Divergência menu cabeçalho × rail | Doc de **layout é a fonte da verdade de navegação**; escopo referencia (§4) |
| 9 | Origem do papel | **Espelhado dos 6 sistemas** via SSO a cada login; cadastro local só pra usuários exclusivos da central (§2, §3) |
| 10 | Permissões de edição | Suporte+dev editam texto/árvore; `nota-interna` = suporte+; `nota-tecnica` = só dev, **validado no save**; EADs e release notes = só dev (§6, §11.1) |
| 11 | Orquestração do login | **n8n descartado**: os 6 sistemas compartilham padrão único de SSO; a central chama os endpoints diretamente, em sequência (§3, `docs/sso-login-endpoint.md`) |
| 12 | Sessão e erros de login | Sessão deslizante (7 dias) + teto absoluto (30 dias), prazos configuráveis; mensagens de erro distinguem credencial inválida × indisponibilidade × caso misto (§3) |
| 13 | Nomenclatura do papel comum | Papel **"cliente" renomeado para "padrão"** (`padrao` em código); "cliente" reservado à entidade comercial escritório/CNPJ (§2, §10) |
