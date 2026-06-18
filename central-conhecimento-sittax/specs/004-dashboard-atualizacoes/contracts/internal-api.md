# Contracts — Feature 004: superfície interna (consultas e actions)

Sem route handlers novos (R7). Toda a superfície é: server components lendo via
consultas tipadas + server actions com gate. Todas as funções abrem transação via
`withUser(userId, papel, fn)` — nenhuma query fora do helper (Constituição II).
`ActionResult` segue o padrão da 003: `{ ok: true, data? } | { ok: false, mensagem }`.

## Consultas (leitura — server components)

### `src/lib/dashboard/consultas.ts`

```ts
continuarDeOndeParou(produtoId, userId, papel): Promise<Array<{
  moduloId: string; nome: string; capaUrl: string | null;
  percentual: number;            // _percentualNaTx reusado da 003
  retomadaAulaId: string | null; // R1: max(acessado_em) do módulo; fallback 1ª aula; null se módulo sem aulas
}>>
// Inscrições em_andamento (interno=false) do usuário × módulos do produto ativo.

eadsDisponiveis(produtoId, userId, papel): Promise<Array<{
  moduloId: string; nome: string; capaUrl: string | null;
}>>
// Módulos do produto sem inscrição do usuário — sugestão do bloco vazio (FR-004).

proximosEventos(userId, papel, limite = 5): Promise<Array<{
  id: string; titulo: string; descricao: string; inicio: Date; fim: Date;
}>>
// ORDER BY inicio ASC. A RLS já oculta o passado de papel padrão (R4) —
// a consulta NÃO filtra papel. Para a gestão, listar sem limite e separar
// futuro × histórico na apresentação.
```

### `src/lib/notas/consultas.ts`

```ts
notasDoProduto(produtoId, userId, papel): Promise<NotaParaLeitura[]>
notasRecentes(produtoId, userId, papel, limite = 5): Promise<NotaParaLeitura[]>

type NotaParaLeitura = {
  id: string; data: string; versao: string | null;
  conteudo: string; // ESCOLHA POR PAPEL: padrao → conteudo_publico; suporte+ → conteudo_md (R2)
};
// ORDER BY data DESC, criado_em DESC (R8). O campo bruto conteudo_md NUNCA é
// retornado a sessão de papel padrão — contrato coberto por teste byte-level.
```

### `src/lib/ead/acesso.ts`

```ts
registrarAcessoAula(aulaId, userId, papel): Promise<void>
// Upsert em aula_acesso (ON CONFLICT (usuario_id, aula_id) DO UPDATE acessado_em = now()).
// Pré-condição: inscrição em_andamento no módulo da aula; sem inscrição → no-op
// silencioso (não quebra o render). Chamado pelo server component da página da aula (R7).

ultimaAulaAcessada(moduloId, userId, tx): Promise<string | null>
// Interna (recebe Tx): aula com max(acessado_em) entre as aulas do módulo.
```

## Server actions (mutação)

### `src/lib/actions/release-notes.ts` — gate **dev+** (`dev`, `master`)

```ts
criarNota(input: {
  produtoId: uuid; data: string /* ISO date */; versao?: string; conteudoMd: string;
}): Promise<ActionResult<{ id: string }>>

atualizarNota(input: {
  id: uuid; data?: string; versao?: string | null; conteudoMd?: string;
}): Promise<ActionResult>
```

Regras (ambas): sessão válida + gate dev+ no início (senão `Permissão
insuficiente.`); Zod na borda; **todo save recalcula**
`conteudo_publico = sanitizarMarkdown(conteudoMd, 'padrao')` (R2 — invariante da
derivada); grava `atualizado_por/atualizado_em` no update; `revalidatePath` de
`/atualizacoes` e `/dashboard`. **Não existe `excluirNota`** (FR-012/R5 — RLS também
não tem policy de DELETE).

### `src/lib/actions/eventos.ts` — gate **suporte+** (`suporte`, `dev`, `master`)

```ts
criarEvento(input: {
  titulo: string; descricao?: string; inicio: string; fim: string; // ISO datetime
}): Promise<ActionResult<{ id: string }>>

atualizarEvento(input: {
  id: uuid; titulo?: string; descricao?: string; inicio?: string; fim?: string;
}): Promise<ActionResult>

excluirEvento(input: { id: uuid }): Promise<ActionResult>
```

Regras: sessão + gate suporte+ no início; Zod com `refine`: `fim > inicio`
(mensagem clara — FR-016) e mesmo dia local (premissa v1 — R3; o banco garante só
`fim > inicio`); `revalidatePath('/dashboard')` e `/dashboard/eventos`.

## Páginas (gates de rota — cortesia + servidor)

| Rota | Acesso | Conteúdo |
|---|---|---|
| `/dashboard` | qualquer sessão | 3 blocos; sem produto ativo → blocos por produto pedem seleção (padrão da casca); link "gerenciar eventos" visível só suporte+ |
| `/dashboard/eventos` | suporte+ (`notFound()` p/ padrão) | CRUD de eventos; futuro × histórico (RLS entrega tudo a suporte+) |
| `/atualizacoes` | qualquer sessão | lista do produto ativo; botões "Nova nota"/"Editar" visíveis só dev+ |
| `/atualizacoes/nova` | dev+ (`notFound()`) | form de criação (EditorNota reusa BaseEditor) |
| `/atualizacoes/[id]/editar` | dev+ (`notFound()`) | form de edição |
| `/ead/aula/[id]` | (existente) | ALTERADA: chama `registrarAcessoAula` no render |

## Invariantes cobertas por teste (`tests/dashboard.test.ts` + `rls.test.ts`)

1. Nota com `:::nota-interna`: resposta para sessão padrão não contém nenhum byte do
   texto interno (consulta retorna `conteudo_publico`) — SC-003.
2. INSERT/UPDATE de `release_note` como suporte e padrão: negados (RLS, mesmo
   pulando o gate); DELETE negado até para dev/master.
3. Escrita de `evento` como padrão: negada; como suporte: permitida.
4. Evento com `fim < now()`: invisível em SELECT de sessão padrão; visível para
   suporte (R4).
5. `fim <= inicio`: rejeitado (check do banco + mensagem da action).
6. Retomada: última acessada vence; sem acesso → primeira aula; acesso à aula
   removida → cascade + fallback.
7. `aula_acesso` é own-row: usuário não lê nem escreve acesso de outro.
8. `inscricao_ead` segue sem UPDATE possível (regressão da garantia da 003).
