/**
 * Monta o prompt do momento.
 *
 * O prompt não é um texto fixo: seis trechos são preenchidos a cada mensagem,
 * lendo o banco na hora. No n8n o endereço, o Instagram e os horários estavam
 * escritos à mão dentro do prompt — trocar o endereço exigia editar o workflow.
 * Aqui é Configurações → salvar → a próxima resposta já sai certa.
 *
 * Os marcadores vivem em agente-ia/prompt.md. Mexeu num nome lá, mexa aqui —
 * marcador sem substituição vai cru para o modelo.
 *
 * ⚠️ A ORDEM DENTRO DO PROMPT NÃO É ESTÉTICA. O que é igual para todo mundo
 * vem primeiro; o que muda a cada conversa e a cada minuto (a data e a ficha)
 * vem por último. O cache de prompt reaproveita o PREFIXO comum entre chamadas.
 */

import { selecionar } from './db.ts'
import { PROMPT_OFICIAL } from './prompt-oficial.ts'

const NOME_PADRAO = 'Camila'

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const DIAS_FALADOS: Record<string, string> = {
  domingo: 'domingo', segunda: 'segunda', terca: 'terça', quarta: 'quarta',
  quinta: 'quinta', sexta: 'sexta', sabado: 'sábado',
}

interface Horario {
  dia: string
  aberto: boolean
  hora_inicio: string | null
  hora_fim: string | null
}

interface OfficeConfig {
  nome: string
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
}

/** "segunda a sexta, 09:00–18:00; sábado, 09:00–12:00" */
export function horariosEmTexto(linhas: Horario[]): string {
  const abertos = DIAS
    .map((d) => linhas.find((l) => l.dia === d))
    .filter((l): l is Horario => !!l && l.aberto && !!l.hora_inicio && !!l.hora_fim)
  if (!abertos.length) return 'sem horário cadastrado'

  const faixa = (l: Horario) => `${l.hora_inicio!.slice(0, 5)}–${l.hora_fim!.slice(0, 5)}`
  const grupos: { dias: string[]; faixa: string }[] = []
  for (const l of abertos) {
    const ultimo = grupos[grupos.length - 1]
    const anterior = ultimo ? DIAS.indexOf(ultimo.dias[ultimo.dias.length - 1]) : -2
    if (ultimo && ultimo.faixa === faixa(l) && DIAS.indexOf(l.dia) === anterior + 1) {
      ultimo.dias.push(l.dia)
    } else {
      grupos.push({ dias: [l.dia], faixa: faixa(l) })
    }
  }
  return grupos
    .map((g) => {
      const nomes = g.dias.map((d) => DIAS_FALADOS[d])
      const dias = nomes.length > 2 ? `${nomes[0]} a ${nomes[nomes.length - 1]}` : nomes.join(' e ')
      return `${dias}, ${g.faixa}`
    })
    .join('; ')
}

/** "Hoje é segunda-feira, 20/10/2026, e agora são 09:14." — no fuso do escritório. */
function frescoDaData(fuso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
  return `Hoje é ${p('weekday')}, ${p('day')}/${p('month')}/${p('year')}, e agora são ${p('hour')}:${p('minute')}.`
}

/** `quinta-feira, 04/09, às 10:00` */
function quando(iso: string, fuso: string): string {
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso, weekday: 'long', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${v('weekday')}, ${v('day')}/${v('month')}, às ${v('hour')}:${v('minute')}`
}

/** Linha vazia não vira linha: "Instagram: " pelado faria ela inventar um. */
function linhaSe(rotulo: string, valor: string | null | undefined): string | null {
  return valor && valor.trim() ? `${rotulo}: ${valor.trim()}` : null
}

export async function lerEscritorio(): Promise<OfficeConfig | null> {
  const cfg = await selecionar<OfficeConfig>(
    'office_config?select=nome,endereco,cidade,uf,link_maps,instagram,site,areas_atuacao,' +
    'fuso_horario,duracao_consulta_min,consulta_gratuita&id=eq.1&limit=1',
  )
  return cfg[0] ?? null
}

export interface DadosDaPessoa {
  nome_lead: string | null
  status: string
  motivo_contato: string | null
  resumo_conversa: string | null
}

/**
 * A ficha de quem está falando — o que a secretária precisa saber ANTES da
 * primeira palavra. Substitui a "memória" do n8n (Postgres Chat Memory), que
 * lembrava as últimas mensagens mas não sabia se a pessoa já tinha consulta.
 *
 * A consulta já marcada é o que mais importa aqui: oferecer agendamento a quem
 * já tem hora na quinta é o erro mais constrangedor que ela pode cometer. Por
 * isso a instrução viaja COLADA no dado — a ficha é a última coisa que o modelo
 * lê, e uma regra perto do dado vale mais que a mesma regra dez seções acima.
 */
export async function montarFicha(
  leadId: string,
  pessoa: DadosDaPessoa,
  fuso: string,
): Promise<string> {
  const consultas = await selecionar<{
    data_hora_inicio: string; status: string; servico: string | null; modalidade: string
    link_reuniao: string | null; advogado: { nome: string } | null
  }>(
    `agendamentos_adv?select=data_hora_inicio,status,servico,modalidade,link_reuniao,advogado:advogados(nome)` +
    `&lead_id=eq.${leadId}&order=data_hora_inicio.desc&limit=30`,
  )

  const agora = Date.now()
  const proxima = consultas
    .filter((c) => ['agendado', 'confirmado'].includes(c.status) && new Date(c.data_hora_inicio).getTime() > agora)
    .sort((a, b) => a.data_hora_inicio.localeCompare(b.data_hora_inicio))[0]
  const realizadas = consultas.filter((c) => c.status === 'compareceu')

  const linhas: string[] = []

  if (pessoa.nome_lead?.trim()) {
    linhas.push(`Nome: ${pessoa.nome_lead.trim()}`)
  } else {
    // Se aquela resposta não gravou o nome, nada mais volta ao assunto — o nome
    // fica escrito na conversa e nunca entra na ficha. A ordem viaja colada à
    // ausência do dado.
    linhas.push(
      'Nome: ainda não sei. Se ele JÁ disse o nome em qualquer ponto da conversa, ' +
      'grave agora com atualizar_ficha. Se não disse, pergunte antes de qualquer outra coisa.',
    )
  }

  if (pessoa.status === 'fechado') {
    linhas.push('Situação: já é cliente do escritório, com contrato fechado.')
  } else if (realizadas.length) {
    linhas.push('Situação: já esteve em consulta com o escritório, não é o primeiro contato.')
  }

  if (pessoa.motivo_contato?.trim()) linhas.push(`Assunto: ${pessoa.motivo_contato.trim()}`)
  if (pessoa.resumo_conversa?.trim()) linhas.push(`Do que já falaram: ${pessoa.resumo_conversa.trim()}`)

  if (proxima) {
    const adv = proxima.advogado ? ` com ${proxima.advogado.nome}` : ''
    const link = proxima.modalidade === 'online' && proxima.link_reuniao
      ? ` Link da sala: ${proxima.link_reuniao}`
      : ''
    linhas.push(
      `JÁ TEM CONSULTA MARCADA: ${proxima.servico ?? 'consulta'}, ${proxima.modalidade}, ` +
      `${quando(proxima.data_hora_inicio, fuso)}${adv}.${link}`,
    )
    linhas.push(
      'Ele já tem hora: NÃO ofereça agendamento, nem depois de dúvida, medo ou preço. ' +
      'Leve o assunto para essa consulta.',
    )
  }

  return linhas.join('\n')
}

export async function montarPrompt(
  promptBase: string | null | undefined,
  ficha: string,
  nomeAgente: string | null | undefined,
): Promise<string> {
  const [escritorio, horarios, servicos, advogados, jornadas] = await Promise.all([
    lerEscritorio(),
    selecionar<Horario>('office_hours?select=dia,aberto,hora_inicio,hora_fim'),
    selecionar<{ categoria: string; nome: string; descricao: string | null }>(
      'servicos_adv?select=categoria,nome,descricao&ativo=is.true&order=ordem,nome',
    ),
    selecionar<{ id: string; nome: string; especialidade: string | null }>(
      'advogados?select=id,nome,especialidade&ativo=is.true&order=nome',
    ),
    selecionar<Horario & { advogado_id: string }>(
      'advogado_hours?select=advogado_id,dia,aberto,hora_inicio,hora_fim',
    ),
  ])

  const fuso = escritorio?.fuso_horario || 'America/Sao_Paulo'

  const local = [escritorio?.endereco, escritorio?.cidade, escritorio?.uf]
    .map((x) => x?.trim()).filter(Boolean).join(', ')
  const infoEscritorio = [
    linhaSe('Nome do escritório', escritorio?.nome),
    linhaSe('Áreas de atuação', escritorio?.areas_atuacao),
    linhaSe('Endereço', local),
    linhaSe('Como chegar (Google Maps)', escritorio?.link_maps),
    linhaSe('Instagram', escritorio?.instagram),
    linhaSe('Site', escritorio?.site),
    `Horário de funcionamento: ${horariosEmTexto(horarios)}`,
    `Duração da consulta: ${escritorio?.duracao_consulta_min ?? 60} minutos`,
    escritorio?.consulta_gratuita
      ? 'A primeira consulta é GRATUITA.'
      : 'A primeira consulta NÃO é gratuita; o valor é informado pela equipe.',
    'A consulta pode ser presencial (no escritório) ou online (videoconferência).',
  ].filter(Boolean).join('\n')

  // A frase de cada serviço vai CURTA no prompt (a primeira oração): é para
  // reconhecer o assunto. A descrição inteira sai por `sobre_o_servico`.
  const porCategoria = new Map<string, string[]>()
  for (const s of servicos) {
    const frase = (s.descricao ?? '').split(/(?<=[.!?])\s/)[0]?.trim() ?? ''
    const lista = porCategoria.get(s.categoria) ?? []
    lista.push(`- ${s.nome}${frase ? `: ${frase}` : ''}`)
    porCategoria.set(s.categoria, lista)
  }
  const textoServicos = [...porCategoria.entries()]
    .map(([cat, itens]) => `${cat}\n${itens.join('\n')}`)
    .join('\n\n')

  const textoAdvogados = advogados
    .map((a) => {
      const h = horariosEmTexto(jornadas.filter((j) => j.advogado_id === a.id))
      return `- ${a.nome}${a.especialidade ? ` (${a.especialidade})` : ''} — atende ${h}`
    })
    .join('\n')

  const texto = promptBase && promptBase.trim() ? promptBase : PROMPT_OFICIAL

  return texto
    // `replaceAll`: o nome aparece mais de uma vez no prompt.
    .replaceAll('{{NOME_AGENTE}}', (nomeAgente ?? '').trim() || NOME_PADRAO)
    .replaceAll('{{NOME_ESCRITORIO}}', escritorio?.nome?.trim() || 'o escritório')
    .replace('{{INFORMACOES_ESCRITORIO}}', infoEscritorio)
    .replace('{{SERVICOS}}', textoServicos || 'Nenhum serviço ativo.')
    .replace('{{ADVOGADOS}}', textoAdvogados || 'Nenhum advogado ativo.')
    .replace('{{DATA_HOJE}}', frescoDaData(fuso))
    .replace('{{FICHA_DO_CLIENTE}}', ficha || 'Você ainda não sabe nada sobre esta pessoa. É o primeiro contato.')
}
