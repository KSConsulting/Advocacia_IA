import { useParams } from 'react-router-dom'
import FichaPessoa from '../components/FichaPessoa'

export default function LeadDetalhe() {
  const { id } = useParams()
  return <FichaPessoa key={id} id={id!} voltarPara="/leads" />
}
