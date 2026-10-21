import type { DateFilter, FilterPreset } from '../types'

/**
 * Todas as datas do sistema em America/Sao_Paulo — regra 6 da especificação.
 *
 * O navegador pode estar em outro fuso (advogado viajando, servidor de teste).
 * Por isso nada aqui usa `getHours()` / `getDate()`: tudo passa pelo `Intl`
 * com o fuso explícito.
 */
export const FUSO = 'America/Sao_Paulo'

export interface DiaCivil {
  ano: number
  mes: number // 1–12
  dia: number
}

/** Os pedaços de um instante, como um relógio de São Paulo mostraria. */
export function partesNoFuso(instante: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: FUSO, hour12: false, weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(instante).map((x) => [x.type, x.value]),
  )
  const dows: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    ano: +p.year, mes: +p.month, dia: +p.day,
    hora: +p.hour % 24, minuto: +p.minute, dow: dows[p.weekday],
  }
}

/** Quantos minutos o fuso está à frente do UTC naquele instante. */
function offsetMin(instante: Date): number {
  const p = partesNoFuso(instante)
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto)
  return Math.round((comoUtc - Math.floor(instante.getTime() / 60000) * 60000) / 60000)
}

/** O instante de "dia D, HH:MM em São Paulo". */
export function instante(d: DiaCivil, hora = 0, minuto = 0): Date {
  const provisorio = new Date(Date.UTC(d.ano, d.mes - 1, d.dia, hora, minuto))
  return new Date(provisorio.getTime() - offsetMin(provisorio) * 60000)
}

export function hoje(): DiaCivil {
  const p = partesNoFuso(new Date())
  return { ano: p.ano, mes: p.mes, dia: p.dia }
}

export function somarDias(d: DiaCivil, n: number): DiaCivil {
  const t = new Date(Date.UTC(d.ano, d.mes - 1, d.dia + n))
  return { ano: t.getUTCFullYear(), mes: t.getUTCMonth() + 1, dia: t.getUTCDate() }
}

export function diaDaSemana(d: DiaCivil): number {
  return new Date(Date.UTC(d.ano, d.mes - 1, d.dia)).getUTCDay()
}

/** `2026-10-20` ↔ DiaCivil */
export function paraTexto(d: DiaCivil): string {
  return `${d.ano}-${String(d.mes).padStart(2, '0')}-${String(d.dia).padStart(2, '0')}`
}
export function deTexto(s: string): DiaCivil {
  const [ano, mes, dia] = s.split('-').map(Number)
  return { ano, mes, dia }
}

export function diaDe(iso: string): DiaCivil {
  const p = partesNoFuso(new Date(iso))
  return { ano: p.ano, mes: p.mes, dia: p.dia }
}

export function mesmoDia(a: DiaCivil, b: DiaCivil): boolean {
  return a.ano === b.ano && a.mes === b.mes && a.dia === b.dia
}

// ─── Filtro de período (FilterBar) ────────────────────────────────────────────

export const ROTULOS_FILTRO: Record<Exclude<FilterPreset, 'personalizado'>, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  ultimos_7_dias: 'Últimos 7 dias',
  ultimos_14_dias: 'Últimos 14 dias',
  este_mes: 'Este mês',
  mes_passado: 'Mês passado',
  este_ano: 'Este ano',
}

/** Datas civis (início e fim, inclusive) de um atalho. */
export function datasDoPreset(preset: FilterPreset): { inicio: DiaCivil; fim: DiaCivil } {
  const h = hoje()
  switch (preset) {
    case 'ontem': {
      const o = somarDias(h, -1)
      return { inicio: o, fim: o }
    }
    case 'ultimos_7_dias':
      return { inicio: somarDias(h, -6), fim: h }
    case 'ultimos_14_dias':
      return { inicio: somarDias(h, -13), fim: h }
    case 'este_mes':
      return { inicio: { ...h, dia: 1 }, fim: h }
    case 'mes_passado': {
      const primeiro = { ano: h.mes === 1 ? h.ano - 1 : h.ano, mes: h.mes === 1 ? 12 : h.mes - 1, dia: 1 }
      return { inicio: primeiro, fim: somarDias({ ...h, dia: 1 }, -1) }
    }
    case 'este_ano':
      return { inicio: { ano: h.ano, mes: 1, dia: 1 }, fim: h }
    default:
      return { inicio: h, fim: h }
  }
}

export function filtroDoPreset(preset: FilterPreset): DateFilter {
  const { inicio, fim } = datasDoPreset(preset)
  return { preset, startDate: paraTexto(inicio), endDate: paraTexto(fim) }
}

/**
 * O filtro como dois instantes: `[início do 1º dia, início do dia seguinte ao
 * último)`. Fim EXCLUSIVO: comparar com `<= 23:59:59` perde o que chega no
 * último segundo, e `<` no dia seguinte não perde nada.
 */
export function intervalo(f: DateFilter): { inicio: string; fim: string } {
  return {
    inicio: instante(deTexto(f.startDate)).toISOString(),
    fim: instante(somarDias(deTexto(f.endDate), 1)).toISOString(),
  }
}

// ─── Formatação — regra 7: DD/MM/YYYY HH:mm ───────────────────────────────────

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
})
const fmtData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric',
})
const fmtHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false,
})

export function formatarDataHora(iso: string | null | undefined): string {
  return iso ? fmtDataHora.format(new Date(iso)).replace(',', '') : '—'
}
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  // `date` puro (2026-10-20) é dia civil, não instante: formatar via Date o
  // jogaria para o dia anterior às 21h de São Paulo.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const d = deTexto(iso)
    return `${String(d.dia).padStart(2, '0')}/${String(d.mes).padStart(2, '0')}/${d.ano}`
  }
  return fmtData.format(new Date(iso))
}
export function formatarHora(iso: string): string {
  return fmtHora.format(new Date(iso))
}
export function formatarDiaCivil(d: DiaCivil): string {
  return `${String(d.dia).padStart(2, '0')}/${String(d.mes).padStart(2, '0')}/${d.ano}`
}

/** "há 5 min", "há 3 h", "há 2 dias" */
export function tempoDesde(iso: string | null | undefined): string {
  if (!iso) return '—'
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

export const DIAS_SEMANA: { valor: string; curto: string; longo: string }[] = [
  { valor: 'domingo', curto: 'Dom', longo: 'Domingo' },
  { valor: 'segunda', curto: 'Seg', longo: 'Segunda-feira' },
  { valor: 'terca', curto: 'Ter', longo: 'Terça-feira' },
  { valor: 'quarta', curto: 'Qua', longo: 'Quarta-feira' },
  { valor: 'quinta', curto: 'Qui', longo: 'Quinta-feira' },
  { valor: 'sexta', curto: 'Sex', longo: 'Sexta-feira' },
  { valor: 'sabado', curto: 'Sáb', longo: 'Sábado' },
]
