import React, { useState, useMemo } from 'react'
import {
  TrendingUp,
  Search,
  Sparkles,
  BarChart3,
  ShieldCheck,
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  mlCatalogService,
  formatMLSoldQuantity,
  normalizeRefurbishedGrade,
  type MLCatalogProduct,
  type MLCatalogSearchJob,
} from '@/services/mlCatalogService'

interface FamilyAnalysisResult {
  query: string
  totalItems: number
  totalStock: number
  itemsWithStock: number
  priceMin: number
  priceMedian: number
  priceMax: number
  priceAvg: number
  // Condições
  countNew: number
  countRefurbished: number
  countUsed: number
  countOpenBox: number
  countRefurbExcelente: number
  countRefurbBom: number
  countRefurbAceitavel: number
  pctRefurbished: number
  // Concorrência e Buy Box
  itemsWithWinner: number
  itemsWithCompetition: number
  itemsSingleSeller: number
  itemsHighDispute: number // 3+ concorrentes
  totalCompetitorsTracked: number
  // Vendas
  knownSalesSum: number
  itemsWithReportedSales: number
  // Itens da própria conta minerados
  ownAccountCount: number
  // Índice de Força (0 a 100)
  forceIndex: number
  forceTier: 'Alta Força' | 'Média Força' | 'Baixa Força' | 'Oportunidade de Entrada'
  forceComponents: {
    densityScore: number // Densidade de anúncios / demanda (0-25)
    refurbScore: number // Presença e viabilidade do recondicionado (0-25)
    dispersionScore: number // Liquidez e consistência de preços (0-25)
    competitionScore: number // Oportunidade de Buy Box / disputa (0-25)
  }
  // Ranking dos mais fortes
  topRanked: Array<{
    catalogProduct: MLCatalogProduct
    rankScore: number
    rankReasons: string[]
    conditionLabel: string
    effectivePrice: number
    effectiveStock: number
    hasBuyBox: boolean
    competitorCount: number
    isOwn: boolean
    soldQuantity: number | null
  }>
}

export function RaioXMercadoTab() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('dell latitude')
  const [activeQuery, setActiveQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressText, setSearchProgressText] = useState('')
  const [stoppingJob, setStoppingJob] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [rawProducts, setRawProducts] = useState<MLCatalogProduct[]>([])
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  // Sugestões rápidas de famílias
  const suggestedFamilies = [
    'dell latitude',
    'thinkpad t480',
    'hp elitebook',
    'dell optiplex',
    'macbook air',
    'fonte dell 3020',
  ]

  // Interromper busca
  async function handleStop() {
    if (!currentJobId || stoppingJob) return
    setStoppingJob(true)
    try {
      await mlCatalogService.stopSearchJob(currentJobId)
      toast({
        title: 'Parando varredura...',
        description: 'Compilando os dados já minerados da família.',
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
        title: 'Informe uma família ou termo',
        description: 'Ex.: "dell latitude", "thinkpad t480", "notebook hp"',
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
    setSearchProgressText(
      forceRefresh
        ? 'Varrendo posições em tempo real (sem cache)...'
        : 'Iniciando varredura de mercado para ' + q + '...',
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
          title: 'Nenhum item encontrado para esta família',
          description: 'Tente outro termo ou amplie a busca.',
        })
      } else {
        toast({
          title: `Raio-X concluído: ${results.length} posições mapeadas`,
          description: `Análise compilada com dados reais do Mercado Livre para "${q}".`,
        })
      }
    } catch (err: any) {
      console.error('Erro no Raio-X:', err)
      toast({
        title: 'Falha na varredura da família',
        description: err?.message || 'Não foi possível carregar os dados do Mercado Livre.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setCurrentJobId(null)
    }
  }

  // Análise Estatística Agregada dos dados REAIS
  const analysis: FamilyAnalysisResult | null = useMemo(() => {
    if (!rawProducts || rawProducts.length === 0) return null

    const totalItems = rawProducts.length
    let totalStock = 0
    let itemsWithStock = 0
    const prices: number[] = []

    let countNew = 0
    let countRefurbished = 0
    let countUsed = 0
    let countOpenBox = 0
    let countRefurbExcelente = 0
    let countRefurbBom = 0
    let countRefurbAceitavel = 0

    let itemsWithWinner = 0
    let itemsWithCompetition = 0
    let itemsSingleSeller = 0
    let itemsHighDispute = 0
    let totalCompetitorsTracked = 0

    let knownSalesSum = 0
    let itemsWithReportedSales = 0
    let ownAccountCount = 0

    rawProducts.forEach((p) => {
      // Condição
      const c = (p.condition || 'new').toLowerCase()
      if (c === 'refurbished') {
        countRefurbished++
        const g = normalizeRefurbishedGrade(p.condition_grade) || 'Excelente'
        if (g === 'Excelente') countRefurbExcelente++
        else if (g === 'Bom') countRefurbBom++
        else if (g === 'Aceitável') countRefurbAceitavel++
      } else if (c === 'used') {
        countUsed++
      } else if (c === 'open_box') {
        countOpenBox++
      } else {
        countNew++
      }

      // Preço de referência da posição
      const pPrice = p.buy_box_winner_price || p.min_price || null
      if (pPrice && pPrice > 0) {
        prices.push(pPrice)
      }

      // Estoque visível
      const stock = p.buy_box_winner_stock ?? 0
      if (stock > 0) {
        totalStock += stock
        itemsWithStock++
      }

      // Concorrência e Buy Box
      if (p.buy_box_winner_price || p.buy_box_winner_seller_nickname) {
        itemsWithWinner++
      }

      const compCount = p.competitors_count ?? (p.competitors ? p.competitors.length : 0)
      if (compCount > 0) {
        totalCompetitorsTracked += compCount
        if (compCount === 1) itemsSingleSeller++
        else if (compCount >= 3) itemsHighDispute++
        itemsWithCompetition++
      }

      // Vendas informadas (quando existirem de contas próprias ou fontes que entreguem)
      if (p.sold_quantity != null && !isNaN(p.sold_quantity) && p.sold_quantity > 0) {
        knownSalesSum += p.sold_quantity
        itemsWithReportedSales++
      }

      // Própria conta
      if (p.is_own_account) {
        ownAccountCount++
      }
    })

    // Estatísticas de preço
    prices.sort((a, b) => a - b)
    const priceMin = prices.length > 0 ? prices[0] : 0
    const priceMax = prices.length > 0 ? prices[prices.length - 1] : 0
    const priceAvg = prices.length > 0 ? prices.reduce((acc, v) => acc + v, 0) / prices.length : 0
    const priceMedian =
      prices.length > 0
        ? prices.length % 2 === 0
          ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
          : prices[Math.floor(prices.length / 2)]
        : 0

    const pctRefurbished = totalItems > 0 ? Math.round((countRefurbished / totalItems) * 100) : 0

    // CÁLCULO DO ÍNDICE DE FORÇA DA FAMÍLIA (0 a 100)
    // 1. Densidade (0-25): volume de posições ativas no ML (ampla variedade = família demandada)
    const densityScore = Math.min(25, Math.round((totalItems / 40) * 25))

    // 2. Presença do Recondicionado (0-25): mercado aberto para nosso modelo de negócio
    // Se a família já tem posições refurb ativas, é um sinal de extrema força para o nosso nicho
    const refurbScore = Math.min(
      25,
      countRefurbished > 0
        ? Math.round(15 + Math.min(10, countRefurbished * 2))
        : countUsed > 0
          ? 10
          : 5,
    )

    // 3. Dispersão de Preço / Liquidez (0-25): faixa de preços saudável (preço mediano entre R$ 800 e R$ 4.000)
    let dispersionScore = 15
    if (priceMedian >= 1000 && priceMedian <= 4500) dispersionScore = 25
    else if (priceMedian > 500 && priceMedian < 6000) dispersionScore = 20
    else if (priceMedian > 0) dispersionScore = 12

    // 4. Oportunidade de Concorrência (0-25): Buy Box disputada vs. posições sem vencedor/líder
    // Alta proporção de posições com Buy Box ativa = mercado vivo; presença de posições com 1 só concorrente = oportunidade de entrar ganhando
    const winnerRatio = totalItems > 0 ? itemsWithWinner / totalItems : 0
    const singleRatio = totalItems > 0 ? itemsSingleSeller / totalItems : 0
    const competitionScore = Math.min(
      25,
      Math.round(winnerRatio * 15 + Math.min(10, singleRatio * 20)),
    )

    const forceIndex = Math.min(
      100,
      densityScore + refurbScore + dispersionScore + competitionScore,
    )

    let forceTier: FamilyAnalysisResult['forceTier'] = 'Média Força'
    if (forceIndex >= 75) forceTier = 'Alta Força'
    else if (forceIndex >= 50) forceTier = 'Média Força'
    else if (itemsSingleSeller >= 3 || countRefurbished === 0) forceTier = 'Oportunidade de Entrada'
    else forceTier = 'Baixa Força'

    // RANKING DOS ITENS MAIS FORTES DA FAMÍLIA
    // Cada anúncio pontuado por visibilidade (posição ordinal da busca do ML), Buy Box conquistada, estoque e preço
    const rankedList = rawProducts.map((p, index) => {
      let rankScore = 0
      const rankReasons: string[] = []

      // 1. Ordem da busca do Mercado Livre (o próprio algoritmo de relevância do ML prioriza os mais visitados/vendidos)
      const mlbRelevancePoints = Math.max(0, 40 - Math.min(40, Math.floor(index * 1.5)))
      rankScore += mlbRelevancePoints
      if (index < 5) {
        rankReasons.push(`Top ${index + 1} em relevância no ML`)
      }

      // 2. Vencedor de Buy Box conquistado
      if (p.buy_box_winner_seller_nickname) {
        rankScore += 25
        rankReasons.push(`Líder de Buy Box (${p.buy_box_winner_seller_nickname})`)
      }

      // 3. Estoque visível
      const stock = p.buy_box_winner_stock ?? 0
      if (stock >= 10) {
        rankScore += 15
        rankReasons.push(`Estoque forte (${stock} un.)`)
      } else if (stock > 0) {
        rankScore += 8
      }

      // 4. Condição recondicionada / compatível
      const c = (p.condition || '').toLowerCase()
      if (c === 'refurbished') {
        rankScore += 10
        rankReasons.push('Posição oficial Recondicionado')
      }

      // 5. Vendas confirmadas quando existirem
      if (p.sold_quantity != null && p.sold_quantity > 0) {
        rankScore += Math.min(20, Math.floor(p.sold_quantity / 5))
        rankReasons.push(`Vendas confirmadas (${p.sold_quantity})`)
      }

      // 6. Preço competitivo (acima de zero)
      const effPrice = p.buy_box_winner_price || p.min_price || 0
      if (effPrice >= 800) {
        rankScore += 5
      }

      const condMeta =
        c === 'refurbished'
          ? `Recondicionado (${p.condition_grade || 'Excelente'})`
          : c === 'used'
            ? 'Usado'
            : c === 'open_box'
              ? 'Caixa aberta'
              : 'Novo'

      return {
        catalogProduct: p,
        rankScore,
        rankReasons,
        conditionLabel: condMeta,
        effectivePrice: effPrice,
        effectiveStock: stock,
        hasBuyBox: Boolean(p.buy_box_winner_seller_nickname),
        competitorCount: p.competitors_count ?? (p.competitors?.length || 0),
        isOwn: Boolean(p.is_own_account),
        soldQuantity: p.sold_quantity ?? null,
      }
    })

    rankedList.sort((a, b) => b.rankScore - a.rankScore)

    return {
      query: activeQuery,
      totalItems,
      totalStock,
      itemsWithStock,
      priceMin,
      priceMedian,
      priceMax,
      priceAvg,
      countNew,
      countRefurbished,
      countUsed,
      countOpenBox,
      countRefurbExcelente,
      countRefurbBom,
      countRefurbAceitavel,
      pctRefurbished,
      itemsWithWinner,
      itemsWithCompetition,
      itemsSingleSeller,
      itemsHighDispute,
      totalCompetitorsTracked,
      knownSalesSum,
      itemsWithReportedSales,
      ownAccountCount,
      forceIndex,
      forceTier,
      forceComponents: {
        densityScore,
        refurbScore,
        dispersionScore,
        competitionScore,
      },
      topRanked: rankedList.slice(0, 15),
    }
  }, [rawProducts, activeQuery])

  return (
    <div className="space-y-6">
      {/* Banner Superior */}
      <Card className="border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    Raio-X de Força do Produto
                    <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-300 text-[10px] font-bold">
                      Fase A · Dados Reais
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Descubra o comportamento de mercado, densidade de anúncios, viabilidade de
                    recondicionado e quem são os campeões de visibilidade da família.
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
                Como é calculado?
                {showHowItWorks ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Explicação Expansível dos Critérios Honestos */}
          {showHowItWorks && (
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-amber-300 block mb-1 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> 1. Sem Inventar Números
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  O Mercado Livre bloqueia o acesso a vendas históricas de terceiros via API pública
                  (403). Exibimos vendas reais da sua conta e de qualquer fonte pública entregue;
                  quando não informado, exibimos com clareza &quot;Vendas não informadas&quot;.
                </p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-indigo-300 block mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> 2. Índice de Força (0–100)
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Combina 4 pilares auditáveis: <strong>Densidade</strong> (oferta ativa),{' '}
                  <strong>Recondicionado</strong> (espaço para nosso nicho), <strong>Preço</strong>{' '}
                  (mediana e liquidez) e <strong>Buy Box</strong> (disputa de concorrência).
                </p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-emerald-300 block mb-1 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" /> 3. Campeões de Visibilidade
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Rankeia as posições mais proeminentes da família pelo algoritmo de busca oficial
                  do ML, líderes que detêm a Buy Box, disponibilidade de estoque e compatibilidade.
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
                  placeholder="Digite uma família, modelo ou categoria (ex: dell latitude, thinkpad t480, fonte dell)..."
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
                  {loading ? 'Analisando Mercado...' : 'Calcular Raio-X'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runAnalysis(searchTerm, true)}
                  disabled={loading}
                  className="h-10 px-3 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
                  title="Forçar atualização ignorando o cache de 15 minutos"
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

            {/* Chips de famílias sugeridas para clique rápido */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Famílias sugeridas:
              </span>
              {suggestedFamilies.map((fam) => (
                <button
                  key={fam}
                  type="button"
                  onClick={() => {
                    setSearchTerm(fam)
                    runAnalysis(fam, false)
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition-colors"
                >
                  {fam}
                </button>
              ))}
            </div>

            {/* Status da busca ao vivo / cache */}
            {loading && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex items-center gap-3 text-xs text-indigo-900 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                <span className="font-medium">
                  {progressText || 'Consultando Mercado Livre...'}
                </span>
              </div>
            )}

            {!loading && isCached && cachedAt && (
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                <Badge variant="outline" className="bg-slate-50 text-slate-600 text-[10px] h-4">
                  Cache Inteligente (15 min)
                </Badge>
                <span>Dados preservados da busca realizada às {cachedAt.substring(11, 16)}.</span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Estado Vazio */}
      {!analysis && !loading && (
        <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/60">
          <CardContent className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              Nenhuma análise de mercado carregada
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Digite uma família de produtos acima (como &quot;dell latitude&quot; ou
              &quot;thinkpad&quot;) para mapear a força do produto, volume de recondicionados,
              preços praticados e quem são os campeões de visibilidade.
            </p>
          </CardContent>
        </Card>
      )}

      {/* PAINEL AGREGADO DE MERCADO COM DADOS REAIS */}
      {analysis && (
        <div className="space-y-6">
          {/* Card Principal: Termômetro do Índice de Força + KPIs Principais */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Termômetro Índice 0 a 100 */}
            <Card className="border-slate-200 shadow-xs bg-white lg:col-span-1 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                    Índice de Força da Família
                  </span>
                  <Badge
                    className={`text-xs font-bold ${
                      analysis.forceIndex >= 75
                        ? 'bg-emerald-600 text-white'
                        : analysis.forceIndex >= 50
                          ? 'bg-blue-600 text-white'
                          : 'bg-amber-500 text-white'
                    }`}
                  >
                    {analysis.forceTier}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-slate-900 tracking-tight font-mono">
                    {analysis.forceIndex}
                  </span>
                  <span className="text-sm font-semibold text-slate-400 font-mono">/ 100</span>
                </div>

                {/* Barra de Progresso visual */}
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      analysis.forceIndex >= 75
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                        : analysis.forceIndex >= 50
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                          : 'bg-gradient-to-r from-amber-400 to-orange-500'
                    }`}
                    style={{ width: `${Math.max(5, analysis.forceIndex)}%` }}
                  />
                </div>

                {/* 4 Componentes que compõem o índice */}
                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-500" />
                      Densidade / Oferta Ativa:
                    </span>
                    <strong className="font-mono text-slate-800">
                      {analysis.forceComponents.densityScore}/25
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      Espaço Recondicionado:
                    </span>
                    <strong className="font-mono text-slate-800">
                      {analysis.forceComponents.refurbScore}/25
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-emerald-500" />
                      Faixa / Consistência de Preço:
                    </span>
                    <strong className="font-mono text-slate-800">
                      {analysis.forceComponents.dispersionScore}/25
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      Disputa Buy Box & Concorrência:
                    </span>
                    <strong className="font-mono text-slate-800">
                      {analysis.forceComponents.competitionScore}/25
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Grid com os 6 KPIs principais agregados */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Total de Posições */}
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                    Posições no ML
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      {analysis.totalItems}
                    </span>
                    {analysis.ownAccountCount > 0 && (
                      <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px] font-mono">
                        {analysis.ownAccountCount} sua conta
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Posições ativas mapeadas para &quot;{analysis.query}&quot;
                  </p>
                </CardContent>
              </Card>

              {/* Presença do Recondicionado */}
              <Card className="border-purple-200 bg-purple-50/40 shadow-xs">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-purple-700 font-bold block flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-600" /> Recondicionado
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-purple-900 font-mono">
                      {analysis.countRefurbished}
                    </span>
                    <Badge className="bg-purple-600 text-white text-[10px] font-mono">
                      {analysis.pctRefurbished}%
                    </Badge>
                  </div>
                  <p className="text-[11px] text-purple-800">
                    {analysis.countRefurbished > 0
                      ? 'Nicho altamente viável nesta família'
                      : 'Oportunidade para pioneirismo'}
                  </p>
                </CardContent>
              </Card>

              {/* Preço Mediano da Família */}
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                    Preço Mediano
                  </span>
                  <span className="text-2xl font-black text-emerald-700 font-mono block">
                    {analysis.priceMedian.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Faixa: R$ {Math.round(analysis.priceMin)} a R$ {Math.round(analysis.priceMax)}
                  </p>
                </CardContent>
              </Card>

              {/* Estoque Total Visível */}
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block flex items-center gap-1">
                    <Package className="w-3 h-3 text-blue-600" /> Estoque Visível
                  </span>
                  <span className="text-2xl font-black text-blue-700 font-mono block">
                    {analysis.totalStock} un.
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Em {analysis.itemsWithStock} posições com estoque declarado
                  </p>
                </CardContent>
              </Card>

              {/* Buy Box Disputada */}
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-500" /> Buy Box com Líder
                  </span>
                  <span className="text-2xl font-black text-slate-800 font-mono block">
                    {analysis.itemsWithWinner} pos.
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {analysis.itemsHighDispute} em briga intensa (3+ conc.)
                  </p>
                </CardContent>
              </Card>

              {/* Posições sem concorrência (Entrada Fácil) */}
              <Card className="border-emerald-200 bg-emerald-50/40 shadow-xs">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold block flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Concorrência Leve
                  </span>
                  <span className="text-2xl font-black text-emerald-800 font-mono block">
                    {analysis.itemsSingleSeller} pos.
                  </span>
                  <p className="text-[11px] text-emerald-700">
                    Apenas 1 vendedor — fácil de bater preço
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Seção 2: Distribuição por Condição & Graus do Recondicionado */}
          <Card className="border-slate-200 shadow-xs bg-white">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Distribuição de Condições na Família & Força do Recondicionado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                    Novo Lacrado
                  </span>
                  <span className="text-xl font-black text-emerald-900 font-mono mt-0.5 block">
                    {analysis.countNew}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {Math.round((analysis.countNew / analysis.totalItems) * 100)}% das posições
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-purple-300 bg-purple-50">
                  <span className="text-[10px] font-bold uppercase text-purple-900 block flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-600" /> Recondicionado
                  </span>
                  <span className="text-xl font-black text-purple-950 font-mono mt-0.5 block">
                    {analysis.countRefurbished}
                  </span>
                  <span className="text-[10px] text-purple-800 font-medium">
                    {analysis.pctRefurbished}% das posições
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">
                    Usado Comum
                  </span>
                  <span className="text-xl font-black text-amber-900 font-mono mt-0.5 block">
                    {analysis.countUsed}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {Math.round((analysis.countUsed / analysis.totalItems) * 100)}% das posições
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                  <span className="text-[10px] font-bold uppercase text-blue-800 block">
                    Caixa Aberta (Open Box)
                  </span>
                  <span className="text-xl font-black text-blue-900 font-mono mt-0.5 block">
                    {analysis.countOpenBox}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {Math.round((analysis.countOpenBox / analysis.totalItems) * 100)}% das posições
                  </span>
                </div>
              </div>

              {/* Sub-detalhamento dos Graus do Recondicionado */}
              {analysis.countRefurbished > 0 && (
                <div className="p-3.5 rounded-lg bg-slate-50 border border-purple-100 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-900 text-white text-[10px]">
                      Graus Oficiais ML
                    </Badge>
                    <span className="text-xs text-slate-700">
                      Dispersão entre os 3 graus de recondicionado catalogados:
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-900 text-white text-[10px] font-mono">
                      Excelente: {analysis.countRefurbExcelente}
                    </Badge>
                    <Badge className="bg-purple-600 text-white text-[10px] font-mono">
                      Bom: {analysis.countRefurbBom}
                    </Badge>
                    <Badge className="bg-purple-300 text-purple-950 border-purple-400 text-[10px] font-mono font-bold">
                      Aceitável: {analysis.countRefurbAceitavel}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seção 3: Ranking dos Itens Mais Fortes da Família (Campeões de Visibilidade) */}
          <Card className="border-slate-200 shadow-xs bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Campeões de Visibilidade da Família (Top {analysis.topRanked.length})
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pontuados pelo algoritmo do ML, posse de Buy Box, estoque ativo e compatibilidade.
                </p>
              </div>

              {/* Informação sobre vendas públicas */}
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-sans">
                  Total de vendas confirmadas:
                </span>
                <span className="text-xs font-bold text-slate-700 font-mono">
                  {analysis.knownSalesSum > 0
                    ? `${analysis.knownSalesSum} un. (em ${analysis.itemsWithReportedSales} anúncio(s))`
                    : 'Vendas não informadas (403 ML terceiros)'}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-0 divide-y divide-slate-100">
              {analysis.topRanked.map((ranked, idx) => {
                const prod = ranked.catalogProduct
                const isWinner = ranked.hasBuyBox
                const isOwn = ranked.isOwn

                return (
                  <div
                    key={prod.id || prod.catalog_product_id || idx}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    {/* Medalha / Posição + Thumbnail + Título */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs font-mono shrink-0 mt-1">
                        #{idx + 1}
                      </div>

                      <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                        {prod.thumbnail ? (
                          <img
                            src={prod.thumbnail}
                            alt={prod.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src =
                                'https://img.usecurling.com/p/100/100?q=laptop'
                            }}
                          />
                        ) : (
                          <Package className="w-6 h-6 text-slate-300" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isOwn && (
                            <Badge className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0 h-4">
                              🏅 Sua Posição
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold bg-slate-50 border-slate-200 text-slate-700"
                          >
                            {ranked.conditionLabel}
                          </Badge>
                          {isWinner && (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold gap-1">
                              <Trophy className="w-3 h-3 text-amber-600" />
                              Líder: {prod.buy_box_winner_seller_nickname}
                            </Badge>
                          )}
                          {/* Sold Badge honesto */}
                          {ranked.soldQuantity != null ? (
                            <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-semibold">
                              🛒 {formatMLSoldQuantity(ranked.soldQuantity)}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-slate-400 bg-slate-50 border-slate-200 text-[9px]"
                            >
                              Vendas não informadas
                            </Badge>
                          )}
                        </div>

                        <h4
                          className="text-xs font-bold text-slate-900 line-clamp-1 hover:line-clamp-none leading-snug"
                          title={prod.title}
                        >
                          {prod.title}
                        </h4>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono flex-wrap">
                          <span>ID: {prod.catalog_product_id || prod.id}</span>
                          <span>·</span>
                          <span>
                            Concorrentes:{' '}
                            <strong className="text-slate-700">{ranked.competitorCount}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Estoque visível:{' '}
                            <strong className="text-slate-700">{ranked.effectiveStock} un.</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pontuação & Preço & Ações */}
                    <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                          Preço Líder
                        </span>
                        <span className="text-base font-black text-slate-900 font-mono block">
                          {ranked.effectivePrice > 0
                            ? ranked.effectivePrice.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })
                            : 'Sob consulta'}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold">
                          Score: {ranked.rankScore} pts
                        </span>
                      </div>

                      {prod.permalink ? (
                        <a
                          href={prod.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
                          title="Abrir no Mercado Livre"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
