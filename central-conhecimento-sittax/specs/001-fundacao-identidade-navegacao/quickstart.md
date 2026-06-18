# Quickstart — Fundação: Identidade, Sessão e Casca de Navegação

Guia de validação ponta a ponta. Detalhes de schema em [data-model.md](./data-model.md);
endpoints em [contracts/internal-api.md](./contracts/internal-api.md).

## Pré-requisitos

- Docker + Docker Compose
- Node.js 22 LTS + npm
- Acesso à URL de homologação do SSO (ou usar o mock dos testes)

## Setup

```bash
cp .env.example .env        # preencher: DATABASE_URL, SESSION_SECRET (32+ chars),
                            # SSO_BASE_URLS (6 URLs HTTPS — homolog p/ dev),
                            # SSO_TIMEOUT_MS, SSO_TOTAL_TIMEOUT_MS,
                            # SESSION_IDLE_DAYS, SESSION_MAX_DAYS
docker compose up -d postgres
npm install
npm run db:migrate          # aplica migrações Drizzle (schema + policies RLS)
npm run db:seed             # 2 escritórios, 4 usuários (1/papel), 6 produtos, mapa placeholder
npm run dev                 # http://localhost:3000
```

> A aplicação valida as env vars na inicialização (R3): faltar URL, URL sem HTTPS ou
> segredo curto → falha ao subir com mensagem clara. Esse é o primeiro teste.

## Cenários de validação

**Resultado (T036)** — validação manual executada e aceita pelo Product Owner em
2026-06-10 (Fase 1 aceita; Princípio XI):

- [x] V1 — Login e espelhamento
- [x] V2 — Resiliência à queda do SSO
- [x] V3 — Visibilidade por papel
- [x] V4 — Seletor grudento
- [x] V5 — Gerência do Master
- [x] V6 — Registro de acesso

### V1 — Login e espelhamento (US1)

1. Login com usuário real de homologação (ou fixtures do seed p/ usuários locais).
2. Esperado: sessão criada; usuário/escritório visíveis na gerência (Master);
   papel = tradução do mapeamento; `acesso_log` ganhou uma linha (ver tela do Master ou
   teste).
3. Repetir login após mudar o papel na origem (ou editar o mapa): papel local muda.

### V2 — Resiliência à queda do SSO (US1 / SC-002)

1. Logar; depois apontar `SSO_BASE_URLS` para URLs inválidas e reiniciar o app (ou
   derrubar o mock).
2. Esperado: sessão ativa segue navegando tudo; novo login (janela anônima) falha com
   mensagem de indisponibilidade em ≤10s.

### V3 — Visibilidade por papel (US2 / SC-001)

1. Logar com cada um dos 4 usuários do seed.
2. Esperado: papel padrão sem "EAD interno" no rail e 404 em `/ead-interno`; suporte/dev/
   master veem e acessam; só master vê/acessa `/gerencia/*` (404 para os demais).
3. Rail: recolhido por padrão, fly-out no hover, item ativo laranja; mobile: barra
   inferior (responsivo).

### V4 — Seletor grudento (US2 / SC-006)

1. Trocar produto, navegar entre módulos, fazer logout e login.
2. Esperado: seleção persiste (inclusive em outro navegador — server-side); dentro de
   `/ead-interno` o seletor fica desabilitado com tooltip e volta ao sair.

### V5 — Gerência do Master (US3 / SC-004)

1. Como master: criar escritório (CNPJ válido), vincular produtos, criar usuário só
   central papel suporte, logar com ele e conferir EAD interno.
2. Desativar esse usuário: login passa a falhar; sessão aberta dele morre no próximo
   clique.
3. Tentar excluir escritório com usuários → bloqueado com orientação.
4. Editar o mapeamento de papéis pela tela e validar efeito no próximo login.
5. Usuário espelhado abre em modo leitura com badge de origem.

### V6 — Registro de acesso (US4 / SC-007)

1. Fazer logins e trocas de produto variados.
2. Esperado: um registro por login (sem produto) e um por troca (com produto).

## Testes automatizados (regras críticas — constituição IX)

```bash
docker compose up -d postgres
npm run test                # Vitest: tests/rls.test.ts + tests/espelhamento.test.ts
```

- `rls.test.ts`: por papel, o que cada tabela permite; query sem contexto → zero
  linhas/erro.
- `espelhamento.test.ts`: mock HTTP dos 6 sistemas; primeiro login cria
  usuário+escritório; ressincronização de papel; não mapeado → padrão; CNPJ vazio
  (bloqueia padrão / libera suporte+); credencial inválida × indisponível × misto;
  teto de tempo.

**Esperado: 100% verde antes de qualquer validação manual.**
