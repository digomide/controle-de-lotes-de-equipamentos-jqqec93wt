export interface ReembolsoImovelData {
  apartamentoNumero: string
  enderecoCompleto: string
  matriculaNumero: string
  cartorioRegistro: string
}

export interface ReembolsoCompradorData {
  nomeCompleto: string
  nacionalidade: string
  estadoCivil: string
  profissao: string
  rgNumero: string
  cpfNumero: string
  endereco: string
}

export interface ReembolsoProprietariaData {
  nomeBase: string // 'ANNA SALOMÉ'
  sobrenome: string
  idade: string // '98'
  cpfNumero: string
  processoNumero: string
  varaNumero: string
  comarca: string
  curadorNomeQualificacao: string
}

export interface GarantidorData {
  id: string
  nomePrimeiro: string
  sobrenome: string
  qualificacao: string
}

export interface ReembolsoOperacaoData {
  valorTotal: string
  valorExtenso: string
  valorEntrada: string
  entradaObservacao: string // ex: 'ajustar se os "45" forem percentual' ou 'paga ou por pagar'
  valoresPendentesEspecificacao: string
  processoAutosNumero: string
  correcaoIndice: string // ex: 'IPCA/IBGE'
  prazoReembolsoDias: string // '15', '30' ou livre
  formaPagamento: string // 'dinheiro/PIX/transferência bancária'
  multaJurosAtivo: boolean // Cláusula 3.2 opcional
  multaJurosPrazoDias: string // '15', '30'
  multaJurosTaxaJuros: string // '1% ao mês'
  multaJurosTaxaMulta: string // '2% sobre o total devido'
  comarcaForo: string
  localData: string
}

export interface ReembolsoConfig {
  imovel: ReembolsoImovelData
  comprador: ReembolsoCompradorData
  proprietaria: ReembolsoProprietariaData
  garantidores: GarantidorData[]
  operacao: ReembolsoOperacaoData
  testemunhas: {
    testemunha1: string
    testemunha2: string
  }
  updatedAt?: string
}

export const DEFAULT_REEMBOLSO_CONFIG: ReembolsoConfig = {
  imovel: {
    apartamentoNumero: '',
    enderecoCompleto: 'Avenida Francisco Sales, nº 40, Floresta, Belo Horizonte/MG, CEP 30150-210',
    matriculaNumero: '',
    cartorioRegistro: 'Belo Horizonte/MG',
  },
  comprador: {
    nomeCompleto: '',
    nacionalidade: 'brasileiro(a)',
    estadoCivil: '',
    profissao: '',
    rgNumero: '',
    cpfNumero: '',
    endereco: '',
  },
  proprietaria: {
    nomeBase: 'ANNA SALOMÉ',
    sobrenome: '',
    idade: '98 anos',
    cpfNumero: '',
    processoNumero: '',
    varaNumero: '',
    comarca: 'Belo Horizonte/MG',
    curadorNomeQualificacao: '',
  },
  garantidores: [
    {
      id: 'odilon',
      nomePrimeiro: 'ODILON',
      sobrenome: '',
      qualificacao: '',
    },
    {
      id: 'maria_luisa',
      nomePrimeiro: 'MARIA LUÍSA',
      sobrenome: '',
      qualificacao: '',
    },
    {
      id: 'tereza_christina',
      nomePrimeiro: 'TEREZA CHRISTINA',
      sobrenome: '',
      qualificacao: '',
    },
    {
      id: 'joao_bosco',
      nomePrimeiro: 'JOÃO BÔSCO',
      sobrenome: '',
      qualificacao: '',
    },
    {
      id: 'jose_flavio',
      nomePrimeiro: 'JOSÉ FLÁVIO',
      sobrenome: '',
      qualificacao: '',
    },
  ],
  operacao: {
    valorTotal: '',
    valorExtenso: '',
    valorEntrada: '45.000,00',
    entradaObservacao: '', // Se preenchido, pode adicionar anotação ou manter o padrão
    valoresPendentesEspecificacao: 'dívidas de IPTU, condomínio, dívida sub-rogada etc.',
    processoAutosNumero: '',
    correcaoIndice: 'IPCA/IBGE',
    prazoReembolsoDias: '15',
    formaPagamento: 'dinheiro/PIX/transferência bancária',
    multaJurosAtivo: true,
    multaJurosPrazoDias: '15',
    multaJurosTaxaJuros: '1% ao mês',
    multaJurosTaxaMulta: '2% sobre o total devido',
    comarcaForo: 'Belo Horizonte/MG',
    localData:
      'Belo Horizonte/MG, ' +
      new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date()),
  },
  testemunhas: {
    testemunha1: '',
    testemunha2: '',
  },
}

export const REEMBOLSO_STORAGE_KEY = 'termo-reembolso-v1'

export const reimbursementService = {
  /**
   * Obtém as configurações do instrumento de reembolso salvas no localStorage
   * com fallback para o padrão legal exato fornecido.
   */
  getConfig(): ReembolsoConfig {
    try {
      const stored = localStorage.getItem(REEMBOLSO_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ...DEFAULT_REEMBOLSO_CONFIG,
          ...parsed,
          imovel: {
            ...DEFAULT_REEMBOLSO_CONFIG.imovel,
            ...(parsed.imovel || {}),
          },
          comprador: {
            ...DEFAULT_REEMBOLSO_CONFIG.comprador,
            ...(parsed.comprador || {}),
          },
          proprietaria: {
            ...DEFAULT_REEMBOLSO_CONFIG.proprietaria,
            ...(parsed.proprietaria || {}),
          },
          garantidores:
            Array.isArray(parsed.garantidores) && parsed.garantidores.length === 5
              ? parsed.garantidores
              : DEFAULT_REEMBOLSO_CONFIG.garantidores,
          operacao: {
            ...DEFAULT_REEMBOLSO_CONFIG.operacao,
            ...(parsed.operacao || {}),
          },
          testemunhas: {
            ...DEFAULT_REEMBOLSO_CONFIG.testemunhas,
            ...(parsed.testemunhas || {}),
          },
        }
      }
    } catch (e) {
      console.warn('Erro ao ler instrumento de reembolso do localStorage:', e)
    }
    return DEFAULT_REEMBOLSO_CONFIG
  },

  /**
   * Salva os dados do documento no localStorage e dispara evento para sincronização.
   */
  saveConfig(config: ReembolsoConfig): ReembolsoConfig {
    const updated: ReembolsoConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(REEMBOLSO_STORAGE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('reembolso_config_updated', { detail: updated }))
    } catch (err) {
      console.error('Erro ao salvar instrumento de reembolso no localStorage:', err)
    }
    return updated
  },

  /**
   * Restaura os valores padrão originais do documento.
   */
  resetToDefault(): ReembolsoConfig {
    try {
      localStorage.removeItem(REEMBOLSO_STORAGE_KEY)
    } catch (e) {
      console.warn('Erro ao limpar instrumento de reembolso no localStorage:', e)
    }
    const standard: ReembolsoConfig = {
      ...DEFAULT_REEMBOLSO_CONFIG,
      operacao: {
        ...DEFAULT_REEMBOLSO_CONFIG.operacao,
        localData:
          'Belo Horizonte/MG, ' +
          new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date()),
      },
      updatedAt: undefined,
    }
    window.dispatchEvent(new CustomEvent('reembolso_config_updated', { detail: standard }))
    return standard
  },
}
