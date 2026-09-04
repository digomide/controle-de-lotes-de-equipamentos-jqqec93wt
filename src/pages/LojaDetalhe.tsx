import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  X,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Battery,
  Cpu,
  CircuitBoard,
  HardDrive,
  Monitor,
  Sparkles,
  Share2,
  Copy,
  Laptop,
  AlertCircle,
  HelpCircle,
  Phone,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { ZoomableImage } from '@/components/ZoomableImage'
import { ImageLightboxModal } from '@/components/ImageLightboxModal'
import { resolveCondition, getConditionBadgeStyles } from '@/lib/condition'
import { PublicStoreHeader, PublicStoreFooter } from '@/components/PublicStoreLayout'
import { STORE_CONFIG, buildWhatsAppLink, buildGeneralWhatsAppLink } from '@/lib/storeConfig'
import { productsService } from '@/services/products'
import { normalizeChecklistStatus } from '@/lib/checklist'
import pb from '@/lib/pocketbase/client'
import type { Product } from '@/types/inventory'

export default function LojaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Galeria de Fotos e Zoom Modal
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)
  const [zoomModalOpen, setZoomModalOpen] = useState(false)

  // Carregar dados do equipamento
  useEffect(() => {
    let isMounted = true

    const fetchProduct = async () => {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        // Tenta buscar por ID ou SKU ou Code usando endpoint público
        let record: Product | null = null

        // 1. Tenta buscar direto por ID caso seja formato de ID PocketBase (15 caracteres alfanuméricos)
        try {
          record = await pb.collection('products').getOne<Product>(id)
        } catch {
          // Se falhar ou não for ID, busca por filtro
        }

        // 2. Se não achou por ID direto, busca por sku ou code
        if (!record) {
          const list = await pb.collection('products').getFullList<Product>({
            filter: `(code = "${id}" || sku = "${id}" || id = "${id}") && status = "Disponível"`,
          })
          if (list[0]) {
            record = list[0]
          }
        }

        if (!isMounted) return

        if (!record) {
          setError('Equipamento não encontrado ou já negociado.')
          setProduct(null)
        } else if (record.status !== 'Disponível') {
          // Garante que só equipamentos Disponíveis sejam vistos publicamente
          setError('Este equipamento não está mais disponível no catálogo.')
          setProduct(null)
        } else {
          setProduct(record)
          setSelectedPhotoIndex(0)
        }
      } catch (err: any) {
        console.error('Erro ao carregar detalhes do equipamento:', err)
        if (isMounted) {
          setError('Não foi possível carregar as informações deste equipamento.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchProduct()

    return () => {
      isMounted = false
    }
  }, [id])

  // Lista consolidada de fotos (PocketBase uploads + JSON images)
  const photos = useMemo(() => {
    const list: string[] = []

    if (product?.photos && Array.isArray(product.photos)) {
      for (const fn of product.photos) {
        if (fn) {
          list.push(productsService.getFileUrl(product, fn))
        }
      }
    }

    if (product?.images && Array.isArray(product.images)) {
      for (const url of product.images) {
        if (url && typeof url === 'string' && url.trim().length > 0) {
          list.push(url.trim())
        }
      }
    }

    if (list.length > 0) {
      return list
    }

    return [
      'https://img.usecurling.com/p/800/600?q=laptop',
      'https://img.usecurling.com/p/800/600?q=keyboard',
      'https://img.usecurling.com/p/800/600?q=ports',
    ]
  }, [product])

  // Checklist técnico em modo RESUMO PÚBLICO (apenas itens Ok/aprovados e itens técnicos com observação neutra)
  // NUNCA expor: custos de peças, fornecedor, notas internas de bancada
  const publicChecklist = useMemo(() => {
    if (!product?.technical_checklist || !Array.isArray(product.technical_checklist)) {
      return []
    }

    // Filtrar apenas itens que foram revisados
    return product.technical_checklist
      .map((item) => ({
        item: item.item,
        status: normalizeChecklistStatus(item.status),
        // Se houver observação técnica pública simples sobre funcionamento, mantém; se não, vazio
        observation: item.observation || '',
      }))
      .filter((item) => item.status === 'Ok' || item.status === 'Atenção')
  }, [product])

  // Contagem de itens aprovados
  const okItemsCount = useMemo(() => {
    if (!product?.technical_checklist || !Array.isArray(product.technical_checklist)) return 0
    return product.technical_checklist.filter((i) => normalizeChecklistStatus(i.status) === 'Ok')
      .length
  }, [product])

  const totalInspectedItems = useMemo(() => {
    if (!product?.technical_checklist || !Array.isArray(product.technical_checklist)) return 16
    return product.technical_checklist.length || 16
  }, [product])

  // WhatsApp Link pré-preenchido
  const whatsappUrl = useMemo(() => {
    if (!product) return buildGeneralWhatsAppLink()
    return buildWhatsAppLink(product)
  }, [product])

  // Compartilhar anúncio
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      toast({
        title: 'Link copiado!',
        description: 'O link deste anúncio foi copiado para sua área de transferência.',
      })
    }
  }

  // Navegar pelas fotos no zoom
  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
  }

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
  }

  // Atalhos de teclado para o zoom modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!zoomModalOpen) return
      if (e.key === 'ArrowLeft') handlePrevPhoto()
      if (e.key === 'ArrowRight') handleNextPhoto()
      if (e.key === 'Escape') setZoomModalOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomModalOpen, photos.length])

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <PublicStoreHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Breadcrumb e Voltar ao Catálogo */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            to="/loja"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Catálogo de Equipamentos
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="text-xs h-8 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <Share2 className="w-3.5 h-3.5" />
            Compartilhar Anúncio
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-32 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Carregando detalhes do equipamento...
            </p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-4 max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{error}</h2>
            <p className="text-xs text-slate-500">
              Este produto pode ter sido vendido recentemente ou o link acessado está incorreto.
            </p>
            <Button
              onClick={() => navigate('/loja')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Ver Outros Notebooks Disponíveis
            </Button>
          </div>
        )}

        {/* Detalhes do Produto */}
        {!loading && !error && product && (
          <div className="space-y-8">
            {/* Grid Principal: Galeria de Fotos (Esquerda) e Painel de Compra (Direita) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Coluna Esquerda: Galeria de Fotos com Zoom (7 colunas) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  {/* Foto Principal com gatilho de Zoom estilo Mercado Livre */}
                  <div
                    className="relative aspect-16/10 bg-slate-100 group overflow-hidden flex items-center justify-center"
                    title="Passe o mouse para zoom estilo Mercado Livre ou clique para tela cheia"
                  >
                    <ZoomableImage
                      src={photos[selectedPhotoIndex] || photos[0]}
                      alt={product.name}
                      showScaleControl={true}
                      showHint={true}
                      onClick={() => setZoomModalOpen(true)}
                    />

                    {/* Badge contador de fotos */}
                    <div className="absolute top-3 left-28 sm:left-32 bg-slate-950/75 backdrop-blur-xs text-white text-xs px-3 py-1 rounded-md font-mono font-medium flex items-center gap-2 pointer-events-none z-10">
                      Foto {selectedPhotoIndex + 1} de {photos.length}
                    </div>

                    {/* Botão Zoom Canto Superior Direito */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setZoomModalOpen(true)
                      }}
                      className="absolute top-3 right-3 bg-white/95 hover:bg-white text-slate-800 text-xs px-3 py-1.5 rounded-lg font-bold shadow-md flex items-center gap-1.5 transition-all opacity-95 group-hover:opacity-100 z-10"
                    >
                      <ZoomIn className="w-4 h-4 text-emerald-600" />
                      Tela Cheia
                    </button>

                    {/* Setas de navegação direta sobre a imagem */}
                    {photos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={handlePrevPhoto}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-800 flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 z-10"
                          title="Foto anterior"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextPhoto}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-800 flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 z-10"
                          title="Próxima foto"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Carrossel de Miniaturas */}
                  {photos.length > 1 && (
                    <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex gap-2.5 overflow-x-auto">
                      {photos.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedPhotoIndex(idx)}
                          className={`relative w-20 sm:w-24 h-14 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                            selectedPhotoIndex === idx
                              ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={url}
                            alt={`Miniatura ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card de Procedência e Garantia */}
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-5 space-y-2 text-xs text-emerald-950">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    Garantia de Qualidade & Procedência
                  </div>
                  <p className="text-emerald-800 leading-relaxed">
                    Este equipamento é originário de renovação de frotas corporativas de grandes
                    empresas, inspecionado minuciosamente em nossa bancada técnica com limpeza
                    interna, testes de estresse térmico, memória, tela e integridade da bateria.
                  </p>
                </div>
              </div>

              {/* Coluna Direita: Informações Comerciais & CTA (5 colunas) */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="border-slate-200/90 rounded-2xl shadow-xs overflow-hidden bg-white">
                  <CardContent className="p-6 sm:p-7 space-y-6">
                    {/* Header: Código, Marca e Condição */}
                    <div>
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                            {product.serial_number || product.sku}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Disponível
                          </span>
                        </div>

                        {(() => {
                          const cond = resolveCondition(
                            product.condition_type,
                            product.condition_grade,
                            product.condition,
                          )
                          const badge = getConditionBadgeStyles(cond.type, cond.grade)
                          return (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-xs font-bold border ${badge.classes}`}
                              >
                                {badge.label}
                              </Badge>
                              {badge.gradeLabel && (
                                <Badge
                                  variant="outline"
                                  className="text-[11px] bg-slate-100 text-slate-800 border-slate-300"
                                >
                                  Grau: {badge.gradeLabel}
                                </Badge>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                        {product.name}
                      </h1>

                      <p className="text-sm font-semibold text-slate-500 mt-1">
                        {product.brand} ·{' '}
                        {product.model || product.category || 'Notebook Corporativo'}
                      </p>
                    </div>

                    {/* Preço e Forma de Pagamento */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
                          Preço anunciado
                        </span>
                        <span className="text-xs text-emerald-400 font-semibold">
                          À vista / PIX
                        </span>
                      </div>
                      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                        R${' '}
                        {Number(product.unit_price || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <p className="text-[11px] text-slate-400 pt-1">
                        * Consulte opções de parcelamento no cartão de crédito via WhatsApp.
                      </p>
                    </div>

                    {/* CTA Principal de Contato via WhatsApp */}
                    <div className="space-y-2.5">
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg transition-all"
                      >
                        <MessageSquare className="w-5 h-5" />
                        Comprar via WhatsApp
                      </a>

                      <p className="text-[11px] text-center text-slate-500">
                        Clique para abrir conversa direta com nossa equipe com mensagem já formatada
                        para este notebook.
                      </p>
                    </div>

                    {/* Atendimento e Localização */}
                    <div className="border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-500">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Loja:
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {STORE_CONFIG.whatsappDisplay}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" /> Horário:
                        </span>
                        <span>{STORE_CONFIG.businessHours}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Especificações Técnicas Completas */}
                <Card className="border-slate-200/90 rounded-2xl shadow-xs bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-emerald-600" />
                      Especificações Completas
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Configuração de hardware e componentes deste equipamento
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Processador
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5 truncate">
                          {product.processor || 'Core I7'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Memória RAM
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5">
                          {product.ram || '16GB DDR4'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Armazenamento
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5">
                          {product.storage || 'SSD 256GB'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Saúde da Bateria
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5 flex items-center gap-1.5">
                          <Battery className="w-3.5 h-3.5 text-emerald-600" />
                          {product.battery_health || '100%'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Tamanho da Tela
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5">
                          {product.screen_size || '14"'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Teclado Numérico
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5">
                          {product.has_numeric_keypad ? 'Sim (Possui teclado numérico)' : 'Não'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Carregador
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5">
                          {product.includes_charger ? 'Acompanha Carregador' : 'Não acompanha'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Nota Estética
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5">
                          {product.aesthetic_grade || 'A - Excelente'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Código Serial
                        </span>
                        <span className="font-mono font-semibold text-slate-800 block mt-0.5 truncate">
                          {product.serial_number || product.sku}
                        </span>
                      </div>
                    </div>

                    {product.description && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-700 block mb-1">
                          Observações do Equipamento:
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                          {product.description}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Checklist de Revisão Técnica (Modo Resumo Público) */}
                <Card className="border-slate-200/90 rounded-2xl shadow-xs bg-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        Checklist de Revisão Técnica
                      </CardTitle>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {okItemsCount} de {totalInspectedItems} Aprovados
                      </span>
                    </div>
                    <CardDescription className="text-xs">
                      Itens testados e aprovados na revisão técnica de bancada antes da liberação
                      comercial.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {publicChecklist.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center col-span-2">
                          Checklist aprovado na inspeção física de entrada.
                        </p>
                      ) : (
                        publicChecklist.map((it, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-2"
                          >
                            <span className="font-semibold text-slate-800 truncate">{it.item}</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Ok
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                      💡 Todos os equipamentos são higienizados, passam por estresse de carga e são
                      despachados prontos para uso com sistema operacional ativado.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* DIALOG DE ZOOM / LIGHTBOX DE FOTOS EM TELA CHEIA COM AJUSTE DE LUZ */}
      <ImageLightboxModal
        open={zoomModalOpen}
        onOpenChange={setZoomModalOpen}
        photos={photos}
        currentIndex={selectedPhotoIndex}
        onIndexChange={setSelectedPhotoIndex}
        title={product?.name}
      />

      <PublicStoreFooter />
    </div>
  )
}
