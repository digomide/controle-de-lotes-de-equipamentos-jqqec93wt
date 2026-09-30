/**
 * Serviço de Gerenciamento e Persistência do Cartão de Satisfação Pós-Venda
 * Salvo no localStorage para personalização rápida (Telefone/WhatsApp, Empresa, Slogan, etc.)
 */

export interface CartaoPosVendaConfig {
  tituloCabecalho: string
  subtituloMarca: string
  textoAtencao: string
  tituloSecaoProblema: string
  perguntaArrependimento: string
  passo1: string
  passo2: string
  opcaoDevolucao: string
  textoVantagem: string
  textoAtendimentoWhatsApp: string
  whatsappNumero: string
  marcasRodape: string
  sloganRodape: string
  marcaSecundaria: string
  updatedAt?: string
}

export const DEFAULT_CARTAO_POS_VENDA_CONFIG: CartaoPosVendaConfig = {
  tituloCabecalho: 'GRATO PELA COMPRA DO NOSSO PRODUTO',
  subtituloMarca: 'AMBICORP',
  textoAtencao:
    'ATENÇÃO: Caso ocorra qualquer divergência ou problema com sua mercadoria, pedimos que não abra reclamação. Entre em contato diretamente conosco. Assim, resolveremos seu problema de forma mais rápida. RECLAMAÇÃO É UM PROCESSO BUROCRÁTICO E, PORTANTO, AUMENTA MUITO O TEMPO PARA RESOLUÇÃO.',
  tituloSecaoProblema: 'RECEBEU A SUA COMPRA COM ALGUM PROBLEMA?',
  perguntaArrependimento: 'Se arrependeu da compra ou não precisa mais do produto?',
  passo1: 'Nos detalhes da compra, selecione "Devolver grátis"',
  passo2: 'Na tela seguinte, escolha a opção:',
  opcaoDevolucao: '"A minha compra chegou em boas condições, mas eu não a quero mais."',
  textoVantagem: 'Dessa forma, ninguém terá prejuízo e será grátis para você.',
  textoAtendimentoWhatsApp:
    'Para outros esclarecimentos ou ajuda com sua compra, entre em contato pelo WhatsApp (somente mensagens). Atendimento:',
  whatsappNumero: '(XX) XXXXX-XXXX',
  marcasRodape: 'AMBICORP',
  sloganRodape: 'Tecnologia e Qualidade',
  marcaSecundaria: 'INFOPRECOBAIXO',
}

export const CARTAO_POS_VENDA_STORAGE_KEY = 'cartao-pos-venda-config-v1'

export const cartaoPosVendaService = {
  /**
   * Obtém as configurações salvas no localStorage com fallback para o padrão oficial.
   */
  getConfig(): CartaoPosVendaConfig {
    try {
      const stored = localStorage.getItem(CARTAO_POS_VENDA_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ...DEFAULT_CARTAO_POS_VENDA_CONFIG,
          ...parsed,
        }
      }
    } catch (e) {
      console.warn('Erro ao ler configuração do cartão pós-venda do localStorage:', e)
    }
    return DEFAULT_CARTAO_POS_VENDA_CONFIG
  },

  /**
   * Salva a configuração editada no localStorage e emite evento customizado.
   */
  saveConfig(config: CartaoPosVendaConfig): CartaoPosVendaConfig {
    const updated: CartaoPosVendaConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem(CARTAO_POS_VENDA_STORAGE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('cartao_pos_venda_updated', { detail: updated }))
    } catch (err) {
      console.error('Erro ao salvar configuração do cartão pós-venda:', err)
    }

    return updated
  },

  /**
   * Restaura os textos padrões originais.
   */
  resetToDefault(): CartaoPosVendaConfig {
    try {
      localStorage.removeItem(CARTAO_POS_VENDA_STORAGE_KEY)
    } catch (e) {
      console.warn('Erro ao resetar localStorage do cartão:', e)
    }
    const standard = { ...DEFAULT_CARTAO_POS_VENDA_CONFIG, updatedAt: undefined }
    window.dispatchEvent(new CustomEvent('cartao_pos_venda_updated', { detail: standard }))
    return standard
  },
}
