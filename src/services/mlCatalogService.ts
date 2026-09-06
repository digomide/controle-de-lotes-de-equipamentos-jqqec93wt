import pb from '@/lib/pocketbase/client'
import { Product } from '@/types/inventory'

export interface MLCatalogProduct {
  id: string
  catalog_product_id: string
  title: string
  domain_id: string
  permalink: string
  thumbnail: string
  buy_box_winner_price?: number | null
  min_price?: number | null
  buy_box_winner_seller_id?: string | null
  buy_box_winner_seller_nickname?: string | null
  buy_box_winner_item_id?: string | null
  buy_box_winner_listing_type?: string | null
  buy_box_winner_listing_type_label?: string | null
  buy_box_winner_stock?: number | null
  suggested_price_to_win?: number | null
  competition_raw_status?: string | null
  competitors_count?: number | null
  stock_status?: string
  competition_status?: string
  condition?: 'new' | 'refurbished' | 'used' | 'open_box' | 'unknown' | string
  condition_label?:
    | 'Novo'
    | 'Recondicionado'
    | 'Usado'
    | 'Caixa aberta'
    | 'Condição não informada'
    | string
  condition_grade?: string
  status?: string
  source?: string
  is_own_account?: boolean
  own_ad_id?: string
  attributes?: Array<{
    id: string
    name: string
    value_id?: string | null
    value_name?: string | null
    [key: string]: any
  }>
}

export type PublishConditionOption = 'catalog_auto' | 'new' | 'used' | 'refurbished' | 'open_box'

export interface MLCatalogConditionMeta {
  id: PublishConditionOption
  label: string
  mlValueId?: string
  description: string
  badgeClass: string
  dotClass: string
  borderClass: string
}

export const ML_CATALOG_CONDITIONS: Record<
  Exclude<PublishConditionOption, 'catalog_auto'>,
  MLCatalogConditionMeta
> = {
  new: {
    id: 'new',
    label: 'Novo',
    mlValueId: '2230284',
    description: 'Produto novo lacrado de fábrica. Aceito diretamente na maioria das posições.',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
    borderClass: 'border-emerald-500/40',
  },
  used: {
    id: 'used',
    label: 'Usado',
    mlValueId: '2230581',
    description:
      'Equipamento usado em bom funcionamento. Requer posição de catálogo específica de usado.',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-400',
    borderClass: 'border-amber-500/40',
  },
  refurbished: {
    id: 'refurbished',
    label: 'Recondicionado',
    mlValueId: '2230582',
    description:
      'Equipamento recondicionado certificado (Grau Excelente). O sistema reproduz o mecanismo oficial do painel do ML criando ou vinculando à posição recondicionada da família.',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    dotClass: 'bg-purple-400',
    borderClass: 'border-purple-500/40',
  },
  open_box: {
    id: 'open_box',
    label: 'Caixa aberta',
    mlValueId: '46759135',
    description:
      'Embalagem aberta ou pequenas avarias estéticas na embalagem. Aceito em posições Novas.',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-400',
    borderClass: 'border-blue-500/40',
  },
}

export function getConditionBadgeInfo(cond?: string | null): {
  label: string
  badgeClass: string
  dotClass: string
} {
  const c = String(cond || '').toLowerCase()
  if (c === 'new' || c === 'novo' || c === '2230284') {
    return {
      label: 'Novo',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-400',
    }
  }
  if (
    c === 'open_box' ||
    c === 'caixa aberta' ||
    c === 'caixa_aberta' ||
    c === 'open box' ||
    c === '46759135'
  ) {
    return {
      label: 'Caixa aberta',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      dotClass: 'bg-blue-400',
    }
  }
  if (c === 'refurbished' || c === 'recondicionado' || c === 'refurb' || c === '2230582') {
    return {
      label: 'Recondicionado',
      badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      dotClass: 'bg-purple-400',
    }
  }
  if (c === 'used' || c === 'usado' || c === '2230581') {
    return {
      label: 'Usado',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-400',
    }
  }
  return {
    label: cond || 'Indefinido',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground',
  }
}

export interface CatalogMatchResult {
  catalogProduct: MLCatalogProduct
  matchedProducts: Product[]
  totalAvailableStock: number
  suggestedPrice: number
  selected: boolean
  formQuantity: number
  formPrice: number
  formCondition: PublishConditionOption
  selectedProductId?: string
}

export interface MLCatalogSearchJob {
  id: string
  query: string
  domain_id: string
  condition?: string
  status: 'pending' | 'processing' | 'done' | 'error'
  status_code?: number
  error_message?: string
  strategy_used?: string
  results?: MLCatalogProduct[]
  progress_text?: string
  paging?: {
    total?: number
    pages_fetched?: number
    items_count?: number
    sub_searches_total?: number
    sub_searches_completed?: number
    universe_estimated_total?: number
    coverage_percentage?: number
    has_uncovered_universe?: boolean
    max_cap_reached?: boolean
  }
  raw_debug?: string[]
  created: string
}

export interface MLCatalogPublishJob {
  id: string
  catalog_product_id: string
  product_id?: string
  price: number
  quantity: number
  domain_id?: string
  condition?: string
  status: 'pending' | 'processing' | 'done' | 'error'
  status_code?: number
  error_message?: string
  ml_listing_id?: string
  ml_listing_url?: string
  result_data?: any
  created: string
}

export const mlCatalogService = {
  /**
   * Dispara busca assíncrona no catálogo do ML via fila (ml_catalog_search_jobs)
   */
  async searchCatalog(
    query: string,
    domainId: string = '',
    condition: string = 'all',
  ): Promise<MLCatalogSearchJob> {
    const userId = pb.authStore.model?.id || null
    try {
      const job = await pb.collection('ml_catalog_search_jobs').create({
        query: query.trim(),
        domain_id: (domainId || '').trim(),
        condition: condition || 'all',
        status: 'pending',
        requested_by: userId,
      })
      return job as unknown as MLCatalogSearchJob
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      if (errMsg.includes('Failed to create record') || err?.status === 400) {
        throw new Error(
          'Não foi possível iniciar o job de busca no Mercado Livre. Verifique a conexão com o servidor ou tente novamente.',
        )
      }
      throw err
    }
  },

  /**
   * Consulta o estado atual do job de busca
   */
  async getSearchJob(jobId: string): Promise<MLCatalogSearchJob> {
    const job = await pb.collection('ml_catalog_search_jobs').getOne(jobId)
    return job as unknown as MLCatalogSearchJob
  },

  /**
   * Aguarda término do job de busca com polling
   */
  async pollSearchJob(
    jobId: string,
    onProgress?: (job: MLCatalogSearchJob) => void,
    maxWaitSecs: number = 60,
  ): Promise<MLCatalogSearchJob> {
    const start = Date.now()
    while (Date.now() - start < maxWaitSecs * 1000) {
      const job = await this.getSearchJob(jobId)
      if (onProgress) onProgress(job)
      if (job.status === 'done' || job.status === 'error') {
        return job
      }
      await new Promise((r) => setTimeout(r, 800))
    }
    // Ao estourar tempo limite, verificar se há resultados parciais salvos
    try {
      const lastJob = await this.getSearchJob(jobId)
      if (lastJob && lastJob.results && lastJob.results.length > 0) {
        return lastJob
      }
    } catch {
      /* intentionally ignored */
    }
    throw new Error(
      'A busca no catálogo do Mercado Livre excedeu o tempo limite aguardando os resultados. Tente refazer a busca.',
    )
  },

  /**
   * Enfileira a publicação em massa para os itens selecionados
   */
  async createPublishJob(payload: {
    catalog_product_id: string
    product_id?: string
    price: number
    quantity: number
    domain_id?: string
    condition?: string
  }): Promise<MLCatalogPublishJob> {
    const userId = pb.authStore.model?.id || null
    const job = await pb.collection('ml_catalog_publish_jobs').create({
      catalog_product_id: payload.catalog_product_id,
      product_id: payload.product_id || null,
      price: Math.max(1, Math.round(payload.price)),
      quantity: Math.max(1, Math.round(payload.quantity)),
      domain_id: payload.domain_id || '',
      condition: payload.condition || 'used',
      status: 'pending',
      requested_by: userId,
    })
    return job as unknown as MLCatalogPublishJob
  },

  /**
   * Consulta o estado do job de publicação
   */
  async getPublishJob(jobId: string): Promise<MLCatalogPublishJob> {
    const job = await pb.collection('ml_catalog_publish_jobs').getOne(jobId)
    return job as unknown as MLCatalogPublishJob
  },

  /**
   * Aguarda conclusão do job de publicação
   */
  async pollPublishJob(
    jobId: string,
    onProgress?: (job: MLCatalogPublishJob) => void,
    maxWaitSecs: number = 30,
  ): Promise<MLCatalogPublishJob> {
    const start = Date.now()
    while (Date.now() - start < maxWaitSecs * 1000) {
      const job = await this.getPublishJob(jobId)
      if (onProgress) onProgress(job)
      if (job.status === 'done' || job.status === 'error') {
        return job
      }
      await new Promise((r) => setTimeout(r, 1200))
    }
    throw new Error('Tempo esgotado aguardando publicação do anúncio de catálogo.')
  },

  /**
   * Encontra correspondência automática entre um produto de catálogo do ML e os produtos/lotes locais
   * Reutiliza lógica de similaridade de marca + modelo
   */
  matchCatalogWithInventory(
    catalogProd: MLCatalogProduct,
    inventoryProducts: Product[],
  ): {
    matchedProducts: Product[]
    totalAvailableStock: number
    suggestedPrice: number
  } {
    const catTitle = (catalogProd.title || '').toLowerCase()

    // Extrai marca e modelo dos atributos do catálogo do ML, se disponíveis
    let catBrand = ''
    let catModel = ''
    if (Array.isArray(catalogProd.attributes)) {
      for (const attr of catalogProd.attributes) {
        if (attr.id === 'BRAND') catBrand = (attr.value_name || '').toLowerCase()
        if (attr.id === 'MODEL') catModel = (attr.value_name || '').toLowerCase()
      }
    }

    const matches: Product[] = []

    inventoryProducts.forEach((p) => {
      // Considerar apenas produtos disponíveis ou em estoque
      const isAvailable = !p.status || p.status === 'Disponível'
      if (!isAvailable) return

      const pName = (p.name || '').toLowerCase()
      const pBrand = (p.brand || '').toLowerCase()
      const pModel = (p.model || '').toLowerCase()

      let isMatch = false

      // Match direto por catalog_product_id salvo no produto
      if (p.catalog_product_id && p.catalog_product_id === catalogProd.catalog_product_id) {
        isMatch = true
      }
      // Match por marca e modelo exatos
      else if (catBrand && catModel && pBrand && pModel) {
        if (pBrand.includes(catBrand) || catBrand.includes(pBrand)) {
          if (pModel.includes(catModel) || catModel.includes(pModel)) {
            isMatch = true
          }
        }
      }
      // Match se o título do catálogo contiver a marca e modelo do produto
      else if (pBrand && pModel) {
        if (catTitle.includes(pBrand) && catTitle.includes(pModel)) {
          isMatch = true
        }
      }
      // Match se o nome do nosso produto contiver o modelo do catálogo
      else if (catModel && catModel.length >= 3 && pName.includes(catModel)) {
        isMatch = true
      }

      if (isMatch) {
        matches.push(p)
      }
    })

    const totalAvailableStock = matches.length
    // Preço sugerido: suggested_price_to_win (oficial do price_to_win para vencer Buy Box), ou buy_box_winner_price, ou min_price, ou menor dos preços do estoque
    let suggestedPrice = 0
    if (catalogProd.suggested_price_to_win && catalogProd.suggested_price_to_win > 0) {
      suggestedPrice = catalogProd.suggested_price_to_win
    } else if (catalogProd.buy_box_winner_price && catalogProd.buy_box_winner_price > 0) {
      suggestedPrice = catalogProd.buy_box_winner_price
    } else if (catalogProd.min_price && catalogProd.min_price > 0) {
      suggestedPrice = catalogProd.min_price
    } else if (matches.length > 0) {
      const validPrices = matches.map((m) => m.unit_price).filter((pr) => pr && pr > 0)
      if (validPrices.length > 0) {
        suggestedPrice = Math.min(...validPrices)
      }
    }

    return {
      matchedProducts: matches,
      totalAvailableStock,
      suggestedPrice: suggestedPrice || 1200,
    }
  },
}
