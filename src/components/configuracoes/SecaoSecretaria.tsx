import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Smartphone, WifiOff } from 'lucide-react'
import { supabase, chamarFuncao } from '../../lib/supabase'
import { MODELOS } from '../../lib/modelosIA'
import { formatarWhatsapp, normalizarWhatsapp } from '../../lib/telefone'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { ConfiguracoesAgente } from '../../types'
import Card, { Carregando } from '../ui/Card'
import Button from '../ui/Button'
import Input, { Select, Textarea } from '../ui/Input'
import Modal from '../ui/Modal'

interface Conexao {
  ok: boolean
  provedor?: string
  estado?: 'conectado' | 'conectando' | 'desconectado' | 'indisponivel' | 'nao_configurado'
  numero?: string | null
  perfil?: string | null
  servidor?: string | null
  instancia?: string | null
  chaveFinal?: string | null
  webhook?: 'apontado' | 'outro' | 'ausente' | 'desconhecido'
  motivo?: string
}

const ESTADOS: Record<string, { texto: string; cor: string }> = {
  conectado: { texto: 'Conectado', cor: 'var(--success)' },
  conectando: { texto: 'Conectando…', cor: 'var(--warning)' },
  desconectado: { texto: 'Desconectado — conecte o celular do escritório', cor: 'var(--danger)' },
  indisponivel: { texto: 'O servidor do WhatsApp não respondeu', cor: 'var(--danger)' },
  nao_configurado: { texto: 'Faltam as chaves desta ponte nas secrets do Supabase', cor: 'var(--danger)' },
}

/** Conexão do WhatsApp: tudo passa pela Edge Function — a chave da ponte nunca vem ao navegador. */
function ConexaoWhatsApp({ provedor, ehAdmin }: { provedor: string; ehAdmin: boolean }) {
  const toast = useToast()
  const [c, setC] = useState<Conexao | null>(null)
  const [parear, setParear] = useState(false)
  const [numero, setNumero] = useState('')
  const [pareamento, setPareamento] = useState<{ codigo: string | null; qr: string | null } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const ler = useCallback(async () => {
    setC(await chamarFuncao<Conexao>('/conexao'))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    ler()
    const t = setInterval(ler, pareamento ? 5000 : 60000)
    return () => clearInterval(t)
  }, [ler, provedor, pareamento])

  useEffect(() => {
    if (pareamento && c?.estado === 'conectado') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPareamento(null)
      setParear(false)
      toast.sucesso('WhatsApp conectado.')
    }
  }, [c?.estado, pareamento, toast])

  if (!c) return <Carregando texto="Verificando o WhatsApp…" />
  if (!c.ok) {
    return (
      <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--danger)' }}>
        <WifiOff size={16} strokeWidth={1.5} />
        A função do WhatsApp não respondeu. Ela foi publicada? (INSTALACAO.md, parte 3)
      </p>
    )
  }

  const est = ESTADOS[c.estado ?? 'indisponivel']
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="flex items-center gap-2 font-medium" style={{ color: est.cor }}>
        {c.estado === 'conectado' ? <CheckCircle2 size={18} strokeWidth={1.5} /> : <AlertTriangle size={18} strokeWidth={1.5} />}
        {est.texto}
      </p>
      {c.estado === 'conectado' && (
        <p className="texto-suave">{c.perfil} · {formatarWhatsapp(c.numero)}</p>
      )}
      {c.estado === 'conectado' && c.webhook && c.webhook !== 'apontado' && c.webhook !== 'desconhecido' && (
        <p className="rounded-lg px-3 py-2" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
          O WhatsApp está conectado, mas o webhook {c.webhook === 'ausente' ? 'está desligado' : 'aponta para outro lugar'}.
          As mensagens não chegam ao sistema. Veja INSTALACAO.md, parte 4.
        </p>
      )}
      <p className="text-xs texto-suave">
        Ponte: {c.provedor}{c.servidor ? ` · ${c.servidor}` : ''}{c.instancia ? ` · instância ${c.instancia}` : ''}
        {c.chaveFinal ? ` · chave …${c.chaveFinal}` : ''}
      </p>
      {ehAdmin && c.estado !== 'nao_configurado' && c.estado !== 'indisponivel' && (
        <div className="flex gap-2">
          {c.estado !== 'conectado' && (
            <Button variante="secundario" icone={<Smartphone size={16} strokeWidth={1.5} />} onClick={() => setParear(true)}>Conectar celular</Button>
          )}
          {c.estado === 'conectado' && (
            <Button variante="fantasma" carregando={ocupado} onClick={async () => {
              setOcupado(true)
              const r = await chamarFuncao('/conexao/desconectar', { metodo: 'POST' })
              setOcupado(false)
              if (!r.ok) return toast.erro('Não foi possível desconectar.')
              toast.sucesso('WhatsApp desconectado.')
              ler()
            }}>
              Desconectar
            </Button>
          )}
        </div>
      )}

      <Modal aberto={parear} titulo="Conectar o WhatsApp do escritório" onFechar={() => { setParear(false); setPareamento(null) }}>
        {!pareamento ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Informe o número do WhatsApp do escritório para receber um código de 8 dígitos. Sem número, aparece um QR code.
            </p>
            <Input placeholder="(11) 98765-4321" value={numero} onChange={(e) => setNumero(e.target.value)} />
            <Button carregando={ocupado} onClick={async () => {
              setOcupado(true)
              const r = await chamarFuncao<{ codigo: string | null; qr: string | null }>('/conexao/conectar', {
                metodo: 'POST', corpo: { numero: numero ? normalizarWhatsapp(numero) : undefined },
              })
              setOcupado(false)
              if (!r.ok) return toast.erro('O servidor do WhatsApp não respondeu.')
              setPareamento({ codigo: r.codigo, qr: r.qr })
            }}>
              Gerar código
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center text-sm">
            {pareamento.codigo && (
              <>
                <p>No celular: WhatsApp → Aparelhos conectados → Conectar aparelho → <strong>Conectar com número de telefone</strong>. Digite:</p>
                <p className="font-mono text-3xl tracking-widest">{pareamento.codigo}</p>
              </>
            )}
            {pareamento.qr && (
              <>
                {pareamento.codigo && <p className="texto-suave">ou leia o QR code:</p>}
                <img alt="QR code" className="h-56 w-56"
                  src={pareamento.qr.startsWith('data:') ? pareamento.qr : `data:image/png;base64,${pareamento.qr}`} />
              </>
            )}
            <p className="text-xs texto-suave">Esta janela fecha sozinha quando a conexão for feita.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

/**
 * A secretária de IA — o que antes era configurado dentro dos nós do n8n.
 */
export default function SecaoSecretaria() {
  const { ehAdmin } = useAuth()
  const toast = useToast()
  const [cfg, setCfg] = useState<ConfiguracoesAgente | null>(null)
  const [numerosTexto, setNumerosTexto] = useState('')
  const [chaves, setChaves] = useState<{ openai: boolean; anthropic: boolean } | null>(null)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('configuracoes_agente').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      const c = data as ConfiguracoesAgente | null
      setCfg(c)
      setNumerosTexto((c?.numeros_teste ?? []).map(formatarWhatsapp).join('\n'))
    })
    chamarFuncao<{ openai: boolean; anthropic: boolean }>('/chaves-ia').then((r) => r.ok && setChaves({ openai: r.openai, anthropic: r.anthropic }))
  }, [])

  if (!cfg) return <Carregando />

  const set = <K extends keyof ConfiguracoesAgente>(k: K, v: ConfiguracoesAgente[K]) => setCfg({ ...cfg, [k]: v })

  const salvar = async (extra: Partial<ConfiguracoesAgente> = {}) => {
    setSalvando(true)
    const numeros = numerosTexto.split(/[\n,;]+/).map((n) => normalizarWhatsapp(n)).filter((n) => n.length >= 12)
    const dados = {
      ativo: cfg.ativo, nome_agente: cfg.nome_agente.trim(), modelo: cfg.modelo, modo_teste: cfg.modo_teste,
      numeros_teste: numeros, provedor_whatsapp: cfg.provedor_whatsapp, follow_up_ativo: cfg.follow_up_ativo, ...extra,
    }
    const { error } = await supabase.from('configuracoes_agente').update(dados).eq('id', 1)
    setSalvando(false)
    if (error) return toast.erro('Não foi possível salvar.')
    setCfg({ ...cfg, ...dados })
    toast.sucesso('Secretária de IA atualizada.')
  }

  const situacao = !cfg.ativo
    ? { texto: 'Desligada. As mensagens chegam em Conversas, sem resposta automática.', cor: 'var(--text-muted)' }
    : cfg.modo_teste
    ? { texto: 'Ligada em MODO TESTE: responde só aos números da lista abaixo.', cor: 'var(--warning)' }
    : { texto: 'Ligada: atende todos os contatos do WhatsApp.', cor: 'var(--success)' }

  return (
    <div className="flex flex-col gap-6">
      <Card titulo="Situação">
        <p className="text-sm font-medium" style={{ color: situacao.cor }}>{situacao.texto}</p>
        {ehAdmin && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variante={cfg.ativo ? 'fantasma' : 'primario'} carregando={salvando} onClick={() => salvar({ ativo: !cfg.ativo })}>
              {cfg.ativo ? 'Desligar secretária' : 'Ligar secretária'}
            </Button>
          </div>
        )}
      </Card>

      <Card titulo="Conexão do WhatsApp">
        <ConexaoWhatsApp provedor={cfg.provedor_whatsapp} ehAdmin={ehAdmin} />
      </Card>

      <Card titulo="Configuração">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input rotulo="Nome da secretária" value={cfg.nome_agente} disabled={!ehAdmin} onChange={(e) => set('nome_agente', e.target.value)}
            ajuda="É como ela se apresenta ao cliente." />
          <Select rotulo="Modelo de IA" value={cfg.modelo} disabled={!ehAdmin} onChange={(e) => set('modelo', e.target.value)}>
            {MODELOS.map((m) => {
              const semChave = chaves ? !chaves[m.fornecedor] : false
              return <option key={m.id} value={m.id} disabled={semChave}>{m.nome} — {semChave ? 'sem chave cadastrada' : m.nota}</option>
            })}
          </Select>
          <Select rotulo="Ponte do WhatsApp" value={cfg.provedor_whatsapp} disabled={!ehAdmin}
            onChange={(e) => set('provedor_whatsapp', e.target.value as ConfiguracoesAgente['provedor_whatsapp'])}
            ajuda="Só a ponte escolhida deve ter o webhook apontado para o sistema.">
            <option value="evolution">Evolution API</option>
            <option value="uazapi">uazapi</option>
          </Select>
          <label className="flex items-start gap-2 text-sm md:mt-6">
            <input type="checkbox" className="mt-1" checked={cfg.follow_up_ativo} disabled={!ehAdmin} onChange={(e) => set('follow_up_ativo', e.target.checked)} />
            <span>Follow up automático<br /><span className="text-xs texto-suave">20 min, 24 h e 36 h depois que o lead parar de responder, das 8h às 21h.</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input type="checkbox" className="mt-1" checked={cfg.modo_teste} disabled={!ehAdmin} onChange={(e) => set('modo_teste', e.target.checked)} />
            <span>Modo teste<br /><span className="text-xs texto-suave">Ligado, ela só responde (e só faz follow up) aos números abaixo. Desligar coloca a secretária na frente de todos os clientes.</span></span>
          </label>
          {cfg.modo_teste && (
            <Textarea rotulo="Números de teste (um por linha)" className="md:col-span-2" rows={3} disabled={!ehAdmin}
              value={numerosTexto} onChange={(e) => setNumerosTexto(e.target.value)} placeholder="(11) 98765-4321" />
          )}
        </div>
        {ehAdmin && (
          <div className="mt-4 flex justify-end">
            <Button carregando={salvando} onClick={() => salvar()}>Salvar configuração</Button>
          </div>
        )}
      </Card>

      <Card titulo="Prompt" descricao="As instruções da secretária. Quem edita é o desenvolvedor, no arquivo agente-ia/prompt.md — aqui é só para ler.">
        {prompt === null ? (
          <Button variante="fantasma" onClick={async () => {
            const r = await chamarFuncao<{ prompt: string }>('/prompt-oficial')
            setPrompt(r.ok ? r.prompt : 'Não foi possível carregar.')
          }}>
            Ver prompt
          </Button>
        ) : (
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg p-4 text-xs" style={{ backgroundColor: 'var(--bg-base)' }}>
            {cfg.prompt?.trim() ? cfg.prompt : prompt}
          </pre>
        )}
      </Card>
    </div>
  )
}
