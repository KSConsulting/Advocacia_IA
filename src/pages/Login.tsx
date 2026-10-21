import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Scale } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useEscritorio } from '../contexts/EscritorioContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Login() {
  const { session } = useAuth()
  const { config } = useEscritorio()
  const local = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  if (session) {
    const de = (local.state as { de?: string } | null)?.de
    return <Navigate to={de && de !== '/login' ? de : '/dashboard'} replace />
  }

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setEntrando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEntrando(false)
    if (error) setErro('E-mail ou senha incorretos.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-base)' }}>
      <form onSubmit={entrar} className="card w-full max-w-sm p-8" style={{ borderRadius: 16 }}>
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {config?.logo_url
            ? <img src={config.logo_url} alt="" className="h-14 w-14 object-contain" />
            : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
                <Scale size={24} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
              </div>
            )}
          <h1 className="font-display text-2xl font-semibold">{config?.nome ?? 'Escritório de Advocacia'}</h1>
          <p className="text-sm texto-suave">Entre com o seu e-mail e senha.</p>
        </div>

        <div className="flex flex-col gap-4">
          <Input rotulo="E-mail" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input rotulo="Senha" name="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          {erro && <p className="text-sm" style={{ color: 'var(--danger)' }}>{erro}</p>}
          <Button type="submit" carregando={entrando} className="w-full">Entrar</Button>
        </div>
      </form>
    </div>
  )
}
