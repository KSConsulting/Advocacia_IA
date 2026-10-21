/**
 * Follow-up automático — retoma a conversa com quem parou de responder.
 *
 * Substitui os workflows "Follow UP de 20 minutos / 24 horas / 36 horas" do
 * n8n. Quem chama é o `pg_cron`, a cada 10 minutos (migração 0004), e QUEM
 * recebe é decidido no banco por `leads_para_follow_up()`. Aqui só se escreve
 * e se envia.
 *
 * PUBLICADA COM `--no-verify-jwt`; a autenticação é o cabeçalho
 * `x-follow-up-segredo`, o mesmo valor guardado no Vault do banco.
 *
 * ⚠️ RESERVA ANTES DE ENVIAR. A coluna `follow_up_N` é gravada ANTES da
 * mensagem sair, com a condição de ainda estar vazia. Se duas execuções se
 * sobrepuserem (uma demorou mais de 10 min), só uma ganha a reserva — e o
 * cliente não recebe o mesmo follow-up duas vezes. Se o envio falhar, a
 * reserva é desfeita e a próxima rodada tenta de novo.
 */

import { rpc, selecionar, inserir, atualizar } from '../_shared/db.ts'
import { conversar, type MensagemLLM } from '../_shared/llm.ts'
import { ponteAtiva } from '../_shared/pontes.ts'

const SEGREDO = Deno.env.get('FOLLOW_UP_SEGREDO') ?? ''

/** As últimas mensagens que o modelo lê para saber onde a conversa parou. */
const HISTORICO = 20

/**
 * O prompt do n8n, quase igual — ele funcionava. Mudou só o que dependia do
 * n8n (`{{ $now }}`) e o que faltava: a etapa, para o 3º não soar como o 1º.
 */
function instrucao(nomeAgente: string, etapa: number, nomeCliente: string | null): string {
  const tom = etapa === 1
    ? 'É o primeiro lembrete, pouco tempo depois da última mensagem: bem leve, como quem só confere se a pessoa viu.'
    : etapa === 2
    ? 'É o segundo lembrete, no dia seguinte: retome o assunto dela com naturalidade e se coloque à disposição.'
    : 'É o último lembrete: deixe a porta aberta com carinho, sem cobrar, dizendo que o escritório segue à disposição quando ela quiser.'

  return `## IDENTIDADE

Você é **${nomeAgente}**, secretária de um escritório de advocacia. Você escreve mensagens de follow-up naturais e leves para retomar conversas no WhatsApp.

## FUNÇÃO

- Ler as últimas mensagens trocadas entre você e o cliente.
- Entender em que ponto a conversa parou.
- Criar **uma mensagem única, humanizada e natural** para retomar o diálogo.
- Estimular o cliente a responder, sem pressão.

## ESTE FOLLOW-UP

${tom}

## REGRAS

- Nunca se apresente, nunca peça nome ou dados já informados.
- Seja breve: no máximo 25 palavras, uma mensagem só.
- ${nomeCliente ? `O nome do cliente é ${nomeCliente}. Pode usar uma vez.` : 'Você não sabe o nome do cliente: não invente um.'}
- Não pressione, não cobre retorno e não mencione há quanto tempo ele sumiu.
- Nunca repita a última pergunta ou informação enviada.
- Nunca dê orientação jurídica, prazo ou promessa de resultado.
- Emoji só se fizer sentido, e no máximo um.
- Nunca use travessão para separar orações.
- Responda SÓ com o texto da mensagem, sem aspas.

## EXEMPLOS

- "Oi! Você chegou a ver minha última mensagem?"
- "Ficou alguma dúvida que eu possa esclarecer pra você?"
- "Olá, conseguiu pensar sobre a consulta? Sigo por aqui se precisar."`
}

Deno.serve(async (req) => {
  if (!SEGREDO || req.headers.get('x-follow-up-segredo') !== SEGREDO) {
    return json({ ok: false, motivo: 'nao_autorizado' }, 401)
  }

  const alvos = await rpc<{ lead_id: string; whatsapp: string; etapa: number }[]>(
    'leads_para_follow_up', {},
  )
  if (!alvos.length) return json({ ok: true, enviados: 0 })

  const [cfg] = await selecionar<{ modelo: string; nome_agente: string }>(
    'configuracoes_agente?select=modelo,nome_agente&id=eq.1&limit=1',
  )
  const ponte = await ponteAtiva()

  let enviados = 0
  for (const alvo of alvos) {
    try {
      if (await umFollowUp(alvo, ponte, cfg?.modelo ?? 'gpt-4.1-mini', cfg?.nome_agente ?? 'Camila')) {
        enviados++
      }
    } catch (e) {
      // Um lead com problema não pode impedir os outros de receber.
      console.error(`follow-up ${alvo.lead_id}:`, e)
    }
  }

  return json({ ok: true, candidatos: alvos.length, enviados })
})

async function umFollowUp(
  alvo: { lead_id: string; whatsapp: string; etapa: number },
  ponte: Awaited<ReturnType<typeof ponteAtiva>>,
  modelo: string,
  nomeAgente: string,
): Promise<boolean> {
  const coluna = `follow_up_${alvo.etapa}`
  const agora = new Date().toISOString()

  // Reserva: só passa quem encontrar a coluna ainda vazia.
  const reservou = await fetchReserva(alvo.lead_id, coluna, agora)
  if (!reservou) return false

  const [lead] = await selecionar<{ nome_lead: string | null }>(
    `leads_adv?select=nome_lead&id=eq.${alvo.lead_id}&limit=1`,
  )
  const linhas = await selecionar<{ autor: string; conteudo: string | null }>(
    `mensagens_whatsapp?select=autor,conteudo&lead_id=eq.${alvo.lead_id}` +
    `&order=criada_em.desc&limit=${HISTORICO}`,
  )
  const historico: MensagemLLM[] = linhas
    .reverse()
    .filter((l) => (l.conteudo ?? '').trim())
    .map((l) => ({ papel: l.autor === 'lead' ? 'user' : 'assistant', conteudo: l.conteudo! }))

  // O modelo precisa terminar numa fala do usuário. Aqui a última é nossa (é
  // por isso que é follow-up), então o pedido entra como a última linha.
  historico.push({
    papel: 'user',
    conteudo: '[instrução interna, não é do cliente] Escreva agora a mensagem de follow-up.',
  })

  const r = await conversar({
    modelo,
    sistema: instrucao(nomeAgente, alvo.etapa, lead?.nome_lead ?? null),
    mensagens: historico,
    ferramentas: [],
    maxTokens: 300,
  })
  const texto = r.texto.trim().replace(/^["“]|["”]$/g, '')

  if (!texto) {
    await atualizar('leads_adv', `id=eq.${alvo.lead_id}`, { [coluna]: null })
    return false
  }

  let idExterno: string | null
  try {
    idExterno = await ponte.enviarTexto(alvo.whatsapp, texto)
  } catch (e) {
    console.error('envio follow-up:', e)
    await atualizar('leads_adv', `id=eq.${alvo.lead_id}`, { [coluna]: null })
    return false
  }

  await inserir('mensagens_whatsapp', {
    lead_id: alvo.lead_id,
    autor: 'agente',
    tipo: 'texto',
    conteudo: texto,
    id_externo: idExterno,
    lida: true,
    origem: 'follow_up',
  }, true)

  // A etapa do Kanban: "Follow Up — Agente de IA realizará o follow up".
  await atualizar('leads_adv', `id=eq.${alvo.lead_id}&status=in.(novo_contato,conversando)`, {
    status: 'follow_up',
  })
  return true
}

/** `UPDATE ... WHERE follow_up_N IS NULL RETURNING id` — true se esta execução ganhou. */
async function fetchReserva(leadId: string, coluna: string, quando: string): Promise<boolean> {
  const r = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/rest/v1/leads_adv?id=eq.${leadId}&${coluna}=is.null&select=id`,
    {
      method: 'PATCH',
      headers: {
        apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ [coluna]: quando }),
    },
  )
  if (!r.ok) throw new Error(`reserva: ${r.status} ${await r.text()}`)
  const linhas = await r.json() as unknown[]
  return linhas.length > 0
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
