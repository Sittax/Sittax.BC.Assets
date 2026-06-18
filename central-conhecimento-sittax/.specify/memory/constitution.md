<!--
Sync Impact Report
==================
Version change: TEMPLATE (none) → 1.0.0
Rationale: primeira ratificação da constituição do projeto (MAJOR inicial).

Modified principles: n/a (criação inicial — 11 princípios adicionados)
Added sections:
  - Core Principles (I–XI)
  - Fontes da Verdade
  - Fluxo de Desenvolvimento e Portões de Qualidade
  - Governance
Removed sections: n/a

Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ compatível (gate "Constitution Check"
    é preenchido em tempo de plano a partir deste arquivo; nenhuma edição necessária)
  - .specify/templates/spec-template.md — ✅ compatível (histórias priorizadas e
    independentes alinham com Princípios X e XI)
  - .specify/templates/tasks-template.md — ⚠ pendente: o template declara
    "Tests are OPTIONAL"; o Princípio IX torna testes OBRIGATÓRIOS para
    sanitização, conclusão imutável e RLS. Ao gerar tasks.md, incluir essas
    tarefas de teste mesmo sem pedido explícito na spec.
  - .specify/templates/checklist-template.md — ✅ compatível (genérico)

Follow-up TODOs: nenhum.
-->

# Constituição da Central de Conhecimento Sittax

## Core Principles

### I. Separar Dado de Regra

Fatos (contrato vigente, papel do usuário, eventos de conclusão) são armazenados como
dados; permissões e decisões de acesso são calculadas em uma camada única e exclusiva.
Nenhuma regra de autorização pode ser duplicada em telas, queries avulsas ou jobs.
Racional: regra espalhada diverge; regra centralizada é auditável e testável.

### II. Autorização Centralizada via RLS do Postgres

Toda autorização de leitura e escrita é imposta por Row-Level Security no Postgres.
Nenhuma query roda sem o contexto do usuário setado na transação
(`SET LOCAL app.user_id` / `SET LOCAL app.papel`), e esse contexto é encapsulado em um
helper único de acesso ao banco — nenhuma query pode existir fora dele. Código que
acessa o banco sem passar pelo helper é defeito bloqueante, não estilo.

### III. Conteúdo Interno Nunca Sai do Servidor (NÃO NEGOCIÁVEL)

Conteúdo interno jamais é entregue a uma sessão de cliente — nem em HTML, nem em JSON,
nem em índice de busca. A sanitização dos blocos `:::nota-interna` e `:::nota-tecnica`
é uma função única, server-side, coberta por teste automatizado, e se aplica a páginas,
busca e qualquer endpoint futuro. Filtrar no front-end não conta como sanitização.

### IV. Conclusão é Fato, Não Cálculo

Conclusão de EAD, emissão de certificado e positivação são eventos imutáveis,
registrados com data e nunca recalculados. Indicadores vivos (% de progresso, trilha
em andamento) jamais revertem um evento de conclusão já registrado. A imutabilidade é
coberta por teste automatizado.

### V. Produto é a Dimensão Suprema

Todo conteúdo voltado a cliente é organizado sob a dimensão Produto. Conteúdo interno
(EAD interno) existe fora dessa dimensão como exceção declarada e documentada — nunca
como caso implícito ou "produto fantasma".

### VI. Papel Nasce na Origem; Permissão é do Servidor

O papel do usuário nasce nos 6 sistemas de origem e é espelhado via n8n a cada login;
papel local existe apenas para usuários exclusivos da central. Toda permissão é
verificada no servidor em toda requisição — esconder botão ou rota na UI é cortesia de
experiência, nunca a regra de segurança.

### VII. Reaproveitar Antes de Criar

Antes de criar mecanismo novo, reutilizar o existente: o EAD interno reusa a máquina do
EAD de cliente; os blocos internos reusam o controle de papel. Criar mecanismo paralelo
exige justificativa registrada na seção Complexity Tracking do plano.

### VIII. Tudo Operável pela Interface

Nenhuma operação de negócio exige SQL manual ou deploy. Toda entidade de negócio tem
tela de CRUD acessível ao papel dono dela. Se uma operação rotineira só é possível via
banco ou código, a feature está incompleta.

### IX. Nascida para Evoluir

Migrações de banco versionadas (nunca alteração manual de schema); `CHANGELOG.md` com
versionamento semântico; seeds de desenvolvimento; configuração por variáveis de
ambiente; e testes automatizados obrigatórios nas regras críticas: sanitização de
conteúdo interno, imutabilidade de conclusão e RLS.

### X. v1 Tem que Ficar de Pé

Recurso ambicioso vira marco próprio, nunca peso no primeiro release. Cada release
entrega um conjunto coeso e funcional; escopo que ameace a estabilidade do v1 é adiado
explicitamente, com registro no roadmap.

### XI. Human in the Loop

O trabalho avança em fases pequenas, cada uma validada pelo Product Owner antes da
próxima começar. Nenhuma fase inicia sem a anterior aprovada; dúvidas de regra de
negócio são resolvidas com o PO, não assumidas.

## Fontes da Verdade

- **Regra de negócio**: `docs/escopo-plataforma-conhecimento-v2.md`. Conflitos entre
  código, spec e este documento se resolvem a favor dele; mudanças de regra começam
  por uma atualização nele.
- **UI e navegação**: `docs/layout-navegacao-claude-design.md`. Estrutura de telas,
  navegação e padrões visuais seguem este documento.
- Specs e planos gerados pelo Spec Kit DEVEM citar esses documentos quando derivarem
  requisitos deles, e DEVEM sinalizar divergências em vez de silenciá-las.

## Fluxo de Desenvolvimento e Portões de Qualidade

- O gate "Constitution Check" de todo plano (`plan-template.md`) DEVE verificar, no
  mínimo: acesso a banco apenas via helper com contexto RLS (II), sanitização única
  server-side (III), imutabilidade de conclusão (IV), permissão checada no servidor
  (VI), reuso antes de criação (VII), CRUD para toda entidade de negócio (VIII) e
  migração versionada para toda mudança de schema (IX).
- Todo `tasks.md` DEVE incluir tarefas de teste para as regras críticas do Princípio
  IX, mesmo que a spec não as peça explicitamente.
- Toda fase entregue termina com validação do Product Owner (XI) antes de a próxima
  fase ser planejada ou iniciada.
- Violações de princípio só são admissíveis com justificativa registrada na tabela
  Complexity Tracking do plano correspondente.

## Governance

Esta constituição prevalece sobre qualquer outra prática, template ou preferência de
implementação do projeto.

- **Emendas**: qualquer alteração é feita neste arquivo via `/speckit-constitution`,
  com aprovação do Product Owner, e DEVE propagar mudanças aos templates dependentes
  (`plan-template.md`, `spec-template.md`, `tasks-template.md`) na mesma emenda.
- **Versionamento**: semântico. MAJOR para remoção ou redefinição incompatível de
  princípio; MINOR para princípio novo ou orientação materialmente expandida; PATCH
  para esclarecimentos e correções de redação.
- **Conformidade**: todo plano passa pelo gate "Constitution Check" antes da fase de
  pesquisa e novamente após o design; toda revisão de código verifica aderência aos
  princípios, em especial II, III, IV e VI; não-conformidade sem justificativa
  registrada bloqueia a entrega.

**Version**: 1.0.0 | **Ratified**: 2026-06-09 | **Last Amended**: 2026-06-09
