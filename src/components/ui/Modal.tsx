import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Button from './Button'

interface Props {
  aberto: boolean
  titulo: string
  onFechar: () => void
  children: React.ReactNode
  rodape?: React.ReactNode
  largura?: string
}

/** No `body`, via portal: dentro do layout, um `overflow` de ancestral o cortaria. */
export default function Modal({ aberto, titulo, onFechar, children, rodape, largura = 'max-w-lg' }: Props) {
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto, onFechar])

  if (!aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`card w-full ${largura} max-h-[90vh] overflow-y-auto shadow-xl`}
        style={{ borderRadius: 16 }}
      >
        <header className="flex items-center justify-between gap-3 px-6 pt-5">
          <h2 className="text-xl font-semibold">{titulo}</h2>
          <button onClick={onFechar} className="texto-suave" aria-label="Fechar">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>
        <div className="px-6 py-4">{children}</div>
        {rodape && <footer className="flex justify-end gap-2 px-6 pb-5">{rodape}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/** Regra 10: confirmar antes de ações destrutivas ou que promovem lead a cliente. */
export function ModalConfirmacao({
  aberto, titulo = 'Confirmar', texto, onCancelar, onConfirmar, carregando, perigo,
}: {
  aberto: boolean
  titulo?: string
  texto: string
  onCancelar: () => void
  onConfirmar: () => void
  carregando?: boolean
  perigo?: boolean
}) {
  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      onFechar={onCancelar}
      rodape={
        <>
          <Button variante="fantasma" onClick={onCancelar}>Cancelar</Button>
          <Button variante={perigo ? 'perigo' : 'primario'} carregando={carregando} onClick={onConfirmar}>
            Confirmar
          </Button>
        </>
      }
    >
      <p className="text-sm">{texto}</p>
    </Modal>
  )
}
