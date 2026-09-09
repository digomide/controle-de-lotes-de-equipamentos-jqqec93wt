import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Filter,
  Sparkles,
  Laptop,
  Cpu,
  CircuitBoard,
  HardDrive,
  Monitor,
  Keyboard,
  Eye,
  MessageSquare,
  CheckCircle2,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Camera,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PublicStoreHeader, PublicStoreFooter } from '@/components/PublicStoreLayout'
import { STORE_CONFIG, buildWhatsAppLink } from '@/lib/storeConfig'
import { ZoomableImage } from '@/components/ZoomableImage'
import { mercadoPagoService } from '@/services/storeOrders'
import { StoreCheckoutModal } from '@/components/StoreCheckoutModal'
import { CreditCard } from 'lucide-react'
import {
  resolveCondition,
  getConditionBadgeStyles,
  CONDITION_TYPE_OPTIONS,
  type ConditionType,
} from '@/lib/condition'
import pb from '@/lib/pocketbase/client'
import type { Product } from '@/types/inventory'

export default function LojaPublica() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [conditionFilter, setConditionFilter] = useState<'all' | ConditionType>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured')

  // Estado Mercado Pago & Checkout direto do Card
  const [mpEnabled, setMpEnabled] = useState(false)
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null)
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)

  // Carregar produtos SOMENTE com status "Disponível"
  const loadPublicProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await pb.collection('products').getFullList<Product>({
        filter: 'status = "Disponível"',
        sort: '-created',
      })
      setProducts(records)
    } catch (err: any) {
      console.error('Erro ao carregar catálogo público:', err)
      setError(
        'Não foi possível carregar os equipamentos no momento. Por favor, tente novamente em alguns instantes.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPublicProducts()
    mercadoPagoService.getPublicConfig().then((cfg) => {
      setMpEnabled(cfg.enabled)
    })
  }, [])

  // Lista de marcas disponíveis no estoque atual
  const availableBrands = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) set.add(p.brand.trim())
    })
    return Array.from(set).sort()
  }, [products])

  // Produtos filtrados e ordenados
  const filteredProducts = useMemo(() => {
    const result = products.filter((p) => {
      // 1. Busca por texto (nome, serial, sku, modelo, marca, processador, ram, armazenamento)
      const q = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.serial_number?.toLowerCase().includes(q) ||
        p.processor?.toLowerCase().includes(q) ||
        p.ram?.toLowerCase().includes(q) ||
        p.storage?.toLowerCase().includes(q)

      // 2. Filtro de marca
      const matchesBrand = brandFilter === 'all' || p.brand?.trim() === brandFilter

      // 3. Filtro de condição
      const cond = resolveCondition(p.condition_type, p.condition_grade, p.condition)
      const matchesCondition = conditionFilter === 'all' || cond.type === conditionFilter

      // 4. Faixa de preço
      const price = Number(p.unit_price) || 0
      const matchesMin = !minPrice || price >= parseFloat(minPrice)
      const matchesMax = !maxPrice || price <= parseFloat(maxPrice)

      return matchesSearch && matchesBrand && matchesCondition && matchesMin && matchesMax
    })

    // Ordenação
    return result.sort((a, b) => {
      const priceA = Number(a.unit_price) || 0
      const priceB = Number(b.unit_price) || 0
      if (sortBy === 'price-asc') return priceA - priceB
      if (sortBy === 'price-desc') return priceB - priceA
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      return 0 // default 'featured' / -created
    })
  }, [products, searchTerm, brandFilter, conditionFilter, minPrice, maxPrice, sortBy])

  // Limpar filtros
  const handleClearFilters = () => {
    setSearchTerm('')
    setBrandFilter('all')
    setConditionFilter('all')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('featured')
  }

  const hasActiveFilters =
    searchTerm !== '' ||
    brandFilter !== 'all' ||
    conditionFilter !== 'all' ||
    minPrice !== '' ||
    maxPrice !== ''

  // Helper para extrair a lista completa de fotos do equipamento respeitando photo_order se houver
  const getProductPhotos = (p: Product): string[] => {
    const list: string[] = []

    if (p.photo_order && Array.isArray(p.photo_order) && p.photo_order.length > 0) {
      const validPhotosSet = new Set(Array.isArray(p.photos) ? p.photos : [])
      const validImagesSet = new Set(Array.isArray(p.images) ? p.images : [])
      const visitedPhotos = new Set<string>()
      const visitedImages = new Set<string>()

      for (const item of p.photo_order) {
        if (!item || !item.value) continue
        if (item.type === 'photo') {
          if (validPhotosSet.has(item.value)) {
            list.push(pb.files.getURL(p, item.value))
            visitedPhotos.add(item.value)
          }
        } else if (item.type === 'image') {
          if (validImagesSet.has(item.value) || item.value.startsWith('http')) {
            list.push(item.value.trim())
            visitedImages.add(item.value)
          }
        }
      }

      if (p.photos && Array.isArray(p.photos)) {
        p.photos.forEach((fileName) => {
          if (fileName && !visitedPhotos.has(fileName)) {
            list.push(pb.files.getURL(p, fileName))
          }
        })
      }
      if (p.images && Array.isArray(p.images)) {
        p.images.forEach((url) => {
          if (url && !visitedImages.has(url.trim())) {
            list.push(url.trim())
          }
        })
      }

      if (list.length > 0) {
        return list
      }
    }

    if (p.photos && Array.isArray(p.photos)) {
      p.photos.forEach((fileName) => {
        if (fileName) {
          list.push(pb.files.getURL(p, fileName))
        }
      })
    }
    if (p.images && Array.isArray(p.images)) {
      p.images.forEach((url) => {
        if (url && !list.includes(url)) {
          list.push(url)
        }
      })
    }
    if (list.length === 0) {
      list.push('https://img.usecurling.com/p/600/400?q=laptop')
    }
    return list
  }

  // Estado para armazenar o índice da foto selecionada em cada card de produto
  const [cardPhotoIndexes, setCardPhotoIndexes] = useState<Record<string, number>>({})

  const handlePrevCardPhoto = (e: React.MouseEvent, productId: string, totalPhotos: number) => {
    e.preventDefault()
    e.stopPropagation()
    setCardPhotoIndexes((prev) => {
      const current = prev[productId] || 0
      const next = current > 0 ? current - 1 : totalPhotos - 1
      return { ...prev, [productId]: next }
    })
  }

  const handleNextCardPhoto = (e: React.MouseEvent, productId: string, totalPhotos: number) => {
    e.preventDefault()
    e.stopPropagation()
    setCardPhotoIndexes((prev) => {
      const current = prev[productId] || 0
      const next = current < totalPhotos - 1 ? current + 1 : 0
      return { ...prev, [productId]: next }
    })
  }

  const handleSelectCardPhoto = (e: React.MouseEvent, productId: string, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setCardPhotoIndexes((prev) => ({ ...prev, [productId]: index }))
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <PublicStoreHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* Banner Hero do Catálogo */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6 sm:p-10 shadow-lg">
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              Catálogo Oficial de Equipamentos Disponíveis
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Notebooks Corporativos Revisados para Pronta-Entrega
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Equipamentos de alta performance (Dell, Lenovo, HP), testados peça por peça, com
              checklist técnico completo aprovado e garantia de procedência.
            </p>

            {/* Badges de Destaque */}
            <div className="pt-2 flex flex-wrap gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg backdrop-blur-xs font-medium text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Seminovos Grau A e B
              </span>
              <span className="inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg backdrop-blur-xs font-medium text-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Testados em Bancada
              </span>
              <span className="inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg backdrop-blur-xs font-medium text-slate-200">
                <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                Pronta-Entrega Imediata
              </span>
            </div>
          </div>

          {/* Efeito decorativo sutil */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-emerald-500/10 to-transparent pointer-events-none hidden md:block" />
        </div>

        {/* Barra de Filtros e Busca (Estilo Replit) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Filtros do Catálogo
              </h2>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Busca por texto */}
            <div className="lg:col-span-4 space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Buscar por modelo, processador ou serial
              </Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Ex: Dell Latitude, i7, 16GB, ThinkPad..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs sm:text-sm h-10 bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>
            </div>

            {/* Filtro Marca */}
            <div className="lg:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Marca / Fabricante</Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="text-xs sm:text-sm h-10 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Todas as marcas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as marcas</SelectItem>
                  {availableBrands.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro Condição */}
            <div className="lg:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Condição</Label>
              <Select
                value={conditionFilter}
                onValueChange={(val: 'all' | ConditionType) => setConditionFilter(val)}
              >
                <SelectTrigger className="text-xs sm:text-sm h-10 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as condições</SelectItem>
                  {CONDITION_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preço Mínimo */}
            <div className="lg:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Preço Mínimo (R$)</Label>
              <Input
                type="number"
                placeholder="R$ 0"
                min="0"
                step="50"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="text-xs sm:text-sm h-10 bg-slate-50 border-slate-200 focus:bg-white font-mono"
              />
            </div>

            {/* Preço Máximo */}
            <div className="lg:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Preço Máximo (R$)</Label>
              <Input
                type="number"
                placeholder="R$ 10.000"
                min="0"
                step="50"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="text-xs sm:text-sm h-10 bg-slate-50 border-slate-200 focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* Barra inferior: Contador e Ordenação */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-xs font-mono">
                {filteredProducts.length}{' '}
                {filteredProducts.length === 1 ? 'equipamento' : 'equipamentos'}
              </span>
              <span className="text-slate-500">disponíveis para pronta-entrega neste momento</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Ordenar por:</span>
              <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                <SelectTrigger className="w-44 h-8 text-xs bg-slate-50 border-slate-200 font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Destaques recentes</SelectItem>
                  <SelectItem value="price-asc">Menor preço primeiro</SelectItem>
                  <SelectItem value="price-desc">Maior preço primeiro</SelectItem>
                  <SelectItem value="name">Nome (A - Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Feedback de Carregamento e Erros */}
        {loading && (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Carregando equipamentos disponíveis...
            </p>
          </div>
        )}

        {error && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
            <p className="text-sm font-semibold text-rose-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPublicProducts}
              className="text-xs bg-white border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Grid de Cards Públicos (Estilo AmbicorpFlow) */}
        {!loading && !error && (
          <>
            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Laptop className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Nenhum equipamento encontrado com estes filtros
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Tente remover termos de busca ou ampliar os limites de preço para visualizar
                  outros notebooks em estoque.
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="text-xs mt-2"
                  >
                    Limpar todos os filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((p) => {
                  const productPhotos = getProductPhotos(p)
                  const currentIndex = Math.min(
                    cardPhotoIndexes[p.id] || 0,
                    Math.max(0, productPhotos.length - 1),
                  )
                  const activePhoto = productPhotos[currentIndex] || productPhotos[0]
                  const hasMultiplePhotos = productPhotos.length > 1
                  const detailUrl = `/loja/${p.code || p.sku || p.id}`
                  const price = Number(p.unit_price) || 0
                  const brandModel = [p.brand, p.model].filter(Boolean).join(' · ') || p.name
                  const whatsappLink = buildWhatsAppLink(p)

                  return (
                    <Card
                      key={p.id}
                      className="overflow-hidden border border-slate-200/90 rounded-2xl bg-white shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
                    >
                      {/* Foto e Badges Superiores com Mini-Galeria Interativa e Zoom por Lente */}
                      <div className="relative w-full aspect-16/10 h-48 sm:h-52 bg-slate-100 overflow-hidden shrink-0 select-none">
                        <ZoomableImage
                          src={activePhoto}
                          alt={`${p.name} - Foto ${currentIndex + 1}`}
                          compact={true}
                          showScaleControl={false}
                          showHint={false}
                          onClick={() => {
                            // Ao clicar na foto (desktop ou mobile), navega via SPA para o detalhe
                            navigate(detailUrl)
                          }}
                        />

                        {/* Tag de Condição e Grau ML */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none flex-wrap">
                          {(() => {
                            const c = resolveCondition(
                              p.condition_type,
                              p.condition_grade,
                              p.condition,
                            )
                            const badge = getConditionBadgeStyles(c.type, c.grade)
                            return (
                              <>
                                <span className="bg-slate-900/90 text-white px-2.5 py-0.5 rounded-md text-[11px] font-bold shadow-xs backdrop-blur-xs">
                                  {badge.label}
                                </span>
                                {badge.gradeLabel && (
                                  <span className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-md text-[10px] shadow-xs">
                                    Grau {badge.gradeLabel}
                                  </span>
                                )}
                              </>
                            )
                          })()}
                          {p.aesthetic_grade && (
                            <span className="bg-white/90 backdrop-blur-xs text-slate-800 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs">
                              {p.aesthetic_grade}
                            </span>
                          )}
                        </div>

                        {/* Tag "Disponível" */}
                        <div className="absolute top-3 right-3 z-10 pointer-events-none">
                          <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Disponível
                          </span>
                        </div>

                        {/* Controles da Mini-Galeria (Apenas quando houver mais de 1 foto) */}
                        {hasMultiplePhotos && (
                          <>
                            {/* Contador de fotos no topo central/inferior */}
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-slate-950/70 backdrop-blur-xs text-white text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none opacity-90">
                              <Camera className="w-3 h-3 text-emerald-400" />
                              {currentIndex + 1}/{productPhotos.length}
                            </div>

                            {/* Setas de navegação direta anterior/próxima (aparecem no hover e no mobile com toque) */}
                            <button
                              type="button"
                              onClick={(e) => handlePrevCardPhoto(e, p.id, productPhotos.length)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 focus:opacity-100"
                              title="Foto anterior"
                              aria-label="Foto anterior"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleNextCardPhoto(e, p.id, productPhotos.length)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 focus:opacity-100"
                              title="Próxima foto"
                              aria-label="Próxima foto"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>

                            {/* Indicador de Bolinhas/Pontos de navegação na base da foto */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-0.5 bg-slate-950/50 backdrop-blur-xs rounded-full">
                              {productPhotos.map((_, dotIdx) => (
                                <button
                                  key={dotIdx}
                                  type="button"
                                  onClick={(e) => handleSelectCardPhoto(e, p.id, dotIdx)}
                                  className={`rounded-full transition-all ${
                                    currentIndex === dotIdx
                                      ? 'w-3 h-1.5 bg-emerald-400'
                                      : 'w-1.5 h-1.5 bg-white/60 hover:bg-white'
                                  }`}
                                  title={`Ver foto ${dotIdx + 1}`}
                                  aria-label={`Ver foto ${dotIdx + 1}`}
                                />
                              ))}
                            </div>
                          </>
                        )}

                        {/* Overlay hover sutil: "Ver detalhes" (quando não tiver mini-galeria de múltiplos pontos cobrindo toda a base) */}
                        {!hasMultiplePhotos && (
                          <Link
                            to={detailUrl}
                            className="absolute inset-x-0 bottom-0 py-2.5 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent text-white text-xs font-semibold text-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5"
                          >
                            <Eye className="w-4 h-4" />
                            Ver fotos e especificações completas
                          </Link>
                        )}
                      </div>

                      {/* Conteúdo do Card */}
                      <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          {/* Serial e Marca · Modelo */}
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {p.serial_number || p.sku}
                            </span>
                            <span className="font-semibold text-slate-500 truncate max-w-[180px]">
                              {brandModel}
                            </span>
                          </div>

                          {/* Título com Link */}
                          <Link to={detailUrl} className="block group/title">
                            <h3 className="font-bold text-slate-900 text-base line-clamp-2 leading-snug group-hover/title:text-emerald-700 transition-colors">
                              {p.name}
                            </h3>
                          </Link>

                          {/* Especificações Principais (Igual ao Replit) */}
                          <div className="mt-4 space-y-2 text-xs border-t border-slate-100 pt-3">
                            {p.processor && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                  <Cpu className="w-3.5 h-3.5 text-slate-500" /> Processador
                                </span>
                                <span className="font-semibold text-slate-800 truncate max-w-[170px]">
                                  {p.processor}
                                </span>
                              </div>
                            )}

                            {p.ram && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                  <CircuitBoard className="w-3.5 h-3.5 text-slate-500" /> Memória
                                </span>
                                <span className="font-semibold text-slate-800">{p.ram}</span>
                              </div>
                            )}

                            {p.storage && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                  <HardDrive className="w-3.5 h-3.5 text-slate-500" /> Armazenamento
                                </span>
                                <span className="font-semibold text-slate-800">{p.storage}</span>
                              </div>
                            )}

                            {p.screen_size && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                  <Monitor className="w-3.5 h-3.5 text-slate-500" /> Tela
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {p.screen_size}
                                </span>
                              </div>
                            )}

                            {p.has_numeric_keypad !== undefined && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                  <Keyboard className="w-3.5 h-3.5 text-slate-500" /> Teclado
                                  numérico
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {p.has_numeric_keypad ? 'Sim' : 'Não'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Preço e Botões de Ação */}
                        <div className="pt-3 border-t border-slate-100 space-y-3">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                              Valor à vista
                            </span>
                            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                              R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {mpEnabled ? (
                              <Button
                                onClick={() => {
                                  setCheckoutProduct(p)
                                  setCheckoutModalOpen(true)
                                }}
                                className="w-full text-xs h-10 font-bold bg-sky-600 hover:bg-sky-700 text-white gap-1 shadow-xs"
                                title="Comprar online com Pix ou Cartão"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                Comprar
                              </Button>
                            ) : (
                              <Link to={detailUrl} className="w-full">
                                <Button
                                  variant="outline"
                                  className="w-full text-xs h-10 font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
                                >
                                  Ver Detalhes
                                </Button>
                              </Link>
                            )}

                            <a
                              href={whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`w-full inline-flex items-center justify-center gap-1.5 px-3 rounded-md font-bold text-xs h-10 transition-colors ${
                                mpEnabled
                                  ? 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              }`}
                              title="Chamar no WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              WhatsApp
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal de Checkout Rápido para Compras a partir do Card */}
      <StoreCheckoutModal
        product={checkoutProduct}
        open={checkoutModalOpen}
        onOpenChange={(open) => {
          setCheckoutModalOpen(open)
          if (!open) setCheckoutProduct(null)
        }}
      />

      <PublicStoreFooter />
    </div>
  )
}
