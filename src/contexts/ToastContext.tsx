import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

type Tipo = 'sucesso' | 'erro'

interface Toast {
  id: number
  tipo: Tipo
  texto: string
}

interface ToastContextType {
  sucesso: (texto: string) => void
  erro: (texto: string) => void
}

const ToastContext = createContext<ToastContextType>({ sucesso: () => {}, erro: () => {} })

/** Regra 5 da especificação: toda ação com toast de sucesso ou erro. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remover = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const mostrar = useCallback((tipo: Tipo, texto: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, tipo, texto }])
    setTimeout(() => remover(id), tipo === 'erro' ? 6000 : 3500)
  }, [remover])

  const sucesso = useCallback((t: string) => mostrar('sucesso', t), [mostrar])
  const erro = useCallback((t: string) => mostrar('erro', t), [mostrar])

  return (
    <ToastContext.Provider value={{ sucesso, erro }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="card shadow-lg flex items-start gap-3 px-4 py-3 text-sm"
            style={{ borderLeft: `3px solid ${t.tipo === 'sucesso' ? 'var(--success)' : 'var(--danger)'}` }}
          >
            {t.tipo === 'sucesso'
              ? <CheckCircle2 size={18} strokeWidth={1.5} style={{ color: 'var(--success)' }} className="shrink-0" />
              : <XCircle size={18} strokeWidth={1.5} style={{ color: 'var(--danger)' }} className="shrink-0" />}
            <span className="flex-1">{t.texto}</span>
            <button onClick={() => remover(t.id)} className="texto-suave" aria-label="Fechar">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
