import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, UserCheck, Users } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { DIAS_SEMANA, deTexto, intervalo, somarDias, paraTexto } from '../lib/datas'
import { useFiltro } from '../lib/useFiltro'
import type { LeadAdv, OfficeHours } from '../types'
import PageHeader from '../components/ui/PageHeader'
import FilterBar from '../components/ui/FilterBar'
import Card, { Carregando } from '../components/ui/Card'
import TabelaPessoas from '../components/TabelaPessoas'
import { horariosEmTexto } from '../lib/horarios'

interface Resumo {
  total_leads: number
  total_clientes: number
  consultas_hoje: number
  por_dia: { dia: string; total: number }[]
  por_dia_semana: { dow: number; total: number }[]
  dentro_horario: number
  fora_horario: number
}

const TOOLTIP = {
  contentStyle: {
    backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)',
    borderRadius: 8, color: 'var(--text-main)', fontSize: 13,
  },
  cursor: { fill: 'var(--accent-light)' },
}

function CardMetrica({ titulo, valor, sub, Icone }: { titulo: string; valor: number | string; sub: string; Icone: typeof Users }) {
  return (
    <div className="card flex items-start justify-between p-5">
      <div>
        <p className="text-sm texto-suave">{titulo}</p>
        <p className="mt-2 font-display text-3xl font-semibold">{valor}</p>
        <p className="mt-1 text-xs texto-suave">{sub}</p>
      </div>
      <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
        <Icone size={18} strokeWidth={1.5} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [filtro, setFiltro] = useFiltro()
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [leads, setLeads] = useState<LeadAdv[]>([])
  const [horarios, setHorarios] = useState<OfficeHours[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.from('office_hours').select('*').then(({ data }) => setHorarios((data ?? []) as OfficeHours[]))
  }, [])

  useEffect(() => {
    const { inicio, fim } = intervalo(filtro)
    let vivo = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true)
    Promise.all([
      supabase.rpc('dashboard_resumo', { p_inicio: inicio, p_fim: fim }),
      supabase
        .from('leads_adv')
        .select('*')
        .gte('inicio_atendimento', inicio)
        .lt('inicio_atendimento', fim)
        .order('inicio_atendimento', { ascending: false })
        .limit(1000),
    ]).then(([r, l]) => {
      if (!vivo) return
      setResumo(r.data as Resumo | null)
      setLeads((l.data ?? []) as LeadAdv[])
      setCarregando(false)
    })
    return () => { vivo = false }
  }, [filtro])

  // Todos os dias do período no eixo X — inclusive os que não tiveram lead.
  const serieDias = useMemo(() => {
    const mapa = new Map((resumo?.por_dia ?? []).map((d) => [d.dia, d.total]))
    const fim = deTexto(filtro.endDate)
    const pontos: { dia: string; rotulo: string; total: number }[] = []
    for (let d = deTexto(filtro.startDate); paraTexto(d) <= paraTexto(fim) && pontos.length < 400; d = somarDias(d, 1)) {
      const chave = paraTexto(d)
      pontos.push({ dia: chave, rotulo: `${String(d.dia).padStart(2, '0')}/${String(d.mes).padStart(2, '0')}`, total: mapa.get(chave) ?? 0 })
    }
    return pontos
  }, [resumo, filtro])

  const serieSemana = (resumo?.por_dia_semana ?? []).map((d) => ({
    dia: DIAS_SEMANA[d.dow].curto,
    total: d.total,
  }))

  const pizza = [
    { nome: 'Dentro do horário', valor: resumo?.dentro_horario ?? 0, cor: 'var(--primary)' },
    { nome: 'Fora do horário', valor: resumo?.fora_horario ?? 0, cor: 'var(--accent)' },
  ]

  return (
    <>
      <PageHeader
        titulo="Dashboard"
        descricao="Acompanhe os principais indicadores de atendimento do seu escritório no período selecionado — volume de leads, consultas agendadas e o desempenho do Agente de IA nos atendimentos realizados."
      />
      <FilterBar valor={filtro} onChange={setFiltro} />

      {carregando && !resumo ? <Carregando /> : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <CardMetrica titulo="Total de Leads" valor={resumo?.total_leads ?? 0} sub="No período selecionado" Icone={Users} />
            <CardMetrica titulo="Total de Clientes" valor={resumo?.total_clientes ?? 0} sub="No período selecionado" Icone={UserCheck} />
            <CardMetrica titulo="Consultas Hoje" valor={resumo?.consultas_hoje ?? 0} sub="Agendadas para hoje" Icone={CalendarDays} />
          </div>

          <Card
            titulo="Volume de Leads por Dia"
            descricao="Acompanhe a quantidade de leads que entraram em contato com o escritório a cada dia no período selecionado."
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieDias} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border-card)" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP} formatter={(v) => [v, 'Leads']} labelFormatter={(l) => `Dia ${l}`} />
                  <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card
              titulo="Leads por Dia da Semana"
              descricao="Descubra quais dias da semana concentram o maior volume de novos contatos, de segunda a domingo."
            >
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serieSemana} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border-card)" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip {...TOOLTIP} formatter={(v) => [v, 'Leads']} />
                    <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card
              titulo="Atendimentos por Horário"
              descricao="Veja quantos atendimentos foram realizados dentro e fora do horário comercial — e o impacto direto do Agente de IA na captação de leads fora do expediente."
            >
              <p className="mb-2 text-xs texto-suave">Horário comercial: {horariosEmTexto(horarios)}</p>
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pizza} dataKey="valor" nameKey="nome" innerRadius={45} outerRadius={80} stroke="var(--bg-card)">
                        {pizza.map((p) => <Cell key={p.nome} fill={p.cor} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP} formatter={(v) => [`${v} atendimentos`]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex flex-col gap-3 text-sm">
                  {pizza.map((p) => (
                    <li key={p.nome} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.cor }} />
                      <span>{p.nome}:</span>
                      <strong>{p.valor} {p.valor === 1 ? 'atendimento' : 'atendimentos'}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 text-xs italic texto-suave">
                Os atendimentos fora do horário comercial foram realizados pelo Agente de IA. Sem ele, esses leads
                poderiam ter sido perdidos para a concorrência.
              </p>
            </Card>
          </div>

          <Card
            titulo="Leads no Período"
            descricao="Todos os leads que entraram em contato com o escritório no período selecionado. Clique em qualquer linha para acessar o perfil completo do lead."
            className="[&>div]:p-0 [&>div]:pt-3"
          >
            <TabelaPessoas
              pessoas={leads}
              carregando={carregando}
              colunas={['inicio', 'nome', 'whatsapp', 'motivo', 'status']}
            />
          </Card>
        </div>
      )}
    </>
  )
}
