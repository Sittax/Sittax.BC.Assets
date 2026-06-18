# SSO Sittax — Endpoint de Login

> Contrato do endpoint de autenticação compartilhado pelos 6 sistemas Sittax.
> A Central de Conhecimento valida credenciais chamando este endpoint diretamente em cada sistema (sem orquestrador intermediário), tentando em sequência até um validar.
> **Cada sistema tem sua própria base URL** — as 6 URLs são configuradas em variáveis de ambiente, nunca em código. Nenhuma credencial real entra em código, spec ou documentação.

## Endpoint

- **Método:** `POST`
- **Caminho:** `/api/auth/login`
- **URL completa:** `{base_url}/api/auth/login`

## Ambientes

| Ambiente | Base URL | URL resolvida |
|---|---|---|
| Homologação | `https://autenticacaohomologacao.sittax.com.br` | `https://autenticacaohomologacao.sittax.com.br/api/auth/login` |
| Produção (por sistema) | definida em variável de ambiente (6 URLs) | `{base_url}/api/auth/login` |

> Para desenvolvimento e testes, usar o ambiente de **homologação**.

## Request

- **Content-Type:** `application/json`
- **Body:**

```json
{
  "usuario": "<login>",
  "senha": "<password>"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `usuario` | `string` | Identificador de login do usuário. |
| `senha` | `string` | Senha do usuário. |

> Atenção: as chaves do body são em português (`usuario`, `senha`).

## Response (sucesso)

```json
{
  "token": "<jwt>",
  "primeiro_acesso": false,
  "usuario": {
    "id": "2f057a26-d866-4256-97a2-30ae4a131f76",
    "nome": "SISTEMA",
    "sobrenome": "SITTAX",
    "email": "sistema@sittax.com.br",
    "nivel": 10,
    "role": "ADMINISTRADOR"
  }
}
```

### Campos de topo

| Campo | Tipo | Descrição |
|---|---|---|
| `token` | `string` | JWT bearer token para autenticar requisições subsequentes ao sistema de origem. |
| `primeiro_acesso` | `boolean` | Indica se é o primeiro acesso do usuário. |
| `usuario` | `object` | Dados do usuário autenticado (abaixo). |

### Objeto `usuario`

| Campo | Tipo | Descrição | Exemplo |
|---|---|---|---|
| `id` | `string` | Identificador do usuário (UUID). | `2f057a26-d866-4256-97a2-30ae4a131f76` |
| `nome` | `string` | Primeiro nome. | `SISTEMA` |
| `sobrenome` | `string` | Sobrenome. | `SITTAX` |
| `email` | `string` | E-mail. | `sistema@sittax.com.br` |
| `nivel` | `number` | Nível de acesso (numérico). | `10` |
| `role` | `string` | Identificador do papel no sistema de origem. | `ADMINISTRADOR` |

## Claims do token

O `token` é um JWT. O payload de exemplo decodificado contém (o conjunto exato de claims é ditado pelo emissor):

| Claim | Exemplo | Observações |
|---|---|---|
| `EscritorioCnpj` | `""` | CNPJ do escritório (**pode vir vazio** — ver caso de borda abaixo). |
| `EscritorioNome` | `""` | Nome do escritório (pode vir vazio). |
| `IdDoUsuario` | `2f057a26-d866-4256-97a2-30ae4a131f76` | ID do usuário. |
| `NomeDoUsuario` | `SISTEMA` | Nome do usuário. |
| `Role` | `ADMINISTRADOR` | Nome do papel. |
| `RoleId` | `2be43708-37d1-4cc6-8996-e7158af7bef4` | ID do papel (UUID). |
| `Nivel` | `10` | Nível de acesso. |
| `Inadimplencia` | `false` | Flag de inadimplência (vem como string). |
| `nbf` | `1781011833` | Not-before (Unix timestamp). |
| `exp` | `1781019033` | Expiração do token de origem (Unix timestamp). |
| `iss` | `https://autenticacao.stage.sittax.com.br` | Emissor. |
| `aud` | `#/SittaxCertificado/Auth` | Audience. |

> Nota: o `iss` do token de exemplo aponta para host `stage`, diferente da base URL de homologação usada na requisição. Tratar o emissor como autoritativo a partir do token decodificado, sem assumir que coincide com o host da requisição.

## Como a Central usa este contrato

1. Recebe usuário/senha no login da Central.
2. Chama `POST {base_url}/api/auth/login` em cada um dos 6 sistemas, **em sequência, até um validar**.
3. Do retorno válido, extrai: identidade (`id`, `nome`, `sobrenome`, `email`), papel de origem (`role`, `nivel`) e escritório (claims `EscritorioCnpj`, `EscritorioNome`).
4. **Traduz** `role`/`nivel` para o papel da Central (cliente / suporte / desenvolvedor) — mapeamento definido pelo Product Owner (ver spec/clarify da Feature 001).
5. **Espelha** papel e escritório no cadastro local (atualizados a cada login) e cria a **sessão própria** da Central. O JWT de origem não é reutilizado nas requisições da Central; a expiração da sessão da Central é independente do `exp` do token de origem.

## Casos de borda conhecidos

- **`EscritorioCnpj` vazio**: usuários sistêmicos/internos podem vir sem escritório (como no exemplo acima). A regra de tratamento é definida na spec da Feature 001 — nunca comportamento acidental.
- **Todos os 6 endpoints falham/indisponíveis**: apenas novos logins falham (com mensagem clara); sessões ativas da Central continuam funcionando normalmente.
- **Credencial válida em mais de um sistema**: irrelevante — papéis não conflitam entre sistemas (premissa do escopo §2); vale o primeiro que validar.
