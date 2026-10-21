/**
 * Os modelos que a secretária pode usar.
 *
 * ACRESCENTAR UM MODELO exige também o `conversar()` de
 * supabase/functions/_shared/llm.ts — nada sincroniza isso sozinho.
 */
export interface ModeloIA {
  id: string
  nome: string
  fornecedor: 'openai' | 'anthropic'
  nota: string
}

export const MODELOS: ModeloIA[] = [
  { id: 'gpt-4.1-mini', nome: 'GPT-4.1 mini', fornecedor: 'openai', nota: 'Padrão. Rápido e barato.' },
  { id: 'gpt-4.1', nome: 'GPT-4.1', fornecedor: 'openai', nota: 'Mais cuidadoso, custa mais.' },
  { id: 'gpt-5-mini', nome: 'GPT-5 mini', fornecedor: 'openai', nota: 'Raciocina antes de responder.' },
  { id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5', fornecedor: 'anthropic', nota: 'Rápido. Exige chave da Anthropic.' },
  { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5', fornecedor: 'anthropic', nota: 'Exige chave da Anthropic.' },
]
