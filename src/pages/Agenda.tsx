import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Video, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  DIAS_SEMANA, diaDaSemana, diaDe, formatarDataHora, formatarDiaCivil, formatarHora, hoje,
  instante, mesmoDia, paraTexto, partesNoFuso, somarDias, type DiaCivil,
} from '../lib/datas'
import { ORDEM_AGENDAMENTO, STATUS_AGENDAMENTO } from '../lib/status'
import { nomeOuNumero } from '../lib/telefone'
import { useToast } from '../contexts/ToastContext'
import type { Advogado, AgendamentoAdv, AgendamentoStatus } from '../types'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Carregando } from '../components/ui/Card'
import Modal, { ModalConfirmacao } from '../components/ui/Modal'
import { BadgeAgendamento } from '../components/ui/Badge'
import NovoAgendamentoModal from '../components/NovoAgendamentoModal'

const HORA_PX = 56
const PRIMEIRA_HORA = 7
const ULTIMA_HORA = 21
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

type Visao = 'semana' | 'mes'

/** Segunda-feira da semana de `d`. */
function inicioDaSemana(d: DiaCivil): DiaCivil {
  const dow = diaDaSemana(d)
  return somarDias(d, dow === 0 ? -6 : 1 - dow)
}

/**
 * A agenda de TODOS os advogados ao mesmo tempo, cada um na sua cor.
 *
 * Substitui o Google Calendar. A diferença que importa: o horário livre que a
 * secretária de IA oferece e o que esta tela mostra saem da MESMA regra
 * (`agenda_horarios_disponiveis`), e o banco recusa sobreposição e horário
 * fora da jornada para as duas.
 */
export default function Agenda() {
  const toast = useToast()
  const [visao, setVisao] = useState<Visao>('semana')
  const [referencia, setReferencia] = useState<DiaCivil>(hoje())
  const [advogados, setAdvogados] = useState<Advogado[]>([])
  const [ocultos, setOcultos] = useState<Set<string>>(new Set())
  const [consultas, setConsultas] = useState<AgendamentoAdv[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberta, setAberta] = useState<AgendamentoAdv | null>(null)
  const [novo, setNovo] = useState<{ data?: string; hora?: string } | null>(null)
  const [confirmarPresenca, setConfirmarPresenca] = useState(false)

  const { inicio, fim, dias } = useMemo(() => {
    if (visao === 'semana') {
      const seg = inicioDaSemana(referencia)
      const ds = Array.from({ length: 7 }, (_, i) => somarDias(seg, i))
      return { inicio: seg, fim: somarDias(seg, 7), dias: ds }
    }
    const primeiro = { ...referencia, dia: 1 }
    const grade = inicioDaSemana(primeiro)
    const ds = Array.from({ length: 42 }, (_, i) => somarDias(grade, i))
    return { inicio: grade, fim: somarDias(grade, 42), dias: ds }
  }, [visao, referencia])

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('agendamentos_adv')
      .select('*, lead:leads_adv(id,nome_lead,whatsapp_lead,motivo_contato), advogado:advogados(id,nome,cor)')
      .gte('data_hora_inicio', instante(inicio).toISOString())
      .lt('data_hora_inicio', instante(fim).toISOString())
      .neq('status', 'cancelado')
      .order('data_hora_inicio')
    setConsultas((data ?? []) as AgendamentoAdv[])
    setCarregando(false)
  }, [inicio, fim])

  useEffect(() => {
    supabase.from('advogados').select('*').order('nome').then(({ data }) => setAdvogados((data ?? []) as Advogado[]))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
    // Consulta marcada pela secretária de IA aparece aqui sem recarregar.
    const canal = supabase
      .channel('agenda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos_adv' }, () => carregar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [carregar])

  const visiveis = consultas.filter((c) => !ocultos.has(c.advogado_id))

  const andar = (n: number) => {
    if (visao === 'semana') setReferencia((r) => somarDias(r, 7 * n))
    else setReferencia((r) => {
      const mes = r.mes + n
      const ano = r.ano + Math.floor((mes - 1) / 12)
      return { ano, mes: ((mes - 1) % 12 + 12) % 12 + 1, dia: 1 }
    })
  }

  const titulo = visao === 'semana'
    ? `${formatarDiaCivil(dias[0])} – ${formatarDiaCivil(dias[6])}`
    : `${MESES[referencia.mes - 1]} de ${referencia.ano}`

  const mudarStatus = async (status: AgendamentoStatus) => {
    if (!aberta) return
    const { error } = await supabase.from('agendamentos_adv').update({ status }).eq('id', aberta.id)
    if (error) return toast.erro('Não foi possível atualizar o status.')
    toast.sucesso(`Status: ${STATUS_AGENDAMENTO[status].nome}.`)
    setAberta(null)
    carregar()
  }

  return (
    <>
      <PageHeader
        titulo="Agenda"
        descricao="As agendas de todos os advogados, cada um na sua cor. Clique num horário vazio para marcar uma consulta — as consultas marcadas pela secretária de IA aparecem aqui na hora."
        acoes={<Button icone={<Plus size={16} strokeWidth={1.5} />} onClick={() => setNovo({})}>Novo agendamento</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => andar(-1)} className="rounded-lg border p-1.5" style={{ borderColor: 'var(--border-card)' }} aria-label="Anterior">
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <button onClick={() => setReferencia(hoje())} className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--border-card)' }}>
            Hoje
          </button>
          <button onClick={() => andar(1)} className="rounded-lg border p-1.5" style={{ borderColor: 'var(--border-card)' }} aria-label="Próximo">
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
        <h2 className="font-display text-lg font-semibold capitalize">{titulo}</h2>
        <div className="ml-auto flex overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-card)' }}>
          {(['semana', 'mes'] as Visao[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisao(v)}
              className="px-3 py-1.5 text-sm"
              style={visao === v ? { backgroundColor: 'var(--accent)', color: '#1C2B3A' } : {}}
            >
              {v === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* Ligar e desligar agendas, para comparar. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {advogados.filter((a) => a.ativo).map((a) => {
          const ligado = !ocultos.has(a.id)
          return (
            <button
              key={a.id}
              onClick={() => setOcultos((o) => {
                const n = new Set(o)
                if (n.has(a.id)) n.delete(a.id)
                else n.add(a.id)
                return n
              })}
              className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              style={{ borderColor: ligado ? a.cor : 'var(--border-card)', opacity: ligado ? 1 : 0.5 }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.cor }} />
              {a.nome}
            </button>
          )
        })}
      </div>

      {carregando ? <Carregando /> : visao === 'semana' ? (
        <div className="card overflow-x-auto">
          <div className="grid min-w-[760px]" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
            <div />
            {dias.map((d) => (
              <div
                key={paraTexto(d)}
                className="border-b px-2 py-2 text-center text-xs"
                style={{ borderColor: 'var(--border-card)', color: mesmoDia(d, hoje()) ? 'var(--accent)' : undefined }}
              >
                <div className="texto-suave">{DIAS_SEMANA[diaDaSemana(d)].curto}</div>
                <div className="text-base font-semibold">{d.dia}</div>
              </div>
            ))}

            <div className="relative" style={{ height: (ULTIMA_HORA - PRIMEIRA_HORA) * HORA_PX }}>
              {Array.from({ length: ULTIMA_HORA - PRIMEIRA_HORA }, (_, i) => (
                <div key={i} className="absolute right-2 -translate-y-2 text-[11px] texto-suave" style={{ top: i * HORA_PX }}>
                  {String(PRIMEIRA_HORA + i).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {dias.map((d) => {
              const doDia = visiveis.filter((c) => mesmoDia(diaDe(c.data_hora_inicio), d))
              return (
                <div
                  key={paraTexto(d)}
                  className="relative cursor-pointer border-l"
                  style={{
                    height: (ULTIMA_HORA - PRIMEIRA_HORA) * HORA_PX,
                    borderColor: 'var(--border-card)',
                    backgroundImage: `repeating-linear-gradient(to bottom, var(--border-card) 0, var(--border-card) 1px, transparent 1px, transparent ${HORA_PX}px)`,
                  }}
                  onClick={(e) => {
                    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                    const meiaHora = Math.floor(y / (HORA_PX / 2))
                    const h = PRIMEIRA_HORA + Math.floor(meiaHora / 2)
                    const m = (meiaHora % 2) * 30
                    setNovo({ data: paraTexto(d), hora: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` })
                  }}
                >
                  {doDia.map((c) => {
                    const p = partesNoFuso(new Date(c.data_hora_inicio))
                    const minutos = (new Date(c.data_hora_fim).getTime() - new Date(c.data_hora_inicio).getTime()) / 60000
                    const top = ((p.hora - PRIMEIRA_HORA) * 60 + p.minuto) * (HORA_PX / 60)
                    const cor = c.advogado?.cor ?? '#1B3A5C'
                    return (
                      <button
                        key={c.id}
                        onClick={(e) => { e.stopPropagation(); setAberta(c) }}
                        className="absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-left text-[11px] leading-tight text-white shadow-sm"
                        style={{
                          top: Math.max(0, top),
                          height: Math.max(22, minutos * (HORA_PX / 60) - 2),
                          backgroundColor: cor,
                          opacity: c.status === 'faltou' ? 0.55 : 1,
                        }}
                      >
                        <div className="font-medium">{formatarHora(c.data_hora_inicio)} {c.modalidade === 'online' ? '· online' : ''}</div>
                        <div className="truncate">{c.lead ? nomeOuNumero(c.lead.nome_lead, c.lead.whatsapp_lead) : ''}</div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7">
            {DIAS_SEMANA.slice(1).concat(DIAS_SEMANA[0]).map((d) => (
              <div key={d.valor} className="border-b px-2 py-2 text-center text-xs texto-suave" style={{ borderColor: 'var(--border-card)' }}>{d.curto}</div>
            ))}
            {dias.map((d) => {
              const doDia = visiveis.filter((c) => mesmoDia(diaDe(c.data_hora_inicio), d))
              const foraDoMes = d.mes !== referencia.mes
              return (
                <div
                  key={paraTexto(d)}
                  className="min-h-[96px] cursor-pointer border-b border-r p-1.5"
                  style={{ borderColor: 'var(--border-card)', opacity: foraDoMes ? 0.45 : 1 }}
                  onClick={() => setNovo({ data: paraTexto(d) })}
                >
                  <div className="mb-1 text-xs font-medium" style={{ color: mesmoDia(d, hoje()) ? 'var(--accent)' : undefined }}>{d.dia}</div>
                  {doDia.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      onClick={(e) => { e.stopPropagation(); setAberta(c) }}
                      className="mb-0.5 flex w-full items-center gap-1 truncate rounded px-1 text-left text-[11px]"
                      style={{ backgroundColor: `${c.advogado?.cor ?? '#1B3A5C'}22` }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.advogado?.cor }} />
                      {formatarHora(c.data_hora_inicio)} {c.lead ? nomeOuNumero(c.lead.nome_lead, c.lead.whatsapp_lead) : ''}
                    </button>
                  ))}
                  {doDia.length > 3 && <div className="text-[11px] texto-suave">+{doDia.length - 3} consultas</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal aberto={!!aberta} titulo="Consulta" onFechar={() => setAberta(null)}>
        {aberta && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <Link to={`/leads/${aberta.lead_id}`} className="font-medium hover:underline">
                {aberta.lead ? nomeOuNumero(aberta.lead.nome_lead, aberta.lead.whatsapp_lead) : 'Contato'}
              </Link>
              <BadgeAgendamento status={aberta.status} />
            </div>
            <p>{formatarDataHora(aberta.data_hora_inicio)} – {formatarHora(aberta.data_hora_fim)}</p>
            <p className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: aberta.advogado?.cor }} />
              {aberta.advogado?.nome}
            </p>
            <p className="flex items-center gap-2 capitalize">
              {aberta.modalidade === 'online' ? <Video size={16} strokeWidth={1.5} /> : <MapPin size={16} strokeWidth={1.5} />}
              {aberta.modalidade}
              {aberta.link_reuniao && (
                <a href={aberta.link_reuniao} target="_blank" rel="noreferrer" className="normal-case underline" style={{ color: 'var(--accent)' }}>
                  abrir sala
                </a>
              )}
            </p>
            {(aberta.servico || aberta.lead?.motivo_contato) && <p>Assunto: {aberta.servico || aberta.lead?.motivo_contato}</p>}
            {aberta.observacoes && <p className="whitespace-pre-line texto-suave">{aberta.observacoes}</p>}
            <p className="text-xs texto-suave">Marcada {aberta.origem === 'secretaria_ia' ? 'pela secretária de IA' : 'pela equipe'}.</p>
            <div>
              <span className="rotulo">Status</span>
              <div className="flex flex-wrap gap-2">
                {ORDEM_AGENDAMENTO.filter((s) => s !== aberta.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => (s === 'compareceu' ? setConfirmarPresenca(true) : mudarStatus(s))}
                    className="rounded-full border px-3 py-1 text-xs"
                    style={{ backgroundColor: STATUS_AGENDAMENTO[s].bg, color: STATUS_AGENDAMENTO[s].texto, borderColor: STATUS_AGENDAMENTO[s].borda }}
                  >
                    {STATUS_AGENDAMENTO[s].nome}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ModalConfirmacao
        aberto={confirmarPresenca}
        titulo="Confirmar comparecimento"
        texto="Ao confirmar, este lead será promovido a cliente automaticamente."
        onCancelar={() => setConfirmarPresenca(false)}
        onConfirmar={async () => {
          await mudarStatus('compareceu')
          setConfirmarPresenca(false)
        }}
      />

      <NovoAgendamentoModal aberto={!!novo} inicial={novo ?? undefined} onFechar={() => setNovo(null)} onSalvo={carregar} />
    </>
  )
}
