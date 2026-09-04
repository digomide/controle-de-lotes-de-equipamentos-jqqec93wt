import pb from '@/lib/pocketbase/client'
import type { Product } from '@/types/inventory'
import { getMLItemCondition, getMLGradeLabel } from '@/lib/condition'
export { getMLItemCondition, getMLGradeLabel }

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
  condition_type?: 'novo' | 'usado' | 'recondicionado' | 'caixa_aberta'
  condition_grade?: 'excelente' | 'bom' | 'aceitavel'
}

export interface MLPublishResponse {
  success: boolean
  ml_listing_id: string
  ml_listing_url: string
  ml_listing_status: string
  error?: string
}

/**
 * Traduz mensagens técnicas de erro da API do Mercado Livre para mensagens claras e amigáveis ao usuário
 */
export function translateMLErrorMessage(rawError: string): string {
  if (!rawError) return 'Falha desconhecida ao comunicar com o Mercado Livre.'

  const friendlyDict: Record<string, string> = {
    family_name: 'Família do produto (family_name / Linha)',
    brand: 'Marca do equipamento (BRAND)',
    model: 'Modelo do produto (MODEL)',
    line: 'Linha do produto (LINE)',
    processor_brand: 'Marca do processador',
    processor_line: 'Linha do processador',
    processor_model: 'Modelo do processador',
    ram: 'Memória RAM',
    ram_memory_module_total_capacity: 'Memória RAM',
    ssd_data_storage_capacity: 'Capacidade do SSD',
    hard_drive_data_storage_capacity: 'Capacidade do HD',
    display_size: 'Tamanho da tela',
    screen_size: 'Tamanho da tela',
    grading: 'Grau do recondicionado (GRADING)',
    item_grade: 'Grau de estado',
    with_numeric_pad: 'Teclado numérico',
    pictures: 'Fotos do anúncio',
    price: 'Preço de venda',
    condition: 'Condição do produto',
    listing_type_id: 'Tipo de anúncio',
    category_id: 'Categoria',
  }

  // Tratamento específico de body.invalid_fields
  if (rawError.includes('body.invalid_fields')) {
    // Se vier com cause ou detalhes listados
    if (rawError.includes('Detalhes:') || rawError.includes(' — ')) {
      const parts = rawError.split(/Detalhes:\s*|—\s*/)
      if (parts[1]) {
        const causes = parts[1]
          .split(';')
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => {
            // Se tiver formato "CAMPO: mensagem"
            const matchColon = c.match(/^([a-zA-Z0-9_]+)\s*:\s*(.*)$/)
            if (matchColon) {
              const fieldName = friendlyDict[matchColon[1].toLowerCase()] || matchColon[1]
              return `Campo ${fieldName}: ${matchColon[2]}`
            }
            return c
          })
        return `O Mercado Livre rejeitou alguns campos do anúncio:\n• ${causes.join('\n• ')}`
      }
    }
    return 'O Mercado Livre rejeitou campos do anúncio (body.invalid_fields). Verifique se todos os atributos como Marca, Modelo, Processador, Memória e Grau de estado estão preenchidos corretamente.'
  }

  // Erro específico de body.required_fields [family_name] ou outros atributos faltantes
  if (
    rawError.includes('body.required_fields') ||
    rawError.includes('The body does not contains') ||
    rawError.includes('does not contain')
  ) {
    const fieldsMatch = rawError.match(/\[(.*?)\]/)
    const rawFields = fieldsMatch ? fieldsMatch[1].split(',').map((s) => s.trim()) : []

    if (rawFields.length > 0) {
      const translated = rawFields.map((f) => friendlyDict[f.toLowerCase()] || f).join(', ')
      return `O Mercado Livre exige os seguintes campos obrigatórios: ${translated}. Revise o cadastro do equipamento para preenchê-los.`
    }

    return 'O Mercado Livre exige campos obrigatórios que não foram informados (ex: família do produto ou marca/modelo). Revise o cadastro se faltar alguma especificação.'
  }

  // Erros de token expirado ou permissão
  if (
    rawError.toLowerCase().includes('token') &&
    (rawError.toLowerCase().includes('expired') || rawError.toLowerCase().includes('invalid'))
  ) {
    return 'A autorização do Mercado Livre expirou. Acesse Configurações e reconecte sua conta.'
  }

  // Se houver lista de "Detalhes:" legível
  if (rawError.includes('Detalhes:')) {
    const [header, details] = rawError.split('Detalhes:')
    return `${header.trim()}\nDetalhes: ${details.trim()}`
  }

  return rawError
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
export function generateMLTitle(
  product: Product,
  overrides?: {
    conditionType?: 'novo' | 'usado' | 'recondicionado' | 'caixa_aberta'
    conditionGrade?: 'excelente' | 'bom' | 'aceitavel'
  },
): string {
  const brand = (product.brand || '').trim()
  const model = (product.model || '').trim()
  const proc = (product.processor || '').replace(/Processador\s*/i, '').trim()
  const ram = (product.ram || '').trim()
  const storage = (product.storage || '').trim()

  const condType = (overrides?.conditionType || product.condition_type || '').toLowerCase()
  const condGrade = (overrides?.conditionGrade || product.condition_grade || '').toLowerCase()
  const isRefurbished = condType === 'recondicionado' || condType === 'refurbished'
  const gradeShort =
    condGrade === 'excelente'
      ? 'Excelente'
      : condGrade === 'bom'
        ? 'Bom'
        : condGrade === 'aceitavel'
          ? 'Aceitável'
          : ''

  // Se for recondicionado e tiver grau, tentar incluir "Recondicionado - Grau" se couber
  if (isRefurbished && gradeShort) {
    const candidate1 = `${brand} ${model} ${proc} ${ram} Recondicionado - ${gradeShort}`.trim()
    if (candidate1.length <= 60 && candidate1.length > 10) return candidate1

    const candidate2 = `${brand} ${model} ${proc} Recondicionado - ${gradeShort}`.trim()
    if (candidate2.length <= 60 && candidate2.length > 10) return candidate2

    const candidate3 = `${brand} ${model} Recondicionado - ${gradeShort}`.trim()
    if (candidate3.length <= 60 && candidate3.length > 10) return candidate3
  }

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
export function generateMLDescription(
  product: Product,
  overrides?: {
    conditionType?: 'novo' | 'usado' | 'recondicionado' | 'caixa_aberta'
    conditionGrade?: 'excelente' | 'bom' | 'aceitavel'
  },
): string {
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
  const typeMap: Record<string, string> = {
    recondicionado: 'Recondicionado',
    usado: 'Usado',
    caixa_aberta: 'Caixa aberta',
    novo: 'Novo',
  }
  const gradeMap: Record<string, string> = {
    excelente: 'Excelente (marcas sutis, tela sem detalhes)',
    bom: 'Bom (marcas pequenas, tela sem detalhes)',
    aceitavel: 'Aceitável (marcas visíveis de uso)',
  }
  const activeType = overrides?.conditionType || product.condition_type
  const activeGrade = overrides?.conditionGrade || product.condition_grade
  const cType = activeType ? typeMap[activeType] || activeType : ''
  const cGrade = activeGrade ? gradeMap[activeGrade] || activeGrade : ''

  if (cType && cGrade) {
    lines.push(`• Condição / Estado (Padrão Mercado Livre): ${cType} — Grau: ${cGrade}`)
  } else if (cType) {
    lines.push(`• Condição / Tipo (Padrão Mercado Livre): ${cType}`)
  } else if (product.condition) {
    lines.push(`• Condição: ${product.condition}`)
  }
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
  lines.push('--- GARANTIA & CONDIÇÕES GERAIS ---')
  lines.push('• Garantia de 90 dias contra qualquer defeito de funcionamento.')
  lines.push('• Equipamento revisado e aprovado em checklist técnico detalhado de 16 itens.')
  lines.push('• Nota fiscal emitida com garantia.')
  lines.push(
    '• Produto cuidadosamente higienizado e embalado com proteção antichoque para envio rápido e seguro.',
  )

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

  const resolvedType =
    product.condition_type ||
    (product.condition?.toLowerCase().includes('novo') ? 'novo' : 'recondicionado')
  const resolvedGrade = product.condition_grade
  if (resolvedType === 'recondicionado' && !resolvedGrade) {
    // Não bloqueia mais no batch se o usuário puder escolher no modal;
    // mas se ambos faltarem, avisa:
    reasons.push('Recondicionados exigem grau de estado (Excelente, Bom ou Aceitável)')
  }

  // Verificar se possui marca e modelo para satisfazer BRAND/MODEL da categoria do ML
  if (!product.brand?.trim() && !product.name?.trim()) {
    reasons.push('Marca do equipamento não informada')
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
        condition_type: payload.condition_type,
        condition_grade: payload.condition_grade,
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
