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
    try {
      return await pb.send<MLStatusResponse>('/api/ml/status', {
        method: 'GET',
      })
    } catch (err: any) {
      // Fallback direto via coleção ml_settings se a rota customizada retornar 404
      if (err?.status === 404 || err?.statusCode === 404) {
        try {
          const list = await pb.collection('ml_settings').getList(1, 1, {
            sort: '-created',
          })
          if (list.items.length > 0) {
            const item = list.items[0]
            const clientId = (item.client_id || '').toString().trim()
            const accessToken = (item.access_token || '').toString().trim()
            return {
              configured: Boolean(clientId),
              connected: Boolean(accessToken),
              client_id: clientId,
              redirect_uri: item.redirect_uri || '',
              nickname: item.nickname || '',
              user_id_ml: item.user_id_ml || '',
              permalink_seller: item.permalink_seller || '',
            }
          }
          return {
            configured: false,
            connected: false,
            client_id: '',
            redirect_uri: '',
            nickname: '',
            user_id_ml: '',
            permalink_seller: '',
          }
        } catch (dbErr) {
          console.warn('Fallback getStatus ml_settings failed:', dbErr)
        }
      }
      throw err
    }
  },

  /**
   * Salva Client ID, Client Secret e Redirect URI
   */
  async saveConfig(clientId: string, clientSecret: string, redirectUri: string): Promise<any> {
    try {
      return await pb.send('/api/ml/config', {
        method: 'POST',
        body: {
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        },
      })
    } catch (err: any) {
      // Fallback direto via coleção ml_settings se a rota customizada retornar 404
      if (err?.status === 404 || err?.statusCode === 404) {
        const list = await pb.collection('ml_settings').getList(1, 1, {
          sort: '-created',
        })
        const cleanClientId = clientId.trim()
        const cleanRedirect = redirectUri.trim()
        const cleanSecret = clientSecret.trim()

        if (list.items.length > 0) {
          const existing = list.items[0]
          const updateData: Record<string, any> = {
            client_id: cleanClientId,
            redirect_uri: cleanRedirect,
          }
          if (cleanSecret) {
            updateData.client_secret = cleanSecret
          }
          await pb.collection('ml_settings').update(existing.id, updateData)
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
      throw err
    }
  },

  /**
   * Troca authorization_code retornado pelo ML por access_token e refresh_token
   */
  async exchangeAuthCode(
    code: string,
    redirectUri?: string,
  ): Promise<{ success: boolean; nickname?: string }> {
    try {
      return await pb.send('/api/ml/oauth/exchange', {
        method: 'POST',
        body: {
          code,
          redirect_uri: redirectUri,
        },
      })
    } catch (err: any) {
      if (err?.status === 404 || err?.statusCode === 404) {
        // Fallback: faz o exchange diretamente via fetch da API pública do Mercado Livre
        const list = await pb.collection('ml_settings').getList(1, 1, { sort: '-created' })
        if (list.items.length === 0) {
          throw new Error('Configurações do Mercado Livre não encontradas no sistema.')
        }
        const settings = list.items[0]
        const clientId = settings.client_id
        const clientSecret = settings.client_secret
        const finalRedirect = redirectUri || settings.redirect_uri

        if (!clientId || !clientSecret) {
          throw new Error('Client ID ou Client Secret do Mercado Livre não configurados.')
        }

        const tokenResp = await fetch('https://api.mercadolibre.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: code.trim(),
            redirect_uri: finalRedirect,
          }),
        })

        const tokenData = await tokenResp.json()
        if (!tokenResp.ok) {
          throw new Error(
            tokenData.message ||
              tokenData.error_description ||
              'Falha ao autenticar com o Mercado Livre.',
          )
        }

        const accessToken = tokenData.access_token || ''
        const refreshToken = tokenData.refresh_token || ''
        const expiresIn = Number(tokenData.expires_in) || 21600
        const userId = (tokenData.user_id || '').toString()
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

        let nickname = ''
        let permalink = ''
        try {
          const userResp = await fetch('https://api.mercadolibre.com/users/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          if (userResp.ok) {
            const userData = await userResp.json()
            nickname = userData.nickname || ''
            permalink = userData.permalink || ''
          }
        } catch {
          /* intentionally ignored */
        }

        await pb.collection('ml_settings').update(settings.id, {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          user_id_ml: userId,
          nickname,
          permalink_seller: permalink,
        })

        return {
          success: true,
          nickname,
        }
      }
      throw err
    }
  },

  /**
   * Desconecta e revoga tokens locais da conta
   */
  async disconnect(): Promise<any> {
    try {
      return await pb.send('/api/ml/disconnect', {
        method: 'POST',
      })
    } catch (err: any) {
      if (err?.status === 404 || err?.statusCode === 404) {
        const list = await pb.collection('ml_settings').getList(1, 1, { sort: '-created' })
        if (list.items.length > 0) {
          await pb.collection('ml_settings').update(list.items[0].id, {
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
      throw err
    }
  },

  /**
   * Publica 1 item no Mercado Livre
   */
  async publish(payload: MLPublishPayload): Promise<MLPublishResponse> {
    try {
      return await pb.send<MLPublishResponse>('/api/ml/publish', {
        method: 'POST',
        body: payload,
      })
    } catch (err: any) {
      if (err?.status === 404 || err?.statusCode === 404) {
        // Fallback direto via API do Mercado Livre
        const list = await pb.collection('ml_settings').getList(1, 1, { sort: '-created' })
        if (list.items.length === 0 || !list.items[0].access_token) {
          throw new Error(
            'Mercado Livre não está conectado. Acesse Configurações para conectar sua conta.',
          )
        }

        const settings = list.items[0]
        let accessToken = settings.access_token

        // Refresh token se necessário
        if (settings.token_expires_at) {
          const expTime = new Date(settings.token_expires_at).getTime()
          if (Date.now() + 5 * 60 * 1000 >= expTime && settings.refresh_token) {
            try {
              const rResp = await fetch('https://api.mercadolibre.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  grant_type: 'refresh_token',
                  client_id: settings.client_id,
                  client_secret: settings.client_secret,
                  refresh_token: settings.refresh_token,
                }),
              })
              if (rResp.ok) {
                const rData = await rResp.json()
                accessToken = rData.access_token || accessToken
                const expIn = Number(rData.expires_in) || 21600
                await pb.collection('ml_settings').update(settings.id, {
                  access_token: accessToken,
                  refresh_token: rData.refresh_token || settings.refresh_token,
                  token_expires_at: new Date(Date.now() + expIn * 1000).toISOString(),
                })
              }
            } catch {
              /* intentionally ignored */
            }
          }
        }

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

        const itemResp = await fetch('https://api.mercadolibre.com/items', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(itemPayload),
        })

        const itemData = await itemResp.json()
        if (!itemResp.ok) {
          let msg = itemData.message || 'Erro desconhecido ao criar anúncio no Mercado Livre.'
          if (itemData.cause && Array.isArray(itemData.cause)) {
            msg += ' ' + itemData.cause.map((c: any) => c.message || c.code || '').join('; ')
          }
          throw new Error(msg)
        }

        const itemId = itemData.id || ''
        const permalink = itemData.permalink || ''
        const status = itemData.status || 'active'

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
          } catch {
            /* intentionally ignored */
          }
        }

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
      }
      throw err
    }
  },

  /**
   * Consulta dados ao vivo do anúncio no ML
   */
  async getItem(mlItemId: string): Promise<MLItemResponse> {
    try {
      return await pb.send<MLItemResponse>(`/api/ml/item/${encodeURIComponent(mlItemId)}`, {
        method: 'GET',
      })
    } catch (err: any) {
      if (err?.status === 404 || err?.statusCode === 404) {
        const list = await pb.collection('ml_settings').getList(1, 1, { sort: '-created' })
        const accessToken = list.items.length > 0 ? list.items[0].access_token : ''
        const headers: Record<string, string> = {}
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`

        const res = await fetch(
          `https://api.mercadolibre.com/items/${encodeURIComponent(mlItemId)}`,
          {
            headers,
          },
        )
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || 'Item não encontrado no Mercado Livre.')
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
      }
      throw err
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
    try {
      return await pb.send(`/api/ml/item/${encodeURIComponent(mlItemId)}/status`, {
        method: 'POST',
        body: {
          status,
          product_id: productId,
        },
      })
    } catch (err: any) {
      if (err?.status === 404 || err?.statusCode === 404) {
        const list = await pb.collection('ml_settings').getList(1, 1, { sort: '-created' })
        if (list.items.length === 0 || !list.items[0].access_token) {
          throw new Error('Mercado Livre não conectado.')
        }
        const accessToken = list.items[0].access_token

        const res = await fetch(
          `https://api.mercadolibre.com/items/${encodeURIComponent(mlItemId)}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status }),
          },
        )
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || 'Falha ao alterar status no Mercado Livre.')
        }

        if (productId) {
          try {
            await pb.collection('products').update(productId, {
              ml_listing_status: status,
            })
          } catch {
            /* intentionally ignored */
          }
        }

        return {
          success: true,
          id: mlItemId,
          status,
        }
      }
      throw err
    }
  },
}
