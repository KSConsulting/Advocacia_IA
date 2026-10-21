import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { intervalo } from '../lib/datas'
import { useFiltro } from '../lib/useFiltro'
import type { LeadAdv } from '../types'
import PageHeader from '../components/ui/PageHeader'
import FilterBar from '../components/ui/FilterBar'
import Card from '../components/ui/Card'
import TabelaPessoas from '../components/TabelaPessoas'

export default function Leads() {
  const [filtro, setFiltro] = useFiltro()
  const [leads, setLeads] = useState<LeadAdv[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const { inicio, fim } = intervalo(filtro)
    let vivo = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true)
    // Só quem NÃO está em clientes_adv (anti-join do PostgREST).
    supabase
      .from('leads_adv')
      .select('*, clientes_adv(id)')
      .is('clientes_adv', null)
      .gte('inicio_atendimento', inicio)
      .lt('inicio_atendimento', fim)
      .order('inicio_atendimento', { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (!vivo) return
        setLeads((data ?? []) as LeadAdv[])
        setCarregando(false)
      })
    return () => { vivo = false }
  }, [filtro])

  return (
    <>
      <PageHeader
        titulo="Leads"
        descricao="Lista completa de todas as pessoas que entraram em contato com o escritório e ainda não compareceram a uma consulta. Clique em qualquer lead para ver o histórico completo da conversa."
      />
      <FilterBar valor={filtro} onChange={setFiltro} />
      <Card className="overflow-hidden [&>div]:p-0">
        <TabelaPessoas
          pessoas={leads}
          carregando={carregando}
          colunas={['inicio', 'nome', 'whatsapp', 'motivo', 'status']}
        />
      </Card>
    </>
  )
}
