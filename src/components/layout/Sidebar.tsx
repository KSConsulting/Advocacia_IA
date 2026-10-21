import { NavLink } from 'react-router-dom'
import {
  Bell, CalendarClock, CalendarDays, Kanban, LayoutDashboard, MessageCircle,
  Moon, Scale, Settings, Sun, UserCheck, Users, X,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useEscritorio } from '../../contexts/EscritorioContext'

/**
 * Os 7 itens da especificação, na ordem dela, mais dois que substituem
 * ferramentas externas:
 *   • Conversas — era o Chatwoot
 *   • Agenda    — era o Google Calendar
 */
const ITENS = [
  { rota: '/dashboard', nome: 'Dashboard', Icone: LayoutDashboard },
  { rota: '/kanban', nome: 'Kanban', Icone: Kanban },
  { rota: '/conversas', nome: 'Conversas', Icone: MessageCircle },
  { rota: '/leads', nome: 'Leads', Icone: Users },
  { rota: '/clientes', nome: 'Clientes', Icone: UserCheck },
  { rota: '/follow-up', nome: 'Follow Up', Icone: Bell },
  { rota: '/agenda', nome: 'Agenda', Icone: CalendarClock },
  { rota: '/agendamentos', nome: 'Agendamentos', Icone: CalendarDays },
  { rota: '/configuracoes', nome: 'Configurações', Icone: Settings },
]

export default function Sidebar({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const { theme, toggleTheme } = useTheme()
  const { config } = useEscritorio()

  return (
    <>
      {/* Drawer em mobile: o fundo escurecido fecha ao clicar. */}
      {aberta && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onFechar} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col transition-transform lg:static lg:translate-x-0 ${
          aberta ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          {config?.logo_url
            ? <img src={config.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
            : <Scale size={22} strokeWidth={1.5} style={{ color: 'var(--accent)' }} className="shrink-0" />}
          <span className="font-display text-sm leading-snug" style={{ color: 'var(--sidebar-text)' }}>
            {config?.nome ?? 'Escritório de Advocacia'}
          </span>
          <button onClick={onFechar} className="ml-auto lg:hidden" style={{ color: 'var(--sidebar-muted)' }} aria-label="Fechar menu">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {ITENS.map(({ rota, nome, Icone }) => (
            <NavLink
              key={rota}
              to={rota}
              onClick={onFechar}
              className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors"
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
                borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              })}
            >
              <Icone size={18} strokeWidth={1.5} />
              {nome}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--sidebar-muted)' }}
          >
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
            {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>
        </div>
      </aside>
    </>
  )
}
