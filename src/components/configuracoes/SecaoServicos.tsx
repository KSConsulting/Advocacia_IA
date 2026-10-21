import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import type { ServicoAdv } from '../../types'
import Card, { Carregando } from '../ui/Card'
import Button from '../ui/Button'
import Input, { Textarea } from '../ui/Input'
import Modal from '../ui/Modal'

function LinhaServico({ s, onSalvo }: { s: ServicoAdv; onSalvo: () => void }) {
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(s)
  const [salvando, setSalvando] = useState(false)

  const alternar = async () => {
    const { error } = await supabase.from('servicos_adv').update({ ativo: !s.ativo }).eq('id', s.id)
    if (error) return toast.erro('Não foi possível alterar.')
    toast.sucesso(s.ativo ? 'Serviço desativado: a secretária não oferece mais.' : 'Serviço ativado.')
    onSalvo()
  }

  const salvar = async () => {
    setSalvando(true)
    const { error } = await supabase.from('servicos_adv').update({
      nome: form.nome.trim(), categoria: form.categoria.trim(), descricao: form.descricao?.trim() || null,
    }).eq('id', s.id)
    setSalvando(false)
    if (error) return toast.erro(error.code === '23505' ? 'Já existe um serviço com esse nome.' : 'Não foi possível salvar.')
    toast.sucesso('Serviço salvo.')
    setAberto(false)
    onSalvo()
  }

  return (
    <div className="flex items-start gap-3 py-3" style={{ opacity: s.ativo ? 1 : 0.55 }}>
      <input type="checkbox" className="mt-1" checked={s.ativo} onChange={alternar} aria-label="Ativo" />
      <button className="min-w-0 flex-1 text-left" onClick={() => setAberto(true)}>
        <p className="text-sm font-medium">{s.nome}</p>
        <p className="line-clamp-2 text-xs texto-suave">{s.descricao}</p>
      </button>
      <Modal
        aberto={aberto}
        titulo="Editar serviço"
        onFechar={() => setAberto(false)}
        largura="max-w-2xl"
        rodape={<><Button variante="fantasma" onClick={() => setAberto(false)}>Cancelar</Button><Button carregando={salvando} onClick={salvar}>Salvar</Button></>}
      >
        <div className="flex flex-col gap-3">
          <Input rotulo="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Input rotulo="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          <Textarea rotulo="Descrição" rows={8} value={form.descricao ?? ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            ajuda="É o que a secretária lê para explicar o serviço. A primeira frase vai sempre no prompt; o texto inteiro, quando o cliente pergunta mais." />
        </div>
      </Modal>
    </div>
  )
}

/**
 * O catálogo que a secretária de IA oferece — era a planilha do Google Sheets.
 * Ela só oferece, e só grava na consulta, o que está ATIVO aqui.
 */
export default function SecaoServicos() {
  const toast = useToast()
  const [lista, setLista] = useState<ServicoAdv[] | null>(null)
  const [novo, setNovo] = useState(false)
  const [form, setForm] = useState({ nome: '', categoria: '', descricao: '' })

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('servicos_adv').select('*').order('ordem').order('nome')
    setLista((data ?? []) as ServicoAdv[])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
  }, [carregar])

  if (!lista) return <Carregando />

  const categorias = [...new Set(lista.map((s) => s.categoria))]

  const criar = async () => {
    const { error } = await supabase.from('servicos_adv').insert({
      nome: form.nome.trim(), categoria: form.categoria.trim(), descricao: form.descricao.trim() || null,
      ordem: lista.length + 1,
    })
    if (error) return toast.erro(error.code === '23505' ? 'Já existe um serviço com esse nome.' : 'Não foi possível cadastrar.')
    toast.sucesso('Serviço cadastrado.')
    setNovo(false)
    setForm({ nome: '', categoria: '', descricao: '' })
    carregar()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm texto-suave">
          A secretária de IA só oferece os serviços ativos, e é daqui que sai o "Motivo do Contato" de cada lead.
          Desmarque o que o escritório não faz.
        </p>
        <Button icone={<Plus size={16} strokeWidth={1.5} />} onClick={() => setNovo(true)}>Novo serviço</Button>
      </div>

      {categorias.map((c) => (
        <Card key={c} titulo={c}>
          <div className="-my-3 divide-y" style={{ borderColor: 'var(--border-card)' }}>
            {lista.filter((s) => s.categoria === c).map((s) => (
              <LinhaServico key={`${s.id}-${s.ativo}-${s.nome}`} s={s} onSalvo={carregar} />
            ))}
          </div>
        </Card>
      ))}

      <Modal
        aberto={novo}
        titulo="Novo serviço"
        onFechar={() => setNovo(false)}
        largura="max-w-2xl"
        rodape={<><Button variante="fantasma" onClick={() => setNovo(false)}>Cancelar</Button>
          <Button disabled={!form.nome.trim() || !form.categoria.trim()} onClick={criar}>Cadastrar</Button></>}
      >
        <div className="flex flex-col gap-3">
          <Input rotulo="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Input rotulo="Categoria" list="categorias-servico" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          <datalist id="categorias-servico">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          <Textarea rotulo="Descrição" rows={6} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}
