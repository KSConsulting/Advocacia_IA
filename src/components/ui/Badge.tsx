import type { AgendamentoStatus, LeadStatus } from '../../types'
import { STATUS_AGENDAMENTO, STATUS_LEAD, type CoresBadge } from '../../lib/status'

export default function Badge({ cores, children }: { cores: CoresBadge; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: cores.bg, color: cores.texto, borderColor: cores.borda }}
    >
      {children}
    </span>
  )
}

export function BadgeLead({ status }: { status: LeadStatus }) {
  const s = STATUS_LEAD[status]
  return <Badge cores={s}>{s.nome}</Badge>
}

export function BadgeAgendamento({ status }: { status: AgendamentoStatus }) {
  const s = STATUS_AGENDAMENTO[status]
  return <Badge cores={s}>{s.nome}</Badge>
}
