# Layout & Navegação — Central de Conhecimento (v2)

> Spec da **casca (app shell)** e da navegação, pra prototipar no Claude Design.
> Use **junto com** `brief-visual-claude-design.md` (cores, tipografia, componentes) e o **print do Sittax Simples**.
> Regras de negócio e papéis: ver `escopo-plataforma-conhecimento-v2.md` (fonte da verdade de negócio; este doc é a fonte da verdade de **UI/navegação**).
> Direção: SaaS claro da família Sittax. **Rail de ícones recolhido + árvore dentro da tela.**

---

## 1. Estrutura — 3 regiões fixas

```
┌─────────────────────────────────────────────────────────┐
│  sittax|conhecimento   [ Sittax Simples ▾ ]  [buscar] (J) │  ← top bar
├──┬──────────────────────────────────────────────────────┤
│▢ │                                                        │
│▣ │              ÁREA DE CONTEÚDO                          │
│▢ │            (tela do módulo ativo)                      │
│▢ │                                                        │
│▢ │                                                        │
└──┴──────────────────────────────────────────────────────┘
 rail
```

- **Top bar** (fina, topo): marca + seletor de produto + busca + usuário.
- **Rail de ícones** (estreito, esquerda): navegação entre módulos. **Recolhido por padrão.**
- **Área de conteúdo** (resto): a tela do módulo ativo. (▣ = item ativo no rail.)

---

## 2. Rail de ícones — navegação principal

**Comportamento**
- **Recolhido por padrão** e pensado pra usar recolhido (largura ~64px, só ícones).
- **Hover (desktop) → expande** mostrando os rótulos, como **overlay sobre o conteúdo** (não empurra a tela — evita "pulo" de layout). Tirou o mouse, recolhe.
- **Toque (tablet/mobile) → um tap** revela os rótulos (não existe hover).
- Cada ícone tem **tooltip** e `aria-label` (clareza + acessibilidade).

```
recolhido (padrão)        hover → fly-out (overlay)
┌──┐                      ┌─────────────────────┐
│▢ │                      │ ▢  Dashboard         │
│▣ │        ──►           │ ▣  Base de conhec.   │
│▢ │                      │ ▢  EAD               │
│▢ │                      │ ▢  Atualizações      │
│▢ │                      │ ▢  EAD interno       │
└──┘                      └─────────────────────┘
```

**Itens** (de cima pra baixo)

| Ícone (lucide) | Módulo | Visível para |
|---|---|---|
| `layout-dashboard` | Dashboard | todos |
| `book-open` | Base de conhecimento | todos |
| `graduation-cap` | EAD | todos |
| `megaphone` | Atualizações | todos |
| `shield-check` | EAD interno | só suporte+ |

**Estados**
- **Padrão:** ícone cinza neutro (`--text-muted`).
- **Ativo:** indicador laranja — barra fina à esquerda + ícone laranja + fundo `--brand-orange-soft`.
- **Hover:** fly-out com ícone + rótulo de todos; o item ativo continua marcado.

---

## 3. Top bar

- **Esquerda:** logo (primeira palavra preta + segunda laranja, estilo Sittax).
- **Centro-esquerda:** **seletor de produto** (pill + dropdown, igual ao seletor de empresa do print). Trocar de produto = trocar o *conteúdo* de todos os módulos.
  - **Exceção — EAD interno:** dentro do módulo EAD interno, o seletor fica **desabilitado/atenuado** (tooltip: "EAD interno é organizado por temas"). O EAD interno não responde ao produto; organiza-se por temas internos. Ao sair do módulo, o seletor volta ao normal com o produto que estava selecionado.
- **Direita:** **busca** + **avatar** do usuário (papel/escritório no menu do avatar).

---

## 4. Área de conteúdo

Mostra a tela do módulo ativo. **Dashboard, EAD e Atualizações** ocupam a largura toda. A **Base de conhecimento** tem layout próprio (§5).

---

## 5. Base de conhecimento — árvore dentro da tela

A árvore (`Produto → Módulo → Tópico → subtópico`) vive **dentro da tela da Base**, como **painel fixo e recolhível** — **não** é um fly-out do rail.

```
┌──┬──────────────────────────────────────────────┐
│▣ │ Produto › Módulo › Tópico           [ocultar] │  ← breadcrumb
│▢ │┌─ árvore ─────┐                                │
│▢ ││ ▾ Módulo A   │   # Título do tópico           │
│▢ ││   • Tópico 1 │   conteúdo markdown…           │
│▢ ││   • Tópico 2◄│   :::nota-interna (suporte+)   │
│  ││ ▸ Módulo B   │                                │
│  │└──────────────┘   ‹ Anterior      Próximo ›    │
└──┴──────────────────────────────────────────────┘
```

- **Painel da árvore** (esquerda do conteúdo, ~260px): hierarquia do produto ativo; tópico atual destacado; ancestrais abertos.
- **Recolhível:** botão "Ocultar árvore" pra ler em largura total; "Mostrar árvore" pra trazer de volta.

```
árvore recolhida (leitura plena)
┌──┬──────────────────────────────────────────────┐
│▣ │ Produto › Módulo › Tópico           [mostrar] │
│▢ │                                                │
│▢ │        # Título do tópico                      │
│▢ │        conteúdo markdown em largura total…     │
└──┴──────────────────────────────────────────────┘
```

- **Breadcrumb** no topo: `Produto › Módulo › Tópico`, clicável.
- **Anterior / Próximo** no rodapé (irmãos dentro do módulo).
- A árvore **só aparece na Base** — some nos outros módulos.

---

## 5.1 Modo de edição (GitBook-style) — suporte+

O modo de edição é **inline na mesma tela** — não é uma rota separada. Toda a Base responde a um único botão **Editar** no canto superior direito do conteúdo.

```
modo leitura                         modo edição
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ Produto › Módulo › Tópico [Edit] │  │ Modo de edição    [Cancelar][Salvar]│
│┌─ árvore ──────┐                 │  │┌─ árvore ──────┐                    │
││ ▾ Módulo A    │  # Título       │  ││ ▾ Módulo A ⠿  │  [título editável] │
││   • Tópico 1  │  conteúdo…      │  ││   ⠿ Tópico 1⋯ │  editor Milkdown   │
││   • Tópico 2◄ │                 │  ││   ⠿ Tópico 2⋯◄│                    │
│└───────────────┘                 │  │└───────────────┘                    │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

**Comportamento**
- Clicar **Editar** → modo edição; URL persiste `?modo=editar` (recarregar volta ao modo de edição).
- **Cancelar** → descarta e volta à leitura (`?modo=editar` removido da URL, sem reload).
- **Salvar** → persiste via server action, atualiza a página e volta à leitura.
- Em modo de edição, links da árvore navegam mantendo `?modo=editar` (experiência consistente entre tópicos).

**Árvore em modo de edição** — borda laranja sinaliza o estado; exibe affordances de edição que ficam ocultas em leitura (suporte+ somente):

| Affordance | Aparece em | Comportamento |
|---|---|---|
| ⠿ (drag handle) | hover em tópico ou módulo | arrastar reordena; cross-módulo permitido no mesmo produto |
| ⋯ (três pontos) | hover em tópico ou módulo | dropdown: **Renomear** (inline input) · **Excluir** (confirmação) |
| **Insert zone** | hover em tópico | linha sutil + botão `+` circular, sobreposta na borda inferior do item |
| **+ Adicionar módulo** | rodapé da árvore | sempre visível em modo de edição |

**Padrão de insert zone (sem layout shift)** — o `+` é posicionado `absolute` com `height: 0`
na borda inferior do item; o conteúdo visual (linha + botão) divide-se metade acima e metade abaixo
via `align-items: center` em container de altura zero. Nenhum item da lista se move quando o `+`
aparece ou some. Clicar `+` abaixo de um tópico cria subtópico; abaixo do último tópico do módulo
cria página no mesmo módulo.

**Renomear inline** — ao confirmar Renomear, o input substitui o rótulo no lugar; `Enter` confirma,
`Esc` cancela; ao confirmar, o slug é regerado no servidor.

---

## 6. Responsivo

- **Desktop:** rail recolhido + fly-out no hover; árvore como painel lateral dentro da Base.
- **Tablet:** igual, mas expande por tap.
- **Mobile:** rail vira **barra inferior** de ícones; a árvore da Base vira **drawer/accordion** no topo da tela, recolhido por padrão.

---

## 7. Tokens relevantes (do brief visual)

- Ativo / indicador: `--brand-orange #F37021` + fundo `--brand-orange-soft #FDEBDD`.
- Ícones em repouso: `--text-muted #8A8F98`.
- Superfícies: rail e painéis em `--surface #FFFFFF`; fundo `--bg #F4F5F7`.
- Cantos e sombras conforme o brief (`--radius-*`, `--shadow-*`).

---

## 8. Microcopy

- Rótulos curtos, *sentence case*: "Dashboard", "Base de conhecimento", "EAD", "Atualizações", "EAD interno".
- Tooltip = o próprio rótulo.
- Toggle da árvore: "Ocultar árvore" / "Mostrar árvore".

---

## 9. Estados pra prototipar (checklist)

- [ ] Rail recolhido (padrão)
- [ ] Rail em hover → fly-out com rótulos
- [ ] Item ativo marcado em laranja
- [ ] Base com árvore aberta (painel + página)
- [ ] Base com árvore recolhida (leitura plena)
- [ ] EAD interno ativo → seletor de produto desabilitado/atenuado (com tooltip)
- [ ] Mobile (barra inferior + árvore em drawer)
