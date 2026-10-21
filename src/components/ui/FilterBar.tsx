import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { DateFilter, FilterPreset } from '../../types'
import { ROTULOS_FILTRO, filtroDoPreset, formatarData, hoje, paraTexto } from '../../lib/datas'
import Modal from './Modal'
import Button from './Button'

const PRESETS = Object.keys(ROTULOS_FILTRO) as Exclude<FilterPreset, 'personalizado'>[]

/**
 * Filtros de data: Dashboard, Leads, Clientes, Follow Up e Agendamentos.
 * Um filtro ativo por vez; o ativo usa `--accent` de fundo.
 */
export default function FilterBar({
  valor, onChange, permitirFuturo = false,
}: {
  valor: DateFilter
  onChange: (f: DateFilter) => void
  /** Agendamentos olha para a frente: lá, datas futuras fazem sentido. */
  permitirFuturo?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [inicio, setInicio] = useState(valor.startDate)
  const [fim, setFim] = useState(valor.endDate)
  const max = permitirFuturo ? undefined : paraTexto(hoje())

  const estilo = (ativo: boolean): React.CSSProperties => ativo
    ? { backgroundColor: 'var(--accent)', color: '#1C2B3A', borderColor: 'var(--accent)' }
    : { backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', borderColor: 'var(--border-card)' }

  const valido = inicio && fim && inicio <= fim && (!max || fim <= max)

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(filtroDoPreset(p))}
          className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
          style={estilo(valor.preset === p)}
        >
          {ROTULOS_FILTRO[p]}
        </button>
      ))}
      <button
        onClick={() => {
          setInicio(valor.startDate)
          setFim(valor.endDate)
          setAberto(true)
        }}
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
        style={estilo(valor.preset === 'personalizado')}
      >
        <CalendarDays size={16} strokeWidth={1.5} />
        {valor.preset === 'personalizado'
          ? `${formatarData(valor.startDate)} – ${formatarData(valor.endDate)}`
          : 'Personalizado'}
      </button>

      <Modal
        aberto={aberto}
        titulo="Período personalizado"
        onFechar={() => setAberto(false)}
        largura="max-w-md"
        rodape={
          <>
            <Button variante="fantasma" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button
              disabled={!valido}
              onClick={() => {
                onChange({ preset: 'personalizado', startDate: inicio, endDate: fim })
                setAberto(false)
              }}
            >
              Aplicar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rotulo" htmlFor="filtro-inicio">De</label>
            <input id="filtro-inicio" type="date" className="campo" value={inicio} max={max} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label className="rotulo" htmlFor="filtro-fim">Até</label>
            <input id="filtro-fim" type="date" className="campo" value={fim} max={max} min={inicio} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>
        {!permitirFuturo && <p className="mt-2 text-xs texto-suave">Datas futuras ficam bloqueadas.</p>}
      </Modal>
    </div>
  )
}
