/**
 * Utilitários de normalização, tokenização e filtro rigoroso de relevância
 * para buscas no catálogo do Mercado Livre.
 */

// Stopwords que não agregam diferenciação nos anúncios de notebook no catálogo
const CATALOG_STOPWORDS = new Set([
  'notebook',
  'notebooks',
  'note',
  'notes',
  'laptop',
  'laptops',
  'pc',
  'computador',
  'computadores',
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
  ])

  const filtered = rawTokens.filter((token) => !EXACT_STOPWORDS.has(token))
  const finalTokens = filtered.length > 0 ? filtered : rawTokens

  return Array.from(new Set(finalTokens))
}

export interface ExactProductScoreResult {
  isExactMatch: boolean
  similarityScore: number // 0 a 100
  matchedTokens: string[]
  missingTokens: string[]
  reasons: string[]
}

/**
 * Avalia casamento rigoroso de PRODUTO EXATO:
 * Ex.: "fonte desktop dell 3020" -> Deve casar com "Fonte Dell 3020 Desktop 240W",
 * mas NÃO com "notebook dell latitude", nem "gabinete dell 3020", nem "placa mae dell 3020".
 *
 * Regras do cálculo de similaridade e relevância:
 * 1. Todos os tokens essenciais (códigos de modelo numéricos/alfanuméricos como "3020", "5420", "t480")
 *    são OBRIGATÓRIOS. Se faltar o código do modelo, score = 0 e isExactMatch = false.
 * 2. Categoria do componente (ex: "fonte", "bateria", "teclado", "tela", "cooler")
 *    se presente no termo de busca, DEVE estar presente no título. Evita que busca de "fonte dell 3020"
 *    traga "desktop dell 3020" ou "placa dell 3020".
 * 3. Marca (ex: "dell", "lenovo", "hp") se presente no termo, deve estar no título ou atributos.
 * 4. Tokens secundários (ex: "desktop", "sff", "mini") elevam a pontuação para 100%.
 */
export function evaluateExactProductMatch(
  title: string,
  searchQuery: string,
  attributes?: Array<{ id: string; name?: string; value_name?: string | null }>,
): ExactProductScoreResult {
  const queryTokens = extractExactProductTokens(searchQuery)
  if (queryTokens.length === 0) {
    return {
      isExactMatch: true,
      similarityScore: 100,
      matchedTokens: [],
      missingTokens: [],
      reasons: ['Nenhum token específico exigido'],
    }
  }

  const normalizedTitle = normalizeCatalogText(title)
  const compactTitle = removeAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  // Atributos adicionais
  let extraAttrsText = ''
  if (Array.isArray(attributes)) {
    for (const attr of attributes) {
      if (attr.id === 'BRAND' || attr.id === 'MODEL' || attr.id === 'LINE') {
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

  // Classificação dos tokens por importância
  const KEY_COMPONENT_TYPES = new Set([
    'fonte',
    'carregador',
    'bateria',
    'teclado',
    'tela',
    'display',
    'cooler',
    'ventoinha',
    'placa',
    'motherboard',
    'memoria',
    'ram',
    'ssd',
    'hd',
    'cabo',
    'flat',
    'dobradica',
    'carcaca',
    'tampa',
    'palmrest',
    'touchpad',
    'desktop',
    'gabinete',
    'servidor',
    'notebook',
  ])

  const matchedTokens: string[] = []
  const missingTokens: string[] = []
  const reasons: string[] = []

  let hasMissingCriticalModel = false
  let hasMissingComponentType = false

  for (const token of queryTokens) {
    const isModelCode = /^[0-9]{3,5}$/.test(token) || /^[a-z]{1,2}[0-9]{2,5}[a-z]?$/i.test(token)
    const isComponentType = KEY_COMPONENT_TYPES.has(token)

    let tokenMatches = matchesCatalogToken(fullTextToTest, fullCompactToTest, token)

    // Se o token contiver hífen (ex: "d255as-00" ou "optiplex-3020")
    if (!tokenMatches && token.includes('-')) {
      const parts = token.split('-').filter((p) => p.length >= 2)
      if (
        parts.length > 0 &&
        parts.every((p) => matchesCatalogToken(fullTextToTest, fullCompactToTest, p))
      ) {
        tokenMatches = true
      }
    }

    if (tokenMatches) {
      matchedTokens.push(token)
    } else {
      missingTokens.push(token)
      if (isModelCode) {
        hasMissingCriticalModel = true
        reasons.push(`Modelo exato "${token}" ausente`)
      } else if (isComponentType) {
        hasMissingComponentType = true
        reasons.push(`Tipo de componente "${token}" ausente`)
      } else {
        reasons.push(`Token "${token}" ausente`)
      }
    }
  }

  // Se o usuário procurou um tipo de componente específico (ex: "fonte"), garantir que não é um produto que NÃO é fonte
  // Exemplo: se procurou "fonte dell 3020", o título não deve ser apenas o computador inteiro sem mencionar fonte
  const requestedComponentTypes = queryTokens.filter((t) => KEY_COMPONENT_TYPES.has(t))
  if (requestedComponentTypes.length > 0) {
    const hasAnyRequestedComponent = requestedComponentTypes.some((ct) =>
      matchesCatalogToken(fullTextToTest, fullCompactToTest, ct),
    )
    if (!hasAnyRequestedComponent) {
      hasMissingComponentType = true
    }
  }

  // Pontuação de Similaridade (0 a 100)
  const matchRatio = matchedTokens.length / queryTokens.length
  let similarityScore = Math.round(matchRatio * 100)

  // Penalidades severas para faltas críticas
  if (hasMissingCriticalModel) {
    similarityScore = Math.min(similarityScore, 30)
  }
  if (hasMissingComponentType) {
    similarityScore = Math.min(similarityScore, 20)
  }

  // Casamento exato exige que todos os tokens críticos e no mínimo 80% dos tokens estejam presentes
  // E nenhuma falta de modelo ou componente
  const isExactMatch =
    !hasMissingCriticalModel && !hasMissingComponentType && missingTokens.length === 0

  if (isExactMatch) {
    reasons.push('Casamento exato de especificações e modelo')
  }

  return {
    isExactMatch,
    similarityScore,
    matchedTokens,
    missingTokens,
    reasons,
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
