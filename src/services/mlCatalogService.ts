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
  status?: string
  source?: string
  attributes?: Array<{
    id: string
    name: string
    value_id?: string | null
    value_name?: string | null
    [key: string]: any
  }>
}

export interface CatalogMatchResult {
  catalogProduct: MLCatalogProduct
  matchedProducts: Product[]
  totalAvailableStock: number
  suggestedPrice: number
  selected: boolean
  formQuantity: number
  formPrice: number
  selectedProductId?: string
}

export interface MLCatalogSearchJob {
  id: string
  query: string
  domain_id: string
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
    domainId: string = 'MLB-NOTEBOOKS',
  ): Promise<MLCatalogSearchJob> {
    const userId = pb.authStore.model?.id || null
    const job = await pb.collection('ml_catalog_search_jobs').create({
      query: query.trim(),
      domain_id: domainId.trim() || 'MLB-NOTEBOOKS',
      status: 'pending',
      requested_by: userId,
    })
    return job as unknown as MLCatalogSearchJob
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
    throw new Error('A busca no catálogo do Mercado Livre excedeu o tempo limite. Tente novamente.')
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
      domain_id: payload.domain_id || 'MLB-NOTEBOOKS',
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
    // Preço sugerido: buy_box_winner_price do ML, ou min_price, ou média/menor dos preços do nosso estoque se houver match
    let suggestedPrice = 0
    if (catalogProd.buy_box_winner_price && catalogProd.buy_box_winner_price > 0) {
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
