# Contracts — Superfície interna da Central (Fase 1)

Contrato externo (SSO dos 6 sistemas): `docs/sso-login-endpoint.md` — não duplicado
aqui. Este arquivo define o que a **central** expõe: 2 route handlers de autenticação e
as server actions da gerência. Toda entrada é validada com Zod; toda ação revalida
sessão + papel no servidor (FR-009) e roda queries via `withUser`/`withSystem` (R5).

## Route Handlers

### POST /api/auth/login

Autentica na central (SSO sequencial ou local para `origem='central'` — R11).

Request `application/json`:

```json
{ "email": "string (e-mail)", "senha": "string" }
```

Responses:

| Status | Body | Quando |
|---|---|---|
| 200 | `{ "ok": true }` + cookie de sessão (httpOnly, Secure, SameSite=Lax) | validado; espelhamento executado; `acesso_log` gravado |
| 401 | `{ "erro": "credencial_invalida", "mensagem": "..." }` | todos os sistemas consultados recusaram (ou senha local errada) |
| 401 | `{ "erro": "credencial_invalida_parcial", "mensagem": "...", "aviso": "indisponibilidade parcial — se sua senha pertence ao sistema indisponível, tente novamente em instantes" }` | caso misto (FR-007) |
| 403 | `{ "erro": "sem_escritorio", "mensagem": "usuário sem escritório vinculado — contate o suporte" }` | papel traduzido padrão + CNPJ vazio (FR-028) |
| 403 | `{ "erro": "usuario_inativo", "mensagem": "..." }` | usuário só central desativado |
| 503 | `{ "erro": "indisponivel", "mensagem": "..." }` | nenhum sistema respondeu / teto de 10s estourado (FR-029) |
| 429 | `{ "erro": "muitas_tentativas", "mensagem": "..." }` | rate-limit local (R11) |

Nunca revela qual sistema validou/recusou/caiu. Mensagens em PT-BR, sem detalhe técnico.

### POST /api/auth/logout

Sem body. Destrói a sessão (cookie limpo). 200 sempre (idempotente). Exige sessão.

## Sessão (contrato interno — `src/lib/auth/session.ts`)

- `getSession()`: lê cookie; valida janela deslizante (7d) + teto (30d) + `ativo` do
  usuário no banco; renova `lastActivityAt`. Inválida → trata como não autenticado
  (telas redirecionam a `/login`).
- Payload: `{ userId, papel, loginAt, lastActivityAt }`. Papel congelado no login
  (rebaixamento vale no próximo login — spec Edge Cases).

## Server Actions (gerência — Master only; `src/lib/actions/`)

Todas: revalidam `papel === 'master'` no início; erro de permissão → exceção genérica
(UI mostra acesso negado); RLS nega por baixo de qualquer forma.

### escritorios.ts

| Action | Entrada (Zod) | Saída / Regras |
|---|---|---|
| `criarEscritorio` | `{ cnpj: string(14 díg. válidos), nome: string min 1 }` | cria; CNPJ duplicado → erro de validação |
| `editarEscritorio` | `{ id, nome }` | CNPJ imutável pela UI nesta fase (chave de espelhamento) |
| `excluirEscritorio` | `{ id }` | FK RESTRICT: com usuários → erro orientando desativar/migrar (FR-026) |
| `vincularProduto` / `desvincularProduto` | `{ escritorioId, produtoId }` | upsert/delete em `escritorio_produto` |
| `listarEscritorios` | `{ busca? }` | inclui produtos vinculados e contagem de usuários |

### usuarios.ts

| Action | Entrada (Zod) | Saída / Regras |
|---|---|---|
| `criarUsuarioCentral` | `{ nome, sobrenome?, email, senha(min 10), escritorioId?, papel: padrao\|suporte\|dev\|master }` | sempre `origem='central'`; papel padrão exige escritório (CHECK FR-012); e-mail único |
| `editarUsuarioCentral` | `{ id, nome?, sobrenome?, escritorioId?, papel?, senha? }` | só `origem='central'` (policy + validação) |
| `desativarUsuarioCentral` / `reativarUsuarioCentral` | `{ id }` | só `origem='central'`; desativado não loga e perde sessão no próximo acesso |
| `listarUsuarios` | `{ busca?, origem? }` | espelhados marcados read-only com badge "espelhado da origem" (FR-025) |

### mapeamento.ts

| Action | Entrada (Zod) | Saída / Regras |
|---|---|---|
| `criarMapeamento` | `{ roleOrigem, nivelOrigem?, papelCentral: padrao\|suporte\|dev }` | UNIQUE (role, nivel); nunca `master` |
| `editarMapeamento` / `excluirMapeamento` | `{ id, ... }` | |
| `listarMapeamentos` | — | exibe também o fallback fixo ("não mapeado → padrão") como informação |

### produto-selecionado.ts (qualquer papel autenticado)

| Action | Entrada | Regras |
|---|---|---|
| `selecionarProduto` | `{ produtoId }` | atualiza `usuario.produto_selecionado_id` (próprio usuário via RLS); grava `acesso_log` com produto (R10) |

## Contrato de UI da casca (resumo; fonte: docs/layout-navegacao-claude-design.md)

- `(shell)/layout.tsx` entrega a sessão + lista de módulos visíveis ao papel (EAD
  interno só suporte+ — a lista é montada no servidor).
- Acesso direto a rota não permitida → `notFound()` (404, R6).
- Seletor de produto: 6 produtos (ordem do catálogo); desabilitado com tooltip dentro
  de `/ead-interno`.
