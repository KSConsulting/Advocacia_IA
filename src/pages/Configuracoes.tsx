import { useState } from 'react'
import { Bot, Briefcase, Building2, Clock, Scale } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import SecaoEscritorio from '../components/configuracoes/SecaoEscritorio'
import SecaoHorario from '../components/configuracoes/SecaoHorario'
import SecaoAdvogados from '../components/configuracoes/SecaoAdvogados'
import SecaoServicos from '../components/configuracoes/SecaoServicos'
import SecaoSecretaria from '../components/configuracoes/SecaoSecretaria'

/**
 * As duas seções da especificação (Informações do Escritório e Horário de
 * Funcionamento), mais três que substituem o que estava fora do sistema:
 *   • Advogados       — a jornada de cada um (era a agenda do Google Calendar)
 *   • Serviços        — o catálogo (era a planilha do Google Sheets)
 *   • Secretária de IA — liga/desliga, modelo, WhatsApp (era o n8n)
 */
const ABAS = [
  { id: 'escritorio', nome: 'Escritório', Icone: Building2 },
  { id: 'horario', nome: 'Horário', Icone: Clock },
  { id: 'advogados', nome: 'Advogados', Icone: Scale },
  { id: 'servicos', nome: 'Serviços', Icone: Briefcase },
  { id: 'secretaria', nome: 'Secretária de IA', Icone: Bot },
] as const

type Aba = typeof ABAS[number]['id']

export default function Configuracoes() {
  const { ehAdmin } = useAuth()
  const [aba, setAba] = useState<Aba>('escritorio')

  return (
    <>
      <PageHeader
        titulo="Configurações"
        descricao="Personalize as informações do seu escritório — nome, logo, favicon e horário de funcionamento. O horário configurado aqui reflete automaticamente nos relatórios do dashboard."
      />

      {!ehAdmin && (
        <p className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'var(--accent-light)' }}>
          Somente o administrador altera as informações do escritório, o horário e a secretária de IA.
        </p>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: 'var(--border-card)' }}>
        {ABAS.map(({ id, nome, Icone }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className="flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm"
            style={{
              borderBottom: `2px solid ${aba === id ? 'var(--accent)' : 'transparent'}`,
              color: aba === id ? 'var(--text-main)' : 'var(--text-muted)',
            }}
          >
            <Icone size={16} strokeWidth={1.5} /> {nome}
          </button>
        ))}
      </div>

      {aba === 'escritorio' && <SecaoEscritorio />}
      {aba === 'horario' && <SecaoHorario />}
      {aba === 'advogados' && <SecaoAdvogados />}
      {aba === 'servicos' && <SecaoServicos />}
      {aba === 'secretaria' && <SecaoSecretaria />}
    </>
  )
}
