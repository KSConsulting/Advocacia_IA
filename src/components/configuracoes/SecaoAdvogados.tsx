import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import type { Advogado } from '../../types'
import Card, { Carregando } from '../ui/Card'
import Button from '../ui/Button'
import Input from '../ui/Input'
import GradeHorarios from './GradeHorarios'
import { horariosEmTexto, horariosValidos, type LinhaHorario } from '../../lib/horarios'

interface AdvogadoComHoras extends Advogado {
  advogado_hours: (LinhaHorario & { advogado_id: string })[]
}

function Editor({ adv, onSalvo }: { adv: AdvogadoComHoras; onSalvo: () => void }) {
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(adv)
  const [horas, setHoras] = useState<LinhaHorario[]>(adv.advogado_hours)
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!form.nome.trim()) return toast.erro('O nome é obrigatório.')
    if (!horariosValidos(horas)) return toast.erro('Confira os horários: o fim precisa ser depois do início.')
    setSalvando(true)
    const r1 = await supabase.from('advogados').update({
      nome: form.nome.trim(),
      cor: form.cor,
      ativo: form.ativo,
      especialidade: form.especialidade?.trim() || null,
      link_sala: form.link_sala?.trim() || null,
    }).eq('id', adv.id)
    const r2 = await Promise.all(horas.map((h) =>
      supabase.from('advogado_hours').update({
        aberto: h.aberto,
        hora_inicio: h.aberto ? h.hora_inicio : null,
        hora_fim: h.aberto ? h.hora_fim : null,
      }).eq('id', h.id),
    ))
    setSalvando(false)
    if (r1.error || r2.some((r) => r.error)) return toast.erro('Não foi possível salvar.')
    toast.sucesso('Advogado salvo.')
    onSalvo()
  }

  return (
    <div className="card">
      <button className="flex w-full items-center gap-3 px-5 py-4 text-left" onClick={() => setAberto((a) => !a)}>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: adv.cor }} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{adv.nome} {!adv.ativo && <span className="text-xs texto-suave">(inativo)</span>}</p>
          <p className="truncate text-xs texto-suave">
            {adv.especialidade ? `${adv.especialidade} · ` : ''}{horariosEmTexto(adv.advogado_hours)}
          </p>
        </div>
        {aberto ? <ChevronUp size={18} strokeWidth={1.5} /> : <ChevronDown size={18} strokeWidth={1.5} />}
      </button>

      {aberto && (
        <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border-card)' }}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <Input rotulo="Nome" className="md:col-span-3" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <div className="md:col-span-1">
              <label className="rotulo">Cor na agenda</label>
              <input type="color" className="h-[38px] w-full cursor-pointer rounded-lg border" style={{ borderColor: 'var(--border-card)' }}
                value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2 md:mt-6">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Ativo (aparece na agenda e a secretária marca com ele)
            </label>
            <Input rotulo="Especialidade" className="md:col-span-3" placeholder="Família e Sucessões"
              value={form.especialidade ?? ''} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} />
            <Input rotulo="Sala de videoconferência" className="md:col-span-3" placeholder="Link fixo do Meet, Zoom..."
              ajuda="Enviada ao cliente nas consultas online."
              value={form.link_sala ?? ''} onChange={(e) => setForm({ ...form, link_sala: e.target.value })} />
          </div>
          <h4 className="mb-1 mt-5 font-sans text-sm font-semibold">Jornada de atendimento</h4>
          <p className="mb-2 text-xs texto-suave">
            A agenda só aceita consultas dentro destes horários — pela tela e pela secretária de IA.
          </p>
          <GradeHorarios linhas={horas} onChange={setHoras} />
          <div className="mt-4 flex justify-end">
            <Button carregando={salvando} onClick={salvar}>Salvar advogado</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Advogados e a jornada de cada um. Advogado com consulta não é apagado (o
 * histórico depende dele): é desativado, e sai da agenda e da secretária.
 */
export default function SecaoAdvogados() {
  const toast = useToast()
  const [lista, setLista] = useState<AdvogadoComHoras[] | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('advogados').select('*, advogado_hours(*)').order('ativo', { ascending: false }).order('nome')
    setLista((data ?? []) as AdvogadoComHoras[])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  const criar = async () => {
    if (!novoNome.trim()) return
    setCriando(true)
    // O trigger `on_advogado_created` cria as 7 linhas da jornada, fechadas.
    const { error } = await supabase.from('advogados').insert({ nome: novoNome.trim() })
    setCriando(false)
    if (error) return toast.erro('Não foi possível cadastrar.')
    setNovoNome('')
    toast.sucesso('Advogado cadastrado. Configure a jornada dele.')
    carregar()
  }

  if (!lista) return <Carregando />

  return (
    <div className="flex flex-col gap-4">
      <Card titulo="Novo advogado">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className="campo flex-1" placeholder="Nome (ex.: Dra. Helena Souza)" value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && criar()} />
          <Button icone={<Plus size={16} strokeWidth={1.5} />} carregando={criando} onClick={criar} disabled={!novoNome.trim()}>
            Cadastrar
          </Button>
        </div>
      </Card>
      {lista.map((a) => <Editor key={`${a.id}-${a.nome}-${a.ativo}`} adv={a} onSalvo={carregar} />)}
    </div>
  )
}
