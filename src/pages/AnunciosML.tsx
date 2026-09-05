import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingBag,
  RefreshCw,
  ExternalLink,
  Search,
  PackageCheck,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Boxes,
  ArrowRight,
  Barcode,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { mlService, type MLSellerItem, type MLSellerItemsResult } from '@/services/mlService'
import { AnunciosCatalogoTab } from '@/components/AnunciosCatalogoTab'

export default function AnunciosML() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [progressText, setProgressText] = useState<string>(
    'Carregando anúncios do Mercado Livre...',
  )
  const [data, setData] = useState<MLSellerItemsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentTab, setCurrentTab] = useState<'catalog' | 'my_ads'>('catalog')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [matchedFilter, setMatchedFilter] = useState<string>('all')
  const [catalogOnlyFilter, setCatalogOnlyFilter] = useState<string>('all')

  const fetchItems = async (showToast = false) => {
    setLoading(true)
    setError(null)
    setProgressText('Consultando anúncios na conta do Mercado Livre...')
    try {
      const res = await mlService.getSellerItems({
        onProgress: (pText) => {
          if (pText) setProgressText(pText)
        },
      })
      setData(res)
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
  }, [])

  const filteredItems = useMemo(() => {
    if (!data?.items) return []
    return data.items.filter((item) => {
      // Filtro de texto (título, ID, GTIN, modelo, SKU do match, catalog_product_id)
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesTitle = item.title?.toLowerCase().includes(q)
        const matchesId = item.id?.toLowerCase().includes(q)
        const matchesCatalogId = item.catalog_product_id?.toLowerCase().includes(q)
        const matchesGtin = item.gtin?.toLowerCase().includes(q)
        const matchesBrand = item.brand?.toLowerCase().includes(q)
        const matchesModel = item.model?.toLowerCase().includes(q)
        const matchesSku = item.matchedProduct?.sku?.toLowerCase().includes(q)
        const matchesProductName = item.matchedProduct?.name?.toLowerCase().includes(q)

        if (
          !matchesTitle &&
          !matchesId &&
          !matchesCatalogId &&
          !matchesGtin &&
          !matchesBrand &&
          !matchesModel &&
          !matchesSku &&
          !matchesProductName
        ) {
          return false
        }
      }

      // Filtro de status ML (active, paused, closed)
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }

      // Filtro de vínculo ao catálogo local
      if (matchedFilter === 'matched' && !item.matchedProduct) return false
      if (matchedFilter === 'unmatched' && item.matchedProduct) return false

      // Filtro de tipo de anúncio (catálogo vs tradicional)
      if (catalogOnlyFilter === 'catalog' && !item.catalog_product_id && !item.catalog_listing) {
        return false
      }
      if (
        catalogOnlyFilter === 'traditional' &&
        (item.catalog_product_id || item.catalog_listing)
      ) {
        return false
      }

      return true
    })
  }, [data, search, statusFilter, matchedFilter, catalogOnlyFilter])

  const stats = useMemo(() => {
    if (!data?.items) {
      return { total: 0, active: 0, paused: 0, closed: 0, matched: 0, catalogListings: 0 }
    }
    const items = data.items
    return {
      total: items.length,
      active: items.filter((i) => i.status === 'active').length,
      paused: items.filter((i) => i.status === 'paused').length,
      closed: items.filter((i) => i.status === 'closed').length,
      matched: items.filter((i) => !!i.matchedProduct).length,
      catalogListings: items.filter((i) => !!i.catalog_product_id || !!i.catalog_listing).length,
    }
  }, [data])

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

  const renderConditionBadge = (item: MLSellerItem) => {
    const cond = (item.condition || '').toLowerCase()
    const grade = item.condition_grade

    if (cond === 'refurbished') {
      return (
        <Badge
          variant="outline"
          className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] font-semibold gap-1"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          Recondicionado{grade ? ` (${grade})` : ''}
        </Badge>
      )
    }

    if (cond === 'used') {
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold"
        >
          Usado{grade ? ` (${grade})` : ''}
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
                Mercado Livre
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-900 border-amber-300 text-xs font-semibold gap-1"
                >
                  <Eye className="w-3 h-3 text-amber-700" />
                  Conta Conectada
                </Badge>
              </h1>
              <p className="text-xs text-slate-500">
                Gerencie posições no catálogo oficial do ML e acompanhe todos os anúncios da conta (
                {data?.seller_nickname ? (
                  <strong className="text-slate-800 font-semibold">{data.seller_nickname}</strong>
                ) : (
                  'Vendedor conectado'
                )}
                ).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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

      {/* Tabs Principais: Anúncios de Catálogo vs Meus Anúncios no ML */}
      <Tabs
        value={currentTab}
        onValueChange={(val) => setCurrentTab(val as 'catalog' | 'my_ads')}
        className="w-full space-y-6"
      >
        <TabsList className="grid w-full sm:w-[460px] grid-cols-2 p-1 bg-slate-100 border border-slate-200 rounded-lg">
          <TabsTrigger
            value="catalog"
            className="text-xs font-bold flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Anúncios de Catálogo
            <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 h-4">Novo</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="my_ads"
            className="text-xs font-bold flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            Meus Anúncios ({stats.total})
            {stats.catalogListings > 0 && (
              <Badge
                variant="outline"
                className="border-blue-300 text-blue-700 text-[9px] px-1 py-0 h-4 font-mono"
              >
                {stats.catalogListings} cat.
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo Aba 1: Anúncios de Catálogo (Busca, Casamento e Publicação em Massa) */}
        <TabsContent value="catalog" className="space-y-6 outline-hidden">
          <AnunciosCatalogoTab />
        </TabsContent>

        {/* Conteúdo Aba 2: Meus Anúncios Existentes com Selo de Catálogo e Rastreamento */}
        <TabsContent value="my_ads" className="space-y-6 outline-hidden">
          {/* Estatísticas Rápidas */}
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
                  <PackageCheck className="w-3 h-3" /> Casados
                </span>
                <span className="text-2xl font-black text-purple-700 mt-1 block font-mono">
                  {stats.matched}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Erro de Token / Comunicação */}
          {error && (
            <Card className="border-rose-200 bg-rose-50/60 shadow-xs">
              <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-rose-950">
                      Falha ao consultar Mercado Livre
                    </h3>
                    <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">{error}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchItems(true)}
                    className="text-xs h-8 text-rose-800 border-rose-300 hover:bg-rose-100"
                  >
                    Tentar Novamente
                  </Button>
                  <Link to="/configuracoes">
                    <Button
                      size="sm"
                      className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      Reconectar Conta
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Barra de Filtros */}
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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

                  {(search ||
                    statusFilter !== 'all' ||
                    matchedFilter !== 'all' ||
                    catalogOnlyFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('all')
                        setMatchedFilter('all')
                        setCatalogOnlyFilter('all')
                      }}
                      className="text-xs h-9 text-slate-600 hover:text-slate-900"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Anúncios */}
          {loading ? (
            <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500" />
              <p className="text-sm font-semibold text-slate-700">
                {progressText || 'Carregando anúncios do Mercado Livre...'}
              </p>
              <p className="text-xs text-slate-400">
                Percorrendo todas as páginas de anúncios da conta (ativos, pausados e encerrados)
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
                  {search ||
                  statusFilter !== 'all' ||
                  matchedFilter !== 'all' ||
                  catalogOnlyFilter !== 'all'
                    ? 'Nenhum anúncio corresponde aos filtros aplicados. Tente limpar os filtros de busca.'
                    : 'Não há anúncios cadastrados ou ativos para a conta do Mercado Livre conectada no momento.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const isCatalog = Boolean(item.catalog_product_id || item.catalog_listing)

                return (
                  <Card
                    key={item.id}
                    className={`border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden bg-white ${
                      isCatalog ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Cabeçalho do Card: Miniatura + Título + Status */}
                      <div className="p-4 flex gap-3.5 border-b border-slate-100">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center relative">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).src =
                                  'https://img.usecurling.com/p/200/200?q=laptop'
                              }}
                            />
                          ) : (
                            <ShoppingBag className="w-8 h-8 text-slate-300" />
                          )}
                          {item.pictures_count && item.pictures_count > 1 ? (
                            <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] px-1 py-0.5 rounded font-mono">
                              {item.pictures_count} fotos
                            </span>
                          ) : null}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              {renderStatusBadge(item.status)}
                              {renderConditionBadge(item)}
                              {isCatalog && (
                                <Badge className="bg-blue-600 text-white border-none gap-1 font-bold text-[10px] px-1.5 py-0 shadow-2xs font-mono">
                                  <Layers className="w-3 h-3" /> Catálogo
                                </Badge>
                              )}
                            </div>
                            <h3
                              className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug"
                              title={item.title}
                            >
                              {item.title}
                            </h3>
                          </div>

                          <div className="flex items-baseline justify-between mt-2 pt-1">
                            <span className="font-mono text-base font-black text-slate-900">
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

                      {/* Detalhes Técnicos & Identificadores */}
                      <div className="p-3 bg-slate-50/60 text-[11px] space-y-1.5 border-b border-slate-100 font-mono">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 uppercase text-[10px] font-sans font-bold">
                            ID do Anúncio:
                          </span>
                          <span className="font-bold text-slate-800">{item.id}</span>
                        </div>

                        {item.catalog_product_id ? (
                          <div className="flex items-center justify-between text-blue-700 bg-blue-50/80 p-1 rounded border border-blue-200">
                            <span className="text-blue-900 uppercase text-[10px] font-sans font-bold flex items-center gap-1">
                              <Layers className="w-3 h-3 text-blue-600" /> ID Catálogo:
                            </span>
                            <span className="font-bold text-blue-800">
                              {item.catalog_product_id}
                            </span>
                          </div>
                        ) : null}

                        {item.gtin ? (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-slate-400 uppercase text-[10px] font-sans font-bold flex items-center gap-1">
                              <Barcode className="w-3 h-3 text-slate-400" /> GTIN / EAN:
                            </span>
                            <span className="font-semibold text-slate-700">{item.gtin}</span>
                          </div>
                        ) : null}

                        {(item.brand || item.model) && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-slate-400 uppercase text-[10px] font-sans font-bold">
                              Marca / Modelo:
                            </span>
                            <span className="truncate max-w-[170px] text-slate-700">
                              {[item.brand, item.model].filter(Boolean).join(' ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Selo Informativo de Correspondência com o Catálogo */}
                      <div className="p-3">
                        {item.matchedProduct ? (
                          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] space-y-1">
                            <div className="flex items-center justify-between font-bold text-emerald-900">
                              <span className="flex items-center gap-1">
                                <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                                Vinculado ao Estoque
                              </span>
                              <Badge
                                variant="outline"
                                className="bg-emerald-100 text-emerald-800 border-none text-[9px] px-1.5 py-0"
                              >
                                Match por{' '}
                                {item.matchedProduct.match_type === 'ml_listing_id' ? 'ID' : 'GTIN'}
                              </Badge>
                            </div>
                            <p className="text-slate-700 font-sans truncate font-medium">
                              {item.matchedProduct.name}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                              <span>SKU: {item.matchedProduct.sku}</span>
                              <Link
                                to={`/catalogo/${item.matchedProduct.id}`}
                                className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                              >
                                Ver ficha <ArrowRight className="w-2.5 h-2.5" />
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
                            <span className="flex items-center gap-1 text-[11px]">
                              <Boxes className="w-3 h-3 text-slate-400" />
                              Sem vínculo direto no estoque
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              (Apenas visualização)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rodapé do Card com link direto para o Mercado Livre */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.sold_quantity > 0
                          ? `${item.sold_quantity} vendido(s)`
                          : 'Nenhuma venda registrada'}
                      </span>
                      {item.permalink ? (
                        <a
                          href={item.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2968c8] hover:text-[#184894] hover:underline"
                        >
                          Abrir no Mercado Livre <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">{item.id}</span>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
