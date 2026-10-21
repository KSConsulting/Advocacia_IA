import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { EscritorioProvider } from './contexts/EscritorioContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Kanban from './pages/Kanban'
import Leads from './pages/Leads'
import LeadDetalhe from './pages/LeadDetalhe'
import Clientes from './pages/Clientes'
import ClienteDetalhe from './pages/ClienteDetalhe'
import FollowUp from './pages/FollowUp'
import Agendamentos from './pages/Agendamentos'
import Agenda from './pages/Agenda'
import Conversas from './pages/Conversas'
import Configuracoes from './pages/Configuracoes'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <EscritorioProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<Login />} />
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/kanban" element={<Kanban />} />
                  <Route path="/conversas" element={<Conversas />} />
                  <Route path="/conversas/:id" element={<Conversas />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/leads/:id" element={<LeadDetalhe />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                  <Route path="/follow-up" element={<FollowUp />} />
                  <Route path="/agenda" element={<Agenda />} />
                  <Route path="/agendamentos" element={<Agendamentos />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </EscritorioProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
