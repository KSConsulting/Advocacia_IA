import { useParams } from 'react-router-dom'
import FichaPessoa from '../components/FichaPessoa'

/** "Mesma estrutura da página individual do lead, com os mesmos campos e layout." */
export default function ClienteDetalhe() {
  const { id } = useParams()
  return <FichaPessoa key={id} id={id!} voltarPara="/clientes" />
}
