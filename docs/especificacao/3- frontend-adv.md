# Prompt — Frontend
## Sistema de Gestão — Escritório de Advocacia

Você vai criar o frontend completo de um sistema de gestão para um escritório de advocacia. O banco de dados já está criado no Supabase. Você tem acesso ao Supabase via MCP.

Siga **exatamente** as especificações abaixo. Não simplifique, não pule etapas, não invente padrões diferentes dos definidos.

---

## STACK TECNOLÓGICA

- **Framework:** React com Vite
- **Estilização:** Tailwind CSS
- **Ícones:** Lucide React
- **Banco:** Supabase (já conectado via MCP)
- **Linguagem:** TypeScript
- **Roteamento:** React Router DOM
- **Drag and drop (Kanban):** @dnd-kit/core + @dnd-kit/sortable
- **Gráficos:** Recharts
- **Data:** date-fns

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities recharts date-fns
```

---

## DESIGN SYSTEM

### Fontes

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
```

- **Títulos (h1, h2, h3):** `Playfair Display`
- **Todo o resto:** `DM Sans`

### Ícones
Lucide React — traço fino, tamanho padrão `18px`. Nunca usar ícones preenchidos.

### Bordas
- Cards: `border-radius: 12px`
- Inputs/botões: `border-radius: 8px`
- Badges: `border-radius: 999px`
- Modais: `border-radius: 16px`

### Paleta — Light Mode

| Token | Hex | Uso |
|---|---|---|
| `--bg-base` | `#F8F6F1` | Background geral |
| `--bg-sidebar` | `#1C2B3A` | Background da sidebar |
| `--bg-card` | `#FFFFFF` | Background dos cards |
| `--border-card` | `#E8E2D9` | Borda dos cards |
| `--primary` | `#1C2B3A` | Botões primários, destaques |
| `--primary-hover` | `#243547` | Hover dos botões primários |
| `--accent` | `#C9A84C` | Acento dourado — botões secundários, bordas ativas, badges |
| `--accent-light` | `#FBF5E6` | Background de badges e destaques suaves |
| `--text-main` | `#1C2B3A` | Texto principal |
| `--text-muted` | `#7A7060` | Texto secundário |
| `--success` | `#4A7C59` | Status positivo |
| `--warning` | `#D4834A` | Alertas |
| `--danger` | `#B94040` | Ações destrutivas |
| `--sidebar-text` | `#FFFFFF` | Texto da sidebar |
| `--sidebar-muted` | `#8BA0B4` | Texto secundário da sidebar |
| `--sidebar-active` | `#243547` | Item ativo na sidebar |
| `--sidebar-border` | `#2D3F52` | Divisores da sidebar |

### Paleta — Dark Mode

| Token | Hex | Uso |
|---|---|---|
| `--bg-base` | `#111820` | Background geral |
| `--bg-sidebar` | `#0D1520` | Background da sidebar |
| `--bg-card` | `#1A2535` | Background dos cards |
| `--border-card` | `#253040` | Borda dos cards |
| `--primary` | `#C9A84C` | Botões primários |
| `--accent` | `#C9A84C` | Mesma cor de acento |
| `--accent-light` | `#2A2215` | Background de badges |
| `--text-main` | `#EAE4D8` | Texto principal |
| `--text-muted` | `#8A9AAA` | Texto secundário |
| `--sidebar-active` | `#1A2535` | Item ativo |
| `--sidebar-border` | `#1A2535` | Divisores |

### Badges de Status — leads_adv

| Status | Background | Texto | Borda |
|---|---|---|---|
| `novo_contato` | `#EBF4FF` | `#1C5EA8` | `#BFDBFE` |
| `conversando` | `#FEF9E7` | `#92600A` | `#FDE68A` |
| `consulta_agendada` | `#F0FDF4` | `#166534` | `#BBF7D0` |
| `compareceu` | `#F5F3FF` | `#5B21B6` | `#DDD6FE` |
| `follow_up` | `#FFF7ED` | `#9A3412` | `#FED7AA` |
| `fechado` | `#ECFDF5` | `#065F46` | `#6EE7B7` |
| `perdido` | `#FEF2F2` | `#991B1B` | `#FECACA` |

### Badges de Status — agendamentos_adv

| Status | Background | Texto | Borda |
|---|---|---|---|
| `agendado` | `#EBF4FF` | `#1C5EA8` | `#BFDBFE` |
| `confirmado` | `#F0FDF4` | `#166534` | `#BBF7D0` |
| `compareceu` | `#F5F3FF` | `#5B21B6` | `#DDD6FE` |
| `faltou` | `#FEF2F2` | `#991B1B` | `#FECACA` |
| `cancelado` | `#F3F4F6` | `#6B7280` | `#E5E7EB` |

---

## ESTRUTURA DE ARQUIVOS

```
src/
  components/
    layout/
      Sidebar.tsx
      Header.tsx
      Layout.tsx
    ui/
      Button.tsx
      Input.tsx
      Badge.tsx
      Card.tsx
      Modal.tsx
      PageHeader.tsx
      FilterBar.tsx
  contexts/
    ThemeContext.tsx
  pages/
    Dashboard.tsx
    Kanban.tsx
    Leads.tsx
    LeadDetalhe.tsx
    Clientes.tsx
    ClienteDetalhe.tsx
    FollowUp.tsx
    Agendamentos.tsx
    Configuracoes.tsx
  lib/
    supabase.ts
  types/
    index.ts
  App.tsx
  main.tsx
```

---

## SIDEBAR

**Estrutura visual (de cima para baixo):**

```
┌─────────────────────────┐
│  ⚖ Escritório           │
│     de Advocacia        │
├─────────────────────────┤
│  Dashboard              │
│  Kanban                 │
│  Leads                  │
│  Clientes               │
│  Follow Up              │
│  Agendamentos           │
│  Configurações          │
├─────────────────────────┤
│  [☀/🌙] dark/light     │
└─────────────────────────┘
```

- Largura fixa: `240px`
- Background: `--bg-sidebar`
- Borda direita: `1px solid --sidebar-border`
- Topo: ícone `Scale` (Lucide) + texto "Escritório de Advocacia" em `Playfair Display` 14px
- Botão dark/light mode no rodapé com ícones `Sun` / `Moon`
- Responsividade: drawer em mobile

**Itens de navegação:**
```
Dashboard       → ícone LayoutDashboard  → /dashboard
Kanban          → ícone Kanban           → /kanban
Leads           → ícone Users            → /leads
Clientes        → ícone UserCheck        → /clientes
Follow Up       → ícone Bell             → /follow-up
Agendamentos    → ícone CalendarDays     → /agendamentos
Configurações   → ícone Settings         → /configuracoes
```

**Item ativo:**
- Background: `--sidebar-active`
- Ícone e texto: `--sidebar-text`
- Borda esquerda: `3px solid --accent`

---

## ROTAS

```
/                → redirecionar para /dashboard
/dashboard       → Dashboard.tsx
/kanban          → Kanban.tsx
/leads           → Leads.tsx
/leads/:id       → LeadDetalhe.tsx
/clientes        → Clientes.tsx
/clientes/:id    → ClienteDetalhe.tsx
/follow-up       → FollowUp.tsx
/agendamentos    → Agendamentos.tsx
/configuracoes   → Configuracoes.tsx
```

---

## COMPONENTE: PageHeader

Todas as páginas devem usar o componente `PageHeader` no topo do conteúdo, com:
- **Título** em `Playfair Display` 28px
- **Descrição** em `DM Sans` 14px, cor `--text-muted`

---

## COMPONENTE: FilterBar

Filtros de data usados em: Dashboard, Leads, Clientes, Follow Up, Agendamentos.

**Filtros fixos (botões):**
- Hoje
- Ontem
- Últimos 7 dias
- Últimos 14 dias
- Este mês
- Mês passado
- Este ano

**Filtro personalizado:**
- Ícone `CalendarDays` + texto "Personalizado"
- Abre date picker com intervalo de datas
- Datas futuras bloqueadas
- Ao selecionar, exibir o intervalo escolhido no botão

Apenas um filtro ativo por vez. O filtro selecionado usa `--accent` como cor de fundo.

---

## PÁGINA 1 — DASHBOARD

**Rota:** `/dashboard`

**Título:** Dashboard
**Descrição:** Acompanhe os principais indicadores de atendimento do seu escritório no período selecionado — volume de leads, consultas agendadas e o desempenho do Agente de IA nos atendimentos realizados.

### Estrutura

```
┌─ FilterBar ────────────────────────────────────────┐
└────────────────────────────────────────────────────┘

┌─ Card ──┐  ┌─ Card ──┐  ┌─ Card ───────────────┐
│ Leads   │  │Clientes │  │  Consultas Hoje       │
└─────────┘  └─────────┘  └──────────────────────┘

┌─ Gráfico Linha (largura total) ────────────────────┐
│  Volume de Leads por Dia                           │
└────────────────────────────────────────────────────┘

┌─ Gráfico Barras ────┐  ┌─ Gráfico Pizza ──────────┐
│  Leads por Dia      │  │  Atendimentos por Horário │
│  da Semana          │  │                           │
└─────────────────────┘  └──────────────────────────┘

┌─ Tabela: Leads no Período ─────────────────────────┐
└────────────────────────────────────────────────────┘
```

### Cards de métricas

**Total de Leads**
- Valor: COUNT de leads_adv com `inicio_atendimento` no período
- Subtítulo: "No período selecionado"
- Ícone: `Users`

**Total de Clientes**
- Valor: COUNT de clientes_adv com `created_at` no período
- Subtítulo: "No período selecionado"
- Ícone: `UserCheck`

**Consultas Hoje**
- Valor: COUNT de agendamentos_adv com `data_hora_inicio` = hoje e status != `cancelado`
- Subtítulo: "Agendadas para hoje"
- Ícone: `CalendarDays`
- Este card **não é afetado pelo filtro** — sempre mostra o dia atual

### Gráfico 1 — Linha (largura total)

**Título:** Volume de Leads por Dia
**Descrição:** Acompanhe a quantidade de leads que entraram em contato com o escritório a cada dia no período selecionado.

- Dados: COUNT de leads_adv agrupados por `DATE(inicio_atendimento)` no período
- Eixo X: datas do período
- Eixo Y: quantidade de leads
- Cor da linha: `--accent`
- Tooltip com data e quantidade

### Gráfico 2 — Barras

**Título:** Leads por Dia da Semana
**Descrição:** Descubra quais dias da semana concentram o maior volume de novos contatos, de segunda a domingo.

- Dados: COUNT de leads_adv agrupados por dia da semana (`EXTRACT(DOW FROM inicio_atendimento)`) no período
- Eixo X: Dom, Seg, Ter, Qua, Qui, Sex, Sáb
- Eixo Y: quantidade de leads
- Cor das barras: `--accent`

### Gráfico 3 — Pizza

**Título:** Atendimentos por Horário
**Descrição:** Veja quantos atendimentos foram realizados dentro e fora do horário comercial — e o impacto direto do Agente de IA na captação de leads fora do expediente.

- Dados: COUNT de leads_adv com `inicio_atendimento` no período, comparado com `office_hours`
- Classificar como "dentro" se o horário de `inicio_atendimento` estiver dentro do horário do dia correspondente em `office_hours` (aberto = true)
- Classificar como "fora" caso contrário
- Exibir **números absolutos** (ex: "32 atendimentos" e "8 atendimentos") — não porcentagem
- Dentro do card exibir o horário comercial atual em tempo real, puxado do `office_hours` (ex: "seg–sex, 08:00–18:00")
- Aviso abaixo do gráfico: *"Os atendimentos fora do horário comercial foram realizados pelo Agente de IA. Sem ele, esses leads poderiam ter sido perdidos para a concorrência."*

### Tabela: Leads no Período

**Título:** Leads no Período
**Descrição:** Todos os leads que entraram em contato com o escritório no período selecionado. Clique em qualquer linha para acessar o perfil completo do lead.

**Colunas:**
| Início do Atendimento | Nome | WhatsApp | Motivo do Contato | Status |

- Filtrar por `inicio_atendimento` no período selecionado
- Cada linha clicável → `/leads/:id`
- Status exibido como badge

---

## PÁGINA 2 — KANBAN

**Rota:** `/kanban`

**Título:** Kanban
**Descrição:** Visualize e gerencie o avanço de cada lead pelo funil de atendimento. Arraste os cards entre as etapas e o sistema atualiza o status automaticamente em todo o escritório.

### Colunas

Cada coluna representa um status. Exibir nome e descrição da coluna no topo:

| Status | Nome | Descrição |
|---|---|---|
| `novo_contato` | Novo Contato | Lead acabou de entrar em contato |
| `conversando` | Conversando | Em conversa, coletando informações |
| `consulta_agendada` | Consulta Agendada | Consulta marcada, aguardando comparecimento |
| `compareceu` | Compareceu | Compareceu à consulta e virou cliente |
| `follow_up` | Follow Up | Agente de IA realizará o follow up automaticamente |
| `fechado` | Fechado | Contrato fechado, cliente ativo |
| `perdido` | Perdido | Desistiu ou sem retorno |

### Cards

Cada card exibe:
- Nome do lead (ou WhatsApp se nome não preenchido)
- Motivo do contato
- Data de início do atendimento
- Badge de status

### Drag and drop

- Implementar com `@dnd-kit/core` e `@dnd-kit/sortable`
- Ao soltar o card em nova coluna → `UPDATE leads_adv SET status = 'novo_status' WHERE id = lead_id`
- Atualização em tempo real em todo o sistema
- **Ao mover para `compareceu`:** exibir modal de confirmação antes de executar o update:
  > *"Ao confirmar, este lead será promovido a cliente. Essa ação pode ser revertida movendo o card para outro status."*
  - Botões: "Cancelar" e "Confirmar"

---

## PÁGINA 3 — LEADS

**Rota:** `/leads`

**Título:** Leads
**Descrição:** Lista completa de todas as pessoas que entraram em contato com o escritório e ainda não compareceram a uma consulta. Clique em qualquer lead para ver o histórico completo da conversa.

### Filtro

- FilterBar padrão (filtrar por `inicio_atendimento`)
- Exibir apenas leads cujo `id` **não está** em `clientes_adv`

### Tabela

**Colunas:**
| Início do Atendimento | Nome | WhatsApp | Motivo do Contato | Status |

- Cada linha clicável → `/leads/:id`
- Status exibido como badge

---

## PÁGINA 4 — LEAD (página individual)

**Rota:** `/leads/:id`

Exibir todas as informações do lead. **Nunca exibir** os campos Chatwoot (`id_conta_chatwoot`, `id_conversa_chatwoot`, `id_lead_chatwoot`, `inbox_id_chatwoot`).

### Campos exibidos

- Nome
- WhatsApp
- Motivo do contato
- Resumo da conversa
- Status (badge editável — ao alterar, executa UPDATE em leads_adv)
- Início do atendimento
- Última mensagem
- Follow up 1, 2 e 3
- Data do agendamento
- Anotações (campo de texto editável — ao salvar, executa UPDATE em leads_adv)

### Layout sugerido

- Topo: nome do lead + badge de status + botão voltar
- Duas colunas: informações à esquerda, anotações à direita

---

## PÁGINA 5 — CLIENTES

**Rota:** `/clientes`

**Título:** Clientes
**Descrição:** Todos os contatos que já compareceram a uma consulta presencial ou online. A promoção de lead para cliente acontece automaticamente quando a consulta é confirmada.

### Filtro

- FilterBar padrão (filtrar por `inicio_atendimento` de leads_adv)
- Exibir apenas leads cujo `id` **está** em `clientes_adv`

### Tabela

**Colunas:**
| Início do Atendimento | Nome | WhatsApp | Motivo do Contato |

- Cada linha clicável → `/clientes/:id`

---

## PÁGINA 6 — CLIENTE (página individual)

**Rota:** `/clientes/:id`

Mesma estrutura da página individual do lead, com os mesmos campos e layout.

---

## PÁGINA 7 — FOLLOW UP

**Rota:** `/follow-up`

**Título:** Follow Up
**Descrição:** Leads que precisam de acompanhamento para avançar no funil. O Agente de IA realiza os follow ups automaticamente, garantindo que nenhuma oportunidade seja perdida.

### Filtro

- FilterBar padrão (filtrar por `inicio_atendimento`)
- Exibir apenas leads com `status = 'follow_up'`

### Tabela

**Colunas:**
| Início do Atendimento | Nome | WhatsApp | Motivo do Contato | Status | Última Mensagem |

- Cada linha clicável → `/leads/:id`
- Status exibido como badge

---

## PÁGINA 8 — AGENDAMENTOS

**Rota:** `/agendamentos`

**Título:** Agendamentos
**Descrição:** Gerencie todas as consultas marcadas no escritório. Atualize o status de cada agendamento diretamente por aqui — ao confirmar o comparecimento, o lead é promovido a cliente automaticamente.

### Filtro

- FilterBar padrão (filtrar por `data_hora_inicio`)

### Tabela

**Colunas:**
| Nome | WhatsApp | Data do Agendamento | Motivo do Contato | Status |

- Nome e WhatsApp puxados de `leads_adv` via `lead_id`
- Status exibido como badge
- **Ação rápida de status:** cada linha tem um select ou botão de ação para atualizar o status do agendamento diretamente
- **Ao marcar `compareceu`:** exibir modal de confirmação:
  > *"Ao confirmar, este lead será promovido a cliente automaticamente."*
  - Botões: "Cancelar" e "Confirmar"

---

## PÁGINA 9 — CONFIGURAÇÕES

**Rota:** `/configuracoes`

**Título:** Configurações
**Descrição:** Personalize as informações do seu escritório — nome, logo, favicon e horário de funcionamento. O horário configurado aqui reflete automaticamente nos relatórios do dashboard.

### Seção 1 — Informações do Escritório

Buscar dados de `office_config` (sempre id = 1).

- **Nome do escritório** — campo de texto. Ao salvar → UPDATE office_config
- **Logo** — upload de imagem. Salvar URL em `logo_url`
- **Favicon** — upload de imagem. Salvar URL em `favicon_url`
- Botão "Salvar alterações"

### Seção 2 — Horário de Funcionamento

Buscar dados de `office_hours` (7 linhas, uma por dia).

- Exibir os 7 dias da semana
- Cada dia tem:
  - Toggle aberto/fechado (`aberto`)
  - Campo hora início (`hora_inicio`) — visível apenas se aberto = true
  - Campo hora fim (`hora_fim`) — visível apenas se aberto = true
- Cada dia pode ter horário completamente independente
- Ao salvar → UPDATE office_hours para cada dia alterado
- Botão "Salvar horários"

> As alterações no horário de funcionamento refletem automaticamente no gráfico de Atendimentos por Horário no dashboard.

---

## DARK/LIGHT MODE

- Controle via `ThemeContext`
- Salvar preferência no `localStorage`
- Aplicar classe `dark` no elemento `html`
- Inicializar com preferência salva ou `prefers-color-scheme`
- Transição suave: `transition: background-color 0.2s, color 0.2s`

---

## REGRAS GERAIS OBRIGATÓRIAS

1. **Sem autenticação** — nenhuma tela de login, todas as páginas acessíveis diretamente
2. **Design system** — sempre usar os tokens CSS e componentes base definidos acima
3. **PageHeader** — todas as páginas devem ter título e descrição usando o componente PageHeader
4. **Loading states** — todo carregamento com skeleton ou spinner
5. **Feedback visual** — toda ação com toast de sucesso ou erro
6. **Timezone** — sempre `America/Sao_Paulo`
7. **Datas** — formato brasileiro DD/MM/YYYY HH:mm
8. **Responsividade** — funcionar em desktop, tablet e mobile
9. **Empty states** — quando não houver dados, exibir ícone + mensagem amigável
10. **Confirmar ações destrutivas** — ao mover lead para `compareceu` no Kanban e ao marcar `compareceu` em Agendamentos
11. **Soft delete** — nunca deletar registros — sempre atualizar status
12. **Campos Chatwoot** — nunca renderizar `id_conta_chatwoot`, `id_conversa_chatwoot`, `id_lead_chatwoot` e `inbox_id_chatwoot` em nenhuma tela, modal ou listagem
13. **Filtros** — o card "Consultas Hoje" no dashboard não é afetado pelo filtro de datas

---

## RESUMO DAS PÁGINAS

| # | Rota | Página |
|---|---|---|
| 1 | `/dashboard` | Dashboard com métricas e gráficos |
| 2 | `/kanban` | Kanban drag and drop |
| 3 | `/leads` | Lista de leads |
| 4 | `/leads/:id` | Página individual do lead |
| 5 | `/clientes` | Lista de clientes |
| 6 | `/clientes/:id` | Página individual do cliente |
| 7 | `/follow-up` | Lista de follow ups |
| 8 | `/agendamentos` | Lista de agendamentos |
| 9 | `/configuracoes` | Configurações do escritório |
