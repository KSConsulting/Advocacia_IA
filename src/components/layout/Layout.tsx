import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Carregando } from '../ui/Card'
import Sidebar from './Sidebar'
import Header from './Header'

/** A casca de toda página logada. Sem sessão, manda para o login. */
export default function Layout() {
  const { session, carregando } = useAuth()
  const [menu, setMenu] = useState(false)
  const local = useLocation()

  if (carregando) return <Carregando />
  if (!session) return <Navigate to="/login" replace state={{ de: local.pathname }} />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar aberta={menu} onFechar={() => setMenu(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onAbrirMenu={() => setMenu(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
