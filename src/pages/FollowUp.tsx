import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { intervalo } from '../lib/datas'
import { useFiltro } from '../lib/useFiltro'
import type { LeadAdv } from '../types'
import PageHeader from '../components/ui/PageHeader'
import FilterBar from '../components/ui/FilterBar'
import Card from '../components/ui/Card'
import TabelaPessoas from '../components/TabelaPessoas'

export default function FollowUp() {
  const [filtro, setFiltro] = useFiltro('ultimos_14_dias')
  const [leads, setLeads] = useState<LeadAdv[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const { inicio, fim } = intervalo(filtro)
    let vivo = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true)
    supabase
      .from('leads_adv')
      .select('*')
      .eq('status', 'follow_up')
      .gte('inicio_atendimento', inicio)
      .lt('inicio_atendimento', fim)
      .order('ultima_mensagem', { ascending: false, nullsFirst: false })
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
        titulo="Follow Up"
        descricao="Leads que precisam de acompanhamento para avançar no funil. O Agente de IA realiza os follow ups automaticamente, garantindo que nenhuma oportunidade seja perdida."
      />
      <FilterBar valor={filtro} onChange={setFiltro} />
      <Card className="overflow-hidden [&>div]:p-0">
        <TabelaPessoas
          pessoas={leads}
          carregando={carregando}
          colunas={['inicio', 'nome', 'whatsapp', 'motivo', 'status', 'ultima']}
          vazio="Nenhum lead em follow up no período."
        />
      </Card>
      <p className="mt-3 text-xs texto-suave">
        Os follow ups saem 20 minutos, 24 horas e 36 horas depois da última mensagem do lead, das 8h às 21h,
        enquanto a secretária de IA e o follow up estiverem ligados em Configurações. Quando o lead responde,
        ele volta para "Conversando".
      </p>
    </>
  )
}
