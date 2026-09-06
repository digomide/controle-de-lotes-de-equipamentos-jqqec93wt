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
} from 'lucide-react'
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
} from '@/services/mlExactProductService'

export function RaioXMercadoTab() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('fonte desktop dell 3020')
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
  const [filterExactOnly, setFilterExactOnly] = useState(true)

  // Sugestões de produtos exatos para pesquisa rápida
  const suggestedExactProducts = [
    'fonte desktop dell 3020',
    'dell latitude 5420 i5',
    'thinkpad t480',
    'carregador dell 65w 4.5mm',
    'bateria dell inspiron 15',
    'placa mae dell optiplex 3020',
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

  // Agregação dos dados por PRODUTO EXATO e por SELLER
  const summary: ExactProductSummary | null = useMemo(() => {
    if (!rawProducts || rawProducts.length === 0 || !activeQuery) return null
    return aggregateSellersByExactProduct(rawProducts, activeQuery, historicalSnapshots)
  }, [rawProducts, activeQuery, historicalSnapshots])

  // Salvar snapshot periódico no banco
  async function handleSaveSnapshot() {
    if (!summary || savingSnapshot) return
    setSavingSnapshot(true)
    try {
      const res = await recordAdSnapshots(summary)
      setSnapshotSaved(true)
      toast({
        title: 'Snapshot de histórico registrado!',
        description: `${res.savedCount} anúncio(s) e preços salvos para acumular histórico real de vendas e deltas nos próximos 60 dias.`,
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
                    Raio-X de Produto Exato & Termômetro de Vendas
                    <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-300 text-[10px] font-bold">
                      Filtro Rigoroso + Termômetro por Seller
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Filtra exatamente os anúncios do produto pesquisado, audita os sellers
                    concorrentes, rastreia vendas expostas e avalia giro, fluxo e margem de entrada.
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
                  <Flame className="w-3.5 h-3.5" /> 2. Termômetro de Vendas (0–100)
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Ranqueia cada seller por: <strong>🔥 Giro Alto (65–100)</strong>,{' '}
                  <strong>🌡️ Médio (35–64)</strong> e <strong>❄️ Baixo (0–34)</strong>, ponderando
                  vendas confirmadas, posse da Buy Box, volume de estoque e tipo de anúncio.
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
                  {loading ? 'Analisando Sellers...' : 'Analisar Produto Exato'}
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

      {/* Estado Vazio */}
      {!summary && !loading && (
        <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/60">
          <CardContent className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <Flame className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              Nenhuma análise de produto exato carregada
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Digite acima o produto desejado (ex.: &quot;fonte desktop dell 3020&quot;). O sistema
              fará a busca no ML, aplicará o filtro de similaridade rigorosa e montará o{' '}
              <strong>Termômetro de Vendas por Seller</strong>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* CONTEÚDO PRINCIPAL: PAINEL SÍNTESE + TERMÔMETRO POR SELLER */}
      {summary && (
        <div className="space-y-6">
          {/* 1. PAINEL SÍNTESE NO TOPO */}
          <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 shadow-xs">
            <CardHeader className="pb-3 border-b border-indigo-100/60">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-wider">
                      Síntese de Mercado
                    </Badge>
                    <span className="text-xs font-bold text-slate-900">
                      &quot;{summary.searchTerm}&quot;
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {summary.exactMatchedPositionsCount} de {summary.totalRawPositions} posições são
                    deste produto exato
                  </h3>
                  <p className="text-xs text-slate-500">
                    Filtro de precisão descartou {summary.filteredOutCount} anúncio(s) irrelevantes
                    ou de outros produtos.
                  </p>
                </div>

                {/* Botão para Gravar Snapshot Periódico */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveSnapshot}
                    disabled={savingSnapshot || snapshotSaved}
                    className="text-xs h-9 bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
                    title="Gravar foto atual de estoque, preço e vendas para histórico de 60 dias"
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

            <CardContent className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* Sellers Únicos */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <Users className="w-3 h-3 text-indigo-500" /> Vendedores Ativos
                  </span>
                  <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                    {summary.uniqueSellersCount}
                  </span>
                  <span className="text-[10px] text-slate-500">Disputando este produto</span>
                </div>

                {/* Estoque Total Visível */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <Package className="w-3 h-3 text-blue-500" /> Estoque Visível
                  </span>
                  <span className="text-2xl font-black text-blue-700 font-mono mt-0.5 block">
                    {summary.totalVisibleStock} un.
                  </span>
                  <span className="text-[10px] text-slate-500">Somado entre os sellers</span>
                </div>

                {/* Faixa de Preço */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-500" /> Faixa de Preço
                  </span>
                  <span className="text-lg font-black text-emerald-700 font-mono mt-1 block">
                    {summary.priceMin.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Até{' '}
                    {summary.priceMax.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}{' '}
                    (méd.{' '}
                    {summary.priceAvg.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                    )
                  </span>
                </div>

                {/* Vendas Confirmadas */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block flex items-center gap-1">
                    <Activity className="w-3 h-3 text-amber-500" /> Vendas Confirmadas
                  </span>
                  <span className="text-xl font-black text-slate-900 font-mono mt-1 block">
                    {summary.hasAnyConfirmedSales
                      ? `${summary.totalConfirmedSalesAcrossSellers} un.`
                      : 'Não exposto'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {summary.hasAnyConfirmedSales
                      ? 'Dados reais auditados'
                      : 'ML restringe 403 p/ terceiros'}
                  </span>
                </div>

                {/* Melhor Entrada para Margem */}
                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 col-span-2 sm:col-span-4 lg:col-span-1">
                  <span className="text-[10px] font-bold uppercase text-amber-900 block flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-600" /> Oportunidade Margem
                  </span>
                  {summary.bestOpportunityMargin ? (
                    <div className="mt-0.5 space-y-0.5">
                      <span className="text-sm font-black text-amber-950 font-mono block">
                        {summary.bestOpportunityMargin.price.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                      <p className="text-[10px] text-amber-900 leading-snug">
                        {summary.bestOpportunityMargin.marginDiffPercent > 0
                          ? `${summary.bestOpportunityMargin.marginDiffPercent}% menor que o líder (${summary.bestOpportunityMargin.leaderPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
                          : 'Pouca concorrência ativa'}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 mt-1 block">Sob consulta</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. TABELA DO TERMÔMETRO DE VENDAS POR SELLER */}
          <Card className="border-slate-200 shadow-xs bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Termômetro de Vendas por Seller ({summary.sellersRanked.length} vendedores
                  ranqueados)
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Classificação baseada em vendas reais (quando expostas), Buy Box conquistada,
                  estoque disponível e tipo de anúncio.
                </p>
              </div>

              {/* Legenda do Termômetro */}
              <div className="flex items-center gap-2 flex-wrap">
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
            </CardHeader>

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
                                selectedSellerDetail?.sellerId === seller.sellerId ? null : seller,
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
                                    <h5
                                      className="font-bold text-slate-900 truncate"
                                      title={ad.title}
                                    >
                                      {ad.title}
                                    </h5>
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
          </Card>
        </div>
      )}
    </div>
  )
}
