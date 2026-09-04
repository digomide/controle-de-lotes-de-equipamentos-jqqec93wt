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

/**
 * Helper interno para renovar o access_token se estiver expirado ou perto de expirar (menos de 5 min)
 */
async function ensureValidAccessToken(settingsRecord?: any): Promise<string> {
  const settings = settingsRecord || (await getSettingsRecord())
  if (!settings) {
    throw new Error('Configurações do Mercado Livre não encontradas.')
  }

  const accessToken = settings.access_token || ''
  const refreshToken = settings.refresh_token || ''
  const clientId = settings.client_id || ''
  const clientSecret = settings.client_secret || ''

  if (!accessToken) {
    throw new Error('Mercado Livre não está conectado. Conecte sua conta em Configurações.')
  }

  // Verifica se o token expirou ou expira nos próximos 5 minutos
  let isExpiredOrClose = false
  if (settings.token_expires_at) {
    const expTime = new Date(settings.token_expires_at).getTime()
    if (Date.now() + 5 * 60 * 1000 >= expTime) {
      isExpiredOrClose = true
    }
  }

  if (!isExpiredOrClose) {
    return accessToken
  }

  if (!refreshToken || !clientId || !clientSecret) {
    return accessToken
  }

  // Tenta renovar via POST https://api.mercadolibre.com/oauth/token com grant_type=refresh_token
  try {
    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    })

    const resp = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: bodyParams.toString(),
    })

    if (resp.ok) {
      const data = await resp.json()
      const newAccess = data.access_token || accessToken
      const newRefresh = data.refresh_token || refreshToken
      const expiresIn = Number(data.expires_in) || 21600
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

      await pb.collection('ml_settings').update(settings.id, {
        access_token: newAccess,
        refresh_token: newRefresh,
        token_expires_at: expiresAt,
      })

      return newAccess
    } else {
      const errData = await resp.json().catch(() => ({}))
      console.warn('Falha ao renovar token ML:', resp.status, errData)
      return accessToken
    }
  } catch (refreshErr) {
    console.warn('Erro de rede ao renovar token ML:', refreshErr)
    return accessToken
  }
}

export const mlService = {
  /**
   * Consulta status da conexão e configuração do Mercado Livre
   * Tenta primeiro a rota do servidor GET /api/ml/status e faz fallback seguro para a coleção ml_settings
   */
  async getStatus(): Promise<MLStatusResponse> {
    try {
      const res = await pb.send<MLStatusResponse>('/api/ml/status', {
        method: 'GET',
      })
      if (res && typeof res.configured === 'boolean') {
        return res
      }
    } catch (err) {
      console.warn('Aviso ao consultar /api/ml/status do servidor:', err)
    }

    // Leitura direta da coleção ml_settings como fallback seguro de leitura
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
  },

  /**
   * Salva Client ID, Client Secret e Redirect URI no servidor
   * Passa pelo endpoint POST /api/ml/config para salvar credenciais com segurança
   */
  async saveConfig(clientId: string, clientSecret: string, redirectUri: string): Promise<any> {
    const cleanClientId = clientId.trim()
    const cleanRedirect = redirectUri.trim()
    const cleanSecret = clientSecret.trim()

    try {
      return await pb.send('/api/ml/config', {
        method: 'POST',
        body: {
          client_id: cleanClientId,
          client_secret: cleanSecret,
          redirect_uri: cleanRedirect,
        },
      })
    } catch (serverErr: any) {
      console.warn('Rota /api/ml/config falhou, salvando via coleção ml_settings:', serverErr)
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
    }
  },

  /**
   * Troca authorization_code retornado pelo ML por access_token e refresh_token.
   * 100% SERVER-SIDE via POST /api/ml/oauth/exchange no PocketBase.
   * NUNCA chama api.mercadolibre.com diretamente do navegador para evitar bloqueio por CORS.
   */
  async exchangeAuthCode(
    code: string,
    redirectUri?: string,
  ): Promise<{ success: boolean; nickname?: string; user_id_ml?: string }> {
    const cleanCode = code.trim()
    if (!cleanCode) {
      throw new Error('Código de autorização não informado.')
    }

    const targetRedirect = redirectUri?.trim()

    try {
      const response = await pb.send<{
        success: boolean
        nickname?: string
        user_id_ml?: string
        permalink_seller?: string
        error?: string
      }>('/api/ml/oauth/exchange', {
        method: 'POST',
        body: {
          code: cleanCode,
          redirect_uri: targetRedirect,
        },
      })

      if (response && response.success) {
        return {
          success: true,
          nickname: response.nickname,
          user_id_ml: response.user_id_ml,
        }
      }

      throw new Error(response?.error || 'Falha na troca de código com o Mercado Livre.')
    } catch (err: any) {
      console.error('Erro na chamada server-side /api/ml/oauth/exchange:', err)
      const serverMsg =
        err?.data?.error ||
        err?.response?.error ||
        err?.message ||
        'Falha ao autenticar com o Mercado Livre através do servidor.'
      throw new Error(serverMsg)
    }
  },

  /**
   * Desconecta e limpa tokens da conta Mercado Livre
   */
  async disconnect(): Promise<any> {
    try {
      return await pb.send('/api/ml/disconnect', {
        method: 'POST',
      })
    } catch (err) {
      console.warn('POST /api/ml/disconnect falhou, limpando em ml_settings:', err)
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
    }
  },

  /**
   * Publica anúncio de produto no Mercado Livre 100% SERVER-SIDE via POST /api/ml/publish
   * NUNCA chama api.mercadolibre.com direto do navegador.
   */
  async publish(payload: MLPublishPayload): Promise<MLPublishResponse> {
    try {
      const response = await pb.send<MLPublishResponse>('/api/ml/publish', {
        method: 'POST',
        body: payload,
      })

      return response
    } catch (err: any) {
      console.error('Erro na chamada server-side /api/ml/publish:', err)
      const serverMsg =
        err?.data?.error ||
        err?.response?.error ||
        err?.message ||
        'Falha ao publicar anúncio no Mercado Livre através do servidor.'
      throw new Error(serverMsg)
    }
  },

  /**
   * Consulta dados ao vivo do anúncio no ML via servidor PocketBase
   */
  async getItem(mlItemId: string): Promise<MLItemResponse> {
    try {
      return await pb.send<MLItemResponse>(`/api/ml/item/${encodeURIComponent(mlItemId)}`, {
        method: 'GET',
      })
    } catch (err: any) {
      console.error('Erro ao consultar item ML via servidor:', err)
      const msg = err?.data?.error || err?.message || 'Falha ao consultar item no Mercado Livre.'
      throw new Error(msg)
    }
  },

  /**
   * Altera status do anúncio no ML (active, paused, closed) via servidor PocketBase
   */
  async updateItemStatus(
    mlItemId: string,
    status: 'active' | 'paused' | 'closed',
    productId?: string,
  ): Promise<any> {
    try {
      return await pb.send('/api/ml/item-status', {
        method: 'POST',
        body: {
          item_id: mlItemId,
          status,
          product_id: productId,
        },
      })
    } catch (err: any) {
      console.error('Erro ao atualizar status do item no ML:', err)
      const msg =
        err?.data?.error || err?.message || 'Falha ao atualizar status do item no Mercado Livre.'
      throw new Error(msg)
    }
  },
}
