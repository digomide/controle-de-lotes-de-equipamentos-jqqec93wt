import pb from '@/lib/pocketbase/client'
import { type MLCatalogProduct, type MLCatalogCompetitor } from '@/services/mlCatalogService'
import { getCachedSellerNames, isOwnSeller } from '@/utils/sellerNameResolver'
import {
  evaluateExactProductMatch,
  detectSearchMode,
  isKitOrBundleTitle,
  isAccessoryTitle,
  detectCollectorNoiseAd,
  type ExactProductScoreResult,
  type ExactProductSearchMode,
} from '@/lib/catalogFilter'

export type RaioXScopeMode = 'exact' | 'all_mentions' | 'own_only'

export interface SellerPerformanceAggregate {
  sellerId: string
  sellerNickname: string
  isOwnAccount: boolean
  totalAdsCount: number
  totalAvailableStock: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  buyBoxWinnersCount: number
  hasBuyBox: boolean
  premiumListingsCount: number
  classicListingsCount: number

  // Vendas
  hasRealSalesData: boolean
  totalConfirmedSales: number
  estimatedSales60d: number | null
  salesVelocityPerDay: number | null
  historicalSnapshotsCount: number
  snapshotDeltaSales60d: number | null

  // Termômetro de Vendas (0 a 100)
  thermometerScore: number
  thermometerTier: 'high' | 'medium' | 'low' // 🔥 Giro Alto | 🌡️ Médio | ❄️ Baixo
  thermometerReasons: string[]
  dataSignalsUsed: {
    usesConfirmedSales: boolean
    usesBuyBox: boolean
    usesStock: boolean
    usesListingType: boolean
    usesRankingPosition: boolean
  }

  // Anúncios desse seller correspondentes ao produto
  ads: Array<{
    id: string
    title: string
    price: number
    stock: number
    soldQuantity: number | null
    isBuyBoxWinner: boolean
    listingTypeLabel: string
    permalink: string
    thumbnail: string
    catalogProductId?: string
    isKitOrBundle?: boolean
    isFamilyMatch?: boolean
    matchedFamilyName?: string
  }>
}

export interface CatalogPositionAggregate {
  catalogProductId: string
  title: string
  permalink: string
  thumbnail: string
  totalAdsCount: number
  totalAvailableStock: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  premiumListingsCount: number
  classicListingsCount: number
  distinctSellersCount: number
  distinctSellersList: string[]
  buyBoxWinner: {
    sellerNickname: string
    sellerId: string
    price: number
    stock: number | null
    listingTypeLabel: string
    isOwn: boolean
  } | null
  totalConfirmedSales: number
  hasExposedSales: boolean
  ads: Array<{
    id: string
    title: string
    price: number
    stock: number
    soldQuantity: number | null
    isBuyBoxWinner: boolean
    listingTypeLabel: string
    permalink: string
    thumbnail: string
    sellerNickname: string
    sellerId: string
    isOwnAccount: boolean
    isFamilyMatch?: boolean
    matchedFamilyName?: string
  }>
}

export interface ExactProductSummary {
  searchTerm: string
  scopeMode: RaioXScopeMode
  detectedBrain: ExactProductSearchMode
  activeBrain: ExactProductSearchMode
  accessoriesCount: number
  accessoriesPercent: number
  kitsExcludedCount: number
  totalRawPositions: number
  exactMatchedPositionsCount: number
  filteredOutCount: number
  uniqueSellersCount: number
  totalVisibleStock: number
  priceMin: number
  priceMax: number
  priceMedian: number
  priceAvg: number

  // Métricas Globais Adicionais
  totalActiveAds: number
  distribution: {
    premiumCount: number
    classicCount: number
    premiumPercent: number
    classicPercent: number
  }
  marketForceTier: 'strong' | 'moderate' | 'emerging'
  marketForceScore: number
  marketForceExplanation: string

  bestOpportunityMargin: {
    // Nova lógica de âncora e oportunidade de margem
    anchorPrice: number
    anchorSource: 'buy_box_leader' | 'confirmed_sales_median' | 'none'
    anchorSellerNickname: string
    suggestedEntryMin: number
    suggestedEntryMax: number
    suggestedPriceToWin: number
    marginAmountMin: number
    marginAmountMax: number
    marginPercentMin: number
    marginPercentMax: number
    opportunityScore: number // 0 - 100
    opportunityTier: 'high' | 'intense' | 'cold' // Oportunidade Alta | Disputa Intensa | Mercado Frio
    scoreComponents: {
      competitionScore: number // Poucos vendedores ativos no produto exato
      stockPressureScore: number // Estoque total visível baixo frente à demanda aparente
      marginSpaceScore: number // Âncora de preço com espaço de margem
      demandScore?: number // Pilar de demanda real quando há vendas coletadas (até 15 pts bônus)
    }
    explanation: string
    // Compatibilidade reversa opcional
    sellerNickname: string
    price: number
    leaderPrice: number
    marginDiffPercent: number
  } | null
  collectorSource?: {
    importId: string
    importedAt: string
    itemsCount: number
    withSalesCount: number
    collectorSource?: string
  } | null
  hasAnyConfirmedSales: boolean
  totalConfirmedSalesAcrossSellers: number
  sellersRanked: SellerPerformanceAggregate[]
  catalogPosition: CatalogPositionAggregate | null
  exactProducts: Array<{
    product: MLCatalogProduct
    scoreResult: ExactProductScoreResult
  }>
  allAds: Array<{
    id: string
    title: string
    price: number
    stock: number
    soldQuantity: number | null
    isBuyBoxWinner: boolean
    listingTypeLabel: string
    permalink: string
    thumbnail: string
    catalogProductId?: string
    sellerNickname: string
    isOwnAccount: boolean
    isKitOrBundle?: boolean
    isFamilyMatch?: boolean
    matchedFamilyName?: string
  }>
}

/**
 * Agrega produtos e concorrentes por SELLER calculando o termômetro de vendas honesto.
 */
export function aggregateSellersByExactProduct(
  rawProducts: MLCatalogProduct[],
  searchQuery: string,
  historicalSnapshots?: Array<{
    item_id: string
    seller_id?: string
    sold_quantity?: number
    snapshot_date: string
  }>,
  scopeMode: RaioXScopeMode = 'exact',
  manualBrain?: ExactProductSearchMode,
  overrides?: Record<string, 'include' | 'exclude'>,
  collectorSalesMap?: Map<string, number>,
  collectorMeta?: {
    importId: string
    importedAt: string
    itemsCount: number
    withSalesCount: number
    collectorSource?: string
  } | null,
): ExactProductSummary {
  const cleanQuery = searchQuery.trim()
  const detectedBrain = detectSearchMode(cleanQuery)
  const activeBrain = manualBrain || detectedBrain

  // Contagem de acessórios no universo total de resultados para o insight
  let rawAccessoriesCount = 0
  for (const prod of rawProducts) {
    if (isAccessoryTitle(prod.title || '', cleanQuery)) {
      rawAccessoriesCount++
    }
  }
  const accessoriesPercent =
    rawProducts.length > 0 ? Math.round((rawAccessoriesCount / rawProducts.length) * 100) : 0

  // 1. FILTRAR ITENS CONFORME O ESCOPO SELECIONADO
  const exactProducts: Array<{
    product: MLCatalogProduct
    scoreResult: ExactProductScoreResult
  }> = []

  let filteredOutCount = 0

  for (const prod of rawProducts) {
    const scoreResult = evaluateExactProductMatch(
      prod.title || '',
      cleanQuery,
      prod.attributes,
      activeBrain,
      prod.brand_value,
      prod.model_value,
    )

    const prodId = prod.id || prod.catalog_product_id || ''
    const override = overrides ? overrides[prodId] : undefined

    let include = false

    if (override === 'include') {
      // Forçado manualmente pelo usuário a vincular
      include = true
    } else if (override === 'exclude') {
      // Forçado manualmente pelo usuário a rejeitar/descartar
      include = false
    } else {
      // Heurística de ruído absoluto (miniaturas, bicicletas, brinquedos)
      const noise = detectCollectorNoiseAd(prod.title || '', cleanQuery)
      if (noise.isNoise) {
        include = false
      } else if (scopeMode === 'exact') {
        include = scoreResult.isExactMatch
      } else if (scopeMode === 'all_mentions') {
        // "Tudo que cita o termo" — sem filtro rígido de acessórios/componentes, mas sem ruído grotesco
        include = true
      } else if (scopeMode === 'own_only') {
        // "Só meus anúncios" — apenas posições mineradas da própria conta
        const isOwn = Boolean(
          prod.is_own_account ||
          (Array.isArray(prod.competitors) && prod.competitors.some((c) => c.is_own)),
        )
        include = isOwn
      }
    }

    if (include) {
      exactProducts.push({ product: prod, scoreResult })
    } else {
      filteredOutCount++
    }
  }

  // 2. MAPEAR E AGREGAR POR SELLER
  // Um produto de catálogo pode ter:
  // (a) buy_box_winner_seller_id / buy_box_winner_seller_nickname
  // (b) array de `competitors` (com múltiplos sellers listados disputando o mesmo produto)
  // (c) ser anúncio próprio da conta INFOPRECOBAIXO
  const sellersMap = new Map<string, SellerPerformanceAggregate>()

  function getOrCreateSeller(
    sellerId: string,
    nickname: string,
    isOwn: boolean,
  ): SellerPerformanceAggregate {
    const effectiveId = sellerId || (nickname ? `nick_${nickname.toLowerCase()}` : 'unknown_seller')
    const existing = sellersMap.get(effectiveId)
    if (existing) {
      if (
        nickname &&
        (!existing.sellerNickname || existing.sellerNickname.startsWith('Concorrente '))
      ) {
        existing.sellerNickname = nickname
      }
      if (isOwn) existing.isOwnAccount = true
      return existing
    }

    // Se o apelido não foi informado, tenta ler do cache em memória de sellers
    let resolvedNick = nickname
    if (
      !resolvedNick &&
      effectiveId &&
      !effectiveId.startsWith('nick_') &&
      effectiveId !== 'unknown_seller'
    ) {
      const cached = getCachedSellerNames()[effectiveId]
      if (cached) {
        resolvedNick = cached
      }
    }

    const isEffectivelyOwn = isOwn || isOwnSeller(effectiveId, resolvedNick)

    const newSeller: SellerPerformanceAggregate = {
      sellerId: effectiveId,
      sellerNickname:
        resolvedNick ||
        (isEffectivelyOwn
          ? 'INFOPRECOBAIXO (Sua Conta)'
          : effectiveId.startsWith('nick_') || effectiveId === 'unknown_seller'
            ? 'Vendedor Concorrente'
            : `Seller #${effectiveId}`),
      isOwnAccount: isEffectivelyOwn,
      totalAdsCount: 0,
      totalAvailableStock: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      buyBoxWinnersCount: 0,
      hasBuyBox: false,
      premiumListingsCount: 0,
      classicListingsCount: 0,
      hasRealSalesData: false,
      totalConfirmedSales: 0,
      estimatedSales60d: null,
      salesVelocityPerDay: null,
      historicalSnapshotsCount: 0,
      snapshotDeltaSales60d: null,
      thermometerScore: 0,
      thermometerTier: 'low',
      thermometerReasons: [],
      dataSignalsUsed: {
        usesConfirmedSales: false,
        usesBuyBox: false,
        usesStock: false,
        usesListingType: false,
        usesRankingPosition: false,
      },
      ads: [],
    }

    sellersMap.set(effectiveId, newSeller)
    return newSeller
  }

  // Preços coletados para estatísticas globais
  const allPrices: number[] = []

  // Mapa de histórico por item_id para deltas de 60 dias
  const itemSnapshotMap = new Map<string, Array<{ sold: number; date: string }>>()
  if (Array.isArray(historicalSnapshots)) {
    for (const snap of historicalSnapshots) {
      if (!snap.item_id) continue
      const list = itemSnapshotMap.get(snap.item_id) || []
      list.push({ sold: snap.sold_quantity || 0, date: snap.snapshot_date })
      itemSnapshotMap.set(snap.item_id, list)
    }
  }

  // Processar cada produto (separando kits/lotes das métricas de comparação)
  let kitsExcludedCount = 0

  exactProducts.forEach(({ product, scoreResult }) => {
    const isKit = isKitOrBundleTitle(product.title || '')
    const isFam = Boolean(scoreResult.isFamilyMatch)
    const famName = scoreResult.matchedFamilyName

    if (isKit) {
      kitsExcludedCount++
    }

    const winnerPrice = product.buy_box_winner_price || product.min_price || null
    // Só entra no cálculo de faixa de preço se NÃO for kit/lote
    if (!isKit && winnerPrice && winnerPrice > 0) {
      allPrices.push(winnerPrice)
    }

    // Se tiver concorrentes explícitos no produto (enriquecidos via /products/{id}/items)
    if (Array.isArray(product.competitors) && product.competitors.length > 0) {
      product.competitors.forEach((comp) => {
        // Se escopo for own_only e o comp não for own, pula
        if (scopeMode === 'own_only' && !comp.is_own && !product.is_own_account) {
          return
        }

        const isOwn = Boolean(comp.is_own || product.is_own_account)
        const sNick = comp.seller_nickname || (isOwn ? 'INFOPRECOBAIXO' : '')
        const seller = getOrCreateSeller(comp.seller_id || '', sNick, isOwn)

        const adPrice = comp.price || winnerPrice || 0
        const adStock = comp.available_quantity != null ? comp.available_quantity : 1

        // Priorizar contador real coletado do navegador se disponível para este MLB
        const compItemId = comp.item_id || ''
        const collectedSold = collectorSalesMap ? collectorSalesMap.get(compItemId) : undefined
        const adSold =
          collectedSold !== undefined
            ? collectedSold
            : comp.sold_quantity != null
              ? comp.sold_quantity
              : null

        seller.totalAdsCount++
        seller.totalAvailableStock += adStock

        // Kits/lotes NÃO afetam a faixa de preço nem o termômetro competitivo do seller
        if (!isKit && adPrice > 0) {
          if (seller.minPrice === 0 || adPrice < seller.minPrice) seller.minPrice = adPrice
          if (adPrice > seller.maxPrice) seller.maxPrice = adPrice
        }

        if (comp.is_buy_box_winner && !isKit) {
          seller.buyBoxWinnersCount++
          seller.hasBuyBox = true
        }

        if (comp.listing_type_id === 'gold_pro' || comp.listing_type_label === 'Premium') {
          seller.premiumListingsCount++
        } else {
          seller.classicListingsCount++
        }

        if (adSold != null && adSold > 0) {
          seller.hasRealSalesData = true
          seller.totalConfirmedSales += adSold
        }

        seller.ads.push({
          id: comp.item_id || product.catalog_product_id,
          title: product.title,
          price: adPrice,
          stock: adStock,
          soldQuantity: adSold,
          isBuyBoxWinner: Boolean(comp.is_buy_box_winner),
          listingTypeLabel: comp.listing_type_label || 'Clássico',
          permalink: product.permalink,
          thumbnail: product.thumbnail,
          catalogProductId: product.catalog_product_id,
          isKitOrBundle: isKit,
          isFamilyMatch: isFam,
          matchedFamilyName: famName,
        })
      })
    } else {
      // Fallback para quando só há o líder de Buy Box ou o próprio produto
      const isOwn = Boolean(product.is_own_account)
      // Se escopo for own_only e o produto não for own, pula
      if (scopeMode === 'own_only' && !isOwn) {
        return
      }

      const sId = product.buy_box_winner_seller_id || (isOwn ? '626774396' : '')
      const sNick =
        product.buy_box_winner_seller_nickname || (isOwn ? 'INFOPRECOBAIXO' : 'Vendedor Líder')
      const seller = getOrCreateSeller(sId, sNick, isOwn)

      const adPrice = winnerPrice || 0
      const adStock = product.buy_box_winner_stock != null ? product.buy_box_winner_stock : 1

      // Priorizar contador real coletado do navegador se disponível para este MLB
      const prodItemId = product.buy_box_winner_item_id || product.id || ''
      const collectedSold = collectorSalesMap ? collectorSalesMap.get(prodItemId) : undefined
      const adSold =
        collectedSold !== undefined
          ? collectedSold
          : product.sold_quantity != null
            ? product.sold_quantity
            : null

      seller.totalAdsCount++
      seller.totalAvailableStock += adStock

      // Kits/lotes NÃO afetam a faixa de preço nem o termômetro competitivo do seller
      if (!isKit && adPrice > 0) {
        if (seller.minPrice === 0 || adPrice < seller.minPrice) seller.minPrice = adPrice
        if (adPrice > seller.maxPrice) seller.maxPrice = adPrice
      }

      if (!isKit) {
        seller.buyBoxWinnersCount++
        seller.hasBuyBox = true
      }

      const isPremium =
        product.buy_box_winner_listing_type_label === 'Premium' ||
        product.buy_box_winner_listing_type === 'gold_pro'
      if (isPremium) {
        seller.premiumListingsCount++
      } else {
        seller.classicListingsCount++
      }

      if (adSold != null && adSold > 0) {
        seller.hasRealSalesData = true
        seller.totalConfirmedSales += adSold
      }

      seller.ads.push({
        id: product.buy_box_winner_item_id || product.catalog_product_id,
        title: product.title,
        price: adPrice,
        stock: adStock,
        soldQuantity: adSold,
        isBuyBoxWinner: true,
        listingTypeLabel: isPremium ? 'Premium' : 'Clássico',
        permalink: product.permalink,
        thumbnail: product.thumbnail,
        catalogProductId: product.catalog_product_id,
        isKitOrBundle: isKit,
        isFamilyMatch: isFam,
        matchedFamilyName: famName,
      })
    }
  })

  // 3. SEPARAÇÃO E IDENTIFICAÇÃO DA POSIÇÃO DE CATÁLOGO (PSEUDO-SELLER)
  // Quando produtos vêm da busca por catálogo ou /products/{id}/items sem que o seller individual
  // tenha sido enriquecido, ou agregam centenas de ofertas do produto em "Vendedor Líder" ou ID de catálogo,
  // esse pseudo-seller vencia indevidamente o ranking e inflava os números de seller real.
  let catalogPosition: CatalogPositionAggregate | null = null

  // Identificar se há um pseudo-seller de catálogo no mapa
  const allSellerKeys = Array.from(sellersMap.keys())
  let catalogPseudoSellerKey: string | null = null

  for (const sKey of allSellerKeys) {
    const s = sellersMap.get(sKey)!
    const nickLower = (s.sellerNickname || '').toLowerCase().trim()
    const idLower = (s.sellerId || '').toLowerCase().trim()

    const isCatalogPattern =
      nickLower === 'vendedor líder' ||
      nickLower === 'vendedor lider' ||
      nickLower === 'catálogo ml' ||
      nickLower === 'catalogo ml' ||
      nickLower === 'mercado livre catálogo' ||
      idLower.startsWith('mlb') ||
      idLower.startsWith('p/mlb') ||
      idLower === 'unknown_seller'

    // Critério 2: volume anômalo concentrado (>15 anúncios e mais de 40% do total de anúncios da pesquisa)
    const isAnomalousVolume =
      s.totalAdsCount >= 15 && s.totalAdsCount > exactProducts.length * 0.4 && !s.isOwnAccount

    if ((isCatalogPattern || isAnomalousVolume) && !s.isOwnAccount) {
      catalogPseudoSellerKey = sKey
      break
    }
  }

  // Se detectamos o pseudo-seller, extraímos para a estrutura dedicada de Posição de Catálogo
  // E também montamos uma visão agregada da posição de catálogo mesmo se não houver pseudo-seller individual,
  // caso tenhamos catalogProductId definido nos produtos exatos
  const representativeCatProd = exactProducts.find((p) => p.product.catalog_product_id)
  const catalogProductId =
    representativeCatProd?.product.catalog_product_id ||
    (catalogPseudoSellerKey?.startsWith('mlb') ? catalogPseudoSellerKey.toUpperCase() : '')

  if (catalogPseudoSellerKey) {
    const pseudoSeller = sellersMap.get(catalogPseudoSellerKey)!
    sellersMap.delete(catalogPseudoSellerKey) // REMOVER do ranking de sellers reais

    // Identificar vendedor Buy Box atual do catálogo
    const bbAd = pseudoSeller.ads.find((a) => a.isBuyBoxWinner) || pseudoSeller.ads[0]
    const otherSellersNicks = Array.from(
      new Set(
        Array.from(sellersMap.values())
          .map((s) => s.sellerNickname)
          .filter(Boolean),
      ),
    )

    catalogPosition = {
      catalogProductId: catalogProductId || pseudoSeller.ads[0]?.catalogProductId || 'CATALOGO_ML',
      title: representativeCatProd?.product.title || pseudoSeller.ads[0]?.title || cleanQuery,
      permalink:
        representativeCatProd?.product.permalink ||
        (catalogProductId ? `https://www.mercadolivre.com.br/p/${catalogProductId}` : ''),
      thumbnail: representativeCatProd?.product.thumbnail || pseudoSeller.ads[0]?.thumbnail || '',
      totalAdsCount: pseudoSeller.totalAdsCount,
      totalAvailableStock: pseudoSeller.totalAvailableStock,
      minPrice: pseudoSeller.minPrice,
      maxPrice: pseudoSeller.maxPrice,
      avgPrice: pseudoSeller.avgPrice || pseudoSeller.minPrice,
      premiumListingsCount: pseudoSeller.premiumListingsCount,
      classicListingsCount: pseudoSeller.classicListingsCount,
      distinctSellersCount: Math.max(1, otherSellersNicks.length),
      distinctSellersList: otherSellersNicks,
      buyBoxWinner: bbAd
        ? {
            sellerNickname:
              representativeCatProd?.product.buy_box_winner_seller_nickname || 'Vencedor Atual',
            sellerId: representativeCatProd?.product.buy_box_winner_seller_id || '',
            price: bbAd.price,
            stock: bbAd.stock,
            listingTypeLabel: bbAd.listingTypeLabel,
            isOwn: false,
          }
        : null,
      totalConfirmedSales: pseudoSeller.totalConfirmedSales,
      hasExposedSales: pseudoSeller.hasRealSalesData,
      ads: pseudoSeller.ads.map((a) => ({
        id: a.id,
        title: a.title,
        price: a.price,
        stock: a.stock,
        soldQuantity: a.soldQuantity,
        isBuyBoxWinner: a.isBuyBoxWinner,
        listingTypeLabel: a.listingTypeLabel,
        permalink: a.permalink,
        thumbnail: a.thumbnail,
        sellerNickname:
          representativeCatProd?.product.buy_box_winner_seller_nickname || 'Oferta de Catálogo',
        sellerId: representativeCatProd?.product.buy_box_winner_seller_id || '',
        isOwnAccount: false,
        isFamilyMatch: a.isFamilyMatch,
        matchedFamilyName: a.matchedFamilyName,
      })),
    }
  } else if (representativeCatProd && exactProducts.length >= 2) {
    // Mesmo sem o pseudo-seller, se o produto tem catalog_product_id no ML, sintetizamos a posição
    const catAds = exactProducts.map((ep) => ep.product)
    const distinctSellers = Array.from(
      new Set(Array.from(sellersMap.values()).map((s) => s.sellerNickname)),
    )
    const winnerProd =
      catAds.find(
        (p) =>
          p.buy_box_winner_seller_nickname ||
          (p.buy_box_winner_price && p.buy_box_winner_price > 0),
      ) || catAds[0]

    const totalStock = catAds.reduce((acc, p) => acc + (p.buy_box_winner_stock || 1), 0)
    const prices = catAds
      .map((p) =>
        p.buy_box_winner_price && p.buy_box_winner_price > 0
          ? p.buy_box_winner_price
          : p.min_price && p.min_price > 0
            ? p.min_price
            : 0,
      )
      .filter((p) => p > 0)
    const minP = prices.length > 0 ? Math.min(...prices) : 0
    const maxP = prices.length > 0 ? Math.max(...prices) : 0
    const avgP =
      prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
    const confirmedSalesSum = catAds.reduce((acc, p) => acc + (p.sold_quantity || 0), 0)

    catalogPosition = {
      catalogProductId: representativeCatProd.product.catalog_product_id || '',
      title: representativeCatProd.product.title || cleanQuery,
      permalink:
        representativeCatProd.product.permalink ||
        `https://www.mercadolivre.com.br/p/${representativeCatProd.product.catalog_product_id}`,
      thumbnail: representativeCatProd.product.thumbnail || '',
      totalAdsCount: catAds.length,
      totalAvailableStock: totalStock,
      minPrice: minP,
      maxPrice: maxP,
      avgPrice: avgP,
      premiumListingsCount: catAds.filter((p) => p.buy_box_winner_listing_type_label === 'Premium')
        .length,
      classicListingsCount: catAds.filter((p) => p.buy_box_winner_listing_type_label !== 'Premium')
        .length,
      distinctSellersCount: Math.max(1, distinctSellers.length),
      distinctSellersList: distinctSellers,
      buyBoxWinner: winnerProd
        ? {
            sellerNickname: winnerProd.buy_box_winner_seller_nickname || 'Líder da Buy Box',
            sellerId: winnerProd.buy_box_winner_seller_id || '',
            price:
              winnerProd.buy_box_winner_price ||
              (winnerProd.min_price && winnerProd.min_price > 0 ? winnerProd.min_price : 0),
            stock: winnerProd.buy_box_winner_stock != null ? winnerProd.buy_box_winner_stock : null,
            listingTypeLabel: winnerProd.buy_box_winner_listing_type_label || 'Clássico',
            isOwn: Boolean(winnerProd.is_own_account),
          }
        : null,
      totalConfirmedSales: confirmedSalesSum,
      hasExposedSales: confirmedSalesSum > 0,
      ads: catAds.map((p) => ({
        id: p.id || p.catalog_product_id,
        title: p.title,
        price: p.buy_box_winner_price || (p.min_price && p.min_price > 0 ? p.min_price : 0),
        stock: p.buy_box_winner_stock != null ? p.buy_box_winner_stock : 1,
        soldQuantity: p.sold_quantity != null ? p.sold_quantity : null,
        isBuyBoxWinner: Boolean(p.buy_box_winner_seller_nickname),
        listingTypeLabel: p.buy_box_winner_listing_type_label || 'Clássico',
        permalink: p.permalink,
        thumbnail: p.thumbnail,
        sellerNickname: p.buy_box_winner_seller_nickname || 'Vendedor ML',
        sellerId: p.buy_box_winner_seller_id || '',
        isOwnAccount: Boolean(p.is_own_account),
      })),
    }
  }

  // 3b. CALCULAR MÉTRICAS DE VENDAS E TERMÔMETRO DE FORÇA/GIRO (0 a 100) NOS SELLERS REAIS
  const sellersList = Array.from(sellersMap.values())

  sellersList.forEach((seller) => {
    // Calcula média de preços ignorando kits/lotes
    const standaloneAds = seller.ads.filter((a) => !a.isKitOrBundle)
    if (standaloneAds.length > 0) {
      const sumPrices = standaloneAds.reduce((acc, a) => acc + (a.price || 0), 0)
      seller.avgPrice = Math.round(sumPrices / standaloneAds.length)
    } else if (seller.totalAdsCount > 0) {
      const sumPrices = seller.ads.reduce((acc, a) => acc + (a.price || 0), 0)
      seller.avgPrice = Math.round(sumPrices / seller.totalAdsCount)
    }

    // Conferir se há deltas históricos de 60 dias
    let snapshotDeltaTotal = 0
    let hasSnapshotHistory = false
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000

    seller.ads.forEach((ad) => {
      const snaps = itemSnapshotMap.get(ad.id)
      if (snaps && snaps.length > 1) {
        snaps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const oldestInRange =
          snaps.find((s) => new Date(s.date).getTime() >= sixtyDaysAgo) || snaps[0]
        const newest = snaps[snaps.length - 1]
        const delta = Math.max(0, newest.sold - oldestInRange.sold)
        snapshotDeltaTotal += delta
        hasSnapshotHistory = true
        seller.historicalSnapshotsCount += snaps.length
      }
    })

    if (hasSnapshotHistory) {
      seller.snapshotDeltaSales60d = snapshotDeltaTotal
    }

    // CÁLCULO HONESTO DO TERMÔMETRO DE VENDAS (0 a 100)
    let score = 0
    const reasons: string[] = []

    // PILAR A: Vendas Reais Confirmadas (quando destravadas da API, conta própria ou histórico)
    if (seller.hasRealSalesData && seller.totalConfirmedSales > 0) {
      seller.dataSignalsUsed.usesConfirmedSales = true
      // Estimativa em janela de 60 dias:
      // Se tiver delta real por snapshot, usa o delta real.
      // Caso contrário, estima com base nas vendas declaradas e número de anúncios
      if (seller.snapshotDeltaSales60d != null) {
        seller.estimatedSales60d = seller.snapshotDeltaSales60d
        reasons.push(
          `${seller.snapshotDeltaSales60d} vendas reais nos últimos 60 dias (histórico auditado)`,
        )
      } else {
        // Heurística de velocidade: vendas totais ponderadas
        const est60 = Math.max(
          1,
          Math.min(seller.totalConfirmedSales, Math.round(seller.totalConfirmedSales * 0.4)),
        )
        seller.estimatedSales60d = est60
        seller.salesVelocityPerDay = Number((est60 / 60).toFixed(2))
        reasons.push(
          `${seller.totalConfirmedSales} vendas confirmadas no anúncio (~${est60} est. em 60 dias)`,
        )
      }

      // Pontua de 30 a 60 pontos pelo volume de vendas
      const salesPoints = Math.min(
        60,
        25 + Math.floor(Math.log10(seller.totalConfirmedSales + 1) * 20),
      )
      score += salesPoints
    } else {
      reasons.push('Vendas diretas não expostas pelo ML (usando sinais de força auditáveis)')
    }

    // PILAR B: Posse de Buy Box (sinal direto de que o seller está capturando os cliques de compra do catálogo)
    if (seller.hasBuyBox) {
      seller.dataSignalsUsed.usesBuyBox = true
      score += 25
      reasons.push(
        `Detém a Buy Box oficial (${seller.buyBoxWinnersCount} anúncio(s) ganhando o botão de comprar)`,
      )
    }

    // PILAR C: Estoque Ativo e Volume de Anúncios
    if (seller.totalAvailableStock > 0) {
      seller.dataSignalsUsed.usesStock = true
      if (seller.totalAvailableStock >= 10) {
        score += 15
        reasons.push(`Estoque profundo (${seller.totalAvailableStock} un. disponíveis)`)
      } else {
        score += 8
        reasons.push(`Estoque visível (${seller.totalAvailableStock} un.)`)
      }
    }

    // PILAR D: Tipo de Anúncio (Premium vs Clássico)
    if (seller.premiumListingsCount > 0) {
      seller.dataSignalsUsed.usesListingType = true
      score += 10
      reasons.push(`Anúncios Premium com parcelamento sem juros ativo`)
    } else if (seller.classicListingsCount > 0) {
      seller.dataSignalsUsed.usesListingType = true
      score += 5
    }

    // PILAR E: Diversidade de posições do mesmo produto exato
    if (seller.totalAdsCount >= 2) {
      score += 5
      reasons.push(`Multi-anúncios do produto (${seller.totalAdsCount} posições ativas)`)
    }

    // Limitar entre 5 e 100
    seller.thermometerScore = Math.min(100, Math.max(5, score))

    // Classificação
    if (seller.thermometerScore >= 65) {
      seller.thermometerTier = 'high'
    } else if (seller.thermometerScore >= 35) {
      seller.thermometerTier = 'medium'
    } else {
      seller.thermometerTier = 'low'
    }

    seller.thermometerReasons = reasons
  })

  // Ordenar sellers pelo termômetro (maior força/giro primeiro)
  sellersList.sort((a, b) => {
    if (b.thermometerScore !== a.thermometerScore) {
      return b.thermometerScore - a.thermometerScore
    }
    return b.totalAvailableStock - a.totalAvailableStock
  })

  // 4. CONSOLIDAÇÃO GLOBAL DE TODOS OS ANÚNCIOS DO PRODUTO EXATO
  // Anúncios avulsos primeiro, e anúncios de kits/lotes separados no fim
  const standaloneAdsList: ExactProductSummary['allAds'] = []
  const kitAdsList: ExactProductSummary['allAds'] = []
  let globalPremiumCount = 0
  let globalClassicCount = 0

  sellersList.forEach((s) => {
    s.ads.forEach((a) => {
      if (a.listingTypeLabel === 'Premium') {
        globalPremiumCount++
      } else {
        globalClassicCount++
      }

      const fullAdItem = {
        ...a,
        sellerNickname: s.sellerNickname,
        isOwnAccount: s.isOwnAccount,
      }

      if (a.isKitOrBundle) {
        kitAdsList.push(fullAdItem)
      } else {
        standaloneAdsList.push(fullAdItem)
      }
    })
  })

  // allAds reúne avulsos primeiro, seguidos pelos kits/lotes
  const allAds: ExactProductSummary['allAds'] = [...standaloneAdsList, ...kitAdsList]

  // Se allPrices estiver vazio (por exemplo, todos eram kits), faz fallback seguro
  const pricesToAnalyze =
    allPrices.length > 0 ? allPrices : allAds.filter((a) => a.price > 0).map((a) => a.price)

  pricesToAnalyze.sort((a, b) => a - b)
  const priceMin = pricesToAnalyze.length > 0 ? pricesToAnalyze[0] : 0
  const priceMax = pricesToAnalyze.length > 0 ? pricesToAnalyze[pricesToAnalyze.length - 1] : 0
  const priceAvg =
    pricesToAnalyze.length > 0
      ? Math.round(pricesToAnalyze.reduce((acc, v) => acc + v, 0) / pricesToAnalyze.length)
      : 0
  const priceMedian =
    pricesToAnalyze.length > 0
      ? pricesToAnalyze.length % 2 === 0
        ? Math.round(
            (pricesToAnalyze[pricesToAnalyze.length / 2 - 1] +
              pricesToAnalyze[pricesToAnalyze.length / 2]) /
              2,
          )
        : Math.round(pricesToAnalyze[Math.floor(pricesToAnalyze.length / 2)])
      : 0

  const totalActiveAds = allAds.length > 0 ? allAds.length : exactProducts.length
  const totalAdsSum = globalPremiumCount + globalClassicCount
  const premiumPercent = totalAdsSum > 0 ? Math.round((globalPremiumCount / totalAdsSum) * 100) : 0
  const classicPercent = totalAdsSum > 0 ? 100 - premiumPercent : 0

  const totalVisibleStock = sellersList.reduce((acc, s) => acc + s.totalAvailableStock, 0)
  const totalConfirmedSalesAcrossSellers = sellersList.reduce(
    (acc, s) => acc + s.totalConfirmedSales,
    0,
  )
  const hasAnyConfirmedSales = totalConfirmedSalesAcrossSellers > 0

  // Força de Mercado do Produto Global (0 a 100)
  // Avalia o produto no ecossistema: volume de anúncios, disputa de sellers, liquidez e estoque
  let forceScore = 0
  if (totalActiveAds >= 30) forceScore += 30
  else if (totalActiveAds >= 15) forceScore += 22
  else if (totalActiveAds >= 5) forceScore += 15
  else forceScore += 8

  if (sellersList.length >= 8) forceScore += 25
  else if (sellersList.length >= 4) forceScore += 18
  else if (sellersList.length >= 2) forceScore += 12
  else forceScore += 5

  if (totalVisibleStock >= 50) forceScore += 25
  else if (totalVisibleStock >= 15) forceScore += 18
  else if (totalVisibleStock >= 5) forceScore += 10
  else forceScore += 5

  if (hasAnyConfirmedSales && totalConfirmedSalesAcrossSellers >= 100) forceScore += 20
  else if (hasAnyConfirmedSales && totalConfirmedSalesAcrossSellers >= 20) forceScore += 14
  else if (premiumPercent >= 20) forceScore += 10
  else forceScore += 5

  forceScore = Math.min(100, Math.max(10, forceScore))

  let marketForceTier: 'strong' | 'moderate' | 'emerging' = 'moderate'
  let marketForceExplanation = ''
  if (forceScore >= 70) {
    marketForceTier = 'strong'
    marketForceExplanation = 'Alta liquidez e demanda estabelecida no Mercado Livre'
  } else if (forceScore >= 40) {
    marketForceTier = 'moderate'
    marketForceExplanation = 'Demanda estável e concorrência ativa moderada'
  } else {
    marketForceTier = 'emerging'
    marketForceExplanation = 'Nicho pontual ou produto com pouca oferta concorrente'
  }

  // =========================================================================
  // NOVA LÓGICA DE OPORTUNIDADE DE MARGEM & ÂNCORA DE PREÇO (REVERSÃO DE REGRA)
  // Regra de Ouro do Usuário:
  // "Oportunidade = produto com pouca concorrência que abre espaço para vender
  // com a melhor margem — e o que vende é o que tem relevância."
  //
  // 1. Âncora de Preço = preço de quem VENDE (não o menor preço/piso):
  //    - Prioridade 1: Preço do líder da Buy Box
  //    - Prioridade 2 (fallback): Mediana dos anúncios com vendas confirmadas (sold_quantity > 0)
  //    - Anúncios sem venda confirmada NUNCA servem de referência
  //    - Kits/lotes continuam 100% fora dos cálculos
  //
  // 2. Margem medida contra a âncora:
  //    - Faixa de entrada sugerida logo ABAIXO da âncora (ex.: âncora R$ 325 → R$ 300 - R$ 315)
  //    - NUNCA no piso (menor preço do mercado).
  //    - Preço to win: logo abaixo do líder/âncora (ex.: 2% a 5% abaixo, ou R$ 10 a menos).
  //
  // 3. Baixa concorrência = multiplicador de margem, não de desconto:
  //    - Poucos sellers/estoque ralo = espaço de preço livre (você não precisa cortar preço)
  //    - Score de oportunidade (0 - 100):
  //       (a) Concorrência: poucos sellers ativos no produto exato (até 35 pts)
  //       (b) Estoque: estoque ralo/baixo visível (até 35 pts)
  //       (c) Âncora/Margem: preço da âncora sólido e saudável (até 30 pts)
  //    - Classificação: "Oportunidade Alta" | "Disputa Intensa" | "Mercado Frio"
  // =========================================================================
  let bestOpportunityMargin: ExactProductSummary['bestOpportunityMargin'] = null

  // Identificar Prioridade 1: Preço do líder da Buy Box no produto exato (sem kits)
  let anchorPrice = 0
  let anchorSource: 'buy_box_leader' | 'confirmed_sales_median' | 'none' = 'none'
  let anchorSellerNickname = ''

  // Buscar anúncio com Buy Box winner confirmado
  const buyBoxAd = standaloneAdsList.find((a) => a.isBuyBoxWinner && a.price > 0)
  if (buyBoxAd) {
    anchorPrice = buyBoxAd.price
    anchorSource = 'buy_box_leader'
    anchorSellerNickname = buyBoxAd.sellerNickname || 'Líder da Buy Box'
  } else if (
    catalogPosition &&
    catalogPosition.buyBoxWinner &&
    catalogPosition.buyBoxWinner.price > 0
  ) {
    anchorPrice = catalogPosition.buyBoxWinner.price
    anchorSource = 'buy_box_leader'
    anchorSellerNickname = catalogPosition.buyBoxWinner.sellerNickname || 'Líder do Catálogo'
  }

  // Se não achou Buy Box Leader válido, Prioridade 2 (fallback):
  // Mediana dos preços dos anúncios do produto exato com vendas confirmadas (sold_quantity > 0)
  if (anchorPrice <= 0) {
    const soldAdsPrices = standaloneAdsList
      .filter((a) => a.soldQuantity != null && a.soldQuantity > 0 && a.price > 0)
      .map((a) => a.price)
      .sort((a, b) => a - b)

    if (soldAdsPrices.length > 0) {
      const mid = Math.floor(soldAdsPrices.length / 2)
      anchorPrice =
        soldAdsPrices.length % 2 === 0
          ? Math.round((soldAdsPrices[mid - 1] + soldAdsPrices[mid]) / 2)
          : soldAdsPrices[mid]
      anchorSource = 'confirmed_sales_median'
      anchorSellerNickname = `${soldAdsPrices.length} anúncio(s) com vendas confirmadas`
    }
  }

  // Fallback de emergência seguro se não houver Buy Box nem vendas confirmadas expostas
  if (anchorPrice <= 0) {
    // Se o primeiro seller do ranking tem minPrice > 0
    if (sellersList.length > 0 && sellersList[0].avgPrice > 0) {
      anchorPrice = sellersList[0].avgPrice
      anchorSource = 'buy_box_leader'
      anchorSellerNickname = sellersList[0].sellerNickname
    } else if (priceMedian > 0) {
      anchorPrice = priceMedian
      anchorSource = 'confirmed_sales_median'
      anchorSellerNickname = 'Mediana do mercado'
    }
  }

  if (anchorPrice > 0) {
    // 2. FAIXA DE ENTRADA SUGERIDA LOGO ABAIXO DA ÂNCORA (NUNCA NO PISO)
    // Se a concorrência for baixa (1 a 2 sellers), margem de entrada pode ser ainda mais colada (3% a 7% abaixo).
    // Se a concorrência for média/alta (3+ sellers), entrada entre 5% e 12% abaixo da âncora.
    const sellerCount = sellersList.length
    let discountMinPct = 0.04 // 4% abaixo do líder (teto da faixa)
    let discountMaxPct = 0.09 // 9% abaixo do líder (piso da faixa)

    if (sellerCount <= 2) {
      // Pouca concorrência = "espaço de preço livre", não precisa dar desconto grande
      discountMinPct = 0.02 // ~2% a 3% abaixo
      discountMaxPct = 0.06 // até 6%
    } else if (sellerCount >= 6) {
      // Disputa intensa
      discountMinPct = 0.05
      discountMaxPct = 0.12
    }

    // Calcular valores monetários
    // suggestedEntryMax = mais perto da âncora (ex: âncora R$ 325 -> R$ 315)
    // suggestedEntryMin = piso saudável de entrada (ex: âncora R$ 325 -> R$ 300)
    let suggestedEntryMax = Math.round(anchorPrice * (1 - discountMinPct))
    let suggestedEntryMin = Math.round(anchorPrice * (1 - discountMaxPct))

    // Se a faixa colapsar por arredondamento em preços baixos, garantir degrau mínimo de R$ 1 a R$ 5
    if (suggestedEntryMax >= anchorPrice) {
      suggestedEntryMax = Math.max(1, anchorPrice - (anchorPrice > 50 ? 5 : 1))
    }
    if (suggestedEntryMin >= suggestedEntryMax) {
      suggestedEntryMin = Math.max(1, suggestedEntryMax - (anchorPrice > 50 ? 10 : 2))
    }

    // Preço sugerido para vencer Buy Box (price_to_win inteligente):
    // Entra logo abaixo do líder, ex: R$ 1 ou ~2% a 3% abaixo da âncora
    const suggestedPriceToWin = suggestedEntryMax

    // Margem calculada contra a âncora:
    const marginAmountMin = anchorPrice - suggestedEntryMax // Margem na entrada mais alta
    const marginAmountMax = anchorPrice - suggestedEntryMin // Margem na entrada mais competitiva
    const marginPercentMin = Math.round((marginAmountMin / anchorPrice) * 100)
    const marginPercentMax = Math.round((marginAmountMax / anchorPrice) * 100)

    // 3. SCORE DE OPORTUNIDADE (0 a 100) E COMPONENTES
    // "Oportunidade = produto com pouca concorrência que abre espaço para vender com a melhor margem"
    //
    // Componente A: Concorrência fraca / poucos vendedores no produto exato (máx 35 pts)
    let competitionScore = 0
    if (sellerCount <= 1)
      competitionScore = 35 // Monopólio / oportunidade máxima
    else if (sellerCount === 2) competitionScore = 30
    else if (sellerCount === 3) competitionScore = 24
    else if (sellerCount <= 5) competitionScore = 16
    else if (sellerCount <= 8) competitionScore = 10
    else competitionScore = 4 // Muitos sellers disputando

    // Componente B: Estoque total visível baixo frente à demanda aparente (máx 35 pts)
    let stockPressureScore = 0
    if (totalVisibleStock <= 3)
      stockPressureScore = 35 // Estoque ralo = teto livre
    else if (totalVisibleStock <= 7) stockPressureScore = 30
    else if (totalVisibleStock <= 15) stockPressureScore = 23
    else if (totalVisibleStock <= 30) stockPressureScore = 15
    else if (totalVisibleStock <= 60) stockPressureScore = 8
    else stockPressureScore = 3 // Estoque massivo de terceiros

    // Componente C: Âncora de preço com espaço de margem e liquidez (máx 30 pts)
    let marginSpaceScore = 0
    // Se o preço da âncora for saudável (peça/notebook com ticket > R$ 100 e sem guerra suicida no piso)
    if (anchorPrice >= 200) marginSpaceScore += 18
    else if (anchorPrice >= 100) marginSpaceScore += 14
    else if (anchorPrice >= 50) marginSpaceScore += 10
    else marginSpaceScore += 5

    // Se temos vendas confirmadas auditadas ou Buy Box real, âncora é sólida (+12 pts)
    if (anchorSource === 'buy_box_leader') {
      marginSpaceScore += 12
    } else if (hasAnyConfirmedSales) {
      marginSpaceScore += 10
    } else {
      marginSpaceScore += 4
    }
    marginSpaceScore = Math.min(30, marginSpaceScore)

    // Componente D (Bônus de Demanda Real do Coletor):
    // Quando temos vendas reais coletadas pelo Coletor do Navegador
    let demandScore = 0
    if (collectorMeta && totalConfirmedSalesAcrossSellers > 0) {
      if (totalConfirmedSalesAcrossSellers >= 100) demandScore = 15
      else if (totalConfirmedSalesAcrossSellers >= 25) demandScore = 10
      else demandScore = 6
    }

    const opportunityScore = Math.min(
      100,
      Math.max(5, competitionScore + stockPressureScore + marginSpaceScore + demandScore),
    )

    // Classificação
    let opportunityTier: 'high' | 'intense' | 'cold' = 'high'
    if (opportunityScore >= 70 && (sellerCount <= 3 || totalVisibleStock <= 15)) {
      opportunityTier = 'high' // "Oportunidade Alta" (concorrência fraca + âncora firme)
    } else if (sellerCount >= 6 || totalVisibleStock >= 50) {
      opportunityTier = 'intense' // "Disputa Intensa" (muitos sellers/estoque alto)
    } else if (!hasAnyConfirmedSales && totalVisibleStock > 30) {
      opportunityTier = 'cold' // "Mercado Frio" (poucos sinais de venda)
    } else if (opportunityScore < 45) {
      opportunityTier = 'cold'
    } else {
      opportunityTier = 'high'
    }

    // Explicação executiva transparente
    let explanation = ''
    const anchorFormatted = anchorPrice.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    const entryMinFormatted = suggestedEntryMin.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    const entryMaxFormatted = suggestedEntryMax.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

    if (sellerCount <= 2) {
      explanation = `Baixa concorrência (${sellerCount} ${sellerCount === 1 ? 'seller' : 'sellers'}) e estoque ralo (${totalVisibleStock} un.). Não é necessário queimar preço: o teto prático é logo abaixo do líder. Entrando em ${entryMinFormatted}–${entryMaxFormatted}, você captura a Buy Box com margem preservada.`
    } else if (opportunityTier === 'intense') {
      explanation = `Disputa acirrada (${sellerCount} sellers com ${totalVisibleStock} un. em estoque). A âncora de mercado é ${anchorFormatted}. Entre na faixa de ${entryMinFormatted}–${entryMaxFormatted} sem descer ao piso para não matar a margem.`
    } else if (opportunityTier === 'cold') {
      explanation = `Mercado com poucos sinais de liquidez recente. A âncora identificada de quem vende é ${anchorFormatted}. Sugestão de entrada em ${entryMinFormatted}–${entryMaxFormatted} com atenção ao giro.`
    } else {
      explanation = `O mercado paga ${anchorFormatted} no anúncio de referência (${anchorSellerNickname}). Entrada saudável recomendada em ${entryMinFormatted}–${entryMaxFormatted}, garantindo margem de ${marginPercentMin}% a ${marginPercentMax}% sem cair em preços de anúncios sem relevância.`
    }

    bestOpportunityMargin = {
      anchorPrice,
      anchorSource,
      anchorSellerNickname,
      suggestedEntryMin,
      suggestedEntryMax,
      suggestedPriceToWin,
      marginAmountMin,
      marginAmountMax,
      marginPercentMin,
      marginPercentMax,
      opportunityScore,
      opportunityTier,
      scoreComponents: {
        competitionScore,
        stockPressureScore,
        marginSpaceScore,
        ...(collectorMeta ? { demandScore } : {}),
      },
      explanation,
      // Retrocompatibilidade
      sellerNickname: anchorSellerNickname,
      price: suggestedEntryMin,
      leaderPrice: anchorPrice,
      marginDiffPercent: marginPercentMax,
    }
  }

  return {
    searchTerm: cleanQuery,
    scopeMode,
    detectedBrain,
    activeBrain,
    accessoriesCount: rawAccessoriesCount,
    accessoriesPercent,
    kitsExcludedCount,
    totalRawPositions: rawProducts.length,
    exactMatchedPositionsCount: exactProducts.length,
    filteredOutCount,
    uniqueSellersCount: sellersList.length,
    totalVisibleStock,
    priceMin,
    priceMax,
    priceMedian,
    priceAvg,
    totalActiveAds,
    distribution: {
      premiumCount: globalPremiumCount,
      classicCount: globalClassicCount,
      premiumPercent,
      classicPercent,
    },
    marketForceTier,
    marketForceScore: forceScore,
    marketForceExplanation,
    bestOpportunityMargin,
    collectorSource: collectorMeta || null,
    hasAnyConfirmedSales,
    totalConfirmedSalesAcrossSellers,
    sellersRanked: sellersList,
    catalogPosition,
    exactProducts,
    allAds,
  }
}

/**
 * Registra snapshots periódicos de anúncios no banco para acumular histórico real de 60 dias.
 */
export async function recordAdSnapshots(
  summary: ExactProductSummary,
): Promise<{ savedCount: number; errorsCount: number }> {
  let savedCount = 0
  let errorsCount = 0
  const todayIso = new Date().toISOString().substring(0, 10)

  for (const seller of summary.sellersRanked) {
    for (const ad of seller.ads) {
      if (!ad.id) continue
      try {
        await pb.collection('ml_ad_snapshots').create({
          item_id: ad.id,
          catalog_product_id: ad.catalogProductId || null,
          seller_id: seller.sellerId || null,
          seller_nickname: seller.sellerNickname || null,
          title: ad.title || '',
          price: ad.price || null,
          available_quantity: ad.stock != null ? ad.stock : null,
          sold_quantity: ad.soldQuantity != null ? ad.soldQuantity : null,
          listing_type: ad.listingTypeLabel || null,
          is_buy_box_winner: ad.isBuyBoxWinner,
          snapshot_date: todayIso,
        })
        savedCount++
      } catch (err) {
        errorsCount++
      }
    }
  }

  // Também grava anúncios da posição de catálogo se houver
  if (summary.catalogPosition && Array.isArray(summary.catalogPosition.ads)) {
    for (const ad of summary.catalogPosition.ads) {
      if (!ad.id) continue
      try {
        await pb.collection('ml_ad_snapshots').create({
          item_id: ad.id,
          catalog_product_id: summary.catalogPosition.catalogProductId || null,
          seller_id: ad.sellerId || null,
          seller_nickname: ad.sellerNickname || null,
          title: ad.title || '',
          price: ad.price || null,
          available_quantity: ad.stock != null ? ad.stock : null,
          sold_quantity: ad.soldQuantity != null ? ad.soldQuantity : null,
          listing_type: ad.listingTypeLabel || null,
          is_buy_box_winner: ad.isBuyBoxWinner,
          snapshot_date: todayIso,
        })
        savedCount++
      } catch (err) {
        errorsCount++
      }
    }
  }

  return { savedCount, errorsCount }
}
