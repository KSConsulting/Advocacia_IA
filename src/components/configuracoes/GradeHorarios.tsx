import type { DiaSemana } from '../../types'
import type { LinhaHorario } from '../../lib/horarios'
import { DIAS_SEMANA } from '../../lib/datas'

/**
 * Os 7 dias, cada um com toggle e horário independente. Usada pelo horário do
 * escritório e pela jornada de cada advogado — mesma forma, mesmas regras.
 */
export default function GradeHorarios({
  linhas, onChange, desabilitado,
}: {
  linhas: LinhaHorario[]
  onChange: (linhas: LinhaHorario[]) => void
  desabilitado?: boolean
}) {
  const muda = (dia: DiaSemana, campos: Partial<LinhaHorario>) =>
    onChange(linhas.map((l) => (l.dia === dia ? { ...l, ...campos } : l)))

  return (
    <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border-card)' }}>
      {DIAS_SEMANA.map(({ valor, longo }) => {
        const l = linhas.find((x) => x.dia === valor)
        if (!l) return null
        return (
          <div key={valor} className="flex flex-wrap items-center gap-3 py-2.5" style={{ borderColor: 'var(--border-card)' }}>
            <label className="flex w-44 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={l.aberto}
                disabled={desabilitado}
                onChange={(e) => muda(l.dia, {
                  aberto: e.target.checked,
                  hora_inicio: e.target.checked ? (l.hora_inicio ?? '09:00') : l.hora_inicio,
                  hora_fim: e.target.checked ? (l.hora_fim ?? '18:00') : l.hora_fim,
                })}
              />
              {longo}
            </label>
            {l.aberto ? (
              <div className="flex items-center gap-2 text-sm">
                <input type="time" className="campo w-32" value={l.hora_inicio?.slice(0, 5) ?? ''} disabled={desabilitado}
                  onChange={(e) => muda(l.dia, { hora_inicio: e.target.value })} />
                <span className="texto-suave">às</span>
                <input type="time" className="campo w-32" value={l.hora_fim?.slice(0, 5) ?? ''} disabled={desabilitado}
                  onChange={(e) => muda(l.dia, { hora_fim: e.target.value })} />
              </div>
            ) : (
              <span className="text-sm texto-suave">Fechado</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
