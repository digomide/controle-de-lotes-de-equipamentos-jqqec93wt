import React, { useState, useMemo } from 'react'
import {
  Package,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Sparkles,
  Link as LinkIcon,
  Unlink,
  Info,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  evaluateExactProductMatch,
  detectSearchMode,
  detectCollectorNoiseAd,
  type ExactProductSearchMode,
} from '@/lib/catalogFilter'
import { formatMLSoldQuantity, type MLCatalogProduct } from '@/services/mlCatalogService'
import {
  positionOverridesService,
  type PositionOverrideAction,
} from '@/services/positionOverridesService'

interface RawPositionsDrawerProps {
  searchTerm: string
  rawProducts: MLCatalogProduct[]
  activeBrain?: ExactProductSearchMode | null
  overrides: Record<string, PositionOverrideAction>
  onOverrideChange: (updated: Record<string, PositionOverrideAction>) => void
}

export function RawPositionsDrawer({
  searchTerm,
  rawProducts,
  activeBrain,
  overrides,
  onOverrideChange,
}: RawPositionsDrawerProps) {
  const { toast } = useToast()
  const [filterText, setFilterText] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'linked_auto' | 'linked_manual' | 'rejected_manual' | 'rejected_auto'
  >('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Auditoria de vendas ao vivo server-side
  const [auditingSales, setAuditingSales] = useState(false)
  const [salesAuditLog, setSalesAuditLog] = useState<{
    testedCount: number
    wafCount: number
    successCount: number
    explanation?: string
  } | null>(null)
  const [probedSalesMap, setProbedSalesMap] = useState<Record<string, number | null>>({})

  const cleanQuery = (searchTerm || '').trim()
  const effectiveBrain = activeBrain || detectSearchMode(cleanQuery)

  // Avalia cada anúncio bruto contra o filtro taxonômico e verifica overrides
  const evaluatedRows = useMemo(() => {
    return rawProducts.map((prod, index) => {
      const prodId = prod.id || prod.catalog_product_id || `pos_${index}`
      const scoreResult = evaluateExactProductMatch(
        prod.title || '',
        cleanQuery,
        prod.attributes,
        effectiveBrain,
        prod.brand_value,
        prod.model_value,
      )

      const override = overrides[prodId]
      const noise = detectCollectorNoiseAd(prod.title || '', cleanQuery)

      let statusKind: 'linked_auto' | 'linked_manual' | 'rejected_manual' | 'rejected_auto'
      let isEffectivelyLinked = false

      if (override === 'include') {
        statusKind = 'linked_manual'
        isEffectivelyLinked = true
      } else if (override === 'exclude') {
        statusKind = 'rejected_manual'
        isEffectivelyLinked = false
      } else if (noise.isNoise) {
        statusKind = 'rejected_auto'
        isEffectivelyLinked = false
      } else if (scoreResult.isExactMatch) {
        statusKind = 'linked_auto'
        isEffectivelyLinked = true
      } else {
        statusKind = 'rejected_auto'
        isEffectivelyLinked = false
      }

      // Motivo exato da rejeição
      const rejectionReason = noise.isNoise
        ? noise.reason || 'Item irrelevante detectado (fora do escopo de informática)'
        : (scoreResult.reasons && scoreResult.reasons.length > 0
            ? scoreResult.reasons.join(' · ')
            : '') || 'Fora dos critérios taxonômicos do produto'

      return {
        product: prod,
        prodId,
        scoreResult,
        override,
        statusKind,
        isEffectivelyLinked,
        rejectionReason,
      }
    })
  }, [rawProducts, cleanQuery, effectiveBrain, overrides])

  // Contadores no topo solicitados na MISSÃO 1:
  // X vinculados pelo filtro, Y vinculados por você, Z rejeitados por você, W descartados
  const counts = useMemo(() => {
    let linkedAuto = 0
    let linkedManual = 0
    let rejectedManual = 0
    let rejectedAuto = 0

    evaluatedRows.forEach((r) => {
      if (r.statusKind === 'linked_auto') linkedAuto++
      else if (r.statusKind === 'linked_manual') linkedManual++
      else if (r.statusKind === 'rejected_manual') rejectedManual++
      else if (r.statusKind === 'rejected_auto') rejectedAuto++
    })

    return {
      linkedAuto,
      linkedManual,
      rejectedManual,
      rejectedAuto,
      total: evaluatedRows.length,
      effectiveLinkedTotal: linkedAuto + linkedManual,
    }
  }, [evaluatedRows])

  // Filtragem local por texto e por status
  const filteredRows = useMemo(() => {
    const q = filterText.toLowerCase().trim()
    return evaluatedRows.filter((row) => {
      // Filtro de status
      if (statusFilter !== 'all' && row.statusKind !== statusFilter) {
        return false
      }

      if (!q) return true

      const titleMatch = (row.product.title || '').toLowerCase().includes(q)
      const idMatch = (row.prodId || '').toLowerCase().includes(q)
      const sellerMatch =
        (row.product.buy_box_winner_seller_nickname || '').toLowerCase().includes(q) ||
        (row.product.buy_box_winner_seller_id || '').toLowerCase().includes(q)
      const brandMatch = (row.product.brand_value || '').toLowerCase().includes(q)
      const modelMatch = (row.product.model_value || '').toLowerCase().includes(q)
      const reasonMatch = row.rejectionReason.toLowerCase().includes(q)

      return titleMatch || idMatch || sellerMatch || brandMatch || modelMatch || reasonMatch
    })
  }, [evaluatedRows, filterText, statusFilter])

  // Paginação
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage, pageSize])

  // Ações de override: Vincular / Desvincular / Resetar
  async function handleSetOverride(
    prodId: string,
    action: PositionOverrideAction,
    prod: MLCatalogProduct,
  ) {
    if (!cleanQuery) return
    setSavingKey(prodId)
    try {
      await positionOverridesService.setOverride({
        searchTerm: cleanQuery,
        mlItemId: prodId,
        action,
        title: prod.title || '',
        permalink: prod.permalink || '',
      })

      const updated = { ...overrides, [prodId]: action }
      onOverrideChange(updated)

      toast({
        title:
          action === 'include'
            ? 'Posição vinculada manualmente!'
            : 'Posição rejeitada manualmente!',
        description: `O anúncio ${prodId} agora ${
          action === 'include' ? 'alimenta as métricas' : 'foi excluído do cálculo'
        } de "${cleanQuery}".`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar override',
        description: err?.message || 'Falha ao persistir no banco.',
        variant: 'destructive',
      })
    } finally {
      setSavingKey(null)
    }
  }

  async function handleRemoveOverride(prodId: string) {
    if (!cleanQuery) return
    setSavingKey(prodId)
    try {
      await positionOverridesService.removeOverride(cleanQuery, prodId)
      const updated = { ...overrides }
      delete updated[prodId]
      onOverrideChange(updated)

      toast({
        title: 'Override removido',
        description: `O anúncio ${prodId} voltou ao julgamento automático do filtro taxonômico.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao remover override',
        description: err?.message || 'Falha ao atualizar no banco.',
        variant: 'destructive',
      })
    } finally {
      setSavingKey(null)
    }
  }

  // Investigação server-side de vendas reais para os itens desta página
  async function handleProbePageSales() {
    if (auditingSales || paginatedRows.length === 0) return
    setAuditingSales(true)
    setSalesAuditLog(null)

    const itemsToProbe = paginatedRows.slice(0, 15).map((r) => ({
      item_id: r.prodId,
      permalink: r.product.permalink || '',
    }))

    try {
      const response = await fetch('/api/ml-ad-scrape-sold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToProbe }),
      })

      if (!response.ok) {
        throw new Error(`Falha no leitor de vendas (HTTP ${response.status})`)
      }

      const data = await response.json()
      const results = data.results || {}
      let wafCount = 0
      let successCount = 0
      const newProbedMap: Record<string, number | null> = { ...probedSalesMap }

      Object.keys(results).forEach((k) => {
        const itemResult = results[k]
        if (itemResult.wafBlocked || itemResult.status === 'blocked_waf') {
          wafCount++
        }
        if (itemResult.soldQuantity != null) {
          successCount++
          newProbedMap[k] = itemResult.soldQuantity
        }
      })

      setProbedSalesMap(newProbedMap)
      setSalesAuditLog({
        testedCount: Object.keys(results).length,
        wafCount,
        successCount,
        explanation:
          wafCount > 0
            ? 'O Mercado Livre interceptou as requisições com WAF (suspicious-traffic), confirmando que servidores cloud não recebem o HTML humano renderizado sem sessão residencial.'
            : 'Páginas lidas sem bloqueio. Quando não exposto, o markup público não exibe o contador.',
      })

      toast({
        title: 'Auditoria de Vendas Concluída',
        description: `${successCount} contador(es) capturados, ${wafCount} bloqueados por WAF em ${Object.keys(results).length} anúncios auditados.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao consultar leitor de vendas',
        description: err?.message || 'Falha ao conectar ao hook server-side.',
        variant: 'destructive',
      })
    } finally {
      setAuditingSales(false)
    }
  }

  return (
    <Card className="border-indigo-200 bg-white shadow-sm overflow-hidden">
      <CardHeader className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                Gaveta de Posições Brutas ({counts.total})
              </Badge>
              <span className="text-xs text-slate-300">
                Transparência total: veja todas as posições mineradas do job antes do filtro
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              Universo Bruto de Resultados para &quot;{cleanQuery}&quot;
            </h3>
            <p className="text-xs text-slate-300">
              O filtro taxonômico avalia compatibilidade, modelo, marca e família. Use os botões{' '}
              <strong>Vincular</strong> ou <strong>Desvincular</strong> para ajustar manualmente o
              que alimenta as métricas e a âncora de preço.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleProbePageSales}
              disabled={auditingSales || paginatedRows.length === 0}
              className="text-xs h-9 bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700 hover:text-amber-200 gap-1.5"
              title="Audita páginas reais via hook server-side para demonstrar comportamento de WAF e contadores públicos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditingSales ? 'animate-spin' : ''}`} />
              {auditingSales ? 'Auditando Páginas...' : 'Auditar Vendas da Página'}
            </Button>
          </div>
        </div>

        {/* 4 Contadores no topo conforme especificação */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'linked_auto' ? 'all' : 'linked_auto')
              setCurrentPage(1)
            }}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              statusFilter === 'linked_auto'
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <span className="text-[10px] font-bold uppercase text-emerald-400 block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Vinculados pelo Filtro
            </span>
            <span className="text-xl font-black font-mono text-white mt-0.5 block">
              {counts.linkedAuto}
            </span>
            <span className="text-[10px] text-slate-400">Classificação taxonômica automática</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'linked_manual' ? 'all' : 'linked_manual')
              setCurrentPage(1)
            }}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              statusFilter === 'linked_manual'
                ? 'bg-indigo-950/80 border-indigo-400 text-indigo-200 ring-1 ring-indigo-400'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <span className="text-[10px] font-bold uppercase text-indigo-400 block flex items-center gap-1">
              <LinkIcon className="w-3 h-3 text-indigo-400" /> Vinculados por Você
            </span>
            <span className="text-xl font-black font-mono text-white mt-0.5 block">
              {counts.linkedManual}
            </span>
            <span className="text-[10px] text-slate-400">Override manual forçado (+)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'rejected_manual' ? 'all' : 'rejected_manual')
              setCurrentPage(1)
            }}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              statusFilter === 'rejected_manual'
                ? 'bg-rose-950/80 border-rose-400 text-rose-200 ring-1 ring-rose-400'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <span className="text-[10px] font-bold uppercase text-rose-400 block flex items-center gap-1">
              <Unlink className="w-3 h-3 text-rose-400" /> Rejeitados por Você
            </span>
            <span className="text-xl font-black font-mono text-white mt-0.5 block">
              {counts.rejectedManual}
            </span>
            <span className="text-[10px] text-slate-400">Override manual descartado (-)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'rejected_auto' ? 'all' : 'rejected_auto')
              setCurrentPage(1)
            }}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              statusFilter === 'rejected_auto'
                ? 'bg-amber-950/80 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <span className="text-[10px] font-bold uppercase text-amber-400 block flex items-center gap-1">
              <XCircle className="w-3 h-3 text-amber-400" /> Descartados pelo Filtro
            </span>
            <span className="text-xl font-black font-mono text-white mt-0.5 block">
              {counts.rejectedAuto}
            </span>
            <span className="text-[10px] text-slate-400">Acessórios, peças ou modelos fora</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Painel do Resultado da Auditoria de Vendas (Missão 2) */}
        {salesAuditLog && (
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold flex items-center gap-1.5 text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Diagnóstico de Leitura Pública de Vendas (ML Public Probe):
              </span>
              <Badge variant="outline" className="text-[10px] bg-white border-amber-300">
                {salesAuditLog.wafCount} WAF / {salesAuditLog.testedCount} Testados
              </Badge>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700">
              {salesAuditLog.explanation}
            </p>
          </div>
        )}

        {/* Filtros e Busca Local */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Filtrar por título, ID (MLB...), vendedor, marca ou motivo da rejeição..."
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500">Exibir:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="h-9 px-2 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
            >
              <option value={15}>15 por pág.</option>
              <option value={25}>25 por pág.</option>
              <option value={50}>50 por pág.</option>
              <option value={100}>100 por pág.</option>
            </select>

            {statusFilter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="h-9 text-xs text-slate-500 hover:text-slate-800"
              >
                Limpar filtro ({statusFilter})
              </Button>
            )}
          </div>
        </div>

        {/* Tabela de Posições Brutas */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Anúncio / ID / Link</th>
                  <th className="py-2.5 px-3 w-28">Preço & Condição</th>
                  <th className="py-2.5 px-3 w-36">Vendedor</th>
                  <th className="py-2.5 px-3 w-28">Vendas (ML)</th>
                  <th className="py-2.5 px-3">Julgamento do Filtro / Motivo</th>
                  <th className="py-2.5 px-3 w-36 text-center">Ação do Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Nenhuma posição encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => {
                    const globalIdx = (currentPage - 1) * pageSize + idx + 1
                    const prod = row.product
                    const pPrice = prod.buy_box_winner_price || prod.min_price || 0
                    const pCondition = prod.condition || 'not_specified'
                    const sellerNick =
                      prod.buy_box_winner_seller_nickname ||
                      (prod.is_own_account ? 'INFOPRECOBAIXO' : 'Não informado')
                    const sellerId = prod.buy_box_winner_seller_id || ''
                    const permalink = prod.permalink
                    const isSaving = savingKey === row.prodId

                    // Vendas capturadas
                    const soldReal =
                      probedSalesMap[row.prodId] != null
                        ? probedSalesMap[row.prodId]
                        : prod.sold_quantity != null
                          ? prod.sold_quantity
                          : null

                    return (
                      <tr
                        key={row.prodId}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          row.isEffectivelyLinked ? 'bg-emerald-50/20' : 'bg-white'
                        }`}
                      >
                        {/* Índice */}
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {globalIdx}
                        </td>

                        {/* Anúncio e link */}
                        <td className="py-3 px-3 max-w-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <a
                                href={
                                  permalink || `https://produto.mercadolivre.com.br/${row.prodId}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-slate-900 hover:text-indigo-600 line-clamp-2 leading-snug"
                                title={prod.title}
                              >
                                {prod.title}
                              </a>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono flex-wrap">
                              <span className="text-slate-600 font-semibold">{row.prodId}</span>
                              {prod.brand_value && (
                                <>
                                  <span>·</span>
                                  <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-700">
                                    Marca: {prod.brand_value}
                                  </span>
                                </>
                              )}
                              {prod.model_value && (
                                <>
                                  <span>·</span>
                                  <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-700">
                                    Mod: {prod.model_value}
                                  </span>
                                </>
                              )}
                              {permalink && (
                                <a
                                  href={permalink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 ml-1"
                                >
                                  Ver no ML <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Preço & Condição */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <span className="font-black font-mono text-slate-900 block">
                              {pPrice > 0
                                ? pPrice.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })
                                : 'Sem preço'}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4 uppercase font-semibold text-slate-500 border-slate-200"
                            >
                              {pCondition === 'new'
                                ? 'Novo'
                                : pCondition === 'used'
                                  ? 'Usado'
                                  : pCondition === 'refurbished'
                                    ? 'Reembalado'
                                    : 'Não espec.'}
                            </Badge>
                          </div>
                        </td>

                        {/* Seller */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <span
                              className="font-bold text-slate-800 block truncate max-w-[130px]"
                              title={sellerNick}
                            >
                              {sellerNick}
                            </span>
                            {sellerId && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                ID: {sellerId}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Vendas */}
                        <td className="py-3 px-3">
                          {soldReal != null && soldReal > 0 ? (
                            <span className="font-bold font-mono text-emerald-700 text-xs flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-600" />
                              {formatMLSoldQuantity(soldReal)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Não exposto
                            </span>
                          )}
                        </td>

                        {/* Julgamento do Filtro */}
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            {row.statusKind === 'linked_auto' && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] gap-1 font-bold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Vinculado ao produto (filtro)
                              </Badge>
                            )}
                            {row.statusKind === 'linked_manual' && (
                              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[10px] gap-1 font-bold">
                                <LinkIcon className="w-3 h-3 text-indigo-600" />
                                Vinculado por você (override manual)
                              </Badge>
                            )}
                            {row.statusKind === 'rejected_manual' && (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] gap-1 font-bold">
                                <Unlink className="w-3 h-3 text-rose-600" />
                                Rejeitado por você (override manual)
                              </Badge>
                            )}
                            {row.statusKind === 'rejected_auto' && (
                              <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] gap-1 font-semibold">
                                <XCircle className="w-3 h-3 text-slate-400" />
                                Descartado pelo filtro
                              </Badge>
                            )}

                            {/* Motivo detalhado se rejeitado */}
                            {!row.isEffectivelyLinked && (
                              <p className="text-[11px] text-slate-500 leading-tight">
                                {row.rejectionReason}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Ação de Override */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {row.isEffectivelyLinked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isSaving}
                                onClick={() => handleSetOverride(row.prodId, 'exclude', prod)}
                                className="h-7 px-2 text-[11px] border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-semibold gap-1"
                                title="Desvincular manualmente este anúncio das métricas do produto exato"
                              >
                                <Unlink className="w-3 h-3" />
                                Desvincular
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isSaving}
                                onClick={() => handleSetOverride(row.prodId, 'include', prod)}
                                className="h-7 px-2 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-semibold gap-1"
                                title="Vincular manualmente este anúncio às métricas do produto exato"
                              >
                                <LinkIcon className="w-3 h-3" />
                                Vincular
                              </Button>
                            )}

                            {/* Resetar override manual se houver */}
                            {row.override && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isSaving}
                                onClick={() => handleRemoveOverride(row.prodId)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                                title="Remover override e voltar ao julgamento automático do filtro"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Mostrando{' '}
              <strong>{filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> a{' '}
              <strong>{Math.min(currentPage * pageSize, filteredRows.length)}</strong> de{' '}
              <strong>{filteredRows.length}</strong> posições
              {filteredRows.length !== counts.total && (
                <span className="text-slate-400"> (filtrado do total de {counts.total})</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="h-7 px-2 text-xs"
              >
                Primeira
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs"
              >
                Anterior
              </Button>
              <span className="px-2 text-xs font-mono font-bold text-slate-800">
                Pág. {currentPage} de {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2 text-xs"
              >
                Próxima
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="h-7 px-2 text-xs"
              >
                Última
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
