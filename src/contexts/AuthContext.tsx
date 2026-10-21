import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../types'

interface AuthContextType {
  session: Session | null
  usuario: Usuario | null
  carregando: boolean
  ehAdmin: boolean
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  usuario: null,
  carregando: true,
  ehAdmin: false,
  sair: async () => {},
})

/**
 * Desvio da especificação: ela pede "sem autenticação". O escritório decidiu
 * por login (dados de Direito de Família — LGPD). Ver CLAUDE.md.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s)
      if (!s) {
        setUsuario(null)
        setCarregando(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    supabase
      .from('usuarios')
      .select('id,email,nome,role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setUsuario(data as Usuario | null)
        setCarregando(false)
      })
  }, [userId])

  const sair = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, usuario, carregando, ehAdmin: usuario?.role === 'admin', sair }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
