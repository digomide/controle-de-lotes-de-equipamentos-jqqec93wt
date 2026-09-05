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
  DollarSign,
  Boxes,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { productsService } from '@/services/products'
import { Product } from '@/types/inventory'
import {
  mlCatalogService,
  MLCatalogProduct,
  CatalogMatchResult,
  MLCatalogPublishJob,
} from '@/services/mlCatalogService'

export function AnunciosCatalogoTab() {
  const [query, setQuery] = useState('dell latitude 3420')
  const [searching, setSearching] = useState(false)
  const [catalogItems, setCatalogItems] = useState<CatalogMatchResult[]>([])
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([])
  const [loadingInventory, setLoadingInventory] = useState(true)
  const [lastStrategy, setLastStrategy] = useState<string>('')
  const [searchJobDebug, setSearchJobDebug] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)

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
  // Carregar produtos locais para match
  useEffect(() => {
    async function loadLocalProducts() {
      try {
        setLoadingInventory(true)
        const prods = await productsService.getAll()
        setInventoryProducts(prods)
      } catch (err) {
        console.warn('Erro ao carregar produtos locais:', err)
      } finally {
        setLoadingInventory(false)
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
      setCatalogItems([])
      setSearchJobDebug([])

      toast({
        title: 'Buscando no Catálogo do ML...',
        description: 'Consultando posições ativas e concorrência no Mercado Livre.',
      })

      const jobInit = await mlCatalogService.searchCatalog(q, 'MLB-NOTEBOOKS')
      const jobDone = await mlCatalogService.pollSearchJob(jobInit.id, (j) => {
        if (j.raw_debug) setSearchJobDebug(j.raw_debug)
      })

      if (jobDone.status === 'error') {
        throw new Error(jobDone.error_message || 'Falha ao buscar no catálogo do Mercado Livre')
      }

      const results = jobDone.results || []
      setLastStrategy(jobDone.strategy_used || 'api_products_search')
      if (jobDone.raw_debug) setSearchJobDebug(jobDone.raw_debug)

      if (results.length === 0) {
        toast({
          title: 'Nenhum produto de catálogo encontrado',
          description: 'Tente outro termo ou cole o link direto do produto (/p/MLB...).',
        })
        setCatalogItems([])
        return
      }

      // Casamento com o nosso estoque local
      const formatted: CatalogMatchResult[] = results.map((catProd) => {
        const matchInfo = mlCatalogService.matchCatalogWithInventory(catProd, inventoryProducts)
        const primaryProduct = matchInfo.matchedProducts[0]
        return {
          catalogProduct: catProd,
          matchedProducts: matchInfo.matchedProducts,
          totalAvailableStock: matchInfo.totalAvailableStock,
          suggestedPrice: matchInfo.suggestedPrice,
          selected: matchInfo.matchedProducts.length > 0, // pré-seleciona se tivermos estoque correspondente
          formQuantity: Math.max(1, matchInfo.totalAvailableStock || 1),
          formPrice: matchInfo.suggestedPrice,
          selectedProductId: primaryProduct?.id,
        }
      })

      setCatalogItems(formatted)

      const matchedCount = formatted.filter((f) => f.matchedProducts.length > 0).length
      toast({
        title: `${results.length} posições de catálogo encontradas`,
        description: `${matchedCount} posições possuem equipamentos correspondentes no seu estoque.`,
      })
    } catch (err: any) {
      console.error('Erro na busca de catálogo:', err)
      toast({
        title: 'Erro na busca de catálogo',
        description: err.message || 'Não foi possível consultar as posições do Mercado Livre.',
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

  // Selecionar todos / nenhum
  function toggleSelectAll(select: boolean) {
    setCatalogItems((prev) =>
      prev.map((item) => ({
        ...item,
        selected: select,
      })),
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
        const job = await mlCatalogService.createPublishJob({
          catalog_product_id: item.catalogProduct.catalog_product_id,
          product_id: item.selectedProductId,
          price: item.formPrice,
          quantity: item.formQuantity,
          domain_id: item.catalogProduct.domain_id || 'MLB-NOTEBOOKS',
          condition: 'used',
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
        setPublishLogs((prev) => {
          const next = [...prev]
          next[logIdx] = {
            ...next[logIdx],
            id: completed.id,
            status: 'error',
            message: completed.error_message || 'Falha na publicação.',
            canRetry: true,
          }
          return next
        })
        toast({
          title: 'Não foi possível publicar',
          description: completed.error_message || 'Revise as exigências do Mercado Livre.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      setPublishLogs((prev) => {
        const next = [...prev]
        next[logIdx] = {
          ...next[logIdx],
          status: 'error',
          message: err.message || 'Erro ao comunicar com a fila.',
          canRetry: true,
        }
        return next
      })
    } finally {
      setRetryingJobId(null)
    }
  }

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
                    Buy Box / Posições
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  No catálogo, você disputa a <strong>Buy Box</strong> do Mercado Livre com a ficha
                  técnica oficial do fabricante. Busque produtos compatíveis, vincule aos seus lotes
                  de notebooks e publique anúncios em massa com valor e quantidade flexíveis.
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
                  Buscando no Catálogo...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Buscar Posições
                </>
              )}
            </Button>
          </div>

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

          {/* Diagnóstico da Fonte / Cascata */}
          {lastStrategy && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600">
                  Método de consulta:
                </span>
                <Badge variant="outline" className="text-[10px] font-mono bg-slate-50">
                  {lastStrategy === 'api_products_search' && 'API Oficial ML (/products/search)'}
                  {lastStrategy === 'api_products_direct' &&
                    'Consulta Direta de Catálogo (/products/{id})'}
                  {lastStrategy === 'html_scrape_catalog_links' &&
                    'Cascata Scraping de Catálogo ML'}
                  {lastStrategy === 'none' && 'Nenhum resultado retornado'}
                </Badge>
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

      {/* Barra de Ações em Massa (quando há resultados) */}
      {catalogItems.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="select-all"
                checked={selectedCount > 0 && selectedCount === catalogItems.length}
                onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
              />
              <label
                htmlFor="select-all"
                className="text-xs font-bold text-slate-800 cursor-pointer select-none"
              >
                Selecionar todas as {catalogItems.length} posições de catálogo
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
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span>Posições de Catálogo Encontradas ({catalogItems.length})</span>
            <span>Edite a quantidade e valor para cada posição antes de publicar</span>
          </div>

          <div className="space-y-3">
            {catalogItems.map((item, idx) => {
              const cat = item.catalogProduct
              const hasMatch = item.matchedProducts.length > 0
              const isBelowBuyBox =
                cat.buy_box_winner_price && item.formPrice < cat.buy_box_winner_price

              return (
                <Card
                  key={cat.id || idx}
                  className={`border transition-all ${
                    item.selected
                      ? 'border-blue-400 bg-white shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 opacity-80'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      {/* Checkbox + Foto + Info do Catálogo */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={() => toggleItemSelection(idx)}
                          className="mt-1"
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

                        {/* Dados Básicos */}
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
                          </div>

                          <h4
                            className="text-sm font-bold text-slate-900 leading-snug line-clamp-2"
                            title={cat.title}
                          >
                            {cat.title}
                          </h4>

                          {/* Preço de Referência Concorrência (Buy Box) */}
                          <div className="flex items-center gap-3 text-xs pt-0.5">
                            {cat.buy_box_winner_price ? (
                              <span className="font-mono font-bold text-slate-700 flex items-center gap-1">
                                <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                                Buy Box concorrente:{' '}
                                <span className="text-emerald-700">
                                  {Number(cat.buy_box_winner_price).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">
                                Preço Buy Box não informado pelo ML
                              </span>
                            )}

                            {cat.permalink && (
                              <a
                                href={cat.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-1 font-mono text-[11px]"
                              >
                                Ver no ML <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Casamento com nosso Estoque */}
                      <div className="w-full lg:w-72 bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5 shrink-0">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Boxes className="w-3 h-3 text-slate-500" />
                            Nosso Estoque Casado
                          </span>
                          {hasMatch ? (
                            <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0">
                              {item.totalAvailableStock} un. disponível(is)
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-slate-400 text-[9px] px-1.5 py-0"
                            >
                              Sem match exato
                            </Badge>
                          )}
                        </div>

                        {hasMatch ? (
                          <div className="space-y-1">
                            <select
                              value={item.selectedProductId || ''}
                              onChange={(e) => updateSelectedProduct(idx, e.target.value)}
                              className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1 font-sans text-slate-800"
                            >
                              {item.matchedProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.brand} {p.model} (SKU: {p.sku || p.serial_number || p.code}) -
                                  R$ {p.unit_price}
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-slate-500 truncate">
                              {item.matchedProducts[0]?.name}
                            </p>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic">
                            Nenhum notebook correspondente por marca e modelo no estoque disponível.
                          </div>
                        )}
                      </div>

                      {/* Edição Simples Inline: Quantidade e Valor */}
                      <div className="w-full lg:w-64 flex items-center gap-3 shrink-0 bg-white lg:bg-transparent p-2 lg:p-0 rounded-lg border lg:border-0 border-slate-200">
                        {/* Quantidade */}
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400 block">
                            Qtd Anúncio
                          </label>
                          <Input
                            type="number"
                            min={1}
                            value={item.formQuantity}
                            onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                            disabled={!item.selected || isPublishing}
                            className="h-8 text-xs font-mono font-bold bg-white"
                          />
                        </div>

                        {/* Valor */}
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400 block flex items-center justify-between">
                            <span>Preço (R$)</span>
                            {isBelowBuyBox && (
                              <span
                                className="text-emerald-600 font-bold"
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
                              onChange={(e) => updatePrice(idx, Number(e.target.value))}
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
        </div>
      )}
    </div>
  )
}
