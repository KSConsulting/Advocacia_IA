import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, MessageCircle, Trash2 } from 'lucide-react'
import { supabase, chamarFuncao } from '../lib/supabase'
import { ORDEM_LEAD, STATUS_LEAD } from '../lib/status'
import { formatarData, formatarDataHora } from '../lib/datas'
import { formatarWhatsapp, nomeOuNumero } from '../lib/telefone'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import type { AgendamentoAdv, LeadAdv, LeadStatus } from '../types'
import Card, { Carregando, Vazio } from './ui/Card'
import Button from './ui/Button'
import { BadgeAgendamento, BadgeLead } from './ui/Badge'
import { Textarea } from './ui/Input'
import Modal, { ModalConfirmacao } from './ui/Modal'
import NovoAgendamentoModal from './NovoAgendamentoModal'

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs texto-suave">{rotulo}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}

/**
 * A página individual do lead — e do cliente, que segundo a especificação tem
 * "a mesma estrutura, com os mesmos campos e layout". O `:id` das duas rotas é
 * o id do lead (o cliente é o lead promovido).
 */
export default function FichaPessoa({ id, voltarPara }: { id: string; voltarPara: string }) {
  const toast = useToast()
  const navegar = useNavigate()
  const { ehAdmin } = useAuth()
  const [lead, setLead] = useState<LeadAdv | null>(null)
  const [clienteDesde, setClienteDesde] = useState<string | null>(null)
  const [consultas, setConsultas] = useState<AgendamentoAdv[]>([])
  const [carregando, setCarregando] = useState(true)
  const [anotacoes, setAnotacoes] = useState('')
  const [salvandoNotas, setSalvandoNotas] = useState(false)
  const [statusPendente, setStatusPendente] = useState<LeadStatus | null>(null)
  const [agendar, setAgendar] = useState(false)
  const [apagar, setApagar] = useState(false)
  const [apagando, setApagando] = useState(false)

  const carregar = useCallback(async () => {
    const [l, c, a] = await Promise.all([
      supabase.from('leads_adv').select('*').eq('id', id).maybeSingle(),
      supabase.from('clientes_adv').select('data_primeira_visita').eq('lead_id', id).maybeSingle(),
      supabase
        .from('agendamentos_adv')
        .select('*, advogado:advogados(id,nome,cor)')
        .eq('lead_id', id)
        .order('data_hora_inicio', { ascending: false }),
    ])
    setLead(l.data as LeadAdv | null)
    setAnotacoes((l.data as LeadAdv | null)?.anotacoes ?? '')
    setClienteDesde((c.data as { data_primeira_visita: string } | null)?.data_primeira_visita ?? null)
    setConsultas((a.data ?? []) as AgendamentoAdv[])
    setCarregando(false)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  const trocarStatus = async (para: LeadStatus) => {
    const { error } = await supabase.from('leads_adv').update({ status: para }).eq('id', id)
    if (error) return toast.erro('Não foi possível alterar o status.')
    toast.sucesso(`Status alterado para ${STATUS_LEAD[para].nome}.`)
    carregar()
  }

  const salvarNotas = async () => {
    setSalvandoNotas(true)
    const { error } = await supabase.from('leads_adv').update({ anotacoes }).eq('id', id)
    setSalvandoNotas(false)
    if (error) toast.erro('Não foi possível salvar as anotações.')
    else toast.sucesso('Anotações salvas.')
  }

  const pausar = async (pausado: boolean) => {
    const { error } = await supabase.from('leads_adv').update({ agente_pausado: pausado }).eq('id', id)
    if (error) return toast.erro('Não foi possível alterar.')
    toast.sucesso(pausado ? 'A secretária de IA não responde mais a este contato.' : 'A secretária de IA voltou a atender este contato.')
    carregar()
  }

  if (carregando) return <Carregando />
  if (!lead) return <Vazio texto="Contato não encontrado." />

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button onClick={() => navegar(voltarPara)} className="texto-suave hover:opacity-80" aria-label="Voltar">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <h1 className="font-display text-[28px] font-semibold">{nomeOuNumero(lead.nome_lead, lead.whatsapp_lead)}</h1>
        <BadgeLead status={lead.status} />
        {clienteDesde && (
          <span className="text-xs" style={{ color: 'var(--accent)' }}>Cliente desde {formatarData(clienteDesde)}</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Link to={`/conversas/${lead.id}`}>
            <Button variante="fantasma" icone={<MessageCircle size={16} strokeWidth={1.5} />}>Conversa</Button>
          </Link>
          <Button variante="secundario" icone={<CalendarPlus size={16} strokeWidth={1.5} />} onClick={() => setAgendar(true)}>
            Agendar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card titulo="Informações">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo rotulo="Nome">{lead.nome_lead || <span className="texto-suave">Ainda não informado</span>}</Campo>
              <Campo rotulo="WhatsApp">{formatarWhatsapp(lead.whatsapp_lead)}</Campo>
              <Campo rotulo="Motivo do contato">{lead.motivo_contato || '—'}</Campo>
              <Campo rotulo="Status">
                <select
                  className="campo mt-1 max-w-[220px]"
                  value={lead.status}
                  onChange={(e) => {
                    const para = e.target.value as LeadStatus
                    if (para === 'compareceu') setStatusPendente(para)
                    else trocarStatus(para)
                  }}
                >
                  {ORDEM_LEAD.map((s) => <option key={s} value={s}>{STATUS_LEAD[s].nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Início do atendimento">{formatarDataHora(lead.inicio_atendimento)}</Campo>
              <Campo rotulo="Última mensagem">{formatarDataHora(lead.ultima_mensagem)}</Campo>
              <Campo rotulo="Follow up 1">{formatarDataHora(lead.follow_up_1)}</Campo>
              <Campo rotulo="Follow up 2">{formatarDataHora(lead.follow_up_2)}</Campo>
              <Campo rotulo="Follow up 3">{formatarDataHora(lead.follow_up_3)}</Campo>
              <Campo rotulo="Data do agendamento">{formatarDataHora(lead.data_agendamento)}</Campo>
            </dl>
          </Card>

          <Card titulo="Resumo da conversa" descricao="Escrito pela secretária de IA a cada novidade no atendimento.">
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {lead.resumo_conversa || <span className="texto-suave">Ainda sem resumo.</span>}
            </p>
          </Card>

          <Card titulo="Consultas" className="[&>div]:p-0 [&>div]:pt-3">
            {consultas.length === 0 ? <Vazio texto="Nenhuma consulta registrada." /> : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead><tr><th>Data</th><th>Advogado</th><th>Serviço</th><th>Modalidade</th><th>Status</th></tr></thead>
                  <tbody>
                    {consultas.map((c) => (
                      <tr key={c.id}>
                        <td className="whitespace-nowrap">{formatarDataHora(c.data_hora_inicio)}</td>
                        <td className="whitespace-nowrap">
                          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.advogado?.cor }} />
                          {c.advogado?.nome}
                        </td>
                        <td>{c.servico || '—'}</td>
                        <td className="capitalize">{c.modalidade}</td>
                        <td><BadgeAgendamento status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card titulo="Anotações">
            <Textarea rows={10} value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} placeholder="Anotações da equipe sobre este contato." />
            <Button className="mt-3 w-full" carregando={salvandoNotas} onClick={salvarNotas} disabled={anotacoes === (lead.anotacoes ?? '')}>
              Salvar anotações
            </Button>
          </Card>

          <Card titulo="Secretária de IA">
            <p className="text-sm texto-suave">
              {lead.agente_pausado
                ? 'A equipe assumiu este contato. A secretária de IA não responde nem envia follow up.'
                : 'A secretária de IA responde a este contato pelo WhatsApp.'}
            </p>
            <Button variante="fantasma" className="mt-3 w-full" onClick={() => pausar(!lead.agente_pausado)}>
              {lead.agente_pausado ? 'Devolver à secretária' : 'Assumir este contato'}
            </Button>
          </Card>

          {ehAdmin && (
            <Card titulo="Dados pessoais (LGPD)">
              <p className="text-sm texto-suave">
                Apaga definitivamente a ficha, a conversa, os arquivos recebidos e as consultas desta pessoa.
                Use quando ela pedir a exclusão dos dados.
              </p>
              <Button variante="perigo" className="mt-3 w-full" icone={<Trash2 size={16} strokeWidth={1.5} />} onClick={() => setApagar(true)}>
                Apagar todos os dados
              </Button>
            </Card>
          )}
        </div>
      </div>

      <ModalConfirmacao
        aberto={!!statusPendente}
        titulo="Promover a cliente"
        texto="Ao confirmar, este lead será promovido a cliente. Essa ação pode ser revertida alterando o status novamente."
        onCancelar={() => setStatusPendente(null)}
        onConfirmar={async () => {
          await trocarStatus(statusPendente!)
          setStatusPendente(null)
        }}
      />

      <Modal
        aberto={apagar}
        titulo="Apagar todos os dados"
        onFechar={() => setApagar(false)}
        rodape={
          <>
            <Button variante="fantasma" onClick={() => setApagar(false)}>Cancelar</Button>
            <Button
              variante="perigo"
              carregando={apagando}
              onClick={async () => {
                setApagando(true)
                const r = await chamarFuncao('/apagar-pessoa', { metodo: 'POST', corpo: { lead_id: lead.id } })
                setApagando(false)
                if (!r.ok) return toast.erro('Não foi possível apagar os dados.')
                toast.sucesso('Dados apagados.')
                navegar(voltarPara)
              }}
            >
              Apagar definitivamente
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Isto não tem volta. Serão apagados a ficha de <strong>{nomeOuNumero(lead.nome_lead, lead.whatsapp_lead)}</strong>,
          toda a conversa do WhatsApp, os áudios e imagens recebidos e {consultas.length} consulta(s).
        </p>
      </Modal>

      <NovoAgendamentoModal
        aberto={agendar}
        onFechar={() => setAgendar(false)}
        onSalvo={carregar}
        leadFixo={lead}
      />

    </>
  )
}
