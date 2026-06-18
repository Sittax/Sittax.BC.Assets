# Quickstart — Feature 003: EAD do Cliente

Guia de validação ponta a ponta para o PO (Princípio XI). Pré-requisitos e
infraestrutura idênticos às fases anteriores (Docker Compose com Postgres; ver
`specs/001-fundacao-identidade-navegacao/quickstart.md` para o setup base).

## Setup

```powershell
docker compose up -d          # Postgres (+ MinIO da 002)
npm install
npm run db:migrate            # aplica 0004_ead e 0005_ead-rls
npm run db:seed               # inclui 1 EAD completo (2 módulos, 4 aulas) + prova inerte
npm run dev
```

Usuários de seed (mesmos das fases anteriores): um por papel — `padrao`, `suporte`,
`dev`, `master`.

## Cenário 1 — Inscrição e progresso (US1)

1. Logar como **padrão**; selecionar o produto com EAD do seed; abrir **EAD** no rail.
2. ✅ Trilha mostra módulos e aulas em ordem, com botão **Iniciar EAD** e sem %.
3. Clicar **Iniciar EAD** → ✅ trilha ativa com **0%**; sem cobrança.
4. Abrir a 1ª aula e assistir até o fim (dica: avançar o vídeo até perto do final —
   seek é permitido) → ✅ ao terminar, aula marcada como vista e % sobe para 25%
   (1 de 4).
5. Recarregar e terminar a MESMA aula de novo → ✅ % continua 25% (idempotência).
6. Ver as 4 aulas → ✅ % = 100% e a inscrição **permanece "em andamento"** — não há
   conclusão nesta fase (prova é a v2 do módulo).
7. Em janela anônima, logar como **outro usuário padrão** → ✅ trilha sem inscrição
   e 0 aulas vistas (progresso é por usuário).

## Cenário 2 — Sem inscrição, sem progresso (US1)

1. Como usuário padrão **não inscrito**, abrir uma aula diretamente pela URL.
2. ✅ Página abre (conteúdo é aberto), mas nenhum % é exibido.
3. Terminar o vídeo → ✅ nada é gravado (a API responde `409 sem_inscricao`);
   voltar à trilha mostra apenas o botão **Iniciar EAD**.

## Cenário 3 — Gestão por dev e gate de papel (US2)

1. Logar como **dev**; abrir `/ead/gestao` no produto ativo.
2. Criar módulo, criar aula colando uma **URL** do YouTube → ✅ ID extraído; aula
   aparece na trilha na ordem definida.
3. Reordenar aulas e renomear módulo → ✅ refletido na trilha.
4. Com a inscrição do Cenário 1 a 100%, **adicionar uma 5ª aula** → ✅ o % do
   inscrito passa a 80% (4 de 5) — indicador vivo; status segue "em andamento".
5. **Excluir** uma aula vista → ✅ % recalcula sobre o total atual; nunca >100%.
6. Logar como **suporte** e como **padrão**: acessar `/ead/gestao` e disparar uma
   action de gestão → ✅ negado no servidor nos dois casos (não só menu escondido).
7. Logar como **master** → ✅ gestão acessível (herda de dev).

## Cenário 4 — Alicerce da avaliação (verificação técnica)

1. `npm run db:migrate` aplicado → inspecionar o schema:
   `\d prova questao tentativa certificado inscricao_ead` no psql.
2. ✅ Tabelas existem com checks do escopo §10 (FK dupla exclusiva em `prova`,
   `interno`/`tema_interno` em `ead_modulo`); `inscricao_ead` tem `status` +
   `data_conclusao`.
3. ✅ Nenhuma tela/rota de prova, certificado ou positivado existe.
4. Como qualquer papel, tentar `UPDATE inscricao_ead SET status='concluido'` via
   sessão da aplicação é impossível (sem superfície); a policy RLS nega UPDATE —
   coberto pelo teste automatizado.

## Testes automatizados

```powershell
npm test
```

✅ Suítes verdes, incluindo as críticas desta fase (`tests/ead.test.ts`):
isolamento por usuário (RLS), idempotência da aula vista, inscrição única por
usuário×produto, ausência de caminho de conclusão (SC-003), gate de gestão
(FR-004); `tests/rls.test.ts` estendido para as 8 tabelas novas.

> Nota (memória do ambiente): nesta máquina de desenvolvimento não há
> Docker/Postgres — as validações de banco rodam no ambiente que os possui.

## Aceite da fase

- [ ] Cenários 1–4 validados pelo PO
- [ ] Critérios SC-001…SC-006 da spec conferidos
- [ ] CHANGELOG atualizado (minor da plataforma)
