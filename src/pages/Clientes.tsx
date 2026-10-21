import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { intervalo } from '../lib/datas'
import { useFiltro } from '../lib/useFiltro'
import type { LeadAdv } from '../types'
import PageHeader from '../components/ui/PageHeader'
import FilterBar from '../components/ui/FilterBar'
import Card from '../components/ui/Card'
import TabelaPessoas from '../components/TabelaPessoas'

export default function Clientes() {
  const [filtro, setFiltro] = useFiltro('este_ano')
  const [clientes, setClientes] = useState<LeadAdv[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const { inicio, fim } = intervalo(filtro)
    let vivo = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true)
    // Só quem ESTÁ em clientes_adv (inner join). Filtra por inicio_atendimento
    // do lead, como manda a especificação.
    supabase
      .from('leads_adv')
      .select('*, clientes_adv!inner(id, data_primeira_visita)')
      .gte('inicio_atendimento', inicio)
      .lt('inicio_atendimento', fim)
      .order('inicio_atendimento', { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (!vivo) return
        setClientes((data ?? []) as LeadAdv[])
        setCarregando(false)
      })
    return () => { vivo = false }
  }, [filtro])

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao="Todos os contatos que já compareceram a uma consulta presencial ou online. A promoção de lead para cliente acontece automaticamente quando a consulta é confirmada."
      />
      <FilterBar valor={filtro} onChange={setFiltro} />
      <Card className="overflow-hidden [&>div]:p-0">
        <TabelaPessoas
          pessoas={clientes}
          carregando={carregando}
          rotaBase="/clientes"
          colunas={['inicio', 'nome', 'whatsapp', 'motivo']}
          vazio="Nenhum cliente no período selecionado."
        />
      </Card>
    </>
  )
}
