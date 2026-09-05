import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Radar,
  RefreshCw,
  Search,
  Plus,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  UserCheck,
  ShoppingBag,
  Clock,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  PackageCheck,
  Layers,
  History,
  Activity,
  Tag,
  Trash2,
  CheckCircle2,
  PauseCircle,
  XCircle,
  BarChart3,
  Flame,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  mlCompetitorService,
  type MLCompetitor,
  type MLCompetitorAd,
  type MLCompetitorEvent,
  type MLPriceSnapshot,
} from '@/services/mlCompetitorService'

export default function RadarML() {
  const { toast } = useToast()

  // Estados principais
  const [loading, setLoading] = useState(true)
  const [syncingAll, setSyncingAll] = useState(false)
  const [competitors, setCompetitors] = useState<MLCompetitor[]>([])
  const [ads, setAds] = useState<MLCompetitorAd[]>([])
  const [events, setEvents] = useState<MLCompetitorEvent[]>([])
  const [productsCatalog, setProductsCatalog] = useState<any[]>([])

  // Filtros da UI
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('all')
  const [selectedEventType, setSelectedEventType] = useState<string>('all')
  const [searchAdQuery, setSearchAdQuery] = useState('')
  const [expandedCompetitors, setExpandedCompetitors] = useState<Record<string, boolean>>({})

  // Modal Novo Concorrente
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addTabMode, setAddTabMode] = useState<'link' | 'search' | 'seller_id'>('link')
  const [linksInput, setLinksInput] = useState('')
  const [linkNickname, setLinkNickname] = useState('')
  const [addingFromLink, setAddingFromLink] = useState(false)
  const [searchCompetitorTerm, setSearchCompetitorTerm] = useState('')
  const [searchingCompetitor, setSearchingCompetitor] = useState(false)
  const [searchWarning, setSearchWarning] = useState<string | null>(null)
  const [foundSellers, setFoundSellers] = useState<any[]>([])
  const [customSellerId, setCustomSellerId] = useState('')
  const [customNickname, setCustomNickname] = useState('')
  const [customNotes, setCustomNotes] = useState('')
  const [addingLoading, setAddingLoading] = useState(false)

  // Modal Histórico de Preços
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedAdForHistory, setSelectedAdForHistory] = useState<MLCompetitorAd | null>(null)
  const [priceHistory, setPriceHistory] = useState<MLPriceSnapshot[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Carregar dados iniciais
  const loadData = async (showToast = false) => {
    setLoading(true)
    try {
      const [compsData, adsData, eventsData, prodsData] = await Promise.all([
        mlCompetitorService.getCompetitors(),
        mlCompetitorService.getCompetitorAds(),
        mlCompetitorService.getEvents(120),
        pb.collection('products').getFullList({
          fields: 'id,name,sku,model,brand,unit_price,status',
        }),
      ])

      setCompetitors(compsData)
      setAds(adsData)
      setEvents(eventsData)
      setProductsCatalog(prodsData)

      if (showToast) {
        toast({
          title: 'Dados sincronizados',
          description: `${compsData.length} concorrentes e ${adsData.length} anúncios monitorados.`,
        })
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do Radar ML:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: err.message || 'Falha ao buscar dados de concorrência.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(false)
  }, [])

  // Sincronizar todos agora via job assíncrono
  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      toast({
        title: 'Atualização iniciada',
        description: 'Varrendo anúncios dos concorrentes no Mercado Livre via fila assíncrona...',
      })

      const job = await mlCompetitorService.dispatchJobAndWait('sync_all', {})
      const res = job.result_data || {}
      toast({
        title: 'Radar atualizado com sucesso!',
        description: `${res.ads_processed || 0} anúncios processados, ${res.events_created || 0} evento(s) detectado(s).`,
      })
      await loadData(false)
    } catch (err: any) {
      toast({
        title: 'Erro na atualização',
        description: err.message || 'Não foi possível completar a varredura.',
        variant: 'destructive',
      })
    } finally {
      setSyncingAll(false)
    }
  }

  // Sincronizar um concorrente específico
  const handleSyncSingle = async (competitor: MLCompetitor) => {
    try {
      toast({
        title: `Atualizando ${competitor.nickname}...`,
        description: 'Consultando anúncios recentes no Mercado Livre...',
      })
      await mlCompetitorService.dispatchJobAndWait('sync_competitor', {
        seller_id: competitor.seller_id,
        seller_nickname: competitor.nickname,
      })
      toast({
        title: 'Concorrente atualizado!',
        description: `Os anúncios de ${competitor.nickname} foram sincronizados.`,
      })
      await loadData(false)
    } catch (err: any) {
      toast({
        title: 'Falha ao sincronizar concorrente',
        description: err.message || 'Erro durante a consulta.',
        variant: 'destructive',
      })
    }
  }

  // Adicionar concorrente via Link ou Código MLB
  const handleAddFromLinks = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!linksInput.trim()) {
      toast({
        title: 'Informe ao menos um link ou código MLB',
        description: 'Exemplo: https://produto.mercadolivre.com.br/MLB-1234567890 ou MLB1234567890',
        variant: 'destructive',
      })
      return
    }

    setAddingFromLink(true)
    try {
      toast({
        title: 'Consultando anúncio no Mercado Livre...',
        description: 'Buscando dados em tempo real via API oficial...',
      })

      const job = await mlCompetitorService.resolveFromItems(linksInput, linkNickname)
      const res = job.result_data || {}

      toast({
        title: 'Concorrente e anúncio adicionados!',
        description: `${res.seller_nickname || 'Vendedor'} adicionado com ${res.ads_added_or_updated || 1} anúncio(s) monitorado(s).`,
      })

      setLinksInput('')
      setLinkNickname('')
      setAddModalOpen(false)
      await loadData(false)
    } catch (err: any) {
      toast({
        title: 'Não foi possível adicionar concorrente',
        description: err.message || 'Falha ao consultar anúncio no Mercado Livre.',
        variant: 'destructive',
      })
    } finally {
      setAddingFromLink(false)
    }
  }

  // Resolver e buscar concorrentes no ML pelo termo de busca
  const handleSearchCompetitors = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchCompetitorTerm.trim()) return

    setSearchingCompetitor(true)
    setFoundSellers([])
    setSearchWarning(null)
    try {
      const job = await mlCompetitorService.dispatchJobAndWait('resolve_competitor', {
        query: searchCompetitorTerm.trim(),
      })
      const sellers = job.result_data?.sellers || []
      setFoundSellers(sellers)
      if (sellers.length === 0) {
        toast({
          title: 'Nenhum concorrente identificado',
          description:
            'Tente refinar o termo de busca (ex: "ThinkPad T480" ou nome exato da loja).',
        })
      }
    } catch (err: any) {
      const msg = err.message || ''
      setSearchWarning(
        'A API do Mercado Livre restringiu a busca pública por nome de vendedor. Monitore concorrentes colando o link do anúncio deles (funciona 100%).',
      )
      toast({
        title: 'Busca textual restrita pela API',
        description:
          'O Mercado Livre bloqueou buscas gerais. Utilize a aba "Por Link do Anúncio (Recomendado)".',
        variant: 'destructive',
      })
    } finally {
      setSearchingCompetitor(false)
    }
  }

  // Salvar concorrente selecionado ou manual
  const handleSaveCompetitor = async (sellerId: string, nickname: string, permalink?: string) => {
    setAddingLoading(true)
    try {
      const created = await mlCompetitorService.addCompetitor({
        seller_id: sellerId,
        nickname: nickname || `Vendedor ${sellerId}`,
        notes: customNotes,
        permalink,
      })

      toast({
        title: 'Concorrente adicionado!',
        description: `${created.nickname} agora faz parte do Radar. Coletando anúncios...`,
      })

      setAddModalOpen(false)
      setCustomSellerId('')
      setCustomNickname('')
      setCustomNotes('')
      setFoundSellers([])
      setSearchCompetitorTerm('')

      // Já dispara a primeira coleta imediata desse concorrente
      mlCompetitorService
        .dispatchJobAndWait('sync_competitor', {
          seller_id: created.seller_id,
          seller_nickname: created.nickname,
        })
        .then(() => loadData(false))
        .catch((e) => console.warn('Erro na primeira coleta:', e))

      await loadData(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar concorrente',
        description: err.message || 'Falha ao salvar no banco.',
        variant: 'destructive',
      })
    } finally {
      setAddingLoading(false)
    }
  }

  // Deletar concorrente
  const handleDeleteCompetitor = async (comp: MLCompetitor) => {
    if (!window.confirm(`Deseja parar de monitorar "${comp.nickname}"?`)) return
    try {
      await mlCompetitorService.deleteCompetitor(comp.id)
      toast({
        title: 'Concorrente removido',
        description: `${comp.nickname} foi excluído do Radar.`,
      })
      await loadData(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Abrir histórico de preços
  const handleOpenHistory = async (ad: MLCompetitorAd) => {
    setSelectedAdForHistory(ad)
    setHistoryModalOpen(true)
    setLoadingHistory(true)
    try {
      const history = await mlCompetitorService.getPriceHistory(ad.mlb_item_id)
      setPriceHistory(history)
    } catch (err: any) {
      toast({
        title: 'Erro ao buscar histórico',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoadingHistory(false)
    }
  }

  // Cruzamento dos anúncios com o catálogo local
  const enrichedAds = useMemo(() => {
    return ads.map((ad) => {
      const matched = mlCompetitorService.matchAdWithLocalCatalog(ad.title, productsCatalog)
      if (matched) {
        const diffPercent =
          matched.unit_price && ad.current_price
            ? ((matched.unit_price - ad.current_price) / ad.current_price) * 100
            : 0
        return {
          ...ad,
          matchedProduct: {
            ...matched,
            diff_percent: Math.round(diffPercent * 10) / 10,
          },
        }
      }
      return ad
    })
  }, [ads, productsCatalog])

  // KPIs
  const stats = useMemo(() => {
    const totalCompetitors = competitors.length
    const activeCompetitors = competitors.filter((c) => c.active).length
    const totalAds = ads.length
    const activeAds = ads.filter((a) => a.status === 'active').length

    // Mudanças nas últimas 24h e 7d
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

    const changes24h = events.filter((e) => new Date(e.created).getTime() >= oneDayAgo).length
    const changes7d = events.filter((e) => new Date(e.created).getTime() >= sevenDaysAgo).length

    // Preço médio concorrentes vs nosso preço médio
    const adsWithPrice = ads.filter((a) => a.current_price > 0)
    const avgCompetitorPrice =
      adsWithPrice.length > 0
        ? adsWithPrice.reduce((acc, a) => acc + a.current_price, 0) / adsWithPrice.length
        : 0

    const prodsWithPrice = productsCatalog.filter((p) => Number(p.unit_price) > 0)
    const avgOurPrice =
      prodsWithPrice.length > 0
        ? prodsWithPrice.reduce((acc, p) => acc + Number(p.unit_price), 0) / prodsWithPrice.length
        : 0

    return {
      totalCompetitors,
      activeCompetitors,
      totalAds,
      activeAds,
      changes24h,
      changes7d,
      avgCompetitorPrice,
      avgOurPrice,
    }
  }, [competitors, ads, events, productsCatalog])

  // Filtragem dos anúncios
  const filteredAds = useMemo(() => {
    return enrichedAds.filter((ad) => {
      if (selectedCompetitorId !== 'all' && ad.seller_id !== selectedCompetitorId) {
        return false
      }
      if (searchAdQuery.trim()) {
        const q = searchAdQuery.toLowerCase()
        const matchesTitle = ad.title?.toLowerCase().includes(q)
        const matchesMlb = ad.mlb_item_id?.toLowerCase().includes(q)
        const matchesBrand = ad.brand?.toLowerCase().includes(q)
        const matchesModel = ad.model?.toLowerCase().includes(q)
        const matchesSeller = ad.seller_nickname?.toLowerCase().includes(q)
        const matchesMatch = ad.matchedProduct?.name?.toLowerCase().includes(q)
        if (
          !matchesTitle &&
          !matchesMlb &&
          !matchesBrand &&
          !matchesModel &&
          !matchesSeller &&
          !matchesMatch
        ) {
          return false
        }
      }
      return true
    })
  }, [enrichedAds, selectedCompetitorId, searchAdQuery])

  // Filtragem dos eventos
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedCompetitorId !== 'all' && ev.seller_id !== selectedCompetitorId) {
        return false
      }
      if (selectedEventType !== 'all' && ev.event_type !== selectedEventType) {
        return false
      }
      return true
    })
  }, [events, selectedCompetitorId, selectedEventType])

  const toggleExpandCompetitor = (sellerId: string) => {
    setExpandedCompetitors((prev) => ({
      ...prev,
      [sellerId]: !prev[sellerId],
    }))
  }

  // Badges auxiliares
  const renderEventTypeBadge = (type: string) => {
    switch (type) {
      case 'price_change':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 gap-1 text-[11px] font-semibold">
            <Tag className="w-3 h-3 text-amber-700" />
            Mudança de Preço
          </Badge>
        )
      case 'sold_progress':
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 gap-1 text-[11px] font-semibold">
            <Flame className="w-3 h-3 text-emerald-700" />
            Nova Venda
          </Badge>
        )
      case 'new_ad':
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 gap-1 text-[11px] font-semibold">
            <Sparkles className="w-3 h-3 text-blue-700" />
            Novo Anúncio
          </Badge>
        )
      case 'ad_paused':
        return (
          <Badge className="bg-orange-100 text-orange-900 border-orange-300 gap-1 text-[11px] font-semibold">
            <PauseCircle className="w-3 h-3 text-orange-700" />
            Pausado
          </Badge>
        )
      case 'ad_closed':
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-300 gap-1 text-[11px] font-semibold">
            <XCircle className="w-3 h-3 text-slate-600" />
            Encerrado
          </Badge>
        )
      case 'stock_change':
        return (
          <Badge className="bg-purple-100 text-purple-900 border-purple-300 gap-1 text-[11px] font-semibold">
            <Layers className="w-3 h-3 text-purple-700" />
            Estoque
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-slate-700 text-[11px]">
            {type}
          </Badge>
        )
    }
  }

  const formatRelativeTime = (isoDate: string) => {
    if (!isoDate) return ''
    const diffMs = Date.now() - new Date(isoDate).getTime()
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'agora mesmo'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `há ${diffMin} min`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `há ${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'ontem'
    return `há ${diffDays} dias`
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-xs text-white">
              <Radar className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Radar de Concorrência ML
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-semibold gap-1"
                >
                  <Activity className="w-3 h-3 text-emerald-600" />
                  Monitoramento Ativo
                </Badge>
              </h1>
              <p className="text-xs text-slate-500">
                Acompanhe em tempo real os anúncios, movimentação de preços e vendas dos
                concorrentes no Mercado Livre.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncingAll || loading}
            className="text-xs h-9 bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin text-orange-600' : ''}`}
            />
            {syncingAll ? 'Atualizando...' : 'Atualizar Agora'}
          </Button>

          {/* Modal Adicionar Concorrente */}
          <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="text-xs h-9 bg-[#d9532f] hover:bg-[#c24624] text-white gap-1.5 font-medium shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Concorrente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-900">
                  <Radar className="w-5 h-5 text-orange-600" />
                  Cadastrar Concorrente no Radar
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Adicione concorrentes colando links de anúncios do Mercado Livre para
                  monitoramento contínuo de preços e vendas.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Abas internas do Modal */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAddTabMode('link')}
                    className={`text-xs py-1.5 px-2 rounded-md font-medium transition-all ${
                      addTabMode === 'link'
                        ? 'bg-white shadow-xs text-orange-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Por Link do Anúncio ★
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTabMode('seller_id')}
                    className={`text-xs py-1.5 px-2 rounded-md font-medium transition-all ${
                      addTabMode === 'seller_id'
                        ? 'bg-white shadow-xs text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Por Seller ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTabMode('search')}
                    className={`text-xs py-1.5 px-2 rounded-md font-medium transition-all ${
                      addTabMode === 'search'
                        ? 'bg-white shadow-xs text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Busca Textual
                  </button>
                </div>

                {/* ABA 1: POR LINK DO ANÚNCIO (FLUXO PRINCIPAL RECOMENDADO) */}
                {addTabMode === 'link' && (
                  <form onSubmit={handleAddFromLinks} className="space-y-3.5">
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-emerald-900">
                          Método 100% confiável via API Oficial do Mercado Livre
                        </p>
                        <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                          Cole o link ou código do anúncio do concorrente. Ex:{' '}
                          <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">
                            https://produto.mercadolivre.com.br/MLB-1234567890
                          </code>{' '}
                          ou{' '}
                          <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">
                            MLB1234567890
                          </code>
                          . Para monitorar mais anúncios do mesmo vendedor, cole vários de uma vez
                          (um por linha).
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>Links ou Códigos MLB dos Anúncios *</span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          Suporta múltiplos links
                        </span>
                      </label>
                      <textarea
                        rows={4}
                        placeholder={`Cole aqui os links ou códigos MLB:\nhttps://produto.mercadolivre.com.br/MLB-1234567890\nhttps://www.mercadolivre.com.br/...-MLB-9876543210\nMLB5544332211`}
                        value={linksInput}
                        onChange={(e) => setLinksInput(e.target.value)}
                        className="w-full text-xs font-mono p-2.5 rounded-md border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 leading-relaxed"
                        disabled={addingFromLink}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Apelido / Nome do Concorrente (Opcional)
                      </label>
                      <Input
                        placeholder="Ex: Concorrente Alpha (deixe em branco para preencher automaticamente com o nome da loja)"
                        value={linkNickname}
                        onChange={(e) => setLinkNickname(e.target.value)}
                        className="text-xs h-8"
                        disabled={addingFromLink}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={addingFromLink || !linksInput.trim()}
                      className="w-full text-xs h-9 bg-orange-600 hover:bg-orange-700 text-white font-semibold gap-1.5 shadow-xs"
                    >
                      {addingFromLink ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                          Consultando Anúncio no Mercado Livre...
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar Anúncio(s) e Iniciar Monitoramento
                        </>
                      )}
                    </Button>
                  </form>
                )}

                {/* ABA 2: POR SELLER ID MANUAL */}
                {addTabMode === 'seller_id' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      Se você já tem o Seller ID numérico do Mercado Livre, cadastre-o diretamente.
                      Depois cole links de anúncios dele para monitorar.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Seller ID (Numérico) *
                        </label>
                        <Input
                          placeholder="Ex: 626774396"
                          value={customSellerId}
                          onChange={(e) => setCustomSellerId(e.target.value)}
                          className="text-xs h-8 mt-1 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Nome / Apelido
                        </label>
                        <Input
                          placeholder="Ex: Concorrente Alpha"
                          value={customNickname}
                          onChange={(e) => setCustomNickname(e.target.value)}
                          className="text-xs h-8 mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">
                        Observações / Estratégia
                      </label>
                      <Input
                        placeholder="Ex: Especializado em notebooks corporativos..."
                        value={customNotes}
                        onChange={(e) => setCustomNotes(e.target.value)}
                        className="text-xs h-8 mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSaveCompetitor(customSellerId, customNickname)}
                      disabled={addingLoading || !customSellerId.trim()}
                      className="w-full text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white font-medium"
                    >
                      Salvar Concorrente
                    </Button>
                  </div>
                )}

                {/* ABA 3: BUSCA TEXTUAL (COM ALERTA SOBRE RESTRIÇÃO DA API) */}
                {addTabMode === 'search' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Aviso sobre busca textual:</span>
                        <p className="mt-0.5 leading-relaxed text-[11px]">
                          A API do Mercado Livre restringiu a busca pública por termos e vendedores
                          (HTTP 403). Para ter 100% de sucesso, use a aba{' '}
                          <strong>"Por Link do Anúncio"</strong>.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSearchCompetitors} className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          placeholder="Ex: ThinkPad T480, Dell Latitude..."
                          value={searchCompetitorTerm}
                          onChange={(e) => setSearchCompetitorTerm(e.target.value)}
                          className="pl-9 text-xs h-9"
                        />
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={searchingCompetitor || !searchCompetitorTerm.trim()}
                        className="text-xs h-9 bg-slate-900 hover:bg-slate-800 text-white"
                      >
                        {searchingCompetitor ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <Search className="w-3.5 h-3.5 mr-1" />
                        )}
                        Buscar
                      </Button>
                    </form>

                    {searchWarning && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold">Busca restrita pelo Mercado Livre</p>
                          <p className="mt-0.5 text-[11px]">{searchWarning}</p>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setAddTabMode('link')}
                            className="mt-2 text-[11px] h-7 bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            Ir para aba Por Link do Anúncio →
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Vendedores Encontrados caso API retorne */}
                    {foundSellers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700">
                          Vendedores identificados ({foundSellers.length}):
                        </p>
                        <div className="max-h-52 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
                          {foundSellers.map((s) => (
                            <div
                              key={s.seller_id}
                              className="p-2.5 bg-white rounded-md border border-slate-200 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                  {s.nickname || `Vendedor ${s.seller_id}`}
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1 py-0 font-mono text-slate-500"
                                  >
                                    ID: {s.seller_id}
                                  </Badge>
                                </div>
                                {s.sample_ad_title && (
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    Anúncio: {s.sample_ad_title} (
                                    {Number(s.sample_ad_price || 0).toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                    )
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleSaveCompetitor(s.seller_id, s.nickname, s.permalink)
                                }
                                disabled={addingLoading}
                                className="text-xs h-8 bg-orange-600 hover:bg-orange-700 text-white shrink-0"
                              >
                                + Monitorar
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Box Informativo / Guia */}
      <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-xl flex items-center gap-3 text-xs text-orange-950">
        <Info className="w-4 h-4 text-orange-600 shrink-0" />
        <p className="leading-relaxed">
          <strong>Inspirado no radar da ferramenta Ideris:</strong> O sistema monitora
          automaticamente os concorrentes cadastrados a cada 4 horas (via cron periódico). Sempre
          que um concorrente alterar preços, fizer novas vendas ou criar novos anúncios, um evento é
          registrado no feed.
        </p>
      </div>

      {/* Cards de KPIs Principais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block flex items-center justify-between">
              Concorrentes
              <UserCheck className="w-4 h-4 text-orange-600" />
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {stats.totalCompetitors}
              </span>
              <span className="text-xs text-emerald-700 font-semibold">
                ({stats.activeCompetitors} ativos)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block flex items-center justify-between">
              Anúncios Monitorados
              <ShoppingBag className="w-4 h-4 text-blue-600" />
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{stats.totalAds}</span>
              <span className="text-xs text-blue-700 font-semibold">
                ({stats.activeAds} ativos)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block flex items-center justify-between">
              Mudanças (24h / 7d)
              <Activity className="w-4 h-4 text-amber-600" />
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-700 font-mono">
                {stats.changes24h}
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                / {stats.changes7d} na semana
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block flex items-center justify-between">
              Preço Médio vs. Seu
              <BarChart3 className="w-4 h-4 text-emerald-600" />
            </span>
            <div className="flex flex-col mt-1">
              <span className="text-sm font-black text-slate-900 font-mono">
                Concorrente:{' '}
                {stats.avgCompetitorPrice.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-xs text-emerald-700 font-mono font-semibold">
                Seu Catálogo:{' '}
                {stats.avgOurPrice.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Principais: 1. Feed do que Mudou | 2. Anúncios por Concorrente | 3. Gestão de Concorrentes */}
      <Tabs defaultValue="feed" className="w-full">
        <TabsList className="bg-slate-200/70 p-1 border border-slate-200">
          <TabsTrigger value="feed" className="text-xs font-semibold gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-600" />
            O que Mudou (Feed de Eventos)
            <Badge
              variant="secondary"
              className="ml-1 text-[10px] px-1 py-0 h-4 bg-orange-100 text-orange-900"
            >
              {events.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ads" className="text-xs font-semibold gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
            Anúncios Concorrentes
            <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
              {ads.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs font-semibold gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            Concorrentes Cadastrados
            <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
              {competitors.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* 1. ABA FEED DE EVENTOS ("O que mudou") */}
        <TabsContent value="feed" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-3.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-600">Filtrar por:</span>
                  <Select value={selectedCompetitorId} onValueChange={setSelectedCompetitorId}>
                    <SelectTrigger className="text-xs h-8 w-[180px] bg-white border-slate-300">
                      <SelectValue placeholder="Concorrente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os concorrentes</SelectItem>
                      {competitors.map((c) => (
                        <SelectItem key={c.seller_id} value={c.seller_id}>
                          {c.nickname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                    <SelectTrigger className="text-xs h-8 w-[170px] bg-white border-slate-300">
                      <SelectValue placeholder="Tipo de Evento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os eventos</SelectItem>
                      <SelectItem value="price_change">Mudança de Preço</SelectItem>
                      <SelectItem value="sold_progress">Novas Vendas</SelectItem>
                      <SelectItem value="new_ad">Novos Anúncios</SelectItem>
                      <SelectItem value="ad_paused">Pausados</SelectItem>
                      <SelectItem value="ad_closed">Encerrados</SelectItem>
                      <SelectItem value="stock_change">Alteração de Estoque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <span className="text-xs text-slate-500 font-mono">
                  Mostrando <strong>{filteredEvents.length}</strong> evento(s)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Eventos */}
          {filteredEvents.length === 0 ? (
            <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
              <CardContent className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">Nenhuma alteração recente</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Assim que os concorrentes alterarem preços, venderem unidades ou publicarem novos
                  anúncios, as alterações aparecerão aqui cronologicamente.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncAll}
                  disabled={syncingAll}
                  className="text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Verificar agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filteredEvents.map((ev) => (
                <Card
                  key={ev.id}
                  className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors bg-white"
                >
                  <CardContent className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="pt-0.5">{renderEventTypeBadge(ev.event_type)}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900">
                            {ev.seller_nickname || `Vendedor ${ev.seller_id}`}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {ev.mlb_item_id}
                          </span>
                          <span className="text-[11px] text-slate-400 font-sans">
                            • {formatRelativeTime(ev.created)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium truncate mt-0.5 max-w-2xl">
                          {ev.ad_title || 'Anúncio monitorado'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {ev.notes}{' '}
                          {ev.old_value && ev.new_value && (
                            <span className="font-semibold text-slate-800 font-mono">
                              ({ev.old_value} → {ev.new_value})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <a
                        href={`https://produto.mercadolivre.com.br/${ev.mlb_item_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Abrir ML <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 2. ABA ANÚNCIOS CONCORRENTES */}
        <TabsContent value="ads" className="space-y-4 pt-3">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-3.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Buscar anúncio concorrente por título, MLB, marca ou modelo..."
                    value={searchAdQuery}
                    onChange={(e) => setSearchAdQuery(e.target.value)}
                    className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={selectedCompetitorId} onValueChange={setSelectedCompetitorId}>
                    <SelectTrigger className="text-xs h-9 w-[180px] bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Concorrente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os concorrentes</SelectItem>
                      {competitors.map((c) => (
                        <SelectItem key={c.seller_id} value={c.seller_id}>
                          {c.nickname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grid de Anúncios */}
          {filteredAds.length === 0 ? (
            <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
              <CardContent className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">Nenhum anúncio encontrado</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Cadastre concorrentes ou clique em "Atualizar Agora" para puxar os anúncios
                  ativos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAds.map((ad) => (
                <Card
                  key={ad.id}
                  className="border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden bg-white"
                >
                  <div>
                    {/* Topo do anúncio */}
                    <div className="p-4 flex gap-3 border-b border-slate-100">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center relative">
                        {ad.thumbnail ? (
                          <img
                            src={ad.thumbnail}
                            alt={ad.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src =
                                'https://img.usecurling.com/p/200/200?q=laptop'
                            }}
                          />
                        ) : (
                          <ShoppingBag className="w-8 h-8 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.2 rounded truncate max-w-[130px]">
                              {ad.seller_nickname || `Vendedor ${ad.seller_id}`}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                ad.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 text-[9px] px-1 py-0'
                                  : 'bg-slate-100 text-slate-600 text-[9px] px-1 py-0'
                              }
                            >
                              {ad.status === 'active' ? 'Ativo' : ad.status}
                            </Badge>
                          </div>
                          <h3
                            className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug"
                            title={ad.title}
                          >
                            {ad.title}
                          </h3>
                        </div>

                        <div className="flex items-baseline justify-between mt-2 pt-1">
                          <span className="font-mono text-base font-black text-slate-900">
                            {Number(ad.current_price || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {ad.sold_quantity} vendidos
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vínculo com Nosso Catálogo & Comparativo de Preço */}
                    <div className="p-3 bg-slate-50/70 border-b border-slate-100 text-xs">
                      {ad.matchedProduct ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] space-y-1">
                          <div className="flex items-center justify-between font-bold text-emerald-900">
                            <span className="flex items-center gap-1">
                              <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Nosso Modelo Equivalente:
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                ad.matchedProduct.diff_percent > 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {ad.matchedProduct.diff_percent > 0 ? '+' : ''}
                              {ad.matchedProduct.diff_percent}% vs concorrente
                            </span>
                          </div>
                          <p className="text-slate-700 truncate font-medium">
                            {ad.matchedProduct.name}
                          </p>
                          <div className="flex items-center justify-between text-[11px] pt-0.5 font-mono">
                            <span className="text-slate-600">
                              Nosso preço:{' '}
                              <strong className="text-slate-900">
                                {ad.matchedProduct.unit_price.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </strong>
                            </span>
                            <Link
                              to={`/catalogo/${ad.matchedProduct.id}`}
                              className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                            >
                              Ver ficha <ArrowRight className="w-2.5 h-2.5" />
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-slate-400" />
                            Sem modelo idêntico no catálogo
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Estoque: {ad.available_quantity}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenHistory(ad)}
                      className="text-xs h-7 text-slate-600 hover:text-slate-900 gap-1 px-2"
                    >
                      <History className="w-3.5 h-3.5 text-amber-600" />
                      Histórico
                    </Button>

                    <a
                      href={ad.permalink || `https://produto.mercadolivre.com.br/${ad.mlb_item_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Ver no ML <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 3. ABA CONCORRENTES CADASTRADOS */}
        <TabsContent value="competitors" className="space-y-4 pt-3">
          <div className="space-y-3">
            {competitors.map((comp) => {
              const compAds = ads.filter((a) => a.seller_id === comp.seller_id)
              const isExpanded = !!expandedCompetitors[comp.seller_id]
              const totalSold = compAds.reduce((acc, a) => acc + (a.sold_quantity || 0), 0)

              return (
                <Card key={comp.id} className="border-slate-200 shadow-xs bg-white overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => toggleExpandCompetitor(comp.seller_id)}
                          className="mt-1 p-1 hover:bg-slate-100 rounded text-slate-500"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">{comp.nickname}</h3>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono bg-slate-50 text-slate-600"
                            >
                              Seller ID: {comp.seller_id}
                            </Badge>
                            {comp.active ? (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0 border-none font-semibold">
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 text-[10px]">
                                Pausado
                              </Badge>
                            )}
                          </div>
                          {comp.notes && (
                            <p className="text-xs text-slate-500 mt-0.5">{comp.notes}</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1">
                            Última sincronização:{' '}
                            {comp.last_synced_at
                              ? formatRelativeTime(comp.last_synced_at)
                              : 'Aguardando primeira varredura'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">Anúncios</span>
                          <span className="text-base font-bold text-slate-800 font-mono">
                            {compAds.length}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">Vendas Rastreadas</span>
                          <span className="text-base font-bold text-emerald-700 font-mono">
                            {totalSold}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncSingle(comp)}
                            className="text-xs h-8 border-slate-300 text-slate-700 gap-1"
                          >
                            <RefreshCw className="w-3 h-3 text-orange-600" />
                            Sincronizar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCompetitor(comp)}
                            className="text-xs h-8 text-rose-600 hover:bg-rose-50 px-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expansão com os anúncios do concorrente */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Anúncios monitorados deste vendedor ({compAds.length})
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAddTabMode('link')
                              setLinkNickname(comp.nickname)
                              setAddModalOpen(true)
                            }}
                            className="text-[11px] h-7 border-slate-300 text-slate-700 gap-1"
                          >
                            <Plus className="w-3 h-3 text-orange-600" />+ Adicionar Anúncios Deste
                            Vendedor
                          </Button>
                        </div>
                        {compAds.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            Nenhum anúncio monitorado ainda. Clique em "+ Adicionar Anúncios Deste
                            Vendedor" para colar os links do anúncio.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {compAds.map((ad) => (
                              <div
                                key={ad.id}
                                className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-slate-900 truncate">
                                    {ad.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                                    <span>
                                      Preço:{' '}
                                      <strong>
                                        {Number(ad.current_price).toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                        })}
                                      </strong>
                                    </span>
                                    <span>•</span>
                                    <span>Vendidos: {ad.sold_quantity}</span>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenHistory(ad)}
                                  className="text-[11px] h-7 text-slate-600 hover:text-slate-900 shrink-0"
                                >
                                  Histórico
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Histórico de Preços */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <History className="w-5 h-5 text-amber-600" />
              Histórico de Preços & Movimentação
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 truncate">
              {selectedAdForHistory?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {loadingHistory ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
                <p className="text-xs">Carregando snapshots...</p>
              </div>
            ) : priceHistory.length === 0 ? (
              <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                <p className="text-xs">
                  Ainda não há snapshots históricos gravados para este anúncio.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Mini Gráfico / Barras de Tendência */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                    Evolução dos Snapshots de Preço
                  </span>
                  <div className="flex items-end gap-1.5 h-20 pt-2">
                    {priceHistory.map((snap, sIdx) => {
                      const maxPrice = Math.max(...priceHistory.map((p) => p.price)) || 1
                      const heightPercent = Math.max(15, Math.round((snap.price / maxPrice) * 100))
                      return (
                        <div
                          key={snap.id || sIdx}
                          className="flex-1 flex flex-col items-center group relative"
                        >
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className="w-full bg-orange-500 hover:bg-orange-600 rounded-t transition-all"
                          />
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-slate-900 text-white text-[9px] px-1 py-0.5 rounded pointer-events-none whitespace-nowrap z-10 font-mono">
                            R$ {snap.price}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tabela de Snapshots */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2">
                  {priceHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-2 bg-white rounded border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="font-mono">
                        <span className="font-bold text-slate-900">
                          {Number(h.price).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                        <span className="text-slate-400 text-[10px] ml-2">
                          ({h.sold_quantity || 0} vendidos)
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-sans">
                        {new Date(h.checked_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryModalOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
