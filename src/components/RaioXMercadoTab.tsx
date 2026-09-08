import React, { useState, useMemo, useEffect } from 'react'
import {
  TrendingUp,
  Search,
  Sparkles,
  RefreshCw,
  Trophy,
  Package,
  Layers,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Store,
  DollarSign,
  Activity,
  Filter,
  ShieldCheck,
  Clock,
  Database,
  Users,
  Monitor,
  Target,
  Zap,
} from 'lucide-react'
import { CatalogPositionMonitor } from '@/components/CatalogPositionMonitor'
import { RawPositionsDrawer } from '@/components/RawPositionsDrawer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  mlCatalogService,
  formatMLSoldQuantity,
  type MLCatalogProduct,
} from '@/services/mlCatalogService'
import {
  aggregateSellersByExactProduct,
  recordAdSnapshots,
  type ExactProductSummary,
  type SellerPerformanceAggregate,
  type RaioXScopeMode,
} from '@/services/mlExactProductService'
import { type ExactProductSearchMode } from '@/lib/catalogFilter'
import {
  positionOverridesService,
  type PositionOverrideAction,
} from '@/services/positionOverridesService'
import { mlCollectorService, type CollectorSummaryReport } from '@/services/mlCollectorService'
import { PodioVendasCollector } from '@/components/PodioVendasCollector'

interface RaioXMercadoTabProps {
  onOpenCollector?: (term?: string) => void
}

export function RaioXMercadoTab({ onOpenCollector }: RaioXMercadoTabProps = {}) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('cooler lenovo m900')
  const [activeQuery, setActiveQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressText, setSearchProgressText] = useState('')
  const [stoppingJob, setStoppingJob] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [rawProducts, setRawProducts] = useState<MLCatalogProduct[]>([])
  const [historicalSnapshots, setHistoricalSnapshots] = useState<any[]>([])
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [snapshotSaved, setSnapshotSaved] = useState(false)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [selectedSellerDetail, setSelectedSellerDetail] =
    useState<SellerPerformanceAggregate | null>(null)
  const [showSellersDrawer, setShowSellersDrawer] = useState(false)
  const [showAllAdsDrawer, setShowAllAdsDrawer] = useState(false)
  const [showRawPositionsDrawer, setShowRawPositionsDrawer] = useState(false)
  const [showCatalogMonitor, setShowCatalogMonitor] = useState(false)
  const [adsListingFilter, setAdsListingFilter] = useState<'all' | 'premium' | 'classic'>('all')

  // Overrides manuais do usuário (MISSÃO 1)
  const [overrides, setOverrides] = useState<Record<string, PositionOverrideAction>>({})

  // Coleta do Navegador (Bypass WAF)
  const [collectorSalesMap, setCollectorSalesMap] = useState<Map<string, number>>(new Map())
  const [collectorMeta, setCollectorMeta] = useState<{
    importId: string
    importedAt: string
    itemsCount: number
    withSalesCount: number
    collectorSource?: string
  } | null>(null)
  const [collectorReport, setCollectorReport] = useState<CollectorSummaryReport | null>(null)
  const [loadingCollectorReport, setLoadingCollectorReport] = useState(false)

  // Controle de Escopo do Raio-X
  const [scopeMode, setScopeMode] = useState<RaioXScopeMode>('exact')
  const [manualBrain, setManualBrain] = useState<ExactProductSearchMode | null>(null)

  // Sugestões de produtos exatos para pesquisa rápida
  const suggestedExactProducts = [
    'cooler lenovo m900',
    'fonte desktop dell 3020',
    'dell latitude 5420 i5',
    'thinkpad t480',
    'iphone 17',
    'carregador dell 65w 4.5mm',
  ]

  // Carregar snapshots existentes do banco ao montar
  useEffect(() => {
    async function loadSnapshots() {
      try {
        const snaps = await pb.collection('ml_ad_snapshots').getList(1, 300, {
          sort: '-created',
        })
        if (snaps && snaps.items) {
          setHistoricalSnapshots(snaps.items)
        }
      } catch {
        /* intentionally ignored */
      }
    }
    loadSnapshots()
  }, [])

  // Carregar overrides e coletas do navegador quando a query ativa ou a busca inicial mudar
  useEffect(() => {
    const queryToUse = activeQuery || searchTerm.trim()
    if (!queryToUse) {
      setOverrides({})
      setCollectorSalesMap(new Map())
      setCollectorMeta(null)
      setCollectorReport(null)
      return
    }
    async function loadOverridesAndCollector() {
      try {
        const map = await positionOverridesService.getOverridesForTerm(queryToUse)
        setOverrides(map)
      } catch (err) {
        console.warn('Erro ao carregar overrides:', err)
      }

      try {
        const latestImport = await mlCollectorService.getLatestImportForTerm(queryToUse)
        if (latestImport && latestImport.payload?.results) {
          const sMap = new Map<string, number>()
          latestImport.payload.results.forEach((item) => {
            if (item.sold_quantity != null && item.sold_quantity > 0) {
              if (item.id) sMap.set(item.id, item.sold_quantity)
              if (item.mlb_id) sMap.set(item.mlb_id, item.sold_quantity)
            }
          })
          setCollectorSalesMap(sMap)
          setCollectorMeta({
            importId: latestImport.id,
            importedAt: latestImport.imported_at || latestImport.created || '',
            itemsCount: latestImport.results_count || latestImport.payload.results.length,
            withSalesCount: latestImport.with_sales_count || sMap.size,
            collectorSource: latestImport.notes || latestImport.payload.source || 'manual',
          })
        } else {
          setCollectorSalesMap(new Map())
          setCollectorMeta(null)
        }
      } catch (err) {
        console.warn('Erro ao carregar coletas do navegador:', err)
      }

      // Carregar relatório consolidado e deduplicado para o Pódio de Vendas
      try {
        setLoadingCollectorReport(true)
        const report = await mlCollectorService.getCollectorSummaryReport(queryToUse)
        if (report && report.ok && report.total_deduplicated_ads > 0) {
          setCollectorReport(report)
        } else {
          setCollectorReport(null)
        }
      } catch (err) {
        console.warn('Erro ao gerar relatório do Pódio de Vendas:', err)
        setCollectorReport(null)
      } finally {
        setLoadingCollectorReport(false)
      }
    }
    loadOverridesAndCollector()
  }, [activeQuery, searchTerm])

  // Interromper busca
  async function handleStop() {
    if (!currentJobId || stoppingJob) return
    setStoppingJob(true)
    try {
      await mlCatalogService.stopSearchJob(currentJobId)
      toast({
        title: 'Parando varredura...',
        description: 'Compilando os dados já minerados do produto exato.',
      })
    } catch (err) {
      console.warn('Erro ao parar job:', err)
    } finally {
      setTimeout(() => setStoppingJob(false), 1500)
    }
  }

  // Executar busca profunda de mercado
  async function runAnalysis(queryToUse?: string, forceRefresh = false) {
    const q = (queryToUse ?? searchTerm).trim()
    if (!q) {
      toast({
        title: 'Informe um produto exato',
        description: 'Ex.: "fonte desktop dell 3020", "dell latitude 5420 i5", "thinkpad t480"',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setActiveQuery(q)
    setRawProducts([])
    setCurrentJobId(null)
    setIsCached(false)
    setCachedAt(null)
    setSnapshotSaved(false)
    setSelectedSellerDetail(null)
    setSearchProgressText(
      forceRefresh
        ? 'Varrendo o Mercado Livre em tempo real para o produto exato...'
        : 'Iniciando varredura profunda para "' + q + '"...',
    )

    try {
      const jobInit = await mlCatalogService.searchCatalog(q, '', 'all', forceRefresh)
      setCurrentJobId(jobInit.id)

      const jobDone = await mlCatalogService.pollSearchJob(jobInit.id, (j) => {
        if (j.progress_text) setSearchProgressText(j.progress_text)
        if (Array.isArray(j.results) && j.results.length > 0) {
          setRawProducts(j.results)
        }
      })

      if (jobDone.status === 'error') {
        throw new Error(jobDone.error_message || 'Falha ao buscar no catálogo')
      }

      const results = jobDone.results || []
      setRawProducts(results)

      if (jobDone.is_cached || jobDone.strategy_used?.includes('cached')) {
        setIsCached(true)
        setCachedAt(jobDone.cached_at || jobDone.created || null)
      }

      if (results.length === 0) {
        toast({
          title: 'Nenhum anúncio encontrado no Mercado Livre',
          description: 'Tente outro termo ou amplie a busca.',
        })
      } else {
        toast({
          title: `Varredura concluída: ${results.length} posições mineradas`,
          description: `Aplicando filtro de precisão de produto exato para "${q}".`,
        })
      }
    } catch (err: any) {
      console.error('Erro no Raio-X:', err)
      toast({
        title: 'Falha na varredura do produto',
        description: err?.message || 'Não foi possível carregar os dados do Mercado Livre.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setCurrentJobId(null)
    }
  }

  // Reset do cérebro manual quando a query de busca muda
  useEffect(() => {
    setManualBrain(null)
  }, [activeQuery])

  // Agregação dos dados por PRODUTO EXATO e por SELLER respeitando o modo de escopo, cérebro e overrides do usuário
  const summary: ExactProductSummary | null = useMemo(() => {
    if (!rawProducts || rawProducts.length === 0 || !activeQuery) return null
    return aggregateSellersByExactProduct(
      rawProducts,
      activeQuery,
      historicalSnapshots,
      scopeMode,
      manualBrain || undefined,
      overrides,
      collectorSalesMap.size > 0 ? collectorSalesMap : undefined,
      collectorMeta,
    )
  }, [
    rawProducts,
    activeQuery,
    historicalSnapshots,
    scopeMode,
    manualBrain,
    overrides,
    collectorSalesMap,
    collectorMeta,
  ])

  // Salvar snapshot periódico no banco (sempre usando os dados agregados do modo Produto Exato)
  async function handleSaveSnapshot() {
    if (!rawProducts || rawProducts.length === 0 || !activeQuery || savingSnapshot) return
    setSavingSnapshot(true)
    try {
      // Requisito 3: "os snapshots devem continuar gravando os dados agregados do modo Produto exato"
      const exactSummary =
        scopeMode === 'exact'
          ? summary
          : aggregateSellersByExactProduct(
              rawProducts,
              activeQuery,
              historicalSnapshots,
              'exact',
              manualBrain || undefined,
            )

      if (!exactSummary) {
        throw new Error('Nenhum dado do produto exato para gravar.')
      }

      const res = await recordAdSnapshots(exactSummary)
      setSnapshotSaved(true)
      toast({
        title: 'Snapshot de histórico registrado!',
        description: `${res.savedCount} anúncio(s) e preços do produto exato salvos para histórico de 60 dias.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar snapshot',
        description: err?.message || 'Falha ao gravar no banco.',
        variant: 'destructive',
      })
    } finally {
      setSavingSnapshot(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner Superior com Explicação Transparente */}
      <Card className="border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    Raio-X de Mercado Global
                    <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-300 text-[10px] font-bold">
                      Análise Global do Produto
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Consolida o universo completo de anúncios do produto exato no Mercado Livre:
                    força de mercado, estoque agregado, faixa de preços, liquidez, distribuição de
                    anúncios e oportunidade de margem.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                className="text-xs h-9 bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white gap-1.5"
              >
                <Info className="w-3.5 h-3.5" />
                Como funciona o Termômetro?
                {showHowItWorks ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Explicação Expansível dos Critérios Transparentes */}
          {showHowItWorks && (
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5" /> 1. Filtro de Produto Exato
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Descarta automaticamente produtos genéricos, acessórios desconexos e modelos
                  diferentes. Ao buscar &quot;fonte desktop dell 3020&quot;, preserva apenas fontes
                  compatíveis com o Dell 3020.
                </p>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5 text-xs">
                  <TrendingUp className="w-3.5 h-3.5" /> 2. Métricas Globais Consolidadas
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Reúne todos os anúncios ativos legítimos do produto para mensurar a força real do
                  item no ML: estoque total visível, dispersão de preço (mín/méd/máx), volume de
                  vendedores e mix Premium vs Clássico.
                </p>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                  <Database className="w-3.5 h-3.5" /> 3. Honestidade e Snapshots
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Nunca inventamos números. Onde a API do ML bloqueia vendas de terceiros (403),
                  usamos os sinais reais auditáveis e gravamos snapshots no banco para medir deltas
                  reais de 60 dias conforme acumulamos histórico.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barra de Entrada / Pesquisa */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardContent className="p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              runAnalysis(searchTerm, false)
            }}
            className="space-y-3"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Pesquise o produto exato (ex.: fonte desktop dell 3020, thinkpad t480, latitude 5420)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 text-sm bg-slate-50 border-slate-200 focus:bg-white"
                  disabled={loading}
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-2 shadow-xs"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  {loading ? 'Analisando Mercado...' : 'Analisar Mercado Global'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runAnalysis(searchTerm, true)}
                  disabled={loading}
                  className="h-10 px-3 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
                  title="Forçar varredura ignorando o cache"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar
                </Button>

                {loading && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleStop}
                    disabled={stoppingJob}
                    className="h-10 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {stoppingJob ? 'Parando...' : 'Parar'}
                  </Button>
                )}
              </div>
            </div>

            {/* Chips de produtos sugeridos para clique rápido */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Sugestões de produtos:
              </span>
              {suggestedExactProducts.map((prod) => (
                <button
                  key={prod}
                  type="button"
                  onClick={() => {
                    setSearchTerm(prod)
                    runAnalysis(prod, false)
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition-colors"
                >
                  {prod}
                </button>
              ))}
            </div>

            {/* Status da busca ao vivo / cache */}
            {loading && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex items-center gap-3 text-xs text-indigo-900 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                <span className="font-medium">
                  {progressText ||
                    'Varrendo posições e consultando concorrência no Mercado Livre...'}
                </span>
              </div>
            )}

            {!loading && isCached && cachedAt && (
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                <Badge variant="outline" className="bg-slate-50 text-slate-600 text-[10px] h-4">
                  Cache Ativo (15 min)
                </Badge>
                <span>
                  Resultados preservados da varredura realizada às {cachedAt.substring(11, 16)}.
                </span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* PÓDIO DE VENDAS REAIS (quando já temos coletas gravadas para o termo mesmo antes de rodar o Raio-X ou durante) */}
      {!summary && !loading && collectorReport && collectorReport.total_deduplicated_ads > 0 && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Exibindo dados reais já coletados pelo <strong>Coletor do Navegador</strong> para
                &quot;{activeQuery || searchTerm}&quot;. Clique em{' '}
                <strong>&quot;Analisar Mercado Global&quot;</strong> acima para cruzar com a API ao
                vivo do Mercado Livre.
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => runAnalysis(activeQuery || searchTerm, false)}
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-bold"
            >
              Analisar Catálogo ML
            </Button>
          </div>
          <PodioVendasCollector
            report={collectorReport}
            onOpenCollector={() => onOpenCollector && onOpenCollector(activeQuery || searchTerm)}
          />
        </div>
      )}

      {/* Estado Vazio (sem resumo e sem coleta do navegador) */}
      {!summary &&
        !loading &&
        (!collectorReport || collectorReport.total_deduplicated_ads === 0) && (
          <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/60">
            <CardContent className="p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                <Flame className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Nenhuma análise de produto exato carregada
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Digite acima o produto desejado (ex.: &quot;fonte desktop dell 3020&quot;). O
                sistema fará a busca no ML, aplicará o filtro de similaridade rigorosa e montará o{' '}
                <strong>Termômetro de Vendas por Seller</strong>. Se houver coletas salvas do
                Coletor do Navegador, o <strong>Pódio de Vendas</strong> aparecerá em destaque.
              </p>
            </CardContent>
          </Card>
        )}

      {/* CONTEÚDO PRINCIPAL: SÍNTESE GLOBAL DO PRODUTO + GAVETA DE ANÚNCIOS + GAVETA DE SELLERS */}
      {summary && (
        <div className="space-y-6">
          {/* SELETOR DE ESCOPO DO RAIO-X: 3 MODOS + CÉREBRO DE DETECÇÃO */}
          <Card className="border-indigo-100 bg-white shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-indigo-600" /> Escopo do Raio-X:
                    </span>
                    <span className="text-xs text-slate-500">
                      Escolha como as {summary.totalRawPositions} posições mineradas devem ser
                      avaliadas
                    </span>
                  </div>
                </div>

                {/* Seletor com 3 modos (chips/tabs) */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setScopeMode('exact')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      scopeMode === 'exact'
                        ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>🎯</span>
                    <span>Produto exato</span>
                    {scopeMode === 'exact' && (
                      <Badge className="bg-indigo-600 text-white text-[9px] px-1 py-0 h-4">
                        Padrão
                      </Badge>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setScopeMode('all_mentions')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      scopeMode === 'all_mentions'
                        ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>📦</span>
                    <span>Tudo que cita o termo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScopeMode('own_only')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      scopeMode === 'own_only'
                        ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>👤</span>
                    <span>Só meus anúncios</span>
                  </button>
                </div>
              </div>

              {/* BARRA DE INTELIGÊNCIA DO CÉREBRO NO MODO "PRODUTO EXATO" */}
              {scopeMode === 'exact' && (
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 font-medium">Cérebro ativo:</span>
                    <Badge
                      className={`text-[11px] font-bold px-2 py-0.5 gap-1.5 ${
                        summary.activeBrain === 'part'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-blue-100 text-blue-900 border-blue-300'
                      }`}
                    >
                      {summary.activeBrain === 'part'
                        ? '⚙️ Busca de Peça'
                        : '📱 Busca de Produto Inteiro'}
                    </Badge>

                    <span className="text-[11px] text-slate-500">
                      {summary.activeBrain === 'part'
                        ? '(Exige componente + modelo + marca; contexto não desclassifica)'
                        : '(Exige modelo/marca e descarta capinhas, películas, cabos e compatíveis)'}
                    </span>
                  </div>

                  {/* Alternador manual de cérebro */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium">Alternar:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setManualBrain(summary.activeBrain === 'part' ? 'whole_product' : 'part')
                      }
                      className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                    >
                      Mudar p/ {summary.activeBrain === 'part' ? 'Produto Inteiro' : 'Peça'}
                    </button>
                    {manualBrain && (
                      <button
                        type="button"
                        onClick={() => setManualBrain(null)}
                        className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-600 underline"
                      >
                        Resetar auto
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* INSIGHT ESTRATÉGICO NO MODO "TUDO QUE CITA O TERMO" */}
              {scopeMode === 'all_mentions' && (
                <div className="pt-2 border-t border-slate-100 p-2.5 bg-amber-50/80 rounded-md border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Insight de margem:</strong> cerca de{' '}
                      <strong>
                        {summary.accessoriesPercent}% ({summary.accessoriesCount} de{' '}
                        {summary.totalRawPositions} posições)
                      </strong>{' '}
                      do que cita &quot;{summary.searchTerm}&quot; são acessórios (capas, películas,
                      cabos ou compatíveis). Isso mapeia onde o ecossistema distribui volume e
                      margem.
                    </span>
                  </div>
                </div>
              )}

              {/* NOTA DO MODO "SÓ MEUS ANÚNCIOS" */}
              {scopeMode === 'own_only' && (
                <div className="pt-2 border-t border-slate-100 p-2.5 bg-indigo-50/80 rounded-md border border-indigo-200 text-xs text-indigo-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    Exibindo exclusivamente as posições da própria conta (badge 🏅 &quot;Sua
                    posição&quot;) mineradas nesta varredura para acompanhar ranking interno e Buy
                    Box.
                  </span>
                </div>
              )}

              {/* AVISO DE KITS/LOTES FORA DAS COMPARAÇÕES */}
              {summary.kitsExcludedCount > 0 && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                  <Badge variant="outline" className="bg-slate-50 text-slate-600 text-[10px] h-4">
                    Kits/Lotes Isolados ({summary.kitsExcludedCount})
                  </Badge>
                  <span>
                    Anúncios de kits/atacado foram separados para manter as comparações de preço e o
                    termômetro fiéis aos anúncios avulsos.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PÓDIO DE VENDAS REAIS (COLETOR DO NAVEGADOR) */}
          {collectorReport && collectorReport.total_deduplicated_ads > 0 && (
            <div className="space-y-2">
              <PodioVendasCollector
                report={collectorReport}
                onOpenCollector={() => onOpenCollector && onOpenCollector(activeQuery)}
              />
            </div>
          )}

          {/* 1. PAINEL PRINCIPAL: SÍNTESE GLOBAL DO PRODUTO */}
          <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 shadow-sm">
            <CardHeader className="pb-4 border-b border-indigo-100/60">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-wider">
                      {scopeMode === 'exact'
                        ? 'Síntese Global do Produto Exato'
                        : scopeMode === 'all_mentions'
                          ? 'Síntese Bruta do Mercado'
                          : 'Síntese dos Meus Anúncios'}
                    </Badge>
                    <span className="text-xs font-bold text-slate-900">
                      &quot;{summary.searchTerm}&quot;
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold"
                    >
                      {summary.marketForceExplanation}
                    </Badge>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    {scopeMode === 'exact' && (
                      <>
                        {summary.exactMatchedPositionsCount} de {summary.totalRawPositions} posições
                        são deste produto exato
                      </>
                    )}
                    {scopeMode === 'all_mentions' && (
                      <>
                        {summary.exactMatchedPositionsCount} de {summary.totalRawPositions} posições
                        citam o termo
                      </>
                    )}
                    {scopeMode === 'own_only' && (
                      <>
                        {summary.exactMatchedPositionsCount} de {summary.totalRawPositions} posições
                        pertencem à sua conta
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {scopeMode === 'exact' && (
                      <>
                        Filtro taxonômico (
                        {summary.activeBrain === 'part'
                          ? 'Cérebro de Peça'
                          : 'Cérebro de Produto Inteiro'}
                        ) preservou {summary.exactMatchedPositionsCount} anúncio(s) legítimos e
                        descartou {summary.filteredOutCount} produto(s) incompatíveis ou acessórios.
                      </>
                    )}
                    {scopeMode === 'all_mentions' && (
                      <>
                        Resultados brutos sem filtro de barreira. {summary.accessoriesCount}{' '}
                        anúncio(s) identificados como acessórios ({summary.accessoriesPercent}%).
                      </>
                    )}
                    {scopeMode === 'own_only' && (
                      <>
                        Filtro restrito às posições mineradas da conta INFOPRECOBAIXO no Mercado
                        Livre.
                      </>
                    )}
                  </p>
                </div>

                {/* Ações Globais: Posições Brutas (1.043), Anúncios Filtrados e Gravar Snapshot */}
                <div className="flex items-center gap-2 flex-wrap">
                  {onOpenCollector && (
                    <Button
                      size="sm"
                      onClick={() => onOpenCollector(activeQuery)}
                      className={`text-xs h-9 font-bold gap-1.5 shadow-xs ${
                        summary.collectorSource
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                      title="Abrir o Coletor do Navegador para alimentar contadores públicos de vendas"
                    >
                      <Activity className="w-3.5 h-3.5 text-white" />
                      {summary.collectorSource
                        ? `Coletor Ativo (${summary.collectorSource.withSalesCount} vendas)`
                        : 'Coletor do Navegador'}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={() => setShowRawPositionsDrawer(!showRawPositionsDrawer)}
                    className={`text-xs h-9 font-bold gap-1.5 shadow-xs ${
                      showRawPositionsDrawer
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300'
                        : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40'
                    }`}
                    title="Abrir gaveta com TODAS as posições brutas mineradas da busca para julgar e vincular manualmente"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    {showRawPositionsDrawer
                      ? `Recolher Posições Brutas (${summary.totalRawPositions})`
                      : `Posições Brutas (${summary.totalRawPositions})`}
                    {showRawPositionsDrawer ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAllAdsDrawer(!showAllAdsDrawer)}
                    className="text-xs h-9 bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                    {showAllAdsDrawer
                      ? 'Ocultar Anúncios'
                      : `Ver Anúncios Vinculados (${summary.allAds.length})`}
                    {showAllAdsDrawer ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveSnapshot}
                    disabled={savingSnapshot || snapshotSaved}
                    className="text-xs h-9 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5"
                    title="Gravar foto atual de estoque, preço e vendas para histórico global de 60 dias"
                  >
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    {snapshotSaved
                      ? 'Snapshot Gravado ✓'
                      : savingSnapshot
                        ? 'Gravando...'
                        : 'Gravar Snapshot Histórico'}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Linha 1 de Cards Globais: 6 Métricas Principais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Total de Anúncios Ativos */}
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-500" /> Anúncios Ativos
                  </span>
                  <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                    {summary.totalActiveAds}
                  </span>
                  <span className="text-[10px] text-slate-500">Posições do produto exato</span>
                </div>

                {/* Estoque Total Somado */}
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <Package className="w-3 h-3 text-blue-500" /> Estoque Somado
                  </span>
                  <span className="text-2xl font-black text-blue-700 font-mono mt-0.5 block">
                    {summary.totalVisibleStock} un.
                  </span>
                  <span className="text-[10px] text-slate-500">Volume total visível</span>
                </div>

                {/* Faixa de Preço Global */}
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-500" /> Faixa de Preço
                  </span>
                  <span className="text-lg font-black text-emerald-700 font-mono mt-1 block">
                    {summary.priceMin.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block truncate">
                    Até{' '}
                    {summary.priceMax.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    Méd.{' '}
                    {summary.priceAvg.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>

                {/* Vendas Expostas Somadas */}
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <Activity className="w-3 h-3 text-amber-500" /> Vendas Expostas
                  </span>
                  <span className="text-xl font-black text-slate-900 font-mono mt-1 block">
                    {summary.hasAnyConfirmedSales ? (
                      <span className="text-emerald-700">
                        {summary.totalConfirmedSalesAcrossSellers} un.
                      </span>
                    ) : (
                      'Não exposto'
                    )}
                  </span>
                  {summary.hasAnyConfirmedSales ? (
                    <span className="text-[10px] text-emerald-700 font-medium block leading-tight">
                      {summary.collectorSource
                        ? (summary.collectorSource.collectorSource || '')
                            .toLowerCase()
                            .includes('auto')
                          ? '⚡ Coletor Automático (Tampermonkey)'
                          : (summary.collectorSource.collectorSource || '')
                                .toLowerCase()
                                .includes('turbo')
                            ? '⚡ Coletor Turbo Multi-páginas'
                            : '🔥 Coletor do Navegador (reais)'
                        : 'Auditadas via ML/Delta'}
                    </span>
                  ) : (
                    <div className="pt-0.5">
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        ML bloqueia WAF 403
                      </span>
                      {onOpenCollector && (
                        <button
                          type="button"
                          onClick={() => onOpenCollector(activeQuery)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline mt-0.5 block"
                        >
                          Usar Coletor do Navegador →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Vendedores Distintos */}
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <Users className="w-3 h-3 text-purple-500" /> Vendedores
                  </span>
                  <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                    {summary.uniqueSellersCount}
                  </span>
                  <span className="text-[10px] text-slate-500">Lojas concorrentes</span>
                </div>

                {/* Distribuição Premium / Clássico */}
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <Percent className="w-3 h-3 text-indigo-500" /> Premium / Clássico
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {summary.distribution.premiumPercent}%
                    </span>
                    <span className="text-xs text-slate-400">/</span>
                    <span className="text-base font-bold text-slate-700 font-mono">
                      {summary.distribution.classicPercent}%
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    {summary.distribution.premiumCount} Prem. · {summary.distribution.classicCount}{' '}
                    Cláss.
                  </span>
                </div>
              </div>

              {/* Card Destaque: Posição de Catálogo do ML (Substitui o antigo pseudo-seller de catálogo) */}
              {summary.catalogPosition && (
                <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-lg border border-amber-300 dark:border-amber-800 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1 px-2 py-0.5 text-xs font-semibold">
                        <Store className="h-3.5 w-3.5" />🏪 Posição de Catálogo do ML
                      </Badge>
                      {summary.catalogPosition.catalogProductId && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {summary.catalogPosition.catalogProductId}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {summary.catalogPosition.totalAdsCount} anúncio(s) concorrendo
                      </Badge>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {summary.catalogPosition.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Página unificada do Mercado Livre agregando{' '}
                      {summary.catalogPosition.distinctSellersCount} sellers.
                      {summary.catalogPosition.buyBoxWinner
                        ? ` Vencedor atual da Buy Box: ${summary.catalogPosition.buyBoxWinner.sellerNickname} a R$ ${summary.catalogPosition.buyBoxWinner.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
                        : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => setShowCatalogMonitor(!showCatalogMonitor)}
                      className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5 shadow-xs"
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      {showCatalogMonitor ? 'Recolher Monitor' : 'Abrir Monitor do Catálogo'}
                    </Button>
                    {summary.catalogPosition.permalink && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 border-amber-300"
                        asChild
                      >
                        <a
                          href={summary.catalogPosition.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver no ML
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* SEÇÃO EXPANDIDA DO MONITOR DA POSIÇÃO DE CATÁLOGO */}
              {summary.catalogPosition && showCatalogMonitor && (
                <div className="pt-2">
                  <CatalogPositionMonitor catalogPosition={summary.catalogPosition} />
                </div>
              )}

              {/* Linha 2 de Cards Globais: Força de Mercado no ML + Oportunidade de Margem na Buy Box */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
                {/* Indicador de Força de Mercado Global */}
                <div className="lg:col-span-5 p-4 bg-white rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-500" /> Força do Produto no Mercado
                        Livre
                      </span>
                      <Badge
                        className={`text-[10px] font-bold px-2 py-0.5 ${
                          summary.marketForceTier === 'strong'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : summary.marketForceTier === 'moderate'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        {summary.marketForceTier === 'strong'
                          ? '🔥 Forte / Alta Demanda'
                          : summary.marketForceTier === 'moderate'
                            ? '🌡️ Demanda Moderada'
                            : '❄️ Nicho / Disputa Baixa'}
                      </Badge>
                    </div>

                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black font-mono text-slate-900">
                        {summary.marketForceScore}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">/ 100 pontos</span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {summary.marketForceExplanation}. Avaliação baseada no volume de{' '}
                      {summary.totalActiveAds} anúncios,
                      {summary.uniqueSellersCount} sellers em disputa e estoque de{' '}
                      {summary.totalVisibleStock} unidades.
                    </p>
                  </div>

                  {/* Barra visual de força do produto */}
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200 mt-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        summary.marketForceTier === 'strong'
                          ? 'bg-emerald-600'
                          : summary.marketForceTier === 'moderate'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.max(10, summary.marketForceScore)}%` }}
                    />
                  </div>
                </div>

                {/* REFORMULAÇÃO COMPLETA: OPORTUNIDADE DE MARGEM MEDIDA CONTRA A ÂNCORA DE QUEM VENDE */}
                <div className="lg:col-span-7 p-4 bg-gradient-to-br from-emerald-50/80 via-amber-50/40 to-white rounded-lg border border-emerald-200 shadow-2xs flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Header do Card */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase text-emerald-950 tracking-wider flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-emerald-600" /> Oportunidade de Margem &
                        Âncora de Preço
                      </span>
                      {summary.bestOpportunityMargin && (
                        <div className="flex items-center gap-1.5">
                          <Badge
                            className={`text-[10px] font-bold px-2 py-0.5 ${
                              summary.bestOpportunityMargin.opportunityTier === 'high'
                                ? 'bg-emerald-600 text-white'
                                : summary.bestOpportunityMargin.opportunityTier === 'intense'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-blue-600 text-white'
                            }`}
                          >
                            {summary.bestOpportunityMargin.opportunityTier === 'high'
                              ? '🎯 Oportunidade Alta'
                              : summary.bestOpportunityMargin.opportunityTier === 'intense'
                                ? '⚡ Disputa Intensa'
                                : '❄️ Mercado Frio'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono font-bold bg-white text-slate-700 border-slate-300"
                          >
                            Score: {summary.bestOpportunityMargin.opportunityScore}/100
                          </Badge>
                        </div>
                      )}
                    </div>

                    {summary.bestOpportunityMargin ? (
                      <div className="space-y-3">
                        {/* Grade Principal: Âncora de Preço vs Faixa de Entrada Sugerida */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* Coluna 1: Âncora de Preço ("O mercado paga R$ X") */}
                          <div className="p-3 bg-white/90 rounded-lg border border-emerald-100 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                <DollarSign className="w-3 h-3 text-emerald-600" /> O mercado paga
                                (Âncora)
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-4 bg-emerald-50 text-emerald-800 border-emerald-200"
                              >
                                {summary.bestOpportunityMargin.anchorSource === 'buy_box_leader'
                                  ? 'Líder Buy Box'
                                  : summary.bestOpportunityMargin.anchorSource ===
                                      'confirmed_sales_median'
                                    ? 'Mediana Vendas'
                                    : 'Referência'}
                              </Badge>
                            </div>

                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-black font-mono text-emerald-900">
                                {summary.bestOpportunityMargin.anchorPrice.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-tight">
                              Origem:{' '}
                              <strong>{summary.bestOpportunityMargin.anchorSellerNickname}</strong>{' '}
                              (quem realmente tem relevância e vende).
                            </p>
                          </div>

                          {/* Coluna 2: Faixa de Entrada Sugerida ("Entre com R$ Y-Z") */}
                          <div className="p-3 bg-white/90 rounded-lg border border-amber-200/80 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase text-amber-900 flex items-center gap-1">
                                <Zap className="w-3 h-3 text-amber-600" /> Entre com (Preço
                                Saudável)
                              </span>
                              <Badge className="bg-amber-100 text-amber-900 text-[9px] px-1 py-0 h-4 border-amber-300 font-bold">
                                Margem: {summary.bestOpportunityMargin.marginPercentMin}% a{' '}
                                {summary.bestOpportunityMargin.marginPercentMax}%
                              </Badge>
                            </div>

                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-black font-mono text-amber-950">
                                {summary.bestOpportunityMargin.suggestedEntryMin.toLocaleString(
                                  'pt-BR',
                                  { style: 'currency', currency: 'BRL' },
                                )}
                              </span>
                              <span className="text-xs text-amber-700 font-bold">a</span>
                              <span className="text-lg font-black font-mono text-amber-900">
                                {summary.bestOpportunityMargin.suggestedEntryMax.toLocaleString(
                                  'pt-BR',
                                  { style: 'currency', currency: 'BRL' },
                                )}
                              </span>
                            </div>

                            <p className="text-[11px] text-amber-900 leading-tight">
                              Logo abaixo da âncora (R${' '}
                              {summary.bestOpportunityMargin.marginAmountMin} a R${' '}
                              {summary.bestOpportunityMargin.marginAmountMax} de margem),{' '}
                              <strong>sem cair no piso</strong>.
                            </p>
                          </div>
                        </div>

                        {/* Chips de Transparência dos Componentes da Nota (como faz o Termômetro) */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Pilares do Score:
                          </span>
                          <span
                            className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 flex items-center gap-1 shadow-2xs"
                            title="Poucos vendedores no produto exato abrem espaço de preço livre"
                          >
                            <Users className="w-3 h-3 text-purple-600" />
                            Concorrência:{' '}
                            <strong>
                              {summary.bestOpportunityMargin.scoreComponents.competitionScore}/35
                              pts
                            </strong>
                          </span>
                          <span
                            className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 flex items-center gap-1 shadow-2xs"
                            title="Estoque total ralo frente à demanda aparente"
                          >
                            <Package className="w-3 h-3 text-blue-600" />
                            Estoque Ralo:{' '}
                            <strong>
                              {summary.bestOpportunityMargin.scoreComponents.stockPressureScore}/35
                              pts
                            </strong>
                          </span>
                          <span
                            className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 flex items-center gap-1 shadow-2xs"
                            title="Âncora de preço com espaço de margem comprovada"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Espaço de Margem:{' '}
                            <strong>
                              {summary.bestOpportunityMargin.scoreComponents.marginSpaceScore}/30
                              pts
                            </strong>
                          </span>
                          {summary.bestOpportunityMargin.scoreComponents.demandScore !==
                            undefined && (
                            <span
                              className="text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300 text-emerald-900 flex items-center gap-1 shadow-2xs font-bold"
                              title="Bônus por vendas reais confirmadas via Coletor do Navegador"
                            >
                              <Activity className="w-3 h-3 text-emerald-600" />
                              Demanda Real (Coletor):{' '}
                              <strong>
                                +{summary.bestOpportunityMargin.scoreComponents.demandScore} pts
                              </strong>
                            </span>
                          )}
                        </div>

                        {/* Explicação da Regra de Ouro */}
                        <p className="text-xs text-slate-700 leading-relaxed bg-white/70 p-2.5 rounded-md border border-slate-200">
                          {summary.bestOpportunityMargin.explanation}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mt-2">
                        Dados de margem sob consulta ou pouca dispersão de preço observada.
                      </p>
                    )}
                  </div>

                  {/* Rodapé do Card com Regra de Ouro / Filosofia */}
                  <div className="pt-2.5 mt-2 border-t border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Regra de Ouro:</strong> Baixa concorrência é multiplicador de
                        margem. Não corte preço para acompanhar anúncios sem relevância.
                      </span>
                    </div>

                    {summary.priceMin > 0 &&
                      summary.bestOpportunityMargin &&
                      summary.priceMin < summary.bestOpportunityMargin.suggestedEntryMin && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Piso informativo descartado: R${' '}
                          {summary.priceMin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MISSÃO 1: PAINEL DE POSIÇÕES BRUTAS ("GAVETA DAS 1.043") */}
          {showRawPositionsDrawer && (
            <RawPositionsDrawer
              searchTerm={summary.searchTerm}
              rawProducts={rawProducts}
              activeBrain={summary.activeBrain}
              overrides={overrides}
              onOverrideChange={(updated) => setOverrides(updated)}
            />
          )}

          {/* GAVETA GLOBAL 1: TODOS OS ANÚNCIOS DO PRODUTO EXATO */}
          {showAllAdsDrawer && (
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    Universo de Anúncios do Produto Exato ({summary.allAds.length} anúncios ativos)
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lista completa de anúncios catalogados para este modelo no Mercado Livre.
                  </p>
                </div>

                {/* Filtro por tipo de anúncio */}
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={adsListingFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setAdsListingFilter('all')}
                    className="h-7 text-xs px-2.5"
                  >
                    Todos ({summary.allAds.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={adsListingFilter === 'premium' ? 'default' : 'outline'}
                    onClick={() => setAdsListingFilter('premium')}
                    className="h-7 text-xs px-2.5"
                  >
                    Premium ({summary.distribution.premiumCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={adsListingFilter === 'classic' ? 'default' : 'outline'}
                    onClick={() => setAdsListingFilter('classic')}
                    className="h-7 text-xs px-2.5"
                  >
                    Clássico ({summary.distribution.classicCount})
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {summary.allAds
                    .filter((ad) => {
                      if (adsListingFilter === 'premium') return ad.listingTypeLabel === 'Premium'
                      if (adsListingFilter === 'classic') return ad.listingTypeLabel !== 'Premium'
                      return true
                    })
                    .map((ad, idx) => (
                      <div
                        key={ad.id || idx}
                        className="p-3.5 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {ad.thumbnail ? (
                            <img
                              src={ad.thumbnail}
                              alt={ad.title}
                              className="w-11 h-11 object-cover rounded border border-slate-200 shrink-0"
                            />
                          ) : (
                            <Package className="w-11 h-11 text-slate-300 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-bold text-slate-900 truncate" title={ad.title}>
                                {ad.title}
                              </h5>
                              {ad.isBuyBoxWinner && (
                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-bold px-1.5 py-0 h-4">
                                  Detém Buy Box
                                </Badge>
                              )}
                              {ad.isOwnAccount && (
                                <Badge className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0 h-4">
                                  Sua Conta
                                </Badge>
                              )}
                              {ad.isKitOrBundle && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] font-bold px-1.5 py-0 h-4"
                                >
                                  📦 Kit / Lote
                                </Badge>
                              )}
                              {ad.isFamilyMatch && (
                                <Badge
                                  variant="outline"
                                  className="bg-cyan-50 text-cyan-800 border-cyan-300 text-[9px] font-bold px-1.5 py-0 h-4"
                                  title={
                                    ad.matchedFamilyName
                                      ? `Compatível com a família ${ad.matchedFamilyName}`
                                      : 'Casamento por família compatível'
                                  }
                                >
                                  ⚡ Casamento por Família
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-mono flex-wrap pt-0.5">
                              <span>
                                Vendedor: <strong>{ad.sellerNickname}</strong>
                              </span>
                              <span>·</span>
                              <span>ID: {ad.id}</span>
                              <span>·</span>
                              <span
                                className={
                                  ad.listingTypeLabel === 'Premium'
                                    ? 'text-emerald-700 font-semibold'
                                    : 'text-slate-600'
                                }
                              >
                                Tipo: {ad.listingTypeLabel}
                              </span>
                              <span>·</span>
                              <span>Estoque: {ad.stock} un.</span>
                              {ad.soldQuantity != null && (
                                <>
                                  <span>·</span>
                                  <span className="text-emerald-700 font-bold">
                                    Vendas: {formatMLSoldQuantity(ad.soldQuantity)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-black font-mono text-slate-900">
                            {ad.price.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>

                          {ad.permalink && (
                            <a
                              href={ad.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600"
                              title="Abrir no Mercado Livre"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* GAVETA SECUNDÁRIA: DISPUTA POR SELLERS & TERMÔMETRO DE GIRO */}
          <Card className="border-slate-200 shadow-xs bg-white">
            <CardHeader
              className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 cursor-pointer select-none"
              onClick={() => setShowSellersDrawer(!showSellersDrawer)}
            >
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Disputa por Vendedor & Termômetro de Vendas ({summary.sellersRanked.length}{' '}
                  vendedores ranqueados)
                  <Badge variant="outline" className="text-[10px] text-slate-600 ml-1">
                    Seção Secundária
                  </Badge>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualização detalhada por loja concorrente: ranqueamento de força (0-100), Buy
                  Box e estoque por seller.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 hidden sm:flex">
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                    🔥 Giro Alto (65–100)
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold">
                    🌡️ Médio (35–64)
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                    ❄️ Baixo (0–34)
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-600 gap-1">
                  {showSellersDrawer ? 'Recolher Sellers' : 'Expandir Sellers'}
                  {showSellersDrawer ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {showSellersDrawer && (
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {summary.sellersRanked.map((seller, sIdx) => {
                    const isTopSeller = sIdx === 0
                    const isOwn = seller.isOwnAccount
                    const hasSales = seller.hasRealSalesData && seller.totalConfirmedSales > 0

                    return (
                      <div
                        key={seller.sellerId || sIdx}
                        className={`p-4 transition-colors hover:bg-slate-50/70 ${
                          isOwn ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                          {/* Identificação do Seller + Badges */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Posição no ranking */}
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5 ${
                                sIdx === 0
                                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                                  : sIdx === 1
                                    ? 'bg-slate-300 text-slate-800'
                                    : sIdx === 2
                                      ? 'bg-amber-700 text-white'
                                      : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              #{sIdx + 1}
                            </div>

                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                                  <Store className="w-3.5 h-3.5 text-slate-400" />
                                  {seller.sellerNickname}
                                </h4>

                                {isOwn && (
                                  <Badge className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0 h-4">
                                    🏅 Sua Conta
                                  </Badge>
                                )}

                                {seller.hasBuyBox && (
                                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-bold gap-1 px-1.5 py-0 h-4">
                                    <Trophy className="w-2.5 h-2.5 text-amber-600" />
                                    Detém Buy Box
                                  </Badge>
                                )}

                                <Badge
                                  variant="outline"
                                  className="text-[9px] text-slate-600 bg-slate-50 border-slate-200"
                                >
                                  {seller.totalAdsCount} anúncio(s) do produto
                                </Badge>

                                {seller.premiumListingsCount > 0 && (
                                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[9px] font-semibold px-1.5 py-0 h-4">
                                    Premium (S/ Juros)
                                  </Badge>
                                )}
                              </div>

                              {/* Detalhes de Preço e Estoque */}
                              <div className="flex items-center gap-3 text-xs text-slate-600 font-mono flex-wrap pt-0.5">
                                <span>
                                  Faixa:{' '}
                                  <strong>
                                    {seller.minPrice.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </strong>
                                  {seller.maxPrice > seller.minPrice
                                    ? ` a ${seller.maxPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                                    : ''}
                                </span>
                                <span>·</span>
                                <span>
                                  Estoque somado: <strong>{seller.totalAvailableStock} un.</strong>
                                </span>
                                <span>·</span>
                                <span>
                                  Vendas auditadas:{' '}
                                  {hasSales ? (
                                    <strong className="text-emerald-700 font-bold">
                                      {seller.totalConfirmedSales} un.
                                    </strong>
                                  ) : (
                                    <span className="text-slate-400">Não informado pelo ML</span>
                                  )}
                                </span>
                              </div>

                              {/* Motivos que compõem o termômetro */}
                              <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                                {seller.thermometerReasons.map((reason, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200"
                                  >
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Termômetro Visual e Ações */}
                          <div className="flex items-center justify-between lg:justify-end gap-4 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                            {/* Termômetro Score */}
                            <div className="text-right min-w-[140px]">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-[10px] font-bold uppercase text-slate-400">
                                  Termômetro de Vendas
                                </span>
                                {seller.thermometerTier === 'high' ? (
                                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-0.5">
                                    <Flame className="w-3.5 h-3.5 text-emerald-600" /> Giro Alto
                                  </span>
                                ) : seller.thermometerTier === 'medium' ? (
                                  <span className="text-xs font-bold text-amber-700 flex items-center gap-0.5">
                                    🌡️ Médio
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-blue-700 flex items-center gap-0.5">
                                    ❄️ Baixo
                                  </span>
                                )}
                              </div>

                              <div className="flex items-baseline justify-end gap-1 mt-0.5">
                                <span className="text-2xl font-black font-mono text-slate-900">
                                  {seller.thermometerScore}
                                </span>
                                <span className="text-xs font-semibold text-slate-400 font-mono">
                                  / 100
                                </span>
                              </div>

                              {/* Mini Barra do Termômetro */}
                              <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200 ml-auto mt-1">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    seller.thermometerTier === 'high'
                                      ? 'bg-emerald-600'
                                      : seller.thermometerTier === 'medium'
                                        ? 'bg-amber-500'
                                        : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.max(5, seller.thermometerScore)}%` }}
                                />
                              </div>
                            </div>

                            {/* Botão Ver Anúncios do Seller */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSellerDetail(
                                  selectedSellerDetail?.sellerId === seller.sellerId
                                    ? null
                                    : seller,
                                )
                              }}
                              className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-50 gap-1 shrink-0"
                            >
                              {selectedSellerDetail?.sellerId === seller.sellerId
                                ? 'Recolher'
                                : 'Ver Anúncios'}
                              {selectedSellerDetail?.sellerId === seller.sellerId ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Gaveta de Anúncios deste Seller */}
                        {selectedSellerDetail?.sellerId === seller.sellerId && (
                          <div className="mt-4 pt-4 border-t border-slate-200 bg-slate-50/80 rounded-lg p-3 space-y-2">
                            <span className="text-xs font-bold text-slate-800 block">
                              Anúncios do vendedor para este produto ({seller.ads.length}):
                            </span>
                            <div className="space-y-2">
                              {seller.ads.map((ad, aIdx) => (
                                <div
                                  key={ad.id || aIdx}
                                  className="bg-white p-3 rounded-md border border-slate-200 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {ad.thumbnail ? (
                                      <img
                                        src={ad.thumbnail}
                                        alt={ad.title}
                                        className="w-10 h-10 object-cover rounded border border-slate-200 shrink-0"
                                      />
                                    ) : (
                                      <Package className="w-10 h-10 text-slate-300 shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h5
                                          className="font-bold text-slate-900 truncate"
                                          title={ad.title}
                                        >
                                          {ad.title}
                                        </h5>
                                        {ad.isKitOrBundle && (
                                          <Badge
                                            variant="outline"
                                            className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] font-bold px-1.5 py-0 h-4"
                                          >
                                            📦 Kit / Lote
                                          </Badge>
                                        )}
                                        {ad.isFamilyMatch && (
                                          <Badge
                                            variant="outline"
                                            className="bg-cyan-50 text-cyan-800 border-cyan-300 text-[9px] font-bold px-1.5 py-0 h-4"
                                            title={
                                              ad.matchedFamilyName
                                                ? `Compatível com a família ${ad.matchedFamilyName}`
                                                : 'Casamento por família compatível'
                                            }
                                          >
                                            ⚡ Casamento por Família
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono flex-wrap">
                                        <span>ID: {ad.id}</span>
                                        <span>·</span>
                                        <span>Tipo: {ad.listingTypeLabel}</span>
                                        <span>·</span>
                                        <span>Estoque: {ad.stock} un.</span>
                                        {ad.soldQuantity != null && (
                                          <>
                                            <span>·</span>
                                            <span className="text-emerald-700 font-bold">
                                              Vendas: {formatMLSoldQuantity(ad.soldQuantity)}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-sm font-black font-mono text-slate-900">
                                      {ad.price.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </span>

                                    {ad.permalink && (
                                      <a
                                        href={ad.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600"
                                        title="Abrir no Mercado Livre"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
