export type StatusMotorista = 'Em rota' | 'Disponível' | 'Indisponível' | 'Inativo'

export interface Motorista {
  id: string
  nome: string
  cpf: string
  numeroCnh: string
  categoriaCnh: string
  validadeCnh: string
  status: StatusMotorista
  contato: string
  email?: string
}

export interface ResultadoImportacaoCsv {
  motoristas: Motorista[]
  erros: string[]
  errosRestantes: number
}

export const categoriasCnh = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']

export const formatarCpf = (valor: string) => {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  return digitos
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export const cpfValido = (cpf: string) => {
  const digitos = cpf.replace(/\D/g, '')
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false

  const calcularDigito = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce(
      (total, digito, index) => total + Number(digito) * (pesoInicial - index),
      0
    )
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  const primeiroDigito = calcularDigito(digitos.slice(0, 9), 10)
  if (primeiroDigito !== Number(digitos[9])) return false

  const segundoDigito = calcularDigito(digitos.slice(0, 10), 11)
  return segundoDigito === Number(digitos[10])
}

const normalizarCabecalho = (valor: string) =>
  valor
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

const analisarCsv = (conteudo: string, delimitador: string): string[][] => {
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let entreAspas = false

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice]

    if (caractere === '"') {
      if (entreAspas && conteudo[indice + 1] === '"') {
        campo += '"'
        indice += 1
      } else {
        entreAspas = !entreAspas
      }
    } else if (caractere === delimitador && !entreAspas) {
      linha.push(campo)
      campo = ''
    } else if ((caractere === '\n' || caractere === '\r') && !entreAspas) {
      if (caractere === '\r' && conteudo[indice + 1] === '\n') indice += 1
      linha.push(campo)
      if (linha.some((valor) => valor.trim())) linhas.push(linha)
      linha = []
      campo = ''
    } else {
      campo += caractere
    }
  }

  if (entreAspas) throw new Error('O arquivo CSV contém aspas sem fechamento.')

  linha.push(campo)
  if (linha.some((valor) => valor.trim())) linhas.push(linha)
  return linhas
}

const detectarDelimitador = (cabecalho: string) => {
  const contagem = [',', ';', '\t'].map((delimitador) => {
    let entreAspas = false
    let total = 0

    for (let indice = 0; indice < cabecalho.length; indice += 1) {
      if (cabecalho[indice] === '"') {
        if (entreAspas && cabecalho[indice + 1] === '"') {
          indice += 1
        } else {
          entreAspas = !entreAspas
        }
      } else if (cabecalho[indice] === delimitador && !entreAspas) {
        total += 1
      }
    }
    return { delimitador, total }
  })

  return contagem.sort((a, b) => b.total - a.total)[0].delimitador
}

const parsearDataCsv = (valor: string) => {
  const texto = valor.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)
  const partes = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : brasileira
      ? [Number(brasileira[3]), Number(brasileira[2]), Number(brasileira[1])]
      : null
  if (!partes) return null

  const [ano, mes, dia] = partes
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null
  }
  return `${ano.toString().padStart(4, '0')}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`
}

const parsearStatusCsv = (valor: string): StatusMotorista | null => {
  if (!valor.trim()) return 'Disponível'
  const normalizado = valor
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')

  const status: Record<string, StatusMotorista> = {
    'EM ROTA': 'Em rota',
    DISPONIVEL: 'Disponível',
    INDISPONIVEL: 'Indisponível',
    INATIVO: 'Inativo',
  }
  return status[normalizado] ?? null
}

type CampoImportavel =
  | 'nome'
  | 'cpf'
  | 'numeroCnh'
  | 'categoriaCnh'
  | 'validadeCnh'
  | 'contato'
  | 'email'
  | 'status'

const aliasesCabecalho: Record<CampoImportavel, string[]> = {
  nome: ['nome', 'nome_completo'],
  cpf: ['cpf'],
  numeroCnh: ['numero_cnh', 'cnh'],
  categoriaCnh: ['categoria_cnh', 'categoria'],
  validadeCnh: ['validade_cnh', 'validade'],
  contato: ['contato', 'telefone', 'celular'],
  email: ['email', 'e_mail'],
  status: ['status'],
}

export const importarMotoristasCsv = (
  conteudo: string,
  motoristasExistentes: Motorista[]
): ResultadoImportacaoCsv => {
  const csv = conteudo.replace(/^\uFEFF/, '')
  const primeiraLinha = csv.split(/\r?\n/, 1)[0] ?? ''
  const linhas = analisarCsv(csv, detectarDelimitador(primeiraLinha))
  if (linhas.length < 2) {
    throw new Error('O CSV precisa conter cabeçalho e pelo menos uma linha de dados.')
  }

  const cabecalhos = linhas[0].map(normalizarCabecalho)
  const indices: Partial<Record<CampoImportavel, number>> = {}
  for (const campo of Object.keys(aliasesCabecalho) as CampoImportavel[]) {
    const aliases = aliasesCabecalho[campo]
    const indice = cabecalhos.findIndex((cabecalho) => aliases.includes(cabecalho))
    if (indice >= 0) indices[campo] = indice
  }

  const camposObrigatorios: CampoImportavel[] = [
    'nome',
    'cpf',
    'numeroCnh',
    'categoriaCnh',
    'validadeCnh',
  ]
  const faltantes = camposObrigatorios.filter((campo) => indices[campo] === undefined)
  if (faltantes.length > 0) {
    throw new Error(`Cabeçalhos obrigatórios ausentes: ${faltantes.join(', ')}.`)
  }

  const obterValor = (linha: string[], campo: CampoImportavel) => {
    const indice = indices[campo]
    return indice === undefined ? '' : (linha[indice] ?? '').trim()
  }

  const candidatos: { motorista: Motorista; numeroLinha: number }[] = []
  const erros: string[] = []
  let errosRestantes = 0
  const registrarErro = (numeroLinha: number, motivo: string) => {
    if (erros.length < 5) erros.push(`Linha ${numeroLinha}: ${motivo}`)
    else errosRestantes += 1
  }

  linhas.slice(1).forEach((linha, indice) => {
    const numeroLinha = indice + 2
    if (linha.length !== cabecalhos.length) {
      registrarErro(numeroLinha, 'quantidade de colunas diferente do cabeçalho.')
      return
    }

    const nome = obterValor(linha, 'nome')
    const cpf = obterValor(linha, 'cpf')
    const numeroCnh = obterValor(linha, 'numeroCnh')
    const categoriaCnh = obterValor(linha, 'categoriaCnh').toLocaleUpperCase('pt-BR')
    const validadeCnh = parsearDataCsv(obterValor(linha, 'validadeCnh'))
    const contato = obterValor(linha, 'contato')
    const email = obterValor(linha, 'email').toLocaleLowerCase('pt-BR')
    const status = parsearStatusCsv(obterValor(linha, 'status'))

    if (!nome || !cpfValido(cpf)) {
      registrarErro(numeroLinha, !nome ? 'nome obrigatório.' : 'CPF inválido.')
      return
    }
    if (!numeroCnh) {
      registrarErro(numeroLinha, 'número da CNH obrigatório.')
      return
    }
    if (!categoriasCnh.includes(categoriaCnh)) {
      registrarErro(numeroLinha, 'categoria da CNH inválida.')
      return
    }
    if (!validadeCnh) {
      registrarErro(numeroLinha, 'validade deve estar no formato AAAA-MM-DD ou DD/MM/AAAA.')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      registrarErro(numeroLinha, 'e-mail inválido.')
      return
    }
    if (!status) {
      registrarErro(numeroLinha, 'status inválido.')
      return
    }

    candidatos.push({
      numeroLinha,
      motorista: {
        id: `LOCAL-${crypto.randomUUID()}`,
        nome,
        cpf: formatarCpf(cpf),
        numeroCnh,
        categoriaCnh,
        validadeCnh,
        status,
        contato,
        ...(email ? { email } : {}),
      },
    })
  })

  const cpfVistos = new Set(
    motoristasExistentes.map((motorista) => motorista.cpf.replace(/\D/g, ''))
  )
  const cnhVistas = new Set(
    motoristasExistentes.map((motorista) =>
      motorista.numeroCnh.trim().toLocaleLowerCase('pt-BR')
    )
  )
  const emailVistos = new Set(
    motoristasExistentes
      .map((motorista) => motorista.email?.trim().toLocaleLowerCase('pt-BR'))
      .filter((email): email is string => Boolean(email))
  )
  const motoristas: Motorista[] = []

  candidatos.forEach(({ motorista, numeroLinha }) => {
    const cpf = motorista.cpf.replace(/\D/g, '')
    const cnh = motorista.numeroCnh.trim().toLocaleLowerCase('pt-BR')
    const email = motorista.email?.trim().toLocaleLowerCase('pt-BR')
    if (cpfVistos.has(cpf) || cnhVistas.has(cnh) || (email && emailVistos.has(email))) {
      registrarErro(numeroLinha, 'motorista duplicado por CPF, CNH ou e-mail.')
      return
    }
    cpfVistos.add(cpf)
    cnhVistas.add(cnh)
    if (email) emailVistos.add(email)
    motoristas.push(motorista)
  })

  return { motoristas, erros, errosRestantes }
}
