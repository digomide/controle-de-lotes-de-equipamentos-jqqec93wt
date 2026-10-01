export interface PropertyData {
  endereco: string
  bairroCidade: string
  areaPrivativa: string
  fracaoIdeal: string
  padraoEdificio: string
  estadoConservacao: string
  iptuStatus: string
  iptuDetalhes: string
}

export interface MarketBandData {
  alertaReferencia: string
  conservadorValor: number
  conservadorM2: string
  baseValorTexto: string
  baseValorAdotado: number
  baseM2: string
  otimistaValor: number
  otimistaM2: string
}

export interface MarketSample {
  endereco: string
  area: string
  valor: number
  m2: number
  detalhes?: string
}

export interface OperationValues {
  valorReferencia: number
  valorOferta: number
  percentualOferta: number
  entradaDivida: number
  saldoFinanciado: number
  totalParcelas: number
  valorParcelaPadrao: number
  valorUltimaParcela: number
  itbiEstimado: number
  escrituraRegistroEstimado: number
  custosTransferencia: number
  totalComprometimento: number
}

export interface TextClause {
  titulo: string
  texto: string
}

export interface PropertyProposalConfig {
  code: string
  titulo: string
  subtitulo: string
  cidadeUf: string
  dataEmissaoPersonalizada?: string
  dadosImovel: PropertyData
  faixasMercado: MarketBandData
  amostrasMercado: MarketSample[]
  valoresOperacao: OperationValues
  detalhesEntrada: string
  detalhesSaldo: string
  justificativasDesconto: TextClause[]
  clausulasJuridicas: TextClause[]
  notaImportante: string
  rodapeEsquerdo: string
  rodapeDireito: string
  updatedAt?: string
}

export const DEFAULT_PROPOSAL_CONFIG: PropertyProposalConfig = {
  code: 'francisco-sales-40-apto-905',
  titulo: 'PROPOSTA DE COMPRA E VENDA — APARTAMENTO RESIDENCIAL',
  subtitulo: 'Avenida Francisco Sales, nº 40, Apto 905 — Floresta, Belo Horizonte/MG',
  cidadeUf: 'Belo Horizonte — MG',
  dadosImovel: {
    endereco: 'Av. Francisco Sales, nº 40, Apto 905',
    bairroCidade: 'Floresta — Belo Horizonte, MG — CEP 30150-210 (Região Centro)',
    areaPrivativa: '70,09 m² privativos',
    fracaoIdeal: 'Fração ideal: 0,006873 (~145 unidades no condomínio)',
    padraoEdificio: 'AP3 / P3 · Zona C31/ZA',
    estadoConservacao: 'Edifício antigo, imóvel necessitando de reforma integral',
    iptuStatus: 'IPTU 2026 Quitado',
    iptuDetalhes: 'Anual: R$ 1.482,99 (~R$ 135/mês) · Venal: R$ 95.262 (~R$ 1.360/m²)',
  },
  faixasMercado: {
    alertaReferencia:
      'Registro informal de venda recente (há ~3 meses) de apartamento similar no mesmo prédio na ordem de R$ 350.000,00. Dado tratado com prudência como referência a confirmar via síndico/guia de ITBI.',
    conservadorValor: 300000,
    conservadorM2: '~R$ 4.280/m² (estado atual s/ reforma)',
    baseValorTexto: 'R$ 330.000 a R$ 350.000',
    baseValorAdotado: 350000,
    baseM2: '~R$ 4.993/m²',
    otimistaValor: 380000,
    otimistaM2: '~R$ 5.420/m² (totalmente modernizado)',
  },
  amostrasMercado: [
    { endereco: 'Rua Curvelo, Floresta', area: '70 m²', valor: 380000, m2: 5428 },
    { endereco: 'Rua Jacuí, Floresta', area: '60 m²', valor: 400000, m2: 6666 },
    { endereco: 'Av. do Contorno, Floresta', area: '50 m²', valor: 380000, m2: 7600 },
    { endereco: 'Rua Curvelo, Floresta', area: '60 m²', valor: 370000, m2: 6166 },
  ],
  valoresOperacao: {
    valorReferencia: 350000,
    valorOferta: 245000,
    percentualOferta: 70,
    entradaDivida: 45000,
    saldoFinanciado: 200000,
    totalParcelas: 29,
    valorParcelaPadrao: 7000,
    valorUltimaParcela: 6000,
    itbiEstimado: 7350,
    escrituraRegistroEstimado: 5000,
    custosTransferencia: 12350,
    totalComprometimento: 257350,
  },
  detalhesEntrada:
    'Entrada de R$ 45.000,00 (quarenta e cinco mil reais), a ser paga até dezembro de 2025 diretamente às credoras pelo comprador mediante recibo e petição de quitação judicial da dívida trabalhista acordada. O montante é integralmente abatido do preço da compra.',
  detalhesSaldo:
    'Saldo de R$ 200.000,00 pago diretamente à família/proprietária em 29 parcelas mensais sucessivas: 28 parcelas fixas de R$ 7.000,00 e a última (29ª) ajustada para R$ 6.000,00 (28 × 7.000 = 196.000 + 6.000 = R$ 200.000,00 exatos), iniciando no mês subsequente à formalização da assinatura.',
  justificativasDesconto: [
    {
      titulo: '(a) Reserva de Usufruto Vitalício:',
      texto:
        'O proponente adquire a nua-propriedade e renuncia à posse direta imediata, mantendo a proprietária com garantia de moradia e fruição vitalícia. A nua-propriedade possui valor de mercado expressivamente inferior à propriedade plena.',
    },
    {
      titulo: '(b) Estado de Conservação:',
      texto:
        'Trata-se de edificação antiga com necessidade premente de reforma integral de instalações elétricas, hidráulicas, esquadrias e revestimentos a expensas do adquirente.',
    },
    {
      titulo: '(c) Liquidez Imediata e Resolução Judicial:',
      texto:
        'Extinção completa do passivo judicial das cuidadoras com quitação em dinheiro sem deságio contra a família, eliminando risco de penhora ou leilão judicial.',
    },
  ],
  clausulasJuridicas: [
    {
      titulo: 'Reserva de Usufruto Vitalício na Matrícula:',
      texto:
        'Aquisição exclusiva da nua-propriedade, com gravação de usufruto vitalício formal em favor da proprietária no Cartório de Registro de Imóveis, assegurando moradia e posse direta perpétua.',
    },
    {
      titulo: 'Laudo Médico de Lucidez:',
      texto:
        'Apresentação de atestado/laudo de higidez mental e plena lucidez da proprietária no ato da assinatura, conferindo segurança jurídica irretratável perante terceiros e herdeiros.',
    },
    {
      titulo: 'Assunção e Quitação da Dívida Trabalhista:',
      texto:
        'Instrumento com interveniência e anuência expressa das credoras e advogados, com recibos de pagamento depositados e comprovação de baixa do passivo no processo judicial.',
    },
    {
      titulo: 'Due Diligence Imobiliária Completa:',
      texto:
        'Exibição de certidão de matrícula atualizada (ônus reais e ações reipersecutórias), certidão negativa de débitos condominiais e minuta elaborada por advogado imobilista.',
    },
  ],
  notaImportante:
    'Documento de proposta de negócio — valores sujeitos a confirmação de documentação e verificação de matrícula. Não constitui promessa de compra e venda definitiva.',
  rodapeEsquerdo: 'AmbicorpFlow · Emissão Especial de Proposta Imobiliária',
  rodapeDireito: 'Folha de Apresentação Familiar / Formal',
}

export const PROPOSTA_IMOVEL_STORAGE_KEY = 'proposta-imovel-v2'

export const propertyProposalService = {
  /**
   * Obtém a proposta salva no localStorage ('proposta-imovel-v1'), com fallback garantido
   * para a configuração padrão aprovada.
   */
  getProposal(): PropertyProposalConfig {
    try {
      const stored = localStorage.getItem(PROPOSTA_IMOVEL_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ...DEFAULT_PROPOSAL_CONFIG,
          ...parsed,
          valoresOperacao: {
            ...DEFAULT_PROPOSAL_CONFIG.valoresOperacao,
            ...(parsed.valoresOperacao || {}),
          },
          faixasMercado: {
            ...DEFAULT_PROPOSAL_CONFIG.faixasMercado,
            ...(parsed.faixasMercado || {}),
          },
          dadosImovel: {
            ...DEFAULT_PROPOSAL_CONFIG.dadosImovel,
            ...(parsed.dadosImovel || {}),
          },
        }
      }
    } catch (e) {
      console.warn('Erro ao ler proposta do localStorage:', e)
    }
    return DEFAULT_PROPOSAL_CONFIG
  },

  /**
   * Salva a proposta diretamente no localStorage ('proposta-imovel-v1') sem chamadas ao backend.
   */
  saveProposal(proposal: PropertyProposalConfig): PropertyProposalConfig {
    const updated: PropertyProposalConfig = {
      ...proposal,
      updatedAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem(PROPOSTA_IMOVEL_STORAGE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('property_proposal_updated', { detail: updated }))
    } catch (err) {
      console.error('Erro ao salvar proposta no localStorage:', err)
    }

    return updated
  },

  /**
   * Restaura os valores padrão originais da proposta limpando o localStorage.
   */
  resetToDefault(): PropertyProposalConfig {
    try {
      localStorage.removeItem(PROPOSTA_IMOVEL_STORAGE_KEY)
    } catch (e) {
      console.warn('Erro ao limpar localStorage:', e)
    }
    const standard = { ...DEFAULT_PROPOSAL_CONFIG, updatedAt: undefined }
    window.dispatchEvent(new CustomEvent('property_proposal_updated', { detail: standard }))
    return standard
  },
}
