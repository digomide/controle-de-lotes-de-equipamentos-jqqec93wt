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
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { productsService } from '@/services/products'
import { Product } from '@/types/inventory'
import { mlCatalogService, CatalogMatchResult } from '@/services/mlCatalogService'
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
  } | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogMatchResult[]>([])
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([])
  const [lastStrategy, setLastStrategy] = useState<string>('')
  const [searchJobDebug, setSearchJobDebug] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [showPartialResults, setShowPartialResults] = useState(false)
  const [conditionFilter, setConditionFilter] = useState<'all' | 'refurbished' | 'new' | 'used'>(
    'all',
  )

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
  async function handleSearch(overrideQuery?: string) {
    const q = (overrideQuery ?? query).trim()
    if (!q) {
      toast({
        title: 'Informe um termo de busca',
        description: 'Digite o modelo ou cole o link / ID do produto de catálogo do Mercado Livre.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSearching(true)
      setActiveSearchTerm(q)
      setCatalogItems([])
      setSearchJobDebug([])
      setSearchProgressText('Iniciando busca profunda no Mercado Livre...')
      setSearchPagingInfo(null)

      toast({
        title: 'Iniciando busca profunda no ML...',
        description: 'Vasculhando todas as páginas de anúncios de catálogo.',
      })

      const jobInit = await mlCatalogService.searchCatalog(q, 'MLB-NOTEBOOKS')
      const jobDone = await mlCatalogService.pollSearchJob(jobInit.id, (j) => {
        if (j.raw_debug) setSearchJobDebug(j.raw_debug)
        if (j.progress_text) setSearchProgressText(j.progress_text)
        if (j.paging) setSearchPagingInfo(j.paging)
      })

      if (jobDone.status === 'error') {
        throw new Error(jobDone.error_message || 'Falha ao buscar no catálogo do Mercado Livre')
      }

      const results = jobDone.results || []
      setLastStrategy(jobDone.strategy_used || 'api_products_search')
      if (jobDone.raw_debug) setSearchJobDebug(jobDone.raw_debug)
      if (jobDone.progress_text) setSearchProgressText(jobDone.progress_text)
      if (jobDone.paging) setSearchPagingInfo(jobDone.paging)

      if (results.length === 0) {
        toast({
          title: 'Nenhum produto de catálogo encontrado',
          description: 'Tente outro termo ou cole o link direto do produto (/p/MLB...).',
        })
        setCatalogItems([])
        return
      }

      // Todas as posições são selecionáveis e publicáveis de forma autônoma
      // Match com estoque local é puramente informativo / dica opcional
      const isDirectCode = isDirectCatalogCodeQuery(q)
      const tokens = isDirectCode ? [] : extractCatalogSearchTokens(q)

      const formatted: CatalogMatchResult[] = results.map((catProd) => {
        const matchInfo = mlCatalogService.matchCatalogWithInventory(catProd, inventoryProducts)
        const primaryProduct = matchInfo.matchedProducts[0]
        const fallbackPrice =
          catProd.buy_box_winner_price || catProd.min_price || matchInfo.suggestedPrice || 1200

        // Se houver tokens e não for busca direta, seleciona por padrão apenas se atender ao filtro rígido
        const isStrict =
          isDirectCode ||
          tokens.length === 0 ||
          evaluateCatalogItemStrictMatch(catProd.title, tokens, catProd.attributes).isMatch

        return {
          catalogProduct: catProd,
          matchedProducts: matchInfo.matchedProducts,
          totalAvailableStock: matchInfo.totalAvailableStock,
          suggestedPrice: fallbackPrice,
          selected: isStrict, // Resultados rigorosos já vêm selecionados; descartados vêm desmarcados
          formQuantity: 1, // Quantidade default = 1
          formPrice: fallbackPrice, // Preço default = preço de referência do catálogo
          selectedProductId: primaryProduct?.id || undefined,
        }
      })

      setCatalogItems(formatted)

      const strictCount =
        isDirectCode || tokens.length === 0
          ? formatted.length
          : formatted.filter(
              (it) =>
                evaluateCatalogItemStrictMatch(
                  it.catalogProduct.title,
                  tokens,
                  it.catalogProduct.attributes,
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
        const itemCondSent = 'used'
        const isCatNew = item.catalogProduct.condition === 'new'

        const job = await mlCatalogService.createPublishJob({
          catalog_product_id: item.catalogProduct.catalog_product_id,
          product_id: item.selectedProductId,
          price: item.formPrice,
          quantity: item.formQuantity,
          domain_id: item.catalogProduct.domain_id || 'MLB-NOTEBOOKS',
          condition: itemCondSent,
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
          logs[i].message = `Publicado com sucesso! ID: ${completed.ml_listing_id}`
          logs[i].canRetry = false
        } else {
          errorCount++
          logs[i].status = 'error'

          // Se a posição é classificada como 'new' e a condição enviada é recondicionado/usado,
          // ou se o ML acusou item_not_new_nor_refurbished / not_eligible
          const rawErr = completed.error_message || ''
          if (
            isCatNew ||
            rawErr.includes('item_not_new_nor_refurbished') ||
            rawErr.includes('exige condição Novo')
          ) {
            logs[i].message =
              'Esta posição de catálogo é classificada como NOVO pelo Mercado Livre — não aceita oferta em seminovo/recondicionado.'
          } else {
            logs[i].message = completed.error_message || 'Falha na publicação do anúncio.'
          }
          logs[i].canRetry = true
        }
      } catch (err: any) {
        errorCount++
        logs[i].status = 'error'
        const rawErrMsg = err.message || ''
        if (item.catalogProduct.condition === 'new') {
          logs[i].message =
            'Esta posição de catálogo é classificada como NOVO pelo Mercado Livre — não aceita oferta em seminovo/recondicionado.'
        } else {
          logs[i].message = rawErrMsg || 'Erro inesperado de comunicação com a fila.'
        }
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
      const isCatNew = item.catalogProduct.condition === 'new'
      const newJob = await mlCatalogService.createPublishJob({
        catalog_product_id: item.catalogProduct.catalog_product_id,
        product_id: item.selectedProductId,
        price: item.formPrice,
        quantity: item.formQuantity,
        domain_id: item.catalogProduct.domain_id || 'MLB-NOTEBOOKS',
        condition: 'used',
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
        toast({
          title: 'Anúncio publicado com sucesso!',
          description: `Anúncio ${completed.ml_listing_id} criado no catálogo.`,
        })
      } else {
        const rawErr = completed.error_message || ''
        const errorMsgToShow =
          isCatNew ||
          rawErr.includes('item_not_new_nor_refurbished') ||
          rawErr.includes('exige condição Novo')
            ? 'Esta posição de catálogo é classificada como NOVO pelo Mercado Livre — não aceita oferta em seminovo/recondicionado.'
            : completed.error_message || 'Falha na publicação.'

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
      const isCatNew = item.catalogProduct.condition === 'new'
      const errorMsgToShow = isCatNew
        ? 'Esta posição de catálogo é classificada como NOVO pelo Mercado Livre — não aceita oferta em seminovo/recondicionado.'
        : err.message || 'Erro ao comunicar com a fila.'

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

  // Helper para renderizar a badge de classificação/condição da posição de catálogo
  function renderConditionBadge(cat: { condition?: string; condition_label?: string }) {
    const cond = cat.condition || 'new'
    const label =
      cat.condition_label ||
      (cond === 'refurbished' ? 'Recondicionado' : cond === 'used' ? 'Usado' : 'Novo')

    if (cond === 'refurbished') {
      return (
        <Badge
          className="bg-purple-600 hover:bg-purple-700 text-white border-purple-700 text-[10px] font-semibold flex items-center gap-1 shadow-2xs"
          title="Classificação Recondicionado no ML — estoque 100% compatível com a loja"
        >
          <Sparkles className="w-3 h-3 text-purple-200" />
          <span>{label}</span>
          <span className="text-[9px] bg-purple-700/60 px-1 py-0.2 rounded text-purple-100 font-mono ml-0.5">
            Estoque compatível
          </span>
        </Badge>
      )
    }

    if (cond === 'used') {
      return (
        <Badge
          className="bg-amber-500 hover:bg-amber-600 text-white border-amber-600 text-[10px] font-semibold flex items-center gap-1"
          title="Classificação Usado no catálogo Mercado Livre"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-100" />
          <span>{label}</span>
        </Badge>
      )
    }

    return (
      <Badge
        className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 text-[10px] font-semibold flex items-center gap-1"
        title="Classificação Novo de fábrica no catálogo oficial Mercado Livre"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        <span>{label}</span>
      </Badge>
    )
  }

  // Contadores para os chips de filtro por classificação (default 'new' se não especificado)
  const countTotal = catalogItems.length
  const countRefurbished = catalogItems.filter(
    (it) => it.catalogProduct.condition === 'refurbished',
  ).length
  const countNew = catalogItems.filter(
    (it) => !it.catalogProduct.condition || it.catalogProduct.condition === 'new',
  ).length
  const countUsed = catalogItems.filter((it) => it.catalogProduct.condition === 'used').length

  // Avaliação de cada item em relação aos termos buscados e ao filtro de condição
  const evaluatedItems = catalogItems.map((item, originalIndex) => {
    const evalResult = isFilterActive
      ? evaluateCatalogItemStrictMatch(
          item.catalogProduct.title,
          currentTokens,
          item.catalogProduct.attributes,
        )
      : { isMatch: true, matchedTokens: currentTokens, missingTokens: [] }

    // Avalia também o filtro de condição ativo (Todas | Recondicionado | Novo | Usado)
    const itemCond = item.catalogProduct.condition || 'new'
    const matchesCondition =
      conditionFilter === 'all'
        ? true
        : conditionFilter === 'refurbished'
          ? itemCond === 'refurbished'
          : conditionFilter === 'new'
            ? itemCond === 'new'
            : conditionFilter === 'used'
              ? itemCond === 'used'
              : true

    return {
      item,
      originalIndex,
      isMatch: evalResult.isMatch,
      matchesCondition,
      matchedTokens: evalResult.matchedTokens,
      missingTokens: evalResult.missingTokens,
    }
  })

  // Itens estritos e parciais/descartados filtrados pela condição selecionada
  const strictItems = evaluatedItems.filter((entry) => entry.isMatch && entry.matchesCondition)
  const partialItems = evaluatedItems.filter((entry) => !entry.isMatch && entry.matchesCondition)

  const selectedCount = catalogItems.filter((i) => i.selected).length

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
                href="https://vendedores.mercadolivre.com.br/catalogo/explorar?domain_id=MLB-NOTEBOOKS"
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

      {/* Caixa de Busca com Exemplos Rápidos */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
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
            <Button
              onClick={() => handleSearch()}
              disabled={searching}
              className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs flex items-center gap-2 shrink-0"
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

          {/* Feedback de Progresso da Busca Profunda em Tempo Real */}
          {searching && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3 animate-pulse">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-900">
                  {searchProgressText ||
                    'Buscando páginas de anúncios de catálogo no Mercado Livre...'}
                </p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Vasculhando posições paginadas para trazer todos os resultados da pesquisa.
                </p>
              </div>
            </div>
          )}

          {/* Atalhos Rápidos */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
            <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">
              Sugestões rápidas:
            </span>
            {[
              'dell latitude 3420',
              'lenovo thinkpad t480',
              'dell latitude 5320',
              'hp elitebook 840',
              'thinkpad t580',
            ].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setQuery(term)
                  handleSearch(term)
                }}
                disabled={searching}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors text-xs font-mono"
              >
                {term}
              </button>
            ))}
          </div>

          {/* Diagnóstico da Fonte / Cascata e Resumo da Paginação */}
          {lastStrategy && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-600">Origem:</span>
                <Badge variant="outline" className="text-[10px] font-mono bg-slate-50">
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
                    className="text-[10px] font-mono bg-blue-50 text-blue-800 border-blue-200"
                  >
                    {searchPagingInfo.pages_fetched || 1}{' '}
                    {(searchPagingInfo.pages_fetched || 1) === 1
                      ? 'página consultada'
                      : 'páginas consultadas'}
                    {searchPagingInfo.total
                      ? ` · ${searchPagingInfo.items_count || catalogItems.length} de ${searchPagingInfo.total} total anunciado`
                      : ''}
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
            onClick={() => setConditionFilter('refurbished')}
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

      {/* Barra de Ações em Massa (quando há resultados) */}
      {catalogItems.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
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

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                onClick={handlePublishSelected}
                disabled={isPublishing || selectedCount === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 shadow-xs flex items-center gap-1.5"
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
                              {cat.domain_id || 'MLB-NOTEBOOKS'}
                            </Badge>

                            {/* Badge de Classificação / Condição do Mercado Livre */}
                            {renderConditionBadge(cat)}

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

                          {/* Painel de Disputa e Concorrência na Buy Box */}
                          <div className="flex items-center gap-3 text-xs pt-1 flex-wrap">
                            {/* Preço da Buy Box Concorrente */}
                            {cat.buy_box_winner_price ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                                <TrendingDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="text-[11px] text-slate-600 font-medium">
                                  Buy Box Concorrente:
                                </span>
                                <span className="font-mono font-bold text-emerald-700">
                                  {Number(cat.buy_box_winner_price).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px]">
                                <span>Buy Box: sem disputa ativa</span>
                              </div>
                            )}

                            {/* Estoque do Concorrente / Status da Disputa */}
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700">
                              <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="text-[11px] font-medium text-slate-600">
                                Estoque concorrência:
                              </span>
                              <span className="font-mono font-bold text-slate-900 text-[11px]">
                                {cat.buy_box_winner_stock != null && cat.buy_box_winner_stock > 0
                                  ? `${cat.buy_box_winner_stock} un.`
                                  : cat.stock_status ||
                                    (cat.buy_box_winner_price
                                      ? '1+ un. (pronta entrega)'
                                      : 'Estoque não público')}
                              </span>
                            </div>

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
                                Ver anúncio concorrente <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Edição Simples Inline: Quantidade e Valor (Independentes do estoque local) */}
                      <div className="w-full lg:w-72 flex items-center gap-3 shrink-0 bg-slate-50 lg:bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                        {/* Quantidade */}
                        <div className="w-28 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 block">
                            Qtd Anúncio
                          </label>
                          <Input
                            type="number"
                            min={1}
                            value={item.formQuantity}
                            onChange={(e) => updateQuantity(originalIndex, Number(e.target.value))}
                            disabled={!item.selected || isPublishing}
                            className="h-8 text-xs font-mono font-bold bg-white"
                          />
                        </div>

                        {/* Valor */}
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 block flex items-center justify-between">
                            <span>Preço (R$)</span>
                            {isBelowBuyBox && (
                              <span
                                className="text-emerald-600 font-bold text-[10px]"
                                title="Seu preço está mais agressivo que o concorrente da Buy Box!"
                              >
                                Vencedor!
                              </span>
                            )}
                          </label>
                          <div className="relative">
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

                              <div className="flex items-center gap-3 text-[11px] pt-0.5 text-slate-500 flex-wrap">
                                {cat.buy_box_winner_price ? (
                                  <span className="font-mono text-emerald-700 font-semibold">
                                    Buy Box:{' '}
                                    {Number(cat.buy_box_winner_price).toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Buy Box: sem disputa ativa</span>
                                )}
                                <span className="text-slate-600">
                                  Estoque concorrente:{' '}
                                  <strong className="text-slate-800 font-mono">
                                    {cat.buy_box_winner_stock != null &&
                                    cat.buy_box_winner_stock > 0
                                      ? `${cat.buy_box_winner_stock} un.`
                                      : cat.stock_status ||
                                        (cat.buy_box_winner_price ? '1+ un.' : 'Não público')}
                                  </strong>
                                </span>
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
                            </div>
                          </div>

                          {/* Edição Simples Inline */}
                          <div className="w-full lg:w-72 flex items-center gap-3 shrink-0 bg-white p-2.5 rounded-lg border border-slate-200">
                            <div className="w-28 space-y-1">
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

                            <div className="flex-1 space-y-1">
                              <label className="text-[10px] uppercase font-bold text-slate-400 block flex items-center justify-between">
                                <span>Preço (R$)</span>
                                {isBelowBuyBox && (
                                  <span className="text-emerald-600 font-bold text-[9px]">
                                    Abaixo Buy Box
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
                                className="h-7 text-xs font-mono bg-slate-50"
                              />
                            </div>
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
