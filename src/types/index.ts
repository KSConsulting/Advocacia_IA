// ─── ENUMs ────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'novo_contato'
  | 'conversando'
  | 'consulta_agendada'
  | 'compareceu'
  | 'follow_up'
  | 'fechado'
  | 'perdido'

export type AgendamentoStatus =
  | 'agendado'
  | 'confirmado'
  | 'compareceu'
  | 'faltou'
  | 'cancelado'

export type DiaSemana =
  | 'domingo'
  | 'segunda'
  | 'terca'
  | 'quarta'
  | 'quinta'
  | 'sexta'
  | 'sabado'

export type Modalidade = 'presencial' | 'online'

// ─── TABELAS ──────────────────────────────────────────────────────────────────

// Desvio da especificação: sem os campos Chatwoot (o Chatwoot saiu do sistema)
// e sem `minutos_ultima_mensagem` (calculado a partir de `ultima_mensagem` —
// ver supabase/migrations/0001_schema.sql).
export interface LeadAdv {
  id: string
  nome_lead: string | null
  whatsapp_lead: string
  motivo_contato: string | null
  resumo_conversa: string | null
  status: LeadStatus
  inicio_atendimento: string | null
  ultima_mensagem: string | null
  follow_up_1: string | null
  follow_up_2: string | null
  follow_up_3: string | null
  data_agendamento: string | null
  id_agendamento: string | null
  anotacoes: string | null
  agente_pausado: boolean
  created_at: string
}

export interface ClienteAdv {
  id: string
  lead_id: string
  data_primeira_visita: string
  created_at: string
  // Join com leads_adv
  lead?: LeadAdv
}

export interface OfficeConfig {
  id: number
  nome: string
  logo_url: string | null
  favicon_url: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  link_maps: string | null
  instagram: string | null
  site: string | null
  areas_atuacao: string | null
  fuso_horario: string
  duracao_consulta_min: number
  consulta_gratuita: boolean
  link_reuniao_padrao: string | null
  updated_at: string
}

export interface OfficeHours {
  id: string
  dia: DiaSemana
  aberto: boolean
  hora_inicio: string | null
  hora_fim: string | null
}

export interface Advogado {
  id: string
  nome: string
  cor: string
  ativo: boolean
  especialidade: string | null
  link_sala: string | null
  created_at: string
}

export interface AdvogadoHours {
  id: string
  advogado_id: string
  dia: DiaSemana
  aberto: boolean
  hora_inicio: string | null
  hora_fim: string | null
}

export interface AgendamentoAdv {
  id: string
  advogado_id: string
  lead_id: string
  cliente_id: string | null
  data_hora_inicio: string
  data_hora_fim: string
  status: AgendamentoStatus
  observacoes: string | null
  servico: string | null
  modalidade: Modalidade
  link_reuniao: string | null
  origem: 'sistema' | 'secretaria_ia'
  created_at: string
  // Joins
  lead?: LeadAdv
  advogado?: Advogado
}

export interface ServicoAdv {
  id: string
  categoria: string
  nome: string
  descricao: string | null
  ativo: boolean
  ordem: number
}

export interface Usuario {
  id: string
  email: string | null
  nome: string | null
  role: 'admin' | 'equipe'
}

export interface ConfiguracoesAgente {
  id: number
  ativo: boolean
  nome_agente: string
  modelo: string
  prompt: string | null
  modo_teste: boolean
  numeros_teste: string[]
  provedor_whatsapp: 'evolution' | 'uazapi'
  follow_up_ativo: boolean
  updated_at: string
}

export interface MensagemWhatsapp {
  id: string
  lead_id: string
  autor: 'lead' | 'agente' | 'atendente'
  tipo: 'texto' | 'audio' | 'imagem' | 'video' | 'documento'
  conteudo: string | null
  midia_url: string | null
  lida: boolean
  origem: string | null
  criada_em: string
}

export interface ConversaResumo {
  lead_id: string
  nome_lead: string | null
  whatsapp_lead: string
  status: LeadStatus
  motivo_contato: string | null
  agente_pausado: boolean
  ultima_conteudo: string | null
  ultima_tipo: string
  ultima_autor: string
  ultima_em: string
  nao_lidas: number
}

// ─── FILTROS ──────────────────────────────────────────────────────────────────

export type FilterPreset =
  | 'hoje'
  | 'ontem'
  | 'ultimos_7_dias'
  | 'ultimos_14_dias'
  | 'este_mes'
  | 'mes_passado'
  | 'este_ano'
  | 'personalizado'

export interface DateFilter {
  preset: FilterPreset
  startDate: string
  endDate: string
}
