/**
 * Configuração Centralizada da Loja Pública de Equipamentos
 *
 * Altere aqui os dados de contato, WhatsApp e informações da loja pública.
 * Todas as mensagens pré-formatadas do WhatsApp e links do catálogo público
 * utilizam estas constantes.
 */

export interface StoreConfig {
  /** Nome comercial exibido no topo e nos metadados */
  name: string
  /** Subtítulo / slogan da loja */
  tagline: string
  /**
   * Número de WhatsApp no formato internacional sem símbolos (DDI + DDD + Número)
   * Exemplo: "5511999998888" (55 = Brasil, 11 = São Paulo, 99999-8888 = celular)
   * Substitua pelo número real de atendimento da loja:
   */
  whatsappNumber: string
  /** Formatação amigável para exibição visual do telefone/WhatsApp */
  whatsappDisplay: string
  /** E-mail opcional de contato para clientes */
  email: string
  /** Horário de atendimento */
  businessHours: string
  /** Cidade/UF ou endereço da loja física / retirada */
  location: string
}

export const STORE_CONFIG: StoreConfig = {
  name: 'Ambicorp Equipamentos',
  tagline: 'Notebooks corporativos seminovos revisados com garantia e procedência',
  // PLACEHOLDER CLARO: Altere este número para o WhatsApp comercial da sua empresa (apenas dígitos: DDI + DDD + Número)
  whatsappNumber: '5511999998888',
  whatsappDisplay: '(11) 99999-8888',
  email: 'contato@ambicorp.com.br',
  businessHours: 'Segunda a Sexta, das 08h às 18h',
  location: 'São Paulo - SP',
}

/**
 * Helper para gerar link direto wa.me com mensagem codificada para o WhatsApp
 */
export function buildWhatsAppLink(product: {
  name: string
  brand?: string
  model?: string
  sku?: string
  serial_number?: string
  unit_price?: number
}): string {
  const brandModel = [product.brand, product.model].filter(Boolean).join(' ') || product.name
  const serial = product.serial_number || product.sku || 'N/I'
  const priceFormatted = Number(product.unit_price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  const message = `Olá! Tenho interesse no ${brandModel}, serial ${serial}, anunciado por ${priceFormatted}. Ainda está disponível?`
  return `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`
}

/**
 * Helper para gerar link de contato geral via WhatsApp
 */
export function buildGeneralWhatsAppLink(subject?: string): string {
  const message = subject
    ? `Olá! Gostaria de tirar uma dúvida sobre: ${subject}`
    : `Olá! Vim pelo catálogo online e gostaria de falar com a equipe de vendas.`
  return `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`
}
