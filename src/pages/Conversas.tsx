import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bot, FileText, Hand, Search, Send, User, Video } from 'lucide-react'
import { supabase, chamarFuncao } from '../lib/supabase'
import { formatarDataHora, formatarHora, tempoDesde } from '../lib/datas'
import { formatarWhatsapp, nomeOuNumero } from '../lib/telefone'
import { useToast } from '../contexts/ToastContext'
import type { ConversaResumo, LeadAdv, MensagemWhatsapp } from '../types'
import { BadgeLead } from '../components/ui/Badge'
import { Carregando, Vazio } from '../components/ui/Card'
import Button from '../components/ui/Button'

/** Áudio e imagem moram num bucket privado: a URL é assinada e vale 1 hora. */
function Midia({ m }: { m: MensagemWhatsapp }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!m.midia_url) return
    supabase.storage.from('midias-whatsapp').createSignedUrl(m.midia_url, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null))
  }, [m.midia_url])

  if (m.tipo === 'audio') {
    return (
      <div>
        {url && <audio controls src={url} className="mb-1 max-w-full" />}
        <p className="text-xs italic opacity-80">{m.conteudo ?? 'Áudio'}</p>
      </div>
    )
  }
  if (m.tipo === 'imagem') {
    return (
      <div>
        {url && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="mb-1 max-h-60 rounded" /></a>}
        {m.conteudo && <p className="text-xs italic opacity-80">{m.conteudo}</p>}
      </div>
    )
  }
  if (m.tipo === 'video') return <p className="flex items-center gap-1 text-xs italic"><Video size={14} strokeWidth={1.5} /> Vídeo — abra no WhatsApp</p>
  if (m.tipo === 'documento') return <p className="flex items-center gap-1 text-xs italic"><FileText size={14} strokeWidth={1.5} /> Arquivo — abra no WhatsApp</p>
  return <p className="whitespace-pre-line">{m.conteudo}</p>
}

function Balao({ m }: { m: MensagemWhatsapp }) {
  const nosso = m.autor !== 'lead'
  const estilo: React.CSSProperties = m.autor === 'lead'
    ? { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)' }
    : m.autor === 'agente'
    ? { backgroundColor: 'var(--accent-light)', border: '1px solid var(--border-card)' }
    : { backgroundColor: 'var(--primary)', color: 'var(--primary-text)' }
  return (
    <div className={`flex ${nosso ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[78%] rounded-xl px-3 py-2 text-sm" style={estilo}>
        <Midia m={m} />
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
          {m.autor === 'agente' && <><Bot size={11} strokeWidth={1.5} /> {m.origem === 'follow_up' ? 'follow up ·' : 'secretária ·'}</>}
          {m.autor === 'atendente' && <><User size={11} strokeWidth={1.5} /> equipe ·</>}
          <span title={formatarDataHora(m.criada_em)}>{formatarHora(m.criada_em)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Conversas — o que antes era o Chatwoot.
 *
 * A equipe lê tudo que a secretária de IA conversou, assume a conversa quando
 * precisa (ela para de responder àquele número) e responde pelo mesmo WhatsApp.
 */
export default function Conversas() {
  const { id } = useParams()
  const navegar = useNavigate()
  const toast = useToast()
  const [lista, setLista] = useState<ConversaResumo[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [busca, setBusca] = useState('')
  const [lead, setLead] = useState<LeadAdv | null>(null)
  const [mensagens, setMensagens] = useState<MensagemWhatsapp[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)

  const carregarLista = useCallback(async () => {
    const { data } = await supabase.from('conversas_lista').select('*').order('ultima_em', { ascending: false }).limit(300)
    setLista((data ?? []) as ConversaResumo[])
    setCarregandoLista(false)
  }, [])

  const carregarConversa = useCallback(async (leadId: string) => {
    const [l, m] = await Promise.all([
      supabase.from('leads_adv').select('*').eq('id', leadId).maybeSingle(),
      supabase.from('mensagens_whatsapp').select('*').eq('lead_id', leadId).order('criada_em', { ascending: false }).limit(300),
    ])
    setLead(l.data as LeadAdv | null)
    setMensagens(((m.data ?? []) as MensagemWhatsapp[]).reverse())
    // Abriu, leu.
    await supabase.from('mensagens_whatsapp').update({ lida: true }).eq('lead_id', leadId).eq('lida', false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarLista()
    const canal = supabase
      .channel('conversas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens_whatsapp' }, (p) => {
        const nova = p.new as MensagemWhatsapp
        carregarLista()
        if (nova.lead_id === id) {
          setMensagens((a) => (a.some((x) => x.id === nova.id) ? a : [...a, nova]))
          if (nova.autor === 'lead') supabase.from('mensagens_whatsapp').update({ lida: true }).eq('id', nova.id)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensagens_whatsapp' }, (p) => {
        // A transcrição do áudio e a descrição da imagem chegam depois do balão.
        const m = p.new as MensagemWhatsapp
        if (m.lead_id === id) setMensagens((a) => a.map((x) => (x.id === m.id ? m : x)))
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [carregarLista, id])

  useEffect(() => {
    if (!id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarConversa(id)
  }, [id, carregarConversa])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length])

  const enviar = async () => {
    if (!lead || !texto.trim()) return
    setEnviando(true)
    const r = await chamarFuncao('/enviar', { metodo: 'POST', corpo: { lead_id: lead.id, texto: texto.trim() } })
    setEnviando(false)
    if (!r.ok) return toast.erro(r.motivo === 'whatsapp_fora' ? 'O WhatsApp não respondeu. Confira a conexão em Configurações.' : 'Não foi possível enviar.')
    setTexto('')
  }

  const pausar = async (pausado: boolean) => {
    if (!lead) return
    const { error } = await supabase.from('leads_adv').update({ agente_pausado: pausado }).eq('id', lead.id)
    if (error) return toast.erro('Não foi possível alterar.')
    setLead({ ...lead, agente_pausado: pausado })
    toast.sucesso(pausado ? 'Você assumiu a conversa. A secretária de IA não responde mais a este contato.' : 'Conversa devolvida à secretária de IA.')
    carregarLista()
  }

  const filtradas = lista.filter((c) => {
    const t = busca.trim().toLowerCase()
    if (!t) return true
    return (c.nome_lead ?? '').toLowerCase().includes(t) || c.whatsapp_lead.includes(t.replace(/\D/g, '') || '§')
  })

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-3.5rem)] lg:-mx-8">
      {/* Lista */}
      <aside
        className={`w-full shrink-0 flex-col md:flex md:w-80 ${id ? 'hidden' : 'flex'}`}
        style={{ borderRight: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card)' }}
      >
        <div className="p-4">
          <h1 className="font-display text-xl font-semibold">Conversas</h1>
          <div className="relative mt-3">
            <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 texto-suave" />
            <input className="campo pl-9" placeholder="Buscar nome ou número" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {carregandoLista ? <Carregando /> : filtradas.length === 0 ? <Vazio texto="Nenhuma conversa ainda." /> : filtradas.map((c) => (
            <button
              key={c.lead_id}
              onClick={() => navegar(`/conversas/${c.lead_id}`)}
              className="flex w-full flex-col gap-1 px-4 py-3 text-left"
              style={{
                borderTop: '1px solid var(--border-card)',
                backgroundColor: c.lead_id === id ? 'var(--accent-light)' : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{nomeOuNumero(c.nome_lead, c.whatsapp_lead)}</span>
                <span className="shrink-0 text-[11px] texto-suave">{tempoDesde(c.ultima_em)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs texto-suave">
                  {c.ultima_autor !== 'lead' && (c.ultima_autor === 'agente' ? 'Secretária: ' : 'Equipe: ')}
                  {c.ultima_tipo === 'texto' ? c.ultima_conteudo : `[${c.ultima_tipo}]`}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {c.agente_pausado && <Hand size={12} strokeWidth={1.5} className="texto-suave" aria-label="Assumida pela equipe" />}
                  {c.nao_lidas > 0 && (
                    <span className="rounded-full px-1.5 text-[11px] font-semibold" style={{ backgroundColor: 'var(--accent)', color: '#1C2B3A' }}>
                      {c.nao_lidas}
                    </span>
                  )}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Janela */}
      <section className={`min-w-0 flex-1 flex-col ${id ? 'flex' : 'hidden md:flex'}`}>
        {!id || !lead ? (
          <div className="flex flex-1 items-center justify-center">
            <Vazio texto={id ? 'Carregando conversa…' : 'Escolha uma conversa.'} />
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card)' }}>
              <button className="md:hidden" onClick={() => navegar('/conversas')} aria-label="Voltar"><ArrowLeft size={20} strokeWidth={1.5} /></button>
              <div className="min-w-0">
                <Link to={`/leads/${lead.id}`} className="block truncate font-medium hover:underline">{nomeOuNumero(lead.nome_lead, lead.whatsapp_lead)}</Link>
                <span className="text-xs texto-suave">{formatarWhatsapp(lead.whatsapp_lead)}{lead.motivo_contato ? ` · ${lead.motivo_contato}` : ''}</span>
              </div>
              <BadgeLead status={lead.status} />
              <div className="ml-auto">
                <Button variante={lead.agente_pausado ? 'secundario' : 'fantasma'} onClick={() => pausar(!lead.agente_pausado)}
                  icone={lead.agente_pausado ? <Bot size={16} strokeWidth={1.5} /> : <Hand size={16} strokeWidth={1.5} />}>
                  {lead.agente_pausado ? 'Devolver à secretária' : 'Assumir conversa'}
                </Button>
              </div>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {mensagens.map((m) => <Balao key={m.id} m={m} />)}
              <div ref={fimRef} />
            </div>

            <footer className="px-4 py-3" style={{ borderTop: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card)' }}>
              {!lead.agente_pausado && (
                <p className="mb-2 text-xs texto-suave">
                  A secretária de IA está atendendo este contato. Se você responder sem assumir, os dois podem responder ao mesmo tempo.
                </p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  className="campo max-h-40 min-h-[42px] flex-1 resize-none"
                  rows={1}
                  placeholder="Escreva uma mensagem"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      enviar()
                    }
                  }}
                />
                <Button onClick={enviar} carregando={enviando} disabled={!texto.trim()} icone={<Send size={16} strokeWidth={1.5} />} aria-label="Enviar" />
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
