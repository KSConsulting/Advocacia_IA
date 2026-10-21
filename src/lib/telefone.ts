/**
 * O WhatsApp é guardado em formato canônico: só dígitos, com o código do país.
 * É assim que a ponte entrega (`5511987654321`), e é a chave de `whatsapp_lead`.
 * Gravado de outro jeito pela tela, a mesma pessoa viraria dois leads.
 */
export function normalizarWhatsapp(bruto: string): string {
  const d = bruto.replace(/\D/g, '')
  // Número brasileiro digitado sem o 55 (DDD + 8 ou 9 dígitos).
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

/** `5511987654321` → `+55 (11) 98765-4321` */
export function formatarWhatsapp(numero: string | null | undefined): string {
  if (!numero) return '—'
  const d = numero.replace(/\D/g, '')
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  if (m) return `+55 (${m[1]}) ${m[2]}-${m[3]}`
  return `+${d}`
}

/** O nome, ou o número formatado quando ainda não há nome — que é verdade. */
export function nomeOuNumero(nome: string | null | undefined, whatsapp: string): string {
  return nome?.trim() || formatarWhatsapp(whatsapp)
}
