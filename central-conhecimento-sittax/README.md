# Central de Conhecimento Sittax

Plataforma de conhecimento dos produtos Sittax — fase atual: **Fundação**
(identidade via SSO dos 6 sistemas, sessão própria, casca de navegação,
gerência do Master e registro bruto de acesso).

## Como rodar

Guia completo de setup e validação:
[`specs/001-fundacao-identidade-navegacao/quickstart.md`](specs/001-fundacao-identidade-navegacao/quickstart.md)

Resumo:

```bash
cp .env.example .env   # preencher as variáveis (ver comentários no arquivo)
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:3000
```

Testes das regras críticas (RLS e espelhamento — exigem Postgres de pé):

```bash
npm run test
```

## Governança

- Constituição do projeto: `.specify/memory/constitution.md`
- Regra de negócio: `docs/escopo-plataforma-conhecimento-v2.md`
- UI/navegação: `docs/layout-navegacao-claude-design.md`
- Contrato SSO: `docs/sso-login-endpoint.md`

## Papéis

`padrao` (usuário de escritório), `suporte`, `dev` e `master`. O papel antes
chamado "cliente" foi renomeado para **padrão** — "cliente" designa apenas a
entidade comercial (escritório, identificado por CNPJ).
