import pb from '@/lib/pocketbase/client'
import { Product } from '@/types/inventory'
import { getActiveTenantId } from './mlService'

export interface MLCatalogCompetitor {
  item_id?: string
  seller_id?: string
  seller_nickname?: string
  price: number
  available_quantity?: number | null
  sold_quantity?: number | null
  listing_type_id?: string
  listing_type_label?: string
  is_buy_box_winner?: boolean
  is_own?: boolean
}

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
  competitors?: MLCatalogCompetitor[]
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
  sold_quantity?: number | null
  brand_value?: string
  model_value?: string
  attributes?: Array<{
    id: string
    name: string
    value_id?: string | null
    value_name?: string | null
    [key: string]: any
  }>
}

/**
 * Formata a quantidade de vendas no padrão visual do Mercado Livre
 * Ex.: "+1.000 vendidos", "25 vendidos", "Nenhum vendido", "Vendas não informadas"
 */
export function formatMLSoldQuantity(sold?: number | null): string {
  if (sold === null || sold === undefined || isNaN(sold)) {
    return 'Vendas não informadas'
  }
  const n = Math.max(0, Math.floor(sold))
  if (n === 0) {
    return 'Nenhum vendido'
  }
  if (n >= 1000) {
    // No ML aparece "+1.000 vendidos", "+5.000 vendidos", "+50mil vendidos", etc.
    const thousands = Math.floor(n / 1000) * 1000
    return `+${thousands.toLocaleString('pt-BR')} vendidos`
  }
  if (n === 1) {
    return '1 vendido'
  }
  return `${n.toLocaleString('pt-BR')} vendidos`
}

export type PublishConditionOption = 'catalog_auto' | 'new' | 'used' | 'refurbished' | 'open_box'

export type RefurbishedGrade = 'Excelente' | 'Bom' | 'Aceitável'

export interface RefurbishedGradeOption {
  value: RefurbishedGrade
  label: string
  mlValueId: string
  colorTheme: {
    // Cores: Excelente roxo escuro, Bom roxo médio, Aceitável roxo claro
    bg: string
    text: string
    border: string
    badgeBg: string
    dotBg: string
  }
  description: string
}

export const ML_REFURBISHED_GRADES: Record<RefurbishedGrade, RefurbishedGradeOption> = {
  Excelente: {
    value: 'Excelente',
    label: 'Excelente',
    mlValueId: '40108830',
    colorTheme: {
      bg: 'bg-purple-900/10 text-purple-900 border-purple-800',
      text: 'text-purple-950',
      border: 'border-purple-800',
      badgeBg: 'bg-purple-800 text-white border-purple-900',
      dotBg: 'bg-purple-900',
    },
    description: 'Estado estético impecável, sem marcas de uso visíveis.',
  },
  Bom: {
    value: 'Bom',
    label: 'Bom',
    mlValueId: '40108831',
    colorTheme: {
      bg: 'bg-purple-600/10 text-purple-700 border-purple-600',
      text: 'text-purple-800',
      border: 'border-purple-500',
      badgeBg: 'bg-purple-600 text-white border-purple-700',
      dotBg: 'bg-purple-600',
    },
    description: 'Pequenas marcas de uso superficiais quase imperceptíveis.',
  },
  Aceitável: {
    value: 'Aceitável',
    label: 'Aceitável',
    mlValueId: '40108832',
    colorTheme: {
      bg: 'bg-purple-400/10 text-purple-600 border-purple-300',
      text: 'text-purple-700',
      border: 'border-purple-400',
      badgeBg: 'bg-purple-400 text-purple-950 border-purple-500',
      dotBg: 'bg-purple-400',
    },
    description: 'Sinais visíveis de uso ou arranhões, 100% funcional.',
  },
}

export function normalizeRefurbishedGrade(grade?: string | null): RefurbishedGrade | null {
  if (!grade) return null
  const clean = String(grade)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  if (clean === 'excelente' || clean.includes('excelent') || clean === '40108830') {
    return 'Excelente'
  }
  if (clean === 'bom' || clean.includes('good') || clean === '40108831') {
    return 'Bom'
  }
  if (clean === 'aceitavel' || clean.includes('accept') || clean === '40108832') {
    return 'Aceitável'
  }
  return null
}

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
      'Equipamento recondicionado certificado com escolha de grau (Excelente, Bom ou Aceitável — os 3 graus oficiais do Mercado Livre).',
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

export function getConditionBadgeInfo(
  cond?: string | null,
  grade?: string | null,
): {
  label: string
  badgeClass: string
  dotClass: string
  gradeInfo?: RefurbishedGradeOption
} {
  const c = String(cond || '').toLowerCase()
  const normGrade = normalizeRefurbishedGrade(grade)
  const gradeOpt = normGrade ? ML_REFURBISHED_GRADES[normGrade] : undefined

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
    if (gradeOpt) {
      return {
        label: `Recondicionado · ${gradeOpt.label}`,
        badgeClass: gradeOpt.colorTheme.badgeBg,
        dotClass: gradeOpt.colorTheme.dotBg,
        gradeInfo: gradeOpt,
      }
    }
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
  formConditionGrade?: RefurbishedGrade
  selectedProductId?: string
}

export type CatalogSearchDepth = 'fast' | 'deep' | 'complete'

export interface MLCatalogSearchJob {
  id: string
  query: string
  domain_id: string
  category_id?: string
  condition?: string
  depth?: CatalogSearchDepth
  max_pages?: number
  status: 'pending' | 'processing' | 'done' | 'error'
  status_code?: number
  error_message?: string
  strategy_used?: string
  results?: MLCatalogProduct[]
  progress_text?: string
  is_cached?: boolean
  cached_at?: string
  force_refresh?: boolean
  stop_requested?: boolean
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
  condition_grade?: string
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
    forceRefresh: boolean = false,
    categoryId: string = '',
    depth: CatalogSearchDepth = 'fast',
  ): Promise<MLCatalogSearchJob> {
    const userId = pb.authStore.model?.id || null
    const depthMaxPagesMap: Record<CatalogSearchDepth, number> = {
      fast: 10,
      deep: 40,
      complete: 120,
    }
    const maxPages = depthMaxPagesMap[depth] || 10

    try {
      const job = await pb.collection('ml_catalog_search_jobs').create(
        {
          query: query.trim(),
          domain_id: (domainId || '').trim(),
          category_id: (categoryId || '').trim(),
          condition: condition || 'all',
          depth: depth || 'fast',
          max_pages: maxPages,
          status: 'pending',
          progress_text: 'Na fila... Aguardando início do processamento em segundo plano.',
          force_refresh: forceRefresh,
          requested_by: userId,
        },
        {
          fields:
            'id,status,query,depth,max_pages,progress_text,strategy_used,error_message,paging,created,updated,has_chunks,chunk_count,is_cached,cached_at',
        },
      )
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
   * Consulta apenas os metadados do job de busca com projeção de campos
   * (exclui o payload gigante para evitar tráfego de megabytes e timeouts de 23-395s).
   */
  async getSearchJobMeta(jobId: string): Promise<MLCatalogSearchJob> {
    const job = (await pb.collection('ml_catalog_search_jobs').getOne(jobId, {
      fields:
        'id,status,query,depth,max_pages,progress_text,strategy_used,error_message,paging,created,updated,has_chunks,chunk_count,is_cached,cached_at',
    })) as unknown as MLCatalogSearchJob
    return job
  },

  /**
   * Lê todos os resultados consolidados da coleção filha ml_catalog_search_results
   * filtrando job_id = "{id}", ordenados por chunk_index ASC.
   * Concatena os itens localmente de forma transparente — as telas recebem exatamente a mesma lista.
   */
  async fetchJobResultsFromChunks(jobId: string): Promise<MLCatalogProduct[]> {
    try {
      const chunkRecords = await pb.collection('ml_catalog_search_results').getFullList({
        filter: `job_id = "${jobId}"`,
        sort: 'chunk_index',
      })

      if (!chunkRecords || chunkRecords.length === 0) {
        return []
      }

      const combinedItems: MLCatalogProduct[] = []
      for (const chunk of chunkRecords) {
        const payload = (chunk as any).payload_json
        if (Array.isArray(payload)) {
          combinedItems.push(...payload)
        } else if (typeof payload === 'string') {
          try {
            const parsed = JSON.parse(payload)
            if (Array.isArray(parsed)) {
              combinedItems.push(...parsed)
            }
          } catch {
            /* intentionally ignored */
          }
        }
      }
      return combinedItems
    } catch (err) {
      console.warn('[mlCatalogService] Falha ao recuperar chunks do job ' + jobId + ':', err)
      return []
    }
  },

  /**
   * Consulta o estado atual do job de busca.
   * Se concluído com sucesso (ou com chunks disponíveis), lê os chunks de ml_catalog_search_results e remonta a lista completa.
   */
  async getSearchJob(jobId: string): Promise<MLCatalogSearchJob> {
    const job = await this.getSearchJobMeta(jobId)

    // Se o job estiver done ou possuir chunks salvos, carrega os itens
    const items = await this.fetchJobResultsFromChunks(jobId)
    if (items.length > 0) {
      job.results = items
      if (job.status !== 'error') {
        job.status = 'done'
      }
    } else if (job.status === 'done') {
      // Fallback para caso o job seja legado e tenha sido gravado direto no campo results
      try {
        const fullJob = await pb.collection('ml_catalog_search_jobs').getOne(jobId, {
          fields: 'id,results',
        })
        job.results = (fullJob as any).results || []
      } catch {
        job.results = []
      }
    } else {
      job.results = []
    }

    return job
  },

  /**
   * Busca o último job bem-sucedido para um termo de busca e condição
   */
  async findLatestJobForQuery(
    queryText: string,
    condition: string = 'all',
  ): Promise<MLCatalogSearchJob | null> {
    try {
      const cleanQ = queryText.trim().replace(/["\\]/g, '')
      if (!cleanQ) return null

      const filter = `query = "${cleanQ}" && status = "done"`
      const records = await pb.collection('ml_catalog_search_jobs').getList(1, 1, {
        filter,
        sort: '-updated',
        fields:
          'id,status,query,progress_text,strategy_used,error_message,paging,created,updated,has_chunks,chunk_count,is_cached,cached_at',
      })

      if (records.items && records.items.length > 0) {
        return records.items[0] as unknown as MLCatalogSearchJob
      }
      return null
    } catch (err) {
      console.warn('[mlCatalogService] Falha ao buscar último job para query:', err)
      return null
    }
  },

  /**
   * Lista histórico de buscas recentes registradas na fila
   */
  async listRecentSearchJobs(limit: number = 20): Promise<MLCatalogSearchJob[]> {
    try {
      const records = await pb.collection('ml_catalog_search_jobs').getList(1, limit, {
        sort: '-created',
        fields:
          'id,status,query,depth,max_pages,progress_text,strategy_used,error_message,paging,created,updated,has_chunks,chunk_count,is_cached,cached_at',
      })
      return (records.items || []) as unknown as MLCatalogSearchJob[]
    } catch (err) {
      console.warn('[mlCatalogService] Falha ao listar buscas recentes:', err)
      return []
    }
  },

  /**
   * Solicita parada amigável de uma busca em andamento mantendo o que já foi acumulado
   */
  async stopSearchJob(jobId: string): Promise<void> {
    try {
      await pb.collection('ml_catalog_search_jobs').update(jobId, {
        stop_requested: true,
      })
    } catch (err) {
      console.warn('[mlCatalogService] Falha ao solicitar parada do job:', err)
    }
  },

  /**
   * Aguarda término do job de busca com polling leve por projeção de campos
   * (`fields: 'id,status,query,progress_text,strategy_used,error_message,paging,created,updated'`).
   * Ao concluir com sucesso, busca os chunks em ml_catalog_search_results e consolida a lista.
   */
  /**
   * Aguarda término do job de busca com polling leve por projeção de campos
   * (`fields: 'id,status,query,progress_text,strategy_used,error_message,paging,created,updated,has_chunks,chunk_count'`).
   * Não aborta prematuramente enquanto o job estiver em processamento ou na fila ('pending' ou 'processing').
   * O timeout generoso padrão é de 15 minutos (900s), evitando falso erro no frontend.
   * Ao concluir com sucesso, busca os chunks em ml_catalog_search_results e consolida a lista.
   */
  async pollSearchJob(
    jobId: string,
    onProgress?: (job: MLCatalogSearchJob) => void,
    maxWaitSecs: number = 900,
  ): Promise<MLCatalogSearchJob> {
    const start = Date.now()
    let consecutiveNetworkErrors = 0

    while (Date.now() - start < maxWaitSecs * 1000) {
      const elapsedSecs = Math.floor((Date.now() - start) / 1000)
      let jobMeta: MLCatalogSearchJob
      try {
        // 1. Polling leve apenas dos metadados (sem payload gigante)
        jobMeta = await this.getSearchJobMeta(jobId)
        consecutiveNetworkErrors = 0
      } catch (pollErr: any) {
        consecutiveNetworkErrors++
        console.warn(
          `[mlCatalogService] Falha temporária no polling do job ${jobId} (tentativa ${consecutiveNetworkErrors}):`,
          pollErr,
        )
        // Se houver pequenas oscilações de rede, aguarda um pouco mais e tenta novamente antes de desistir
        if (consecutiveNetworkErrors > 15) {
          throw pollErr
        }
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }

      // Sempre injeta o tempo decorrido no progress_text se o backend não enviou detalhes específicos
      if (!jobMeta.progress_text) {
        jobMeta.progress_text = `Processando busca profunda no Mercado Livre… (${elapsedSecs}s decorridos)`
      }

      if (onProgress) onProgress(jobMeta)

      if (jobMeta.status === 'done') {
        // 2. Concluído com sucesso: ler os chunks e concatenar localmente
        const items = await this.fetchJobResultsFromChunks(jobId)
        if (items.length > 0) {
          jobMeta.results = items
        } else {
          // Fallback para jobs legados
          try {
            const full = await pb.collection('ml_catalog_search_jobs').getOne(jobId, {
              fields: 'id,results',
            })
            jobMeta.results = (full as any).results || []
          } catch {
            jobMeta.results = []
          }
        }
        // Notificar callback final com os itens completos consolidados
        if (onProgress) onProgress(jobMeta)
        return jobMeta
      }

      if (jobMeta.status === 'error') {
        // Antes de declarar erro definitivo, verifica se na verdade o job já possui chunks ou resultados válidos
        try {
          const items = await this.fetchJobResultsFromChunks(jobId)
          if (items.length > 0) {
            jobMeta.status = 'done'
            jobMeta.results = items
            if (onProgress) onProgress(jobMeta)
            return jobMeta
          }
        } catch {
          /* ignore */
        }

        // Aguarda 3 segundos adicionais para o caso de o worker estar finalizando a gravação do chunk final
        if (elapsedSecs < maxWaitSecs - 5) {
          await new Promise((r) => setTimeout(r, 3000))
          try {
            const retryMeta = await this.getSearchJobMeta(jobId)
            const retryItems = await this.fetchJobResultsFromChunks(jobId)
            if (retryItems.length > 0 || retryMeta.status === 'done') {
              retryMeta.status = 'done'
              retryMeta.results = retryItems
              if (onProgress) onProgress(retryMeta)
              return retryMeta
            }
          } catch {
            /* ignore */
          }
        }

        jobMeta.results = []
        return jobMeta
      }

      // Intervalo adaptativo de polling:
      // Primeiros 60s: 2.5s (resposta rápida para buscas curtas ou cacheadas)
      // Após 60s: 5s (não sobrecarrega o servidor enquanto a fila processa)
      const intervalMs = elapsedSecs < 60 ? 2500 : 5000
      await new Promise((r) => setTimeout(r, intervalMs))
    }

    // Ao estourar tempo limite (15 min), reconsultar o status real e verificar se há chunks já disponíveis
    try {
      const lastMeta = await this.getSearchJobMeta(jobId)
      const items = await this.fetchJobResultsFromChunks(jobId)
      if (items.length > 0) {
        lastMeta.status = 'done'
        lastMeta.results = items
        if (onProgress) onProgress(lastMeta)
        return lastMeta
      }
      if (lastMeta.status === 'done') {
        lastMeta.results = items
        if (onProgress) onProgress(lastMeta)
        return lastMeta
      }
    } catch {
      /* intentionally ignored */
    }
    throw new Error(
      'A busca no catálogo do Mercado Livre excedeu o tempo limite de 15 minutos aguardando os resultados. Tente refazer a busca.',
    )
  },

  /**
   * Tenta recuperar automaticamente um job de busca que possa ter terminado com sucesso
   * no servidor ou que já tenha chunks gravados.
   */
  async recoverSearchJob(jobId: string): Promise<MLCatalogSearchJob | null> {
    if (!jobId) return null
    try {
      const jobMeta = await this.getSearchJobMeta(jobId)
      const items = await this.fetchJobResultsFromChunks(jobId)
      if (items.length > 0 || jobMeta.status === 'done') {
        jobMeta.status = 'done'
        jobMeta.results = items
        return jobMeta
      }
      if (jobMeta.status === 'pending' || jobMeta.status === 'processing') {
        // Ainda está processando no servidor; tentar polling com tempo restante
        return await this.pollSearchJob(jobId)
      }
      return null
    } catch (err) {
      console.warn('[mlCatalogService] Falha ao tentar recuperar job ' + jobId + ':', err)
      return null
    }
  },

  /**
   * Consulta concorrentes sob demanda para uma posição de catálogo
   */
  async getCatalogCompetition(catalogProductId: string): Promise<{
    catalog_product_id: string
    competitors_count: number
    competitors: MLCatalogCompetitor[]
    winner?: MLCatalogCompetitor | null
    suggested_price_to_win?: number | null
    competition_raw_status?: string
    best_competitor?: any
    sold_quantity?: number | null
  }> {
    try {
      const res = await pb.send(
        `/backend/v1/ml/catalog-competition/${encodeURIComponent(catalogProductId)}`,
        {
          method: 'GET',
        },
      )
      return res
    } catch (err: any) {
      console.warn(
        `[mlCatalogService] Falha ao consultar concorrência de ${catalogProductId}:`,
        err,
      )
      return {
        catalog_product_id: catalogProductId,
        competitors_count: 0,
        competitors: [],
      }
    }
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
    condition_grade?: string
    tenant_id?: string
  }): Promise<MLCatalogPublishJob> {
    const userId = pb.authStore.model?.id || null
    const activeTenantId = (payload.tenant_id || getActiveTenantId() || '').trim()
    const createData: Record<string, any> = {
      catalog_product_id: payload.catalog_product_id,
      product_id: payload.product_id || null,
      price: Math.max(1, Math.round(payload.price)),
      quantity: Math.max(1, Math.round(payload.quantity)),
      domain_id: payload.domain_id || '',
      condition: payload.condition || 'used',
      status: 'pending',
      requested_by: userId,
      tenant_id: activeTenantId || null,
    }

    if (payload.condition_grade) {
      createData.condition_grade = payload.condition_grade
      createData.result_data = { condition_grade: payload.condition_grade }
    }

    const job = await pb.collection('ml_catalog_publish_jobs').create(createData)
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
    // Preço sugerido inteligente:
    // Regra de ouro: basear-se na âncora de quem vende (líder da Buy Box), logo abaixo, NUNCA no piso de anúncios sem relevância.
    let suggestedPrice = 0
    if (catalogProd.suggested_price_to_win && catalogProd.suggested_price_to_win > 0) {
      suggestedPrice = catalogProd.suggested_price_to_win
    } else if (catalogProd.buy_box_winner_price && catalogProd.buy_box_winner_price > 0) {
      // Entrada estratégica logo abaixo do líder da Buy Box (~2% a 4% abaixo, ou R$ 5 a menos)
      const leaderP = catalogProd.buy_box_winner_price
      const discount = leaderP > 200 ? Math.round(leaderP * 0.03) : leaderP > 50 ? 5 : 2
      suggestedPrice = Math.max(1, leaderP - discount)
    } else if (catalogProd.min_price && catalogProd.min_price > 0) {
      suggestedPrice = catalogProd.min_price
    } else if (matches.length > 0) {
      const validPrices = matches.map((m) => m.unit_price).filter((pr) => pr && pr > 0)
      if (validPrices.length > 0) {
        // Usa a mediana dos preços de estoque para não empurrar pro piso suicida
        const sorted = [...validPrices].sort((a, b) => a - b)
        suggestedPrice = sorted[Math.floor(sorted.length / 2)]
      }
    }

    return {
      matchedProducts: matches,
      totalAvailableStock,
      suggestedPrice: suggestedPrice || 1200,
    }
  },

  /**
   * Resolve em lote seller_ids para seus respectivos apelidos (nicknames)
   * consultando o backend com cache persistente.
   */
  async resolveSellerNames(sellerIds: string[]): Promise<Record<string, string>> {
    if (!Array.isArray(sellerIds) || sellerIds.length === 0) return {}
    const cleanIds = Array.from(
      new Set(
        sellerIds
          .map((id) => String(id || '').trim())
          .filter((id) => id && !id.startsWith('nick_') && id !== 'unknown_seller'),
      ),
    )
    if (cleanIds.length === 0) return {}

    try {
      const res = await pb.send<{ sellers: Record<string, string> }>(
        '/backend/v1/ml/resolve-sellers',
        {
          method: 'POST',
          body: { seller_ids: cleanIds },
        },
      )
      return res?.sellers || {}
    } catch (err) {
      console.warn('[mlCatalogService] Falha ao resolver seller names em lote:', err)
      return {}
    }
  },
}
