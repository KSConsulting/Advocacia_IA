import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import type { LeadAdv } from '../types'
import { formatarDataHora, tempoDesde } from '../lib/datas'
import { formatarWhatsapp } from '../lib/telefone'
import { BadgeLead } from './ui/Badge'
import { Carregando, Vazio } from './ui/Card'

type Coluna = 'inicio' | 'nome' | 'whatsapp' | 'motivo' | 'status' | 'ultima'

const TITULOS: Record<Coluna, string> = {
  inicio: 'Início do Atendimento',
  nome: 'Nome',
  whatsapp: 'WhatsApp',
  motivo: 'Motivo do Contato',
  status: 'Status',
  ultima: 'Última Mensagem',
}

/** A tabela de Dashboard, Leads, Clientes e Follow Up — mesmas colunas, cada uma com as suas. */
export default function TabelaPessoas({
  pessoas, colunas, carregando, rotaBase = '/leads', vazio = 'Nenhum lead no período selecionado.',
}: {
  pessoas: LeadAdv[]
  colunas: Coluna[]
  carregando: boolean
  rotaBase?: string
  vazio?: string
}) {
  const navegar = useNavigate()

  if (carregando) return <Carregando />
  if (!pessoas.length) return <Vazio icone={<Users size={28} strokeWidth={1.25} />} texto={vazio} />

  return (
    <div className="overflow-x-auto">
      <table className="tabela">
        <thead>
          <tr>{colunas.map((c) => <th key={c}>{TITULOS[c]}</th>)}</tr>
        </thead>
        <tbody>
          {pessoas.map((p) => (
            <tr key={p.id} className="clicavel" onClick={() => navegar(`${rotaBase}/${p.id}`)}>
              {colunas.map((c) => (
                <td key={c} className={c === 'motivo' ? 'max-w-[260px] truncate' : 'whitespace-nowrap'}>
                  {c === 'inicio' && formatarDataHora(p.inicio_atendimento)}
                  {c === 'nome' && (p.nome_lead || <span className="texto-suave">Sem nome</span>)}
                  {c === 'whatsapp' && formatarWhatsapp(p.whatsapp_lead)}
                  {c === 'motivo' && (p.motivo_contato || <span className="texto-suave">—</span>)}
                  {c === 'status' && <BadgeLead status={p.status} />}
                  {c === 'ultima' && (
                    <span title={formatarDataHora(p.ultima_mensagem)}>{tempoDesde(p.ultima_mensagem)}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pessoas.length >= 1000 && (
        <p className="px-4 py-3 text-xs texto-suave">
          Mostrando os primeiros 1000. Reduza o período para ver o restante.
        </p>
      )}
    </div>
  )
}
