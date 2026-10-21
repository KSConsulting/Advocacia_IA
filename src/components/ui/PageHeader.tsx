import type { ReactNode } from 'react'

/** Toda página começa por aqui: título em Playfair 28px, descrição em DM Sans 14px. */
export default function PageHeader({ titulo, descricao, acoes }: { titulo: string; descricao: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="font-display text-[28px] font-semibold leading-tight">{titulo}</h1>
        <p className="mt-1 text-sm texto-suave">{descricao}</p>
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}
