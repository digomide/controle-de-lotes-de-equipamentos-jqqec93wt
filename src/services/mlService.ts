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
   * Consulta status da conexão e configuração do Mercado Livre direto da coleção ml_settings
   */
  async getStatus(): Promise<MLStatusResponse> {
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
   * Salva Client ID, Client Secret e Redirect URI diretamente na coleção ml_settings
   */
  async saveConfig(clientId: string, clientSecret: string, redirectUri: string): Promise<any> {
    const settings = await getSettingsRecord()
    const cleanClientId = clientId.trim()
    const cleanRedirect = redirectUri.trim()
    const cleanSecret = clientSecret.trim()

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
   * Troca authorization_code retornado pelo ML por access_token e refresh_token.
   * Realiza POST direto para https://api.mercadolibre.com/oauth/token com application/x-www-form-urlencoded.
   * Em seguida, busca nickname via GET https://api.mercadolibre.com/users/me e salva tudo na coleção ml_settings.
   */
  async exchangeAuthCode(
    code: string,
    redirectUri?: string,
  ): Promise<{ success: boolean; nickname?: string; user_id_ml?: string }> {
    const settings = await getSettingsRecord()
    if (!settings) {
      throw new Error(
        'Configurações do Mercado Livre não encontradas no sistema. Salve o Client ID e Secret primeiro.',
      )
    }

    const clientId = (settings.client_id || '').toString().trim()
    const clientSecret = (settings.client_secret || '').toString().trim()
    const finalRedirect = (redirectUri || settings.redirect_uri || getDefaultMLRedirectUri()).trim()

    if (!clientId) {
      throw new Error('Client ID (App ID) do Mercado Livre não configurado.')
    }
    if (!clientSecret) {
      throw new Error(
        'Client Secret do Mercado Livre não configurado. Por favor, reintroduza o Client Secret em Configurações.',
      )
    }

    const cleanCode = code.trim()

    // Preparar corpo form-urlencoded conforme especificação oficial do Mercado Livre
    const formParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: cleanCode,
      redirect_uri: finalRedirect,
    })

    let tokenResp: Response
    try {
      tokenResp = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: formParams.toString(),
      })
    } catch (networkError: any) {
      // Falha de rede ou CORS do navegador
      console.error('Erro de rede ou CORS no POST /oauth/token do ML:', networkError)
      const isCorsOrOffline =
        networkError?.message?.includes('Failed to fetch') || networkError?.name === 'TypeError'
      const detail = isCorsOrOffline
        ? 'Possível bloqueio de CORS pelo navegador ou erro de rede ao chamar a API do Mercado Livre (api.mercadolibre.com/oauth/token).'
        : networkError?.message || 'Falha de conexão com a API do Mercado Livre.'
      throw new Error(
        `Falha na requisição ao Mercado Livre: ${detail} (Verifique no console as mensagens de rede do navegador)`,
      )
    }

    let tokenData: any = {}
    try {
      tokenData = await tokenResp.json()
    } catch {
      tokenData = {}
    }

    if (!tokenResp.ok) {
      console.error('Resposta de erro do ML /oauth/token:', tokenResp.status, tokenData)
      let errorMsg =
        tokenData.message ||
        tokenData.error_description ||
        tokenData.error ||
        `Erro HTTP ${tokenResp.status} retornado pelo Mercado Livre.`

      if (tokenData.cause && Array.isArray(tokenData.cause) && tokenData.cause.length > 0) {
        const causes = tokenData.cause
          .map((c: any) => c.message || c.code || JSON.stringify(c))
          .join('; ')
        errorMsg += ` Detalhes: ${causes}`
      }

      throw new Error(`Mercado Livre (${tokenResp.status}): ${errorMsg}`)
    }

    const accessToken = tokenData.access_token || ''
    const refreshToken = tokenData.refresh_token || ''
    const expiresIn = Number(tokenData.expires_in) || 21600
    const userId = (tokenData.user_id || '').toString()
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    if (!accessToken) {
      throw new Error('Mercado Livre não retornou access_token válido na resposta.')
    }

    // Buscar nickname e informações do vendedor no Mercado Livre
    let nickname = ''
    let permalink = ''
    try {
      const userResp = await fetch('https://api.mercadolibre.com/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })
      if (userResp.ok) {
        const userData = await userResp.json()
        nickname = userData.nickname || ''
        permalink = userData.permalink || ''
      } else {
        console.warn('Não foi possível obter nickname do ML (status):', userResp.status)
      }
    } catch (uErr) {
      console.warn('Erro ao consultar /users/me do ML:', uErr)
    }

    // Atualiza registro no PocketBase
    await pb.collection('ml_settings').update(settings.id, {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      user_id_ml: userId,
      nickname: nickname || settings.nickname || '',
      permalink_seller: permalink || settings.permalink_seller || '',
      redirect_uri: finalRedirect,
    })

    return {
      success: true,
      nickname,
      user_id_ml: userId,
    }
  },

  /**
   * Desconecta e limpa tokens da conta Mercado Livre em ml_settings
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
   * Publica 1 item no Mercado Livre diretamente via API oficial (com renovação de token se expirado)
   */
  async publish(payload: MLPublishPayload): Promise<MLPublishResponse> {
    const settings = await getSettingsRecord()
    if (!settings || !settings.access_token) {
      throw new Error(
        'Mercado Livre não está conectado. Acesse Configurações para conectar sua conta.',
      )
    }

    // Obtém token válido garantindo refresh automático
    const accessToken = await ensureValidAccessToken(settings)

    const product = await pb.collection('products').getOne(payload.product_id)
    const title = (payload.title || product.name || '').slice(0, 60)
    const price =
      payload.price && payload.price > 0 ? payload.price : Number(product.unit_price) || 0
    const categoryId = payload.category_id || 'MLB1652'

    let pictures: Array<{ source: string }> = []
    if (payload.pictures && payload.pictures.length > 0) {
      pictures = payload.pictures.map((u) => ({ source: u }))
    } else {
      const urls = getProductImageUrls(product as any)
      pictures = urls.map((u) => ({ source: u }))
    }

    if (pictures.length === 0) {
      throw new Error('O anúncio exige pelo menos uma foto com URL pública válida.')
    }

    const itemPayload = {
      title,
      category_id: categoryId,
      price,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      condition: 'used',
      pictures,
      channels: ['marketplace'],
    }

    let itemResp: Response
    try {
      itemResp = await fetch('https://api.mercadolibre.com/items', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(itemPayload),
      })
    } catch (netErr: any) {
      throw new Error(
        `Falha de rede ou CORS ao conectar à API do Mercado Livre: ${netErr?.message || netErr}`,
      )
    }

    let itemData: any = {}
    try {
      itemData = await itemResp.json()
    } catch {
      itemData = {}
    }

    if (!itemResp.ok) {
      let msg =
        itemData.message || `Erro HTTP ${itemResp.status} ao criar anúncio no Mercado Livre.`
      if (itemData.cause && Array.isArray(itemData.cause)) {
        msg += ' Detalhes: ' + itemData.cause.map((c: any) => c.message || c.code || '').join('; ')
      }
      throw new Error(msg)
    }

    const itemId = itemData.id || ''
    const permalink = itemData.permalink || ''
    const status = itemData.status || 'active'

    // Publicar descrição em texto simples se fornecida
    if (itemId && payload.description) {
      try {
        await fetch(`https://api.mercadolibre.com/items/${itemId}/description`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ plain_text: payload.description }),
        })
      } catch (descErr) {
        console.warn('Aviso: falha ao enviar descrição do item ML:', descErr)
      }
    }

    // Atualiza produto no PocketBase com dados do anúncio ML
    const currentEvents = (product.history_events as any[]) || []
    const eventsList = Array.isArray(currentEvents) ? [...currentEvents] : []
    eventsList.push({
      title: `Anunciado no Mercado Livre (${itemId})`,
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })

    await pb.collection('products').update(product.id, {
      ml_listing_id: itemId,
      ml_listing_url: permalink,
      ml_listing_status: status,
      ml_published_at: new Date().toISOString(),
      history_events: eventsList,
    })

    return {
      success: true,
      ml_listing_id: itemId,
      ml_listing_url: permalink,
      ml_listing_status: status,
    }
  },

  /**
   * Consulta dados ao vivo do anúncio no ML
   */
  async getItem(mlItemId: string): Promise<MLItemResponse> {
    const settings = await getSettingsRecord()
    let headers: Record<string, string> = { Accept: 'application/json' }

    if (settings && settings.access_token) {
      try {
        const validToken = await ensureValidAccessToken(settings)
        headers.Authorization = `Bearer ${validToken}`
      } catch {
        /* continua com requisição pública */
      }
    }

    let res: Response
    try {
      res = await fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(mlItemId)}`, {
        headers,
      })
    } catch (netErr: any) {
      throw new Error(
        `Falha de conexão ao buscar anúncio no Mercado Livre: ${netErr?.message || netErr}`,
      )
    }

    const data = await res.json()
    if (!res.ok) {
      throw new Error(
        data.message || `Item ${mlItemId} não encontrado no Mercado Livre (status ${res.status}).`,
      )
    }

    return {
      id: data.id,
      title: data.title,
      price: data.price,
      status: data.status,
      sub_status: data.sub_status,
      permalink: data.permalink,
      available_quantity: data.available_quantity,
      sold_quantity: data.sold_quantity,
    }
  },

  /**
   * Altera status do anúncio no ML (active, paused, closed)
   */
  async updateItemStatus(
    mlItemId: string,
    status: 'active' | 'paused' | 'closed',
    productId?: string,
  ): Promise<any> {
    const settings = await getSettingsRecord()
    if (!settings || !settings.access_token) {
      throw new Error('Mercado Livre não está conectado.')
    }

    const accessToken = await ensureValidAccessToken(settings)

    let res: Response
    try {
      res = await fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(mlItemId)}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status }),
      })
    } catch (netErr: any) {
      throw new Error(`Falha ao alterar status no Mercado Livre: ${netErr?.message || netErr}`)
    }

    const data = await res.json()
    if (!res.ok) {
      let msg = data.message || `Falha ao alterar status no Mercado Livre (HTTP ${res.status}).`
      if (data.cause && Array.isArray(data.cause)) {
        msg += ' ' + data.cause.map((c: any) => c.message || c.code || '').join('; ')
      }
      throw new Error(msg)
    }

    if (productId) {
      try {
        await pb.collection('products').update(productId, {
          ml_listing_status: status,
        })
      } catch (dbErr) {
        console.warn('Aviso: falha ao atualizar status local do produto:', dbErr)
      }
    }

    return {
      success: true,
      id: mlItemId,
      status,
    }
  },
}
