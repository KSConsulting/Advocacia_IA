import { useEffect, useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { deTexto, formatarHora, hoje, instante, paraTexto } from '../lib/datas'
import { formatarWhatsapp, nomeOuNumero, normalizarWhatsapp } from '../lib/telefone'
import { useToast } from '../contexts/ToastContext'
import { useEscritorio } from '../contexts/EscritorioContext'
import type { Advogado, LeadAdv, Modalidade, ServicoAdv } from '../types'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Input, { Select, Textarea } from './ui/Input'

interface Props {
  aberto: boolean
  onFechar: () => void
  onSalvo: () => void
  /** Vindo da ficha: a pessoa já está escolhida. */
  leadFixo?: LeadAdv
  /** Vindo da Agenda: clicou num horário vazio. */
  inicial?: { data?: string; hora?: string; advogadoId?: string }
}

/** Erro do banco → frase para a equipe. As travas são as mesmas da secretária de IA. */
function traduzirErro(e: { code?: string; message?: string }): string {
  if (e.code === '23P01') return 'Este advogado já tem consulta nesse horário.'
  if (e.message?.includes('fora_da_jornada')) return 'O horário está fora da jornada de atendimento deste advogado.'
  return 'Não foi possível agendar.'
}

export default function NovoAgendamentoModal({ aberto, onFechar, onSalvo, leadFixo, inicial }: Props) {
  const toast = useToast()
  const { config } = useEscritorio()
  const [advogados, setAdvogados] = useState<Advogado[]>([])
  const [servicos, setServicos] = useState<ServicoAdv[]>([])

  const [pessoa, setPessoa] = useState<LeadAdv | null>(leadFixo ?? null)
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<LeadAdv[]>([])
  const [novo, setNovo] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoWhats, setNovoWhats] = useState('')

  const [advogadoId, setAdvogadoId] = useState('')
  const [data, setData] = useState(paraTexto(hoje()))
  const [hora, setHora] = useState('')
  const [livres, setLivres] = useState<string[]>([])
  const [buscandoLivres, setBuscandoLivres] = useState(false)
  const [modalidade, setModalidade] = useState<Modalidade>('presencial')
  const [servico, setServico] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Reabrir o modal começa do zero, já com o que veio de fora.
  useEffect(() => {
    if (!aberto) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setPessoa(leadFixo ?? null)
    setBusca('')
    setAchados([])
    setNovo(false)
    setNovoNome('')
    setNovoWhats('')
    setData(inicial?.data ?? paraTexto(hoje()))
    setHora(inicial?.hora ?? '')
    setAdvogadoId(inicial?.advogadoId ?? '')
    setModalidade('presencial')
    setServico(leadFixo?.motivo_contato ?? '')
    setObservacoes('')
    /* eslint-enable react-hooks/set-state-in-effect */
    Promise.all([
      supabase.from('advogados').select('*').eq('ativo', true).order('nome'),
      supabase.from('servicos_adv').select('*').eq('ativo', true).order('ordem'),
    ]).then(([a, s]) => {
      const lista = (a.data ?? []) as Advogado[]
      setAdvogados(lista)
      setServicos((s.data ?? []) as ServicoAdv[])
      if (!inicial?.advogadoId && lista.length === 1) setAdvogadoId(lista[0].id)
    })
  }, [aberto, leadFixo, inicial])

  // Busca de pessoa por nome ou WhatsApp.
  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAchados([])
      return
    }
    const t = setTimeout(async () => {
      const digitos = termo.replace(/\D/g, '')
      const filtro = digitos.length >= 4
        ? `whatsapp_lead.ilike.%${digitos}%`
        : `nome_lead.ilike.%${termo.replace(/[%,()]/g, '')}%`
      const { data } = await supabase.from('leads_adv').select('*').or(filtro).limit(8)
      setAchados((data ?? []) as LeadAdv[])
    }, 250)
    return () => clearTimeout(t)
  }, [busca])

  // Horários livres: a mesma função que a secretária de IA consulta.
  useEffect(() => {
    if (!aberto || !advogadoId || !data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLivres([])
      return
    }
    let vivo = true
    setBuscandoLivres(true)
    supabase
      .rpc('agenda_horarios_disponiveis', { p_data: data, p_advogado: advogadoId })
      .then(({ data: linhas }) => {
        if (!vivo) return
        const horas = ((linhas ?? []) as { horario: string }[]).map((l) => formatarHora(l.horario))
        setLivres(horas)
        setBuscandoLivres(false)
        setHora((h) => (horas.includes(h) ? h : ''))
      })
    return () => { vivo = false }
  }, [aberto, advogadoId, data])

  const advogado = advogados.find((a) => a.id === advogadoId)
  const pronto = (pessoa || (novo && novoNome.trim() && normalizarWhatsapp(novoWhats).length >= 12)) && advogadoId && data && hora

  const salvar = async () => {
    if (!pronto) return
    setSalvando(true)
    try {
      let leadId = pessoa?.id
      if (!leadId) {
        const whatsapp = normalizarWhatsapp(novoWhats)
        const criado = await supabase
          .from('leads_adv')
          .insert({ nome_lead: novoNome.trim(), whatsapp_lead: whatsapp })
          .select('id')
          .single()
        if (criado.error?.code === '23505') {
          // Já existe alguém com este WhatsApp: agenda para ele.
          const existente = await supabase.from('leads_adv').select('id').eq('whatsapp_lead', whatsapp).single()
          leadId = existente.data?.id
        } else if (criado.error) {
          throw criado.error
        } else {
          leadId = criado.data.id
        }
      }

      const [h, m] = hora.split(':').map(Number)
      const inicio = instante(deTexto(data), h, m)
      const duracao = config?.duracao_consulta_min ?? 60
      const fim = new Date(inicio.getTime() + duracao * 60000)
      const link = modalidade === 'online' ? (advogado?.link_sala || config?.link_reuniao_padrao || null) : null

      const { error } = await supabase.from('agendamentos_adv').insert({
        advogado_id: advogadoId,
        lead_id: leadId,
        data_hora_inicio: inicio.toISOString(),
        data_hora_fim: fim.toISOString(),
        modalidade,
        servico: servico || null,
        link_reuniao: link,
        observacoes: observacoes.trim() || null,
        origem: 'sistema',
      })
      if (error) throw error

      toast.sucesso('Consulta agendada.')
      onSalvo()
      onFechar()
    } catch (e) {
      toast.erro(traduzirErro(e as { code?: string; message?: string }))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Novo agendamento"
      onFechar={onFechar}
      largura="max-w-xl"
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!pronto} carregando={salvando} onClick={salvar}>Agendar</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Quem */}
        <div>
          <span className="rotulo">Pessoa</span>
          {pessoa ? (
            <div className="campo flex items-center justify-between">
              <span>{nomeOuNumero(pessoa.nome_lead, pessoa.whatsapp_lead)} <span className="texto-suave">· {formatarWhatsapp(pessoa.whatsapp_lead)}</span></span>
              {!leadFixo && <button className="text-xs" style={{ color: 'var(--accent)' }} onClick={() => setPessoa(null)}>trocar</button>}
            </div>
          ) : novo ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input placeholder="Nome completo" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
              <Input placeholder="WhatsApp com DDD" value={novoWhats} onChange={(e) => setNovoWhats(e.target.value)} />
              <button className="text-left text-xs sm:col-span-2" style={{ color: 'var(--accent)' }} onClick={() => setNovo(false)}>
                Buscar um contato existente
              </button>
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 texto-suave" />
                <input className="campo pl-9" placeholder="Buscar por nome ou WhatsApp" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              {achados.length > 0 && (
                <ul className="card mt-1 max-h-48 overflow-y-auto">
                  {achados.map((l) => (
                    <li key={l.id}>
                      <button className="w-full px-3 py-2 text-left text-sm hover:opacity-80" onClick={() => setPessoa(l)}>
                        {nomeOuNumero(l.nome_lead, l.whatsapp_lead)} <span className="texto-suave">· {formatarWhatsapp(l.whatsapp_lead)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }} onClick={() => setNovo(true)}>
                <UserPlus size={14} strokeWidth={1.5} /> Cadastrar novo contato
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select rotulo="Advogado" value={advogadoId} onChange={(e) => setAdvogadoId(e.target.value)}>
            <option value="">Escolha…</option>
            {advogados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
          <Input rotulo="Data" type="date" value={data} min={paraTexto(hoje())} onChange={(e) => setData(e.target.value)} />
        </div>

        <div>
          <span className="rotulo">Horário livre {config && `(consulta de ${config.duracao_consulta_min} min)`}</span>
          {!advogadoId ? (
            <p className="text-sm texto-suave">Escolha o advogado para ver os horários.</p>
          ) : buscandoLivres ? (
            <p className="text-sm texto-suave">Buscando horários…</p>
          ) : livres.length === 0 ? (
            <p className="text-sm texto-suave">Nenhum horário livre neste dia. Confira a jornada do advogado em Configurações.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {livres.map((h) => (
                <button
                  key={h}
                  onClick={() => setHora(h)}
                  className="rounded-lg border px-3 py-1 text-sm"
                  style={h === hora
                    ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#1C2B3A' }
                    : { borderColor: 'var(--border-card)' }}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select rotulo="Modalidade" value={modalidade} onChange={(e) => setModalidade(e.target.value as Modalidade)}>
            <option value="presencial">Presencial</option>
            <option value="online">Online</option>
          </Select>
          <Select rotulo="Serviço" value={servico} onChange={(e) => setServico(e.target.value)}>
            <option value="">—</option>
            {servicos.map((s) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
          </Select>
        </div>
        {modalidade === 'online' && !(advogado?.link_sala || config?.link_reuniao_padrao) && (
          <p className="text-xs" style={{ color: 'var(--warning)' }}>
            Nem o advogado nem o escritório têm sala de videoconferência cadastrada. Envie o link pela conversa.
          </p>
        )}
        <Textarea rotulo="Observações" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>
    </Modal>
  )
}
