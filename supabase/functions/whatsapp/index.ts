/**
 * A secretária de IA — recebe do WhatsApp, pensa, responde.
 *
 * Substitui, de uma vez, o que antes eram cinco peças fora do sistema:
 *   • Chatwoot ............ a caixa de entrada → `mensagens_whatsapp` + tela Conversas
 *   • n8n "1- Secretaria" . o agente           → este arquivo
 *   • n8n "3- CRM" ........ a ficha do lead    → ferramenta `atualizar_ficha`
 *   • Redis ............... juntar mensagens   → a espera de 12 s abaixo
 *   • Postgres Chat Memory  a memória          → `mensagens_whatsapp` + ficha
 *
 * Documentação: agente-ia/README.md
 *
 * AS ROTAS:
 *   POST /whatsapp                      webhook da ponte ativa (WEBHOOK_SEGREDO)
 *   POST /whatsapp/enviar               a equipe responde pela tela Conversas (sessão)
 *   GET  /whatsapp/prompt-oficial       o prompt publicado, para a tela mostrar (sessão)
 *   GET  /whatsapp/foto                 foto de perfil de um número (sessão)
 *   GET  /whatsapp/chaves-ia            quais fornecedores de IA têm chave (sessão)
 *   GET  /whatsapp/conexao              a conexão está de pé? (sessão)
 *   POST /whatsapp/conexao/conectar     abre pareamento, devolve código ou QR (admin)
 *   POST /whatsapp/conexao/desconectar  encerra a sessão do WhatsApp (admin)
 *   POST /whatsapp/apagar-pessoa        apaga TUDO de uma pessoa — LGPD (admin)
 *
 * PUBLICADA COM `--no-verify-jwt`: quem chama o webhook é a ponte, que não tem
 * sessão do Supabase. A autenticação de cada rota é feita aqui dentro.
 *
 * O WEBHOOK RESPONDE 200 NA HORA e faz o trabalho em segundo plano. A ponte
 * reenvia o que demora — e reenvio vira mensagem duplicada.
 */

import {
  rpc, selecionar, inserir, atualizar, subirMidia,
  apagar, listarMidias, apagarMidias,
} from '../_shared/db.ts'
import {
  conversar, transcrever, descreverImagem, chavesDeIA, type MensagemLLM,
} from '../_shared/llm.ts'
import { montarPrompt, montarFicha, type DadosDaPessoa } from '../_shared/prompt.ts'
import { PROMPT_OFICIAL } from '../_shared/prompt-oficial.ts'
import { ferramentasCom, executar, type Contexto } from '../_shared/ferramentas.ts'
import { ponteAtiva } from '../_shared/pontes.ts'
import { avaliarWebhook } from '../_shared/whatsapp.ts'
import type { MensagemRecebida, Ponte } from '../_shared/whatsapp.ts'

const SEGREDO = Deno.env.get('WEBHOOK_SEGREDO') ?? ''
const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!

/**
 * Quanto esperamos a pessoa terminar de escrever. O relógio reinicia a cada
 * mensagem dela: quem manda cinco seguidas recebe UMA resposta. Era o papel do
 * Redis no n8n.
 */
const ESPERA_MS = 12_000

/** Quando o "digitando…" acende, contado da última mensagem. */
const ESPERA_ATE_DIGITANDO_MS = 8_000

/** Teto de idas e voltas com as ferramentas numa mesma resposta. */
const MAX_VOLTAS = 6

/** Quantas mensagens da conversa vão para o modelo. A memória longa é a ficha. */
const HISTORICO = 50

const FUSO_PADRAO = 'America/Sao_Paulo'

interface Lead extends DadosDaPessoa {
  id: string
  agente_pausado: boolean
}

const CAMPOS_LEAD = 'id,nome_lead,agente_pausado,status,motivo_contato,resumo_conversa'

interface Mensagem {
  id: string
  autor: string
  tipo: string
  conteudo: string | null
  criada_em: string
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

/** A tela chama do navegador; sem isto o preflight barra antes de existir requisição. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-segredo',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  const rota = url.pathname.replace(/^.*\/whatsapp/, '').replace(/\/+$/, '')

  try {
    if (req.method === 'POST' && rota === '/enviar') return await rotaEnviar(req)
    if (req.method === 'GET' && rota === '/prompt-oficial') return await rotaPromptOficial(req)
    if (req.method === 'GET' && rota === '/foto') return await rotaFoto(req)
    if (req.method === 'GET' && rota === '/chaves-ia') return await rotaChavesIA(req)
    if (req.method === 'GET' && rota === '/conexao') return await rotaConexao(req)
    if (req.method === 'POST' && rota === '/conexao/conectar') return await rotaConectar(req)
    if (req.method === 'POST' && rota === '/conexao/desconectar') return await rotaDesconectar(req)
    if (req.method === 'POST' && rota === '/apagar-pessoa') return await rotaApagarPessoa(req)
    if (req.method === 'POST' && rota === '') return await rotaWebhook(req)
    return json({ ok: false, motivo: 'rota_desconhecida' }, 404)
  } catch (e) {
    console.error('erro na entrada:', e)
    return json({ ok: false, motivo: 'erro_interno' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Webhook da ponte ativa (Evolution ou uazapi — ver `_shared/whatsapp.ts`)
// ---------------------------------------------------------------------------

async function rotaWebhook(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const enviado = req.headers.get('x-webhook-segredo') ?? url.searchParams.get('segredo') ?? ''
  if (!SEGREDO || enviado !== SEGREDO) {
    return json({ ok: false, motivo: 'nao_autorizado' }, 401)
  }

  const corpo = await req.json().catch(() => null)
  if (!corpo) return json({ ok: true, ignorado: 'corpo_invalido' })

  // Só a ponte ATIVA lê. Se a outra continuar apontada para cá depois de uma
  // troca de provedor, o formato dela não é reconhecido e a mensagem é
  // descartada — responder mandaria a resposta pelo número errado.
  const ponte = await ponteAtiva()
  const lido = ponte.lerWebhook(corpo)

  if (lido.tipo === 'ignorar') {
    // Com motivo, sempre: o pior defeito deste tipo de sistema é o silêncio.
    console.log(`webhook ignorado (${ponte.nome}): ${lido.motivo}`)
    return json({ ok: true, ignorado: lido.motivo })
  }

  const recebida = lido.mensagem
  const lead = await acharOuCriarLead(recebida.whatsapp)

  const criadas = await inserir<{ id: string }>('mensagens_whatsapp', {
    lead_id: lead.id,
    autor: 'lead',
    tipo: recebida.tipo,
    conteudo: recebida.texto,
    id_externo: recebida.idExterno,
    lida: false,
  }, true)

  // Vazio = `id_externo` repetido: a ponte reenviou. Já tratamos.
  if (!criadas.length) return json({ ok: true, ignorado: 'duplicada' })

  const trabalho = processar(ponte, lead, criadas[0].id, recebida)
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
  if (typeof runtime?.waitUntil === 'function') {
    runtime.waitUntil(trabalho)
  } else {
    trabalho.catch((e) => console.error('processar:', e))
  }

  return json({ ok: true })
}

// ---------------------------------------------------------------------------
// O trabalho pesado
// ---------------------------------------------------------------------------

async function processar(
  ponte: Ponte,
  lead: Lead,
  mensagemId: string,
  recebida: MensagemRecebida,
): Promise<void> {
  const whatsapp = recebida.whatsapp

  // ---- Mídia: baixar, guardar e virar texto -------------------------------
  // Áudio pelo Whisper, imagem pelo descritor. As duas terminam como texto no
  // `conteudo` da mensagem: nada de imagem viaja daqui para a frente.
  if (recebida.midia) {
    const midia = await ponte.baixarMidia(recebida.midia)
    if (midia) {
      const bytes = Uint8Array.from(atob(midia.base64), (c) => c.charCodeAt(0))
      const extensao = (midia.tipoMime.split('/')[1] ?? 'bin').split(';')[0]
      const caminho = `${lead.id}/${mensagemId}.${extensao}`

      try {
        await subirMidia(caminho, bytes, midia.tipoMime)
        await atualizar('mensagens_whatsapp', `id=eq.${mensagemId}`, { midia_url: caminho })
      } catch (e) {
        console.error('storage:', e)
      }

      if (recebida.tipo === 'audio') {
        const texto = await transcrever(bytes, midia.tipoMime)
        await atualizar('mensagens_whatsapp', `id=eq.${mensagemId}`, {
          conteudo: texto ?? '[áudio que não consegui entender]',
        })
      } else if (recebida.tipo === 'imagem') {
        const descricao = await descreverImagem(midia.base64, midia.tipoMime)
        await atualizar('mensagens_whatsapp', `id=eq.${mensagemId}`, {
          conteudo: descricao ?? 'não consegui abrir esta imagem',
        })
      }
    } else {
      // O download falhou, e isso PRECISA virar texto: sem ele o modelo vê
      // "[imagem enviada]" e responde sobre uma imagem que nunca chegou.
      // ⚠️ As frases são contrato com o prompt.md, que tem resposta para cada uma.
      console.error(`midia nao baixada: ${recebida.tipo} de ${whatsapp}`)
      const aviso = recebida.tipo === 'audio'
        ? '[áudio que não consegui abrir]'
        : recebida.tipo === 'imagem'
        ? 'não consegui abrir esta imagem'
        : null
      if (aviso) await atualizar('mensagens_whatsapp', `id=eq.${mensagemId}`, { conteudo: aviso })
    }
  }

  // ---- A espera, em duas etapas ------------------------------------------
  // Cada mensagem acorda uma execução; ao acordar, cada uma pergunta se chegou
  // coisa mais nova. Se chegou, some calada — a mais nova responde por todas.
  const chegouEm = await criadaEm(mensagemId)

  await new Promise((r) => setTimeout(r, ESPERA_ATE_DIGITANDO_MS))
  if (await chegouMaisNova(lead.id, mensagemId, chegouEm)) return

  const resto = ESPERA_MS - ESPERA_ATE_DIGITANDO_MS
  await ponte.digitando(whatsapp, resto)
  await new Promise((r) => setTimeout(r, resto))
  if (await chegouMaisNova(lead.id, mensagemId, chegouEm)) return

  // ---- As duas travas ----------------------------------------------------
  // 1. A equipe assumiu a conversa na tela Conversas.
  // 2. Secretária desligada, ou em modo teste e este número não está na lista.
  const atual = await selecionar<Lead>(`leads_adv?select=${CAMPOS_LEAD}&id=eq.${lead.id}&limit=1`)
  if (atual[0]?.agente_pausado) return

  const podeResponder = await rpc<boolean | null>('agente_deve_responder', { p_whatsapp: whatsapp })
  if (podeResponder !== true) return

  // ---- Pensar ------------------------------------------------------------
  const [cfg, escritorio] = await Promise.all([
    selecionar<{ modelo: string; prompt: string | null; nome_agente: string }>(
      'configuracoes_agente?select=modelo,prompt,nome_agente&id=eq.1&limit=1',
    ),
    selecionar<{ fuso_horario: string | null }>('office_config?select=fuso_horario&id=eq.1&limit=1'),
  ])
  const fuso = escritorio[0]?.fuso_horario || FUSO_PADRAO

  // A ficha sai do lead RECÉM-LIDO: nos 12 s de espera ela pode ter mudado.
  const ficha = await montarFicha(lead.id, atual[0] ?? lead, fuso)
  const sistema = await montarPrompt(cfg[0]?.prompt, ficha, cfg[0]?.nome_agente)
  const mensagens = await montarHistorico(lead.id)
  const ctx: Contexto = { leadId: lead.id, whatsapp, fuso }

  // O catálogo entra no SCHEMA das ferramentas (`enum`), lido a cada mensagem.
  const catalogo = await selecionar<{ nome: string }>(
    'servicos_adv?select=nome&ativo=is.true&order=ordem,nome',
  )
  const ferramentas = ferramentasCom(catalogo.map((s) => s.nome))

  // CADA VOLTA PODE TRAZER FALA, e não só a última: o modelo fala E chama
  // ferramenta na mesma volta. Guardar só a fala final perderia o que ela
  // disse enquanto anotava a ficha.
  const pedacos: string[] = []
  for (let volta = 0; volta < MAX_VOLTAS; volta++) {
    const r = await conversar({
      modelo: cfg[0]?.modelo ?? 'gpt-4.1-mini',
      sistema,
      mensagens,
      ferramentas,
    })

    if (r.texto.trim()) pedacos.push(r.texto.trim())
    if (!r.chamadas.length) break

    mensagens.push({ papel: 'assistant', conteudo: r.texto, chamadas: r.chamadas })
    for (const c of r.chamadas) {
      const saida = await executar(c.nome, c.argumentos, ctx)
      mensagens.push({ papel: 'ferramenta', chamadaId: c.id, conteudo: JSON.stringify(saida) })
    }
  }

  const resposta = pedacos.join('\n\n')
  if (!resposta.trim()) return

  // ---- Falar -------------------------------------------------------------
  // O prompt pede 2 ou 3 mensagens curtas separadas por linha em branco. Aqui
  // elas viram mensagens de verdade. Era o nó "quebrar_mensagem" do n8n.
  const partes = resposta.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).slice(0, 4)

  for (const parte of partes) {
    // ~45 caracteres por segundo, entre 1,2 s e 5 s: resposta instantânea é o
    // que mais denuncia que não tem gente do outro lado.
    const pausa = Math.min(5000, Math.max(1200, parte.length * 22))
    await ponte.digitando(whatsapp, pausa)
    await new Promise((r) => setTimeout(r, pausa))

    let idExterno: string | null = null
    try {
      idExterno = await ponte.enviarTexto(whatsapp, parte)
    } catch (e) {
      console.error('envio:', e)
      break
    }

    await inserir('mensagens_whatsapp', {
      lead_id: lead.id,
      autor: 'agente',
      tipo: 'texto',
      conteudo: parte,
      id_externo: idExterno,
      lida: true,
    }, true)
  }

  // O lead saiu de "chegou" para "está conversando". Só avança a partir de
  // `novo_contato`: quem já está em outra etapa foi movido por outra coisa.
  try {
    await atualizar('leads_adv', `id=eq.${lead.id}&status=eq.novo_contato`, { status: 'conversando' })
  } catch (e) {
    console.error('status:', e)
  }
}

// ---------------------------------------------------------------------------
// Rotas da tela
// ---------------------------------------------------------------------------

interface Usuario {
  id: string
  admin: boolean
}

/** Confere a sessão do usuário. A função sobe com `--no-verify-jwt`. */
async function usuarioDaSessao(req: Request): Promise<Usuario | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const r = await fetch(`${URL_SUPABASE}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
  })
  if (!r.ok) return null
  const user = await r.json() as { id?: string }
  if (!user?.id) return null
  const papel = await selecionar<{ role: string }>(`usuarios?select=role&id=eq.${user.id}&limit=1`)
  return { id: user.id, admin: papel[0]?.role === 'admin' }
}

async function rotaPromptOficial(req: Request): Promise<Response> {
  if (!await usuarioDaSessao(req)) return json({ ok: false, motivo: 'sem_sessao' }, 401)
  return json({ ok: true, prompt: PROMPT_OFICIAL })
}

/**
 * Foto de perfil, para a tela Conversas. PRECISA passar pela função: a chave
 * da ponte é de servidor, e quem tem essa chave manda mensagem pelo WhatsApp
 * do escritório.
 */
async function rotaFoto(req: Request): Promise<Response> {
  if (!await usuarioDaSessao(req)) return json({ ok: false, motivo: 'sem_sessao' }, 401)
  const numero = (new URL(req.url).searchParams.get('whatsapp') ?? '').replace(/\D/g, '')
  if (!numero) return json({ ok: false, motivo: 'sem_numero' }, 400)
  return json({ ok: true, url: await (await ponteAtiva()).fotoDoPerfil(numero) })
}

/** SIM OU NÃO, nunca a chave. É o que permite a tela desligar modelo sem chave. */
async function rotaChavesIA(req: Request): Promise<Response> {
  if (!await usuarioDaSessao(req)) return json({ ok: false, motivo: 'sem_sessao' }, 401)
  return json({ ok: true, ...chavesDeIA() })
}

async function rotaConexao(req: Request): Promise<Response> {
  if (!await usuarioDaSessao(req)) return json({ ok: false, motivo: 'sem_sessao' }, 401)

  const ponte = await ponteAtiva()
  const [estado, config] = await Promise.all([ponte.estadoDaConexao(), ponte.webhook()])

  // Do webhook sai o VEREDITO, nunca a URL: ela carrega o segredo dentro.
  return json({
    ok: true,
    provedor: ponte.nome,
    ...ponte.identificacao(),
    ...estado,
    webhook: avaliarWebhook(config, `${URL_SUPABASE}/functions/v1/whatsapp`),
  })
}

async function rotaConectar(req: Request): Promise<Response> {
  const usuario = await usuarioDaSessao(req)
  if (!usuario) return json({ ok: false, motivo: 'sem_sessao' }, 401)
  if (!usuario.admin) return json({ ok: false, motivo: 'somente_admin' }, 403)

  const ponte = await ponteAtiva()
  if (!ponte.configurada()) return json({ ok: false, motivo: 'nao_configurado' }, 400)

  const corpo = await req.json().catch(() => ({})) as { numero?: string }
  const r = await ponte.iniciarConexao(corpo.numero)
  if (!r) return json({ ok: false, motivo: 'servidor_fora' }, 502)
  return json({ ok: true, ...r })
}

async function rotaDesconectar(req: Request): Promise<Response> {
  const usuario = await usuarioDaSessao(req)
  if (!usuario) return json({ ok: false, motivo: 'sem_sessao' }, 401)
  if (!usuario.admin) return json({ ok: false, motivo: 'somente_admin' }, 403)

  const ponte = await ponteAtiva()
  if (!ponte.configurada()) return json({ ok: false, motivo: 'nao_configurado' }, 400)
  return (await ponte.desconectar())
    ? json({ ok: true })
    : json({ ok: false, motivo: 'servidor_fora' }, 502)
}

/**
 * Apaga TUDO de uma pessoa: ficha, conversa, consultas e arquivos.
 *
 * ⚠️ NÃO TEM VOLTA. É o direito ao esquecimento da LGPD. Só admin.
 *
 * Não mora no navegador porque os ARQUIVOS só saem pela Storage API, com a
 * service_role — o Postgres recusa `delete from storage.objects`. E a ordem
 * importa: mídia primeiro (a pasta é o id do lead), ficha depois.
 */
async function rotaApagarPessoa(req: Request): Promise<Response> {
  const usuario = await usuarioDaSessao(req)
  if (!usuario) return json({ ok: false, motivo: 'sem_sessao' }, 401)
  if (!usuario.admin) return json({ ok: false, motivo: 'somente_admin' }, 403)

  const corpo = await req.json().catch(() => ({})) as { lead_id?: string }
  const leadId = String(corpo.lead_id ?? '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) return json({ ok: false, motivo: 'lead_invalido' }, 400)

  const pessoa = await selecionar<{ id: string }>(`leads_adv?select=id&id=eq.${leadId}&limit=1`)
  if (!pessoa.length) return json({ ok: false, motivo: 'nao_encontrada' }, 404)

  let midias = 0
  try {
    midias = await apagarMidias(await listarMidias(leadId))
  } catch (e) {
    console.error('apagar midias:', e)
    return json({ ok: false, motivo: 'falha_na_midia' }, 500)
  }

  // O CASCADE leva mensagens, consultas e o registro de cliente junto.
  await apagar('leads_adv', `id=eq.${leadId}`)

  console.log(`pessoa apagada: ${leadId} por ${usuario.id} (${midias} arquivo(s))`)
  return json({ ok: true, midias })
}

/** A equipe responde pela tela Conversas, pelo mesmo WhatsApp. */
async function rotaEnviar(req: Request): Promise<Response> {
  const usuario = await usuarioDaSessao(req)
  if (!usuario) return json({ ok: false, motivo: 'sem_sessao' }, 401)

  const corpo = await req.json().catch(() => ({})) as { lead_id?: string; texto?: string }
  const leadId = String(corpo.lead_id ?? '')
  const texto = String(corpo.texto ?? '').trim()
  if (!leadId || !texto) return json({ ok: false, motivo: 'dados_invalidos' }, 400)

  const leads = await selecionar<{ whatsapp_lead: string | null }>(
    `leads_adv?select=whatsapp_lead&id=eq.${leadId}&limit=1`,
  )
  const whatsapp = leads[0]?.whatsapp_lead
  if (!whatsapp) return json({ ok: false, motivo: 'lead_sem_whatsapp' }, 400)

  let idExterno: string | null
  try {
    idExterno = await (await ponteAtiva()).enviarTexto(whatsapp, texto)
  } catch (e) {
    console.error('envio manual:', e)
    return json({ ok: false, motivo: 'whatsapp_fora' }, 502)
  }

  await inserir('mensagens_whatsapp', {
    lead_id: leadId,
    autor: 'atendente',
    tipo: 'texto',
    conteudo: texto,
    id_externo: idExterno,
    enviada_por: usuario.id,
    lida: true,
  }, true)

  return json({ ok: true })
}

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------

/** Chegou mensagem DO LEAD depois desta? (A resposta da secretária não conta.) */
async function chegouMaisNova(leadId: string, mensagemId: string, desde: string): Promise<boolean> {
  const posteriores = await selecionar<{ id: string }>(
    `mensagens_whatsapp?select=id&lead_id=eq.${leadId}&autor=eq.lead` +
    `&id=neq.${mensagemId}&criada_em=gt.${encodeURIComponent(desde)}&limit=1`,
  )
  return posteriores.length > 0
}

async function criadaEm(mensagemId: string): Promise<string> {
  const linhas = await selecionar<{ criada_em: string }>(
    `mensagens_whatsapp?select=criada_em&id=eq.${mensagemId}&limit=1`,
  )
  return linhas[0]?.criada_em ?? new Date(0).toISOString()
}

/**
 * O lead nasce SEM NOME, sempre.
 *
 * As pontes mandam o nome do perfil do WhatsApp, e é tentador aproveitar. Não
 * aproveite: o perfil é o apelido que a pessoa escolheu ("Casa", "Mãe ❤️"), e
 * com a ficha preenchida a secretária nunca perguntaria o nome de verdade. O
 * nome vem da conversa, pela ferramenta `atualizar_ficha`.
 */
async function acharOuCriarLead(whatsapp: string): Promise<Lead> {
  const achados = await selecionar<Lead>(`leads_adv?select=${CAMPOS_LEAD}&whatsapp_lead=eq.${whatsapp}&limit=1`)
  if (achados.length) return achados[0]

  const criados = await inserir<Lead>('leads_adv', {
    whatsapp_lead: whatsapp,
    status: 'novo_contato',
  }, true)
  if (criados.length) return criados[0]

  // Corrida: outra execução criou entre o select e o insert.
  const denovo = await selecionar<Lead>(`leads_adv?select=${CAMPOS_LEAD}&whatsapp_lead=eq.${whatsapp}&limit=1`)
  return denovo[0]
}

/** A conversa como o modelo vê — texto puro, do começo ao fim. */
async function montarHistorico(leadId: string): Promise<MensagemLLM[]> {
  const linhas = await selecionar<Mensagem>(
    `mensagens_whatsapp?select=id,autor,tipo,conteudo,criada_em&lead_id=eq.${leadId}` +
    `&order=criada_em.desc&limit=${HISTORICO}`,
  )
  linhas.reverse()

  const saida: MensagemLLM[] = []
  for (const l of linhas) {
    const rotulo = l.tipo === 'audio'
      ? (l.conteudo ?? '[áudio]')
      : l.tipo === 'imagem'
      ? (l.conteudo ? `[imagem enviada] ${l.conteudo}` : '[imagem enviada]')
      : l.tipo === 'video'
      ? '[vídeo enviado]'
      : l.tipo === 'documento'
      ? '[arquivo enviado]'
      : (l.conteudo ?? '')
    if (!rotulo.trim()) continue

    // O que a equipe escreveu entra como fala da própria secretária: para o
    // cliente foi o mesmo número, e ela precisa saber o que "disse".
    saida.push({ papel: l.autor === 'lead' ? 'user' : 'assistant', conteudo: rotulo })
  }

  return saida.length ? saida : [{ papel: 'user', conteudo: 'oi' }]
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
