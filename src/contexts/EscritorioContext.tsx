import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { OfficeConfig } from '../types'

interface EscritorioContextType {
  config: OfficeConfig | null
  recarregar: () => Promise<void>
}

const EscritorioContext = createContext<EscritorioContextType>({ config: null, recarregar: async () => {} })

/**
 * `office_config` para a UI inteira: "Nome e logo refletem em toda a UI
 * automaticamente" (especificação). Configurações chama `recarregar()` ao salvar,
 * e a barra lateral, o título da aba e o favicon mudam na hora.
 */
export function EscritorioProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<OfficeConfig | null>(null)

  const recarregar = useCallback(async () => {
    const { data } = await supabase.from('office_config').select('*').eq('id', 1).maybeSingle()
    setConfig(data as OfficeConfig | null)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recarregar()
  }, [recarregar])

  useEffect(() => {
    if (!config) return
    document.title = config.nome
    if (config.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.removeAttribute('type')
      link.href = config.favicon_url
    }
  }, [config])

  return <EscritorioContext.Provider value={{ config, recarregar }}>{children}</EscritorioContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useEscritorio = () => useContext(EscritorioContext)
