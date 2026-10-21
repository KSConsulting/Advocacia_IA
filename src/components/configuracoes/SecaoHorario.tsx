import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Card, { Carregando } from '../ui/Card'
import Button from '../ui/Button'
import GradeHorarios from './GradeHorarios'
import { horariosValidos, type LinhaHorario } from '../../lib/horarios'

/** Seção 2 da especificação — Horário de Funcionamento. */
export default function SecaoHorario() {
  const { ehAdmin } = useAuth()
  const toast = useToast()
  const [linhas, setLinhas] = useState<LinhaHorario[] | null>(null)
  const [original, setOriginal] = useState<LinhaHorario[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('office_hours').select('*').then(({ data }) => {
      setLinhas((data ?? []) as LinhaHorario[])
      setOriginal((data ?? []) as LinhaHorario[])
    })
  }, [])

  if (!linhas) return <Carregando />

  const salvar = async () => {
    if (!horariosValidos(linhas)) return toast.erro('Confira os horários: o fim precisa ser depois do início.')
    setSalvando(true)
    // Só os dias alterados.
    const mudados = linhas.filter((l) => JSON.stringify(l) !== JSON.stringify(original.find((o) => o.id === l.id)))
    const resultados = await Promise.all(mudados.map((l) =>
      supabase.from('office_hours').update({
        aberto: l.aberto,
        hora_inicio: l.aberto ? l.hora_inicio : null,
        hora_fim: l.aberto ? l.hora_fim : null,
      }).eq('id', l.id),
    ))
    setSalvando(false)
    if (resultados.some((r) => r.error)) return toast.erro('Não foi possível salvar os horários.')
    setOriginal(linhas)
    toast.sucesso('Horários salvos.')
  }

  return (
    <Card
      titulo="Horário de Funcionamento"
      descricao="As alterações no horário de funcionamento refletem automaticamente no gráfico de Atendimentos por Horário no dashboard — e é o horário que a secretária de IA informa ao cliente. A agenda de cada advogado fica na aba Advogados."
    >
      <GradeHorarios linhas={linhas} onChange={setLinhas} desabilitado={!ehAdmin} />
      {ehAdmin && (
        <div className="mt-4 flex justify-end">
          <Button carregando={salvando} onClick={salvar}>Salvar horários</Button>
        </div>
      )}
    </Card>
  )
}
