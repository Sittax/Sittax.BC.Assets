# Research — Fundação: Identidade, Sessão e Casca de Navegação

Decisões da Phase 0. Cada item resolve um ponto que a spec deixou para o plano ou que o
stack do PO exige fechar antes do design.

## R1. Chave de identidade entre origem e registro local (CHK001)

- **Decision**: O **e-mail normalizado** (trim + lowercase) é a chave que liga o usuário
  validado na origem ao registro local (`usuario.email` UNIQUE). O `id` da origem é
  armazenado apenas como dado informativo (`usuario.id_origem`, do primeiro sistema que
  validou), nunca como chave. **Confirmado pelo PO** (aprovação do research,
  2026-06-09). Troca de e-mail no sistema de origem é caso raro e fica sem automação
  nesta fase: o próximo login com o e-mail novo cria um novo registro espelhado, e o
  Master resolve manualmente o registro antigo (usuário espelhado é read-only, então a
  resolução é administrativa, não edição de dados espelhados).
- **Rationale**: Os 6 sistemas têm IDs próprios e potencialmente distintos para a mesma
  pessoa; o e-mail é o identificador que o usuário digita e que os 6 compartilham como
  login. Premissa do escopo ("login é o mesmo das ferramentas") sustenta isso.
- **Alternatives considered**: ID da origem (quebra com múltiplos sistemas/IDs);
  par sistema+id (cria um usuário por sistema — duplicaria pessoas).

## R2. Sessão — biblioteca e implementação das regras de expiração

- **Decision**: **iron-session** (cookie httpOnly, assinado e criptografado, SameSite
  Lax, Secure em produção). Payload: `userId`, `papel`, `loginAt`, `lastActivityAt`.
  Deslizante: a cada requisição autenticada, se `now - lastActivityAt` > janela (env
  `SESSION_IDLE_DAYS`, padrão 7) → sessão inválida; senão renova `lastActivityAt`.
  Teto: `now - loginAt` > env `SESSION_MAX_DAYS` (padrão 30) → inválida. Em toda
  requisição autenticada o usuário é carregado do banco; `ativo = false` → sessão
  rejeitada (satisfaz FR-024 sem tabela de sessões).
- **Rationale**: Stateless atende todos os requisitos da spec (papel congelado no login
  fica no cookie; desativação derruba porque o load do usuário é necessário de qualquer
  forma para montar o contexto RLS). Evita tabela de sessões e job de limpeza.
- **Alternatives considered**: Tabela de sessões no Postgres (mais um CRUD invisível e
  limpeza periódica; só traria revogação instantânea de papel rebaixado, que a spec
  explicitamente NÃO quer — rebaixamento vale no próximo login); JWT próprio com `jose`
  (reinventa o que iron-session já entrega).

## R3. Cliente SSO — sequência, timeouts e classificação de falha

- **Decision**: `fetch` nativo com `AbortSignal.timeout(SSO_TIMEOUT_MS`, padrão 3000`)`
  por sistema; relógio total da tentativa com teto `SSO_TOTAL_TIMEOUT_MS` (padrão
  10000) — ao estourar, interrompe a sequência. Ordem da sequência = ordem da env
  `SSO_BASE_URLS` (lista separada por vírgula; ordem é decisão de configuração,
  irrelevante para o resultado pela premissa de não-conflito). **Adendo do PO
  (2026-06-09)**: as 6 URLs MUST ser HTTPS, validadas na inicialização da aplicação
  (`src/lib/config.ts`, schema Zod: exatamente 6 URLs válidas com protocolo `https:`);
  URL não-HTTPS ou lista incompleta → a aplicação falha ao subir, com erro claro. Classificação por
  sistema: HTTP 400/401/403 → **recusa autoritativa** (credencial inválida); timeout,
  erro de rede, 5xx, resposta sem `token`/claims essenciais (`EscritorioCnpj` ausente
  do payload decodificado conta como claim presente-porém-vazio, não malformação) →
  **inacessível**. Agregação conforme FR-007 (recusa em todos / nenhum respondeu /
  misto com aviso parcial).
- **Rationale**: Implementa FR-001/FR-007/FR-029 literalmente; fetch+AbortSignal é
  nativo do Node 22, zero dependências.
- **Alternatives considered**: Chamadas em paralelo (decisão do PO foi sequência);
  axios (desnecessário).

## R4. Decodificação do JWT de origem

- **Decision**: Decodificar o payload do JWT **sem verificar assinatura** (base64
  decode dos claims), extraindo `EscritorioCnpj`, `EscritorioNome`, `Role`, `Nivel`.
  O token nunca é reutilizado nem armazenado; a confiança vem do canal: a resposta
  veio por TLS do endpoint configurado do sistema de origem.
- **Rationale**: A central não tem as chaves públicas dos 6 emissores (o doc SSO mostra
  `iss` divergente do host) e não usa o token para autorizar nada — só lê dados da
  resposta autenticada que ela mesma solicitou. Verificação de assinatura aqui não
  adiciona segurança e criaria acoplamento com 6 emissores.
- **Alternatives considered**: Validar assinatura via JWKS (endpoints não documentados;
  acoplamento sem ganho); exigir os dados fora do token (o contrato põe escritório só
  nos claims).

## R5. RLS com Drizzle — policies e helper único

- **Decision**: Policies RLS escritas em **migração SQL custom** do drizzle-kit
  (`drizzle/NNNN_rls-policies.sql`). App conecta com role Postgres **não-owner e sem
  BYPASSRLS** (`central_app`). Helper `withUser(userId, papel, fn)` em
  `src/lib/db/rls.ts`: abre transação, executa `SET LOCAL app.user_id = $1` e
  `SET LOCAL app.papel = $2` (via `set_config(..., true)` parametrizado), roda `fn(tx)`
  e comita. Variante restrita `withSystem(fn)` apenas para o fluxo de login/espelhamento
  (antes de existir sessão) e para o seed — papel `system`, citada nas policies que o
  espelhamento exige. Convenção: nenhum import de `client.ts` fora de `rls.ts` (gate de
  review/lint).
- **Rationale**: Princípio II da constituição exige contexto em toda transação e helper
  único; `SET LOCAL` morre com a transação, seguro com pool. Login precisa escrever
  usuário/escritório antes de haver `app.user_id` — `withSystem` é a exceção declarada
  e auditável, não um furo.
- **Alternatives considered**: RLS via roles Postgres por papel (não escala com pool);
  checagem só na aplicação (viola constituição II).

## R6. Gate de tela no App Router

- **Decision**: Sem middleware do Next como mecanismo de segurança. O gate real é
  server-side em cada árvore de rota: `(shell)/layout.tsx` exige sessão válida;
  `ead-interno/page.tsx` e `gerencia/layout.tsx` checam papel e devolvem **404**
  (`notFound()`) para papel insuficiente — não revela existência da rota. Server
  actions revalidam papel ao executar (defesa em profundidade com RLS por baixo).
- **Rationale**: FR-009/FR-010/FR-011 + decisão do CHK013 (404 não vaza informação);
  middleware roda em edge runtime sem acesso a banco e é facilmente esquecido em rotas
  novas — layouts são herdados por construção.
- **Alternatives considered**: Middleware global (complemento opcional de UX para
  redirecionar não-logado ao /login — pode entrar, mas nunca como a regra).

## R7. Persistência do produto selecionado ("grudento")

- **Decision**: Coluna `usuario.produto_selecionado_id` (FK nullable para `produto`),
  atualizada via server action na troca; vale entre dispositivos (última troca ganha).
  Primeiro acesso sem seleção: primeiro produto contratado do escritório (por ordem do
  catálogo) ou primeiro do catálogo se não houver contrato/escritório.
- **Rationale**: FR-019 exige persistência entre sessões; servidor é a única fonte que
  sobrevive a cookie novo e vale multi-dispositivo (CHK018).
- **Alternatives considered**: Cookie separado (não persiste entre dispositivos);
  localStorage (não disponível em server render, mesma limitação).

## R8. Estrutura do mapeamento de papéis

- **Decision**: Tabela `papel_mapeamento(role_origem text, nivel_origem int NULL,
  papel_central)` com unicidade em (`role_origem`, `nivel_origem`). Resolução: match
  exato (role, nivel) → match de role com `nivel_origem IS NULL` (curinga de nível) →
  **fallback `padrao`** (FR-002). CRUD na tela do Master; conteúdo real do mapa entra
  por seed/configuração quando o PO fornecer.
- **Rationale**: Cobre os dois formatos plausíveis do mapa (por combinação exata ou só
  por role) sem código novo; fallback já decidido no clarify.
- **Alternatives considered**: Mapa por faixa de nível (sem evidência de necessidade;
  YAGNI — extensível depois via migração).

## R9. CNPJ — normalização e obrigatoriedade

- **Decision**: Armazenar CNPJ como **14 dígitos** (strip de máscara) com UNIQUE.
  Espelhamento: claim com qualquer formatação é normalizado; vazio → regra FR-028.
  CRUD manual do Master: CNPJ obrigatório, validado (14 dígitos + dígitos
  verificadores), formatação aplicada só na exibição. `EscritorioNome` vazio com CNPJ
  presente: cria escritório com nome = CNPJ formatado (editável depois pelo Master) —
  resolve CHK026 sem bloquear login válido.
- **Rationale**: CNPJ é a chave de espelhamento (FR-003/FR-012); normalizar evita
  duplicata por máscara.
- **Alternatives considered**: Bloquear login quando nome vazio (pune usuário por dado
  ruim da origem); escritório sem nome (quebra listagens).

## R10. Registro de acesso

- **Decision**: `acesso_log(id, usuario_id, produto_id NULL, data)`. No login grava
  **sem produto** (o evento é "entrou na central"); a definição do produto inicial em
  seguida grava um segundo evento de troca apenas quando o usuário troca de fato — a
  seleção automática inicial não registra troca. Sem retenção/expurgo nesta fase
  (volume baixo; decisão adiada e registrada).
- **Rationale**: Mantém o log fiel a eventos do usuário (CHK030) e o escopo "registro
  bruto, sem lógica".
- **Alternatives considered**: Registrar login já com produto (mistura dois eventos e
  inventa intenção do usuário).

## R11. Senhas de usuários só central

- **Decision**: Hash com **Argon2id** (`@node-rs/argon2`). Política mínima: 10+
  caracteres (validação Zod). Limite de tentativas: contador em memória por
  e-mail+IP com backoff simples (5 falhas → 1 min) — suficiente para a escala; sem
  dependência externa. Login local só é tentado quando o e-mail pertence a usuário
  `origem = 'central'`; caso contrário o fluxo é sempre SSO (precedência do cadastro
  local — local-first, conforme spec).
- **Rationale**: FR-005 + CHK008; Argon2id é o padrão atual; rate-limit em memória
  basta on-prem single-node.
- **Alternatives considered**: bcrypt (ok, mas Argon2id é preferível e o pacote é
  estável); rate-limit em Postgres (complexidade sem necessidade na escala).

## R12. Testes das regras críticas

- **Decision**: Vitest contra **Postgres real** (o mesmo do Docker Compose, database
  `central_test` recriado por migração no setup). `tests/rls.test.ts`: para cada papel,
  afirma o que cada tabela permite ler/escrever e as negações (inclusive bypass: query
  sem contexto falha). `tests/espelhamento.test.ts`: mock HTTP dos 6 sistemas (servidor
  `node:http` efêmero com fixtures do contrato SSO) cobrindo: primeiro login cria
  usuário+escritório; papel ressincroniza; não mapeado → padrão; CNPJ vazio bloqueia
  padrão e libera suporte+; classificação credencial-inválida × indisponível × misto;
  teto de tempo.
- **Rationale**: RLS só é testável de verdade contra Postgres; mock HTTP local evita
  dependência da homologação em CI e cobre os casos de borda do clarify.
- **Alternatives considered**: Testcontainers (bom, mas adiciona dependência — o
  compose já dá o Postgres); testar contra homologação real (frágil, credenciais em
  CI).
