import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  carregando?: boolean
  icone?: ReactNode
}

const ESTILOS: Record<Variante, React.CSSProperties> = {
  primario: { backgroundColor: 'var(--primary)', color: 'var(--primary-text)', borderColor: 'var(--primary)' },
  secundario: { backgroundColor: 'transparent', color: 'var(--text-main)', borderColor: 'var(--accent)' },
  fantasma: { backgroundColor: 'transparent', color: 'var(--text-main)', borderColor: 'var(--border-card)' },
  perigo: { backgroundColor: 'var(--danger)', color: '#FFFFFF', borderColor: 'var(--danger)' },
}

export default function Button({
  variante = 'primario', carregando, icone, children, className, disabled, style, ...resto
}: Props) {
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      style={{ ...ESTILOS[variante], ...style }}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium',
        'transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {carregando ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : icone}
      {children}
    </button>
  )
}
