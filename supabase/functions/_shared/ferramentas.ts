/**
 * As ferramentas da secretária.
 *
 * Substituem as "tools" do n8n: `Agendar` (que chamava outro workflow, que
 * chamava o Google Calendar) e `sobreEscritorio` (que chamava outro agente,
 * que lia uma planilha do Google Sheets). Aqui cada ferramenta é uma consulta
 * ou uma função SQL — a mesma regra de agenda que a tela usa (migração 0003).
 *
 * DUAS COISAS QUE O MODELO NÃO PREENCHE, de propósito:
 *
 *   1. O WhatsApp e o id do lead — vêm do contexto da conversa. Se fossem
 *      parâmetro, um dia ele marcaria consulta para um número inventado.
 *   2. O uuid do advogado — o modelo trabalha com NOME, e o código resolve.
 *      Uuid em prompt é convite para alucinação.
 */

import { rpc, selecionar, atualizar } from './db.ts'
import { paraInstante } from './tempo.ts'
import type { DefinicaoFerramenta } from './llm.ts'

export interface Contexto {
  leadId: string
  whatsapp: string
  fuso: string
}

/**
 * A lista de ferramentas, com o catálogo de serviços **dentro do schema**.
 *
 * `enum` no JSON Schema não é um pedido como "use o nome exato": os dois
 * fornecedores restringem a saída aos valores da lista. É o que faz o
 * `motivo_contato` e o `servico` da consulta serem sempre um nome do catálogo —
 * e o Dashboard conseguir contar "quantos procuraram Divórcio".
 *
 * A lista é montada a cada mensagem, com os serviços ATIVOS: desligar um
 * serviço em Configurações tira ele da boca dela na mensagem seguinte.
 */
export function ferramentasCom(servicos: string[]): DefinicaoFerramenta[] {
  // Sem catálogo (falha de leitura), volta ao texto livre em vez de travar a
  // secretária: `enum` vazio é recusado pelos dois fornecedores.
  const lista = servicos.filter((s) => s.trim())
  const doCatalogo = lista.length ? { type: 'string', enum: lista } : { type: 'string' }

  return FERRAMENTAS.map((f) => {
    const props = f.parametros.properties as Record<string, { description?: string }> | undefined
    if (!props) return f
    const novas: Record<string, unknown> = { ...props }
    let mudou = false
    for (const campo of ['servico', 'motivo_contato']) {
      if (campo in novas) {
        novas[campo] = { ...doCatalogo, description: props[campo].description }
        mudou = true
      }
    }
    return mudou ? { ...f, parametros: { ...f.parametros, properties: novas } } : f
  })
}

const FERRAMENTAS: DefinicaoFerramenta[] = [
  {
    nome: 'ver_horarios_livres',
    descricao:
      'Consulta os horários realmente livres na agenda dos advogados. Use ' +
      'sempre que o cliente falar de dia, horário ou perguntar se tem vaga. ' +
      'Nunca confirme um horário sem chamar isto antes.',
    parametros: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Dia desejado, no formato AAAA-MM-DD.' },
        hora: {
          type: 'string',
          description: 'Hora específica, HH:MM. Só envie se o cliente disse uma hora.',
        },
        advogado: {
          type: 'string',
          description: 'Nome do advogado. Só envie se o cliente pediu alguém específico.',
        },
      },
      required: ['data'],
      additionalProperties: false,
    },
  },
  {
    nome: 'marcar_consulta',
    descricao:
      'Marca a consulta de verdade na agenda. Só chame depois de confirmar o ' +
      'horário com ver_horarios_livres E de ter o nome completo, o serviço e ' +
      'se a consulta é presencial ou online.',
    parametros: {
      type: 'object',
      properties: {
        nome_completo: { type: 'string', description: 'O nome completo que o cliente informou.' },
        servico: { type: 'string', description: 'O assunto do caso, como está na lista de serviços.' },
        modalidade: {
          type: 'string',
          enum: ['presencial', 'online'],
          description: 'Como o cliente prefere a consulta.',
        },
        data_hora: { type: 'string', description: 'AAAA-MM-DDTHH:MM, no horário do escritório.' },
        advogado: {
          type: 'string',
          description: 'Nome do advogado. Deixe vazio para o sistema escolher quem está livre.',
        },
      },
      required: ['nome_completo', 'servico', 'modalidade', 'data_hora'],
      additionalProperties: false,
    },
  },
  {
    nome: 'ver_minhas_consultas',
    descricao:
      'Lista as consultas já marcadas deste cliente. Use quando ele perguntar ' +
      'quando é a consulta, ou antes de remarcar/cancelar se ele tiver mais de uma.',
    parametros: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    nome: 'remarcar_consulta',
    descricao:
      'Muda uma consulta existente: dia, horário, advogado, ou tudo de uma ' +
      'vez. Quando o cliente só tem uma consulta marcada, não precisa do ' +
      'consulta_id. Mande pelo menos um de nova_data_hora ou advogado.',
    parametros: {
      type: 'object',
      properties: {
        consulta_id: {
          type: 'string',
          description: 'Só quando ele tiver MAIS DE UMA marcada. Vem de ver_minhas_consultas.',
        },
        nova_data_hora: {
          type: 'string',
          description:
            'AAAA-MM-DDTHH:MM. Só envie se o cliente pediu outro dia ou horário — ' +
            'se ele só quer trocar de advogado, deixe vazio.',
        },
        advogado: {
          type: 'string',
          description: 'Nome do novo advogado. Só envie se o cliente pediu para trocar.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    nome: 'cancelar_consulta',
    descricao:
      'Desmarca uma consulta. Antes de chamar, pergunte se o cliente prefere ' +
      'remarcar. Quando ele só tem uma marcada, não precisa do consulta_id.',
    parametros: {
      type: 'object',
      properties: {
        consulta_id: {
          type: 'string',
          description: 'Só quando ele tiver MAIS DE UMA marcada. Vem de ver_minhas_consultas.',
        },
        motivo: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    nome: 'sobre_o_servico',
    descricao:
      'Traz a descrição completa de UM serviço do escritório: o que é, como o ' +
      'escritório atua e o que a consulta resolve. Use sempre que o cliente ' +
      'mencionar um assunto, quiser saber mais, ou trouxer uma objeção.',
    parametros: {
      type: 'object',
      properties: {
        servico: { type: 'string', description: 'O serviço, como está na lista.' },
      },
      required: ['servico'],
      additionalProperties: false,
    },
  },
  {
    nome: 'atualizar_ficha',
    descricao:
      'Guarda o que você descobriu na conversa. Use assim que souber de algo ' +
      'novo, sem esperar o fim do atendimento.',
    parametros: {
      type: 'object',
      properties: {
        nome: {
          type: 'string',
          description:
            'O nome que o CLIENTE disse. Nunca um rótulo como "cliente" ou ' +
            '"lead" — sem o nome dito, não mande este campo.',
        },
        motivo_contato: {
          type: 'string',
          description: 'O serviço que melhor descreve o caso, como está na lista.',
        },
        resumo: {
          type: 'string',
          description:
            'A história do atendimento em TEXTO CORRIDO, na ordem em que as ' +
            'coisas aconteceram — um parágrafo, nunca lista. Fale do cliente na ' +
            'terceira pessoa, pelo nome assim que souber. Conte o que ele busca ' +
            'resolver, a situação que contou, a urgência, o que perguntou e em ' +
            'que pé ficou. Reescreva o texto inteiro a cada vez.',
        },
      },
      additionalProperties: false,
    },
  },
]

// ---------------------------------------------------------------------------

function hora(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

function dataHora(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, weekday: 'long', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

/**
 * Isto é um rótulo, e não o nome de uma pessoa.
 *
 * Gravado "cliente", a ficha passa a parecer preenchida: a secretária lê "já
 * sei o nome" e nunca mais pergunta. A lista veta o que é claramente espaço
 * reservado e deixa passar qualquer coisa que pareça nome.
 */
const NOMES_GENERICOS = new Set([
  'cliente', 'lead', 'contato', 'usuario', 'usuário', 'pessoa', 'nome',
  'sem nome', 'não informado', 'nao informado', 'desconhecido',
  'anonimo', 'anônimo', 'n/a', 'na', '-',
])

function ehNomeGenerico(nome: string): boolean {
  const limpo = nome.trim().toLowerCase().replace(/\s+/g, ' ')
  // `�` é texto já estragado por codificação errada. Recusar faz a ficha
  // voltar a ficar vazia — e vazia ela pergunta de novo.
  if (limpo.includes('�')) return true
  // Só dígitos também não é nome: é o telefone voltando pela porta dos fundos.
  return NOMES_GENERICOS.has(limpo) || /^[\d\s()+-]+$/.test(limpo)
}

/** O resumo como texto corrido, mesmo quando o modelo entregou uma lista. */
function arrumarResumo(bruto: string): string {
  const texto = bruto.trim()
  if (!texto) return ''
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
  if (linhas.filter((l) => /^[-*•]\s+/.test(l)).length < 2) return texto
  return linhas
    .map((l) => l.replace(/^[-*•]\s+/, ''))
    .map((l) => (/[.!?]$/.test(l) ? l : l + '.'))
    .join(' ')
}

/**
 * Um campo do catálogo, sempre um nome só.
 *
 * As ferramentas vão sem `strict: true`, então o `enum` é forte mas não é
 * trava: para "divórcio e guarda" o modelo pode mandar os dois num array, e
 * `String(['A','B'])` vira "A,B" — um nome que não existe. Fica o primeiro.
 */
function umNomeSo(v: unknown): string {
  const bruto = Array.isArray(v) ? v[0] : v
  return typeof bruto === 'string' ? bruto.trim() : ''
}

/** Nome dito pelo cliente → uuid do advogado. Nulo se não achar. */
async function acharAdvogado(nome?: unknown): Promise<string | null> {
  if (typeof nome !== 'string' || !nome.trim()) return null
  // "Dr. Carlos", "dra Ana" → procura pelo primeiro nome de verdade.
  const palavras = nome.trim().split(/\s+/).filter((p) => !/^dra?\.?$/i.test(p))
  if (!palavras.length) return null
  const busca = encodeURIComponent(`%${palavras[0]}%`)
  const achados = await selecionar<{ id: string }>(
    `advogados?select=id&ativo=is.true&nome=ilike.${busca}&limit=1`,
  )
  return achados[0]?.id ?? null
}

const RECUSAS: Record<string, string> = {
  horario_ocupado: 'Esse horário já está ocupado.',
  sem_advogado_livre: 'Nenhum advogado está livre nesse dia e horário.',
  fora_da_jornada: 'O advogado não atende nesse dia e horário.',
  advogado_inexistente: 'Esse advogado não foi encontrado.',
  data_invalida: 'A data não foi entendida.',
  data_passada: 'Esse horário já passou.',
  servico_desconhecido:
    'Esse serviço não está na lista do escritório. Use um dos nomes da lista ' +
    'de SERVIÇOS, exatamente como está escrito.',
  modalidade_invalida: 'A consulta precisa ser presencial ou online.',
  nao_encontrada: 'Essa consulta não foi encontrada.',
  sem_consulta: 'Este cliente não tem consulta marcada.',
  varias_consultas: 'Ele tem mais de uma consulta marcada — pergunte qual.',
  lead_inexistente: 'Não encontrei a ficha deste contato.',
}

function ehUuid(v: unknown): boolean {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())
}

interface ConsultaAtiva {
  id: string
  data_hora_inicio: string
  servico: string | null
  modalidade: string
}

/**
 * Qual consulta remarcar ou cancelar, quando o modelo não tem o id na mão.
 *
 * O modelo não guarda resultado de ferramenta entre uma mensagem e outra: o
 * histórico é reconstruído só com os balões de texto. Exigir o id faria a
 * remarcação falhar na mensagem seguinte ao "pode ser". Como o dono da consulta
 * já é o lead do contexto, e quase sempre há uma só, o id é dispensável.
 */
async function consultaAlvo(
  ctx: Contexto,
  idBruto: unknown,
): Promise<ConsultaAtiva | { erro: string; consultas?: unknown[] }> {
  const filtro = `lead_id=eq.${ctx.leadId}&status=in.(agendado,confirmado)`
  if (ehUuid(idBruto)) {
    const achada = await selecionar<ConsultaAtiva>(
      `agendamentos_adv?select=id,data_hora_inicio,servico,modalidade&${filtro}` +
      `&id=eq.${String(idBruto).trim()}&limit=1`,
    )
    return achada[0] ?? { erro: 'nao_encontrada' }
  }

  const linhas = await selecionar<ConsultaAtiva>(
    `agendamentos_adv?select=id,data_hora_inicio,servico,modalidade&${filtro}` +
    `&data_hora_inicio=gt.${encodeURIComponent(new Date().toISOString())}` +
    `&order=data_hora_inicio.asc&limit=10`,
  )
  if (!linhas.length) return { erro: 'sem_consulta' }
  if (linhas.length === 1) return linhas[0]
  return {
    erro: 'varias_consultas',
    consultas: linhas.map((c) => ({
      consulta_id: c.id,
      servico: c.servico,
      quando: dataHora(c.data_hora_inicio, ctx.fuso),
    })),
  }
}

// ---------------------------------------------------------------------------

/**
 * Executa uma ferramenta e devolve o que o modelo vai ler.
 *
 * Sempre devolve objeto com `ok`. Recusa de negócio NÃO é exceção — "horário
 * ocupado" é resposta, e o modelo precisa dela para dar a notícia ao cliente.
 */
export async function executar(
  nome: string,
  args: Record<string, unknown>,
  ctx: Contexto,
): Promise<Record<string, unknown>> {
  try {
    switch (nome) {
      case 'ver_horarios_livres': {
        const data = String(args.data ?? '').slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
          return { ok: false, motivo: 'data_invalida', mensagem: RECUSAS.data_invalida }
        }
        const advogado = await acharAdvogado(args.advogado)

        const slots = await rpc<{ horario: string }[]>('agenda_horarios_disponiveis', {
          p_data: data,
          p_advogado: advogado,
        })
        const horarios = slots.map((s) => hora(s.horario, ctx.fuso))

        if (!horarios.length) {
          const proxima = await rpc<string | null>('agenda_proxima_vaga', {
            p_a_partir_de: data,
            p_advogado: advogado,
          })
          return { ok: true, data, horarios: [], proxima_vaga: proxima ? dataHora(proxima, ctx.fuso) : null }
        }

        const pedida = typeof args.hora === 'string' ? args.hora.slice(0, 5) : null
        return {
          ok: true,
          data,
          ...(pedida ? { hora_pedida: pedida, disponivel: horarios.includes(pedida) } : {}),
          horarios,
        }
      }

      case 'marcar_consulta': {
        // O modelo manda hora local ("2026-10-26T14:00"), sem fuso. Ver tempo.ts.
        const quando = paraInstante(String(args.data_hora ?? ''), ctx.fuso)
        if (!quando) return { ok: false, motivo: 'data_invalida', mensagem: RECUSAS.data_invalida }

        const advogado = await acharAdvogado(args.advogado)
        const linhas = await rpc<{
          ok: boolean; motivo: string | null; agendamento_id: string | null
          data_hora: string | null; advogado: string | null; link_reuniao: string | null
        }[]>('agenda_marcar', {
          p_lead_id: ctx.leadId,
          p_nome: String(args.nome_completo ?? '').trim(),
          p_servico: umNomeSo(args.servico) || null,
          p_modalidade: umNomeSo(args.modalidade) || 'presencial',
          p_data_hora: quando.toISOString(),
          p_advogado_id: advogado,
          // Idempotência: a chave é o INSTANTE, não o texto do modelo.
          p_chave: `wa_${ctx.leadId}_${quando.toISOString()}`,
        })
        const r = linhas[0]

        if (r?.motivo === 'ja_tem_consulta') {
          return {
            ok: false,
            motivo: 'ja_tem_consulta',
            mensagem:
              `Este cliente já tem consulta marcada para ${dataHora(r.data_hora!, ctx.fuso)}. ` +
              'Se ele quer outro horário, use remarcar_consulta.',
          }
        }
        if (!r?.ok) {
          return { ok: false, motivo: r?.motivo, mensagem: RECUSAS[r?.motivo ?? ''] ?? 'Não consegui marcar.' }
        }
        return {
          ok: true,
          quando: dataHora(r.data_hora!, ctx.fuso),
          advogado: r.advogado,
          modalidade: args.modalidade,
          link_reuniao: r.link_reuniao,
        }
      }

      case 'ver_minhas_consultas': {
        const linhas = await selecionar<ConsultaAtiva & { advogado: { nome: string } | null }>(
          `agendamentos_adv?select=id,data_hora_inicio,servico,modalidade,advogado:advogados(nome)` +
          `&lead_id=eq.${ctx.leadId}&status=in.(agendado,confirmado)` +
          `&data_hora_inicio=gt.${encodeURIComponent(new Date().toISOString())}` +
          `&order=data_hora_inicio.asc&limit=10`,
        )
        return {
          ok: true,
          consultas: linhas.map((c) => ({
            consulta_id: c.id,
            servico: c.servico,
            modalidade: c.modalidade,
            advogado: c.advogado?.nome ?? null,
            quando: dataHora(c.data_hora_inicio, ctx.fuso),
          })),
        }
      }

      case 'remarcar_consulta': {
        const alvo = await consultaAlvo(ctx, args.consulta_id)
        if ('erro' in alvo) {
          return {
            ok: false, motivo: alvo.erro, mensagem: RECUSAS[alvo.erro],
            ...(alvo.consultas ? { consultas: alvo.consultas } : {}),
          }
        }

        const pedida = typeof args.nova_data_hora === 'string' ? args.nova_data_hora.trim() : ''
        const quando = pedida ? paraInstante(pedida, ctx.fuso) : new Date(alvo.data_hora_inicio)
        if (!quando) return { ok: false, motivo: 'data_invalida', mensagem: RECUSAS.data_invalida }

        const advogado = await acharAdvogado(args.advogado)
        if (!pedida && !advogado) {
          return {
            ok: false, motivo: 'dados_invalidos',
            mensagem: 'Diga o que mudar: o horário, o advogado, ou os dois.',
          }
        }

        const linhas = await rpc<{
          ok: boolean; motivo: string | null; data_hora: string | null
          advogado: string | null; link_reuniao: string | null
        }[]>('agenda_remarcar', {
          p_agendamento_id: alvo.id,
          p_lead_id: ctx.leadId,
          p_nova_data_hora: quando.toISOString(),
          p_advogado_id: advogado,
        })
        const r = linhas[0]
        if (!r?.ok) {
          return { ok: false, motivo: r?.motivo, mensagem: RECUSAS[r?.motivo ?? ''] ?? 'Não consegui remarcar.' }
        }
        return {
          ok: true,
          quando: dataHora(r.data_hora!, ctx.fuso),
          advogado: r.advogado,
          link_reuniao: r.link_reuniao,
        }
      }

      case 'cancelar_consulta': {
        const alvo = await consultaAlvo(ctx, args.consulta_id)
        if ('erro' in alvo) {
          return {
            ok: false, motivo: alvo.erro, mensagem: RECUSAS[alvo.erro],
            ...(alvo.consultas ? { consultas: alvo.consultas } : {}),
          }
        }
        const linhas = await rpc<{ ok: boolean; motivo: string | null; data_hora: string | null }[]>(
          'agenda_cancelar',
          {
            p_agendamento_id: alvo.id,
            p_lead_id: ctx.leadId,
            p_motivo: typeof args.motivo === 'string' ? args.motivo : null,
          },
        )
        const r = linhas[0]
        if (!r?.ok) {
          return { ok: false, motivo: r?.motivo, mensagem: RECUSAS[r?.motivo ?? ''] ?? 'Não consegui cancelar.' }
        }
        return { ok: true, cancelada: r.data_hora ? dataHora(r.data_hora, ctx.fuso) : null }
      }

      case 'sobre_o_servico': {
        const pedido = umNomeSo(args.servico)
        if (!pedido) return { ok: false, mensagem: 'Preciso saber qual serviço.' }
        const busca = encodeURIComponent(`%${pedido}%`)
        const achados = await selecionar<{ nome: string; categoria: string; descricao: string | null }>(
          `servicos_adv?select=nome,categoria,descricao&ativo=is.true&nome=ilike.${busca}&limit=1`,
        )
        if (!achados.length) {
          return { ok: false, motivo: 'nao_encontrado', mensagem: 'O escritório não atua com esse assunto.' }
        }
        const s = achados[0]
        return { ok: true, servico: s.nome, area: s.categoria, detalhes: s.descricao ?? '' }
      }

      case 'atualizar_ficha': {
        const campos: Record<string, unknown> = {}
        const nome = String(args.nome ?? '').trim()
        if (nome && !ehNomeGenerico(nome)) campos.nome_lead = nome.slice(0, 120)
        const motivo = umNomeSo(args.motivo_contato)
        if (motivo) campos.motivo_contato = motivo.slice(0, 200)
        const resumo = arrumarResumo(String(args.resumo ?? ''))
        if (resumo) campos.resumo_conversa = resumo.slice(0, 2000)
        if (!Object.keys(campos).length) return { ok: true, nada_a_fazer: true }

        await atualizar('leads_adv', `id=eq.${ctx.leadId}`, campos)
        return { ok: true }
      }

      default:
        return { ok: false, mensagem: 'Ferramenta desconhecida.' }
    }
  } catch (e) {
    // Falha técnica nunca vai crua para o cliente: o modelo recebe uma frase
    // neutra e o detalhe fica no log.
    console.error(`ferramenta ${nome}:`, e)
    return { ok: false, mensagem: 'Não consegui acessar a agenda agora.' }
  }
}
