import type { DiaSemana } from '../types'

const ORDEM: DiaSemana[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const CURTO: Record<DiaSemana, string> = {
  domingo: 'dom', segunda: 'seg', terca: 'ter', quarta: 'qua', quinta: 'qui', sexta: 'sex', sabado: 'sáb',
}

interface Horario {
  dia: DiaSemana
  aberto: boolean
  hora_inicio: string | null
  hora_fim: string | null
}

/**
 * "seg–sex, 08:00–18:00; sáb, 08:00–12:00" — o exemplo da especificação.
 * Dias seguidos com a mesma faixa viram um intervalo.
 *
 * Mesma regra de `horariosEmTexto` em supabase/functions/_shared/prompt.ts,
 * que é o que a secretária fala. Mudou uma, mude a outra.
 */
export function horariosEmTexto(linhas: Horario[]): string {
  const abertos = ORDEM
    .map((d) => linhas.find((l) => l.dia === d))
    .filter((l): l is Horario => !!l && l.aberto && !!l.hora_inicio && !!l.hora_fim)
  if (!abertos.length) return 'não configurado'

  const faixa = (l: Horario) => `${l.hora_inicio!.slice(0, 5)}–${l.hora_fim!.slice(0, 5)}`
  const grupos: { dias: DiaSemana[]; faixa: string }[] = []
  for (const l of abertos) {
    const ultimo = grupos[grupos.length - 1]
    const anterior = ultimo ? ORDEM.indexOf(ultimo.dias[ultimo.dias.length - 1]) : -2
    if (ultimo && ultimo.faixa === faixa(l) && ORDEM.indexOf(l.dia) === anterior + 1) ultimo.dias.push(l.dia)
    else grupos.push({ dias: [l.dia], faixa: faixa(l) })
  }
  return grupos
    .map((g) => {
      const dias = g.dias.length > 2
        ? `${CURTO[g.dias[0]]}–${CURTO[g.dias[g.dias.length - 1]]}`
        : g.dias.map((d) => CURTO[d]).join(', ')
      return `${dias}, ${g.faixa}`
    })
    .join('; ')
}

export interface LinhaHorario {
  id: string
  dia: DiaSemana
  aberto: boolean
  hora_inicio: string | null
  hora_fim: string | null
}

/** Abertos precisam de início e fim, e o fim depois do início. */
export function horariosValidos(linhas: LinhaHorario[]): boolean {
  return linhas.every((l) => !l.aberto || (l.hora_inicio && l.hora_fim && l.hora_inicio.slice(0, 5) < l.hora_fim.slice(0, 5)))
}
