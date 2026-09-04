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

  // 1. Fotos do storage PocketBase (gerar URL absoluta)
  if (product.photos && Array.isArray(product.photos)) {
    for (const file of product.photos) {
      if (file) {
        const fileUrl = pb.files.getURL(product, file)
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

/**
 * Helper para obter o registro de configuração do Mercado Livre
 */
async function getSettingsRecord() {
  const list = await pb.collection('ml_settings').getList(1, 1, {
    sort: '-created',
  })
  return list.items.length > 0 ? list.items[0] : null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const mlService = {
  /**
   * Consulta status da conexão e configuração do Mercado Livre lendo a coleção ml_settings
   */
  async getStatus(): Promise<MLStatusResponse> {
    try {
      const settings = await getSettingsRecord()
      if (!settings) {
        return {
          configured: false,
          connected: false,
          client_id: '',
          redirect_uri: '',
          nickname: '',
          user_id_ml: '',
          permalink_seller: '',
        }
      }

      const clientId = (settings.client_id || '').toString().trim()
      const accessToken = (settings.access_token || '').toString().trim()

      return {
        configured: Boolean(clientId),
        connected: Boolean(accessToken),
        client_id: clientId,
        redirect_uri: settings.redirect_uri || '',
        nickname: settings.nickname || '',
        user_id_ml: settings.user_id_ml || '',
        permalink_seller: settings.permalink_seller || '',
      }
    } catch (err) {
      console.error('Erro ao ler ml_settings:', err)
      return {
        configured: false,
        connected: false,
        client_id: '',
        redirect_uri: '',
        nickname: '',
        user_id_ml: '',
        permalink_seller: '',
      }
    }
  },

  /**
   * Salva Client ID, Client Secret e Redirect URI diretamente na coleção ml_settings
   */
  async saveConfig(clientId: string, clientSecret: string, redirectUri: string): Promise<any> {
    const cleanClientId = clientId.trim()
    const cleanRedirect = redirectUri.trim()
    const cleanSecret = clientSecret.trim()

    const settings = await getSettingsRecord()
    if (settings) {
      const updateData: Record<string, any> = {
        client_id: cleanClientId,
        redirect_uri: cleanRedirect,
      }
      if (cleanSecret) {
        updateData.client_secret = cleanSecret
      }
      await pb.collection('ml_settings').update(settings.id, updateData)
    } else {
      await pb.collection('ml_settings').create({
        client_id: cleanClientId,
        client_secret: cleanSecret,
        redirect_uri: cleanRedirect,
      })
    }

    return {
      success: true,
      configured: Boolean(cleanClientId),
      client_id: cleanClientId,
      redirect_uri: cleanRedirect,
    }
  },

  /**
   * Troca authorization_code por tokens usando a fila ml_oauth_requests + polling.
   * Cria registro na coleção com status 'pending' e aguarda até 'done' ou 'error'.
   * 100% processado no servidor pelos hooks/cron, SEM chamadas diretas ao ML no browser.
   */
  async exchangeAuthCode(
    code: string,
    redirectUri?: string,
    onProgress?: (message: string) => void,
  ): Promise<{ success: boolean; nickname?: string; user_id_ml?: string }> {
    const cleanCode = code.trim()
    if (!cleanCode) {
      throw new Error('Código de autorização não informado.')
    }

    const targetRedirect = redirectUri?.trim() || ''

    if (onProgress) {
      onProgress('Registrando solicitação de autorização...')
    }

    // 1. Criar registro na coleção ml_oauth_requests
    const requestRecord = await pb.collection('ml_oauth_requests').create({
      code: cleanCode,
      redirect_uri: targetRedirect,
      status: 'pending',
      requested_by: pb.authStore.model?.id || null,
    })

    const requestId = requestRecord.id

    // 2. Polling a cada 2s (timeout 90s)
    const timeoutMs = 90_000
    const intervalMs = 2_000
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      await sleep(intervalMs)

      if (onProgress) {
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        onProgress(`Processando autorização no servidor (${elapsed}s)...`)
      }

      try {
        const current = await pb.collection('ml_oauth_requests').getOne(requestId)
        const status = current.status

        if (status === 'done') {
          // Ler os dados salvos em ml_settings
          const settings = await getSettingsRecord()
          return {
            success: true,
            nickname: settings?.nickname || '',
            user_id_ml: settings?.user_id_ml || '',
          }
        }

        if (status === 'error') {
          const errMsg =
            current.error_message ||
            'Falha desconhecida ao processar autorização com o Mercado Livre.'
          throw new Error(errMsg)
        }
      } catch (pollErr: any) {
        // Se foi erro explicitamente lançado pelo status === 'error', repassa
        if (pollErr.message && !pollErr.status) {
          throw pollErr
        }
      }
    }

    throw new Error(
      'Tempo limite excedido ao aguardar resposta do servidor para autorização do Mercado Livre.',
    )
  },

  /**
   * Desconecta e limpa tokens da conta Mercado Livre diretamente em ml_settings
   */
  async disconnect(): Promise<any> {
    const settings = await getSettingsRecord()
    if (settings) {
      await pb.collection('ml_settings').update(settings.id, {
        access_token: '',
        refresh_token: '',
        token_expires_at: null,
        nickname: '',
        user_id_ml: '',
        permalink_seller: '',
      })
    }
    return { success: true, connected: false }
  },

  /**
   * Publica anúncio de produto usando a fila ml_publish_queue + polling.
   * Cria registro com status 'pending' e aguarda conclusão no servidor.
   */
  async publish(
    payload: MLPublishPayload,
    onProgress?: (message: string) => void,
  ): Promise<MLPublishResponse> {
    if (!payload.product_id) {
      throw new Error('ID do produto é obrigatório para publicar.')
    }

    if (onProgress) {
      onProgress('Adicionando à fila de publicação...')
    }

    const queueItem = await pb.collection('ml_publish_queue').create({
      product: payload.product_id,
      status: 'pending',
      payload: {
        title: payload.title,
        price: payload.price,
        category_id: payload.category_id || 'MLB1652',
        description: payload.description,
        photos: payload.pictures || [],
        listing_type_id: 'gold_special',
      },
    })

    const queueId = queueItem.id
    const timeoutMs = 90_000
    const intervalMs = 2_000
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      await sleep(intervalMs)

      if (onProgress) {
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        onProgress(`Enviando ao Mercado Livre (${elapsed}s)...`)
      }

      try {
        const current = await pb.collection('ml_publish_queue').getOne(queueId)
        const status = current.status

        if (status === 'done') {
          const res = current.result || {}
          return {
            success: true,
            ml_listing_id: res.ml_listing_id || '',
            ml_listing_url: res.ml_listing_url || '',
            ml_listing_status: res.ml_listing_status || 'active',
          }
        }

        if (status === 'error') {
          const errMsg =
            current.error_message ||
            'Falha desconhecida do servidor ao criar anúncio no Mercado Livre.'
          return {
            success: false,
            ml_listing_id: '',
            ml_listing_url: '',
            ml_listing_status: 'error',
            error: errMsg,
          }
        }
      } catch (pErr: any) {
        // Ignora erros transitórios de rede na checagem
      }
    }

    return {
      success: false,
      ml_listing_id: '',
      ml_listing_url: '',
      ml_listing_status: 'timeout',
      error: 'Tempo limite esgotado ao aguardar a publicação do anúncio no servidor.',
    }
  },

  /**
   * Consulta dados ao vivo do anúncio no ML via produto salvo no PocketBase
   */
  async getItem(mlItemId: string): Promise<MLItemResponse | null> {
    try {
      const records = await pb.collection('products').getList(1, 1, {
        filter: `ml_listing_id = "${mlItemId}"`,
      })

      if (records.items.length > 0) {
        const p = records.items[0]
        return {
          id: mlItemId,
          title: p.name || '',
          price: Number(p.unit_price) || 0,
          status: p.ml_listing_status || 'active',
          permalink: p.ml_listing_url || '',
          available_quantity: 1,
          sold_quantity: p.status === 'Vendido' ? 1 : 0,
        }
      }
      return null
    } catch (err) {
      console.warn('Erro ao consultar item localmente:', err)
      return null
    }
  },

  /**
   * Altera status do anúncio no ML (active, paused, closed) via fila ml_item_queue + polling
   */
  async updateItemStatus(
    mlItemId: string,
    status: 'active' | 'paused' | 'closed',
    productId?: string,
  ): Promise<any> {
    let targetProductId = productId

    if (!targetProductId && mlItemId) {
      try {
        const records = await pb.collection('products').getList(1, 1, {
          filter: `ml_listing_id = "${mlItemId}"`,
        })
        if (records.items.length > 0) {
          targetProductId = records.items[0].id
        }
      } catch {
        /* intentionally ignored */
      }
    }

    if (!targetProductId) {
      throw new Error('Produto associado ao anúncio não encontrado.')
    }

    let action: 'pause' | 'activate' | 'close' = 'pause'
    if (status === 'active') action = 'activate'
    else if (status === 'closed') action = 'close'
    else if (status === 'paused') action = 'pause'

    const queueItem = await pb.collection('ml_item_queue').create({
      product: targetProductId,
      action: action,
      status: 'pending',
    })

    const queueId = queueItem.id
    const timeoutMs = 45_000
    const intervalMs = 2_000
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      await sleep(intervalMs)

      try {
        const current = await pb.collection('ml_item_queue').getOne(queueId)
        if (current.status === 'done') {
          return {
            success: true,
            id: mlItemId,
            status: status,
          }
        }
        if (current.status === 'error') {
          throw new Error(current.error_message || 'Falha ao atualizar status no Mercado Livre.')
        }
      } catch (err: any) {
        if (err.message && !err.status) {
          throw err
        }
      }
    }

    throw new Error('Tempo limite ao alterar status do anúncio no servidor.')
  },
}
