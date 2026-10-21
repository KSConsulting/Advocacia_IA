import clsx from 'clsx'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface Rotulado {
  rotulo?: string
  ajuda?: string
}

export default function Input({ rotulo, ajuda, className, id, ...resto }: InputHTMLAttributes<HTMLInputElement> & Rotulado) {
  const campoId = id ?? resto.name
  return (
    <div className={className}>
      {rotulo && <label htmlFor={campoId} className="rotulo">{rotulo}</label>}
      <input id={campoId} {...resto} className="campo" />
      {ajuda && <p className="mt-1 text-xs texto-suave">{ajuda}</p>}
    </div>
  )
}

export function Textarea({ rotulo, ajuda, className, id, ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement> & Rotulado) {
  const campoId = id ?? resto.name
  return (
    <div className={className}>
      {rotulo && <label htmlFor={campoId} className="rotulo">{rotulo}</label>}
      <textarea id={campoId} {...resto} className={clsx('campo resize-y')} />
      {ajuda && <p className="mt-1 text-xs texto-suave">{ajuda}</p>}
    </div>
  )
}

export function Select({ rotulo, ajuda, className, id, children, ...resto }: SelectHTMLAttributes<HTMLSelectElement> & Rotulado) {
  const campoId = id ?? resto.name
  return (
    <div className={className}>
      {rotulo && <label htmlFor={campoId} className="rotulo">{rotulo}</label>}
      <select id={campoId} {...resto} className="campo">{children}</select>
      {ajuda && <p className="mt-1 text-xs texto-suave">{ajuda}</p>}
    </div>
  )
}
