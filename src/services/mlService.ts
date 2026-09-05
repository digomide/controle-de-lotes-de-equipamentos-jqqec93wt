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

export interface MLSellerItem {
  id: string
  title: string
  price: number
  currency_id: string
  available_quantity: number
  sold_quantity: number
  condition: string
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
  // Dados de correspondência com catálogo local
  matchedProduct?: {
    id: string
    name: string
    sku: string
    serial_number?: string
    status: string
    unit_price: number
    match_type: 'ml_listing_id' | 'gtin'
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
      const res = await pb.send(`/api/ml/category-attributes/${encodeURIComponent(cleanId)}`, {
        method: 'GET',
      })
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

    const rawItems = finalJobData.items
    const items: MLSellerItem[] = Array.isArray(rawItems) ? rawItems : []

    // Cruzar com catálogo local (somente leitura) para indicar quais já correspondem a produtos
    try {
      const products = await pb.collection('products').getFullList({
        fields: 'id,name,sku,serial_number,status,unit_price,ml_listing_id,gtin',
      })

      const mapByListingId = new Map<string, any>()
      const mapByGtin = new Map<string, any>()

      for (const p of products) {
        if (p.ml_listing_id) {
          mapByListingId.set(String(p.ml_listing_id).trim(), p)
        }
        if (p.gtin) {
          mapByGtin.set(String(p.gtin).trim(), p)
        }
      }

      for (const item of items) {
        if (mapByListingId.has(item.id)) {
          const match = mapByListingId.get(item.id)
          item.matchedProduct = {
            id: match.id,
            name: match.name,
            sku: match.sku,
            serial_number: match.serial_number,
            status: match.status,
            unit_price: Number(match.unit_price) || 0,
            match_type: 'ml_listing_id',
          }
        } else if (item.gtin && mapByGtin.has(item.gtin)) {
          const match = mapByGtin.get(item.gtin)
          item.matchedProduct = {
            id: match.id,
            name: match.name,
            sku: match.sku,
            serial_number: match.serial_number,
            status: match.status,
            unit_price: Number(match.unit_price) || 0,
            match_type: 'gtin',
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
}
