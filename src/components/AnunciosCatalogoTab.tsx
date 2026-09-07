import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Search,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Package,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
  Filter,
  Check,
  Eye,
  EyeOff,
  Tag,
  BadgeCheck,
  User,
  Zap,
  ArrowDownRight,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { productsService } from '@/services/products'
import { Product } from '@/types/inventory'
import {
  mlCatalogService,
  MLCatalogProduct,
  MLCatalogCompetitor,
  CatalogMatchResult,
  formatMLSoldQuantity,
  PublishConditionOption,
  RefurbishedGrade,
  ML_CATALOG_CONDITIONS,
  ML_REFURBISHED_GRADES,
  normalizeRefurbishedGrade,
  getConditionBadgeInfo,
} from '@/services/mlCatalogService'
import {
  extractCatalogSearchTokens,
  evaluateCatalogItemStrictMatch,
  highlightMatchedTitle,
  isDirectCatalogCodeQuery,
} from '@/lib/catalogFilter'

export function AnunciosCatalogoTab() {
  const [query, setQuery] = useState('dell latitude 3420')
  const [activeSearchTerm, setActiveSearchTerm] = useState('dell latitude 3420')
  const [searching, setSearching] = useState(false)
  const [searchProgressText, setSearchProgressText] = useState('')
  const [searchPagingInfo, setSearchPagingInfo] = useState<{
    total?: number
    pages_fetched?: number
    items_count?: number
    sub_searches_total?: number
    sub_searches_completed?: number
    universe_estimated_total?: number
    coverage_percentage?: number
    has_uncovered_universe?: boolean
    max_cap_reached?: boolean
  } | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogMatchResult[]>([])
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([])
  const [lastStrategy, setLastStrategy] = useState<string>('')
  const [searchJobDebug, setSearchJobDebug] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [showPartialResults, setShowPartialResults] = useState(false)
  const [cachedJobInfo, setCachedJobInfo] = useState<{
    isCached: boolean
    cachedAt?: string
  } | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [stoppingJob, setStoppingJob] = useState(false)

  // Controle de expansão da lista de concorrentes por item (chave: catalog_product_id ou id)
  const [expandedCompetitors, setExpandedCompetitors] = useState<Record<string, boolean>>({})
  const [loadingCompetitors, setLoadingCompetitors] = useState<Record<string, boolean>>({})

  // Alternar visualização da lista de concorrentes e buscar sob demanda se necessário
  async function toggleCompetitorsList(originalIndex: number) {
    const item = catalogItems[originalIndex]
    if (!item) return
    const cat = item.catalogProduct
    const key = cat.catalog_product_id || cat.id || String(originalIndex)
    const isCurrentlyOpen = Boolean(expandedCompetitors[key])

    // Se vai abrir e não tem a lista ainda, busca sob demanda
    if (
      !isCurrentlyOpen &&
      (!cat.competitors || cat.competitors.length === 0) &&
      cat.catalog_product_id
    ) {
      setLoadingCompetitors((prev) => ({ ...prev, [key]: true }))
      try {
        const compData = await mlCatalogService.getCatalogCompetition(cat.catalog_product_id)
        if (compData) {
          setCatalogItems((prev) => {
            const next = [...prev]
            if (next[originalIndex]) {
              const currentProd = next[originalIndex].catalogProduct
              const updatedCompetitors =
                Array.isArray(compData.competitors) && compData.competitors.length > 0
                  ? compData.competitors
                  : currentProd.competitors
              const updatedSold =
                compData.sold_quantity != null ? compData.sold_quantity : currentProd.sold_quantity

              next[originalIndex] = {
                ...next[originalIndex],
                catalogProduct: {
                  ...currentProd,
                  competitors: updatedCompetitors,
                  competitors_count:
                    compData.competitors_count != null
                      ? compData.competitors_count
                      : currentProd.competitors_count,
                  sold_quantity: updatedSold,
                  buy_box_winner_seller_nickname:
                    currentProd.buy_box_winner_seller_nickname ||
                    compData.winner?.seller_nickname ||
                    undefined,
                  suggested_price_to_win:
                    currentProd.suggested_price_to_win ||
                    compData.suggested_price_to_win ||
                    undefined,
                },
              }
            }
            return next
          })
        }
      } catch (err) {
        console.warn('Erro ao carregar concorrentes:', err)
      } finally {
        setLoadingCompetitors((prev) => ({ ...prev, [key]: false }))
      }
    }

    setExpandedCompetitors((prev) => ({ ...prev, [key]: !isCurrentlyOpen }))
  }

  // Seletor de Condição da Busca (persistente durante a sessão da aba via sessionStorage)
  const [searchCondition, setSearchCondition] = useState<
    'all' | 'new' | 'used' | 'refurbished' | 'open_box'
  >(() => {
    try {
      const saved = sessionStorage.getItem('ml_catalog_search_condition')
      if (saved === 'new' || saved === 'used' || saved === 'refurbished' || saved === 'open_box') {
        return saved
      }
    } catch {
      /* ignore */
    }
    return 'all'
  })

  // Filtro de condição nos resultados (chips)
  const [conditionFilter, setConditionFilter] = useState<
    'all' | 'new' | 'used' | 'refurbished' | 'open_box'
  >(searchCondition)

  // Sub-filtro de grau de recondicionado na aba Catálogo ('all' ou 'Excelente' | 'Bom' | 'Aceitável')
  const [gradeFilter, setGradeFilter] = useState<'all' | RefurbishedGrade>('all')

  // Critério de ordenação da grade (padrão 'relevance' = ordem da busca/relevância do ML)
  const [catalogSortBy, setCatalogSortBy] = useState<
    'relevance' | 'price_asc' | 'price_desc' | 'stock_desc' | 'sold_desc'
  >(() => {
    try {
      const saved = sessionStorage.getItem('ml_catalog_sort_by')
      if (
        saved === 'relevance' ||
        saved === 'sold_desc' ||
        saved === 'price_asc' ||
        saved === 'price_desc' ||
        saved === 'stock_desc'
      ) {
        return saved
      }
    } catch {
      /* ignore */
    }
    return 'relevance'
  })

  // Salvar no sessionStorage sempre que mudar a ordenação
  useEffect(() => {
    try {
      sessionStorage.setItem('ml_catalog_sort_by', catalogSortBy)
    } catch {
      /* ignore */
    }
  }, [catalogSortBy])
  // Salvar no sessionStorage sempre que mudar o seletor da busca
  useEffect(() => {
    try {
      sessionStorage.setItem('ml_catalog_search_condition', searchCondition)
    } catch {
      /* ignore */
    }
  }, [searchCondition])

  // Publicação em massa
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState({ current: 0, total: 0, percent: 0 })
  const [publishLogs, setPublishLogs] = useState<
    Array<{
      id: string
      catalog_product_id: string
      status: 'pending' | 'processing' | 'done' | 'error'
      message?: string
      listing_id?: string
      listing_url?: string
      canRetry?: boolean
      itemIndex?: number
    }>
  >([])
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)
  // Carregar produtos locais apenas para dica opcional de match (não bloqueia nada)
  useEffect(() => {
    async function loadLocalProducts() {
      try {
        const prods = await productsService.getAll()
        setInventoryProducts(prods)
      } catch (err) {
        console.warn('Erro ao carregar produtos locais para match:', err)
      }
    }
    loadLocalProducts()
  }, [])

  // Disparar busca no catálogo do Mercado Livre
  // Interrompe amigavelmente a busca e mantém o acumulado
  async function handleStopSearch() {
    if (!currentJobId || stoppingJob) return
    setStoppingJob(true)
    try {
      await mlCatalogService.stopSearchJob(currentJobId)
      toast({
        title: 'Parando busca...',
        description: 'Finalizando varredura atual e mantendo todas as posições já encontradas.',
      })
    } catch (err) {
      console.warn('Erro ao solicitar parada:', err)
    } finally {
      setTimeout(() => setStoppingJob(false), 2000)
    }
  }

  // Helper para formatar os resultados do catálogo para exibição na grade
  function processCatalogResults(
    results: MLCatalogProduct[],
    q: string,
    condToUse: 'all' | 'new' | 'used' | 'refurbished' | 'open_box',
  ) {
    const isDirectCode = isDirectCatalogCodeQuery(q)
    const tokens = isDirectCode ? [] : extractCatalogSearchTokens(q)

    return results.map((catProd) => {
      const matchInfo = mlCatalogService.matchCatalogWithInventory(catProd, inventoryProducts)
      const primaryProduct = matchInfo.matchedProducts[0]
      const fallbackPrice =
        catProd.buy_box_winner_price || catProd.min_price || matchInfo.suggestedPrice || 1200

      const isStrict =
        isDirectCode ||
        evaluateCatalogItemStrictMatch(
          catProd.title,
          tokens,
          catProd.attributes,
          condToUse,
          catProd.condition,
        ).isMatch

      let initialCondition: PublishConditionOption = 'catalog_auto'
      const cLower = String(catProd.condition || '').toLowerCase()
      if (cLower === 'refurbished' || condToUse === 'refurbished') {
        initialCondition = 'refurbished'
      } else if (cLower === 'open_box' || condToUse === 'open_box') {
        initialCondition = 'open_box'
      } else if (cLower === 'used' || condToUse === 'used') {
        initialCondition = 'used'
      } else if (cLower === 'new' && condToUse === 'new') {
        initialCondition = 'new'
      }

      const detectedGrade = normalizeRefurbishedGrade(catProd.condition_grade) || 'Excelente'

      return {
        catalogProduct: catProd,
        matchedProducts: matchInfo.matchedProducts,
        totalAvailableStock: matchInfo.totalAvailableStock,
        suggestedPrice: fallbackPrice,
        selected: isStrict,
        formQuantity: 1,
        formPrice: fallbackPrice,
        formCondition: initialCondition,
        formConditionGrade: detectedGrade,
        selectedProductId: primaryProduct?.id || undefined,
      }
    })
  }

  // Disparar busca no catálogo do Mercado Livre
  async function handleSearch(
    overrideQuery?: string,
    overrideCondition?: 'all' | 'new' | 'used' | 'refurbished' | 'open_box',
    forceRefresh: boolean = false,
  ) {
    const q = (overrideQuery ?? query).trim()
    if (!q) {
      toast({
        title: 'Informe um termo de busca',
        description: 'Digite o modelo ou cole o link / ID do produto de catálogo do Mercado Livre.',
        variant: 'destructive',
      })
      return
    }

    const condToUse = overrideCondition ?? searchCondition

    try {
      setSearching(true)
      setActiveSearchTerm(q)
      setConditionFilter(condToUse)
      setCatalogItems([])
      setSearchJobDebug([])
      setCachedJobInfo(null)
      setCurrentJobId(null)
      setSearchProgressText(
        forceRefresh
          ? 'Atualizando busca completa no Mercado Livre...'
          : 'Iniciando busca inteligente no Mercado Livre...',
      )
      setSearchPagingInfo(null)

      const condLabelMap: Record<string, string> = {
        all: 'Todas as condições',
        new: 'Novo',
        used: 'Usado',
        refurbished: 'Recondicionado',
        open_box: 'Caixa aberta',
      }
      const condFeedback = condToUse !== 'all' ? ` (${condLabelMap[condToUse]})` : ''

      toast({
        title: forceRefresh
          ? `Atualizando busca profunda no ML${condFeedback}...`
          : `Iniciando busca no ML${condFeedback}...`,
        description: forceRefresh
          ? 'Ignorando cache e buscando dados mais recentes diretamente na API do ML.'
          : 'Vasculhando posições com resultados progressivos em tempo real.',
      })

      const isDirectCodeQuery = isDirectCatalogCodeQuery(q)
      const condParamForApi = isDirectCodeQuery ? 'all' : condToUse
      const jobInit = await mlCatalogService.searchCatalog(q, '', condParamForApi, forceRefresh)
      setCurrentJobId(jobInit.id)

      const jobDone = await mlCatalogService.pollSearchJob(jobInit.id, (j) => {
        if (j.raw_debug) setSearchJobDebug(j.raw_debug)
        if (j.progress_text) setSearchProgressText(j.progress_text)
        if (j.paging) setSearchPagingInfo(j.paging)

        // STREAMING / RESULTADOS PROGRESSIVOS:
        // Conforme as varreduras avançam, preenche a grade com os resultados que já foram acumulados!
        if (Array.isArray(j.results) && j.results.length > 0) {
          setCatalogItems((prev) => {
            // Só substitui se o novo lote tiver mais posições ou se a grade estiver vazia
            if (prev.length === 0 || (j.results && j.results.length > prev.length)) {
              return processCatalogResults(j.results, q, condToUse)
            }
            return prev
          })
        }
      })

      if (jobDone.status === 'error') {
        throw new Error(jobDone.error_message || 'Falha ao buscar no catálogo do Mercado Livre')
      }

      const results = jobDone.results || []
      setLastStrategy(jobDone.strategy_used || 'api_products_search')
      if (jobDone.raw_debug) setSearchJobDebug(jobDone.raw_debug)
      if (jobDone.progress_text) setSearchProgressText(jobDone.progress_text)
      if (jobDone.paging) setSearchPagingInfo(jobDone.paging)

      // Identifica se veio do cache
      if (jobDone.is_cached || jobDone.strategy_used?.includes('cached')) {
        setCachedJobInfo({
          isCached: true,
          cachedAt: jobDone.cached_at || jobDone.created,
        })
      } else {
        setCachedJobInfo(null)
      }

      if (results.length === 0) {
        toast({
          title: 'Nenhum produto de catálogo encontrado',
          description: 'Tente outro termo ou cole o link direto do produto (/p/MLB...).',
        })
        setCatalogItems([])
        return
      }

      const formatted = processCatalogResults(results, q, condToUse)
      setCatalogItems(formatted)

      const isDirectCode = isDirectCodeQuery
      const tokens = isDirectCode ? [] : extractCatalogSearchTokens(q)
      const strictCount = isDirectCode
        ? formatted.length
        : formatted.filter(
            (it) =>
              evaluateCatalogItemStrictMatch(
                it.catalogProduct.title,
                tokens,
                it.catalogProduct.attributes,
                condToUse,
                it.catalogProduct.condition,
              ).isMatch,
          ).length

      const pagesFetched = jobDone.paging?.pages_fetched || 1
      const pageTextSummary = pagesFetched > 1 ? ` em ${pagesFetched} páginas` : ''

      if (!isDirectCode && tokens.length > 0 && strictCount < results.length) {
        toast({
          title: `Busca profunda: ${strictCount} de ${results.length} posições relevantes${pageTextSummary}`,
          description: `${results.length - strictCount} anúncio(s) descartado(s) pelo filtro rigoroso de termos.`,
        })
      } else {
        const matchedCount = formatted.filter((f) => f.matchedProducts.length > 0).length
        toast({
          title: `${results.length} posições encontradas${pageTextSummary}`,
          description:
            matchedCount > 0
              ? `${matchedCount} possuem sugestão de match com seu estoque.`
              : 'Preços e quantidades podem ser editados livremente na linha.',
        })
      }
    } catch (err: any) {
      console.error('Erro na busca de catálogo:', err)
      const rawMsg = err?.message || ''
      let friendlyMsg = 'Não foi possível consultar as posições do Mercado Livre.'
      if (rawMsg.includes('Failed to create record')) {
        friendlyMsg =
          'Erro temporário de comunicação ao registrar a busca profunda. Tente novamente em alguns segundos.'
      } else if (rawMsg) {
        friendlyMsg = rawMsg
      }

      toast({
        title: 'Erro na busca de catálogo',
        description: friendlyMsg,
        variant: 'destructive',
      })
    } finally {
      setSearching(false)
      setCurrentJobId(null)
    }
  }

  // Alternar seleção
  function toggleItemSelection(index: number) {
    setCatalogItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], selected: !next[index].selected }
      return next
    })
  }

  // Selecionar todos / nenhum (se o filtro rígido estiver ativo e descartados estiverem ocultos, opera sobre os visíveis)
  function toggleSelectAll(select: boolean) {
    setCatalogItems((prev) =>
      prev.map((item, idx) => {
        if (!isFilterActive || showPartialResults) {
          return { ...item, selected: select }
        }
        // Se filtro ativo e descartados ocultos, só altera os strict
        const isStrict = evaluateCatalogItemStrictMatch(
          item.catalogProduct.title,
          currentTokens,
          item.catalogProduct.attributes,
          conditionFilter,
          item.catalogProduct.condition,
        ).isMatch
        if (isStrict) {
          return { ...item, selected: select }
        }
        return item
      }),
    )
  }

  // Alterar quantidade inline
  function updateQuantity(index: number, qty: number) {
    setCatalogItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], formQuantity: Math.max(1, qty) }
      return next
    })
  }

  // Alterar valor inline
  function updatePrice(index: number, price: number) {
    setCatalogItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], formPrice: Math.max(1, price) }
      return next
    })
  }

  // Alterar condição inline
  function updateCondition(index: number, condition: PublishConditionOption) {
    setCatalogItems((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        formCondition: condition,
        formConditionGrade: next[index].formConditionGrade || 'Excelente',
      }
      return next
    })
  }

  // Alterar grau inline
  function updateConditionGrade(index: number, grade: RefurbishedGrade) {
    setCatalogItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], formConditionGrade: grade }
      return next
    })
  }

  // Aplicar condição em lote para os itens selecionados
  function applyBatchCondition(condition: PublishConditionOption, grade?: RefurbishedGrade) {
    setCatalogItems((prev) =>
      prev.map((item) =>
        item.selected
          ? {
              ...item,
              formCondition: condition,
              ...(grade ? { formConditionGrade: grade } : {}),
            }
          : item,
      ),
    )
    const count = catalogItems.filter((i) => i.selected).length
    const labelMap: Record<PublishConditionOption, string> = {
      catalog_auto: 'Herdar do catálogo (padrão)',
      new: 'Novo',
      used: 'Usado',
      refurbished: grade ? `Recondicionado · ${grade}` : 'Recondicionado',
      open_box: 'Caixa aberta',
    }
    toast({
      title: 'Condição aplicada em lote',
      description: `Condição "${labelMap[condition]}" aplicada para ${count} posição(ões) selecionada(s).`,
    })
  }

  // Aplicar grau em lote para os itens selecionados
  function applyBatchGrade(grade: RefurbishedGrade) {
    setCatalogItems((prev) =>
      prev.map((item) => (item.selected ? { ...item, formConditionGrade: grade } : item)),
    )
    const count = catalogItems.filter((i) => i.selected).length
    toast({
      title: 'Grau aplicado em lote',
      description: `Grau "${grade}" aplicado para ${count} posição(ões) selecionada(s).`,
    })
  }

  // Alterar produto local vinculado
  function updateSelectedProduct(index: number, productId: string) {
    setCatalogItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], selectedProductId: productId }
      return next
    })
  }

  // Publicar anúncios de catálogo selecionados em massa
  async function handlePublishSelected() {
    const selectedItems = catalogItems.filter((it) => it.selected)
    if (selectedItems.length === 0) {
      toast({
        title: 'Nenhum anúncio selecionado',
        description: 'Marque pelo menos uma posição de catálogo para publicar.',
        variant: 'destructive',
      })
      return
    }

    setIsPublishing(true)
    setPublishProgress({ current: 0, total: selectedItems.length, percent: 0 })
    setPublishLogs([])

    const logs: Array<{
      id: string
      catalog_product_id: string
      status: 'pending' | 'processing' | 'done' | 'error'
      message?: string
      listing_id?: string
      listing_url?: string
      canRetry?: boolean
      itemIndex?: number
    }> = selectedItems.map((it) => {
      const originalIdx = catalogItems.findIndex(
        (ci) => ci.catalogProduct.catalog_product_id === it.catalogProduct.catalog_product_id,
      )
      return {
        id: '',
        catalog_product_id: it.catalogProduct.catalog_product_id,
        status: 'pending',
        message: `Enfileirando publicação para ${it.catalogProduct.title}...`,
        itemIndex: originalIdx,
        canRetry: false,
      }
    })
    setPublishLogs([...logs])

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i]
      setPublishProgress({
        current: i + 1,
        total: selectedItems.length,
        percent: Math.round(((i + 1) / selectedItems.length) * 100),
      })

      // Atualiza status do log para processando
      logs[i].status = 'processing'
      logs[i].message = 'Enviando anúncio para o Mercado Livre...'
      logs[i].canRetry = false
      setPublishLogs([...logs])

      try {
        const itemCondSent =
          item.formCondition === 'catalog_auto'
            ? item.catalogProduct.condition || 'new'
            : item.formCondition

        const gradeToSend =
          itemCondSent === 'refurbished' ? item.formConditionGrade || 'Excelente' : undefined

        const job = await mlCatalogService.createPublishJob({
          catalog_product_id: item.catalogProduct.catalog_product_id,
          product_id: item.selectedProductId,
          price: item.formPrice,
          quantity: item.formQuantity,
          domain_id: item.catalogProduct.domain_id || '',
          condition: itemCondSent,
          condition_grade: gradeToSend,
        })

        logs[i].id = job.id
        setPublishLogs([...logs])

        // Aguardar término do job de publicação
        const completed = await mlCatalogService.pollPublishJob(job.id, (cur) => {
          if (cur.status === 'processing') {
            logs[i].message = 'Processando publicação no Mercado Livre...'
            setPublishLogs([...logs])
          }
        })

        if (completed.status === 'done') {
          successCount++
          logs[i].status = 'done'
          logs[i].listing_id = completed.ml_listing_id
          logs[i].listing_url = completed.ml_listing_url
          if (itemCondSent === 'refurbished') {
            const chosenGrade = item.formConditionGrade || 'Excelente'
            logs[i].message =
              `Recondicionado · Grau ${chosenGrade} publicado com sucesso! ID: ${completed.ml_listing_id}`
          } else {
            logs[i].message = `Publicado com sucesso! ID: ${completed.ml_listing_id}`
          }
          logs[i].canRetry = false
        } else {
          errorCount++
          logs[i].status = 'error'
          logs[i].message = completed.error_message || 'Falha na publicação do anúncio.'
          logs[i].canRetry = true
        }
      } catch (err: any) {
        errorCount++
        logs[i].status = 'error'
        logs[i].message = err.message || 'Erro inesperado de comunicação com a fila.'
        logs[i].canRetry = true
      }

      setPublishLogs([...logs])
    }

    setIsPublishing(false)

    if (successCount > 0 && errorCount === 0) {
      toast({
        title: 'Publicação concluída com sucesso!',
        description: `${successCount} anúncio(s) de catálogo publicado(s) no Mercado Livre.`,
      })
    } else if (successCount > 0 && errorCount > 0) {
      toast({
        title: 'Publicação parcial realizada',
        description: `${successCount} publicado(s) com sucesso e ${errorCount} com exigências do Mercado Livre.`,
      })
    } else {
      toast({
        title: 'Falha na publicação em massa',
        description: 'Revise as mensagens de retorno do Mercado Livre para cada anúncio.',
        variant: 'destructive',
      })
    }
  }

  // Reprocessar/tentar novamente uma publicação específica da lista
  async function handleRetryPublish(logIdx: number) {
    const targetLog = publishLogs[logIdx]
    if (!targetLog) return

    const item = catalogItems.find(
      (ci) => ci.catalogProduct.catalog_product_id === targetLog.catalog_product_id,
    )
    if (!item) return

    setRetryingJobId(targetLog.catalog_product_id)

    setPublishLogs((prev) => {
      const next = [...prev]
      next[logIdx] = {
        ...next[logIdx],
        status: 'processing',
        message: 'Reenviando anúncio corrigido para o Mercado Livre...',
        canRetry: false,
      }
      return next
    })

    try {
      const itemCondSent =
        item.formCondition === 'catalog_auto'
          ? item.catalogProduct.condition || 'new'
          : item.formCondition

      const gradeToSend =
        itemCondSent === 'refurbished' ? item.formConditionGrade || 'Excelente' : undefined

      const newJob = await mlCatalogService.createPublishJob({
        catalog_product_id: item.catalogProduct.catalog_product_id,
        product_id: item.selectedProductId,
        price: item.formPrice,
        quantity: item.formQuantity,
        domain_id: item.catalogProduct.domain_id || '',
        condition: itemCondSent,
        condition_grade: gradeToSend,
      })

      const completed = await mlCatalogService.pollPublishJob(newJob.id, (cur) => {
        if (cur.status === 'processing') {
          setPublishLogs((prev) => {
            const next = [...prev]
            next[logIdx] = {
              ...next[logIdx],
              message: 'Processando no Mercado Livre...',
            }
            return next
          })
        }
      })

      if (completed.status === 'done') {
        setPublishLogs((prev) => {
          const next = [...prev]
          next[logIdx] = {
            ...next[logIdx],
            id: completed.id,
            status: 'done',
            listing_id: completed.ml_listing_id,
            listing_url: completed.ml_listing_url,
            message: `Publicado com sucesso! ID: ${completed.ml_listing_id}`,
            canRetry: false,
          }
          return next
        })
        const successDesc =
          itemCondSent === 'refurbished'
            ? `Anúncio ${completed.ml_listing_id} criado como Recondicionado · Grau ${item.formConditionGrade || 'Excelente'}.`
            : `Anúncio ${completed.ml_listing_id} criado no catálogo.`
        toast({
          title: 'Anúncio publicado com sucesso!',
          description: successDesc,
        })
      } else {
        const errorMsgToShow = completed.error_message || 'Falha na publicação.'

        setPublishLogs((prev) => {
          const next = [...prev]
          next[logIdx] = {
            ...next[logIdx],
            id: completed.id,
            status: 'error',
            message: errorMsgToShow,
            canRetry: true,
          }
          return next
        })
        toast({
          title: 'Não foi possível publicar',
          description: errorMsgToShow,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      const errorMsgToShow = err.message || 'Erro ao comunicar com a fila.'

      setPublishLogs((prev) => {
        const next = [...prev]
        next[logIdx] = {
          ...next[logIdx],
          status: 'error',
          message: errorMsgToShow,
          canRetry: true,
        }
        return next
      })
    } finally {
      setRetryingJobId(null)
    }
  }

  // Tokens de busca ativos para avaliação de filtro e destaque
  const isDirectCode = isDirectCatalogCodeQuery(activeSearchTerm)
  const currentTokens = isDirectCode ? [] : extractCatalogSearchTokens(activeSearchTerm)
  const isFilterActive = !isDirectCode && currentTokens.length > 0

  // Helper para renderizar badge de vendas
  function renderSoldBadge(sold?: number | null) {
    if (sold === null || sold === undefined || isNaN(sold)) {
      return (
        <Badge
          variant="outline"
          className="bg-slate-50 text-slate-400 border-slate-200 text-[10px] font-normal"
          title="Quantidade de vendas não informada pelo Mercado Livre"
        >
          Vendas não informadas
        </Badge>
      )
    }
    const label = formatMLSoldQuantity(sold)
    const n = Math.max(0, Math.floor(sold))
    const isHot = n >= 100
    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-semibold gap-1 ${
          isHot
            ? 'bg-amber-50 text-amber-900 border-amber-300'
            : n > 0
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}
        title={`Histórico no Mercado Livre: ${label}`}
      >
        <span>🛒</span>
        <span>{label}</span>
      </Badge>
    )
  }

  // Helper para renderizar a badge de classificação/condição da posição de catálogo
  function renderConditionBadge(cat: {
    condition?: string
    condition_label?: string
    condition_grade?: string
    is_own_account?: boolean
    own_ad_id?: string
  }) {
    const cond = (cat.condition || 'new').toLowerCase()
    const normGrade = normalizeRefurbishedGrade(cat.condition_grade)
    const isOwn = Boolean(cat.is_own_account)
    const badgeInfo = getConditionBadgeInfo(cond, cat.condition_grade)

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Badge distintiva "Sua posição" com ícone de verificado azul/índigo */}
        {isOwn && (
          <Badge
            className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 text-[10px] font-bold flex items-center gap-1 shadow-2xs px-2 py-0.5"
            title={`Posição de catálogo minerada da sua conta Mercado Livre${cat.own_ad_id ? ` (Anúncio ${cat.own_ad_id})` : ''}`}
          >
            <BadgeCheck className="w-3.5 h-3.5 text-indigo-100 shrink-0" />
            <span>Sua posição</span>
            {cat.own_ad_id && (
              <span className="text-[9px] bg-indigo-800/80 px-1 py-0.2 rounded text-indigo-100 font-mono">
                {cat.own_ad_id}
              </span>
            )}
          </Badge>
        )}

        {cond === 'refurbished' && (
          <Badge
            className={`text-[10px] font-semibold flex items-center gap-1 shadow-2xs ${
              normGrade === 'Excelente'
                ? 'bg-purple-900 text-white border-purple-950'
                : normGrade === 'Bom'
                  ? 'bg-purple-600 text-white border-purple-700'
                  : normGrade === 'Aceitável'
                    ? 'bg-purple-300 text-purple-950 border-purple-400 font-bold'
                    : 'bg-purple-600 text-white border-purple-700'
            }`}
            title={`Classificação Recondicionado ${normGrade ? `(Grau ${normGrade})` : ''} no ML — estoque compatível com a loja`}
          >
            <Sparkles className="w-3 h-3 opacity-90" />
            <span>{badgeInfo.label}</span>
            <span className="text-[9px] bg-black/20 px-1 py-0.2 rounded font-mono ml-0.5">
              Estoque compatível
            </span>
          </Badge>
        )}

        {cond === 'open_box' && (
          <Badge
            className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700 text-[10px] font-semibold flex items-center gap-1 shadow-2xs"
            title="Classificação Caixa aberta no ML — aceito em posições de catálogo Novas"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-200" />
            <span>{badgeInfo.label}</span>
          </Badge>
        )}

        {cond === 'used' && (
          <Badge
            className="bg-amber-500 hover:bg-amber-600 text-white border-amber-600 text-[10px] font-semibold flex items-center gap-1 shadow-2xs"
            title="Classificação Usado no catálogo Mercado Livre"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-100" />
            <span>{badgeInfo.label}</span>
          </Badge>
        )}

        {(cond === 'unknown' || cond === 'not_specified') && (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-medium flex items-center gap-1"
            title="Posição sem condição declarada no catálogo"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>{cat.condition_label || 'Condição não informada'}</span>
          </Badge>
        )}

        {cond !== 'refurbished' &&
          cond !== 'open_box' &&
          cond !== 'used' &&
          cond !== 'unknown' &&
          cond !== 'not_specified' && (
            <Badge
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 text-[10px] font-semibold flex items-center gap-1 shadow-2xs"
              title="Classificação Novo de fábrica no catálogo oficial Mercado Livre"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>{badgeInfo.label}</span>
            </Badge>
          )}
      </div>
    )
  }

  // Contadores para os chips de filtro por classificação
  const countTotal = catalogItems.length
  const countRefurbished = catalogItems.filter(
    (it) => it.catalogProduct.condition === 'refurbished',
  ).length
  const countOpenBox = catalogItems.filter(
    (it) => it.catalogProduct.condition === 'open_box',
  ).length
  const countNew = catalogItems.filter(
    (it) => !it.catalogProduct.condition || it.catalogProduct.condition === 'new',
  ).length
  const countUsed = catalogItems.filter((it) => it.catalogProduct.condition === 'used').length

  // Contadores específicos de cada grau de recondicionado entre os itens recondicionados
  const countGradeExcelente = catalogItems.filter((it) => {
    if (it.catalogProduct.condition !== 'refurbished') return false
    const g = normalizeRefurbishedGrade(it.catalogProduct.condition_grade)
    return g === 'Excelente' || !g
  }).length
  const countGradeBom = catalogItems.filter((it) => {
    if (it.catalogProduct.condition !== 'refurbished') return false
    return normalizeRefurbishedGrade(it.catalogProduct.condition_grade) === 'Bom'
  }).length
  const countGradeAceitavel = catalogItems.filter((it) => {
    if (it.catalogProduct.condition !== 'refurbished') return false
    return normalizeRefurbishedGrade(it.catalogProduct.condition_grade) === 'Aceitável'
  }).length

  // Avaliação de cada item em relação aos termos buscados e ao filtro de condição dos chips
  const evaluatedItems = catalogItems.map((item, originalIndex) => {
    const catProd = item.catalogProduct
    const evalResult = isFilterActive
      ? evaluateCatalogItemStrictMatch(catProd.title, currentTokens, catProd.attributes)
      : { isMatch: true, matchedTokens: currentTokens, missingTokens: [] }

    // Avalia também o filtro de condição ativo dos chips (Todas | Recondicionado | Novo | Usado | Caixa aberta)
    const itemCond = (catProd.condition || 'new').toLowerCase()
    const isUnknownCondition = itemCond === 'unknown' || itemCond === 'not_specified'

    let matchesCondition =
      conditionFilter === 'all'
        ? true
        : conditionFilter === 'refurbished'
          ? itemCond === 'refurbished'
          : conditionFilter === 'open_box'
            ? itemCond === 'open_box'
            : conditionFilter === 'new'
              ? itemCond === 'new'
              : conditionFilter === 'used'
                ? itemCond === 'used'
                : !isUnknownCondition

    // Se o filtro de condição for 'refurbished' e houver sub-filtro de grau selecionado
    if (matchesCondition && conditionFilter === 'refurbished' && gradeFilter !== 'all') {
      const itemGrade = normalizeRefurbishedGrade(catProd.condition_grade) || 'Excelente'
      if (itemGrade !== gradeFilter) {
        matchesCondition = false
      }
    }

    return {
      item,
      originalIndex,
      isMatch: evalResult.isMatch,
      matchesCondition,
      matchedTokens: evalResult.matchedTokens,
      missingTokens: evalResult.missingTokens,
    }
  })

  // Ordenador de itens conforme critério catalogSortBy
  function sortEvaluatedEntries<T extends { item: CatalogMatchResult; originalIndex: number }>(
    entries: T[],
  ): T[] {
    if (catalogSortBy === 'relevance') {
      return entries
    }
    const cloned = [...entries]
    return cloned.sort((a, b) => {
      const prodA = a.item.catalogProduct
      const prodB = b.item.catalogProduct

      if (catalogSortBy === 'sold_desc') {
        const soldA =
          prodA.sold_quantity != null && !isNaN(prodA.sold_quantity) ? prodA.sold_quantity : -1
        const soldB =
          prodB.sold_quantity != null && !isNaN(prodB.sold_quantity) ? prodB.sold_quantity : -1
        // Se ambos não tiverem informação de vendas (-1), mantém ordem original
        if (soldA === -1 && soldB === -1) return a.originalIndex - b.originalIndex
        // Posições sem informação de vendas vão para o fim da lista
        if (soldA === -1) return 1
        if (soldB === -1) return -1
        if (soldB !== soldA) {
          return soldB - soldA
        }
        return a.originalIndex - b.originalIndex
      }

      if (catalogSortBy === 'price_asc') {
        const pA = a.item.formPrice ?? prodA.buy_box_winner_price ?? 999999999
        const pB = b.item.formPrice ?? prodB.buy_box_winner_price ?? 999999999
        return pA - pB
      }

      if (catalogSortBy === 'price_desc') {
        const pA = a.item.formPrice ?? prodA.buy_box_winner_price ?? 0
        const pB = b.item.formPrice ?? prodB.buy_box_winner_price ?? 0
        return pB - pA
      }

      if (catalogSortBy === 'stock_desc') {
        const sA = prodA.buy_box_winner_stock ?? a.item.totalAvailableStock ?? 0
        const sB = prodB.buy_box_winner_stock ?? b.item.totalAvailableStock ?? 0
        return sB - sA
      }

      return a.originalIndex - b.originalIndex
    })
  }

  // Itens estritos e parciais/descartados filtrados pela condição selecionada e ordenados
  const strictItems = sortEvaluatedEntries(
    evaluatedItems.filter((entry) => entry.isMatch && entry.matchesCondition),
  )
  const partialItems = sortEvaluatedEntries(
    evaluatedItems.filter((entry) => !entry.isMatch && entry.matchesCondition),
  )

  const selectedCount = catalogItems.filter((i) => i.selected).length

  // Conta quantas posições da própria conta foram recuperadas com a condição selecionada
  const ownAccountItemsInResults = catalogItems.filter(
    (it) =>
      it.catalogProduct.is_own_account &&
      (conditionFilter === 'all' || it.catalogProduct.condition === conditionFilter),
  )
  const openCatalogHasCondition = catalogItems.some(
    (it) =>
      !it.catalogProduct.is_own_account &&
      (conditionFilter === 'all' || it.catalogProduct.condition === conditionFilter),
  )

  return (
    <div className="space-y-6">
      {/* Banner Explicativo com Informações do Catálogo */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white shadow-xs">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Anúncios de Catálogo Mercado Livre
                  </h3>
                  <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-[10px] font-mono">
                    Gestão Direta ML
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Publique anúncios direto na sua conta Mercado Livre a partir das posições de
                  catálogo — sem depender do estoque do sistema. Dispute a <strong>Buy Box</strong>{' '}
                  oficial, ajuste quantidade e preço livremente em cada linha e envie para o ML com
                  1 clique.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href="https://vendedores.mercadolivre.com.br/catalogo/explorar"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 hover:bg-blue-50/80 px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
              >
                Explorador de Catálogo ML <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Box Informativo Permanente: Regras de Condição no Catálogo */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50/60 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-slate-700">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                  Regras Reais de Condição no Catálogo do Mercado Livre (4 Opções Oficiais)
                </h4>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-white border-indigo-300 text-indigo-900 font-medium"
                >
                  Regra Validada na API ML
                </Badge>
              </div>
              <p className="font-semibold text-slate-800">
                Cada posição de catálogo aceita as condições de sua família: posições{' '}
                <span className="text-emerald-700 font-bold">Novas</span> aceitam{' '}
                <strong className="text-emerald-700">Novo</strong> e{' '}
                <strong className="text-blue-700">Caixa aberta</strong>;{' '}
                <span className="text-purple-700 font-bold">Recondicionado</span> agora utiliza o
                mecanismo oficial descoberto do painel do Mercado Livre (envia a condição raiz
                aceita com atributo de recondicionado e o Grau selecionado (Excelente, Bom ou
                Aceitável — os 3 graus oficiais do Mercado Livre)), permitindo publicar a partir da
                posição base da família mesmo que ela não possuísse anúncio recondicionado prévio.
              </p>
              <p className="text-slate-600">
                Ao publicar como <strong>Recondicionado</strong>, o Mercado Livre cria e vincula
                automaticamente a posição de recondicionado da família na sua conta com o Grau
                selecionado (Excelente, Bom ou Aceitável). Caso o ML exija posição prévia estrita, o
                sistema ainda conta com o <strong>fallback automático para Usado</strong> como rede
                de segurança.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-800 font-medium">
                <div className="flex items-start gap-1.5 bg-white/90 p-2 rounded border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                  <div>
                    <strong className="text-emerald-900">Novo:</strong>
                    <span className="text-slate-600 block text-[10px]">
                      Lacrado de fábrica. Aceito na maioria das posições do catálogo.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-1.5 bg-white/90 p-2 rounded border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                  <div>
                    <strong className="text-blue-900">Caixa aberta:</strong>
                    <span className="text-slate-600 block text-[10px]">
                      Embalagem aberta/reembalado. Aceito diretamente nas posições Novas.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-1.5 bg-white/90 p-2 rounded border border-purple-200">
                  <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0 mt-1" />
                  <div>
                    <strong className="text-purple-900">Recondicionado:</strong>
                    <span className="text-slate-600 block text-[10px]">
                      3 graus oficiais: Excelente (roxo escuro), Bom (roxo médio) e Aceitável (roxo
                      claro).
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-1.5 bg-white/90 p-2 rounded border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />
                  <div>
                    <strong className="text-amber-900">Usado:</strong>
                    <span className="text-slate-600 block text-[10px]">
                      Equipamentos usados; rede de segurança e fallback automático.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Caixa de Busca com Exemplos Rápidos e Seletor de Condição */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Campo de Busca por Título ou Link */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Ex: dell latitude 3420, lenovo t480, ou link direto /p/MLB..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={searching}
                className="pl-10 text-sm h-11 bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>

            {/* Seletor de Condição ao lado da Busca (4 opções reais do painel ML) */}
            <div className="w-full sm:w-auto shrink-0">
              <Select
                value={searchCondition}
                onValueChange={(val) => {
                  const newCond = val as 'all' | 'new' | 'used' | 'refurbished' | 'open_box'
                  setSearchCondition(newCond)
                  if (catalogItems.length > 0) {
                    setConditionFilter(newCond)
                  }
                }}
                disabled={searching}
              >
                <SelectTrigger
                  aria-label="Condição para buscar"
                  className="h-11 w-full sm:w-[210px] bg-slate-50 border-slate-200 focus:bg-white text-xs font-semibold text-slate-800"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <SelectValue placeholder="Todas as condições" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-medium">
                    Todas as condições
                  </SelectItem>
                  <SelectItem value="new" className="text-xs font-medium">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      Novo
                    </span>
                  </SelectItem>
                  <SelectItem value="open_box" className="text-xs font-medium">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      Caixa aberta
                    </span>
                  </SelectItem>
                  <SelectItem value="refurbished" className="text-xs font-medium">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                      Recondicionado
                    </span>
                  </SelectItem>
                  <SelectItem value="used" className="text-xs font-medium">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      Usado
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão de Busca */}
            <Button
              onClick={() => handleSearch()}
              disabled={searching}
              className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
            >
              {searching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Buscando Profundo...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Busca Profunda ML
                </>
              )}
            </Button>
          </div>

          {/* Aviso de Resultados Obtidos em Cache com Botão de Forçar Atualização */}
          {cachedJobInfo?.isCached && !searching && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Resultados carregados instantaneamente do cache recente (
                  {cachedJobInfo.cachedAt
                    ? new Date(cachedJobInfo.cachedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '15 min'}
                  ).
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSearch(undefined, undefined, true)}
                className="h-7 text-xs bg-white border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold shrink-0"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Forçar busca nova
              </Button>
            </div>
          )}

          {/* Feedback de Progresso da Busca Profunda em Tempo Real com Streaming e Botão Parar */}
          {searching && (
            <div className="p-3.5 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-lg space-y-2 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-blue-950">
                      {searchProgressText ||
                        'Executando varreduras paralelas no catálogo do Mercado Livre...'}
                    </p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Resultados parciais aparecem na grade em tempo real. Você já pode trabalhar
                      enquanto o restante é vasculhado.
                    </p>
                  </div>
                </div>

                {/* Botão Parar e Usar o que Já Tenho */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStopSearch}
                  disabled={stoppingJob}
                  className="h-8 px-3 text-xs bg-white hover:bg-rose-50 border-rose-300 text-rose-700 font-semibold shrink-0 shadow-2xs hover:border-rose-400"
                >
                  <X className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  {stoppingJob ? 'Parando...' : 'Parar e usar o que já tenho'}
                </Button>
              </div>

              {/* Métricas honestas de progresso */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-blue-200/60 text-[11px] text-blue-900 font-medium">
                <Badge
                  variant="outline"
                  className="bg-white text-blue-800 font-mono text-[10px] border-blue-300"
                >
                  {catalogItems.length} posições na grade agora
                </Badge>
                {searchPagingInfo?.sub_searches_total ? (
                  <span className="text-blue-700">
                    Varredura {searchPagingInfo.sub_searches_completed || 1} de{' '}
                    {searchPagingInfo.sub_searches_total}
                  </span>
                ) : null}
                {searchPagingInfo?.pages_fetched ? (
                  <span className="text-blue-600">
                    • {searchPagingInfo.pages_fetched} páginas consultadas
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* Atalhos Rápidos */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
            <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">
              Sugestões rápidas:
            </span>
            {[
              {
                term: 'dell inspiron 3576',
                cond: 'refurbished' as const,
                label: 'dell inspiron 3576 (recond.)',
              },
              {
                term: 'dell latitude 5420',
                cond: 'refurbished' as const,
                label: 'dell 5420 (recond.)',
              },
              { term: 'dell latitude 3420', cond: 'all' as const, label: 'dell latitude 3420' },
              {
                term: 'lenovo thinkpad t480',
                cond: 'used' as const,
                label: 'thinkpad t480 (usado)',
              },
              { term: 'dell latitude 5320', cond: 'all' as const, label: 'dell latitude 5320' },
              { term: 'MLB2097858038', cond: 'all' as const, label: 'MLB2097858038 (direto)' },
              {
                term: 'thinkpad t580',
                cond: 'refurbished' as const,
                label: 'thinkpad t580 (recond.)',
              },
            ].map(({ term, cond, label }) => (
              <button
                key={term + cond}
                type="button"
                onClick={() => {
                  setQuery(term)
                  setSearchCondition(cond)
                  handleSearch(term, cond)
                }}
                disabled={searching}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors text-xs font-mono"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Diagnóstico da Fonte / Cascata e Resumo da Paginação */}
          {lastStrategy && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-600">Origem:</span>
                <Badge variant="outline" className="text-[10px] font-mono bg-slate-50">
                  {lastStrategy === 'api_products_fanout' &&
                    'API Oficial ML com Busca em Leque (Fan-out)'}
                  {lastStrategy === 'own_account_mined' && 'Anúncios da Conta + Busca em Leque'}
                  {lastStrategy === 'api_products_search' && 'API Oficial ML Paginada'}
                  {lastStrategy === 'api_products_direct' &&
                    'Consulta Direta de Catálogo (/products/{id})'}
                  {lastStrategy === 'html_scrape_catalog_links' &&
                    'Cascata Scraping de Catálogo ML'}
                  {lastStrategy === 'none' && 'Nenhum resultado retornado'}
                </Badge>

                {searchPagingInfo && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-mono bg-blue-50 text-blue-900 border-blue-200"
                  >
                    {catalogItems.length} posições únicas cobertas
                    {searchPagingInfo.universe_estimated_total &&
                    searchPagingInfo.universe_estimated_total > catalogItems.length
                      ? ` de ~${searchPagingInfo.universe_estimated_total} anunciadas`
                      : ''}
                    {searchPagingInfo.sub_searches_completed &&
                    searchPagingInfo.sub_searches_completed > 1
                      ? ` (${searchPagingInfo.sub_searches_completed} varreduras, ${searchPagingInfo.pages_fetched || 1} págs)`
                      : ` (${searchPagingInfo.pages_fetched || 1} págs)`}
                  </Badge>
                )}
              </div>

              {searchJobDebug.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDebug(!showDebug)}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-mono"
                >
                  {showDebug ? 'Ocultar logs da fila' : 'Ver logs técnicos da fila'}
                  {showDebug ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          )}

          {showDebug && searchJobDebug.length > 0 && (
            <div className="p-3 bg-slate-900 text-slate-200 text-xs font-mono rounded-lg space-y-1 max-h-48 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-700 pb-1 mb-1">
                Logs de execução do Hook no Backend
              </p>
              {searchJobDebug.map((line, idx) => (
                <div key={idx} className="leading-relaxed">
                  {line}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chips de Filtro por Classificação / Condição */}
      {catalogItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Classificação:
          </span>

          <button
            type="button"
            onClick={() => setConditionFilter('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              conditionFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span>Todas</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                conditionFilter === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {countTotal}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setConditionFilter('new')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              conditionFilter === 'new'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Novo</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                conditionFilter === 'new'
                  ? 'bg-emerald-800 text-emerald-100'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {countNew}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setConditionFilter('open_box')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              conditionFilter === 'open_box'
                ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                : 'bg-white hover:bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Caixa aberta</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                conditionFilter === 'open_box'
                  ? 'bg-blue-800 text-blue-100'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {countOpenBox}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConditionFilter('refurbished')
              setGradeFilter('all')
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              conditionFilter === 'refurbished'
                ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                : 'bg-white hover:bg-purple-50 text-purple-900 border-purple-200'
            }`}
          >
            <Sparkles className="w-3 h-3 text-purple-300" />
            <span>Recondicionado</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                conditionFilter === 'refurbished'
                  ? 'bg-purple-800 text-purple-100'
                  : 'bg-purple-100 text-purple-800'
              }`}
            >
              {countRefurbished}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setConditionFilter('used')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              conditionFilter === 'used'
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Usado</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                conditionFilter === 'used'
                  ? 'bg-amber-700 text-amber-100'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {countUsed}
            </span>
          </button>
        </div>
      )}

      {/* Sub-chips de Grau quando a classificação Recondicionado estiver ativa na aba Catálogo */}
      {catalogItems.length > 0 && conditionFilter === 'refurbished' && (
        <div className="flex items-center gap-2 flex-wrap px-1 pt-1 pb-1 animate-fadeIn bg-purple-50/60 p-2.5 rounded-lg border border-purple-200/80">
          <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            Grau Recondicionado:
          </span>

          <button
            type="button"
            onClick={() => setGradeFilter('all')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
              gradeFilter === 'all'
                ? 'bg-purple-950 text-white border-purple-950 shadow-2xs'
                : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-100/60'
            }`}
          >
            <span>Todos os graus</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                gradeFilter === 'all'
                  ? 'bg-purple-800 text-purple-100'
                  : 'bg-purple-100 text-purple-800'
              }`}
            >
              {countRefurbished}
            </span>
          </button>

          {/* Excelente: Roxo escuro */}
          <button
            type="button"
            onClick={() => setGradeFilter('Excelente')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
              gradeFilter === 'Excelente'
                ? 'bg-purple-900 text-white border-purple-950 shadow-2xs ring-1 ring-purple-950'
                : 'bg-white text-purple-950 border-purple-800 hover:bg-purple-900/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-900" />
            <span>Excelente</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                gradeFilter === 'Excelente'
                  ? 'bg-purple-950 text-purple-100'
                  : 'bg-purple-100 text-purple-900 font-bold'
              }`}
            >
              {countGradeExcelente}
            </span>
          </button>

          {/* Bom: Roxo médio */}
          <button
            type="button"
            onClick={() => setGradeFilter('Bom')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
              gradeFilter === 'Bom'
                ? 'bg-purple-600 text-white border-purple-700 shadow-2xs ring-1 ring-purple-700'
                : 'bg-white text-purple-700 border-purple-400 hover:bg-purple-600/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-600" />
            <span>Bom</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                gradeFilter === 'Bom'
                  ? 'bg-purple-800 text-purple-100'
                  : 'bg-purple-100 text-purple-800 font-bold'
              }`}
            >
              {countGradeBom}
            </span>
          </button>

          {/* Aceitável: Roxo claro */}
          <button
            type="button"
            onClick={() => setGradeFilter('Aceitável')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
              gradeFilter === 'Aceitável'
                ? 'bg-purple-400 text-purple-950 border-purple-500 shadow-2xs ring-1 ring-purple-500 font-bold'
                : 'bg-white text-purple-800 border-purple-300 hover:bg-purple-300/20'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>Aceitável</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                gradeFilter === 'Aceitável'
                  ? 'bg-purple-500 text-purple-950 font-black'
                  : 'bg-purple-100 text-purple-800 font-bold'
              }`}
            >
              {countGradeAceitavel}
            </span>
          </button>
        </div>
      )}

      {/* Barra de Ações em Massa (quando há resultados) */}
      {catalogItems.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Checkbox
                id="select-all"
                checked={
                  isFilterActive && !showPartialResults
                    ? strictItems.length > 0 && strictItems.every((s) => s.item.selected)
                    : selectedCount > 0 && selectedCount === catalogItems.length
                }
                onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
              />
              <label
                htmlFor="select-all"
                className="text-xs font-bold text-slate-800 cursor-pointer select-none"
              >
                {isFilterActive && !showPartialResults
                  ? `Selecionar todos os ${strictItems.length} resultados filtrados`
                  : `Selecionar todas as ${catalogItems.length} posições`}
              </label>
              <Badge variant="outline" className="bg-white text-slate-700 font-mono text-[11px]">
                {selectedCount} selecionada(s)
              </Badge>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
              {/* Seletor de Condição e Grau em Lote para itens selecionados */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                  Condição em lote:
                </span>
                <select
                  disabled={selectedCount === 0 || isPublishing}
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value
                    if (!val) return
                    if (val.startsWith('refurbished_')) {
                      const grade = val.replace('refurbished_', '') as RefurbishedGrade
                      applyBatchCondition('refurbished', grade)
                    } else {
                      applyBatchCondition(val as PublishConditionOption)
                    }
                    e.target.value = ''
                  }}
                  className="h-8 text-xs bg-white border border-slate-300 rounded-md px-2 font-medium text-slate-700 disabled:opacity-50"
                  aria-label="Aplicar condição em lote para selecionados"
                >
                  <option value="" disabled>
                    Alterar selecionadas...
                  </option>
                  <option value="catalog_auto">Herdar da posição (padrão)</option>
                  <option value="new">Novo</option>
                  <option value="open_box">Caixa aberta</option>
                  <option value="used">Usado</option>
                  <optgroup label="Recondicionado (3 Graus Oficiais ML)">
                    <option value="refurbished_Excelente">Recondicionado · Excelente</option>
                    <option value="refurbished_Bom">Recondicionado · Bom</option>
                    <option value="refurbished_Aceitável">Recondicionado · Aceitável</option>
                  </optgroup>
                </select>
              </div>

              <Button
                onClick={handlePublishSelected}
                disabled={isPublishing || selectedCount === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 shadow-xs flex items-center gap-1.5 shrink-0"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Publicando ({publishProgress.current}/{publishProgress.total})...
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    Publicar {selectedCount} Anúncio(s) de Catálogo
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progresso da Publicação em Massa */}
      {isPublishing && (
        <Card className="border-blue-300 bg-white shadow-sm animate-pulse-subtle">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                Publicando no Mercado Livre via Fila ({publishProgress.current} de{' '}
                {publishProgress.total})
              </span>
              <span className="font-mono text-blue-700">{publishProgress.percent}%</span>
            </div>
            <Progress value={publishProgress.percent} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Logs / Feedback da Publicação em Massa */}
      {publishLogs.length > 0 && (
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              Status da Fila de Publicação em Massa
            </h4>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {publishLogs.map((log, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-md text-xs flex items-start justify-between gap-3 ${
                    log.status === 'done'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : log.status === 'error'
                        ? 'bg-rose-50 border border-rose-200 text-rose-900'
                        : 'bg-slate-50 border border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {log.status === 'done' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {log.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    {log.status === 'processing' && (
                      <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-spin" />
                    )}
                    {log.status === 'pending' && (
                      <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                    )}

                    <div>
                      <span className="font-mono font-bold">{log.catalog_product_id}</span>
                      <p className="mt-0.5 text-[11px] leading-relaxed">{log.message}</p>
                    </div>
                  </div>

                  {log.listing_url && (
                    <a
                      href={log.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-blue-700 hover:underline shrink-0 flex items-center gap-1 font-mono"
                    >
                      Abrir Anúncio <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Resultados de Catálogo Encontrados */}
      {catalogItems.length > 0 && (
        <div className="space-y-4">
          {/* Banner de Transparência do Filtro Rigoroso */}
          {isFilterActive ? (
            <div className="p-3.5 rounded-lg border bg-slate-50 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Filter className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-slate-900">Filtro rigoroso ativo:</span>{' '}
                  <span className="text-slate-700">
                    <strong className="text-emerald-700 font-mono">{strictItems.length}</strong> de{' '}
                    <strong className="font-mono">{catalogItems.length}</strong> resultados contêm
                    todos os termos buscados
                  </span>
                  {currentTokens.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
                      ({currentTokens.map((t) => `+${t}`).join(' ')})
                    </span>
                  )}
                </div>
              </div>

              {partialItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPartialResults(!showPartialResults)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shrink-0 shadow-2xs"
                >
                  {showPartialResults ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                      Ocultar descartados ({partialItems.length})
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      Mostrar também resultados parciais ({partialItems.length})
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500 font-semibold px-1">
              <div className="flex items-center gap-2">
                <span>Posições de Catálogo Encontradas ({catalogItems.length})</span>
                {searchPagingInfo && (searchPagingInfo.pages_fetched || 0) > 1 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {searchPagingInfo.pages_fetched} páginas vasculhadas
                    {searchPagingInfo.sub_searches_completed &&
                    searchPagingInfo.sub_searches_completed > 1
                      ? ` em ${searchPagingInfo.sub_searches_completed} varreduras`
                      : ''}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-slate-400 font-normal">
                {isDirectCode
                  ? 'Busca por código exato de produto de catálogo'
                  : 'Gestão direta na conta ML · Edite a quantidade e valor livremente antes de publicar'}
              </span>
            </div>
          )}

          {/* Alerta informativo quando a posição recondicionada é trazida via conta de vendedor */}
          {ownAccountItemsInResults.length > 0 &&
            !openCatalogHasCondition &&
            conditionFilter !== 'all' && (
              <div className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/80 text-xs text-indigo-950 flex items-start gap-3 shadow-2xs">
                <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <BadgeCheck className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-indigo-950">
                    Posição{' '}
                    {conditionFilter === 'refurbished'
                      ? 'recondicionada'
                      : conditionFilter === 'used'
                        ? 'usada'
                        : 'específica'}{' '}
                    encontrada via sua conta de vendedor ({ownAccountItemsInResults.length}{' '}
                    {ownAccountItemsInResults.length === 1 ? 'posição' : 'posições'})
                  </p>
                  <p className="text-indigo-800 text-[11px] leading-relaxed">
                    As posições da sua conta (INFOPREÇOBAIXO) foram recuperadas e posicionadas no
                    topo com dados completos da Buy Box e GRADING, combinadas com a varredura
                    profunda de catálogo aberta do Mercado Livre.
                  </p>
                </div>
              </div>
            )}

          {/* Se nenhum item passou no filtro rigoroso */}
          {isFilterActive && strictItems.length === 0 && (
            <Card className="border-amber-200 bg-amber-50/50 p-6 text-center">
              <div className="max-w-md mx-auto space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                <h4 className="text-sm font-bold text-amber-900">
                  Nenhum resultado contém todos os termos da busca
                </h4>
                <p className="text-xs text-amber-800">
                  O Mercado Livre retornou {catalogItems.length} produto(s), mas nenhum inclui
                  simultaneamente todos os termos: {currentTokens.map((t) => `"${t}"`).join(', ')}.
                </p>
                {partialItems.length > 0 && !showPartialResults && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPartialResults(true)}
                    className="mt-2 text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
                  >
                    Exibir os {partialItems.length} resultados parciais do Mercado Livre
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Itens que passaram no filtro rigoroso (ou todos se busca direta/sem filtro) */}
          <div className="space-y-3">
            {strictItems.map(({ item, originalIndex, matchedTokens }) => {
              const cat = item.catalogProduct
              const hasMatch = item.matchedProducts.length > 0
              const primaryMatch = item.matchedProducts[0]
              const isBelowBuyBox =
                cat.buy_box_winner_price && item.formPrice < cat.buy_box_winner_price
              const titleSegments = highlightMatchedTitle(cat.title, matchedTokens)

              return (
                <Card
                  key={cat.id || originalIndex}
                  className={`border transition-all ${
                    item.selected
                      ? 'border-blue-300 bg-white shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 opacity-75'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      {/* Checkbox + Foto + Info do Catálogo ML */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={() => toggleItemSelection(originalIndex)}
                          className="mt-1"
                          aria-label={`Selecionar posição ${cat.title}`}
                        />

                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center relative">
                          {cat.thumbnail ? (
                            <img
                              src={cat.thumbnail}
                              alt={cat.title}
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).src =
                                  'https://img.usecurling.com/p/200/200?q=laptop'
                              }}
                            />
                          ) : (
                            <Package className="w-8 h-8 text-slate-300" />
                          )}
                        </div>

                        {/* Dados Básicos do Produto no Mercado Livre */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-mono"
                            >
                              {cat.catalog_product_id}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]"
                            >
                              {cat.domain_id || 'Catálogo ML'}
                            </Badge>

                            {/* Badge de Classificação / Condição do Mercado Livre */}
                            {renderConditionBadge(cat)}

                            {/* Badge discreto de vendas */}
                            {renderSoldBadge(cat.sold_quantity)}

                            {/* Badge de correspondência com a busca */}
                            {isFilterActive && (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] flex items-center gap-1 font-semibold py-0.5">
                                <Check className="w-3 h-3" />
                                Termos correspondentes
                              </Badge>
                            )}

                            {/* Dica discreta de match quando existir — sem bloquear e sem destaque excessivo */}
                            {hasMatch && primaryMatch && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                                title={`Sugestão de modelo correspondente no estoque: ${primaryMatch.brand || ''} ${primaryMatch.model || ''} (${item.totalAvailableStock} un. disponíveis)`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                match estoque: {primaryMatch.model || primaryMatch.name} · (
                                {item.totalAvailableStock} un.)
                              </span>
                            )}
                          </div>

                          {/* Título com destaque visual dos termos correspondentes */}
                          <h4
                            className="text-sm font-bold text-slate-900 leading-snug line-clamp-2"
                            title={cat.title}
                          >
                            {titleSegments.map((seg, sIdx) =>
                              seg.isHighlighted ? (
                                <mark
                                  key={sIdx}
                                  className="bg-emerald-100 text-emerald-950 font-black px-1 py-0.5 rounded-xs"
                                >
                                  {seg.text}
                                </mark>
                              ) : (
                                <span key={sIdx}>{seg.text}</span>
                              ),
                            )}
                          </h4>

                          {/* Painel Completo de Disputa e Concorrência na Buy Box */}
                          <div className="flex flex-col gap-2 pt-1 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Vendedor Líder da Buy Box / Identificação */}
                              {cat.is_own_account ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-900 font-semibold text-[11px]">
                                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  <span>
                                    Líder Buy Box: <strong>Você</strong>
                                  </span>
                                </div>
                              ) : cat.buy_box_winner_seller_nickname ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-800 text-[11px]">
                                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span>
                                    Líder: <strong>{cat.buy_box_winner_seller_nickname}</strong>
                                  </span>
                                </div>
                              ) : cat.buy_box_winner_price ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px]">
                                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span>
                                    Líder:{' '}
                                    <strong className="font-mono">
                                      {cat.buy_box_winner_seller_id
                                        ? `Seller #${cat.buy_box_winner_seller_id}`
                                        : 'Concorrente'}
                                    </strong>
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px]">
                                  <span>Sem disputa ativa</span>
                                </div>
                              )}

                              {/* Tipo de Anúncio do Concorrente (Premium / Clássico) */}
                              {cat.buy_box_winner_listing_type && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-semibold border ${
                                    cat.buy_box_winner_listing_type.includes('gold_pro') ||
                                    cat.buy_box_winner_listing_type === 'premium'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : 'bg-slate-50 text-slate-700 border-slate-300'
                                  }`}
                                  title={`Tipo de anúncio do líder: ${cat.buy_box_winner_listing_type}`}
                                >
                                  {cat.buy_box_winner_listing_type_label ||
                                    (cat.buy_box_winner_listing_type.includes('gold_pro')
                                      ? 'Premium'
                                      : 'Clássico')}
                                </Badge>
                              )}

                              {/* Preço do Líder da Buy Box */}
                              {cat.buy_box_winner_price ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                                  <TrendingDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="text-[11px] text-slate-600 font-medium">
                                    Preço líder:
                                  </span>
                                  <span className="font-mono font-bold text-emerald-700">
                                    {Number(cat.buy_box_winner_price).toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                </div>
                              ) : null}

                              {/* Menor Preço Ativo da Concorrência (min_price) se diferente do líder */}
                              {cat.min_price &&
                                cat.buy_box_winner_price &&
                                Number(cat.min_price) !== Number(cat.buy_box_winner_price) && (
                                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
                                    <span>Menor preço ativo:</span>
                                    <span className="font-mono font-semibold text-slate-800">
                                      {Number(cat.min_price).toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </span>
                                  </div>
                                )}

                              {/* Estoque do Líder / Status */}
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700">
                                <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="text-[11px] font-medium text-slate-600">
                                  Estoque líder:
                                </span>
                                <span className="font-mono font-bold text-slate-900 text-[11px]">
                                  {cat.buy_box_winner_stock != null && cat.buy_box_winner_stock > 0
                                    ? `${cat.buy_box_winner_stock} un.`
                                    : cat.stock_status ||
                                      (cat.buy_box_winner_price
                                        ? 'Pronta entrega (1+ un.)'
                                        : 'Estoque não público')}
                                </span>
                              </div>

                              {/* Contagem de Concorrentes (Chip Interativo para expandir/recolher) */}
                              {(() => {
                                const cKey =
                                  cat.catalog_product_id || cat.id || String(originalIndex)
                                const count =
                                  cat.competitors && cat.competitors.length > 0
                                    ? cat.competitors.length
                                    : cat.competitors_count != null
                                      ? cat.competitors_count
                                      : 0
                                const isOpen = Boolean(expandedCompetitors[cKey])
                                const isLoading = Boolean(loadingCompetitors[cKey])

                                return (
                                  <button
                                    type="button"
                                    onClick={() => toggleCompetitorsList(originalIndex)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors border cursor-pointer ${
                                      isOpen
                                        ? 'bg-blue-100 text-blue-900 border-blue-300 font-semibold'
                                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                    }`}
                                    title={
                                      isOpen
                                        ? 'Recolher lista de concorrentes'
                                        : 'Ver concorrentes da disputa'
                                    }
                                  >
                                    <Users className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>
                                      {count} {count === 1 ? 'concorrente' : 'concorrentes'}
                                    </span>
                                    {isLoading ? (
                                      <RefreshCw className="w-2.5 h-2.5 animate-spin text-blue-600" />
                                    ) : isOpen ? (
                                      <ChevronUp className="w-3 h-3 text-slate-500" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3 text-slate-500" />
                                    )}
                                  </button>
                                )
                              })()}

                              {/* Status da Disputa */}
                              {cat.competition_status && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono text-slate-600 border-slate-300 bg-white"
                                >
                                  {cat.competition_status}
                                </Badge>
                              )}

                              {cat.permalink && (
                                <a
                                  href={cat.permalink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline inline-flex items-center gap-1 font-mono text-[11px] ml-auto sm:ml-0"
                                >
                                  Ver anúncio no ML <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>

                            {/* LISTA DE CONCORRENTES NA DISPUTA */}
                            {(() => {
                              const cKey = cat.catalog_product_id || cat.id || String(originalIndex)
                              const isOpen = Boolean(expandedCompetitors[cKey])
                              const isLoading = Boolean(loadingCompetitors[cKey])
                              const competitors = cat.competitors || []

                              if (!isOpen) return null

                              return (
                                <div className="mt-2.5 p-3 rounded-lg bg-slate-50/90 border border-slate-200/90 space-y-2 animate-fadeIn">
                                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-blue-600" />
                                      <span className="text-xs font-bold text-slate-800">
                                        Concorrentes na Disputa ({competitors.length})
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      Formato: CONCORRENTE · PREÇO · ESTOQUE · VENDAS
                                    </span>
                                  </div>

                                  {isLoading ? (
                                    <div className="flex items-center gap-2 py-3 justify-center text-xs text-slate-500">
                                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                                      <span>
                                        Consultando concorrentes em tempo real no Mercado Livre...
                                      </span>
                                    </div>
                                  ) : competitors.length > 0 ? (
                                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                      {competitors.map((comp, cIdx) => {
                                        const isOwn =
                                          Boolean(comp.is_own) ||
                                          (comp.seller_nickname &&
                                            comp.seller_nickname.toUpperCase() === 'INFOPRECOBAIXO')
                                        const isLeader =
                                          Boolean(comp.is_buy_box_winner) ||
                                          (cIdx === 0 &&
                                            cat.buy_box_winner_price != null &&
                                            Number(comp.price) === Number(cat.buy_box_winner_price))

                                        const stockLabel =
                                          comp.available_quantity != null &&
                                          comp.available_quantity > 0
                                            ? `${comp.available_quantity} un. disponíveis`
                                            : 'estoque não público'

                                        const sellerName = isOwn
                                          ? 'INFOPRECOBAIXO (Sua conta)'
                                          : comp.seller_nickname ||
                                            (comp.seller_id
                                              ? `Seller #${comp.seller_id}`
                                              : `Concorrente ${cIdx + 1}`)

                                        return (
                                          <div
                                            key={comp.item_id || comp.seller_id || cIdx}
                                            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                                              isOwn
                                                ? 'bg-purple-50/80 border-purple-200 text-purple-950 font-medium'
                                                : isLeader
                                                  ? 'bg-emerald-50/60 border-emerald-200 text-slate-900'
                                                  : 'bg-white border-slate-200 text-slate-700'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              {/* Badges de Líder e Sua Conta */}
                                              {isLeader && (
                                                <Badge
                                                  variant="outline"
                                                  className="bg-emerald-600 text-white border-emerald-700 text-[9px] px-1.5 py-0 font-bold shrink-0 shadow-2xs"
                                                >
                                                  Líder
                                                </Badge>
                                              )}
                                              {isOwn && (
                                                <Badge
                                                  variant="outline"
                                                  className="bg-purple-600 text-white border-purple-700 text-[9px] px-1.5 py-0 font-bold shrink-0 shadow-2xs"
                                                >
                                                  Você
                                                </Badge>
                                              )}

                                              {/* Nome do concorrente */}
                                              <span
                                                className={`truncate uppercase ${
                                                  isOwn
                                                    ? 'font-bold text-purple-900'
                                                    : isLeader
                                                      ? 'font-bold text-slate-900'
                                                      : 'font-semibold text-slate-800'
                                                }`}
                                                title={sellerName}
                                              >
                                                {sellerName}
                                              </span>

                                              {/* Selo Premium / Clássico se disponível */}
                                              {comp.listing_type_label && (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[9px] px-1 py-0 font-normal border-slate-300 bg-slate-50 text-slate-600 shrink-0 hidden sm:inline-flex"
                                                >
                                                  {comp.listing_type_label}
                                                </Badge>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-2.5 shrink-0 font-mono text-[11px]">
                                              {/* Valor do concorrente */}
                                              <span
                                                className={`font-bold ${
                                                  isLeader ? 'text-emerald-700' : 'text-slate-900'
                                                }`}
                                              >
                                                {Number(comp.price || 0).toLocaleString('pt-BR', {
                                                  style: 'currency',
                                                  currency: 'BRL',
                                                })}
                                              </span>

                                              <span className="text-slate-300">·</span>

                                              {/* Quantidade em estoque */}
                                              <span
                                                className={`${
                                                  comp.available_quantity != null &&
                                                  comp.available_quantity > 0
                                                    ? 'text-slate-600'
                                                    : 'text-slate-400 italic text-[10px]'
                                                }`}
                                              >
                                                {stockLabel}
                                              </span>

                                              {/* Quantidade de vendas do concorrente */}
                                              {comp.sold_quantity != null ? (
                                                <>
                                                  <span className="text-slate-300">·</span>
                                                  <span
                                                    className={`text-[10px] ${
                                                      comp.sold_quantity > 0
                                                        ? 'text-blue-700 font-semibold'
                                                        : 'text-slate-400'
                                                    }`}
                                                    title={`Vendas deste concorrente: ${formatMLSoldQuantity(comp.sold_quantity)}`}
                                                  >
                                                    {formatMLSoldQuantity(comp.sold_quantity)}
                                                  </span>
                                                </>
                                              ) : null}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-center py-2 text-[11px] text-slate-500">
                                      {cat.buy_box_winner_seller_nickname ? (
                                        <span>
                                          Apenas o líder{' '}
                                          <strong className="text-slate-700">
                                            {cat.buy_box_winner_seller_nickname}
                                          </strong>{' '}
                                          registrado nesta posição (sem outros concorrentes diretos
                                          no momento).
                                        </span>
                                      ) : (
                                        <span>
                                          Nenhum outro concorrente na disputa desta posição.
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Edição Inline: Condição, Quantidade e Valor + Ações de Preço */}
                      <div className="w-full lg:w-96 flex flex-col gap-2 shrink-0 bg-slate-50 lg:bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2.5">
                          {/* Condição de publicação */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 block">
                              Condição no ML
                            </label>
                            <select
                              value={item.formCondition}
                              onChange={(e) =>
                                updateCondition(
                                  originalIndex,
                                  e.target.value as PublishConditionOption,
                                )
                              }
                              disabled={!item.selected || isPublishing}
                              className="h-8 w-full text-xs bg-white border border-slate-300 rounded-md px-2 font-medium text-slate-800 disabled:opacity-50"
                              aria-label="Condição de publicação no Mercado Livre"
                            >
                              <option value="catalog_auto">Herdar da posição</option>
                              <option value="new">Novo</option>
                              <option value="open_box">Caixa aberta</option>
                              <option value="used">Usado</option>
                              <option value="refurbished">Recondicionado</option>
                            </select>
                          </div>

                          {/* Sub-seletor de Grau quando Recondicionado estiver ativo nesta linha */}
                          {item.formCondition === 'refurbished' && (
                            <div className="w-32 space-y-1 animate-fadeIn">
                              <label className="text-[10px] uppercase font-bold text-purple-900 block flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                Grau ML
                              </label>
                              <select
                                value={item.formConditionGrade || 'Excelente'}
                                onChange={(e) =>
                                  updateConditionGrade(
                                    originalIndex,
                                    e.target.value as RefurbishedGrade,
                                  )
                                }
                                disabled={!item.selected || isPublishing}
                                className={`h-8 w-full text-xs border rounded-md px-2 font-bold disabled:opacity-50 transition-colors ${
                                  (item.formConditionGrade || 'Excelente') === 'Excelente'
                                    ? 'bg-purple-900 text-white border-purple-950 focus:ring-purple-900'
                                    : (item.formConditionGrade || 'Excelente') === 'Bom'
                                      ? 'bg-purple-600 text-white border-purple-700 focus:ring-purple-600'
                                      : 'bg-purple-200 text-purple-950 border-purple-400 font-black'
                                }`}
                                aria-label="Grau de recondicionado oficial do Mercado Livre"
                              >
                                <option
                                  value="Excelente"
                                  className="bg-purple-950 text-white font-bold"
                                >
                                  Excelente
                                </option>
                                <option value="Bom" className="bg-purple-700 text-white font-bold">
                                  Bom
                                </option>
                                <option
                                  value="Aceitável"
                                  className="bg-purple-200 text-purple-950 font-bold"
                                >
                                  Aceitável
                                </option>
                              </select>
                            </div>
                          )}

                          {/* Quantidade */}
                          <div className="w-20 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 block">
                              Qtd
                            </label>
                            <Input
                              type="number"
                              min={1}
                              value={item.formQuantity}
                              onChange={(e) =>
                                updateQuantity(originalIndex, Number(e.target.value))
                              }
                              disabled={!item.selected || isPublishing}
                              className="h-8 text-xs font-mono font-bold bg-white"
                            />
                          </div>

                          {/* Valor */}
                          <div className="w-28 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 block flex items-center justify-between">
                              <span>Preço (R$)</span>
                              {isBelowBuyBox && (
                                <span
                                  className="text-emerald-600 font-bold text-[9px] flex items-center gap-0.5"
                                  title="Seu preço está mais agressivo que o concorrente da Buy Box!"
                                >
                                  <Zap className="w-2.5 h-2.5 text-emerald-600 fill-emerald-600" />
                                  Vencedor!
                                </span>
                              )}
                            </label>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={item.formPrice}
                              onChange={(e) => updatePrice(originalIndex, Number(e.target.value))}
                              disabled={!item.selected || isPublishing}
                              className="h-8 text-xs font-mono font-bold bg-white"
                            />
                          </div>
                        </div>

                        {/* Botão de Atalho "Baixar para R$ X" (Price to Win / Vencer Buy Box) */}
                        {cat.suggested_price_to_win &&
                          cat.suggested_price_to_win > 0 &&
                          item.formPrice !== cat.suggested_price_to_win && (
                            <div className="pt-0.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updatePrice(originalIndex, Number(cat.suggested_price_to_win))
                                }
                                disabled={!item.selected || isPublishing}
                                className="w-full h-7 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold flex items-center justify-center gap-1.5 shadow-2xs"
                                title="Preço competitivo logo abaixo da âncora/líder para assumir a Buy Box com margem preservada"
                              >
                                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                                <span>
                                  Ajustar para{' '}
                                  <strong className="font-mono">
                                    {Number(cat.suggested_price_to_win).toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </strong>{' '}
                                  (Entrada Saudável)
                                </span>
                              </Button>{' '}
                            </div>
                          )}

                        {/* Avisos inline contextuais sobre a condição escolhida */}
                        {item.formCondition === 'refurbished' && (
                          <div className="p-2 rounded bg-purple-50 border border-purple-300 text-[11px] text-purple-950 leading-snug flex items-start gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>
                                Recondicionado (Grau {item.formConditionGrade || 'Excelente'}):
                              </strong>{' '}
                              utiliza o mecanismo oficial do ML com atributo GRADING={' '}
                              <strong>{item.formConditionGrade || 'Excelente'}</strong>. Cria ou
                              vincula à posição recondicionada da família no catálogo (com fallback
                              de segurança para Usado caso a categoria exija posição estrita).
                            </span>
                          </div>
                        )}

                        {item.formCondition === 'open_box' && (
                          <div className="p-2 rounded bg-blue-50 border border-blue-200 text-[11px] text-blue-950 leading-snug flex items-start gap-1.5">
                            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Caixa aberta:</strong> aceito diretamente em posições Novas de
                              catálogo. Publicação sem envio de condition raiz e com atributo
                              ITEM_CONDITION.
                            </span>
                          </div>
                        )}

                        {cat.condition === 'refurbished' &&
                          (item.formCondition === 'refurbished' ||
                            item.formCondition === 'catalog_auto') && (
                            <div className="p-1.5 rounded bg-purple-50 border border-purple-200 text-[11px] text-purple-900 leading-snug flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <span>Posição recondicionada — compatível com seu estoque.</span>
                            </div>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Bloco de Resultados Parciais / Descartados (Colapsado/Opcional) */}
          {isFilterActive && showPartialResults && partialItems.length > 0 && (
            <div className="pt-6 border-t-2 border-dashed border-slate-200 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Resultados Parciais descartados pelo filtro ({partialItems.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Estes anúncios vieram da busca do Mercado Livre, mas faltam termos chave da sua
                    pesquisa. Você ainda pode marcá-los e publicar se desejar.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPartialResults(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Recolher
                </Button>
              </div>

              <div className="space-y-3 opacity-90">
                {partialItems.map(({ item, originalIndex, missingTokens }) => {
                  const cat = item.catalogProduct
                  const isBelowBuyBox =
                    cat.buy_box_winner_price && item.formPrice < cat.buy_box_winner_price

                  return (
                    <Card
                      key={cat.id || originalIndex}
                      className={`border border-slate-200 bg-slate-50/70 transition-all ${
                        item.selected ? 'border-blue-300 bg-white' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <CardContent className="p-3.5">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                          {/* Checkbox + Foto + Info */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleItemSelection(originalIndex)}
                              className="mt-1"
                              aria-label={`Selecionar posição parcial ${cat.title}`}
                            />

                            <div className="w-14 h-14 rounded-lg bg-slate-200/70 border border-slate-300/70 shrink-0 overflow-hidden flex items-center justify-center relative">
                              {cat.thumbnail ? (
                                <img
                                  src={cat.thumbnail}
                                  alt={cat.title}
                                  className="w-full h-full object-contain p-1 grayscale-30"
                                  onError={(e) => {
                                    ;(e.target as HTMLImageElement).src =
                                      'https://img.usecurling.com/p/200/200?q=laptop'
                                  }}
                                />
                              ) : (
                                <Package className="w-7 h-7 text-slate-400" />
                              )}
                            </div>

                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="bg-white text-slate-600 border-slate-300 text-[10px] font-mono"
                                >
                                  {cat.catalog_product_id}
                                </Badge>
                                {renderConditionBadge(cat)}
                                {renderSoldBadge(cat.sold_quantity)}
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]"
                                >
                                  Não contém: {missingTokens.join(', ')}
                                </Badge>
                              </div>

                              <h5
                                className="text-xs font-semibold text-slate-700 leading-snug line-clamp-2"
                                title={cat.title}
                              >
                                {cat.title}
                              </h5>

                              {/* Painel de Disputa nos Parciais */}
                              <div className="flex items-center gap-2 text-[11px] pt-1 text-slate-600 flex-wrap">
                                {cat.buy_box_winner_seller_nickname ? (
                                  <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                    <User className="w-3 h-3 text-slate-400" />
                                    Líder: <strong>{cat.buy_box_winner_seller_nickname}</strong>
                                  </span>
                                ) : cat.is_own_account ? (
                                  <span className="inline-flex items-center gap-1 text-purple-700 font-bold">
                                    <ShieldCheck className="w-3 h-3 text-purple-600" />
                                    Líder: Você
                                  </span>
                                ) : null}

                                {cat.buy_box_winner_listing_type && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] py-0 px-1 font-semibold text-slate-600 border-slate-300"
                                  >
                                    {cat.buy_box_winner_listing_type_label ||
                                      (cat.buy_box_winner_listing_type.includes('gold_pro')
                                        ? 'Premium'
                                        : 'Clássico')}
                                  </Badge>
                                )}

                                {cat.buy_box_winner_price ? (
                                  <span className="font-mono text-emerald-700 font-semibold">
                                    Líder:{' '}
                                    {Number(cat.buy_box_winner_price).toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Buy Box: sem disputa ativa</span>
                                )}

                                <span className="text-slate-600">
                                  Estoque:{' '}
                                  <strong className="text-slate-800 font-mono">
                                    {cat.buy_box_winner_stock != null &&
                                    cat.buy_box_winner_stock > 0
                                      ? `${cat.buy_box_winner_stock} un.`
                                      : cat.stock_status ||
                                        (cat.buy_box_winner_price
                                          ? 'Pronta entrega (1+ un.)'
                                          : 'Não público')}
                                  </strong>
                                </span>

                                {(() => {
                                  const cKey =
                                    cat.catalog_product_id || cat.id || String(originalIndex)
                                  const count =
                                    cat.competitors && cat.competitors.length > 0
                                      ? cat.competitors.length
                                      : cat.competitors_count != null
                                        ? cat.competitors_count
                                        : 0
                                  const isOpen = Boolean(expandedCompetitors[cKey])
                                  const isLoading = Boolean(loadingCompetitors[cKey])

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => toggleCompetitorsList(originalIndex)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                                        isOpen
                                          ? 'bg-blue-100 text-blue-900 border-blue-300 font-semibold'
                                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                                      }`}
                                      title="Ver concorrentes"
                                    >
                                      <Users className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                      <span>
                                        {count} {count === 1 ? 'concorrente' : 'concorrentes'}
                                      </span>
                                      {isLoading ? (
                                        <RefreshCw className="w-2 h-2 animate-spin text-blue-600" />
                                      ) : isOpen ? (
                                        <ChevronUp className="w-2.5 h-2.5 text-slate-500" />
                                      ) : (
                                        <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
                                      )}
                                    </button>
                                  )
                                })()}

                                {cat.permalink && (
                                  <a
                                    href={cat.permalink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1 font-mono text-[10px]"
                                  >
                                    Ver no ML <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>

                              {/* LISTA DE CONCORRENTES NOS PARCIAIS */}
                              {(() => {
                                const cKey =
                                  cat.catalog_product_id || cat.id || String(originalIndex)
                                const isOpen = Boolean(expandedCompetitors[cKey])
                                const isLoading = Boolean(loadingCompetitors[cKey])
                                const competitors = cat.competitors || []

                                if (!isOpen) return null

                                return (
                                  <div className="mt-2 p-2.5 rounded bg-white border border-slate-200 text-xs space-y-1.5 animate-fadeIn">
                                    <div className="flex items-center justify-between font-bold text-slate-700 text-[11px] border-b pb-1">
                                      <span>Concorrentes na Disputa ({competitors.length})</span>
                                      <span className="text-[10px] text-slate-400 font-normal">
                                        CONCORRENTE · VALOR · ESTOQUE · VENDAS
                                      </span>
                                    </div>
                                    {isLoading ? (
                                      <div className="flex items-center gap-2 py-2 justify-center text-xs text-slate-500">
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                        <span>Consultando concorrentes...</span>
                                      </div>
                                    ) : competitors.length > 0 ? (
                                      <div className="space-y-1 max-h-48 overflow-y-auto">
                                        {competitors.map((comp, cIdx) => {
                                          const isOwn =
                                            Boolean(comp.is_own) ||
                                            (comp.seller_nickname &&
                                              comp.seller_nickname.toUpperCase() ===
                                                'INFOPRECOBAIXO')
                                          const isLeader =
                                            Boolean(comp.is_buy_box_winner) ||
                                            (cIdx === 0 &&
                                              cat.buy_box_winner_price != null &&
                                              Number(comp.price) ===
                                                Number(cat.buy_box_winner_price))

                                          const stockLabel =
                                            comp.available_quantity != null &&
                                            comp.available_quantity > 0
                                              ? `${comp.available_quantity} un.`
                                              : 'não público'

                                          const sellerName = isOwn
                                            ? 'INFOPRECOBAIXO (Sua conta)'
                                            : comp.seller_nickname ||
                                              (comp.seller_id
                                                ? `Seller #${comp.seller_id}`
                                                : `Concorrente ${cIdx + 1}`)

                                          return (
                                            <div
                                              key={comp.item_id || comp.seller_id || cIdx}
                                              className={`flex items-center justify-between gap-2 p-1.5 rounded text-[11px] border ${
                                                isOwn
                                                  ? 'bg-purple-50 border-purple-200 text-purple-900 font-medium'
                                                  : isLeader
                                                    ? 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                              }`}
                                            >
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                {isLeader && (
                                                  <Badge
                                                    variant="outline"
                                                    className="bg-emerald-600 text-white text-[9px] px-1 py-0 font-bold"
                                                  >
                                                    Líder
                                                  </Badge>
                                                )}
                                                {isOwn && (
                                                  <Badge
                                                    variant="outline"
                                                    className="bg-purple-600 text-white text-[9px] px-1 py-0 font-bold"
                                                  >
                                                    Você
                                                  </Badge>
                                                )}
                                                <span className="truncate font-semibold uppercase">
                                                  {sellerName}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2 font-mono shrink-0">
                                                <span className="font-bold text-slate-900">
                                                  {Number(comp.price || 0).toLocaleString('pt-BR', {
                                                    style: 'currency',
                                                    currency: 'BRL',
                                                  })}
                                                </span>
                                                <span className="text-slate-300">·</span>
                                                <span className="text-slate-500">{stockLabel}</span>
                                                {comp.sold_quantity != null ? (
                                                  <>
                                                    <span className="text-slate-300">·</span>
                                                    <span
                                                      className={`text-[10px] ${
                                                        comp.sold_quantity > 0
                                                          ? 'text-blue-700 font-semibold'
                                                          : 'text-slate-400'
                                                      }`}
                                                    >
                                                      {formatMLSoldQuantity(comp.sold_quantity)}
                                                    </span>
                                                  </>
                                                ) : null}
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-center py-1 text-[10px] text-slate-500">
                                        Nenhum outro concorrente registrado na disputa desta
                                        posição.
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>

                          {/* Edição Inline Parciais */}
                          <div className="w-full lg:w-96 flex flex-col gap-2 shrink-0 bg-white p-2.5 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 min-w-0 space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block">
                                  Condição no ML
                                </label>
                                <select
                                  value={item.formCondition}
                                  onChange={(e) =>
                                    updateCondition(
                                      originalIndex,
                                      e.target.value as PublishConditionOption,
                                    )
                                  }
                                  disabled={!item.selected || isPublishing}
                                  className="h-7 w-full text-xs bg-slate-50 border border-slate-300 rounded px-1.5 font-medium text-slate-700 disabled:opacity-50"
                                  aria-label="Condição de publicação no Mercado Livre"
                                >
                                  <option value="catalog_auto">Herdar da posição</option>
                                  <option value="new">Novo</option>
                                  <option value="open_box">Caixa aberta</option>
                                  <option value="used">Usado</option>
                                  <option value="refurbished">Recondicionado</option>
                                </select>
                              </div>

                              {/* Sub-seletor de Grau Parciais */}
                              {item.formCondition === 'refurbished' && (
                                <div className="w-28 space-y-1 animate-fadeIn">
                                  <label className="text-[10px] uppercase font-bold text-purple-900 block">
                                    Grau ML
                                  </label>
                                  <select
                                    value={item.formConditionGrade || 'Excelente'}
                                    onChange={(e) =>
                                      updateConditionGrade(
                                        originalIndex,
                                        e.target.value as RefurbishedGrade,
                                      )
                                    }
                                    disabled={!item.selected || isPublishing}
                                    className={`h-7 w-full text-[11px] border rounded px-1 font-bold disabled:opacity-50 ${
                                      (item.formConditionGrade || 'Excelente') === 'Excelente'
                                        ? 'bg-purple-900 text-white border-purple-950'
                                        : (item.formConditionGrade || 'Excelente') === 'Bom'
                                          ? 'bg-purple-600 text-white border-purple-700'
                                          : 'bg-purple-200 text-purple-950 border-purple-400'
                                    }`}
                                    aria-label="Grau de recondicionado"
                                  >
                                    <option value="Excelente" className="bg-purple-950 text-white">
                                      Excelente
                                    </option>
                                    <option value="Bom" className="bg-purple-700 text-white">
                                      Bom
                                    </option>
                                    <option
                                      value="Aceitável"
                                      className="bg-purple-200 text-purple-950"
                                    >
                                      Aceitável
                                    </option>
                                  </select>
                                </div>
                              )}

                              <div className="w-20 space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block">
                                  Qtd
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.formQuantity}
                                  onChange={(e) =>
                                    updateQuantity(originalIndex, Number(e.target.value))
                                  }
                                  disabled={!item.selected || isPublishing}
                                  className="h-7 text-xs font-mono bg-slate-50"
                                />
                              </div>

                              <div className="w-28 space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block flex items-center justify-between">
                                  <span>Preço (R$)</span>
                                  {isBelowBuyBox && (
                                    <span className="text-emerald-600 font-bold text-[9px] flex items-center gap-0.5">
                                      <Zap className="w-2.5 h-2.5 text-emerald-600 fill-emerald-600" />
                                      Vencedor!
                                    </span>
                                  )}
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={item.formPrice}
                                  onChange={(e) =>
                                    updatePrice(originalIndex, Number(e.target.value))
                                  }
                                  disabled={!item.selected || isPublishing}
                                  className="h-7 text-xs font-mono bg-slate-50"
                                />
                              </div>
                            </div>

                            {/* Botão de Atalho "Baixar para R$ X" (Price to Win) nos Parciais */}
                            {cat.suggested_price_to_win &&
                              cat.suggested_price_to_win > 0 &&
                              item.formPrice !== cat.suggested_price_to_win && (
                                <div className="pt-0.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updatePrice(originalIndex, Number(cat.suggested_price_to_win))
                                    }
                                    disabled={!item.selected || isPublishing}
                                    className="w-full h-6 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold flex items-center justify-center gap-1"
                                    title="Preço competitivo logo abaixo da âncora/líder com margem preservada"
                                  >
                                    <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                                    <span>
                                      Ajustar para{' '}
                                      <strong className="font-mono">
                                        {Number(cat.suggested_price_to_win).toLocaleString(
                                          'pt-BR',
                                          {
                                            style: 'currency',
                                            currency: 'BRL',
                                          },
                                        )}
                                      </strong>{' '}
                                      (Saudável)
                                    </span>
                                  </Button>
                                </div>
                              )}

                            {/* Avisos inline parciais */}
                            {item.formCondition === 'refurbished' && (
                              <div className="p-1.5 rounded bg-purple-50 border border-purple-300 text-[10px] text-purple-950 leading-snug flex items-start gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                                <span>
                                  Requer variante recondicionada registrada na posição do catálogo.
                                </span>
                              </div>
                            )}
                            {item.formCondition === 'open_box' && (
                              <div className="p-1.5 rounded bg-blue-50 border border-blue-200 text-[10px] text-blue-950 leading-snug flex items-start gap-1">
                                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <span>Caixa aberta: aceito em posições Novas de catálogo.</span>
                              </div>
                            )}
                            {cat.condition === 'refurbished' &&
                              (item.formCondition === 'refurbished' ||
                                item.formCondition === 'catalog_auto') && (
                                <div className="p-1.5 rounded bg-purple-50 border border-purple-200 text-[10px] text-purple-900 leading-snug flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-purple-600 shrink-0" />
                                  <span>Posição recondicionada — compatível com seu estoque.</span>
                                </div>
                              )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
