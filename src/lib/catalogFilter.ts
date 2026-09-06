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

export interface ExactProductScoreResult {
  isExactMatch: boolean
  similarityScore: number // 0 a 100
  matchedTokens: string[]
  missingTokens: string[]
  reasons: string[]
}

// Conjuntos de palavras-chave para classificação taxonômica de produto
const HARDWARE_COMPONENTS = new Set([
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
  'gabinete',
  'ventoinha',
])

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
      if (
        attr.id === 'BRAND' ||
        attr.id === 'MODEL' ||
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

  // 1. Validar COMPONENTES
  let missingComponentCount = 0
  for (const cToken of componentTokens) {
    const matches = matchesCatalogToken(fullTextToTest, fullCompactToTest, cToken)
    if (matches) {
      matchedTokens.push(cToken)
    } else {
      missingTokens.push(cToken)
      missingComponentCount++
      reasons.push(`Componente "${cToken}" ausente no anúncio`)
    }
  }

  // Se buscou componente (ex: "fonte"), conferir se o anúncio é de OUTRO componente
  // concorrente sem conter a palavra-chave de componente.
  // Ex: buscou "fonte dell 3020" e o anúncio é "Placa Mae Dell Optiplex 3020" ou "Cooler Dell 3020"
  if (componentTokens.length > 0 && missingComponentCount === 0) {
    const conflictingComponents = [
      'placa',
      'motherboard',
      'teclado',
      'bateria',
      'tela',
      'display',
      'cooler',
      'ventoinha',
      'cabo',
      'dobradica',
      'carcaca',
      'palmrest',
      'gabinete',
      'memoria',
      'ssd',
      'hd',
    ]

    // Se o usuário buscou "fonte", qualquer um dos acima presentes sem ser o componente buscado
    // pode indicar peça diferente, a menos que o título deixe claro que é a peça buscada
    // Ex: "Cabo de Fonte Dell 3020" -> é cabo, não fonte direta. Mas "Fonte Dell 3020 com cabo" -> é fonte.
    const requestedHasFonte =
      componentTokens.includes('fonte') || componentTokens.includes('carregador')
    if (requestedHasFonte) {
      // Se não contém fonte nem carregador no título do ML, não pode ser fonte
      const hasFonteInTitle =
        matchesCatalogToken(fullTextToTest, fullCompactToTest, 'fonte') ||
        matchesCatalogToken(fullTextToTest, fullCompactToTest, 'fontes') ||
        matchesCatalogToken(fullTextToTest, fullCompactToTest, 'carregador') ||
        matchesCatalogToken(fullTextToTest, fullCompactToTest, 'power') ||
        matchesCatalogToken(fullTextToTest, fullCompactToTest, 'psu')
      if (!hasFonteInTitle) {
        missingComponentCount++
        reasons.push('Anúncio não é do componente fonte/carregador')
      }
    }
  }

  // 2. Validar MODELOS
  let missingModelCount = 0
  for (const mToken of modelTokens) {
    const matches = matchesCatalogToken(fullTextToTest, fullCompactToTest, mToken)
    if (matches) {
      matchedTokens.push(mToken)
    } else {
      missingTokens.push(mToken)
      missingModelCount++
      reasons.push(`Modelo "${mToken}" ausente no anúncio`)
    }
  }

  // 3. Validar MARCAS
  let missingBrandCount = 0
  for (const bToken of brandTokens) {
    const matches = matchesCatalogToken(fullTextToTest, fullCompactToTest, bToken)
    if (matches) {
      matchedTokens.push(bToken)
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
      missingTokens.push(oToken)
    }
  }

  // CRITÉRIO DE CASAMENTO EXATO REFORMULADO:
  // - TODOS os modelos obrigatórios devem estar presentes (missingModelCount === 0)
  // - TODOS os componentes obrigatórios devem bater (missingComponentCount === 0)
  // - MARCA se pesquisada deve bater (missingBrandCount === 0)
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
