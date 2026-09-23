import type { Product } from '@/types/inventory'

/**
 * Expressões regulares para detecção de marcas e linhas/modelos canônicos
 * quando o campo product.model estiver vazio ou incompleto.
 */
const KNOWN_LINES_PATTERNS: Array<{ regex: RegExp; format: (m: RegExpMatchArray) => string }> = [
  // Dell Lines
  {
    regex: /\b(vostro)\s*([0-9]{3,5})?\b/i,
    format: (m) => (m[2] ? `Vostro ${m[2]}` : 'Vostro'),
  },
  {
    regex: /\b(inspiron)\s*([0-9]{3,5}(?:-[0-9]{3,5})?)?\b/i,
    format: (m) => (m[2] ? `Inspiron ${m[2]}` : 'Inspiron'),
  },
  {
    regex: /\b(latitude)\s*([0-9]{3,5})\b/i,
    format: (m) => `Latitude ${m[2]}`,
  },
  {
    regex: /\b(latitude)\b/i,
    format: () => 'Latitude',
  },
  {
    regex: /\b(precision)\s*([0-9]{3,5})?\b/i,
    format: (m) => (m[2] ? `Precision ${m[2]}` : 'Precision'),
  },
  {
    regex: /\b(optiplex)\s*([0-9]{3,5})?\b/i,
    format: (m) => (m[2] ? `OptiPlex ${m[2]}` : 'OptiPlex'),
  },
  {
    regex: /\b(xps)\s*([0-9]{2,4})?\b/i,
    format: (m) => (m[2] ? `XPS ${m[2]}` : 'XPS'),
  },
  {
    regex: /\b(alienware)\b/i,
    format: () => 'Alienware',
  },

  // Lenovo Lines
  {
    regex: /\b(thinkpad)\s*([a-z][0-9]{3,4}[a-z]?(?:\s*gen\s*[0-9]+)?)\b/i,
    format: (m) => `ThinkPad ${m[2].toUpperCase()}`,
  },
  {
    regex: /\b(thinkpad)\b/i,
    format: () => 'ThinkPad',
  },
  {
    regex: /\b(ideapad)\s*([0-9a-z-]+)?\b/i,
    format: (m) => (m[2] ? `IdeaPad ${m[2]}` : 'IdeaPad'),
  },
  {
    regex: /\b(thinkcentre)\s*([0-9a-z-]+)?\b/i,
    format: (m) => (m[2] ? `ThinkCentre ${m[2]}` : 'ThinkCentre'),
  },
  {
    regex: /\b(thinkstation|thinkbook|legion|yoga)\b/i,
    format: (m) => m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(),
  },

  // HP Lines
  {
    regex: /\b(elitebook)\s*([0-9]{3,4}(?:\s*g[0-9]+)?)\b/i,
    format: (m) => `EliteBook ${m[2]}`,
  },
  {
    regex: /\b(elitebook)\b/i,
    format: () => 'EliteBook',
  },
  {
    regex: /\b(probook)\s*([0-9]{3,4}(?:\s*g[0-9]+)?)\b/i,
    format: (m) => `ProBook ${m[2]}`,
  },
  {
    regex: /\b(probook)\b/i,
    format: () => 'ProBook',
  },
  {
    regex: /\b(prodesk|elitedesk|zbook|pavilion|omen|victus)\b/i,
    format: (m) => m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(),
  },

  // Apple Lines
  {
    regex: /\b(macbook\s*pro)\b/i,
    format: () => 'MacBook Pro',
  },
  {
    regex: /\b(macbook\s*air)\b/i,
    format: () => 'MacBook Air',
  },
  {
    regex: /\b(macbook|imac|mac\s*mini|mac\s*studio)\b/i,
    format: (m) => m[1].trim(),
  },

  // Acer Lines
  {
    regex: /\b(aspire|predator|nitro|swift|spin|travelmate)\s*([0-9a-z-]+)?\b/i,
    format: (m) =>
      `${m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()}${m[2] ? ` ${m[2]}` : ''}`.trim(),
  },

  // Asus Lines
  {
    regex: /\b(vivobook|zenbook|expertbook|tuf|rog)\b/i,
    format: (m) => m[1].toUpperCase(),
  },

  // Samsung Lines
  {
    regex: /\b(galaxy\s*book)\s*([0-9a-z-]+)?\b/i,
    format: (m) => `Galaxy Book${m[2] ? ` ${m[2]}` : ''}`.trim(),
  },

  // Positivo / VAIO
  {
    regex: /\b(vaio)\b/i,
    format: () => 'VAIO',
  },
  {
    regex: /\b(motion|master|unique)\b/i,
    format: (m) => m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(),
  },
]

/**
 * Extrai o modelo/linha canônico de um equipamento de forma determinística e precisa.
 * 1. Prioriza o campo explícito product.model se preenchido.
 * 2. Se product.model estiver vazio, analisa product.name com regex das linhas conhecidas
 *    (ex.: "Dell Vostro 15..." -> "Vostro 15", "Dell Inspiron 15..." -> "Inspiron 15").
 * 3. Se ainda não detectar nenhuma linha conhecida, isola o prefixo do nome removendo
 *    especificações entre parênteses "(Intel Core...)" e a marca.
 * 4. Se absolutamente nada for encontrado, retorna 'Modelo não informado'.
 */
export function resolveEquipmentModel(p: Partial<Product>): string {
  const rawModel = (p.model || '').trim()
  if (rawModel) {
    return rawModel
  }

  const rawName = (p.name || '').trim()
  if (!rawName) {
    return 'Modelo não informado'
  }

  // Tenta casar contra linhas conhecidas no título (ex: Vostro, Inspiron, Latitude, ThinkPad...)
  for (const item of KNOWN_LINES_PATTERNS) {
    const match = rawName.match(item.regex)
    if (match) {
      const baseLine = item.format(match)

      // Se no título logo após a linha houver sufixo de tamanho ou série (ex: "Vostro 15", "Inspiron 15", "EliteBook 840 G5")
      // e não estava capturado, tenta preservar para diferenciar "Inspiron 14" de "Inspiron 15"
      const seriesMatch = rawName.match(
        new RegExp(`\\b${match[1]}\\s*(\\d{2}(?:\\.\\d)?|\\d{3,4}(?:\\s*g\\d+)?)\\b`, 'i'),
      )
      if (seriesMatch && seriesMatch[1]) {
        const lineName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
        return `${lineName} ${seriesMatch[1]}`.trim()
      }

      return baseLine
    }
  }

  // Se não casou com linha conhecida, limpa o nome removendo parênteses de especificações
  // Ex: "Notebook Corporativo X (Intel Core i5...)" -> "Notebook Corporativo X"
  const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim()
  const brand = (p.brand || '').trim()

  // Remove a palavra genérica "Notebook" e a marca do início
  let candidate = cleanName.replace(/^notebook\s+/i, '').trim()

  if (brand && candidate.toLowerCase().startsWith(brand.toLowerCase())) {
    candidate = candidate.slice(brand.length).trim()
  }

  if (candidate && candidate.length >= 2) {
    return candidate
  }

  return 'Modelo não informado'
}

/**
 * Extrai a marca canônica de um equipamento (Dell, Lenovo, HP, etc.)
 */
export function resolveEquipmentBrand(p: Partial<Product>): string {
  const rawBrand = (p.brand || '').trim()
  if (rawBrand) {
    return rawBrand
  }

  const rawName = (p.name || '').trim()
  if (/dell/i.test(rawName)) return 'Dell'
  if (/lenovo/i.test(rawName)) return 'Lenovo'
  if (/hp\b/i.test(rawName)) return 'HP'
  if (/apple|macbook|imac/i.test(rawName)) return 'Apple'
  if (/acer/i.test(rawName)) return 'Acer'
  if (/asus/i.test(rawName)) return 'Asus'
  if (/samsung/i.test(rawName)) return 'Samsung'
  if (/positivo/i.test(rawName)) return 'Positivo'
  if (/vaio/i.test(rawName)) return 'VAIO'

  return 'Não inf.'
}

/**
 * Gera uma chave determinística de agrupamento para relatórios executivos de lotes (BatchReportModal).
 * Agrupa equipamentos por:
 *  - Marca canônica
 *  - Modelo canônico (com distinção estrita de linha: Inspiron ≠ Vostro)
 *  - Processador
 *  - Memória RAM
 *  - Armazenamento
 *
 * OBS: Se o modelo não estiver informado em ambos e não puder ser derivado, utiliza
 * identificador único (id ou sku) para NÃO agrupar modelos desconhecidos aleatoriamente.
 */
export function getBatchReportGroupKey(p: Product): string {
  const brand = resolveEquipmentBrand(p).trim().toLowerCase()
  const model = resolveEquipmentModel(p).trim().toLowerCase()

  // Se não foi possível identificar o modelo nem pelo campo nem pelo nome,
  // NÃO agrupa com outros: gera bucket isolado usando o ID/SKU do item
  if (model === 'modelo não informado') {
    return `unknown-model|${p.id || p.sku || Math.random()}`
  }

  const proc = (p.processor || '').trim().toLowerCase()
  const r = (p.ram || '').trim().toLowerCase()
  const st = (p.storage || '').trim().toLowerCase()

  return `${brand}|${model}|${proc}|${r}|${st}`
}

/**
 * Gera uma chave de agrupamento detalhada para as visões agrupadas de equipamentos
 * (LoteEntradaDetalhe e LotesEntrada), que inclui também o grau estético/condição.
 */
export function getEquipmentInventoryGroupKey(p: Product): string {
  const brand = resolveEquipmentBrand(p).trim().toLowerCase()
  const model = resolveEquipmentModel(p).trim().toLowerCase()

  if (model === 'modelo não informado') {
    return `unknown-model|${p.id || p.sku || Math.random()}`
  }

  const proc = (p.processor || '').trim().toLowerCase()
  const r = (p.ram || '').trim().toLowerCase()
  const st = (p.storage || '').trim().toLowerCase()
  const cond = (p.aesthetic_grade || p.condition || '').trim().toLowerCase()

  return `${brand}|${model}|${proc}|${r}|${st}|${cond}`
}
