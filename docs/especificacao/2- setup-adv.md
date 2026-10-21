# Prompt — Setup do Projeto
## Sistema de Gestão — Escritório de Advocacia

Você vai configurar o ambiente completo do projeto React para o sistema de gestão do escritório de advocacia. Execute os passos **na ordem exata** abaixo.

---

## PASSO 1 — CRIAR O PROJETO

```bash
npm create vite@latest sistema-adv -- --template react-ts
cd sistema-adv
```

---

## PASSO 2 — INSTALAR DEPENDÊNCIAS

```bash
npm install \
  @supabase/supabase-js \
  react-router-dom \
  @dnd-kit/core \
  @dnd-kit/sortable \
  @dnd-kit/utilities \
  recharts \
  date-fns \
  lucide-react \
  clsx

npm install -D \
  tailwindcss \
  postcss \
  autoprefixer \
  @types/react \
  @types/react-dom
```

---

## PASSO 3 — CONFIGURAR TAILWIND CSS

```bash
npx tailwindcss init -p
```

Substituir o conteúdo de `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        accent: '#C9A84C',
        primary: '#1C2B3A',
      },
      borderRadius: {
        card: '12px',
        modal: '16px',
      },
    },
  },
  plugins: [],
}
```

Substituir o conteúdo de `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Fontes */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

/* Tokens — Light Mode */
:root {
  --bg-base: #F8F6F1;
  --bg-sidebar: #1C2B3A;
  --bg-card: #FFFFFF;
  --border-card: #E8E2D9;
  --primary: #1C2B3A;
  --primary-hover: #243547;
  --accent: #C9A84C;
  --accent-light: #FBF5E6;
  --text-main: #1C2B3A;
  --text-muted: #7A7060;
  --success: #4A7C59;
  --warning: #D4834A;
  --danger: #B94040;
  --sidebar-text: #FFFFFF;
  --sidebar-muted: #8BA0B4;
  --sidebar-active: #243547;
  --sidebar-border: #2D3F52;
}

/* Tokens — Dark Mode */
.dark {
  --bg-base: #111820;
  --bg-sidebar: #0D1520;
  --bg-card: #1A2535;
  --border-card: #253040;
  --primary: #C9A84C;
  --primary-hover: #D4B86A;
  --accent: #C9A84C;
  --accent-light: #2A2215;
  --text-main: #EAE4D8;
  --text-muted: #8A9AAA;
  --success: #4A7C59;
  --warning: #D4834A;
  --danger: #B94040;
  --sidebar-text: #EAE4D8;
  --sidebar-muted: #5A7090;
  --sidebar-active: #1A2535;
  --sidebar-border: #1A2535;
}

/* Base */
* {
  box-sizing: border-box;
}

body {
  background-color: var(--bg-base);
  color: var(--text-main);
  font-family: 'DM Sans', sans-serif;
  transition: background-color 0.2s, color 0.2s;
}

h1, h2, h3 {
  font-family: 'Playfair Display', serif;
}
```

---

## PASSO 4 — VARIÁVEIS DE AMBIENTE

Você tem acesso ao Supabase via MCP. Antes de criar o arquivo `.env`, busque automaticamente via MCP:
- A **URL do projeto** (`VITE_SUPABASE_URL`)
- A **chave anon/public** (`VITE_SUPABASE_ANON_KEY`)

Após buscar os valores, criar o arquivo `.env` na raiz do projeto preenchido automaticamente:

```env
VITE_SUPABASE_URL=<valor_buscado_via_mcp>
VITE_SUPABASE_ANON_KEY=<valor_buscado_via_mcp>
```

Criar também o arquivo `.env.example` para referência:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Adicionar `.env` ao `.gitignore`:

```
# .gitignore
.env
.env.local
node_modules
dist
```

---

## PASSO 5 — CONFIGURAR SUPABASE

Criar o arquivo `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## PASSO 6 — TYPES DO BANCO DE DADOS

Criar o arquivo `src/types/index.ts` com os tipos TypeScript espelhando o banco de dados:

```typescript
// ─── ENUMs ────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'novo_contato'
  | 'conversando'
  | 'consulta_agendada'
  | 'compareceu'
  | 'follow_up'
  | 'fechado'
  | 'perdido'

export type AgendamentoStatus =
  | 'agendado'
  | 'confirmado'
  | 'compareceu'
  | 'faltou'
  | 'cancelado'

export type DiaSemana =
  | 'domingo'
  | 'segunda'
  | 'terca'
  | 'quarta'
  | 'quinta'
  | 'sexta'
  | 'sabado'

// ─── TABELAS ──────────────────────────────────────────────────────────────────

export interface LeadAdv {
  id: string
  nome_lead: string | null
  whatsapp_lead: string
  motivo_contato: string | null
  resumo_conversa: string | null
  status: LeadStatus
  inicio_atendimento: string | null
  ultima_mensagem: string | null
  minutos_ultima_mensagem: number | null
  follow_up_1: string | null
  follow_up_2: string | null
  follow_up_3: string | null
  data_agendamento: string | null
  id_agendamento: string | null
  anotacoes: string | null
  created_at: string
  // Campos Chatwoot: existem no banco mas NUNCA usar no frontend
}

export interface ClienteAdv {
  id: string
  lead_id: string
  data_primeira_visita: string
  created_at: string
  // Join com leads_adv
  lead?: LeadAdv
}

export interface OfficeConfig {
  id: number
  nome: string
  logo_url: string | null
  favicon_url: string | null
  updated_at: string
}

export interface OfficeHours {
  id: string
  dia: DiaSemana
  aberto: boolean
  hora_inicio: string | null
  hora_fim: string | null
}

export interface Advogado {
  id: string
  nome: string
  cor: string
  ativo: boolean
  created_at: string
}

export interface AdvogadoHours {
  id: string
  advogado_id: string
  dia: DiaSemana
  aberto: boolean
  hora_inicio: string | null
  hora_fim: string | null
}

export interface AgendamentoAdv {
  id: string
  advogado_id: string
  lead_id: string | null
  cliente_id: string | null
  data_hora_inicio: string
  data_hora_fim: string
  status: AgendamentoStatus
  observacoes: string | null
  created_at: string
  // Joins
  lead?: LeadAdv
  advogado?: Advogado
}

// ─── FILTROS ──────────────────────────────────────────────────────────────────

export type FilterPreset =
  | 'hoje'
  | 'ontem'
  | 'ultimos_7_dias'
  | 'ultimos_14_dias'
  | 'este_mes'
  | 'mes_passado'
  | 'este_ano'
  | 'personalizado'

export interface DateFilter {
  preset: FilterPreset
  startDate: string
  endDate: string
}
```

---

## PASSO 7 — CONTEXT DE TEMA

Criar o arquivo `src/contexts/ThemeContext.tsx`:

```typescript
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

---

## PASSO 8 — APP.TSX E ROTAS

Substituir o conteúdo de `src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Kanban from './pages/Kanban'
import Leads from './pages/Leads'
import LeadDetalhe from './pages/LeadDetalhe'
import Clientes from './pages/Clientes'
import ClienteDetalhe from './pages/ClienteDetalhe'
import FollowUp from './pages/FollowUp'
import Agendamentos from './pages/Agendamentos'
import Configuracoes from './pages/Configuracoes'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetalhe />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalhe />} />
            <Route path="/follow-up" element={<FollowUp />} />
            <Route path="/agendamentos" element={<Agendamentos />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
```

---

## PASSO 9 — ESTRUTURA DE PASTAS

Criar as pastas e arquivos vazios para o agente de frontend preencher:

```bash
mkdir -p src/components/layout
mkdir -p src/components/ui
mkdir -p src/contexts
mkdir -p src/pages
mkdir -p src/lib
mkdir -p src/types

touch src/components/layout/Sidebar.tsx
touch src/components/layout/Header.tsx
touch src/components/layout/Layout.tsx
touch src/components/ui/Button.tsx
touch src/components/ui/Input.tsx
touch src/components/ui/Badge.tsx
touch src/components/ui/Card.tsx
touch src/components/ui/Modal.tsx
touch src/components/ui/PageHeader.tsx
touch src/components/ui/FilterBar.tsx
touch src/pages/Dashboard.tsx
touch src/pages/Kanban.tsx
touch src/pages/Leads.tsx
touch src/pages/LeadDetalhe.tsx
touch src/pages/Clientes.tsx
touch src/pages/ClienteDetalhe.tsx
touch src/pages/FollowUp.tsx
touch src/pages/Agendamentos.tsx
touch src/pages/Configuracoes.tsx
```

---

## PASSO 10 — VERIFICAR INSTALAÇÃO

```bash
npm run dev
```

O projeto deve abrir em `http://localhost:5173` sem erros. Se houver erros de importação, verificar se todas as dependências foram instaladas corretamente.

---

## RESUMO DO QUE FOI CONFIGURADO

| # | O que foi feito |
|---|---|
| 1 | Projeto React + Vite + TypeScript criado |
| 2 | Todas as dependências instaladas |
| 3 | Tailwind CSS configurado com tokens de design |
| 4 | Variáveis de ambiente do Supabase configuradas |
| 5 | Cliente Supabase configurado em `src/lib/supabase.ts` |
| 6 | Types TypeScript criados espelhando o banco de dados |
| 7 | ThemeContext configurado com dark/light mode |
| 8 | App.tsx com todas as rotas configuradas |
| 9 | Estrutura de pastas e arquivos criada |
| 10 | Projeto rodando sem erros |

Após concluir todos os passos, o projeto está pronto para receber o prompt do frontend.
