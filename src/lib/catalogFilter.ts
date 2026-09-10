/**
 * Utilitários de normalização, tokenização e filtro rigoroso de relevância
 * para buscas no catálogo do Mercado Livre.
 */

// Stopwords que não agregam diferenciação nos anúncios de notebook no catálogo
export const CATALOG_STOPWORDS = new Set([
  'notebook',
  'notebooks',
  'note',
  'notes',
  'laptop',
  'laptops',
  'pc',
  'computador',
  'computadores',
  'desktop',
  'desktops',
  'ultrabook',
  'ultrabooks',
  'usado',
  'usados',
  'seminovo',
  'seminovos',
  'semi-novo',
  'semi-novos',
  'recondicionado',
  'recondicionados',
  'refurbished',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'com',
  'para',
  'em',
  'e',
  'a',
  'o',
  'as',
  'os',
])

/**
 * Palavras genéricas de categoria usadas no suavizador de busca (mesmo conjunto do worker backend)
 */
export const GENERIC_CATEGORY_WORDS = new Set([
  'notebook',
  'notebooks',
  'computador',
  'computadores',
  'laptop',
  'laptops',
  'pc',
  'desktop',
  'desktops',
  'ultrabook',
  'ultrabooks',
])

/**
 * Suaviza um termo de busca removendo palavras genéricas de categoria se houver 3+ palavras,
 * espelhando exatamente a lógica do worker backend ml_queue_worker.js.
 * Exemplo: "notebook lenovo t480" -> "lenovo t480"
 */
export function softenSearchTerm(query: string): string {
  if (!query) return ''
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return query.trim()

  const softened = words.filter((w) => {
    const clean = removeAccents(w)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
    return !GENERIC_CATEGORY_WORDS.has(clean)
  })

  const result = softened.join(' ').trim()
  return result && result.length >= 2 ? result : query.trim()
}

/**
 * Extrai os tokens de modelo essenciais/obrigatórios de um termo de busca.
 * Reutiliza a lógica de suavização existente (softenSearchTerm) e os stopwords canônicos.
 *
 * Exemplo:
 * - "notebook lenovo t480" -> suaviza para "lenovo t480" -> identifica modelo "t480"
 *   (apenas "t480" é o modelo principal, marca "lenovo" é contexto de marca).
 * - "notebook dell latitude 5420" -> suaviza para "dell latitude 5420" -> identifica "5420"
 * - "placa mae lenovo" -> suaviza -> tokens essenciais não-stopwords: ["placa", "mae", "lenovo"]
 * - "memoria smart" -> tokens essenciais: ["memoria", "smart"]
 *
 * Retorna lista de tokens que DEVEM estar presentes no título do anúncio para passar no filtro rigoroso.
 */
export function extractRequiredModelTokens(query: string): string[] {
  if (!query || isDirectCatalogCodeQuery(query)) {
    return []
  }

  // 1. Suavizar termo removendo categorias genéricas ("notebook", "computador", etc.)
  const softened = softenSearchTerm(query)
  const normTerm = removeAccents(softened || query)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  if (!normTerm) return []

  const words = normTerm.split(/\s+/).filter(Boolean)

  // 2. Classificação de palavras:
  // Tokens de modelo específicos: alfanuméricos com dígitos (t480, e14, g15, e7440, i5, i7)
  // ou números de modelo de 3 a 5 dígitos (5420, 3020, 7020, 840, 153576).
  const modelCodeTokens: string[] = []
  const otherMeaningfulTokens: string[] = []

  for (const w of words) {
    if (CATALOG_STOPWORDS.has(w) || GENERIC_CATEGORY_WORDS.has(w)) {
      continue
    }

    const hasDigitsAndLetters = /[0-9]/.test(w) && /[a-z]/.test(w)
    const isModelNumber = /^[0-9]{3,5}$/.test(w)

    if (hasDigitsAndLetters || isModelNumber) {
      modelCodeTokens.push(w)
    } else {
      otherMeaningfulTokens.push(w)
    }
  }

  // Se houver código(s) de modelo explícito(s) (ex: "t480" em "lenovo t480"),
  // o modelo principal É o código do modelo que deve obrigatoriamente estar no título!
  if (modelCodeTokens.length > 0) {
    return Array.from(new Set(modelCodeTokens))
  }

  // Se não houver código alfa/numérico evidente (ex: "placa mae lenovo" ou "memoria smart"),
  // remove marcas populares caso sobre algo mais específico (ex: "lenovo thinkpad" -> "thinkpad")
  const nonBrandTokens = otherMeaningfulTokens.filter((t) => !POPULAR_BRANDS.has(t))
  if (nonBrandTokens.length > 0) {
    return Array.from(new Set(nonBrandTokens))
  }

  // Fallback: todos os tokens significativos não-stopwords
  return Array.from(new Set(otherMeaningfulTokens.length > 0 ? otherMeaningfulTokens : words))
}

/**
 * Avalia se o título de um anúncio contém o modelo exato do termo de busca.
 * Aplica casamento rigoroso com boundary de palavra ou variação compacta
 * (ex: "t480" casa com "t480", "T 480", "ThinkPad T480"; mas "ThinkPad E14" ou "IdeaPad 3" não casam).
 */
export function matchesExactModelInTitle(
  title: string,
  searchTerm: string,
): {
  matches: boolean
  requiredModelTokens: string[]
  matchedTokens: string[]
  missingTokens: string[]
} {
  const requiredModelTokens = extractRequiredModelTokens(searchTerm)
  if (requiredModelTokens.length === 0) {
    return {
      matches: true,
      requiredModelTokens: [],
      matchedTokens: [],
      missingTokens: [],
    }
  }

  if (!title) {
    return {
      matches: false,
      requiredModelTokens,
      matchedTokens: [],
      missingTokens: requiredModelTokens,
    }
  }

  const normTitle = normalizeCatalogText(title)
  const compactTitle = removeAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  const matchedTokens: string[] = []
  const missingTokens: string[] = []

  for (const token of requiredModelTokens) {
    if (matchesCatalogToken(normTitle, compactTitle, token)) {
      matchedTokens.push(token)
    } else {
      missingTokens.push(token)
    }
  }

  return {
    matches: missingTokens.length === 0,
    requiredModelTokens,
    matchedTokens,
    missingTokens,
  }
}

/**
 * Remove acentos diacríticos
 */
export function removeAccents(text: string): string {
  return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Verifica se a query é uma busca direta por código ou link de produto de catálogo (/p/MLB... ou MLB...)
 */
export function isDirectCatalogCodeQuery(query: string): boolean {
  const trimmed = (query || '').trim()
  if (!trimmed) return false
  return Boolean(
    /\/p\/MLB[0-9]+/i.test(trimmed) ||
    /^MLB[0-9]+$/i.test(trimmed) ||
    /^MLB-P-[0-9]+$/i.test(trimmed) ||
    /^[0-9]{7,15}$/.test(trimmed),
  )
}

/**
 * Divide o termo de busca em tokens significativos normalizados.
 * Normaliza acentos, lowercase, remove pontuação redundante (exceto números/letras)
 * e descarta stopwords a menos que todos os tokens sejam stopwords.
 */
export function extractCatalogSearchTokens(query: string): string[] {
  if (isDirectCatalogCodeQuery(query)) {
    return []
  }

  const normalized = removeAccents(query)
    .toLowerCase()
    // Substitui pontuações e separadores por espaço
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  if (!normalized) return []

  const rawTokens = normalized.split(/\s+/).filter(Boolean)

  // Filtra stopwords
  const filtered = rawTokens.filter((token) => !CATALOG_STOPWORDS.has(token))

  // Se o usuário pesquisou só uma stopword (ex: "notebook"), mantemos para não ficar vazio
  const finalTokens = filtered.length > 0 ? filtered : rawTokens

  // Remove duplicatas mantendo a ordem
  return Array.from(new Set(finalTokens))
}

/**
 * Extrai tokens com stopwords específicas para buscas de peças e componentes
 * (onde "fonte", "desktop", "3020", "carregador" são altamente relevantes).
 * Não remove "pc", "computador" ou "desktop" se fizerem parte da especificação do hardware.
 */
export function extractExactProductTokens(query: string): string[] {
  if (isDirectCatalogCodeQuery(query)) {
    return []
  }

  const normalized = removeAccents(query)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  if (!normalized) return []

  const rawTokens = normalized.split(/\s+/).filter(Boolean)

  // Stopwords genéricas de pontuação/artigos/preposições puras
  const EXACT_STOPWORDS = new Set([
    'de',
    'do',
    'da',
    'dos',
    'das',
    'com',
    'para',
    'em',
    'e',
    'a',
    'o',
    'as',
    'os',
    'por',
    'um',
    'uma',
    'uns',
    'umas',
    'original', // Adjetivo promocional frequente que não define o modelo exato
    'novo',
    'usado',
    'seminovo',
    'recondicionado',
    'garantia',
    'frete',
    'gratis',
    'envio',
    'imediato',
    'promocao',
    'oferta',
  ])

  const filtered = rawTokens.filter((token) => !EXACT_STOPWORDS.has(token))
  const finalTokens = filtered.length > 0 ? filtered : rawTokens

  return Array.from(new Set(finalTokens))
}

export type ExactProductSearchMode = 'part' | 'whole_product'

export interface ExactProductScoreResult {
  isExactMatch: boolean
  similarityScore: number // 0 a 100
  matchedTokens: string[]
  missingTokens: string[]
  reasons: string[]
  detectedMode?: ExactProductSearchMode
  isAccessory?: boolean
  isKitOrBundle?: boolean
  isFamilyMatch?: boolean
  matchedFamilyName?: string
}

// Mapa canônico de submarca -> marca mãe (bidirecional)
export const SUBBRAND_TO_PARENT_BRAND: Record<string, string> = {
  // Lenovo
  thinkcentre: 'lenovo',
  thinkpad: 'lenovo',
  ideapad: 'lenovo',
  legion: 'lenovo',
  thinkstation: 'lenovo',
  thinkbook: 'lenovo',
  yoga: 'lenovo',

  // Dell
  optiplex: 'dell',
  latitude: 'dell',
  inspiron: 'dell',
  vostro: 'dell',
  precision: 'dell',
  alienware: 'dell',
  xps: 'dell',

  // HP
  prodesk: 'hp',
  elitedesk: 'hp',
  elitebook: 'hp',
  probook: 'hp',
  pavilion: 'hp',
  omen: 'hp',
  victus: 'hp',
  zbook: 'hp',

  // Apple
  macbook: 'apple',
  imac: 'apple',
  mac: 'apple',

  // Acer
  aspire: 'acer',
  predator: 'acer',
  nitro: 'acer',

  // Asus
  rog: 'asus',
  tuf: 'asus',
  zenbook: 'asus',
  vivobook: 'asus',
}

// Mapa de marca mãe -> conjunto de submarcas filhas (derivado automaticamente para consulta bidirecional)
export const PARENT_BRAND_TO_SUBBRANDS: Record<string, string[]> = {}
for (const [sub, parent] of Object.entries(SUBBRAND_TO_PARENT_BRAND)) {
  if (!PARENT_BRAND_TO_SUBBRANDS[parent]) {
    PARENT_BRAND_TO_SUBBRANDS[parent] = []
  }
  PARENT_BRAND_TO_SUBBRANDS[parent].push(sub)
}

/**
 * Retorna todas as formas equivalentes de uma marca (marca mãe + todas suas submarcas)
 * Ex: getBrandEquivalents("lenovo") -> ["lenovo", "thinkcentre", "thinkpad", "ideapad", "legion", ...]
 * Ex: getBrandEquivalents("thinkcentre") -> ["lenovo", "thinkcentre", "thinkpad", "ideapad", ...]
 */
export function getBrandEquivalents(brandOrSubbrand: string): string[] {
  const norm = removeAccents(brandOrSubbrand).toLowerCase().trim()
  const parent = SUBBRAND_TO_PARENT_BRAND[norm] || norm
  const subs = PARENT_BRAND_TO_SUBBRANDS[parent] || []
  const set = new Set<string>([parent, ...subs, norm])
  return Array.from(set)
}

/**
 * Verifica se um token de marca buscado pelo usuário é satisfeito no texto do anúncio (título e/ou atributos)
 * considerando o mapa canônico bidirecional de marcas/submarcas.
 */
export function matchesBrandEquivalents(
  fullText: string,
  fullCompact: string,
  brandToken: string,
): { matched: boolean; matchedTerm?: string } {
  const equivalents = getBrandEquivalents(brandToken)
  for (const eq of equivalents) {
    if (matchesCatalogToken(fullText, fullCompact, eq)) {
      return { matched: true, matchedTerm: eq }
    }
  }
  return { matched: false }
}

// Definição de famílias térmicas / compatibilidade de componentes por família de modelo
export interface HardwareModelFamily {
  id: string
  name: string
  // Tokens que identificam membros dessa família
  members: string[]
  // Componentes para os quais essa família compartilha compatibilidade de montagem/peça
  applicableComponents?: string[]
}

export const HARDWARE_MODEL_FAMILIES: HardwareModelFamily[] = [
  {
    id: 'thinkcentre_tiny_cooler_m700_m920',
    name: 'ThinkCentre Tiny (M700-M920/P330)',
    members: [
      'm700',
      'm800',
      'm900',
      'm910',
      'm910q',
      'm910x',
      'm920',
      'm920q',
      'm920x',
      'm710',
      'm710q',
      'm720',
      'm720q',
      'p330',
      'p320',
      'tiny',
    ],
    applicableComponents: ['cooler', 'dissipador', 'heatsink', 'fan', 'ventoinha'],
  },
  {
    id: 'dell_optiplex_sff_psu_3020_9020',
    name: 'Dell OptiPlex SFF (3020/7020/9020/T1700)',
    members: ['3020', '7020', '9020', 't1700'],
    applicableComponents: ['fonte', 'carregador', 'cooler', 'dissipador'],
  },
  {
    id: 'hp_prodesk_elitedesk_g1_g2_sff',
    name: 'HP ProDesk/EliteDesk 400/600/800 G1-G2',
    members: ['400', '600', '800', 'g1', 'g2'],
    applicableComponents: ['fonte', 'cooler', 'dissipador', 'fan'],
  },
]

/**
 * Encontra a família térmica/hardware à qual um dado token de modelo pertence.
 */
export function findHardwareFamily(
  modelToken: string,
  componentToken?: string,
): HardwareModelFamily | undefined {
  const normModel = removeAccents(modelToken).toLowerCase().trim()
  const normComp = componentToken ? removeAccents(componentToken).toLowerCase().trim() : undefined

  return HARDWARE_MODEL_FAMILIES.find((family) => {
    // Se foi informado componente, confere se a família se aplica a esse componente
    if (normComp && family.applicableComponents && family.applicableComponents.length > 0) {
      const syns = getComponentSynonyms(normComp)
      const matchesComp = family.applicableComponents.some(
        (c) => syns.includes(c) || c === normComp,
      )
      if (!matchesComp) return false
    }
    return family.members.includes(normModel)
  })
}

/**
 * Avalia se o modelo procurado está presente diretamente OU satisfeito via irmão da mesma família de hardware.
 */
export function matchesModelOrFamily(
  fullText: string,
  fullCompact: string,
  modelToken: string,
  componentTokens?: string[],
): { matched: boolean; matchedTerm?: string; isFamilyMatch: boolean; familyName?: string } {
  // 1. Casamento direto do modelo
  if (matchesCatalogToken(fullText, fullCompact, modelToken)) {
    return { matched: true, matchedTerm: modelToken, isFamilyMatch: false }
  }

  // 2. Busca família correspondente
  const compToken = componentTokens && componentTokens.length > 0 ? componentTokens[0] : undefined
  const family = findHardwareFamily(modelToken, compToken)
  if (family) {
    // Procura por qualquer irmão da família presente no anúncio
    for (const member of family.members) {
      if (member === modelToken) continue
      if (matchesCatalogToken(fullText, fullCompact, member)) {
        return {
          matched: true,
          matchedTerm: member,
          isFamilyMatch: true,
          familyName: family.name,
        }
      }
    }
  }

  return { matched: false, isFamilyMatch: false }
}

// Grupos canônicos de sinônimos de componentes de reposição e hardware.
// Em buscas de peças (ex: "cooler lenovo m900" ou "fonte dell 3020"),
// qualquer termo do grupo satisfaz a exigência daquele componente.
export const COMPONENT_SYNONYM_GROUPS: Record<string, string[]> = {
  cooler: [
    'cooler',
    'coolers',
    'dissipador',
    'dissipadores',
    'heatsink',
    'heatsinks',
    'fan',
    'fans',
    'ventoinha',
    'ventoinhas',
    'ventilador',
    'ventiladores',
    'aerocooler',
    'heatpipe',
    'heatpipes',
  ],
  fonte: [
    'fonte',
    'fontes',
    'carregador',
    'carregadores',
    'adapter',
    'adaptador',
    'adaptadores',
    'power',
    'psu',
    'alimentacao',
  ],
  bateria: ['bateria', 'baterias', 'battery', 'batteries', 'pilha', 'pilhas', 'acumulador'],
  tela: [
    'tela',
    'telas',
    'display',
    'displays',
    'painel',
    'paineis',
    'panel',
    'lcd',
    'led',
    'oled',
    'ips',
  ],
  teclado: ['teclado', 'teclados', 'keyboard', 'keyboards'],
  placa_mae: [
    'placa',
    'placas',
    'motherboard',
    'motherboards',
    'mainboard',
    'mainboards',
    'placa-mae',
    'placamae',
    'mobo',
  ],
  memoria: ['memoria', 'memorias', 'ram', 'sodimm', 'dimm', 'ddr3', 'ddr4', 'ddr5'],
  disco: ['ssd', 'hd', 'disco', 'discos', 'nvme', 'm2', 'storage'],
  cabo_flat: ['flat', 'flats', 'edp', 'lvds', 'flex'],
  dobradica: ['dobradica', 'dobradicas', 'hinge', 'hinges', 'haste', 'hastes'],
  carcaca: [
    'carcaca',
    'carcacas',
    'chassi',
    'chassis',
    'palmrest',
    'touchpad',
    'case',
    'bezel',
    'moldura',
  ],
  tampa: ['tampa', 'tampas', 'cover', 'covers'],
  gabinete: ['gabinete', 'gabinetes', 'case', 'cases'],
  processador: ['processador', 'processadores', 'cpu', 'cpus', 'processor', 'processors'],
  alto_falante: [
    'alto-falante',
    'altofalante',
    'altofalantes',
    'falante',
    'falantes',
    'speaker',
    'speakers',
  ],
  webcam: ['webcam', 'webcams', 'camera', 'cameras'],
  conector: ['conector', 'conectores', 'jack', 'jacks', 'dcjack', 'dc-jack', 'connector'],
  inverter: ['inverter', 'inversores'],
}

// Mapa reverso para consulta rápida: token normalizado -> lista de sinônimos válidos
export const COMPONENT_SYNONYM_LOOKUP = new Map<string, string[]>()
for (const [, synonyms] of Object.entries(COMPONENT_SYNONYM_GROUPS)) {
  for (const syn of synonyms) {
    const norm = removeAccents(syn).toLowerCase()
    COMPONENT_SYNONYM_LOOKUP.set(norm, synonyms)
  }
}

// Conjunto de todos os termos que identificam hardware/peça
export const HARDWARE_COMPONENTS = new Set<string>([
  ...Array.from(COMPONENT_SYNONYM_LOOKUP.keys()),
  'dissipador',
  'dissipadores',
  'heatsink',
  'heatsinks',
  'cooler',
  'coolers',
  'ventoinha',
  'ventoinhas',
  'fan',
  'fans',
  'fonte',
  'fontes',
  'carregador',
  'carregadores',
  'bateria',
  'baterias',
  'teclado',
  'teclados',
  'tela',
  'telas',
  'display',
  'placa',
  'placas',
  'motherboard',
  'mainboard',
  'memoria',
  'memorias',
  'ram',
  'ssd',
  'hd',
  'disco',
  'cabo',
  'cabos',
  'flat',
  'dobradica',
  'dobradicas',
  'carcaca',
  'carcacas',
  'tampa',
  'tampas',
  'palmrest',
  'touchpad',
  'gabinete',
  'gabinetes',
  'processador',
  'processadores',
  'cpu',
  'gpu',
  'inverter',
  'conector',
  'conectores',
  'jack',
  'dcjack',
  'alto-falante',
  'altofalante',
  'falante',
  'speaker',
  'webcam',
  'camera',
])

/**
 * Retorna todos os sinônimos aceitos para um dado componente, ou [componentToken] se não houver grupo.
 */
export function getComponentSynonyms(componentToken: string): string[] {
  const norm = removeAccents(componentToken).toLowerCase()
  const group = COMPONENT_SYNONYM_LOOKUP.get(norm)
  if (group && group.length > 0) {
    return group
  }
  return [norm]
}

/**
 * Verifica se um componente procurado está presente no texto do anúncio,
 * aceitando qualquer um dos seus sinônimos válidos.
 */
export function matchesAnyComponentSynonym(
  fullText: string,
  fullCompact: string,
  componentToken: string,
): { matched: boolean; matchedTerm?: string } {
  const synonyms = getComponentSynonyms(componentToken)
  for (const syn of synonyms) {
    if (matchesCatalogToken(fullText, fullCompact, syn)) {
      return { matched: true, matchedTerm: syn }
    }
  }
  return { matched: false }
}

// Palavras de barreira que identificam acessórios (usadas para buscas de PRODUTO INTEIRO e para insight)
export const ACCESSORY_BARRIER_WORDS = new Set([
  'capa',
  'capas',
  'capinha',
  'capinhas',
  'case',
  'cases',
  'pelicula',
  'peliculas',
  'vidro',
  'silicone',
  'cabo',
  'cabos',
  'fone',
  'fones',
  'headset',
  'headphone',
  'auricular',
  'earbuds',
  'earphone',
  'carregador',
  'carregadores',
  'suporte',
  'suportes',
  'brinde',
  'brindes',
  'chaveiro',
  'chaveiros',
  'strap',
  'straps',
  'cordao',
  'lente',
  'lentes',
  'protetor',
  'protetores',
  'adesivo',
  'adesivos',
  'skin',
  'skins',
  'magsafe',
  'bumper',
  'bolsa',
  'maleta',
  'luva',
  'sleeve',
  'mousepad',
  'dock',
  'hub',
  'adaptador',
  'adaptadores',
  'caneta',
  'stylus',
  'pulseira',
  'pulseiras',
  'flanela',
  'pano',
  'limpador',
])

// Padrões para detecção de KITS ou LOTES
const KIT_BUNDLE_PATTERNS = [
  /\blote\b/i,
  /\blotes\b/i,
  /\bkit\b/i,
  /\bkits\b/i,
  /\batacado\b/i,
  /\batacadista\b/i,
  /\brevenda\b/i,
  /\bcombo\b/i,
  /\bcombos\b/i,
  /\bpack\b/i,
  /\bconjunto\b/i,
  /\bcaixa fechada\b/i,
  /\b[2-9]x\b/i,
  /\b[1-9][0-9]+x\b/i,
  /\b[2-9]\s*un\b/i,
  /\b[1-9][0-9]+\s*un\b/i,
  /\b[2-9]\s*unid/i,
  /\b[1-9][0-9]+\s*unid/i,
  /\b[2-9]\s*pecas?\b/i,
  /\b[1-9][0-9]+\s*pecas?\b/i,
  /\b[2-9]\s*unidades?\b/i,
  /\b[1-9][0-9]+\s*unidades?\b/i,
]

/**
 * Detecta se um título representa um KIT ou LOTE de produtos.
 */
export function isKitOrBundleTitle(title: string): boolean {
  if (!title) return false
  const normalized = normalizeCatalogText(title)
  for (const pattern of KIT_BUNDLE_PATTERNS) {
    if (pattern.test(normalized)) {
      return true
    }
  }
  return false
}

/**
 * Detecta se a busca é de PEÇA (componente de reposição/hardware) ou de PRODUTO INTEIRO (ecossistema/aparelho).
 */
export function detectSearchMode(searchQuery: string): ExactProductSearchMode {
  const tokens = extractExactProductTokens(searchQuery)
  for (const token of tokens) {
    if (HARDWARE_COMPONENTS.has(token)) {
      return 'part'
    }
  }
  return 'whole_product'
}

/**
 * Detecta se o título é de um ACESSÓRIO para o produto buscado.
 * Se a busca foi por um acessório específico (ex.: "carregador" ou "cabo"), esse token
 * não é considerado barreira de exclusão.
 */
export function isAccessoryTitle(title: string, searchQuery: string): boolean {
  if (!title) return false
  const normTitle = normalizeCatalogText(title)
  const compactTitle = removeAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const queryTokens = extractExactProductTokens(searchQuery)

  // Tokens da query que seriam palavras de acessório
  const queryAccessoryTokens = new Set(
    queryTokens.filter((t) => ACCESSORY_BARRIER_WORDS.has(t) || HARDWARE_COMPONENTS.has(t)),
  )

  // 1. Padrões de compatibilidade: "capa para iphone 17", "pelicula compativel com...", "para iphone..."
  // Se o título diz "capa...", "pelicula...", "case...", "vidro..."
  for (const barrier of ACCESSORY_BARRIER_WORDS) {
    // Se o usuário buscou explicitamente essa barreira (ex.: buscou "carregador dell"), não exclui por ela
    if (queryAccessoryTokens.has(barrier)) {
      continue
    }

    if (matchesCatalogToken(normTitle, compactTitle, barrier)) {
      return true
    }
  }

  // 2. Padrões expressivos de compatibilidade indicando que o anúncio vende algo PARA o aparelho
  // Ex.: "compativel com iphone 17", "p/ iphone 17", "para iphone 17" vendendo capa/película
  if (
    /\b(para|p\/|compativel com|aplicavel a|serve para|serve em)\b/i.test(normTitle) &&
    /\b(capa|capinha|case|pelicula|protecao|anti impacto|antishock|antirisco|vidro 3d|vidro 9d)\b/i.test(
      normTitle,
    )
  ) {
    return true
  }

  return false
}

const POPULAR_BRANDS = new Set([
  'dell',
  'lenovo',
  'hp',
  'acer',
  'asus',
  'samsung',
  'apple',
  'positiv',
  'positivo',
  'lg',
  'intelbras',
  'vaio',
  'toshiba',
])

// Palavras contextuais que descrevem formato/linha/aplicação mas NÃO devem
// reprovar um anúncio legítimo se ausentes ou presentes no título
const CONTEXT_WORDS = new Set([
  'desktop',
  'pc',
  'computador',
  'computadores',
  'notebook',
  'notebooks',
  'laptop',
  'laptops',
  'optiplex',
  'thinkcentre',
  'thinkpad',
  'latitude',
  'inspiron',
  'vostro',
  'prodesk',
  'elitedesk',
  'elitebook',
  'probook',
  'sff',
  'mini',
  'micro',
  'tower',
  'torre',
  'all',
  'one',
  'aio',
  'slim',
])

/**
 * Avalia casamento de PRODUTO EXATO:
 * Ex.: "fonte dell 3020" ou "fonte desktop dell 3020" -> Deve casar com:
 * - "Fonte Desktop Dell Optiplex 3020 7020 9020 T1700 H1fwx 255w"
 * - "Fonte Dell 3020 240W"
 * - "Fonte Para Dell Optiplex 3020 SFF D255AS-00"
 *
 * E deve REJEITAR produtos incompatíveis:
 * - Notebook/computador completo sem ser fonte (ex.: "Computador Dell Optiplex 3020 Core i5")
 * - Outros componentes para o mesmo modelo (ex.: "Placa Mae Dell 3020", "Gabinete Dell 3020", "Teclado Dell 3020")
 * - Fontes de outro modelo incompatível (ex.: "Fonte Dell 745 755 760" sem menção ao 3020)
 *
 * Regras:
 * 1. Tokens de COMPONENTE (ex: "fonte", "bateria", "teclado") devem bater com o produto.
 * 2. Tokens de MODELO (ex: "3020", "5420", "t480") devem estar presentes no anúncio.
 * 3. Tokens de MARCA (ex: "dell", "lenovo", "hp") se buscados devem estar presentes.
 * 4. Tokens de CONTEXTO (ex: "desktop", "optiplex", "notebook") e variações de potência
 *    ("240w", "255w", etc.) refinam relevância mas não desclassificam o anúncio legítimo.
 * 5. Se o usuário busca um componente específico (ex: "fonte"), o anúncio NÃO pode
 *    ser de outro componente conflitante (ex: anúncio de "placa mae" sem menção a fonte,
 *    ou anúncio de computador desktop completo sem ser a fonte).
 */
export function evaluateExactProductMatch(
  title: string,
  searchQuery: string,
  attributes?: Array<{ id: string; name?: string; value_name?: string | null }>,
  forcedMode?: ExactProductSearchMode,
  flatBrand?: string,
  flatModel?: string,
): ExactProductScoreResult {
  const queryTokens = extractExactProductTokens(searchQuery)
  const effectiveMode = forcedMode || detectSearchMode(searchQuery)
  const isKit = isKitOrBundleTitle(title)

  if (queryTokens.length === 0) {
    return {
      isExactMatch: true,
      similarityScore: 100,
      matchedTokens: [],
      missingTokens: [],
      reasons: ['Nenhum token específico exigido'],
      detectedMode: effectiveMode,
      isAccessory: false,
      isKitOrBundle: isKit,
      isFamilyMatch: false,
    }
  }

  const normalizedTitle = normalizeCatalogText(title)
  const compactTitle = removeAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  // Verificação de acessório
  const accessory = isAccessoryTitle(title, searchQuery)

  // Atributos adicionais (suporta array attributes e campos planos flatBrand / flatModel)
  let extraAttrsText = ''
  if (flatBrand) extraAttrsText += ' ' + flatBrand
  if (flatModel) extraAttrsText += ' ' + flatModel

  if (Array.isArray(attributes)) {
    for (const attr of attributes) {
      if (
        attr.id === 'BRAND' ||
        attr.id === 'MARCA' ||
        attr.id === 'MODEL' ||
        attr.id === 'MODELO' ||
        attr.id === 'LINE' ||
        attr.id === 'PART_NUMBER'
      ) {
        extraAttrsText += ' ' + (attr.value_name || '')
      }
    }
  }
  const fullTextToTest =
    normalizedTitle + (extraAttrsText ? ' ' + normalizeCatalogText(extraAttrsText) : '')
  const fullCompactToTest =
    compactTitle +
    removeAccents(extraAttrsText)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

  // Classificar tokens da consulta por tipo
  const componentTokens: string[] = []
  const modelTokens: string[] = []
  const brandTokens: string[] = []
  const contextTokens: string[] = []
  const otherTokens: string[] = []

  for (const token of queryTokens) {
    // Variação de potência (ex: "240w", "255w", "65w", "45w", "90w", "130w")
    const isWattage = /^[0-9]{1,4}w$/i.test(token)
    // Código de modelo: ex "3020", "7020", "5420", "t480", "g15", "e7440"
    const isModelCode =
      (!isWattage && /^[0-9]{3,5}$/.test(token)) ||
      /^[a-z]{1,2}[0-9]{2,5}[a-z]?$/i.test(token) ||
      /^[a-z]{2,}[0-9]{2,5}/i.test(token)

    if (HARDWARE_COMPONENTS.has(token)) {
      // Exceção: "desktop" na consulta pode ser contexto de forma ("fonte desktop"),
      // mas se o usuário buscou só "desktop dell 3020", vira componente se não houver outro
      if (
        token === 'desktop' &&
        queryTokens.some((t) => HARDWARE_COMPONENTS.has(t) && t !== 'desktop')
      ) {
        contextTokens.push(token)
      } else {
        componentTokens.push(token)
      }
    } else if (isModelCode) {
      modelTokens.push(token)
    } else if (POPULAR_BRANDS.has(token)) {
      brandTokens.push(token)
    } else if (CONTEXT_WORDS.has(token) || isWattage) {
      contextTokens.push(token)
    } else {
      otherTokens.push(token)
    }
  }

  const matchedTokens: string[] = []
  const missingTokens: string[] = []
  const reasons: string[] = []

  // 1. Validar COMPONENTES (Apenas se busca for de PEÇA ou houver componente na consulta)
  // Cada componente buscado é tratado como GRUPO DE SINÔNIMOS, não palavra literal.
  // Ex.: "cooler" aceita cooler, dissipador, heatsink, fan, ventoinha.
  // Ex.: "fonte" aceita fonte, carregador, adapter, adaptador, power, psu.
  let missingComponentCount = 0
  if (effectiveMode === 'part') {
    for (const cToken of componentTokens) {
      const synMatch = matchesAnyComponentSynonym(fullTextToTest, fullCompactToTest, cToken)
      if (synMatch.matched) {
        matchedTokens.push(synMatch.matchedTerm || cToken)
      } else {
        missingTokens.push(cToken)
        missingComponentCount++
        reasons.push(
          `Componente "${cToken}" (ou sinônimo dissipador/heatsink/fan...) ausente no anúncio`,
        )
      }
    }

    // Se o componente foi encontrado via sinônimo, conferir se o anúncio NÃO é
    // puramente de um componente concorrente sem qualquer relação com a peça buscada.
    // Ex: buscou "fonte dell 3020" e o anúncio é apenas "Placa Mae Dell 3020"
    if (componentTokens.length > 0 && missingComponentCount === 0) {
      // Confere se todos os componentes pedidos têm ao menos um sinônimo no título/atributos
      for (const cToken of componentTokens) {
        const check = matchesAnyComponentSynonym(fullTextToTest, fullCompactToTest, cToken)
        if (!check.matched) {
          missingComponentCount++
          reasons.push(`Anúncio não possui o componente "${cToken}" nem seus sinônimos válidos`)
          break
        }
      }
    }
  } else {
    // CÉREBRO: PRODUTO INTEIRO (ex: "iphone 17", "dell latitude 5420")
    // Se o anúncio for de ACESSÓRIO (capa, case, película, vidro, cabo etc.), é rejeitado imediatamente
    if (accessory) {
      missingComponentCount++
      reasons.push(
        'Anúncio é acessório (capa, cabo, película ou compatível) e não o produto inteiro',
      )
    }
  }

  // 2. Validar MODELOS (com suporte a família de hardware/térmica)
  let missingModelCount = 0
  let matchedViaFamily = false
  let detectedFamilyName: string | undefined = undefined

  for (const mToken of modelTokens) {
    const modelCheck = matchesModelOrFamily(
      fullTextToTest,
      fullCompactToTest,
      mToken,
      componentTokens,
    )
    if (modelCheck.matched) {
      matchedTokens.push(modelCheck.matchedTerm || mToken)
      if (modelCheck.isFamilyMatch) {
        matchedViaFamily = true
        detectedFamilyName = modelCheck.familyName
        reasons.push(
          `Casamento por família de hardware: "${mToken}" compatível com "${modelCheck.matchedTerm}" (${modelCheck.familyName})`,
        )
      }
    } else {
      missingTokens.push(mToken)
      missingModelCount++
      reasons.push(`Modelo "${mToken}" ausente no anúncio`)
    }
  }

  // 3. Validar MARCAS (com mapa canônico bidirecional de marcas/submarcas)
  // Ex: "lenovo" aceita thinkcentre, thinkpad, ideapad, legion etc.
  // Ex: "thinkcentre" aceita lenovo
  let missingBrandCount = 0
  for (const bToken of brandTokens) {
    const brandCheck = matchesBrandEquivalents(fullTextToTest, fullCompactToTest, bToken)
    if (brandCheck.matched) {
      matchedTokens.push(brandCheck.matchedTerm || bToken)
      if (brandCheck.matchedTerm && brandCheck.matchedTerm !== bToken) {
        reasons.push(
          `Marca "${bToken}" satisfeita via submarca/equivalente "${brandCheck.matchedTerm}"`,
        )
      }
    } else {
      missingTokens.push(bToken)
      missingBrandCount++
      reasons.push(`Marca "${bToken}" ausente no anúncio`)
    }
  }

  // 4. Validar CONTEXTO (desktop, optiplex, 240w...) - são bônus, não desclassificam
  for (const ctxToken of contextTokens) {
    const matches = matchesCatalogToken(fullTextToTest, fullCompactToTest, ctxToken)
    if (matches) {
      matchedTokens.push(ctxToken)
    } else {
      // Não entra como missing crítico
      missingTokens.push(ctxToken)
    }
  }

  // 5. Outros tokens
  for (const oToken of otherTokens) {
    const matches = matchesCatalogToken(fullTextToTest, fullCompactToTest, oToken)
    if (matches) {
      matchedTokens.push(oToken)
    } else {
      // Em busca de produto inteiro, se o outro token for relevante (ex.: "iphone" se não entrou em brandTokens), exige
      if (effectiveMode === 'whole_product' && oToken.length >= 3) {
        missingTokens.push(oToken)
        missingModelCount++
        reasons.push(`Token "${oToken}" ausente no anúncio`)
      } else {
        missingTokens.push(oToken)
      }
    }
  }

  // CRITÉRIO DE CASAMENTO EXATO REFORMULADO:
  // - TODOS os modelos obrigatórios devem estar presentes (missingModelCount === 0)
  // - TODOS os componentes obrigatórios devem bater (missingComponentCount === 0)
  // - MARCA se pesquisada deve bater (missingBrandCount === 0)
  // - Em busca de PRODUTO INTEIRO, acessórios são excluídos (isAccessory === false)
  // Contexto (como "desktop", "optiplex") e potência ("240w") NÃO desclassificam o anúncio!
  const hasCriticalMismatch =
    missingModelCount > 0 || missingComponentCount > 0 || missingBrandCount > 0

  const isExactMatch = !hasCriticalMismatch

  // Cálculo de pontuação de similaridade (0 a 100)
  let similarityScore = 0
  if (isExactMatch) {
    // Começa em 85 pelo casamento de componentes, modelo e marca essenciais
    similarityScore = 85
    // Bônus para contexto que casou
    const contextMatchedCount = contextTokens.filter((t) => matchedTokens.includes(t)).length
    if (contextTokens.length > 0) {
      const bonus = Math.round((contextMatchedCount / contextTokens.length) * 15)
      similarityScore += bonus
    } else {
      similarityScore = 100
    }
    reasons.push('Casamento legítimo de modelo, componente e marca')
  } else {
    // Penalização conforme a severidade
    const totalTokens = queryTokens.length
    const matchedCount = matchedTokens.length
    similarityScore = Math.max(0, Math.min(60, Math.round((matchedCount / totalTokens) * 50)))
  }

  return {
    isExactMatch,
    similarityScore: Math.min(100, similarityScore),
    matchedTokens,
    missingTokens,
    reasons,
    detectedMode: effectiveMode,
    isAccessory: accessory,
    isKitOrBundle: isKit,
    isFamilyMatch: matchedViaFamily,
    matchedFamilyName: detectedFamilyName,
  }
}

/**
 * Normaliza uma string de texto/título substituindo separadores (hífens, barras, múltiplos espaços)
 * por espaços simples e removendo acentos.
 */
export function normalizeCatalogText(text: string): string {
  return removeAccents(text)
    .toLowerCase()
    .replace(/[-_/\\,.;:|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Verifica se um token específico está contido no título normalizado.
 * Regras:
 * - Se for numérico puro (ex: "5420", "3420", "16", "512"), exige casamento como palavra inteira (boundary de dígito),
 *   evitando que "5420" case com "54200" ou "15420".
 * - Se for alfanumérico ou composto (ex: "t480", "latitude", "dell"), pode casar com boundary ou prefixo de modelo.
 *   Também confere variações sem hífen (ex: "latitude5420" vs "latitude 5420").
 */
export function matchesCatalogToken(
  normalizedTitle: string,
  rawTitleCompact: string,
  token: string,
): boolean {
  if (!token) return true

  const isNumeric = /^[0-9]+$/.test(token)
  if (isNumeric) {
    // Casamento de número inteiro: não deve ser precedido nem seguido por dígitos
    // Ex: "latitude 5420" -> "5420" casa; "54200" não casa
    // Também confere se o token numérico está contido no título compacto (ex: "15-3576" -> "153576" ou "3576")
    const numericRegex = new RegExp(`(?<![0-9])${token}(?![0-9])`, 'i')
    if (numericRegex.test(normalizedTitle)) {
      return true
    }
    // Caso especial para números de 3 a 5 dígitos (como números de modelo: "3576", "5420", "3420", "5320"):
    // se estiver contido no rawTitleCompact (ex: "inspiron153576" contendo "3576")
    if (token.length >= 3 && rawTitleCompact.includes(token)) {
      return true
    }
    return false
  }

  // Token alfanumérico com números (ex: t480, i5, i7, g15)
  const hasDigitsAndLetters = /[0-9]/.test(token) && /[a-z]/.test(token)
  if (hasDigitsAndLetters) {
    // Pode aparecer separado ou colado (ex: "t 480" ou "t480" ou "thinkpad t480")
    if (normalizedTitle.includes(token) || rawTitleCompact.includes(token)) {
      return true
    }
    // Variação com espaço entre letras e números (ex: "t 480")
    const spaced = token.replace(/([a-z]+)([0-9]+)/gi, '$1 $2')
    if (normalizedTitle.includes(spaced)) {
      return true
    }
  }

  // Token de texto padrão (ex: "dell", "latitude", "thinkpad", "elitebook")
  // Boundary de palavras alfanuméricas
  const wordRegex = new RegExp(`\\b${token}\\b`, 'i')
  if (wordRegex.test(normalizedTitle)) {
    return true
  }

  // Fallback: se o título contiver substring direta
  return normalizedTitle.includes(token)
}

/**
 * Avalia se o título de um produto atende a TODOS os tokens da query (busca AND rígida).
 * Também verifica atributos chave como Marca (BRAND) ou Modelo (MODEL) se presentes.
 */
export function evaluateCatalogItemStrictMatch(
  title: string,
  searchTokens: string[],
  attributes?: Array<{ id: string; name?: string; value_name?: string | null }>,
  conditionFilter?: 'all' | 'refurbished' | 'new' | 'used' | 'open_box',
  itemCondition?: string,
): {
  isMatch: boolean
  matchedTokens: string[]
  missingTokens: string[]
} {
  const normCond = String(itemCondition || '').toLowerCase()
  const isRefurb =
    normCond === 'refurbished' || normCond === 'recondicionado' || normCond === '2230582'
  const isUsed = normCond === 'used' || normCond === 'usado' || normCond === '2230581'
  const isOpenBox =
    normCond === 'open_box' ||
    normCond === 'caixa aberta' ||
    normCond === 'caixa_aberta' ||
    normCond === '46759135'
  const isNew =
    (!normCond || normCond === 'new' || normCond === 'novo' || normCond === '2230284') &&
    !isRefurb &&
    !isUsed &&
    !isOpenBox

  if (searchTokens.length === 0) {
    // Se não há tokens de texto, verifica apenas se a condição é compatível se especificada
    const conditionMatches =
      !conditionFilter || conditionFilter === 'all'
        ? true
        : conditionFilter === 'refurbished'
          ? isRefurb
          : conditionFilter === 'new'
            ? isNew
            : conditionFilter === 'used'
              ? isUsed
              : conditionFilter === 'open_box'
                ? isOpenBox
                : true

    return {
      isMatch: conditionMatches,
      matchedTokens: [],
      missingTokens: [],
    }
  }

  const normalizedTitle = normalizeCatalogText(title)
  const compactTitle = removeAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  // Também junta marca e modelo dos atributos caso existam
  let extraAttrsText = ''
  if (Array.isArray(attributes)) {
    for (const attr of attributes) {
      if (attr.id === 'BRAND' || attr.id === 'MODEL' || attr.id === 'GRADING') {
        extraAttrsText += ' ' + (attr.value_name || '')
      }
    }
  }
  if (isRefurb) {
    extraAttrsText += ' recondicionado refurbished'
  } else if (isOpenBox) {
    extraAttrsText += ' caixa aberta open box'
  } else if (isUsed) {
    extraAttrsText += ' usado seminovo'
  } else if (isNew) {
    extraAttrsText += ' novo'
  }
  const fullTextToTest =
    normalizedTitle + (extraAttrsText ? ' ' + normalizeCatalogText(extraAttrsText) : '')
  const fullCompactToTest =
    compactTitle +
    removeAccents(extraAttrsText)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

  const matchedTokens: string[] = []
  const missingTokens: string[] = []

  for (const token of searchTokens) {
    // Normalização extra de tokens compostos por hífen (ex: "15-3576" -> "3576")
    let tokenMatches = matchesCatalogToken(fullTextToTest, fullCompactToTest, token)

    // Se não casou diretamente, tenta equivalência de submarca/marca
    if (!tokenMatches) {
      const brandCheck = matchesBrandEquivalents(fullTextToTest, fullCompactToTest, token)
      if (brandCheck.matched) {
        tokenMatches = true
      }
    }

    // Se não casou, tenta sinônimo de componente
    if (!tokenMatches && HARDWARE_COMPONENTS.has(token)) {
      const compCheck = matchesAnyComponentSynonym(fullTextToTest, fullCompactToTest, token)
      if (compCheck.matched) {
        tokenMatches = true
      }
    }

    // Se não casou, tenta família de modelo
    if (!tokenMatches) {
      const famCheck = matchesModelOrFamily(fullTextToTest, fullCompactToTest, token)
      if (famCheck.matched) {
        tokenMatches = true
      }
    }

    // Se o token for por exemplo "15-3576" ou contiver partes, testa também as subpartes significativas
    if (!tokenMatches && token.includes('-')) {
      const subParts = token.split('-').filter((p) => p.length >= 3)
      if (
        subParts.length > 0 &&
        subParts.every((sp) => matchesCatalogToken(fullTextToTest, fullCompactToTest, sp))
      ) {
        tokenMatches = true
      }
    }

    if (tokenMatches) {
      matchedTokens.push(token)
    } else {
      missingTokens.push(token)
    }
  }

  // Se o seletor de condição estiver ativo, verifica compatibilidade com a condição declarada
  let matchesConditionRule = true
  if (conditionFilter && conditionFilter !== 'all') {
    if (conditionFilter === 'refurbished') {
      matchesConditionRule = isRefurb
    } else if (conditionFilter === 'used') {
      matchesConditionRule = isUsed
    } else if (conditionFilter === 'open_box') {
      matchesConditionRule = isOpenBox
    } else if (conditionFilter === 'new') {
      matchesConditionRule = isNew
    }
  }

  const isMatch = missingTokens.length === 0 && matchesConditionRule

  return {
    isMatch,
    matchedTokens,
    missingTokens,
  }
}

export interface HighlightSegment {
  text: string
  isHighlighted: boolean
}

/**
 * Quebra o título original em fatias destacando as palavras que casaram com os tokens de busca.
 * Preserva casing original e pontuação do título para exibição fiel na UI.
 */
export function highlightMatchedTitle(title: string, tokens: string[]): HighlightSegment[] {
  if (!title) return []
  if (!tokens || tokens.length === 0) {
    return [{ text: title, isHighlighted: false }]
  }

  // Ordena tokens por comprimento decrescente para casar os mais longos primeiro
  const sortedTokens = [...tokens].filter(Boolean).sort((a, b) => b.length - a.length)
  if (sortedTokens.length === 0) {
    return [{ text: title, isHighlighted: false }]
  }

  // Cria regex que busca qualquer um dos tokens
  // Tratando boundaries e caracteres especiais
  const pattern = sortedTokens
    .map((tok) => {
      // Se for puramente numérico, força boundary para não quebrar no meio de números maiores
      if (/^[0-9]+$/.test(tok)) {
        return `(?<![0-9])${tok}(?![0-9])`
      }
      return `\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
    })
    .join('|')

  // Para suportar acentos no título original, criamos uma versão normalizada para mapear índices
  // mas para simplificar de forma segura e robusta sem quebrar unicode:
  const regex = new RegExp(`(${pattern})`, 'gi')
  const parts = title.split(regex)

  const segments: HighlightSegment[] = []
  for (const part of parts) {
    if (!part) continue
    const normPart = removeAccents(part).toLowerCase()
    const matchesAny = sortedTokens.some((tok) => {
      if (/^[0-9]+$/.test(tok)) {
        return normPart === tok
      }
      return normPart === tok || normPart.includes(tok)
    })

    segments.push({
      text: part,
      isHighlighted: matchesAny,
    })
  }

  return segments
}

/**
 * Padrões de ruído severo e termos fora do escopo de TI / Informática / Computadores.
 * Capturam miniaturas de brinquedo, bicicletas, bonecos, vestuário, maquiagem, itens infantis
 * quando a palavra "mini" ou marcas trazem lixo do ML.
 */
export const IRRELEVANT_NOISE_TERMS = [
  'miniatura',
  'miniaturas',
  'mini bike',
  'bicicleta',
  'bicicletinha',
  'bike',
  'hot wheels',
  'hotwheels',
  'carrinho',
  'carrinhos',
  'boneco',
  'bonecos',
  'boneca',
  'bonecas',
  'brinquedo',
  'brinquedos',
  'infantil',
  'escala 1',
  '1:18',
  '1:24',
  '1:32',
  '1:43',
  '1:64',
  'diecast',
  'maisto',
  'burago',
  'bburago',
  'action figure',
  'pelucia',
  'vestido',
  'saia',
  'blusa',
  'perfume',
  'maquiagem',
  'batom',
  'esmalte',
  'shampoo',
  'condicionador',
  'sabonete',
  'brinco',
  'colar',
  'anel',
  'pulseira infantil',
  'bebe',
  'maternidade',
  'chupeta',
  'mamadeira',
  'fralda',
  'fogao infantil',
  'panela infantil',
]

/**
 * Heurística de detecção de ruído / anúncio irrelevante para buscas de informática e hardware.
 * Retorna se o anúncio é considerado ruído (fora de contexto) e a justificativa clara.
 */
export function detectCollectorNoiseAd(
  title: string,
  searchQuery?: string,
): { isNoise: boolean; reason?: string } {
  const normTitle = normalizeCatalogText(title || '')
  if (!normTitle) return { isNoise: false }

  const q = normalizeCatalogText(searchQuery || '')
  const qTokens = extractExactProductTokens(q)
  const isDellSearch =
    qTokens.includes('del') ||
    qTokens.includes('dell') ||
    normTitle.includes('dell') ||
    normTitle.includes('del')
  const isMiniSearch = qTokens.includes('mini') || normTitle.includes('mini')

  // 1. Checar termos explícitos de ruído (brinquedos, miniaturas, bicicletas, etc.)
  for (const term of IRRELEVANT_NOISE_TERMS) {
    // Se o usuário procurou propositalmente por esse termo, não rejeita por ele
    if (qTokens.includes(term) || q.includes(term)) continue

    const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(normTitle) || normTitle.includes(term)) {
      return {
        isNoise: true,
        reason: `Termo fora de informática detectado: "${term}"`,
      }
    }
  }

  // 2. Se a busca envolve "mini" e marca de informática como "del" / "dell",
  // filtrar produtos onde "mini" é miniatura/brinquedo ou veículo (ex.: "mini moto", "mini buggy")
  if (isMiniSearch) {
    const miniVehicleOrToy =
      /\b(mini\s*(carro|moto|veiculo|quadriciclo|buggy|skate|patinete|crafter|fusca|kombi|opala|camaro|ferrari|porsche))\b/i
    if (miniVehicleOrToy.test(normTitle)) {
      return {
        isNoise: true,
        reason: 'Miniatura ou veículo infantil detectado em busca de mini PC',
      }
    }
  }

  // 3. Em buscas de "del mini" / "dell mini" / "mini 3050":
  // Se contiver marca de celular/smartphone muito distante ou brinquedo sem contexto de desktop/pc
  if (isDellSearch && isMiniSearch) {
    if (
      /\b(celular|smartphone)\b/i.test(normTitle) &&
      !/\b(optiplex|desktop|computador|pc|intel|core|i3|i5|i7|micro|tiny)\b/i.test(normTitle)
    ) {
      // Ex: smartphone dell antigo "Dell Mini 3" celular histórico vs Mini PC Dell
      // Observação: Se o usuário procurou "del mini 3" para PC, e vier celular, é classificado como celular
    }
  }

  return { isNoise: false }
}
