import { useEffect, useState } from 'react'
import { ImageUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useEscritorio } from '../../contexts/EscritorioContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { OfficeConfig } from '../../types'
import Card, { Carregando } from '../ui/Card'
import Button from '../ui/Button'
import Input, { Textarea } from '../ui/Input'

type Campos = Pick<OfficeConfig,
  'nome' | 'logo_url' | 'favicon_url' | 'endereco' | 'cidade' | 'uf' | 'link_maps' | 'instagram' |
  'site' | 'areas_atuacao' | 'duracao_consulta_min' | 'consulta_gratuita' | 'link_reuniao_padrao'>

function Upload({ rotulo, url, onEnviado, desabilitado }: {
  rotulo: string; url: string | null; onEnviado: (url: string) => void; desabilitado: boolean
}) {
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)

  const enviar = async (arquivo: File) => {
    if (arquivo.size > 2 * 1024 * 1024) return toast.erro('Imagem acima de 2 MB.')
    setEnviando(true)
    const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'png'
    // Nome novo a cada envio: a URL pública é cacheada pelo navegador e pelo CDN.
    const caminho = `${rotulo.toLowerCase()}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('escritorio').upload(caminho, arquivo, { upsert: false })
    setEnviando(false)
    if (error) return toast.erro('Não foi possível enviar a imagem.')
    onEnviado(supabase.storage.from('escritorio').getPublicUrl(caminho).data.publicUrl)
  }

  return (
    <div>
      <span className="rotulo">{rotulo}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-card)' }}>
          {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <ImageUp size={20} strokeWidth={1.25} className="texto-suave" />}
        </div>
        <label className={`cursor-pointer text-sm ${desabilitado ? 'pointer-events-none opacity-50' : ''}`} style={{ color: 'var(--accent)' }}>
          {enviando ? 'Enviando…' : url ? 'Trocar imagem' : 'Enviar imagem'}
          <input type="file" accept="image/*" className="hidden" disabled={desabilitado}
            onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} />
        </label>
      </div>
    </div>
  )
}

/** Seção 1 da especificação — e o que a secretária de IA conta sobre o escritório. */
export default function SecaoEscritorio() {
  const { config, recarregar } = useEscritorio()
  const { ehAdmin } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState<Campos | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (config) setForm({ ...config })
  }, [config])

  if (!form) return <Carregando />

  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setForm((f) => f && { ...f, [k]: v })
  const texto = (k: keyof Campos) => ({
    value: (form[k] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
    disabled: !ehAdmin,
  })

  const salvar = async () => {
    if (!form.nome.trim()) return toast.erro('O nome do escritório é obrigatório.')
    setSalvando(true)
    const limpo = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? (v.trim() || null) : v]),
    )
    const { error } = await supabase.from('office_config').update({ ...limpo, nome: form.nome.trim() }).eq('id', 1)
    setSalvando(false)
    if (error) return toast.erro('Não foi possível salvar.')
    toast.sucesso('Informações do escritório salvas.')
    recarregar()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card titulo="Informações do Escritório" descricao="Nome, logo e favicon aparecem em toda a interface.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input rotulo="Nome do escritório" className="md:col-span-3" {...texto('nome')} />
          <Upload rotulo="Logo" url={form.logo_url} desabilitado={!ehAdmin} onEnviado={(u) => set('logo_url', u)} />
          <Upload rotulo="Favicon" url={form.favicon_url} desabilitado={!ehAdmin} onEnviado={(u) => set('favicon_url', u)} />
        </div>
      </Card>

      <Card
        titulo="O que a secretária de IA conta ao cliente"
        descricao="A secretária só fala do escritório o que estiver aqui. Campo vazio, ela não menciona — e não inventa."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <Input rotulo="Endereço" className="md:col-span-4" placeholder="Rua, número, sala, bairro" {...texto('endereco')} />
          <Input rotulo="Cidade" className="md:col-span-1" {...texto('cidade')} />
          <Input rotulo="UF" className="md:col-span-1" maxLength={2} {...texto('uf')} />
          <Input rotulo="Link do Google Maps" className="md:col-span-3" {...texto('link_maps')} />
          <Input rotulo="Instagram" className="md:col-span-3" placeholder="https://instagram.com/..." {...texto('instagram')} />
          <Input rotulo="Site" className="md:col-span-3" {...texto('site')} />
          <Input rotulo="Sala de videoconferência padrão" className="md:col-span-3" placeholder="Link do Meet, Zoom..."
            ajuda="Usada nas consultas online quando o advogado não tem sala própria." {...texto('link_reuniao_padrao')} />
          <Textarea rotulo="Áreas de atuação" className="md:col-span-6" rows={2} placeholder="Direito de Família e Sucessões" {...texto('areas_atuacao')} />
          <Input
            rotulo="Duração da consulta (minutos)" type="number" min={15} max={240} step={15} className="md:col-span-2"
            value={form.duracao_consulta_min} disabled={!ehAdmin}
            onChange={(e) => set('duracao_consulta_min', Number(e.target.value))}
          />
          <label className="flex items-center gap-2 text-sm md:col-span-4 md:mt-6">
            <input type="checkbox" checked={form.consulta_gratuita} disabled={!ehAdmin} onChange={(e) => set('consulta_gratuita', e.target.checked)} />
            A primeira consulta é gratuita
          </label>
        </div>
      </Card>

      {ehAdmin && (
        <div className="flex justify-end">
          <Button carregando={salvando} onClick={salvar}>Salvar alterações</Button>
        </div>
      )}
    </div>
  )
}
