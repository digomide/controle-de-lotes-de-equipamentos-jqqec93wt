import pb from '@/lib/pocketbase/client'
import type { Product } from '@/types/inventory'
import { getMLItemCondition, getMLGradeLabel } from '@/lib/condition'
import { ProductSimilarityMatcher, LocalProductCandidate } from './productMatchingService'
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

export interface MLItemVariationAttribute {
  id?: string
  name?: string
  value_id?: string
  value_name?: string
}

export interface MLItemVariation {
  id: string
  price: number
  available_quantity: number
  sold_quantity?: number
  attribute_combinations?: MLItemVariationAttribute[]
  attributes?: MLItemVariationAttribute[]
  label?: string
  specsSummary?: string
}

export interface MLSellerItem {
  id: string
  title: string
  price: number
  currency_id: string
  available_quantity: number
  sold_quantity: number
  condition: string
  condition_grade?: string
  status: 'active' | 'paused' | 'closed' | string
  permalink: string
  thumbnail: string
  pictures_count?: number
  listing_type_id?: string
  date_created?: string
  last_updated?: string
  gtin?: string
  brand?: string
  model?: string
  line?: string
  catalog_product_id?: string
  catalog_listing?: boolean
  domain_id?: string
  parent_item_id?: string
  variations?: MLItemVariation[]
  attributes?: MLItemVariationAttribute[]
  // Dados de correspondência com catálogo local
  matchedProduct?: MLMatchedProduct
  matchedProducts?: MLMatchedProduct[]
}

/**
 * Normaliza um identificador do Mercado Livre para o padrão canônico MLB123456789.
 * Remove pontuações, traços de sufixos de variação e adiciona o prefixo MLB caso ausente.
 */
export function normalizeMlbId(rawId: string | undefined | null): string {
  if (!rawId) return ''
  const trimmed = String(rawId).trim()
  if (!trimmed) return ''

  // Se houver sufixos de variação (ex.: MLB123456789-01 ou 123456789_01), isola a raiz do anúncio
  const basePart = trimmed.split(/[-_]/)[0] || trimmed

  // Extrai dígitos numéricos ou padrão MLB
  const mlbMatch = basePart.match(/^MLB-?([0-9]+)/i)
  if (mlbMatch && mlbMatch[1]) {
    return `MLB${mlbMatch[1]}`
  }

  const digitsOnly = basePart.replace(/\D/g, '')
  if (digitsOnly.length >= 6) {
    return `MLB${digitsOnly}`
  }

  return basePart.toUpperCase().startsWith('MLB') ? basePart.toUpperCase() : `MLB${basePart}`
}

/**
 * Gera URL de navegação direta para o anúncio no Mercado Livre com garantia de permalink válido.
 */
export function buildMLAdUrl(item: {
  permalink?: string
  id?: string
  parent_item_id?: string
}): string {
  if (!item) return ''
  const permalink = (item.permalink || '').trim()
  if (permalink.startsWith('http://') || permalink.startsWith('https://')) {
    return permalink
  }

  const normalizedId = normalizeMlbId(item.id || item.parent_item_id)
  if (normalizedId) {
    return `https://produto.mercadolivre.com.br/${normalizedId}`
  }

  return ''
}

/**
 * Helper reutilizável para validação e parse defensivo de itens retornados pela fila ml_ads_fetch_jobs.
 * O PocketBase e o SDK ora retornam o campo JSON `items` já desserializado (Array),
 * ora serializado como string JSON. Este helper trata com segurança ambos os cenários
 * e valida que cada item retornado tenha formato minimamente válido antes de incluí-lo na lista.
 */
export function parseItemsPayload(raw: any): MLSellerItem[] {
  if (!raw) return []

  let parsedArray: any[] = []

  if (Array.isArray(raw)) {
    parsedArray = raw
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
      return []
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        parsedArray = parsed
      } else if (parsed && typeof parsed === 'object') {
        // Se por ventura veio encapsulado em { items: [...] } ou { results: [...] }
        if (Array.isArray(parsed.items)) {
          parsedArray = parsed.items
        } else if (Array.isArray(parsed.results)) {
          parsedArray = parsed.results
        } else if (parsed.id) {
          parsedArray = [parsed]
        }
      }
    } catch (parseErr) {
      console.warn('[mlService] Falha ao desserializar payload JSON de items:', parseErr)
      return []
    }
  } else if (typeof raw === 'object') {
    // Objeto genérico
    if (Array.isArray(raw.items)) {
      parsedArray = raw.items
    } else if (Array.isArray(raw.results)) {
      parsedArray = raw.results
    }
  }

  // Filtrar e validar estrutura mínima de cada item (deve ser objeto não nulo com id)
  const validItems: MLSellerItem[] = []
  for (const it of parsedArray) {
    if (!it || typeof it !== 'object') continue
    const id = it.id ? String(it.id).trim() : ''
    if (!id) continue

    // Verifica presença de variações
    const rawVars = Array.isArray(it.variations)
      ? it.variations.filter((v: any) => v && typeof v === 'object')
      : []

    // Regra de catálogo: catalog_product_id OU flag catalog_listing OU variações preenchidas (> 0)
    const isCatalog = Boolean(
      (typeof it.catalog_product_id === 'string' && it.catalog_product_id.trim().length > 0) ||
      it.catalog_listing === true ||
      rawVars.length > 0,
    )

    // Permalink com fallback imediato baseado em id normalizado
    const permalink = buildMLAdUrl({
      permalink: it.permalink,
      id,
      parent_item_id: it.parent_item_id,
    })

    validItems.push({
      ...it,
      id,
      title: typeof it.title === 'string' ? it.title : it.title || id,
      price: Number(it.price) || 0,
      currency_id: it.currency_id || 'BRL',
      available_quantity: Number(it.available_quantity) || 0,
      sold_quantity: Number(it.sold_quantity) || 0,
      status: it.status || 'active',
      permalink,
      thumbnail: it.thumbnail || '',
      catalog_listing: isCatalog,
      variations: rawVars.length > 0 ? rawVars : it.variations || undefined,
    })
  }

  return validItems
}

export function formatMLVariationSummary(variation: MLItemVariation, currencyId = 'BRL'): string {
  const parts: string[] = []

  const combs = [...(variation.attribute_combinations || []), ...(variation.attributes || [])]

  let ram = ''
  let storage = ''
  let proc = ''
  let color = ''
  const others: string[] = []

  combs.forEach((c) => {
    const cid = (c.id || '').toUpperCase()
    const cname = (c.name || '').toLowerCase()
    const val = (c.value_name || '').trim()
    if (!val) return

    if (cid.includes('RAM') || cname.includes('ram') || cname.includes('memória')) {
      ram = val
    } else if (
      cid.includes('STORAGE') ||
      cid.includes('SSD') ||
      cid.includes('HARD_DRIVE') ||
      cname.includes('armazenamento') ||
      cname.includes('disco') ||
      cname.includes('ssd') ||
      cname.includes('hd')
    ) {
      storage = val
    } else if (
      cid.includes('PROCESSOR') ||
      cname.includes('processador') ||
      cname.includes('cpu')
    ) {
      proc = val
    } else if (cid.includes('COLOR') || cname.includes('cor')) {
      color = val
    } else if (!cid.includes('GTIN') && !cname.includes('código')) {
      others.push(val)
    }
  })

  if (proc) parts.push(proc)
  if (ram) parts.push(ram)
  if (storage) parts.push(storage)
  if (color && parts.length === 0) parts.push(color)
  if (parts.length === 0 && others.length > 0) parts.push(...others.slice(0, 2))

  const specLabel =
    parts.length > 0
      ? parts.join(' · ')
      : variation.label || `Variação #${variation.id.slice(-4) || variation.id}`
  const priceFormatted = Number(variation.price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: currencyId || 'BRL',
    maximumFractionDigits: 0,
  })
  const stockText = `${variation.available_quantity ?? 0} un.`

  return `${specLabel} — ${priceFormatted} (${stockText})`
}

export interface MLMatchedProduct {
  id: string
  name: string
  sku: string
  serial_number?: string
  status: string
  unit_price: number
  cost_price?: number
  brand?: string
  model?: string
  processor?: string
  ram?: string
  storage?: string
  screen_size?: string
  condition?: string
  match_type: 'ml_listing_id' | 'gtin' | 'similarity'
  match_score?: number
  match_reasons?: string[]
  is_suggested?: boolean
}

/**
 * Extrai e compacta especificações de hardware (processador, memória, armazenamento, tela)
 * a partir dos campos do produto ou por extração textual do nome caso os campos estejam vazios.
 * Exemplo de retorno: "Latitude 3420 · i5 · 8GB · SSD 256GB" ou apenas as specs "i5 · 8GB · SSD 256GB"
 */
export function formatProductConfigSpecs(
  product: {
    name?: string
    brand?: string
    model?: string
    processor?: string
    ram?: string
    storage?: string
    screen_size?: string
  },
  options?: {
    includeModel?: boolean
    separator?: string
  },
): {
  model: string
  processor: string
  ram: string
  storage: string
  screen: string
  compactSummary: string
  specsOnly: string
} {
  const pName = (product.name || '').trim()
  const sep = options?.separator || ' · '

  // 1. Modelo / Linha
  let model = (product.model || '').trim()
  if (!model && pName) {
    const m = pName.match(
      /(?:Notebook\s+)?(?:Dell|Lenovo|HP|Apple|Acer|Asus|Samsung|Positivo)?\s*([A-Za-z0-9-]+(?:\s+[A-Za-z0-9-]+)?)/i,
    )
    if (m && m[1]) model = m[1].trim()
  }

  // 2. Processador curto (i5, i7, Ryzen 5, etc.)
  const rawProc = (product.processor || '' + ' ' + pName).trim()
  let processor = ''
  if (/i7|core\s*i7/i.test(rawProc)) processor = 'i7'
  else if (/i5|core\s*i5/i.test(rawProc)) processor = 'i5'
  else if (/i3|core\s*i3/i.test(rawProc)) processor = 'i3'
  else if (/i9|core\s*i9/i.test(rawProc)) processor = 'i9'
  else if (/ryzen\s*7/i.test(rawProc)) processor = 'Ryzen 7'
  else if (/ryzen\s*5/i.test(rawProc)) processor = 'Ryzen 5'
  else if (/ryzen\s*3/i.test(rawProc)) processor = 'Ryzen 3'
  else if (/ryzen\s*9/i.test(rawProc)) processor = 'Ryzen 9'
  else if (/celeron/i.test(rawProc)) processor = 'Celeron'
  else if (/xeon/i.test(rawProc)) processor = 'Xeon'
  else if (/\bm3\b/i.test(rawProc)) processor = 'M3'
  else if (/\bm2\b/i.test(rawProc)) processor = 'M2'
  else if (/\bm1\b/i.test(rawProc)) processor = 'M1'
  else if (product.processor) {
    processor = product.processor.replace(/geração|geracao|gen\b/gi, '').trim()
  }

  // 3. RAM (8GB, 16GB, etc.)
  const rawRam = (product.ram || '' + ' ' + pName).trim()
  let ram = ''
  const ramMatch = rawRam.match(/(\d+)\s*GB/i)
  if (ramMatch && ramMatch[1]) {
    ram = `${ramMatch[1]}GB`
  } else if (product.ram) {
    ram = product.ram.trim()
  }

  // 4. Armazenamento (SSD 256GB, SSD 512GB, HD 500GB, etc.)
  const rawStorage = (product.storage || '' + ' ' + pName).trim()
  let storage = ''
  const storageCapMatch = rawStorage.match(/(\d+)\s*(GB|TB)?/i)
  const isHD = /HD\b|Hard\s*Drive/i.test(rawStorage) && !/SSD/i.test(rawStorage)
  if (storageCapMatch && storageCapMatch[1]) {
    const typeLabel = isHD ? 'HD' : 'SSD'
    const unit = storageCapMatch[2] ? storageCapMatch[2].toUpperCase() : 'GB'
    storage = `${typeLabel} ${storageCapMatch[1]}${unit === 'GB' || unit === 'TB' ? unit : 'GB'}`
  } else if (product.storage) {
    storage = product.storage.trim()
  }

  // 5. Tela (14", 15.6", etc.)
  const rawScreen = (product.screen_size || '' + ' ' + pName).trim()
  let screen = ''
  const screenMatch = rawScreen.match(/(\d{2}(?:\.\d)?)\s*(?:["”']|pol|polegadas)?/i)
  if (screenMatch && screenMatch[1]) {
    const val = parseFloat(screenMatch[1])
    if (val >= 10 && val <= 21) {
      screen = `${screenMatch[1]}"`
    }
  } else if (product.screen_size) {
    screen = product.screen_size.trim()
  }

  const specsList = [processor, ram, storage, screen].filter(Boolean)
  const specsOnly = specsList.join(sep)

  const summaryTokens = []
  if (options?.includeModel && model) {
    summaryTokens.push(model)
  }
  summaryTokens.push(...specsList)

  const compactSummary =
    summaryTokens.length > 0 ? summaryTokens.join(sep) : product.name || 'Configuração padrão'

  return {
    model,
    processor,
    ram,
    storage,
    screen,
    compactSummary,
    specsOnly,
  }
}

export interface MLSellerItemsResult {
  seller_id: string
  seller_nickname?: string
  paging: {
    total: number
    offset: number
    limit: number
  }
  items: MLSellerItem[]
  total: number
}

export interface MLPublishPayload {
  product_id: string
  title: string
  price: number
  category_id?: string
  description?: string
  pictures?: string[]
  condition_type?: 'novo' | 'usado' | 'recondicionado' | 'caixa_aberta'
  condition_grade?: 'excelente' | 'bom' | 'aceitavel'
  family_name?: string
  gtin?: string
}

/**
 * Valida formato do código GTIN/EAN (apenas dígitos, 8 a 14 caracteres)
 */
export function validateGTIN(gtin: string): { valid: boolean; message?: string } {
  const trimmed = (gtin || '').trim()
  if (!trimmed) {
    return { valid: true } // Vazio é permitido para tentativa com isenção
  }
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, message: 'O código de barras deve conter apenas números.' }
  }
  if (trimmed.length < 8 || trimmed.length > 14) {
    return {
      valid: false,
      message: `Tamanho inválido (${trimmed.length} dígitos). O código deve ter entre 8 e 14 dígitos (EAN-8, UPC-12, EAN-13, EAN-14).`,
    }
  }
  return { valid: true }
}
export interface MLCategoryAttributeValue {
  id: string
  name: string
}

export interface MLCategoryAttribute {
  id: string
  name: string
  tags?: {
    required?: boolean
    catalog_required?: boolean
    conditional_required?: boolean
    read_only?: boolean
    hidden?: boolean
    allow_custom_value?: boolean
    [key: string]: any
  }
  value_type?: string
  values?: MLCategoryAttributeValue[]
  [key: string]: any
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
    gtin: 'Código de barras de fábrica (GTIN/EAN)',
    empty_gtin_reason: 'Motivo de isenção de código de barras',
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

  // Tratamento específico de GTIN obrigatório da categoria (cause 7810 / missing_conditional_required)
  if (
    rawError.includes('item.attribute.missing_conditional_required') ||
    rawError.includes('7810') ||
    (rawError.includes('missing_conditional_required') && rawError.includes('GTIN')) ||
    (rawError.includes('[GTIN]') && rawError.toLowerCase().includes('required'))
  ) {
    return "O Mercado Livre exige o código de barras de fábrica (GTIN/EAN) deste equipamento. Cole o código no campo 'Código de barras (GTIN/EAN)' do modal."
  }

  // Tratamento específico de erro no título
  if (
    rawError.includes('The fields [title] are invalid') ||
    rawError.includes('fields [title] are invalid') ||
    rawError.includes('[title] are invalid') ||
    rawError.includes('title: invalid') ||
    rawError.includes('title is invalid')
  ) {
    return 'O Mercado Livre rejeitou o título do anúncio. O ML exige título conciso (máx. 60 caracteres), sem aspas ou caracteres especiais, e no padrão: "Notebook" + Marca + Modelo + Processador + RAM + Armazenamento.'
  }

  // Tratamento específico de body.invalid_fields
  if (rawError.includes('body.invalid_fields')) {
    // Se vier com cause ou detalhes listados
    if (
      rawError.includes('Detalhes:') ||
      rawError.includes(' — ') ||
      rawError.includes('Resposta:')
    ) {
      const parts = rawError.split(/Detalhes:\s*|—\s*|Resposta:\s*/)
      const detailStr = parts[1] || ''

      if (
        detailStr.includes('The fields [title] are invalid') ||
        detailStr.includes('[title] are invalid')
      ) {
        return 'O Mercado Livre rejeitou o título do anúncio. O ML exige título conciso (máx. 60 caracteres), sem aspas ou caracteres especiais, e no padrão: "Notebook" + Marca + Modelo + Processador + RAM + Armazenamento.'
      }
      if (detailStr) {
        const causes = detailStr
          .split(';')
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => {
            const matchColon = c.match(/^([a-zA-Z0-9_]+)\s*:\s*(.*)$/)
            if (matchColon) {
              const fieldName = friendlyDict[matchColon[1].toLowerCase()] || matchColon[1]
              return `Campo ${fieldName}: ${matchColon[2]}`
            }
            return c
          })
        if (causes.length > 0) {
          return `O Mercado Livre rejeitou alguns campos do anúncio:\n• ${causes.join('\n• ')}`
        }
      }
    }

    if (rawError.toLowerCase().includes('title')) {
      return 'O Mercado Livre rejeitou o título do anúncio. Verifique se o título atende às regras da categoria (máximo 60 caracteres).'
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

    if (rawFields.some((f) => f.toLowerCase() === 'family_name')) {
      return 'Família/Linha do produto: confirme no campo editável do anúncio (pré-preenchido automaticamente).'
    }

    if (rawFields.length > 0) {
      const translated = rawFields.map((f) => friendlyDict[f.toLowerCase()] || f).join(', ')
      return `O Mercado Livre exige os seguintes campos obrigatórios: ${translated}. Revise o anúncio para preenchê-los.`
    }

    return 'O Mercado Livre exige campos obrigatórios que não foram informados (ex: família do produto ou marca/modelo). Revise as informações do anúncio.'
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
 * Mapeamento e derivação automática de família/linha (LINE) a partir dos dados do equipamento
 * Cobre: ThinkPad, IdeaPad, Legion (Lenovo), Inspiron, Latitude, Vostro, XPS, Precision, Alienware (Dell),
 * MacBook Air, MacBook Pro, iMac, MacBook (Apple), Pavilion, EliteBook, ProBook, Omen, Spectre, Envy, ZBook (HP),
 * Aspire, Predator, Nitro, Swift, Spin, TravelMate (Acer), Satellite, Dynabook, Portege, Tecra (Toshiba/Dynabook),
 * VivoBook, ZenBook, TUF, ROG, ExpertBook (Asus), VAIO, Motion, Unique, Master (Positivo), Galaxy Book (Samsung), Surface (Microsoft).
 */
export function deriveProductFamily(
  product: { name?: string; model?: string; brand?: string },
  customFamily?: string,
): string {
  const explicit = (customFamily || '').trim()
  if (explicit) return explicit

  const pModel = (product.model || '').trim()
  const pName = (product.name || '').trim()
  const pBrand = (product.brand || '').trim()
  const combined = `${pModel} ${pName}`.trim()

  // Lenovo
  if (/thinkpad/i.test(combined)) return 'ThinkPad'
  if (/ideapad/i.test(combined)) return 'IdeaPad'
  if (/legion/i.test(combined)) return 'Legion'
  if (/yoga/i.test(combined)) return 'Yoga'

  // Dell
  if (/latitude/i.test(combined)) return 'Latitude'
  if (/inspiron/i.test(combined)) return 'Inspiron'
  if (/vostro/i.test(combined)) return 'Vostro'
  if (/precision/i.test(combined)) return 'Precision'
  if (/xps/i.test(combined)) return 'XPS'
  if (/alienware/i.test(combined)) return 'Alienware'

  // Apple
  if (/macbook\s*pro/i.test(combined)) return 'MacBook Pro'
  if (/macbook\s*air/i.test(combined)) return 'MacBook Air'
  if (/macbook/i.test(combined)) return 'MacBook'
  if (/imac/i.test(combined)) return 'iMac'

  // HP
  if (/elitebook/i.test(combined)) return 'EliteBook'
  if (/probook/i.test(combined)) return 'ProBook'
  if (/pavilion/i.test(combined)) return 'Pavilion'
  if (/omen/i.test(combined)) return 'Omen'
  if (/spectre/i.test(combined)) return 'Spectre'
  if (/envy/i.test(combined)) return 'Envy'
  if (/zbook/i.test(combined)) return 'ZBook'

  // Acer
  if (/aspire/i.test(combined)) return 'Aspire'
  if (/predator/i.test(combined)) return 'Predator'
  if (/nitro/i.test(combined)) return 'Nitro'
  if (/swift/i.test(combined)) return 'Swift'
  if (/spin/i.test(combined)) return 'Spin'
  if (/travelmate/i.test(combined)) return 'TravelMate'

  // Asus
  if (/vivobook/i.test(combined)) return 'VivoBook'
  if (/zenbook/i.test(combined)) return 'ZenBook'
  if (/expertbook/i.test(combined)) return 'ExpertBook'
  if (/\brog\b/i.test(combined)) return 'ROG'
  if (/\btuf\b/i.test(combined)) return 'TUF'

  // Toshiba / Dynabook
  if (/satellite/i.test(combined)) return 'Satellite'
  if (/dynabook/i.test(combined)) return 'Dynabook'
  if (/portege/i.test(combined)) return 'Portege'
  if (/tecra/i.test(combined)) return 'Tecra'

  // Samsung
  if (/galaxy\s*book/i.test(combined)) return 'Galaxy Book'

  // Microsoft
  if (/surface/i.test(combined)) return 'Surface'

  // Positivo
  if (/unique/i.test(combined)) return 'Unique'
  if (/motion/i.test(combined)) return 'Motion'
  if (/master/i.test(combined)) return 'Master'

  // VAIO
  if (/\bvaio\b/i.test(combined)) return 'VAIO'

  // Se houver modelo preenchido, usa as primeiras palavras do modelo
  if (pModel) {
    const firstWord = pModel.split(/[\s-]+/)[0]
    if (firstWord && firstWord.length >= 2) return firstWord
    return pModel
  }

  // Fallback para marca ou primeira palavra representativa do nome
  if (pBrand) return pBrand
  if (pName) {
    const words = pName.split(/\s+/).filter(Boolean)
    if (words.length > 1 && words[0].toLowerCase() === 'notebook') {
      return words[1]
    }
    if (words.length > 0) return words[0]
  }

  return ''
}

/**
 * Extrai e simplifica tokens essenciais para gerar título de no máximo 60 caracteres.
 * Formato preferido do usuário (confirmado):
 * "Notebook Lenovo ThinkPad T580 i7 16GB SSD 256 15.6\""
 * Regras: "Notebook" + Marca + Modelo/Linha + Processador curto (i5/i7/i9/Celeron/Ryzen 5) +
 * Memória RAM curta + Armazenamento curto (SSD 256, HD 500) + Tela curta (15.6", 14")
 * Remove redundâncias ("8ª Geração", "Nvme" → "SSD", parênteses, aspas extras).
 */
export function generateMLTitle(
  product: Product,
  _overrides?: {
    conditionType?: 'novo' | 'usado' | 'recondicionado' | 'caixa_aberta'
    conditionGrade?: 'excelente' | 'bom' | 'aceitavel'
  },
): string {
  // 1. Marca
  let brand = (product.brand || '').trim()
  const rawName = (product.name || '').trim()
  if (!brand) {
    if (/lenovo/i.test(rawName)) brand = 'Lenovo'
    else if (/dell/i.test(rawName)) brand = 'Dell'
    else if (/hp/i.test(rawName)) brand = 'HP'
    else if (/apple/i.test(rawName)) brand = 'Apple'
    else if (/acer/i.test(rawName)) brand = 'Acer'
    else if (/asus/i.test(rawName)) brand = 'Asus'
    else if (/samsung/i.test(rawName)) brand = 'Samsung'
    else if (/positivo/i.test(rawName)) brand = 'Positivo'
  }

  // 2. Modelo / Linha curto
  let model = (product.model || '').trim()
  if (!model) {
    // Tentar extrair do nome: ex: ThinkPad T580, Latitude 5320
    const m = rawName.match(
      /(ThinkPad\s+[A-Za-z0-9]+|Latitude\s+[A-Za-z0-9]+|Inspiron\s+[A-Za-z0-9]+|Vostro\s+[A-Za-z0-9]+|EliteBook\s+[A-Za-z0-9]+|ProBook\s+[A-Za-z0-9]+|MacBook\s+(?:Pro|Air)?(?:\s+[A-Za-z0-9]+)?)/i,
    )
    if (m && m[1]) {
      model = m[1].trim()
    }
  }
  // Se o modelo já inclui a marca, remover duplicação (ex: "Lenovo ThinkPad T580")
  if (brand && model.toLowerCase().startsWith(brand.toLowerCase())) {
    model = model.slice(brand.length).trim()
  }

  // 3. Processador curto (ex: i7, i5, i3, i9, Ryzen 5, Celeron, M1, M2)
  const fullProc = (product.processor || '' + ' ' + rawName).trim()
  let shortProc = ''
  if (/i7|core\s*i7/i.test(fullProc)) shortProc = 'i7'
  else if (/i5|core\s*i5/i.test(fullProc)) shortProc = 'i5'
  else if (/i3|core\s*i3/i.test(fullProc)) shortProc = 'i3'
  else if (/i9|core\s*i9/i.test(fullProc)) shortProc = 'i9'
  else if (/ryzen\s*7/i.test(fullProc)) shortProc = 'Ryzen 7'
  else if (/ryzen\s*5/i.test(fullProc)) shortProc = 'Ryzen 5'
  else if (/ryzen\s*3/i.test(fullProc)) shortProc = 'Ryzen 3'
  else if (/ryzen\s*9/i.test(fullProc)) shortProc = 'Ryzen 9'
  else if (/celeron/i.test(fullProc)) shortProc = 'Celeron'
  else if (/xeon/i.test(fullProc)) shortProc = 'Xeon'
  else if (/\bm3\b/i.test(fullProc)) shortProc = 'M3'
  else if (/\bm2\b/i.test(fullProc)) shortProc = 'M2'
  else if (/\bm1\b/i.test(fullProc)) shortProc = 'M1'

  // 4. Memória RAM curta (ex: "16GB", "8GB", "32GB")
  const fullRam = (product.ram || '' + ' ' + rawName).trim()
  let shortRam = ''
  const ramMatch = fullRam.match(/(\d+)\s*GB/i)
  if (ramMatch && ramMatch[1]) {
    shortRam = `${ramMatch[1]}GB`
  }

  // 5. Armazenamento curto: "SSD 256", "SSD 512", "HD 500"
  const fullStorage = (product.storage || '' + ' ' + rawName).trim()
  let shortStorage = ''
  const storageCapMatch = fullStorage.match(/(\d+)\s*(GB|TB|Nvme)?/i)
  const isHD = /HD\b|Hard\s*Drive/i.test(fullStorage) && !/SSD/i.test(fullStorage)
  if (storageCapMatch && storageCapMatch[1]) {
    const typeLabel = isHD ? 'HD' : 'SSD'
    shortStorage = `${typeLabel} ${storageCapMatch[1]}`
  }

  // 6. Tela curta: '15.6' ou '15.6 Pol' (sem aspas duplas no título para evitar incompatibilidade com API de títulos do ML)
  const fullScreen = (product.screen_size || '' + ' ' + rawName).trim()
  let shortScreen = ''
  const screenMatch = fullScreen.match(/(\d{2}(?:\.\d)?)\s*(?:["”']|pol|polegadas)?/i)
  if (screenMatch && screenMatch[1]) {
    const val = parseFloat(screenMatch[1])
    if (val >= 10 && val <= 21) {
      // Usar número puro ou 15.6 para títulos do ML
      shortScreen = `${screenMatch[1]}`
    }
  }

  // Montagem progressiva do título testando tamanho <= 60 caracteres
  // Nível 1: Completo com Notebook + Marca + Modelo + Proc + RAM + Storage + Tela
  const tokensLevel1 = [
    'Notebook',
    brand,
    model,
    shortProc,
    shortRam,
    shortStorage,
    shortScreen,
  ].filter(Boolean)
  let candidate = tokensLevel1.join(' ')
  if (candidate.length <= 60) return candidate

  // Nível 2: Sem tela se exceder 60
  const tokensLevel2 = ['Notebook', brand, model, shortProc, shortRam, shortStorage].filter(Boolean)
  candidate = tokensLevel2.join(' ')
  if (candidate.length <= 60) return candidate

  // Nível 3: Sem palavra "Notebook" se ainda exceder
  const tokensLevel3 = [brand, model, shortProc, shortRam, shortStorage, shortScreen].filter(
    Boolean,
  )
  candidate = tokensLevel3.join(' ')
  if (candidate.length <= 60) return candidate

  // Nível 4: Sem tela
  const tokensLevel4 = [brand, model, shortProc, shortRam, shortStorage].filter(Boolean)
  candidate = tokensLevel4.join(' ')
  if (candidate.length <= 60) return candidate

  // Nível 5: Sem storage
  const tokensLevel5 = [brand, model, shortProc, shortRam].filter(Boolean)
  candidate = tokensLevel5.join(' ')
  if (candidate.length <= 60) return candidate

  // Fallback seguro truncado em 60
  const fallback = `Notebook ${brand} ${model}`.trim()
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

  // Se houver photo_order configurado, respeitar essa sequência prioritária
  if (product.photo_order && Array.isArray(product.photo_order) && product.photo_order.length > 0) {
    const validPhotosSet = new Set(Array.isArray(product.photos) ? product.photos : [])
    const validImagesSet = new Set(Array.isArray(product.images) ? product.images : [])
    const visitedPhotos = new Set<string>()
    const visitedImages = new Set<string>()

    for (const item of product.photo_order) {
      if (!item || !item.value) continue
      if (item.type === 'photo' && validPhotosSet.has(item.value)) {
        const fileUrl = pb.files.getURL(product, item.value)
        const fullUrl =
          fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
            ? fileUrl
            : `${window.location.origin}${fileUrl}`
        urls.push(fullUrl)
        visitedPhotos.add(item.value)
      } else if (
        item.type === 'image' &&
        (validImagesSet.has(item.value) || item.value.startsWith('http'))
      ) {
        const trimmed = item.value.trim()
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          urls.push(trimmed)
          visitedImages.add(trimmed)
        }
      }
    }

    if (product.photos && Array.isArray(product.photos)) {
      for (const file of product.photos) {
        if (file && !visitedPhotos.has(file)) {
          const fileUrl = pb.files.getURL(product, file)
          const fullUrl =
            fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
              ? fileUrl
              : `${window.location.origin}${fileUrl}`
          urls.push(fullUrl)
        }
      }
    }

    if (product.images && Array.isArray(product.images)) {
      for (const img of product.images) {
        if (img && typeof img === 'string') {
          const trimmed = img.trim()
          if (
            (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
            !visitedImages.has(trimmed)
          ) {
            urls.push(trimmed)
          }
        }
      }
    }

    if (urls.length > 0) {
      return urls
    }
  }

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
/**
 * Validação profunda de requisitos para anúncio no ML com base nos atributos oficiais da categoria
 */
export function validateProductForML(
  product: Product,
  options?: {
    title?: string
    price?: number
    conditionType?: string
    conditionGrade?: string
    categoryAttributes?: MLCategoryAttribute[]
    familyName?: string
    gtin?: string
  },
): { eligible: boolean; reasons: string[]; warnings?: string[] } {
  const reasons: string[] = []

  // 1. Status do produto
  if (product.status !== 'Disponível') {
    reasons.push(`Status atual é "${product.status || 'Indefinido'}" (exige "Disponível")`)
  }

  // 2. Preço de venda
  const price =
    options?.price !== undefined ? Number(options.price) : Number(product.unit_price) || 0
  if (price <= 0) {
    reasons.push('Preço de venda não configurado ou zero (deve ser maior que zero)')
  }

  // 3. Fotos
  const photos = getProductImageUrls(product)
  if (photos.length === 0) {
    reasons.push(
      'Equipamento não possui nenhuma foto cadastrada (exige pelo menos 1 imagem pública)',
    )
  }

  // 4. Título do anúncio
  const currentTitle = (
    options?.title !== undefined ? options.title : generateMLTitle(product)
  ).trim()
  if (!currentTitle) {
    reasons.push('Título do anúncio é obrigatório')
  } else if (currentTitle.length > 60) {
    reasons.push(
      `Título excede o limite de 60 caracteres do Mercado Livre (atual: ${currentTitle.length} caracteres)`,
    )
  } else if (/["“”]/.test(currentTitle)) {
    reasons.push(
      'O título contém aspas (" ou “”). O Mercado Livre recomenda remover aspas para evitar rejeição da API.',
    )
  }

  // 5. Condição e Grau
  const resolvedType = (
    options?.conditionType ||
    product.condition_type ||
    (product.condition?.toLowerCase().includes('novo') ? 'novo' : 'recondicionado')
  ).toLowerCase()
  const resolvedGrade = options?.conditionGrade || product.condition_grade

  if ((resolvedType === 'recondicionado' || resolvedType === 'refurbished') && !resolvedGrade) {
    reasons.push(
      'Equipamentos recondicionados exigem o Grau de estado (Excelente, Bom ou Aceitável)',
    )
  }

  // 6. Atributos obrigatórios da categoria (se fornecidos pelo cache)
  const catAttrs = options?.categoryAttributes || []
  if (catAttrs.length > 0) {
    const rawBrand = (product.brand || '').trim()
    const rawModel = (product.model || '').trim()
    const rawProc = (product.processor || '').trim()
    const rawRam = (product.ram || '').trim()
    const rawStorage = (product.storage || '').trim()
    const rawScreen = (product.screen_size || '').trim()
    const rawName = (product.name || '').trim()

    // Friendly labels para atributos comuns
    const attrLabels: Record<string, string> = {
      BRAND: 'Marca (BRAND)',
      MODEL: 'Modelo (MODEL)',
      LINE: 'Linha/Família (LINE)',
      PROCESSOR_BRAND: 'Marca do Processador',
      PROCESSOR_LINE: 'Linha do Processador',
      PROCESSOR_MODEL: 'Modelo do Processador',
      RAM: 'Memória RAM',
      RAM_MEMORY_MODULE_TOTAL_CAPACITY: 'Capacidade total da memória RAM',
      SSD_DATA_STORAGE_CAPACITY: 'Capacidade do SSD',
      HARD_DRIVE_DATA_STORAGE_CAPACITY: 'Capacidade do HD',
      DISPLAY_SIZE: 'Tamanho da tela (ex: 15.6")',
      SCREEN_SIZE: 'Tamanho da tela',
      GRADING: 'Grau do recondicionado',
      ITEM_GRADE: 'Grau do estado',
    }

    for (const attr of catAttrs) {
      const tags = attr.tags || {}
      if (tags.read_only === true || tags.hidden === true) continue

      const isRequired =
        tags.required === true ||
        tags.catalog_required === true ||
        (tags.conditional_required === true &&
          (resolvedType === 'recondicionado' || resolvedType === 'refurbished') &&
          attr.id === 'GRADING')

      if (isRequired) {
        let isPresent = false

        if (attr.id === 'BRAND') {
          isPresent = Boolean(
            rawBrand || /lenovo|dell|hp|apple|acer|asus|samsung|positivo/i.test(rawName),
          )
        } else if (attr.id === 'MODEL') {
          isPresent = Boolean(rawModel || rawName)
        } else if (attr.id === 'LINE' || attr.id === 'family_name') {
          // Validação flexível: nunca exige campo gravado no banco;
          // valida valor de override digitado no modal ou derivação automática
          const family = (options?.familyName || deriveProductFamily(product) || '').trim()
          isPresent = Boolean(family)
        } else if (attr.id === 'PROCESSOR_BRAND' || attr.id === 'PROCESSOR_LINE') {
          isPresent = Boolean(
            rawProc || /intel|amd|ryzen|core|i3|i5|i7|i9|celeron|m1|m2|m3/i.test(rawName),
          )
        } else if (attr.id === 'PROCESSOR_MODEL') {
          isPresent = Boolean(rawProc || rawName)
        } else if (attr.id === 'RAM' || attr.id === 'RAM_MEMORY_MODULE_TOTAL_CAPACITY') {
          isPresent = Boolean(rawRam || /\d+\s*GB/i.test(rawName))
        } else if (attr.id === 'DISPLAY_SIZE' || attr.id === 'SCREEN_SIZE') {
          isPresent = Boolean(rawScreen || /\d{2}(?:\.\d)?\s*["”']/i.test(rawName))
        } else if (attr.id === 'GRADING' || attr.id === 'ITEM_GRADE') {
          isPresent = Boolean(resolvedGrade)
        } else {
          // Atributo genérico não mapeado: checar se há dados
          isPresent = true
        }

        if (!isPresent) {
          const label = attrLabels[attr.id] || attr.name || attr.id
          reasons.push(`Atributo obrigatório ausente: ${label}`)
        }
      }
    }
  } else {
    // Validação básica se não houver cache carregado no momento
    if (!product.brand?.trim() && !product.name?.trim()) {
      reasons.push('Marca do equipamento não informada')
    }
    if (!product.model?.trim() && !product.name?.trim()) {
      reasons.push('Modelo do equipamento não informado')
    }
  }

  // 7. Validação do código GTIN/EAN se informado
  const warnings: string[] = []
  const gtinToCheck = (options?.gtin !== undefined ? options.gtin : product.gtin || '').trim()
  if (gtinToCheck) {
    const valResult = validateGTIN(gtinToCheck)
    if (!valResult.valid) {
      reasons.push(valResult.message || 'Código de barras (GTIN/EAN) inválido')
    }
  } else {
    // Não bloqueia a publicação, mas recomenda
    warnings.push(
      'Código de barras (GTIN/EAN) não informado. Será enviada tentativa com isenção, mas o ML pode exigir o código de fábrica para notebooks.',
    )
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    warnings,
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
   * Consulta atributos da categoria no Mercado Livre com cache no backend (>24h).
   * Usa o endpoint local /api/ml/category-attributes/:id ou fallback para a coleção ml_category_cache.
   */
  async getCategoryAttributes(categoryId: string = 'MLB1652'): Promise<MLCategoryAttribute[]> {
    const cleanId = (categoryId || 'MLB1652').trim()

    // 1. Consulta prioritária na coleção ml_category_cache
    try {
      const list = await pb.collection('ml_category_cache').getList(1, 1, {
        filter: `category_id = "${cleanId}"`,
        sort: '-cached_at',
      })
      if (
        list.items.length > 0 &&
        Array.isArray(list.items[0].attributes) &&
        list.items[0].attributes.length > 0
      ) {
        return list.items[0].attributes
      }
    } catch {
      /* intentionally ignored */
    }

    // 2. Tenta chamar o endpoint customizado do backend
    try {
      const res = await pb.send(
        `/backend/v1/ml/category-attributes/${encodeURIComponent(cleanId)}`,
        {
          method: 'GET',
        },
      )
      if (res && Array.isArray(res.attributes) && res.attributes.length > 0) {
        return res.attributes
      }
    } catch (_) {
      // Falha de rede ou endpoint
    }

    return []
  },

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

    // Truncar e normalizar o título explicitamente para segurança máxima de 60 chars
    // Normalizar aspas curvas, substituir caracteres que possam falhar na validação do ML
    const cleanTitleInput = (payload.title || '')
      .toString()
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    const safeTitle = cleanTitleInput.slice(0, 60).trim()
    if (!safeTitle) {
      throw new Error('Título do anúncio não pode estar vazio.')
    }

    if (onProgress) {
      onProgress('Adicionando à fila de publicação...')
    }

    const queueItem = await pb.collection('ml_publish_queue').create({
      product: payload.product_id,
      status: 'pending',
      payload: {
        title: safeTitle,
        price: payload.price,
        category_id: payload.category_id || 'MLB1652',
        description: payload.description,
        photos: payload.pictures || [],
        listing_type_id: 'gold_special',
        condition_type: payload.condition_type,
        condition_grade: payload.condition_grade,
        family_name: payload.family_name,
        gtin: payload.gtin ? payload.gtin.trim() : undefined,
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

  /**
   * Atualiza preço do anúncio no ML via ml_item_queue + polling
   */
  async updateItemPrice(mlItemId: string, newPrice: number, productId?: string): Promise<any> {
    if (!newPrice || isNaN(newPrice) || newPrice <= 0) {
      throw new Error('O preço deve ser maior que zero.')
    }

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
        /* ignore */
      }
    }

    const queueItem = await pb.collection('ml_item_queue').create({
      product: targetProductId || null,
      ml_item_id: mlItemId,
      action: 'update_price',
      new_price: Number(newPrice.toFixed(2)),
      status: 'pending',
    })

    const queueId = queueItem.id
    const timeoutMs = 45_000
    const intervalMs = 1_500
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      await sleep(intervalMs)
      try {
        const current = await pb.collection('ml_item_queue').getOne(queueId)
        if (current.status === 'done') {
          return {
            success: true,
            id: mlItemId,
            price: newPrice,
          }
        }
        if (current.status === 'error') {
          throw new Error(current.error_message || 'Falha ao atualizar preço no Mercado Livre.')
        }
      } catch (err: any) {
        if (err.message && !err.status) throw err
      }
    }
    throw new Error('Tempo limite ao atualizar preço do anúncio no servidor.')
  },

  /**
   * Atualiza estoque (quantidade disponível) do anúncio no ML via ml_item_queue + polling
   */
  async updateItemStock(mlItemId: string, newQuantity: number, productId?: string): Promise<any> {
    if (
      newQuantity === undefined ||
      newQuantity === null ||
      isNaN(newQuantity) ||
      newQuantity < 0
    ) {
      throw new Error('A quantidade deve ser maior ou igual a zero.')
    }

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
        /* ignore */
      }
    }

    const queueItem = await pb.collection('ml_item_queue').create({
      product: targetProductId || null,
      ml_item_id: mlItemId,
      action: 'update_stock',
      new_quantity: Math.floor(newQuantity),
      status: 'pending',
    })

    const queueId = queueItem.id
    const timeoutMs = 45_000
    const intervalMs = 1_500
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      await sleep(intervalMs)
      try {
        const current = await pb.collection('ml_item_queue').getOne(queueId)
        if (current.status === 'done') {
          return {
            success: true,
            id: mlItemId,
            available_quantity: newQuantity,
          }
        }
        if (current.status === 'error') {
          throw new Error(
            current.error_message || 'Falha ao atualizar quantidade no Mercado Livre.',
          )
        }
      } catch (err: any) {
        if (err.message && !err.status) throw err
      }
    }
    throw new Error('Tempo limite ao atualizar estoque do anúncio no servidor.')
  },

  /**
   * Busca itens na fila de publicação (ml_publish_queue) com suporte a filtro de erro e reprocessamento
   */
  async getPublishQueueItems(options?: {
    status?: 'error' | 'pending' | 'processing' | 'done' | 'all'
    limit?: number
  }): Promise<any[]> {
    const status = options?.status || 'all'
    const limit = options?.limit || 50
    const filters: string[] = []
    if (status !== 'all') {
      filters.push(`status = "${status}"`)
    }

    try {
      const records = await pb.collection('ml_publish_queue').getList(1, limit, {
        filter: filters.join(' && ') || undefined,
        sort: '-created',
        expand: 'product',
        requestKey: null,
      })
      return records.items
    } catch (err) {
      console.warn('Erro ao carregar fila de publicação:', err)
      return []
    }
  },

  /**
   * Re-enfileira um anúncio que falhou na publicação criando novo registro pending ou resetando o atual
   */
  async retryPublishQueueItem(queueId: string): Promise<any> {
    const oldItem = await pb.collection('ml_publish_queue').getOne(queueId)
    // Cria um novo registro limpo com status 'pending' para reprocessar
    const newItem = await pb.collection('ml_publish_queue').create({
      product: oldItem.product,
      payload: oldItem.payload,
      status: 'pending',
    })
    return newItem
  },

  /**
   * Obtém a lista somente-leitura de anúncios do vendedor autenticado no Mercado Livre
   * e faz match com produtos existentes no catálogo (por ml_listing_id ou gtin).
   *
   * Arquitetura resiliente baseada em fila (ml_ads_fetch_jobs):
   * 1. Cria um registro em `ml_ads_fetch_jobs` com status 'pending'.
   * 2. O hook server-side `onRecordAfterCreateSuccess` busca os itens na API oficial do Mercado Livre com $http.send
   *    e salva os detalhes no próprio registro do job.
   * 3. O frontend faz polling a cada 600ms (timeout de 25s).
   * 4. Elimina a vulnerabilidade de routerAdd no boot do Skip Cloud (PocketBase v0.36), que causava HTTP 404.
   */
  async getSellerItems(params?: {
    limit?: number
    offset?: number
    status?: string
    onProgress?: (progressText: string) => void
  }): Promise<MLSellerItemsResult> {
    const limit = params?.limit || 50
    const offset = params?.offset || 0
    const statusFilter = params?.status || ''
    const onProgress = params?.onProgress

    // 1. Criar job em ml_ads_fetch_jobs
    let jobRecord: any = null
    try {
      jobRecord = await pb.collection('ml_ads_fetch_jobs').create({
        limit,
        offset,
        status_filter: statusFilter,
        status: 'pending',
        requested_by: pb.authStore.record?.id || pb.authStore.model?.id || null,
      })
    } catch (createErr: any) {
      console.error('Erro ao criar ml_ads_fetch_jobs:', createErr)
      throw new Error(
        createErr?.message ||
          'Não foi possível registrar solicitação de consulta ao Mercado Livre. Verifique sua sessão.',
      )
    }

    const jobId = jobRecord.id

    // 2. Polling até status === 'done' ou 'error' (timeout 60s para permitir coleta paginada de todos os status)
    const timeoutMs = 60_000
    const intervalMs = 500
    const startTime = Date.now()

    let finalJobData: any = null

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, intervalMs))

      try {
        const current = await pb.collection('ml_ads_fetch_jobs').getOne(jobId)
        if (current.progress_text && onProgress) {
          onProgress(current.progress_text)
        }
        if (current.status === 'done') {
          finalJobData = current
          break
        }
        if (current.status === 'error') {
          const errCode = current.status_code
          const errMsg = current.error_message || 'Erro ao carregar anúncios do Mercado Livre.'
          if (errCode === 401 || errCode === 403) {
            throw new Error(
              errMsg ||
                'Sessão com o Mercado Livre expirada. Reconecte sua conta nas Configurações.',
            )
          }
          throw new Error(errMsg)
        }
      } catch (pollErr: any) {
        // Se já for o erro de status='error', propaga
        if (pollErr.message && !pollErr.status) {
          throw pollErr
        }
      }
    }

    if (!finalJobData) {
      throw new Error(
        'Tempo limite ao aguardar consulta de anúncios do Mercado Livre no servidor. Tente novamente.',
      )
    }

    // Parse defensivo de items: aceita tanto Array quanto string serializada JSON
    const rawItems = finalJobData.items
    let items: MLSellerItem[] = parseItemsPayload(rawItems)

    // -------------------------------------------------------------------------
    // AGRUPAMENTO DE VARIAÇÕES DE CATÁLOGO / ANÚNCIOS DO MERCADO LIVRE
    // -------------------------------------------------------------------------
    // Quando o mesmo listing de catálogo chega como múltiplos registros de item
    // (ex.: itens vinculados ao mesmo catalog_product_id ou parent_item_id),
    // ou quando um item já traz suas variações no array `variations`, consolidamos
    // sob um único anúncio pai para que a listagem exiba UM único card/linha
    // com a listagem expansível de todas as variações e estoques/preços reais do ML.
    // REGRA DE OURO: NUNCA DESCARTAR ANÚNCIOS — se não houver chave de grupo válida,
    // o item é preservado integralmente na lista como anúncio individual.
    // -------------------------------------------------------------------------
    try {
      const groupedItemsMap = new Map<string, MLSellerItem>()
      const directItems: MLSellerItem[] = []

      for (const rawItem of items) {
        if (!rawItem || !rawItem.id) continue

        try {
          // Normaliza variações que já vieram no item
          const itemVariations: MLItemVariation[] = Array.isArray(rawItem.variations)
            ? rawItem.variations.filter((v) => v && typeof v === 'object')
            : []

          // Chave de agrupamento:
          // Agrupa por catalog_product_id ou parent_item_id se presentes e não-vazios
          const cleanCatalogId =
            typeof rawItem.catalog_product_id === 'string' ? rawItem.catalog_product_id.trim() : ''
          const cleanParentId =
            typeof rawItem.parent_item_id === 'string' ? rawItem.parent_item_id.trim() : ''

          const catalogKey = cleanCatalogId ? `catalog_${cleanCatalogId}` : ''
          const parentKey = cleanParentId ? `parent_${cleanParentId}` : ''
          const groupKey = catalogKey || parentKey

          if (groupKey) {
            if (!groupedItemsMap.has(groupKey)) {
              // Cria o registro pai inicial clonado com segurança
              const parentPermalink = buildMLAdUrl({
                permalink: rawItem.permalink,
                id: rawItem.id,
                parent_item_id: rawItem.parent_item_id,
              })

              const parentItem: MLSellerItem = {
                ...rawItem,
                permalink: parentPermalink,
                catalog_listing: true,
                available_quantity: Number(rawItem.available_quantity) || 0,
                sold_quantity: Number(rawItem.sold_quantity) || 0,
                variations: [...itemVariations],
              }

              // Se o item não tem variations mas tem atributos próprios (ou é uma variação de catálogo),
              // cria uma entrada sintética representando esta oferta caso haja mais de um anúncio associado
              if (parentItem.variations.length === 0) {
                parentItem.variations.push({
                  id: rawItem.id,
                  price: rawItem.price,
                  available_quantity: Number(rawItem.available_quantity) || 0,
                  sold_quantity: Number(rawItem.sold_quantity) || 0,
                  attribute_combinations: Array.isArray(rawItem.attributes)
                    ? rawItem.attributes
                    : [],
                  label: rawItem.title || rawItem.id,
                })
              }

              groupedItemsMap.set(groupKey, parentItem)
            } else {
              // Já existe um pai para este produto de catálogo: consolidar com segurança numérica!
              const existingParent = groupedItemsMap.get(groupKey)!
              existingParent.available_quantity =
                (Number(existingParent.available_quantity) || 0) +
                (Number(rawItem.available_quantity) || 0)
              existingParent.sold_quantity =
                (Number(existingParent.sold_quantity) || 0) + (Number(rawItem.sold_quantity) || 0)

              // Se o preço do item atual for menor ou mais relevante, mantém menor preço no pai
              if (
                rawItem.price &&
                (!existingParent.price || rawItem.price < existingParent.price)
              ) {
                existingParent.price = rawItem.price
              }

              // Se o pai original não tinha thumbnail e o irmão tem, aproveita
              if (!existingParent.thumbnail && rawItem.thumbnail) {
                existingParent.thumbnail = rawItem.thumbnail
              }

              // Garante permalink válido no pai consolidado
              if (!existingParent.permalink && rawItem.permalink) {
                existingParent.permalink = rawItem.permalink
              } else if (!existingParent.permalink) {
                existingParent.permalink = buildMLAdUrl({
                  permalink: existingParent.permalink,
                  id: existingParent.id,
                  parent_item_id: existingParent.parent_item_id,
                })
              }

              // Adiciona ou mescla as variações do item atual
              existingParent.variations = existingParent.variations || []
              if (itemVariations.length > 0) {
                for (const v of itemVariations) {
                  if (!v || !v.id) continue
                  const alreadyHas = existingParent.variations.some((ev) => ev && ev.id === v.id)
                  if (!alreadyHas) {
                    existingParent.variations.push(v)
                  }
                }
              } else {
                // Variação representada por este item irmão
                const alreadyHas = existingParent.variations.some(
                  (ev) => ev && ev.id === rawItem.id,
                )
                if (!alreadyHas) {
                  existingParent.variations.push({
                    id: rawItem.id,
                    price: rawItem.price,
                    available_quantity: Number(rawItem.available_quantity) || 0,
                    sold_quantity: Number(rawItem.sold_quantity) || 0,
                    attribute_combinations: Array.isArray(rawItem.attributes)
                      ? rawItem.attributes
                      : [],
                    label: rawItem.title || rawItem.id,
                  })
                }
              }
            }
          } else {
            // NUNCA descartar: anúncio regular ou de catálogo sem catalog_product_id válido
            // é mantido como linha individual completa.
            // Se tiver variações ou flag de catálogo, preserva catalog_listing: true e permalink garantido
            const isCatalogDirect = Boolean(
              rawItem.catalog_listing || rawItem.catalog_product_id || itemVariations.length > 0,
            )

            const directPermalink = buildMLAdUrl({
              permalink: rawItem.permalink,
              id: rawItem.id,
              parent_item_id: rawItem.parent_item_id,
            })

            directItems.push({
              ...rawItem,
              permalink: directPermalink,
              catalog_listing: isCatalogDirect ? true : rawItem.catalog_listing,
              available_quantity: Number(rawItem.available_quantity) || 0,
              sold_quantity: Number(rawItem.sold_quantity) || 0,
              variations: itemVariations.length > 0 ? itemVariations : undefined,
            })
          }
        } catch (itemErr) {
          console.warn('Erro ao processar item individual no agrupamento ML:', itemErr, rawItem?.id)
          // Blindagem por item: se der erro no agrupamento deste item, nunca descartar! Adiciona como item direto
          const fallbackPermalink = buildMLAdUrl({
            permalink: rawItem?.permalink,
            id: rawItem?.id,
            parent_item_id: rawItem?.parent_item_id,
          })
          const isCatalogFallback = Boolean(
            rawItem?.catalog_listing ||
            rawItem?.catalog_product_id ||
            (Array.isArray(rawItem?.variations) && rawItem.variations.length > 0),
          )
          directItems.push({
            ...rawItem,
            permalink: fallbackPermalink,
            catalog_listing: isCatalogFallback ? true : rawItem?.catalog_listing,
            available_quantity: Number(rawItem?.available_quantity) || 0,
            sold_quantity: Number(rawItem?.sold_quantity) || 0,
          })
        }
      }

      // Unifica itens agrupados + itens diretos
      items = [...Array.from(groupedItemsMap.values()), ...directItems]
    } catch (grpErr) {
      console.warn('Erro ao agrupar anúncios de catálogo ML, usando itens originais:', grpErr)
      // Degradação graciosa: se o agrupamento global falhar por qualquer motivo, mantém a lista de rawItems original
      items = parseItemsPayload(rawItems)
    }

    // Formata o resumo specsSummary para cada variação dos itens com tratamento defensivo
    for (const it of items) {
      if (Array.isArray(it.variations) && it.variations.length > 0) {
        for (const v of it.variations) {
          try {
            v.specsSummary = formatMLVariationSummary(v, it.currency_id)
          } catch {
            v.specsSummary = v.label || v.id || ''
          }
        }
      }
    }

    // Cruzar com catálogo local (somente leitura) para indicar quais já correspondem a produtos
    try {
      const products = await pb.collection('products').getFullList({
        fields:
          'id,name,sku,serial_number,status,unit_price,cost_price,ml_listing_id,gtin,brand,model,processor,ram,storage,screen_size,condition',
      })

      const mapByListingId = new Map<string, any[]>()
      const mapByGtin = new Map<string, any[]>()

      for (const p of products) {
        if (p.ml_listing_id) {
          const listingKey = String(p.ml_listing_id).trim()
          if (!mapByListingId.has(listingKey)) {
            mapByListingId.set(listingKey, [])
          }
          mapByListingId.get(listingKey)!.push(p)
        }
        if (p.gtin) {
          const gtinKey = String(p.gtin).trim()
          if (!mapByGtin.has(gtinKey)) {
            mapByGtin.set(gtinKey, [])
          }
          mapByGtin.get(gtinKey)!.push(p)
        }
      }

      for (const item of items) {
        const matchesList: any[] = []
        const addedIds = new Set<string>()

        // 1. Match por ml_listing_id
        if (mapByListingId.has(item.id)) {
          for (const match of mapByListingId.get(item.id)!) {
            if (!addedIds.has(match.id)) {
              addedIds.add(match.id)
              matchesList.push({
                id: match.id,
                name: match.name,
                sku: match.sku,
                serial_number: match.serial_number,
                status: match.status,
                unit_price: Number(match.unit_price) || 0,
                cost_price: Number(match.cost_price) || 0,
                brand: match.brand,
                model: match.model,
                processor: match.processor,
                ram: match.ram,
                storage: match.storage,
                screen_size: match.screen_size,
                condition: match.condition,
                match_type: 'ml_listing_id',
              })
            }
          }
        }

        // 2. Match por gtin
        if (item.gtin && mapByGtin.has(item.gtin)) {
          for (const match of mapByGtin.get(item.gtin)!) {
            if (!addedIds.has(match.id)) {
              addedIds.add(match.id)
              matchesList.push({
                id: match.id,
                name: match.name,
                sku: match.sku,
                serial_number: match.serial_number,
                status: match.status,
                unit_price: Number(match.unit_price) || 0,
                cost_price: Number(match.cost_price) || 0,
                brand: match.brand,
                model: match.model,
                processor: match.processor,
                ram: match.ram,
                storage: match.storage,
                screen_size: match.screen_size,
                condition: match.condition,
                match_type: 'gtin',
              })
            }
          }
        }

        if (matchesList.length > 0) {
          item.matchedProducts = matchesList
          item.matchedProduct = matchesList[0]
        }
      }

      // 3. Match inteligente por similaridade para anúncios ainda sem produto vinculado
      const candidateList: LocalProductCandidate[] = products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        serial_number: p.serial_number,
        status: p.status,
        unit_price: Number(p.unit_price) || 0,
        cost_price: Number(p.cost_price) || 0,
        brand: p.brand,
        model: p.model,
        processor: p.processor,
        ram: p.ram,
        storage: p.storage,
        screen_size: p.screen_size,
        condition: p.condition,
        ml_listing_id: p.ml_listing_id,
        gtin: p.gtin,
      }))

      const matcher = new ProductSimilarityMatcher(candidateList)

      for (const item of items) {
        if (!item.matchedProduct || !item.matchedProducts || item.matchedProducts.length === 0) {
          const suggestedMatches = matcher.findBestMatches(item, {
            maxMatches: 3,
            minConfidenceScore: 48,
          })

          if (suggestedMatches.length > 0) {
            const mappedSuggested: MLMatchedProduct[] = suggestedMatches.map((sm) => ({
              id: sm.candidate.id,
              name: sm.candidate.name,
              sku: sm.candidate.sku,
              serial_number: sm.candidate.serial_number,
              status: sm.candidate.status,
              unit_price: sm.candidate.unit_price,
              cost_price: sm.candidate.cost_price,
              brand: sm.candidate.brand,
              model: sm.candidate.model,
              processor: sm.candidate.processor,
              ram: sm.candidate.ram,
              storage: sm.candidate.storage,
              screen_size: sm.candidate.screen_size,
              condition: sm.candidate.condition,
              match_type: 'similarity',
              match_score: sm.score,
              match_reasons: sm.reasons,
              is_suggested: true,
            }))

            item.matchedProducts = mappedSuggested
            item.matchedProduct = mappedSuggested[0]
          }
        }
      }
    } catch (cErr) {
      console.warn('Não foi possível cruzar com o catálogo local:', cErr)
    }

    return {
      seller_id: finalJobData.seller_id || '',
      seller_nickname: finalJobData.seller_nickname || '',
      paging: finalJobData.paging || { total: items.length, offset: 0, limit: items.length },
      items,
      total: finalJobData.items_count !== undefined ? finalJobData.items_count : items.length,
    }
  },

  /**
   * Vincula um produto do catálogo interno a um anúncio do Mercado Livre,
   * atualizando o campo ml_listing_id no produto interno.
   * Não chama a API do ML — apenas atualiza o banco interno PocketBase.
   */
  async linkProductToAd(productId: string, mlItemId: string): Promise<void> {
    if (!productId || !mlItemId) {
      throw new Error('ID do produto e ID do anúncio são obrigatórios.')
    }
    await pb.collection('products').update(productId, {
      ml_listing_id: mlItemId,
    })
  },

  /**
   * Desvincula um produto do catálogo interno do anúncio do Mercado Livre,
   * limpando o campo ml_listing_id no produto interno.
   */
  async unlinkProductFromAd(productId: string): Promise<void> {
    if (!productId) {
      throw new Error('ID do produto é obrigatório.')
    }
    await pb.collection('products').update(productId, {
      ml_listing_id: '',
    })
  },
}
