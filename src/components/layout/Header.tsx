import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function Header({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  const { usuario, session, sair } = useAuth()
  const quem = usuario?.nome || usuario?.email || session?.user.email || ''

  return (
    <header
      className="flex h-14 items-center gap-3 px-4 lg:px-8"
      style={{ borderBottom: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card)' }}
    >
      <button onClick={onAbrirMenu} className="lg:hidden" aria-label="Abrir menu">
        <Menu size={20} strokeWidth={1.5} />
      </button>
      <div className="ml-auto flex items-center gap-4 text-sm">
        <span className="hidden texto-suave sm:inline">
          {quem}
          {usuario?.role === 'admin' && <span className="ml-2 text-xs" style={{ color: 'var(--accent)' }}>admin</span>}
        </span>
        <button onClick={sair} className="flex items-center gap-1.5 texto-suave hover:opacity-80" title="Sair">
          <LogOut size={18} strokeWidth={1.5} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  )
}
