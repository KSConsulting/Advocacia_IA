import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ORDEM_LEAD, STATUS_LEAD } from '../lib/status'
import { formatarDataHora } from '../lib/datas'
import { nomeOuNumero } from '../lib/telefone'
import { useToast } from '../contexts/ToastContext'
import type { LeadAdv, LeadStatus } from '../types'
import PageHeader from '../components/ui/PageHeader'
import { Carregando } from '../components/ui/Card'
import { BadgeLead } from '../components/ui/Badge'
import { ModalConfirmacao } from '../components/ui/Modal'

function CardLead({ lead, arrastando }: { lead: LeadAdv; arrastando?: boolean }) {
  return (
    <div
      className="card cursor-grab p-3 text-sm active:cursor-grabbing"
      style={{ boxShadow: arrastando ? '0 8px 24px rgba(0,0,0,0.18)' : undefined }}
    >
      <p className="truncate font-medium">{nomeOuNumero(lead.nome_lead, lead.whatsapp_lead)}</p>
      <p className="mt-1 line-clamp-2 text-xs texto-suave">{lead.motivo_contato || 'Motivo ainda não informado'}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs texto-suave">
          <CalendarDays size={12} strokeWidth={1.5} />
          {formatarDataHora(lead.inicio_atendimento).slice(0, 10)}
        </span>
        <BadgeLead status={lead.status} />
      </div>
    </div>
  )
}

function Arrastavel({ lead }: { lead: LeadAdv }) {
  const navegar = useNavigate()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => navegar(`/leads/${lead.id}`)}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }}
    >
      <CardLead lead={lead} />
    </div>
  )
}

function Coluna({ status, leads }: { status: LeadStatus; leads: LeadAdv[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const s = STATUS_LEAD[status]
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 px-1">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-sm font-semibold" style={{ color: s.texto }}>{s.nome}</h3>
          <span className="rounded-full px-2 text-xs" style={{ backgroundColor: s.bg, color: s.texto }}>{leads.length}</span>
        </div>
        <p className="mt-0.5 text-xs texto-suave">{s.descricao}</p>
      </div>
      <div
        ref={setNodeRef}
        className="flex min-h-[200px] flex-1 flex-col gap-2 rounded-xl p-2 transition-colors"
        style={{
          backgroundColor: isOver ? 'var(--accent-light)' : 'transparent',
          border: `1px dashed ${isOver ? 'var(--accent)' : 'var(--border-card)'}`,
        }}
      >
        {leads.map((l) => <Arrastavel key={l.id} lead={l} />)}
      </div>
    </div>
  )
}

export default function Kanban() {
  const toast = useToast()
  const [leads, setLeads] = useState<LeadAdv[]>([])
  const [carregando, setCarregando] = useState(true)
  const [arrastado, setArrastado] = useState<LeadAdv | null>(null)
  const [pendente, setPendente] = useState<{ lead: LeadAdv; para: LeadStatus } | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Distância mínima: sem ela, todo clique (abrir a ficha) viraria arrasto.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('leads_adv')
      .select('*')
      .order('inicio_atendimento', { ascending: false })
      .limit(1000)
    setLeads((data ?? []) as LeadAdv[])
    setCarregando(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
    // "Atualização em tempo real em todo o sistema": quando a secretária de IA
    // ou outra pessoa move um lead, o card anda sozinho.
    const canal = supabase
      .channel('kanban-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_adv' }, (p) => {
        setLeads((atual) => {
          if (p.eventType === 'DELETE') return atual.filter((l) => l.id !== (p.old as LeadAdv).id)
          const novo = p.new as LeadAdv
          const existe = atual.some((l) => l.id === novo.id)
          return existe ? atual.map((l) => (l.id === novo.id ? novo : l)) : [novo, ...atual]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [carregar])

  const porColuna = useMemo(() => {
    const m = Object.fromEntries(ORDEM_LEAD.map((s) => [s, [] as LeadAdv[]])) as Record<LeadStatus, LeadAdv[]>
    for (const l of leads) m[l.status]?.push(l)
    return m
  }, [leads])

  const mover = async (lead: LeadAdv, para: LeadStatus) => {
    const antes = lead.status
    setLeads((a) => a.map((l) => (l.id === lead.id ? { ...l, status: para } : l)))
    const { error } = await supabase.from('leads_adv').update({ status: para }).eq('id', lead.id)
    if (error) {
      setLeads((a) => a.map((l) => (l.id === lead.id ? { ...l, status: antes } : l)))
      toast.erro('Não foi possível mover o lead.')
    } else {
      toast.sucesso(`Movido para ${STATUS_LEAD[para].nome}.`)
    }
  }

  const aoComecar = (e: DragStartEvent) => setArrastado(leads.find((l) => l.id === e.active.id) ?? null)

  const aoSoltar = (e: DragEndEvent) => {
    setArrastado(null)
    const lead = leads.find((l) => l.id === e.active.id)
    const para = e.over?.id as LeadStatus | undefined
    if (!lead || !para || para === lead.status) return
    // Mover para "compareceu" promove a cliente: pede confirmação antes.
    if (para === 'compareceu') setPendente({ lead, para })
    else mover(lead, para)
  }

  return (
    <>
      <PageHeader
        titulo="Kanban"
        descricao="Visualize e gerencie o avanço de cada lead pelo funil de atendimento. Arraste os cards entre as etapas e o sistema atualiza o status automaticamente em todo o escritório."
      />
      {carregando ? <Carregando /> : (
        <DndContext sensors={sensores} onDragStart={aoComecar} onDragEnd={aoSoltar} onDragCancel={() => setArrastado(null)}>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
            {ORDEM_LEAD.map((s) => <Coluna key={s} status={s} leads={porColuna[s]} />)}
          </div>
          <DragOverlay>{arrastado && <CardLead lead={arrastado} arrastando />}</DragOverlay>
        </DndContext>
      )}

      <ModalConfirmacao
        aberto={!!pendente}
        titulo="Promover a cliente"
        texto="Ao confirmar, este lead será promovido a cliente. Essa ação pode ser revertida movendo o card para outro status."
        carregando={salvando}
        onCancelar={() => setPendente(null)}
        onConfirmar={async () => {
          if (!pendente) return
          setSalvando(true)
          await mover(pendente.lead, pendente.para)
          setSalvando(false)
          setPendente(null)
        }}
      />
    </>
  )
}
