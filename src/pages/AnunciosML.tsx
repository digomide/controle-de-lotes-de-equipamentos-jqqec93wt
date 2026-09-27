import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ShoppingBag,
  RefreshCw,
  ExternalLink,
  Search,
  CheckCircle2,
  PauseCircle,
  XCircle,
  AlertCircle,
  Boxes,
  Layers,
  Barcode,
  ArrowRight,
  PackageCheck,
  Eye,
  SlidersHorizontal,
  Sparkles,
  Compass,
  Edit2,
  Check,
  X,
  Calculator,
  RotateCcw,
  AlertTriangle,
  Flame,
  LayoutGrid,
  List,
  DollarSign,
  TrendingUp,
  Filter,
  Clock,
  MessageSquare,
  Users,
  Lock,
  HelpCircle,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  mlService,
  formatMLVariationSummary,
  normalizeMlbId,
  buildMLAdUrl,
  type MLSellerItem,
  type MLSellerItemsResult,
  type MLStatusResponse,
} from '@/services/mlService'

export function isItemCatalog(item: MLSellerItem | null | undefined): boolean {
  if (!item) return false
  if (item.catalog_product_id && String(item.catalog_product_id).trim().length > 0) return true
  if (item.catalog_listing === true) return true
  if ((item as any).is_catalog === true) return true
  if (Array.isArray(item.variations) && item.variations.length > 0) return true
  return false
}
import { mlCompetitorService, type MLCompetitorAd } from '@/services/mlCompetitorService'
import { formatMLSoldQuantity } from '@/services/mlCatalogService'
import { MLOrdersTab } from '@/components/MLOrdersTab'
import { MLPublishQueueTab } from '@/components/MLPublishQueueTab'
import { MLQuestionsTab } from '@/components/MLQuestionsTab'
import { MLAlertsBanner } from '@/components/MLAlertsBanner'
import { MLBulkPriceModal } from '@/components/MLBulkPriceModal'
import { MLDeadlinesTab } from '@/components/MLDeadlinesTab'
import { MLQuestionsInsightsPanel } from '@/components/MLQuestionsInsightsPanel'
import { MLSellersMonitorTab } from '@/components/MLSellersMonitorTab'
import { mlQuestionsService, type MLQuestionMetrics } from '@/services/mlQuestionsService'
import { MLItemMatchedProductsDisplay } from '@/components/MLItemMatchedProductsDisplay'
import { MLManualProductSelectorModal } from '@/components/MLManualProductSelectorModal'
import { CalculadoraViabilidade } from '@/components/CalculadoraViabilidade'

import { useTenant } from '@/contexts/TenantContext'

export default function AnunciosML() {
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentTenant, isMasterTenant } = useTenant()
  const [mlStatus, setMlStatus] = useState<MLStatusResponse | null>(null)

  // Aba ativa: 'anuncios' (padrão) | 'perguntas' | 'envios' | 'pedidos' | 'sellers' | 'erros_publicacao'
  const initialTab = (searchParams.get('tab') as any) || 'anuncios'
  const validTabs = ['anuncios', 'perguntas', 'envios', 'pedidos', 'sellers', 'erros_publicacao']
  const [activeTab, setActiveTab] = useState<
    'anuncios' | 'perguntas' | 'envios' | 'pedidos' | 'sellers' | 'erros_publicacao'
  >(validTabs.includes(initialTab) ? initialTab : 'anuncios')

  // Sincroniza se o query param mudar na URL
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam as any)
    }
  }, [searchParams])

  const [loading, setLoading] = useState(true)
  const [progressText, setProgressText] = useState<string>(
    'Carregando anúncios do Mercado Livre...',
  )
  const [data, setData] = useState<MLSellerItemsResult | null>(null)
  const [competitorAds, setCompetitorAds] = useState<MLCompetitorAd[]>([])
  const [questionsMetrics, setQuestionsMetrics] = useState<MLQuestionMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [matchedFilter, setMatchedFilter] = useState<string>('all')
  const [catalogOnlyFilter, setCatalogOnlyFilter] = useState<string>('all')
  const [conditionFilter, setConditionFilter] = useState<
    'all' | 'new' | 'refurbished' | 'used' | 'not_specified'
  >('all')
  const [refurbishedGradeFilter, setRefurbishedGradeFilter] = useState<
    'all' | 'Excelente' | 'Bom' | 'Aceitável'
  >('all')

  // Filtros rápidos nos cabeçalhos da tabela (Colunas)
  const [colSearchTitle, setColSearchTitle] = useState('')
  const [colFilterStatus, setColFilterStatus] = useState<string>('all')
  const [colFilterCondition, setColFilterCondition] = useState<string>('all')
  const [colFilterStock, setColFilterStock] = useState<string>('all') // 'all' | 'in_stock' | 'zero_stock'
  const [colFilterVinculo, setColFilterVinculo] = useState<string>('all') // 'all' | 'matched' | 'unmatched' | 'catalog' | 'variations'
  const [colFilterListingType, setColFilterListingType] = useState<string>('all') // 'all' | 'gold_special' | 'gold_pro'

  // Visualização Tabela vs Cards
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  // Modal de seleção manual de produto
  const [manualSelectorOpen, setManualSelectorOpen] = useState(false)
  const [selectedAdForManualLink, setSelectedAdForManualLink] = useState<MLSellerItem | null>(null)

  // Calculadora de Viabilidade nos Cards (id do card expandido)
  const [expandedCardViabilityId, setExpandedCardViabilityId] = useState<string | null>(null)

  // Seleção de itens para ações em massa
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [bulkModalOpen, setBulkModalOpen] = useState(false)

  // Edição inline de preço e estoque
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceVal, setEditingPriceVal] = useState<string>('')
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null)

  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [editingStockVal, setEditingStockVal] = useState<string>('')
  const [savingStockId, setSavingStockId] = useState<string | null>(null)

  // Status toggle
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null)

  const fetchItems = async (showToast = false) => {
    setLoading(true)
    setError(null)
    setProgressText('Consultando anúncios na conta do Mercado Livre...')
    try {
      const [res, compAds, qMetrics, statusRes] = await Promise.all([
        mlService.getSellerItems({
          onProgress: (pText) => {
            if (pText) setProgressText(pText)
          },
        }),
        mlCompetitorService.getCompetitorAds().catch(() => []),
        mlQuestionsService.getMetrics().catch(() => null),
        mlService.getStatus().catch(() => null),
      ])

      setData(res)
      setCompetitorAds(compAds)
      setQuestionsMetrics(qMetrics)
      setMlStatus(statusRes)

      if (showToast) {
        const activeCount = res.items.filter((i) => i.status === 'active').length
        toast({
          title: 'Anúncios atualizados',
          description: `${res.items.length} anúncio(s) carregados (${activeCount} ativos).`,
        })
      }
    } catch (err: any) {
      console.error('Erro ao buscar anúncios do ML:', err)
      const msg =
        err?.message ||
        'Não foi possível carregar os anúncios do Mercado Livre. Verifique a conexão nas Configurações.'
      setError(msg)
      toast({
        title: 'Erro ao carregar anúncios',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems(false)
  }, [currentTenant?.id])

  const filteredItems = useMemo(() => {
    if (!data?.items || !Array.isArray(data.items)) return []
    return data.items.filter((item) => {
      if (!item) return false

      try {
        // Filtro global de busca por texto (título, ID, GTIN, modelo, SKU do match, catalog_product_id)
        if (search.trim()) {
          const q = search.toLowerCase()
          const matchesTitle = item.title ? item.title.toLowerCase().includes(q) : false
          const matchesId = item.id ? item.id.toLowerCase().includes(q) : false
          const matchesCatalogId = item.catalog_product_id
            ? item.catalog_product_id.toLowerCase().includes(q)
            : false
          const matchesGtin = item.gtin ? item.gtin.toLowerCase().includes(q) : false
          const matchesBrand = item.brand ? item.brand.toLowerCase().includes(q) : false
          const matchesModel = item.model ? item.model.toLowerCase().includes(q) : false
          const matchesSku =
            (item.matchedProduct?.sku
              ? item.matchedProduct.sku.toLowerCase().includes(q)
              : false) ||
            (Array.isArray(item.matchedProducts) &&
              item.matchedProducts.some((p) => p.sku?.toLowerCase().includes(q)))
          const matchesProductName =
            (item.matchedProduct?.name
              ? item.matchedProduct.name.toLowerCase().includes(q)
              : false) ||
            (Array.isArray(item.matchedProducts) &&
              item.matchedProducts.some((p) => p.name?.toLowerCase().includes(q)))
          const matchesSpecs =
            Array.isArray(item.matchedProducts) &&
            item.matchedProducts.some((p) => {
              const specSummary =
                `${p.processor || ''} ${p.ram || ''} ${p.storage || ''} ${p.screen_size || ''}`.toLowerCase()
              return specSummary.includes(q)
            })

          // Busca também dentro das variações reais do Mercado Livre (ex: 16GB, 256GB, i5, etc.)
          const matchesVariations =
            Array.isArray(item.variations) &&
            item.variations.some((v) => {
              if (v.specsSummary && v.specsSummary.toLowerCase().includes(q)) return true
              if (v.label && v.label.toLowerCase().includes(q)) return true
              if (v.id && String(v.id).toLowerCase().includes(q)) return true
              const combMatches = (v.attribute_combinations || []).some((c) => {
                return (
                  (c.name && c.name.toLowerCase().includes(q)) ||
                  (c.value_name && c.value_name.toLowerCase().includes(q))
                )
              })
              return combMatches
            })

          if (
            !matchesTitle &&
            !matchesId &&
            !matchesCatalogId &&
            !matchesGtin &&
            !matchesBrand &&
            !matchesModel &&
            !matchesSku &&
            !matchesProductName &&
            !matchesSpecs &&
            !matchesVariations
          ) {
            return false
          }
        }

        // Filtro global de status ML (active, paused, closed)
        if (statusFilter !== 'all' && item.status !== statusFilter) {
          return false
        }

        // Filtro global de condição ML
        if (conditionFilter !== 'all') {
          const itemCond = (item.condition || '').toLowerCase()
          if (conditionFilter === 'refurbished') {
            if (itemCond !== 'refurbished') return false
            if (refurbishedGradeFilter !== 'all') {
              const rawG = String(item.condition_grade || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim()
              let normalizedG: 'Excelente' | 'Bom' | 'Aceitável' | null = null
              if (rawG === 'excelente' || rawG.includes('excelent') || rawG === '40108830') {
                normalizedG = 'Excelente'
              } else if (rawG === 'bom' || rawG.includes('good') || rawG === '40108831') {
                normalizedG = 'Bom'
              } else if (rawG === 'aceitavel' || rawG.includes('accept') || rawG === '40108832') {
                normalizedG = 'Aceitável'
              }
              const effectiveGrade = normalizedG || 'Excelente'
              if (effectiveGrade !== refurbishedGradeFilter) return false
            }
          } else if (conditionFilter === 'new') {
            if (itemCond !== 'new') return false
          } else if (conditionFilter === 'used') {
            if (itemCond !== 'used') return false
          } else if (conditionFilter === 'not_specified') {
            if (itemCond && itemCond !== 'not_specified' && itemCond !== 'unknown') {
              return false
            }
          }
        }

        // Filtro global de vínculo ao catálogo local (considera tanto confirmados quanto sugeridos)
        const hasAnyMatch = Boolean(
          item.matchedProduct || (item.matchedProducts && item.matchedProducts.length > 0),
        )
        if (matchedFilter === 'matched' && !hasAnyMatch) return false
        if (matchedFilter === 'unmatched' && hasAnyMatch) return false

        // Filtro global de tipo de anúncio
        if (catalogOnlyFilter === 'catalog' && !isItemCatalog(item)) {
          return false
        }
        if (catalogOnlyFilter === 'traditional' && isItemCatalog(item)) {
          return false
        }

        // ================= FILTROS DE CABEÇALHO DE COLUNA =================
        // 1. Coluna Anúncio: Título / ID / SKU
        if (colSearchTitle.trim()) {
          const cTerm = colSearchTitle.toLowerCase()
          const mTitle = item.title?.toLowerCase().includes(cTerm)
          const mId = item.id?.toLowerCase().includes(cTerm)
          const mSku =
            (item.matchedProduct?.sku
              ? item.matchedProduct.sku.toLowerCase().includes(cTerm)
              : false) ||
            (Array.isArray(item.matchedProducts) &&
              item.matchedProducts.some((p) => p.sku?.toLowerCase().includes(cTerm)))
          const mVar =
            Array.isArray(item.variations) &&
            item.variations.some((v) => {
              if (v.specsSummary && v.specsSummary.toLowerCase().includes(cTerm)) return true
              return (v.attribute_combinations || []).some(
                (c) => c.value_name && c.value_name.toLowerCase().includes(cTerm),
              )
            })
          if (!mTitle && !mId && !mSku && !mVar) return false
        }

        // 2. Coluna Status
        if (colFilterStatus !== 'all' && item.status !== colFilterStatus) {
          return false
        }

        // 3. Coluna Condição
        if (colFilterCondition !== 'all') {
          const itemCond = (item.condition || '').toLowerCase()
          if (colFilterCondition === 'refurbished') {
            if (itemCond !== 'refurbished') return false
          } else if (colFilterCondition === 'new') {
            if (itemCond !== 'new') return false
          } else if (colFilterCondition === 'used') {
            if (itemCond !== 'used') return false
          }
        }

        // 4. Coluna Estoque
        if (colFilterStock === 'in_stock' && (item.available_quantity ?? 0) <= 0) {
          return false
        }
        if (colFilterStock === 'zero_stock' && (item.available_quantity ?? 0) > 0) {
          return false
        }

        // 5. Coluna Vínculo / Catálogo
        if (colFilterVinculo === 'matched' && !hasAnyMatch) return false
        if (colFilterVinculo === 'unmatched' && hasAnyMatch) return false
        if (colFilterVinculo === 'catalog' && !isItemCatalog(item)) return false
        if (colFilterVinculo === 'variations' && (!item.variations || item.variations.length === 0))
          return false

        // 6. Coluna Tipo de anúncio (Clássico / Premium)
        if (colFilterListingType !== 'all') {
          if (item.listing_type_id !== colFilterListingType) return false
        }

        return true
      } catch (fErr) {
        console.warn('Erro ao filtrar item ML:', fErr, item)
        return true
      }
    })
  }, [
    data,
    search,
    statusFilter,
    matchedFilter,
    catalogOnlyFilter,
    conditionFilter,
    refurbishedGradeFilter,
    colSearchTitle,
    colFilterStatus,
    colFilterCondition,
    colFilterStock,
    colFilterVinculo,
    colFilterListingType,
  ])

  // Contagem de filtros ativos no cabeçalho
  const activeHeaderFiltersCount = useMemo(() => {
    let count = 0
    if (colSearchTitle.trim()) count++
    if (colFilterStatus !== 'all') count++
    if (colFilterCondition !== 'all') count++
    if (colFilterStock !== 'all') count++
    if (colFilterVinculo !== 'all') count++
    if (colFilterListingType !== 'all') count++
    return count
  }, [
    colSearchTitle,
    colFilterStatus,
    colFilterCondition,
    colFilterStock,
    colFilterVinculo,
    colFilterListingType,
  ])

  const handleClearHeaderFilters = () => {
    setColSearchTitle('')
    setColFilterStatus('all')
    setColFilterCondition('all')
    setColFilterStock('all')
    setColFilterVinculo('all')
    setColFilterListingType('all')
  }

  const stats = useMemo(() => {
    if (!data?.items || !Array.isArray(data.items)) {
      return {
        total: 0,
        active: 0,
        paused: 0,
        closed: 0,
        matched: 0,
        catalogListings: 0,
        condAll: 0,
        condNew: 0,
        condRefurbished: 0,
        condUsed: 0,
        condNotSpecified: 0,
        refurbGradeExcelente: 0,
        refurbGradeBom: 0,
        refurbGradeAceitavel: 0,
      }
    }
    const items = data.items
    const refurbs = items.filter((i) => (i?.condition || '').toLowerCase() === 'refurbished')

    let countExcelente = 0
    let countBom = 0
    let countAceitavel = 0

    refurbs.forEach((i) => {
      const g = String(i?.condition_grade || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
      if (g === 'bom' || g.includes('good') || g === '40108831') {
        countBom++
      } else if (g === 'aceitavel' || g.includes('accept') || g === '40108832') {
        countAceitavel++
      } else {
        countExcelente++
      }
    })

    return {
      total: items.length,
      active: items.filter((i) => i?.status === 'active').length,
      paused: items.filter((i) => i?.status === 'paused').length,
      closed: items.filter((i) => i?.status === 'closed').length,
      matched: items.filter((i) =>
        Boolean(i?.matchedProduct || (i?.matchedProducts && i.matchedProducts.length > 0)),
      ).length,
      catalogListings: items.filter((i) => isItemCatalog(i)).length,
      condAll: items.length,
      condNew: items.filter((i) => (i?.condition || '').toLowerCase() === 'new').length,
      condRefurbished: refurbs.length,
      condUsed: items.filter((i) => (i?.condition || '').toLowerCase() === 'used').length,
      condNotSpecified: items.filter((i) => {
        const c = (i?.condition || '').toLowerCase()
        return !c || c === 'not_specified' || c === 'unknown'
      }).length,
      refurbGradeExcelente: countExcelente,
      refurbGradeBom: countBom,
      refurbGradeAceitavel: countAceitavel,
    }
  }, [data])

  // Ação de confirmar vínculo do produto interno ao anúncio
  const handleConfirmLink = async (productId: string, mlItemId: string) => {
    try {
      await mlService.linkProductToAd(productId, mlItemId)
      toast({
        title: 'Produto vinculado com sucesso!',
        description: `O produto foi vinculado ao anúncio ${mlItemId}.`,
      })

      // Atualização otimista no estado local
      if (data) {
        const updated = data.items.map((i) => {
          if (i.id === mlItemId) {
            const updatedMatched = (i.matchedProducts || []).map((m) =>
              m.id === productId
                ? { ...m, is_suggested: false, match_type: 'ml_listing_id' as const }
                : m,
            )
            return {
              ...i,
              matchedProducts: updatedMatched,
              matchedProduct: updatedMatched.find((m) => m.id === productId) || i.matchedProduct,
            }
          }
          return i
        })
        setData({ ...data, items: updated })
      }
    } catch (err: any) {
      console.error('Erro ao vincular produto:', err)
      toast({
        title: 'Falha ao vincular produto',
        description: err.message || 'Erro ao gravar vínculo no banco de dados.',
        variant: 'destructive',
      })
    }
  }

  // Ação de desvincular produto interno do anúncio
  const handleUnlink = async (productId: string) => {
    try {
      await mlService.unlinkProductFromAd(productId)
      toast({
        title: 'Produto desvinculado!',
        description: 'O vínculo do anúncio foi removido do catálogo.',
      })

      // Atualização otimista
      if (data) {
        const updated = data.items.map((i) => {
          if (
            i.matchedProducts?.some((m) => m.id === productId) ||
            i.matchedProduct?.id === productId
          ) {
            const rem = (i.matchedProducts || []).filter((m) => m.id !== productId)
            return {
              ...i,
              matchedProducts: rem,
              matchedProduct: rem[0] || undefined,
            }
          }
          return i
        })
        setData({ ...data, items: updated })
      }
    } catch (err: any) {
      console.error('Erro ao desvincular:', err)
      toast({
        title: 'Falha ao desvincular',
        description: err.message || 'Erro ao remover vínculo.',
        variant: 'destructive',
      })
    }
  }

  const handleOpenManualSelector = (item: MLSellerItem) => {
    setSelectedAdForManualLink(item)
    setManualSelectorOpen(true)
  }

  // Salvar Edição Direta de Preço na Linha
  const handleSavePrice = async (item: MLSellerItem) => {
    if (isItemCatalog(item)) {
      toast({
        title: 'Catálogo Unificado',
        description:
          'Este anúncio é de Catálogo Unificado — edite o preço pelo painel do ML ou Ideris. O sistema sincroniza o valor na próxima coleta.',
      })
      setEditingPriceId(null)
      return
    }

    const num = parseFloat(editingPriceVal.replace(',', '.'))
    if (isNaN(num) || num <= 0) {
      toast({
        title: 'Preço inválido',
        description: 'Digite um valor numérico maior que zero.',
        variant: 'destructive',
      })
      return
    }

    setSavingPriceId(item.id)
    try {
      const res = await mlService.updateItemPrice(item.id, num, item.matchedProduct?.id)
      const hadAuto = Boolean(res?.hadActivePricingAutomation)

      toast({
        title: hadAuto ? 'Preço atualizado (Preço Automático desativado)' : 'Preço atualizado!',
        description: hadAuto
          ? `A regra de Preço Automático do ML foi desativada e o anúncio ${item.id} foi atualizado para R$ ${num.toFixed(2)}.`
          : `Anúncio ${item.id} agora está com R$ ${num.toFixed(2)}.`,
      })
      // Atualiza localmente
      if (data) {
        const updated = data.items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                price: num,
                has_pricing_automation: hadAuto ? false : i.has_pricing_automation,
              }
            : i,
        )
        setData({ ...data, items: updated })
      }
      setEditingPriceId(null)
    } catch (err: any) {
      console.error('Erro ao atualizar preço:', err)
      const rawMsg = err.message || 'Erro ao comunicar com a fila segura do ML.'
      const isPolicyAgent =
        rawMsg.includes('PolicyAgent') ||
        rawMsg.includes('PA_UNAUTHORIZED_RESULT_FROM_POLICIES') ||
        rawMsg.includes('At least one policy returned UNAUTHORIZED')

      let descriptionText = rawMsg
      if (isPolicyAgent) {
        descriptionText = rawMsg.includes('Preço Automático')
          ? rawMsg
          : 'O Mercado Livre recusou a alteração (PolicyAgent 403 / PA_UNAUTHORIZED_RESULT_FROM_POLICIES). Isso ocorre quando a conexão OAuth atual não possui o escopo de escrita (urn:ml:mktp:offers:/read-write). Vá em Configurações → Mercado Livre e clique em "Reconectar para Liberar Edição".'
      }

      toast({
        title: 'Falha ao atualizar preço',
        description: descriptionText,
        variant: 'destructive',
      })
    } finally {
      setSavingPriceId(null)
    }
  }

  // Salvar Edição Direta de Estoque na Linha
  const handleSaveStock = async (item: MLSellerItem) => {
    const num = parseInt(editingStockVal, 10)
    if (isNaN(num) || num < 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'Digite um número inteiro maior ou igual a zero.',
        variant: 'destructive',
      })
      return
    }

    setSavingStockId(item.id)
    try {
      await mlService.updateItemStock(item.id, num, item.matchedProduct?.id)
      toast({
        title: 'Estoque do anúncio atualizado!',
        description: `Disponibilidade de ${item.id} alterada para ${num} un.`,
      })
      // Atualiza localmente
      if (data) {
        const updated = data.items.map((i) =>
          i.id === item.id ? { ...i, available_quantity: num } : i,
        )
        setData({ ...data, items: updated })
      }
      setEditingStockId(null)
    } catch (err: any) {
      console.error('Erro ao atualizar estoque:', err)
      const rawMsg = err.message || 'Erro ao comunicar com a fila segura do ML.'
      const isPolicyAgent =
        rawMsg.includes('PolicyAgent') ||
        rawMsg.includes('PA_UNAUTHORIZED_RESULT_FROM_POLICIES') ||
        rawMsg.includes('At least one policy returned UNAUTHORIZED')

      toast({
        title: 'Falha ao atualizar estoque',
        description: isPolicyAgent
          ? 'O Mercado Livre bloqueou a edição (PolicyAgent 403). Reconecte a conta em Configurações → Mercado Livre para conceder escopos de escrita.'
          : rawMsg,
        variant: 'destructive',
      })
    } finally {
      setSavingStockId(null)
    }
  }

  // Alternar Status (Pausar / Reativar)
  const handleToggleStatus = async (item: MLSellerItem) => {
    const nextStatus: 'active' | 'paused' = item.status === 'active' ? 'paused' : 'active'
    setTogglingStatusId(item.id)
    try {
      await mlService.updateItemStatus(item.id, nextStatus, item.matchedProduct?.id)
      toast({
        title: nextStatus === 'active' ? 'Anúncio reativado!' : 'Anúncio pausado!',
        description: `Status do anúncio ${item.id} atualizado para ${nextStatus}.`,
      })
      if (data) {
        const updated = data.items.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i))
        setData({ ...data, items: updated })
      }
    } catch (err: any) {
      console.error('Erro ao alterar status:', err)
      toast({
        title: 'Falha ao alterar status',
        description: err.message || 'Erro ao processar status na fila segura.',
        variant: 'destructive',
      })
    } finally {
      setTogglingStatusId(null)
    }
  }

  // Seleção múltipla para ações em massa
  const handleToggleSelect = (itemId: string) => {
    const next = new Set(selectedItemIds)
    if (next.has(itemId)) {
      next.delete(itemId)
    } else {
      next.add(itemId)
    }
    setSelectedItemIds(next)
  }

  const handleSelectAllFiltered = () => {
    if (selectedItemIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedItemIds(new Set())
    } else {
      setSelectedItemIds(new Set(filteredItems.map((i) => i.id)))
    }
  }

  const selectedItemsList = useMemo(() => {
    if (!data?.items) return []
    return data.items.filter((i) => selectedItemIds.has(i.id))
  }, [data, selectedItemIds])

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 font-semibold text-[11px]">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Ativo
          </Badge>
        )
      case 'paused':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1 font-semibold text-[11px]">
            <PauseCircle className="w-3 h-3 text-amber-600" />
            Pausado
          </Badge>
        )
      case 'closed':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 gap-1 font-semibold text-[11px]">
            <XCircle className="w-3 h-3 text-slate-500" />
            Encerrado
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-slate-600 text-[11px]">
            {status}
          </Badge>
        )
    }
  }

  const renderSoldBadge = (sold?: number | null) => {
    if (sold === null || sold === undefined || isNaN(sold)) {
      return (
        <Badge
          variant="outline"
          className="bg-slate-50 text-slate-400 border-slate-200 text-[10px] font-normal"
        >
          -
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
      >
        <span>🛒</span>
        <span>{label}</span>
      </Badge>
    )
  }

  // Resolução do menor preço efetivo do anúncio (considerando variações ou preço raiz)
  const getItemEffectivePrice = (item: MLSellerItem): number => {
    const rootPrice = Number(item.price) || 0
    if (Array.isArray(item.variations) && item.variations.length > 0) {
      const validVarPrices = item.variations.map((v) => Number(v.price) || 0).filter((p) => p > 0)
      if (validVarPrices.length > 0) {
        return Math.min(...validVarPrices)
      }
    }
    return rootPrice
  }

  // Resolução do melhor concorrente / líder de Buy Box monitorado para este anúncio (se houver)
  const getBestCompetitorMatch = (item: MLSellerItem): MLCompetitorAd | null => {
    if (!competitorAds || competitorAds.length === 0) return null

    // 1. Tentar correspondência exata por mlb_item_id se estiver vinculado diretamente
    const directMatch = competitorAds.find(
      (c) => c.mlb_item_id && normalizeMlbId(c.mlb_item_id) === normalizeMlbId(item.id),
    )
    if (directMatch && directMatch.current_price > 0) {
      return directMatch
    }

    // 2. Tentar cruzamento por SKU com produto interno vinculado
    const matchedSku =
      item.matchedProduct?.sku ||
      (Array.isArray(item.matchedProducts) ? item.matchedProducts[0]?.sku : '')
    if (matchedSku && matchedSku.length >= 4) {
      const skuMatch = competitorAds.find(
        (c) =>
          c.current_price > 0 &&
          (c.matchedProduct?.sku?.toLowerCase() === matchedSku.toLowerCase() ||
            c.title.toLowerCase().includes(matchedSku.toLowerCase())),
      )
      if (skuMatch) return skuMatch
    }

    // 3. Tentar cruzamento por sobreposição de palavras-chave do título
    const itemWords = (item.title || '')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)

    let bestMatch: MLCompetitorAd | null = null
    let maxOverlap = 0

    for (const c of competitorAds) {
      if (!c.current_price || c.current_price <= 0) continue
      const cWords = (c.title || '').toLowerCase().split(/\s+/)
      const overlap = itemWords.filter((w) => cWords.includes(w)).length
      if (overlap >= 4 && overlap > maxOverlap) {
        maxOverlap = overlap
        bestMatch = c
      }
    }

    return bestMatch
  }

  // Resolução da URL no Mercado Livre com fallback por ID ou ID do item pai normalizados
  const getAdMLUrl = (item: MLSellerItem): string => {
    return buildMLAdUrl(item)
  }

  const renderCatalogAdIndicator = (item: MLSellerItem) => {
    try {
      if (!item) return null
      const isCatalog = isItemCatalog(item)
      const hasAutoPrice = Boolean(item.has_pricing_automation)

      if (!isCatalog && !hasAutoPrice) return null

      const vars = Array.isArray(item.variations) ? item.variations.filter(Boolean) : []
      const count = vars.length

      return (
        <div className="inline-flex items-center gap-1 shrink-0 flex-wrap">
          {isCatalog && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0"
              title={
                count > 0
                  ? `Catálogo ML · ${count} ${count === 1 ? 'variação' : 'variações'} (detalhes na coluna Vínculo Catálogo)`
                  : 'Anúncio de Catálogo ML'
              }
            >
              <Layers className="w-3 h-3 text-blue-600" />
              <span>{count > 0 ? `Catálogo (${count})` : 'Catálogo'}</span>
            </span>
          )}
          {hasAutoPrice && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shrink-0"
              title="Este anúncio possui regra de Preço Automático ativa no Mercado Livre (será removida automaticamente ao editar preço)."
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Preço Automático</span>
            </span>
          )}
        </div>
      )
    } catch (e) {
      console.warn('Erro ao renderizar selo de catálogo:', e)
      return null
    }
  }

  const renderConditionBadge = (item: MLSellerItem) => {
    const cond = (item.condition || '').toLowerCase()
    const rawG = String(item.condition_grade || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

    let normGrade: 'Excelente' | 'Bom' | 'Aceitável' = 'Excelente'
    if (rawG === 'bom' || rawG.includes('good') || rawG === '40108831') {
      normGrade = 'Bom'
    } else if (rawG === 'aceitavel' || rawG.includes('accept') || rawG === '40108832') {
      normGrade = 'Aceitável'
    }

    if (cond === 'refurbished') {
      const gradeStyles =
        normGrade === 'Excelente'
          ? 'bg-purple-900 text-white border-purple-950'
          : normGrade === 'Bom'
            ? 'bg-purple-600 text-white border-purple-700'
            : 'bg-purple-300 text-purple-950 border-purple-400 font-bold'

      return (
        <Badge className={`text-[10px] font-semibold gap-1 shadow-2xs ${gradeStyles}`}>
          <Sparkles className="w-3 h-3 opacity-90" />
          {normGrade}
        </Badge>
      )
    }

    if (cond === 'used') {
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold"
        >
          Usado
        </Badge>
      )
    }

    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold"
      >
        Novo
      </Badge>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#ffe600] border border-amber-400 flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Gestor ML
                {mlStatus?.connected ? (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-900 border-amber-300 text-xs font-semibold gap-1"
                  >
                    <Eye className="w-3 h-3 text-amber-700" />
                    {mlStatus.nickname ||
                      (isMasterTenant ? 'INFOPRECOBAIXO' : 'Conta ML Conectada')}
                  </Badge>
                ) : isMasterTenant ? (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-900 border-amber-300 text-xs font-semibold gap-1"
                  >
                    <Eye className="w-3 h-3 text-amber-700" />
                    INFOPRECOBAIXO
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-800 border-amber-200 text-xs font-semibold gap-1"
                  >
                    Sem conexão ML
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-slate-500">
                Gestão completa da conta oficial do Mercado Livre: pedidos reais faturados, edição
                direta e em massa de preço/estoque, alertas e monitoramento de falhas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <Link to="/explorador-catalogo">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-9 bg-blue-50/60 border-blue-200 text-blue-800 hover:bg-blue-100 gap-1.5 font-medium shadow-xs"
            >
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              Explorador de Catálogo
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchItems(true)}
            disabled={loading}
            className="text-xs h-9 bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            Atualizar
          </Button>
          <Link to="/radar-ml">
            <Button
              size="sm"
              className="text-xs h-9 bg-[#d9532f] hover:bg-[#c24624] text-white gap-1.5 font-medium shadow-xs"
            >
              Radar de Concorrência
            </Button>
          </Link>
          <Link to="/configuracoes">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Configurar ML
            </Button>
          </Link>
        </div>
      </div>

      {/* Alertas Críticos no Topo do Gestor */}
      {data?.items && (
        <MLAlertsBanner
          items={data.items}
          competitorAds={competitorAds}
          onFilterPaused={() => {
            setActiveTab('anuncios')
            setStatusFilter('paused')
          }}
          onFilterUnmatched={() => {
            setActiveTab('anuncios')
            setMatchedFilter('unmatched')
          }}
          onNavigateToSellers={() => {
            setActiveTab('sellers')
          }}
        />
      )}

      {/* Banner de Insight com Correção de 1 Clique (quando houver dúvidas recorrentes) */}
      {questionsMetrics && (
        <MLQuestionsInsightsPanel
          metrics={questionsMetrics}
          compact={true}
          onRefresh={() => {
            fetchItems(false)
          }}
        />
      )}

      {/* Abas Principais do Gestor ML */}
      <Tabs
        value={activeTab}
        onValueChange={(val: any) => {
          setActiveTab(val)
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            if (val === 'anuncios') {
              next.delete('tab')
            } else {
              next.set('tab', val)
            }
            return next
          })
        }}
        className="space-y-6"
      >
        <TabsList className="bg-slate-100 p-1 rounded-xl h-11 border border-slate-200 grid grid-cols-6 max-w-4xl">
          <TabsTrigger
            value="anuncios"
            className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            <ShoppingBag className="w-4 h-4 text-amber-600" />
            Meus Anúncios ({stats.total})
          </TabsTrigger>
          <TabsTrigger
            value="perguntas"
            className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            <MessageSquare className="w-4 h-4 text-yellow-600" />
            Perguntas ML
          </TabsTrigger>
          <TabsTrigger
            value="envios"
            className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            <Clock className="w-4 h-4 text-blue-600" />
            Envios & Prazos
          </TabsTrigger>
          <TabsTrigger
            value="pedidos"
            className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Vendas & Pedidos
          </TabsTrigger>
          <TabsTrigger
            value="sellers"
            className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs text-orange-700"
          >
            <Users className="w-4 h-4 text-orange-600" />
            Monitor de Sellers
          </TabsTrigger>
          <TabsTrigger
            value="erros_publicacao"
            className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Fila de Publicação
          </TabsTrigger>
        </TabsList>

        {/* ==================== ABA 1: MEUS ANÚNCIOS (COM EDIÇÃO DIRETA E EM MASSA) ==================== */}
        <TabsContent value="anuncios" className="space-y-6 focus-visible:outline-hidden">
          {/* Contadores estatísticos */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <Card className="border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                  Total no ML
                </span>
                <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
                  {stats.total}
                </span>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] uppercase tracking-wider text-blue-700 font-bold block flex items-center gap-1">
                  <Layers className="w-3 h-3 text-blue-600" /> De Catálogo
                </span>
                <span className="text-2xl font-black text-blue-700 mt-1 block font-mono">
                  {stats.catalogListings}
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] uppercase tracking-wider text-emerald-600 font-bold block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ativos
                </span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block font-mono">
                  {stats.active}
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] uppercase tracking-wider text-amber-600 font-bold block flex items-center gap-1">
                  <PauseCircle className="w-3 h-3" /> Pausados
                </span>
                <span className="text-2xl font-black text-amber-700 mt-1 block font-mono">
                  {stats.paused}
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Encerrados
                </span>
                <span className="text-2xl font-black text-slate-700 mt-1 block font-mono">
                  {stats.closed}
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] uppercase tracking-wider text-purple-600 font-bold block flex items-center gap-1">
                  <PackageCheck className="w-3 h-3" /> Vinculados
                </span>
                <span className="text-2xl font-black text-purple-700 mt-1 block font-mono">
                  {stats.matched}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Filtros & Ações em Massa */}
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Filtrar por título, ID (MLB...), ID Catálogo, GTIN, marca ou SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={catalogOnlyFilter} onValueChange={setCatalogOnlyFilter}>
                    <SelectTrigger className="text-xs h-9 w-[150px] bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Tipo de Anúncio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="catalog">Somente Catálogo</SelectItem>
                      <SelectItem value="traditional">Somente Tradicionais</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="text-xs h-9 w-[130px] bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="paused">Pausados</SelectItem>
                      <SelectItem value="closed">Encerrados</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={matchedFilter} onValueChange={setMatchedFilter}>
                    <SelectTrigger className="text-xs h-9 w-[160px] bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Vínculo Catálogo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os anúncios</SelectItem>
                      <SelectItem value="matched">Vinculados ao estoque</SelectItem>
                      <SelectItem value="unmatched">Sem vínculo no estoque</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center">
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-md ${viewMode === 'table' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
                      title="Exibição em Tabela (Edição direta)"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
                      title="Exibição em Grade / Cards"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Indicador de Filtros de Cabeçalho Ativos */}
              {activeHeaderFiltersCount > 0 && (
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-blue-700" />
                    <span className="font-medium text-blue-950">
                      <strong>{activeHeaderFiltersCount}</strong> filtro(s) ativo(s) nos cabeçalhos
                      da tabela.
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearHeaderFilters}
                    className="text-xs h-7 px-2 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                  >
                    Limpar filtros das colunas
                  </Button>
                </div>
              )}

              {/* Barra de Ações em Massa quando houver seleção */}
              {selectedItemIds.size > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-300 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-700" />
                    <span className="font-bold text-amber-950">
                      {selectedItemIds.size} anúncio(s) selecionado(s)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setBulkModalOpen(true)}
                      className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1 shadow-xs"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      Ações de Preço em Massa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedItemIds(new Set())}
                      className="text-xs h-8 text-slate-600"
                    >
                      Desmarcar todos
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conteúdo: Tabela ou Cards */}
          {loading ? (
            <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500" />
              <p className="text-sm font-semibold text-slate-700">
                {progressText || 'Carregando anúncios do Mercado Livre...'}
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
              <CardContent className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">Nenhum anúncio encontrado</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Tente ajustar ou limpar os filtros de busca aplicados.
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'table' ? (
            /* ==================== MODO TABELA COM EDIÇÃO DIRETA ==================== */
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 select-none">
                    <tr>
                      <th className="py-3 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            selectedItemIds.size === filteredItems.length &&
                            filteredItems.length > 0
                          }
                          onChange={handleSelectAllFiltered}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                      </th>

                      {/* Header Coluna: Anúncio */}
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span>Anúncio</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`p-1 rounded hover:bg-slate-200 transition-colors ${
                                  colSearchTitle.trim()
                                    ? 'text-amber-600 bg-amber-100 font-bold'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                                title="Filtrar por Título ou ID"
                              >
                                <Filter className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 text-xs space-y-2" align="start">
                              <p className="font-bold text-slate-800">Filtrar por Anúncio / SKU</p>
                              <Input
                                placeholder="Digite título, ID MLB ou SKU..."
                                value={colSearchTitle}
                                onChange={(e) => setColSearchTitle(e.target.value)}
                                className="h-8 text-xs"
                                autoFocus
                              />
                              {colSearchTitle && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setColSearchTitle('')}
                                  className="w-full h-7 text-xs text-slate-500 hover:text-slate-800"
                                >
                                  Limpar filtro
                                </Button>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </th>

                      {/* Header Coluna: Status */}
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span>Status</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`p-1 rounded hover:bg-slate-200 transition-colors ${
                                  colFilterStatus !== 'all'
                                    ? 'text-amber-600 bg-amber-100 font-bold'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                                title="Filtrar por Status"
                              >
                                <Filter className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2 text-xs space-y-1" align="start">
                              <p className="font-bold text-slate-800 px-2 py-1">Status no ML</p>
                              <button
                                type="button"
                                onClick={() => setColFilterStatus('all')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterStatus === 'all'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Todos</span>
                                {colFilterStatus === 'all' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterStatus('active')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterStatus === 'active'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  Ativo
                                </span>
                                {colFilterStatus === 'active' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterStatus('paused')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterStatus === 'paused'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  Pausado
                                </span>
                                {colFilterStatus === 'paused' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterStatus('closed')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterStatus === 'closed'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                                  Encerrado
                                </span>
                                {colFilterStatus === 'closed' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </th>

                      {/* Header Coluna: Condição */}
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span>Condição</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`p-1 rounded hover:bg-slate-200 transition-colors ${
                                  colFilterCondition !== 'all'
                                    ? 'text-amber-600 bg-amber-100 font-bold'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                                title="Filtrar por Condição"
                              >
                                <Filter className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2 text-xs space-y-1" align="start">
                              <p className="font-bold text-slate-800 px-2 py-1">Condição do Item</p>
                              <button
                                type="button"
                                onClick={() => setColFilterCondition('all')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterCondition === 'all'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Todas</span>
                                {colFilterCondition === 'all' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterCondition('refurbished')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterCondition === 'refurbished'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Recondicionado</span>
                                {colFilterCondition === 'refurbished' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterCondition('new')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterCondition === 'new'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Novo</span>
                                {colFilterCondition === 'new' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterCondition('used')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterCondition === 'used'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Usado</span>
                                {colFilterCondition === 'used' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </th>

                      {/* Header Coluna: Preço / Tipo */}
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span>Preço ML</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`p-1 rounded hover:bg-slate-200 transition-colors ${
                                  colFilterListingType !== 'all'
                                    ? 'text-amber-600 bg-amber-100 font-bold'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                                title="Filtrar por Tipo de Anúncio"
                              >
                                <Filter className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2 text-xs space-y-1" align="start">
                              <p className="font-bold text-slate-800 px-2 py-1">Tipo de Anúncio</p>
                              <button
                                type="button"
                                onClick={() => setColFilterListingType('all')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterListingType === 'all'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Todos os tipos</span>
                                {colFilterListingType === 'all' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterListingType('gold_special')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterListingType === 'gold_special'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Clássico (gold_special)</span>
                                {colFilterListingType === 'gold_special' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterListingType('gold_pro')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterListingType === 'gold_pro'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Premium (gold_pro)</span>
                                {colFilterListingType === 'gold_pro' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </th>

                      {/* Header Coluna: Estoque */}
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span>Estoque ML</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`p-1 rounded hover:bg-slate-200 transition-colors ${
                                  colFilterStock !== 'all'
                                    ? 'text-amber-600 bg-amber-100 font-bold'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                                title="Filtrar por Disponibilidade"
                              >
                                <Filter className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2 text-xs space-y-1" align="start">
                              <p className="font-bold text-slate-800 px-2 py-1">Disponibilidade</p>
                              <button
                                type="button"
                                onClick={() => setColFilterStock('all')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterStock === 'all'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Todos</span>
                                {colFilterStock === 'all' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterStock('in_stock')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterStock === 'in_stock'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span className="text-emerald-700 font-semibold">
                                  Com estoque (&gt; 0)
                                </span>
                                {colFilterStock === 'in_stock' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterStock('zero_stock')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterStock === 'zero_stock'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span className="text-slate-500">Sem estoque (0)</span>
                                {colFilterStock === 'zero_stock' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </th>

                      {/* Header Coluna: Vínculo */}
                      <th className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span>Vínculo Catálogo</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`p-1 rounded hover:bg-slate-200 transition-colors ${
                                  colFilterVinculo !== 'all'
                                    ? 'text-amber-600 bg-amber-100 font-bold'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                                title="Filtrar por Vínculo / Catálogo"
                              >
                                <Filter className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2 text-xs space-y-1" align="start">
                              <p className="font-bold text-slate-800 px-2 py-1">
                                Vínculo Local & Catálogo
                              </p>
                              <button
                                type="button"
                                onClick={() => setColFilterVinculo('all')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterVinculo === 'all'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Todos</span>
                                {colFilterVinculo === 'all' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterVinculo('matched')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterVinculo === 'matched'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span className="text-emerald-700 font-semibold">
                                  Vinculado ao Estoque
                                </span>
                                {colFilterVinculo === 'matched' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterVinculo('unmatched')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterVinculo === 'unmatched'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span>Sem vínculo local</span>
                                {colFilterVinculo === 'unmatched' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterVinculo('catalog')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterVinculo === 'catalog'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span className="text-blue-700 font-semibold">
                                  Anúncio de Catálogo ML
                                </span>
                                {colFilterVinculo === 'catalog' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setColFilterVinculo('variations')}
                                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between hover:bg-slate-100 ${
                                  colFilterVinculo === 'variations'
                                    ? 'bg-amber-50 font-bold text-amber-900'
                                    : 'text-slate-700'
                                }`}
                              >
                                <span className="text-indigo-700 font-semibold">
                                  Com Variações ML
                                </span>
                                {colFilterVinculo === 'variations' && (
                                  <Check className="w-3.5 h-3.5 text-amber-600" />
                                )}
                              </button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </th>

                      <th className="py-3 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item) => {
                      const isSelected = selectedItemIds.has(item.id)
                      const isEditingPrice = editingPriceId === item.id
                      const isSavingPrice = savingPriceId === item.id
                      const isEditingStock = editingStockId === item.id
                      const isSavingStock = savingStockId === item.id
                      const isToggling = togglingStatusId === item.id

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(item.id)}
                              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            />
                          </td>

                          {/* Anúncio & Foto */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3 max-w-[340px]">
                              <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                                {item.thumbnail ? (
                                  <img
                                    src={item.thumbnail}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ShoppingBag className="w-5 h-5 text-slate-300" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p
                                  className="font-semibold text-slate-900 truncate"
                                  title={item.title}
                                >
                                  {item.title}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5 flex-wrap">
                                  <span>{item.id}</span>
                                  {renderCatalogAdIndicator(item)}
                                  {renderSoldBadge(item.sold_quantity)}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {renderStatusBadge(item.status)}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(item)}
                                disabled={isToggling}
                                className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-slate-900"
                                title={
                                  item.status === 'active' ? 'Pausar Anúncio' : 'Reativar Anúncio'
                                }
                              >
                                {isToggling ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : item.status === 'active' ? (
                                  <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                              </Button>
                            </div>
                          </td>

                          {/* Condição */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {renderConditionBadge(item)}
                          </td>

                          {/* Preço (Edição Direta para Tradicionais ou Bloqueio com Aviso para Catálogo Unificado) */}
                          <td className="py-3 px-3 whitespace-nowrap font-mono">
                            {(() => {
                              const isCatalog = isItemCatalog(item)
                              const effectivePrice = getItemEffectivePrice(item)
                              const compMatch = getBestCompetitorMatch(item)

                              if (isCatalog) {
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <div
                                      className="inline-flex items-center gap-1.5 py-1 px-1.5 rounded bg-blue-50/50 border border-blue-200/60 cursor-not-allowed select-none"
                                      title="Este anúncio é de Catálogo Unificado — edite o preço pelo painel do ML ou Ideris. O sistema sincroniza o valor na próxima coleta."
                                    >
                                      <span className="font-bold text-slate-700 text-xs">
                                        {Number(item.price || 0).toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: item.currency_id || 'BRL',
                                        })}
                                      </span>
                                      <Lock className="w-3 h-3 text-blue-600 shrink-0" />
                                    </div>

                                    {/* Tooltip/Popover informativo de Catálogo */}
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-100 transition-colors"
                                          title="Por que o preço não é editável aqui?"
                                          aria-label="Aviso de Catálogo Unificado"
                                        >
                                          <HelpCircle className="w-3.5 h-3.5" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        side="top"
                                        align="start"
                                        sideOffset={6}
                                        className="w-72 p-3 text-xs bg-slate-900 text-slate-100 shadow-xl border-slate-800 z-50 rounded-lg space-y-1.5"
                                      >
                                        <p className="font-bold text-amber-400 flex items-center gap-1.5">
                                          <Lock className="w-3.5 h-3.5" /> Catálogo Unificado
                                        </p>
                                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                                          Este anúncio é de Catálogo Unificado — edite o preço pelo
                                          painel do ML ou Ideris. O sistema sincroniza o valor na
                                          próxima coleta.
                                        </p>
                                      </PopoverContent>
                                    </Popover>

                                    {/* Calculadora de Viabilidade */}
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                          title={`Calculadora de Viabilidade (teto de compra para venda de ${effectivePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`}
                                          aria-label={`Abrir calculadora de viabilidade para anúncio ${item.id}`}
                                        >
                                          <Calculator className="w-3.5 h-3.5" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        side="right"
                                        align="start"
                                        sideOffset={8}
                                        className="w-[360px] sm:w-[420px] p-2.5 shadow-xl border-blue-200 z-50"
                                      >
                                        <CalculadoraViabilidade
                                          isPopover
                                          currentPrice={effectivePrice}
                                          buyBoxLeaderPrice={compMatch?.current_price || null}
                                          leaderName={compMatch?.seller_nickname || null}
                                          suggestedShipping={19.0}
                                          itemTitle={item.title}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                )
                              }

                              if (isEditingPrice) {
                                return (
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-400 text-xs">R$</span>
                                    <Input
                                      type="text"
                                      value={editingPriceVal}
                                      onChange={(e) => setEditingPriceVal(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSavePrice(item)
                                        if (e.key === 'Escape') setEditingPriceId(null)
                                      }}
                                      className="w-24 h-7 text-xs font-bold font-mono px-1.5 py-0"
                                      autoFocus
                                      disabled={isSavingPrice}
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => handleSavePrice(item)}
                                      disabled={isSavingPrice}
                                      className="h-7 w-7 p-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                                      title="Confirmar Preço"
                                    >
                                      {isSavingPrice ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Check className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingPriceId(null)}
                                      className="h-7 w-7 p-0 text-slate-400"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )
                              }

                              return (
                                <div className="flex items-center gap-1.5">
                                  <div
                                    onClick={() => {
                                      setEditingPriceId(item.id)
                                      setEditingPriceVal(Number(item.price || 0).toFixed(2))
                                    }}
                                    className="group inline-flex items-center gap-1.5 cursor-pointer py-1 px-1.5 rounded hover:bg-slate-100"
                                    title="Clique para editar o preço diretamente"
                                  >
                                    <span className="font-black text-slate-900 text-xs">
                                      {Number(item.price || 0).toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: item.currency_id || 'BRL',
                                      })}
                                    </span>
                                    <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-amber-600 transition-colors" />
                                  </div>

                                  {/* Popover da Calculadora de Viabilidade - Sem poluir a tabela */}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                        title={`Calculadora de Viabilidade (teto de compra para venda de ${effectivePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`}
                                        aria-label={`Abrir calculadora de viabilidade para anúncio ${item.id}`}
                                      >
                                        <Calculator className="w-3.5 h-3.5" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      side="right"
                                      align="start"
                                      sideOffset={8}
                                      className="w-[360px] sm:w-[420px] p-2.5 shadow-xl border-blue-200 z-50"
                                    >
                                      <CalculadoraViabilidade
                                        isPopover
                                        currentPrice={effectivePrice}
                                        buyBoxLeaderPrice={compMatch?.current_price || null}
                                        leaderName={compMatch?.seller_nickname || null}
                                        suggestedShipping={19.0}
                                        itemTitle={item.title}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              )
                            })()}
                          </td>

                          {/* Estoque (Edição Direta) */}
                          <td className="py-3 px-3 whitespace-nowrap font-mono">
                            {isEditingStock ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  value={editingStockVal}
                                  onChange={(e) => setEditingStockVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveStock(item)
                                    if (e.key === 'Escape') setEditingStockId(null)
                                  }}
                                  className="w-16 h-7 text-xs font-bold font-mono px-1.5 py-0"
                                  autoFocus
                                  disabled={isSavingStock}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveStock(item)}
                                  disabled={isSavingStock}
                                  className="h-7 w-7 p-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  title="Confirmar Estoque"
                                >
                                  {isSavingStock ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingStockId(null)}
                                  className="h-7 w-7 p-0 text-slate-400"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingStockId(item.id)
                                  setEditingStockVal(String(item.available_quantity ?? 1))
                                }}
                                className="group inline-flex items-center gap-1.5 cursor-pointer py-1 px-1.5 rounded hover:bg-slate-100"
                                title="Clique para editar a quantidade disponível no anúncio"
                              >
                                <span className="font-bold text-slate-800 text-xs">
                                  {item.available_quantity} un
                                </span>
                                <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-amber-600 transition-colors" />
                              </div>
                            )}
                          </td>

                          {/* Vínculo Catálogo & Configurações */}
                          <td className="py-3 px-3">
                            <MLItemMatchedProductsDisplay
                              item={item}
                              variant="table"
                              maxVisible={2}
                              onConfirmLink={handleConfirmLink}
                              onUnlink={handleUnlink}
                              onOpenManualSelector={handleOpenManualSelector}
                            />
                          </td>

                          {/* Link ML */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {getAdMLUrl(item) ? (
                              <a
                                href={getAdMLUrl(item)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir anúncio no Mercado Livre em nova aba"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:text-blue-900 rounded-md transition-colors"
                              >
                                <span>Ver no ML</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ==================== MODO GRID / CARDS ==================== */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const isCatalog = isItemCatalog(item)
                return (
                  <Card
                    key={item.id}
                    className={`border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden bg-white ${
                      isCatalog ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="p-4 flex gap-3.5 border-b border-slate-100">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center relative">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ShoppingBag className="w-8 h-8 text-slate-300" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              {renderStatusBadge(item.status)}
                              {renderCatalogAdIndicator(item)}
                              {renderConditionBadge(item)}
                              {renderSoldBadge(item.sold_quantity)}
                            </div>
                            <h3
                              className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug"
                              title={item.title}
                            >
                              {item.title}
                            </h3>
                          </div>

                          <div className="flex items-baseline justify-between mt-2 pt-1 font-mono">
                            <span className="text-base font-black text-slate-900">
                              {Number(item.price || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: item.currency_id || 'BRL',
                              })}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Estoque: <strong>{item.available_quantity}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50/60 text-[11px] space-y-2 border-b border-slate-100">
                        <div className="flex items-center justify-between text-slate-600 font-mono">
                          <span className="text-slate-400 uppercase text-[10px] font-sans font-bold">
                            ID Anúncio:
                          </span>
                          <span className="font-bold text-slate-800">{item.id}</span>
                        </div>

                        {/* Produtos Internos Vinculados com Configurações */}
                        <MLItemMatchedProductsDisplay
                          item={item}
                          variant="card"
                          maxVisible={2}
                          onConfirmLink={handleConfirmLink}
                          onUnlink={handleUnlink}
                          onOpenManualSelector={handleOpenManualSelector}
                        />
                      </div>
                    </div>

                    {/* Bloco recolhido da Calculadora de Viabilidade no rodapé do Card (igual ao Explorador) */}
                    <div className="px-3 pb-3 bg-white">
                      {(() => {
                        const effectivePrice = getItemEffectivePrice(item)
                        const compMatch = getBestCompetitorMatch(item)
                        const isExpanded = expandedCardViabilityId === item.id
                        return (
                          <CalculadoraViabilidade
                            currentPrice={effectivePrice}
                            buyBoxLeaderPrice={compMatch?.current_price || null}
                            leaderName={compMatch?.seller_nickname || null}
                            suggestedShipping={19.0}
                            isOpen={isExpanded}
                            onToggle={() =>
                              setExpandedCardViabilityId((prev) =>
                                prev === item.id ? null : item.id,
                              )
                            }
                            itemTitle={item.title}
                          />
                        )
                      })()}
                    </div>

                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(item)}
                        className="text-xs h-7 px-2 border-slate-300"
                      >
                        {item.status === 'active' ? 'Pausar' : 'Reativar'}
                      </Button>
                      {getAdMLUrl(item) && (
                        <a
                          href={getAdMLUrl(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir anúncio no Mercado Livre em nova aba"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:text-blue-900 rounded-md transition-colors"
                        >
                          <span>Abrir no ML</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ==================== ABA: CENTRAL DE PERGUNTAS ML ==================== */}
        <TabsContent value="perguntas" className="space-y-6 focus-visible:outline-hidden">
          <MLQuestionsTab key={currentTenant?.id || 'master'} />
        </TabsContent>

        {/* ==================== ABA 2: ENVIOS & PRAZOS (DESPACHO E REPUTAÇÃO) ==================== */}
        <TabsContent value="envios" className="space-y-6 focus-visible:outline-hidden">
          <MLDeadlinesTab key={currentTenant?.id || 'master'} />
        </TabsContent>

        {/* ==================== ABA 3: PAINEL DE VENDAS & PEDIDOS ML ==================== */}
        <TabsContent value="pedidos" className="space-y-6 focus-visible:outline-hidden">
          <MLOrdersTab key={currentTenant?.id || 'master'} />
        </TabsContent>

        {/* ==================== ABA: MONITOR DE SELLERS & PARCEIROS ==================== */}
        <TabsContent value="sellers" className="space-y-6 focus-visible:outline-hidden">
          <MLSellersMonitorTab key={currentTenant?.id || 'master'} />
        </TabsContent>

        {/* ==================== ABA 4: FILA DE PUBLICAÇÃO & ERROS ==================== */}
        <TabsContent value="erros_publicacao" className="space-y-6 focus-visible:outline-hidden">
          <MLPublishQueueTab key={currentTenant?.id || 'master'} />
        </TabsContent>
      </Tabs>

      {/* Modal de Reprecificação em Massa */}
      <MLBulkPriceModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        selectedItems={selectedItemsList}
        onSuccess={() => {
          setSelectedItemIds(new Set())
          fetchItems(false)
        }}
      />

      {/* Mini-seletor manual de produtos */}
      <MLManualProductSelectorModal
        open={manualSelectorOpen}
        onOpenChange={setManualSelectorOpen}
        item={selectedAdForManualLink}
        onSelectProduct={async (productId, mlItemId) => {
          await handleConfirmLink(productId, mlItemId)
          await fetchItems(false)
        }}
      />
    </div>
  )
}
