import pb from '@/lib/pocketbase/client'
import { type MLCatalogProduct, type MLCatalogCompetitor } from '@/services/mlCatalogService'
import { evaluateExactProductMatch, type ExactProductScoreResult } from '@/lib/catalogFilter'

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
  }>
}

export interface ExactProductSummary {
  searchTerm: string
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
    sellerNickname: string
    price: number
    leaderPrice: number
    marginDiffPercent: number
    explanation: string
  } | null
  hasAnyConfirmedSales: boolean
  totalConfirmedSalesAcrossSellers: number
  sellersRanked: SellerPerformanceAggregate[]
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
): ExactProductSummary {
  const cleanQuery = searchQuery.trim()

  // 1. FILTRAR POR PRODUTO EXATO
  const exactProducts: Array<{
    product: MLCatalogProduct
    scoreResult: ExactProductScoreResult
  }> = []

  let filteredOutCount = 0

  for (const prod of rawProducts) {
    const scoreResult = evaluateExactProductMatch(prod.title || '', cleanQuery, prod.attributes)

    if (scoreResult.isExactMatch) {
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

    const newSeller: SellerPerformanceAggregate = {
      sellerId: effectiveId,
      sellerNickname:
        nickname || (isOwn ? 'INFOPRECOBAIXO (Sua Conta)' : `Vendedor ${effectiveId}`),
      isOwnAccount: isOwn,
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

  // Processar cada produto exato
  exactProducts.forEach(({ product }, productIndex) => {
    const winnerPrice = product.buy_box_winner_price || product.min_price || null
    if (winnerPrice && winnerPrice > 0) {
      allPrices.push(winnerPrice)
    }

    // Se tiver concorrentes explícitos no produto (enriquecidos via /products/{id}/items)
    if (Array.isArray(product.competitors) && product.competitors.length > 0) {
      product.competitors.forEach((comp) => {
        const isOwn = Boolean(comp.is_own || product.is_own_account)
        const sNick = comp.seller_nickname || (isOwn ? 'INFOPRECOBAIXO' : '')
        const seller = getOrCreateSeller(comp.seller_id || '', sNick, isOwn)

        const adPrice = comp.price || winnerPrice || 0
        const adStock = comp.available_quantity != null ? comp.available_quantity : 1
        const adSold = comp.sold_quantity != null ? comp.sold_quantity : null

        seller.totalAdsCount++
        seller.totalAvailableStock += adStock
        if (adPrice > 0) {
          if (seller.minPrice === 0 || adPrice < seller.minPrice) seller.minPrice = adPrice
          if (adPrice > seller.maxPrice) seller.maxPrice = adPrice
        }

        if (comp.is_buy_box_winner) {
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
        })
      })
    } else {
      // Fallback para quando só há o líder de Buy Box ou o próprio produto
      const isOwn = Boolean(product.is_own_account)
      const sId = product.buy_box_winner_seller_id || (isOwn ? '626774396' : '')
      const sNick =
        product.buy_box_winner_seller_nickname || (isOwn ? 'INFOPRECOBAIXO' : 'Vendedor Líder')
      const seller = getOrCreateSeller(sId, sNick, isOwn)

      const adPrice = winnerPrice || 0
      const adStock = product.buy_box_winner_stock != null ? product.buy_box_winner_stock : 1
      const adSold = product.sold_quantity != null ? product.sold_quantity : null

      seller.totalAdsCount++
      seller.totalAvailableStock += adStock
      if (adPrice > 0) {
        if (seller.minPrice === 0 || adPrice < seller.minPrice) seller.minPrice = adPrice
        if (adPrice > seller.maxPrice) seller.maxPrice = adPrice
      }

      seller.buyBoxWinnersCount++
      seller.hasBuyBox = true

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
      })
    }
  })

  // 3. CALCULAR MÉTRICAS DE VENDAS E TERMÔMETRO DE FORÇA/GIRO (0 a 100)
  const sellersList = Array.from(sellersMap.values())

  sellersList.forEach((seller) => {
    if (seller.totalAdsCount > 0) {
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
  const allAds: ExactProductSummary['allAds'] = []
  let globalPremiumCount = 0
  let globalClassicCount = 0

  sellersList.forEach((s) => {
    s.ads.forEach((a) => {
      if (a.listingTypeLabel === 'Premium') {
        globalPremiumCount++
      } else {
        globalClassicCount++
      }
      allAds.push({
        ...a,
        sellerNickname: s.sellerNickname,
        isOwnAccount: s.isOwnAccount,
      })
    })
  })

  // Se não foi coletado preço individual em allPrices, popula a partir de allAds
  if (allPrices.length === 0) {
    allAds.forEach((a) => {
      if (a.price > 0) allPrices.push(a.price)
    })
  }

  allPrices.sort((a, b) => a - b)
  const priceMin = allPrices.length > 0 ? allPrices[0] : 0
  const priceMax = allPrices.length > 0 ? allPrices[allPrices.length - 1] : 0
  const priceAvg =
    allPrices.length > 0
      ? Math.round(allPrices.reduce((acc, v) => acc + v, 0) / allPrices.length)
      : 0
  const priceMedian =
    allPrices.length > 0
      ? allPrices.length % 2 === 0
        ? Math.round((allPrices[allPrices.length / 2 - 1] + allPrices[allPrices.length / 2]) / 2)
        : Math.round(allPrices[Math.floor(allPrices.length / 2)])
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

  // Melhor entrada para margem:
  // Se tiver líder com preço alto ou se houver dispersão de preços, calcula gap entre o menor preço do líder e a média
  let bestOpportunityMargin: ExactProductSummary['bestOpportunityMargin'] = null
  if (sellersList.length > 0 && priceMedian > 0) {
    const leader = sellersList[0]
    const leaderPrice = leader.minPrice || leader.avgPrice || priceMedian

    // Se temos nossa conta ou concorrente com espaço para margem
    if (leaderPrice > priceMin && priceMin > 0) {
      const diff = leaderPrice - priceMin
      const pct = Math.round((diff / leaderPrice) * 100)
      bestOpportunityMargin = {
        sellerNickname: leader.sellerNickname,
        price: priceMin,
        leaderPrice: leaderPrice,
        marginDiffPercent: pct,
        explanation: `O líder da Buy Box pratica ${leaderPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Entrando a ${priceMin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, há ${pct}% de margem competitiva.`,
      }
    } else if (sellersList.length === 1) {
      bestOpportunityMargin = {
        sellerNickname: leader.sellerNickname,
        price: leaderPrice,
        leaderPrice: leaderPrice,
        marginDiffPercent: 0,
        explanation: `Apenas 1 vendedor detém as posições deste produto exato. Baixa disputa e excelente oportunidade de entrada.`,
      }
    } else {
      bestOpportunityMargin = {
        sellerNickname: leader.sellerNickname,
        price: priceMin,
        leaderPrice: leaderPrice,
        marginDiffPercent: 0,
        explanation: `Preços altamente alinhados no piso de ${priceMin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Disputa focada na Buy Box por frete ou tipo de anúncio.`,
      }
    }
  }

  return {
    searchTerm: cleanQuery,
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
    hasAnyConfirmedSales,
    totalConfirmedSalesAcrossSellers,
    sellersRanked: sellersList,
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

  return { savedCount, errorsCount }
}
