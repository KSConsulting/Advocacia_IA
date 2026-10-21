import clsx from 'clsx'
import { Loader2, Inbox } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  titulo?: string
  descricao?: string
  acoes?: ReactNode
}

export default function Card({ titulo, descricao, acoes, children, className, ...resto }: Props) {
  return (
    <section {...resto} className={clsx('card', className)}>
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            {titulo && <h3 className="text-lg font-semibold">{titulo}</h3>}
            {descricao && <p className="mt-1 text-sm texto-suave">{descricao}</p>}
          </div>
          {acoes}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

/** Regra 4: todo carregamento com spinner ou skeleton. */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm texto-suave">
      <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
      {texto}
    </div>
  )
}

/** Regra 9: sem dados, ícone + mensagem amigável. */
export function Vazio({ icone, texto }: { icone?: ReactNode; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm texto-suave">
      {icone ?? <Inbox size={28} strokeWidth={1.25} />}
      <p>{texto}</p>
    </div>
  )
}
