import type { Motorista, StatusMotorista } from './motoristas.rules'

const STORAGE_KEY_MOTORISTAS = '@fsph_frota_motoristas_locais'

const motoristaValidoNoStorage = (valor: unknown): valor is Motorista => {
  if (!valor || typeof valor !== 'object') return false
  const motorista = valor as Partial<Motorista>
  return (
    typeof motorista.id === 'string' &&
    typeof motorista.nome === 'string' &&
    typeof motorista.cpf === 'string' &&
    typeof motorista.numeroCnh === 'string' &&
    typeof motorista.categoriaCnh === 'string' &&
    typeof motorista.validadeCnh === 'string' &&
    typeof motorista.status === 'string' &&
    ['Em rota', 'Disponível', 'Indisponível', 'Inativo'].includes(motorista.status) &&
    typeof motorista.contato === 'string' &&
    (motorista.email === undefined || typeof motorista.email === 'string')
  )
}

export const carregarMotoristasMock = (): Motorista[] => {
  try {
    const armazenados = localStorage.getItem(STORAGE_KEY_MOTORISTAS)
    if (!armazenados) return []

    const dados: unknown = JSON.parse(armazenados)
    if (!Array.isArray(dados) || !dados.every(motoristaValidoNoStorage)) {
      throw new Error('Os dados locais de motoristas estão em formato inválido.')
    }
    return dados
  } catch (error) {
    console.error('Não foi possível carregar os motoristas mock salvos neste navegador.', error)
    return []
  }
}

export const salvarMotoristasMock = (motoristas: Motorista[]) => {
  localStorage.setItem(STORAGE_KEY_MOTORISTAS, JSON.stringify(motoristas))
}

export const simularCadastroMotorista = () => ({ sucesso: true })

export const simularAtualizacaoStatusMotorista = (
  motoristas: Motorista[],
  motoristaId: string,
  status: StatusMotorista
) => {
  const atualizados = motoristas.map((motorista) =>
    motorista.id === motoristaId ? { ...motorista, status } : motorista
  )
  salvarMotoristasMock(atualizados)
  return atualizados
}

const diasAteVencimento = (validade: string, hoje: string) => {
  const diaUtc = (data: string) => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data)
    if (!partes) return Number.NaN
    return Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]))
  }
  return (diaUtc(validade) - diaUtc(hoje)) / (1000 * 60 * 60 * 24)
}

export const calcularIndicadoresMock = (
  motoristas: Motorista[],
  hoje = new Date()
) => {
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const ativos = motoristas.filter((motorista) => motorista.status !== 'Inativo')
  const cnHsComAtencao = ativos
    .map((motorista) => diasAteVencimento(motorista.validadeCnh, hojeIso))
    .filter((dias) => dias <= 30)

  const cnHsVencidas = cnHsComAtencao.filter((dias) => dias <= 0).length

  return {
    emServico: motoristas.filter((motorista) => motorista.status === 'Em rota').length,
    disponiveis: motoristas.filter((motorista) => motorista.status === 'Disponível').length,
    cnHsVencidas,
    cnHsVencendo: cnHsComAtencao.length - cnHsVencidas,
  }
}
