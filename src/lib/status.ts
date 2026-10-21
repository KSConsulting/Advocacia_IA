import type { AgendamentoStatus, LeadStatus } from '../types'

export interface CoresBadge {
  bg: string
  texto: string
  borda: string
}

/** Badges de Status — leads_adv (tabela da especificação). */
export const STATUS_LEAD: Record<LeadStatus, { nome: string; descricao: string } & CoresBadge> = {
  novo_contato: {
    nome: 'Novo Contato', descricao: 'Lead acabou de entrar em contato',
    bg: '#EBF4FF', texto: '#1C5EA8', borda: '#BFDBFE',
  },
  conversando: {
    nome: 'Conversando', descricao: 'Em conversa, coletando informações',
    bg: '#FEF9E7', texto: '#92600A', borda: '#FDE68A',
  },
  consulta_agendada: {
    nome: 'Consulta Agendada', descricao: 'Consulta marcada, aguardando comparecimento',
    bg: '#F0FDF4', texto: '#166534', borda: '#BBF7D0',
  },
  compareceu: {
    nome: 'Compareceu', descricao: 'Compareceu à consulta e virou cliente',
    bg: '#F5F3FF', texto: '#5B21B6', borda: '#DDD6FE',
  },
  follow_up: {
    nome: 'Follow Up', descricao: 'Agente de IA realizará o follow up automaticamente',
    bg: '#FFF7ED', texto: '#9A3412', borda: '#FED7AA',
  },
  fechado: {
    nome: 'Fechado', descricao: 'Contrato fechado, cliente ativo',
    bg: '#ECFDF5', texto: '#065F46', borda: '#6EE7B7',
  },
  perdido: {
    nome: 'Perdido', descricao: 'Desistiu ou sem retorno',
    bg: '#FEF2F2', texto: '#991B1B', borda: '#FECACA',
  },
}

export const ORDEM_LEAD: LeadStatus[] = [
  'novo_contato', 'conversando', 'consulta_agendada', 'compareceu', 'follow_up', 'fechado', 'perdido',
]

/** Badges de Status — agendamentos_adv (tabela da especificação). */
export const STATUS_AGENDAMENTO: Record<AgendamentoStatus, { nome: string } & CoresBadge> = {
  agendado: { nome: 'Agendado', bg: '#EBF4FF', texto: '#1C5EA8', borda: '#BFDBFE' },
  confirmado: { nome: 'Confirmado', bg: '#F0FDF4', texto: '#166534', borda: '#BBF7D0' },
  compareceu: { nome: 'Compareceu', bg: '#F5F3FF', texto: '#5B21B6', borda: '#DDD6FE' },
  faltou: { nome: 'Faltou', bg: '#FEF2F2', texto: '#991B1B', borda: '#FECACA' },
  cancelado: { nome: 'Cancelado', bg: '#F3F4F6', texto: '#6B7280', borda: '#E5E7EB' },
}

export const ORDEM_AGENDAMENTO: AgendamentoStatus[] = ['agendado', 'confirmado', 'compareceu', 'faltou', 'cancelado']
