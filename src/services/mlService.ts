import pb from '@/lib/pocketbase/client'
import type { Product } from '@/types/inventory'
import { STORE_CONFIG } from '@/lib/storeConfig'

export interface MLStatusResponse {
  configured: boolean
  connected: boolean
  client_id?: string
  redirect_uri?: string
  nickname?: string
  user_id_ml?: string
  permalink_seller?: string
}

export interface MLItemResponse {
  id: string
  title: string
  price: number
  status: 'active' | 'paused' | 'closed' | string
  sub_status?: string[]
  permalink: string
  available_quantity: number
  sold_quantity: number
}

export interface MLPublishPayload {
  product_id: string
  title?: string
  price?: number
  category_id?: string
  description?: string
  pictures?: string[]
}

export interface MLPublishResponse {
  success: boolean
  ml_listing_id: string
  ml_listing_url: string
  ml_listing_status: string
  error?: string
}

/**
 * Categorias populares do Mercado Livre Brasil para notebooks e informática
 */
export const ML_CATEGORIES = [
  { id: 'MLB1652', label: 'Notebooks (MLB1652)' },
  { id: 'MLB431427', label: 'Notebooks Corporativos / Outros (MLB431427)' },
  { id: 'MLB1649', label: 'Computadores e Servidores (MLB1649)' },
]

/**
 * Gera título otimizado respeitando o limite máximo de 60 caracteres da API do Mercado Livre
 */
export function generateMLTitle(product: Product): string {
  const brand = (product.brand || '').trim()
  const model = (product.model || '').trim()
  const proc = (product.processor || '').replace(/Processador\s*/i, '').trim()
  const ram = (product.ram || '').trim()
  const storage = (product.storage || '').trim()

  // Tentativa 1: Marca + Modelo + Processador + RAM + Storage (ex: "Dell Latitude 5320 i7 16GB 256GB SSD")
  let title = [brand, model, proc, ram, storage].filter(Boolean).join(' ')
  if (title.length <= 60 && title.length > 5) {
    return title
  }

  // Tentativa 2: Nome do produto resumido
  if (product.name && product.name.length <= 60) {
    return product.name
  }

  // Tentativa 3: Encurtar strings
  title = [brand, model, proc, ram].filter(Boolean).join(' ')
  if (title.length <= 60 && title.length > 5) {
    return title
  }

  // Fallback seguro truncado em 60 chars
  const fallback = (product.name || `${brand} ${model}`).trim()
  return fallback.slice(0, 60)
}

/**
 * Gera descrição estruturada com checklist técnico, especificações e contato
 */
export function generateMLDescription(product: Product): string {
  const lines: string[] = []

  lines.push(`*** ${product.name || 'NOTEBOOK REVISADO'} ***`)
  lines.push('')
  lines.push('--- ESPECIFICAÇÕES TÉCNICAS ---')
  if (product.brand) lines.push(`• Marca: ${product.brand}`)
  if (product.model) lines.push(`• Modelo: ${product.model}`)
  if (product.processor) lines.push(`• Processador: ${product.processor}`)
  if (product.ram) lines.push(`• Memória RAM: ${product.ram}`)
  if (product.storage) lines.push(`• Armazenamento: ${product.storage}`)
  if (product.screen_size) lines.push(`• Tamanho da Tela: ${product.screen_size}`)
  if (product.has_numeric_keypad !== undefined) {
    lines.push(`• Teclado Numérico: ${product.has_numeric_keypad ? 'Sim' : 'Não'}`)
  }
  if (product.condition) lines.push(`• Condição: ${product.condition}`)
  if (product.aesthetic_grade) lines.push(`• Grau Estético: ${product.aesthetic_grade}`)
  if (product.battery_health) lines.push(`• Saúde da Bateria: ${product.battery_health}`)
  if (product.includes_charger !== undefined) {
    lines.push(
      `• Carregador: ${product.includes_charger ? 'Acompanha Carregador/Fonte' : 'Não acompanha'}`,
    )
  }
  if (product.serial_number || product.sku) {
    lines.push(`• Serial / Identificador: ${product.serial_number || product.sku}`)
  }

  // Checklist de 16 itens técnicos
  const checklist = product.technical_checklist
  if (checklist && Array.isArray(checklist) && checklist.length > 0) {
    lines.push('')
    lines.push('--- CHECKLIST TÉCNICO DE REVISÃO (16 ITENS) ---')
    checklist.forEach((item) => {
      const statusIcon = item.status === 'Ok' || item.status === 'OK' ? '[OK]' : `[${item.status}]`
      const obs = item.observation ? ` - ${item.observation}` : ''
      lines.push(`${statusIcon} ${item.item}${obs}`)
    })
  }

  lines.push('')
  lines.push('--- INFORMAÇÕES DA LOJA & PROCEDÊNCIA ---')
  lines.push(`Loja: ${STORE_CONFIG.name}`)
  lines.push(`Slogan: ${STORE_CONFIG.tagline}`)
  lines.push(`WhatsApp Comercial: ${STORE_CONFIG.whatsappDisplay}`)
  lines.push(`Atendimento: ${STORE_CONFIG.businessHours}`)
  lines.push(`Localização: ${STORE_CONFIG.location}`)
  lines.push('')
  lines.push('Todos os nossos equipamentos são testados, higienizados e embalados com segurança.')

  return lines.join('\n')
}

/**
 * Coleta todas as URLs válidas de fotos de um produto
 */
export function getProductImageUrls(product: Product): string[] {
  const urls: string[] = []

  // 1. Fotos do storage PocketBase (gerar URL absoluta se possível)
  if (product.photos && Array.isArray(product.photos)) {
    for (const file of product.photos) {
      if (file) {
        const fileUrl = pb.files.getURL(product, file)
        // Se a URL for relativa, converter em absoluta com origin
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
          urls.push(fileUrl)
        } else {
          urls.push(`${window.location.origin}${fileUrl}`)
        }
      }
    }
  }

  // 2. URLs externas em JSON
  if (product.images && Array.isArray(product.images)) {
    for (const img of product.images) {
      if (img && typeof img === 'string') {
        const trimmed = img.trim()
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          urls.push(trimmed)
        }
      }
    }
  }

  return urls
}

/**
 * Validação de requisitos para anúncio no ML
 */
export function validateProductForML(product: Product): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (product.status !== 'Disponível') {
    reasons.push(`Status atual é "${product.status || 'Indefinido'}" (exige "Disponível")`)
  }

  const price = Number(product.unit_price) || 0
  if (price <= 0) {
    reasons.push('Preço de venda não configurado ou zero')
  }

  const photos = getProductImageUrls(product)
  if (photos.length === 0) {
    reasons.push('Equipamento não possui nenhuma foto cadastrada')
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  }
}

/**
 * Obtém a URL padrão de callback OAuth no frontend do app
 */
export function getDefaultMLRedirectUri(): string {
  return `${window.location.origin}/configuracoes`
}

/**
 * Monta URL de autorização OAuth do Mercado Livre
 */
export function buildMLAuthUrl(clientId: string, redirectUri: string): string {
  const base = 'https://auth.mercadolivre.com.br/authorization'
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId.trim(),
    redirect_uri: redirectUri.trim(),
  })
  return `${base}?${params.toString()}`
}

export const mlService = {
  /**
   * Consulta status da conexão e configuração do Mercado Livre
   */
  async getStatus(): Promise<MLStatusResponse> {
    return await pb.send<MLStatusResponse>('/api/ml/status', {
      method: 'GET',
    })
  },

  /**
   * Salva Client ID, Client Secret e Redirect URI
   */
  async saveConfig(clientId: string, clientSecret: string, redirectUri: string): Promise<any> {
    return await pb.send('/api/ml/config', {
      method: 'POST',
      body: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      },
    })
  },

  /**
   * Troca authorization_code retornado pelo ML por access_token e refresh_token
   */
  async exchangeAuthCode(
    code: string,
    redirectUri?: string,
  ): Promise<{ success: boolean; nickname?: string }> {
    return await pb.send('/api/ml/oauth/exchange', {
      method: 'POST',
      body: {
        code,
        redirect_uri: redirectUri,
      },
    })
  },

  /**
   * Desconecta e revoga tokens locais da conta
   */
  async disconnect(): Promise<any> {
    return await pb.send('/api/ml/disconnect', {
      method: 'POST',
    })
  },

  /**
   * Publica 1 item no Mercado Livre
   */
  async publish(payload: MLPublishPayload): Promise<MLPublishResponse> {
    return await pb.send<MLPublishResponse>('/api/ml/publish', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Consulta dados ao vivo do anúncio no ML
   */
  async getItem(mlItemId: string): Promise<MLItemResponse> {
    return await pb.send<MLItemResponse>(`/api/ml/item/${encodeURIComponent(mlItemId)}`, {
      method: 'GET',
    })
  },

  /**
   * Altera status do anúncio no ML (active, paused, closed)
   */
  async updateItemStatus(
    mlItemId: string,
    status: 'active' | 'paused' | 'closed',
    productId?: string,
  ): Promise<any> {
    return await pb.send(`/api/ml/item/${encodeURIComponent(mlItemId)}/status`, {
      method: 'POST',
      body: {
        status,
        product_id: productId,
      },
    })
  },
}
