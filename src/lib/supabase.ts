import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Chama a Edge Function `whatsapp` com a sessão de quem está logado.
 *
 * As chaves do WhatsApp e da IA são de servidor: tudo que fala com elas passa
 * pela função, nunca pelo navegador.
 */
export async function chamarFuncao<T = Record<string, unknown>>(
  rota: string,
  opcoes: { metodo?: 'GET' | 'POST'; corpo?: unknown } = {},
): Promise<T & { ok: boolean; motivo?: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const r = await fetch(`${supabaseUrl}/functions/v1/whatsapp${rota}`, {
    method: opcoes.metodo ?? 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token ?? supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  })
  const json = await r.json().catch(() => ({ ok: false, motivo: 'resposta_invalida' }))
  return json
}
