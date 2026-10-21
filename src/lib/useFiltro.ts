import { useState } from 'react'
import type { DateFilter, FilterPreset } from '../types'
import { filtroDoPreset } from './datas'

export function useFiltro(inicial: FilterPreset = 'ultimos_7_dias') {
  return useState<DateFilter>(() => filtroDoPreset(inicial))
}
