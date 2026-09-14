import { removeAccents } from '@/lib/catalogFilter'
import type { MLMatchedProduct, MLSellerItem } from '@/services/mlService'

export interface LocalProductCandidate {
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
  ml_listing_id?: string
  gtin?: string
}

export interface ExtractedSpecs {
  brand?: string
  modelTokens: string[]
  processorFamily?: string // e.g. "i5", "i7", "i3", "i9", "ryzen 5", "celeron"
  processorGen?: number // e.g. 8, 10, 11
  ramGB?: number // e.g. 8, 16, 32
  storageGB?: number // e.g. 256, 512, 1000
  storageType?: 'ssd' | 'hd'
  screenSize?: number // e.g. 14, 15.6
  normalizedText: string
  compactText: string
}

/**
 * Normaliza uma string para comparação livre de acentos e caracteres especiais
 */
export function normalizeSpecString(text: string): string {
  return removeAccents(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim()
}

/**
 * Extrai tokens e especificações estruturadas de hardware a partir de um título ou campos de produto
 */
export function extractHardwareSpecs(
  text: string,
  extraFields?: {
    brand?: string
    model?: string
    processor?: string
    ram?: string
    storage?: string
    screen_size?: string
  },
): ExtractedSpecs {
  const combined = [
    text || '',
    extraFields?.brand || '',
    extraFields?.model || '',
    extraFields?.processor || '',
    extraFields?.ram || '',
    extraFields?.storage || '',
    extraFields?.screen_size || '',
  ]
    .filter(Boolean)
    .join(' ')

  const norm = normalizeSpecString(combined)
  const compact = norm.replace(/\s+/g, '')

  // 1. Marca
  let detectedBrand: string | undefined = undefined
  const brandKeywords = [
    'lenovo',
    'dell',
    'hp',
    'apple',
    'samsung',
    'acer',
    'asus',
    'positivo',
    'vaio',
    'toshiba',
    'thinkpad',
    'latitude',
    'vostro',
    'inspiron',
    'precision',
    'elitebook',
    'probook',
    'macbook',
  ]
  for (const b of brandKeywords) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(norm)) {
      if (['thinkpad', 'lenovo'].includes(b)) detectedBrand = 'lenovo'
      else if (['latitude', 'vostro', 'inspiron', 'precision', 'dell'].includes(b))
        detectedBrand = 'dell'
      else if (['elitebook', 'probook', 'hp'].includes(b)) detectedBrand = 'hp'
      else if (['macbook', 'apple'].includes(b)) detectedBrand = 'apple'
      else detectedBrand = b
      break
    }
  }

  // 2. Tokens de Modelo específicos (ex: "t480", "t580", "5420", "5320", "e14", "20tbs8n00", "840 g4", "3576")
  const modelTokens: string[] = []

  // Alfanuméricos específicos de modelo (t480, e14, 20tbs8n00, g4, g5, 5420, etc.)
  const words = norm.split(/\s+/).filter(Boolean)
  for (const w of words) {
    // Alfanumérico misto como "t480", "t580", "e14", "20tbs8n00", "20rbs2j900", "p1"
    if (/^(t\d{3}|e\d{2}|l\d{3}|x\d{3}|g\d+|p\d+|x1|\d{4}[a-z]|\d{2}[a-z0-9]{4,10})$/i.test(w)) {
      modelTokens.push(w)
    } else if (/^\d{4}$/.test(w)) {
      // Modelos numéricos de 4 dígitos (ex: 5420, 5320, 5300, 7572, 5566, 3576)
      modelTokens.push(w)
    } else if (
      ['thinkpad', 'latitude', 'inspiron', 'vostro', 'elitebook', 'probook', 'ideapad'].includes(w)
    ) {
      modelTokens.push(w)
    }
  }

  // Se o campo model do produto veio informado explicitamente
  if (extraFields?.model) {
    const rawModelWords = normalizeSpecString(extraFields.model).split(/\s+/).filter(Boolean)
    for (const mw of rawModelWords) {
      if (mw.length >= 2 && !modelTokens.includes(mw)) {
        modelTokens.push(mw)
      }
    }
  }

  // 3. Processador (Família e Geração)
  let processorFamily: string | undefined = undefined
  let processorGen: number | undefined = undefined

  if (/\b(i9|core\s*i9)\b/i.test(norm)) processorFamily = 'i9'
  else if (/\b(i7|core\s*i7)\b/i.test(norm)) processorFamily = 'i7'
  else if (/\b(i5|core\s*i5)\b/i.test(norm)) processorFamily = 'i5'
  else if (/\b(i3|core\s*i3)\b/i.test(norm)) processorFamily = 'i3'
  else if (/\b(ryzen\s*9)\b/i.test(norm)) processorFamily = 'ryzen 9'
  else if (/\b(ryzen\s*7)\b/i.test(norm)) processorFamily = 'ryzen 7'
  else if (/\b(ryzen\s*5)\b/i.test(norm)) processorFamily = 'ryzen 5'
  else if (/\b(ryzen\s*3)\b/i.test(norm)) processorFamily = 'ryzen 3'
  else if (/\b(celeron)\b/i.test(norm)) processorFamily = 'celeron'
  else if (/\b(xeon)\b/i.test(norm)) processorFamily = 'xeon'
  else if (/\b(m1)\b/i.test(norm)) processorFamily = 'm1'
  else if (/\b(m2)\b/i.test(norm)) processorFamily = 'm2'
  else if (/\b(m3)\b/i.test(norm)) processorFamily = 'm3'

  // Geração do processador (ex: "8a geracao", "8 geracao", "oitava geracao", "11th gen", "11a", "i5-8250u", "i5 8250u")
  const genMatch =
    norm.match(/(\d{1,2})\s*(?:a|ª|º|th)?\s*(?:geracao|ger|gen\b)/i) ||
    norm.match(/\b(oitav[ao]|setim[ao]|non[ao]|decim[ao]\s*primeir[ao]|decim[ao])\s*geracao/i) ||
    norm.match(/\bi[3579][-\s](\d{1,2})\d{3}/i)

  if (genMatch) {
    if (/oitav/i.test(genMatch[0])) processorGen = 8
    else if (/setim/i.test(genMatch[0])) processorGen = 7
    else if (/non/i.test(genMatch[0])) processorGen = 9
    else if (/decim.*primeir/i.test(genMatch[0])) processorGen = 11
    else if (/decim/i.test(genMatch[0])) processorGen = 10
    else if (genMatch[1]) {
      const parsed = parseInt(genMatch[1], 10)
      if (parsed >= 1 && parsed <= 14) processorGen = parsed
    }
  }

  // 4. Memória RAM (4gb, 8gb, 16gb, 32gb, 64gb)
  let ramGB: number | undefined = undefined
  const ramMatch = norm.match(/\b(4|8|12|16|20|24|32|64)\s*(?:gb|gigas)\b/i)
  if (ramMatch) {
    ramGB = parseInt(ramMatch[1], 10)
  }

  // 5. Armazenamento (SSD / HD e capacidade)
  let storageGB: number | undefined = undefined
  let storageType: 'ssd' | 'hd' | undefined = undefined

  if (/\bhd\b|hard\s*drive/i.test(norm) && !/\bssd\b|nvme/i.test(norm)) {
    storageType = 'hd'
  } else if (/\bssd\b|nvme|m\.?2/i.test(norm)) {
    storageType = 'ssd'
  }

  // Procura capacidade: "256gb", "512gb", "128gb", "1tb", "240gb", "500gb", "ssd 256", "hd 500"
  const tbMatch = norm.match(/\b(1|2)\s*tb\b/i)
  if (tbMatch) {
    storageGB = parseInt(tbMatch[1], 10) * 1000
  } else {
    const storageMatch =
      norm.match(/\b(120|128|240|256|480|500|512|960|1000)\s*(?:gb|gigas)?\b/i) ||
      norm.match(/(?:ssd|hd|nvme)\s*(120|128|240|256|480|500|512|960|1000)\b/i)

    if (storageMatch) {
      const cap = parseInt(storageMatch[1], 10)
      // Se coincidir exatamente com a RAM já detectada e for pequeno (ex: 8, 16), ignorar
      if (cap !== ramGB || cap > 32) {
        storageGB = cap
      }
    }
  }

  // 6. Tela (13.3, 14, 15.6, 17.3)
  let screenSize: number | undefined = undefined
  const screenMatch = norm.match(
    /\b(11\.6|12\.5|13\.3|14(?:\.0)?|15\.6|16(?:\.0)?|17\.3)\s*(?:["']|pol|polegadas)?\b/i,
  )
  if (screenMatch) {
    screenSize = parseFloat(screenMatch[1])
  } else if (/\btela\s*(14|15\.6|13\.3)\b/i.test(norm)) {
    const m = norm.match(/\btela\s*(14|15\.6|13\.3)\b/i)
    if (m) screenSize = parseFloat(m[1])
  }

  return {
    brand: detectedBrand,
    modelTokens: Array.from(new Set(modelTokens.filter((t) => t.length > 1))),
    processorFamily,
    processorGen,
    ramGB,
    storageGB,
    storageType,
    screenSize,
    normalizedText: norm,
    compactText: compact,
  }
}

export interface MatchScoreResult {
  candidate: LocalProductCandidate
  score: number
  reasons: string[]
  isConfident: boolean
  hasModelMatch: boolean
}

/**
 * Calcula uma pontuação de similaridade (0 a 100) entre um anúncio do ML e um produto do estoque interno.
 *
 * Pesos:
 * - Match de modelo específico (ex: "t480", "5420", "20tbs8n00"): +45 pontos (decisivo)
 * - Match de linha de modelo (ex: "thinkpad", "latitude"): +15 pontos
 * - Match de marca (Lenovo, Dell, HP): +10 pontos
 * - Match de família de CPU (i5, i7): +15 pontos
 * - Match de geração de CPU (8ª, 11ª): +10 pontos
 * - Match de RAM (8GB, 16GB): +15 pontos
 * - Match de Armazenamento (SSD 256GB): +10 pontos
 * - Match de Tela (14", 15.6"): +5 pontos
 *
 * Penalidades fortes:
 * - Conflito de marca (ex: Dell vs Lenovo): penalidade de -60 pontos
 * - Conflito de modelo específico evidente (ex: T480 vs E14 ou 5420 vs 5320): penalidade de -70 pontos
 * - Conflito de geração de CPU muito distante: penalidade de -20 pontos
 * - Conflito de RAM quando ambas especificadas: penalidade de -15 pontos
 */
export function calculateProductMatchScore(
  adTitle: string,
  candidate: LocalProductCandidate,
  adExtra?: { brand?: string; model?: string },
): MatchScoreResult {
  const adSpecs = extractHardwareSpecs(adTitle, adExtra)
  const prodSpecs = extractHardwareSpecs(candidate.name, {
    brand: candidate.brand,
    model: candidate.model,
    processor: candidate.processor,
    ram: candidate.ram,
    storage: candidate.storage,
    screen_size: candidate.screen_size,
  })

  let score = 0
  const reasons: string[] = []
  let hasModelMatch = false

  // 1. Marca
  if (adSpecs.brand && prodSpecs.brand) {
    if (adSpecs.brand === prodSpecs.brand) {
      score += 10
      reasons.push(`Marca ${adSpecs.brand.toUpperCase()}`)
    } else {
      // Marcas diferentes -> incompatível
      return {
        candidate,
        score: 0,
        reasons: [`Marca conflitante (${adSpecs.brand} vs ${prodSpecs.brand})`],
        isConfident: false,
        hasModelMatch: false,
      }
    }
  }

  // 2. Modelo Específico
  // Identifica tokens numéricos/alfanuméricos fortes de modelo (ex: "t480", "5420", "e14", "3576")
  const specificAdModels = adSpecs.modelTokens.filter(
    (t) =>
      !['thinkpad', 'latitude', 'inspiron', 'vostro', 'elitebook', 'probook', 'ideapad'].includes(
        t,
      ),
  )
  const specificProdModels = prodSpecs.modelTokens.filter(
    (t) =>
      !['thinkpad', 'latitude', 'inspiron', 'vostro', 'elitebook', 'probook', 'ideapad'].includes(
        t,
      ),
  )

  let matchedSpecificModel: string | null = null
  let conflictingSpecificModel: string | null = null

  if (specificAdModels.length > 0 && specificProdModels.length > 0) {
    for (const am of specificAdModels) {
      if (
        specificProdModels.includes(am) ||
        prodSpecs.normalizedText.includes(am) ||
        prodSpecs.compactText.includes(am)
      ) {
        matchedSpecificModel = am
        break
      }
    }

    if (matchedSpecificModel) {
      score += 45
      hasModelMatch = true
      reasons.push(`Modelo exato "${matchedSpecificModel.toUpperCase()}"`)
    } else {
      // Se ambos têm modelo específico mas nenhum bate (ex: anúncio tem "t480" e produto tem "t580" ou "e14"),
      // isso é um conflito direto de modelo!
      conflictingSpecificModel = `${specificAdModels.join('/')} != ${specificProdModels.join('/')}`
      score -= 50
    }
  } else if (specificAdModels.length > 0) {
    // Anúncio tem modelo específico (ex: "t480"), verifica se está no texto do produto
    for (const am of specificAdModels) {
      if (prodSpecs.normalizedText.includes(am) || prodSpecs.compactText.includes(am)) {
        matchedSpecificModel = am
        score += 40
        hasModelMatch = true
        reasons.push(`Modelo "${am.toUpperCase()}"`)
        break
      }
    }
  } else if (specificProdModels.length > 0) {
    // Produto tem modelo específico, verifica se está no título do anúncio
    for (const pm of specificProdModels) {
      if (adSpecs.normalizedText.includes(pm) || adSpecs.compactText.includes(pm)) {
        matchedSpecificModel = pm
        score += 40
        hasModelMatch = true
        reasons.push(`Modelo "${pm.toUpperCase()}"`)
        break
      }
    }
  }

  // Linha geral (ThinkPad, Latitude, Inspiron, EliteBook)
  const lineFamilies = [
    'thinkpad',
    'latitude',
    'inspiron',
    'vostro',
    'elitebook',
    'probook',
    'ideapad',
  ]
  for (const line of lineFamilies) {
    if (adSpecs.modelTokens.includes(line) && prodSpecs.modelTokens.includes(line)) {
      score += 15
      reasons.push(`Linha ${line.toUpperCase()}`)
      break
    }
  }

  // 3. Processador (Família e Geração)
  if (adSpecs.processorFamily && prodSpecs.processorFamily) {
    if (adSpecs.processorFamily === prodSpecs.processorFamily) {
      score += 15
      reasons.push(`Processador ${adSpecs.processorFamily.toUpperCase()}`)

      // Geração
      if (adSpecs.processorGen && prodSpecs.processorGen) {
        if (adSpecs.processorGen === prodSpecs.processorGen) {
          score += 10
          reasons.push(`${adSpecs.processorGen}ª Geração`)
        } else {
          // Gerações diferentes (ex: 8ª vs 11ª)
          score -= 15
          reasons.push(`Geração diferente (${adSpecs.processorGen}ª vs ${prodSpecs.processorGen}ª)`)
        }
      }
    } else {
      // Processador diferente (i5 vs i7)
      score -= 20
      reasons.push(`CPU diferente (${adSpecs.processorFamily} vs ${prodSpecs.processorFamily})`)
    }
  }

  // 4. Memória RAM
  if (adSpecs.ramGB && prodSpecs.ramGB) {
    if (adSpecs.ramGB === prodSpecs.ramGB) {
      score += 15
      reasons.push(`${adSpecs.ramGB}GB RAM`)
    } else {
      score -= 15
      reasons.push(`RAM diferente (${adSpecs.ramGB}GB vs ${prodSpecs.ramGB}GB)`)
    }
  }

  // 5. Armazenamento
  if (adSpecs.storageGB && prodSpecs.storageGB) {
    if (adSpecs.storageGB === prodSpecs.storageGB) {
      score += 10
      reasons.push(`Armazenamento ${adSpecs.storageGB}GB`)
    } else if (
      (adSpecs.storageGB === 240 && prodSpecs.storageGB === 256) ||
      (adSpecs.storageGB === 256 && prodSpecs.storageGB === 240) ||
      (adSpecs.storageGB === 480 && prodSpecs.storageGB === 512) ||
      (adSpecs.storageGB === 512 && prodSpecs.storageGB === 480)
    ) {
      // Equivalência comercial de 240/256 ou 480/512 SSD
      score += 8
      reasons.push(`Armazenamento ~${adSpecs.storageGB}GB`)
    } else {
      score -= 10
      reasons.push(`Armazenamento diferente (${adSpecs.storageGB}GB vs ${prodSpecs.storageGB}GB)`)
    }
  }

  // 6. Tela
  if (adSpecs.screenSize && prodSpecs.screenSize) {
    if (Math.abs(adSpecs.screenSize - prodSpecs.screenSize) < 0.2) {
      score += 5
      reasons.push(`Tela ${adSpecs.screenSize}"`)
    } else {
      score -= 8
    }
  }

  // Se houve conflito direto de modelo específico, zerar ou limitar score
  if (conflictingSpecificModel && !hasModelMatch) {
    score = Math.min(score, 20)
  }

  // Confiança mínima necessária para sugerir o vínculo:
  // Critério:
  // - Ou score >= 55 com modelo específico batendo (ex: "t480" + marca)
  // - Ou score >= 60 com Marca + Linha + CPU + RAM batendo (ex: Dell Latitude + i5 + 8GB)
  const isConfident = (hasModelMatch && score >= 50) || (score >= 60 && !conflictingSpecificModel)

  return {
    candidate,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    isConfident,
    hasModelMatch,
  }
}

/**
 * Estrutura indexada em memória para busca ultra-rápida de produtos similares
 */
export class ProductSimilarityMatcher {
  private products: LocalProductCandidate[] = []

  constructor(products: LocalProductCandidate[]) {
    this.products = products
  }

  /**
   * Encontra os melhores candidatos de produtos internos para um determinado anúncio ML
   */
  public findBestMatches(
    ad: MLSellerItem,
    options?: { maxMatches?: number; minConfidenceScore?: number },
  ): MatchScoreResult[] {
    const maxMatches = options?.maxMatches ?? 3
    const minScore = options?.minConfidenceScore ?? 45

    const results: MatchScoreResult[] = []

    for (const prod of this.products) {
      const scored = calculateProductMatchScore(ad.title, prod, {
        brand: ad.brand,
        model: ad.model,
      })

      if (scored.isConfident && scored.score >= minScore) {
        results.push(scored)
      }
    }

    // Ordena pelo maior score e desempate por modelo exato
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.hasModelMatch && !a.hasModelMatch) return 1
      if (!b.hasModelMatch && a.hasModelMatch) return -1
      return 0
    })

    return results.slice(0, maxMatches)
  }
}
