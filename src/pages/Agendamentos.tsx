import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatarDataHora, intervalo } from '../lib/datas'
import { useFiltro } from '../lib/useFiltro'
import { ORDEM_AGENDAMENTO, STATUS_AGENDAMENTO } from '../lib/status'
import { formatarWhatsapp, nomeOuNumero } from '../lib/telefone'
import { useToast } from '../contexts/ToastContext'
import type { AgendamentoAdv, AgendamentoStatus } from '../types'
import PageHeader from '../components/ui/PageHeader'
import FilterBar from '../components/ui/FilterBar'
import Card, { Carregando, Vazio } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { ModalConfirmacao } from '../components/ui/Modal'
import NovoAgendamentoModal from '../components/NovoAgendamentoModal'

export default function Agendamentos() {
  const toast = useToast()
  const navegar = useNavigate()
  const [filtro, setFiltro] = useFiltro('este_mes')
  const [lista, setLista] = useState<AgendamentoAdv[]>([])
  const [carregando, setCarregando] = useState(true)
  const [pendente, setPendente] = useState<AgendamentoAdv | null>(null)
  const [novo, setNovo] = useState(false)

  const carregar = useCallback(async () => {
    const { inicio, fim } = intervalo(filtro)
    const { data } = await supabase
      .from('agendamentos_adv')
      .select('*, lead:leads_adv(*), advogado:advogados(id,nome,cor)')
      .gte('data_hora_inicio', inicio)
      .lt('data_hora_inicio', fim)
      .order('data_hora_inicio', { ascending: true })
      .limit(1000)
    setLista((data ?? []) as AgendamentoAdv[])
    setCarregando(false)
  }, [filtro])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true)
    carregar()
  }, [carregar])

  const atualizar = async (ag: AgendamentoAdv, status: AgendamentoStatus) => {
    const { error } = await supabase.from('agendamentos_adv').update({ status }).eq('id', ag.id)
    if (error) {
      toast.erro(error.message?.includes('fora_da_jornada')
        ? 'Não dá para reativar: o horário está fora da jornada do advogado.'
        : error.code === '23P01'
        ? 'Não dá para reativar: o horário já foi ocupado.'
        : 'Não foi possível atualizar o status.')
      return
    }
    toast.sucesso(status === 'compareceu' ? 'Comparecimento registrado. Lead promovido a cliente.' : `Status: ${STATUS_AGENDAMENTO[status].nome}.`)
    carregar()
  }

  return (
    <>
      <PageHeader
        titulo="Agendamentos"
        descricao="Gerencie todas as consultas marcadas no escritório. Atualize o status de cada agendamento diretamente por aqui — ao confirmar o comparecimento, o lead é promovido a cliente automaticamente."
        acoes={<Button icone={<Plus size={16} strokeWidth={1.5} />} onClick={() => setNovo(true)}>Novo agendamento</Button>}
      />
      <FilterBar valor={filtro} onChange={setFiltro} permitirFuturo />

      <Card className="overflow-hidden [&>div]:p-0">
        {carregando ? <Carregando /> : lista.length === 0 ? (
          <Vazio icone={<CalendarDays size={28} strokeWidth={1.25} />} texto="Nenhum agendamento no período selecionado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>WhatsApp</th><th>Data do Agendamento</th><th>Motivo do Contato</th><th>Status</th></tr>
              </thead>
              <tbody>
                {lista.map((ag) => (
                  <tr key={ag.id}>
                    <td className="cursor-pointer whitespace-nowrap hover:underline" onClick={() => navegar(`/leads/${ag.lead_id}`)}>
                      {ag.lead ? nomeOuNumero(ag.lead.nome_lead, ag.lead.whatsapp_lead) : '—'}
                    </td>
                    <td className="whitespace-nowrap">{formatarWhatsapp(ag.lead?.whatsapp_lead)}</td>
                    <td className="whitespace-nowrap">
                      {formatarDataHora(ag.data_hora_inicio)}
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs texto-suave">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ag.advogado?.cor }} />
                        {ag.advogado?.nome} · {ag.modalidade}
                      </div>
                    </td>
                    <td className="max-w-[240px] truncate">{ag.servico || ag.lead?.motivo_contato || '—'}</td>
                    <td>
                      {/* Ação rápida de status, com as cores do badge. */}
                      <select
                        value={ag.status}
                        onChange={(e) => {
                          const s = e.target.value as AgendamentoStatus
                          if (s === 'compareceu') setPendente(ag)
                          else atualizar(ag, s)
                        }}
                        className="rounded-full border px-2.5 py-0.5 text-xs font-medium outline-none"
                        style={{
                          backgroundColor: STATUS_AGENDAMENTO[ag.status].bg,
                          color: STATUS_AGENDAMENTO[ag.status].texto,
                          borderColor: STATUS_AGENDAMENTO[ag.status].borda,
                        }}
                      >
                        {ORDEM_AGENDAMENTO.map((s) => <option key={s} value={s}>{STATUS_AGENDAMENTO[s].nome}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModalConfirmacao
        aberto={!!pendente}
        titulo="Confirmar comparecimento"
        texto="Ao confirmar, este lead será promovido a cliente automaticamente."
        onCancelar={() => setPendente(null)}
        onConfirmar={async () => {
          await atualizar(pendente!, 'compareceu')
          setPendente(null)
        }}
      />

      <NovoAgendamentoModal aberto={novo} onFechar={() => setNovo(false)} onSalvo={carregar} />
    </>
  )
}
