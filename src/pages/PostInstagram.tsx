import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Instagram,
  Copy,
  Check,
  Download,
  Calendar,
  Sparkles,
  Search,
  Laptop,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import type { Product, SocialPost } from '@/types/inventory'
import { STORE_CONFIG } from '@/lib/storeConfig'
import {
  type CaptionFormat,
  generateInstagramCaption,
  generatePostImage,
  getProductCoverPhoto,
} from '@/lib/instagramGenerator'
import { socialPostsService } from '@/services/socialPosts'

export default function PostInstagram() {
  const { toast } = useToast()

  // Lista de equipamentos disponíveis
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Gerador de legenda
  const [captionFormat, setCaptionFormat] = useState<CaptionFormat>('tecnico')
  const [editableCaption, setEditableCaption] = useState('')
  const [copied, setCopied] = useState(false)

  // Imagem do post
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  // Fila / Calendário de publicações
  const [postsQueue, setPostsQueue] = useState<SocialPost[]>([])
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [savingToQueue, setSavingToQueue] = useState(false)

  // Carregar produtos disponíveis
  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const records = await pb.collection('products').getFullList<Product>({
        filter: 'status = "Disponível"',
        sort: '-created',
      })
      setProducts(records)
      if (records.length > 0 && !selectedProduct) {
        setSelectedProduct(records[0])
      }
    } catch (err: any) {
      console.error('Erro ao buscar equipamentos:', err)
      toast({
        title: 'Erro ao carregar equipamentos',
        description: 'Não foi possível listar os notebooks disponíveis.',
        variant: 'destructive',
      })
    } finally {
      setLoadingProducts(false)
    }
  }

  // Carregar fila de posts
  const loadQueue = async () => {
    setLoadingQueue(true)
    try {
      const items = await socialPostsService.getAll()
      setPostsQueue(items)
    } catch (err) {
      console.error('Erro ao carregar fila:', err)
    } finally {
      setLoadingQueue(false)
    }
  }

  useEffect(() => {
    loadProducts()
    loadQueue()
  }, [])

  // Atualizar a legenda gerada sempre que mudar de produto ou de formato
  useEffect(() => {
    if (selectedProduct) {
      const text = generateInstagramCaption(selectedProduct, captionFormat)
      setEditableCaption(text)
      setGeneratedImageUrl(null)
      setImageError(null)
    }
  }, [selectedProduct, captionFormat])

  // Equipamentos filtrados pela busca
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return products
    return products.filter((p) => {
      return (
        p.name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.serial_number?.toLowerCase().includes(q) ||
        p.processor?.toLowerCase().includes(q)
      )
    })
  }, [products, searchQuery])

  // Gerar imagem do post via Canvas
  const handleGenerateImage = async () => {
    if (!selectedProduct) return
    setGeneratingImage(true)
    setImageError(null)

    try {
      const coverUrl = getProductCoverPhoto(selectedProduct)
      // Resolver URL absoluta para carregar no canvas
      const fullUrl = coverUrl.startsWith('/') ? `${window.location.origin}${coverUrl}` : coverUrl
      const dataUrl = await generatePostImage(fullUrl, selectedProduct, STORE_CONFIG.name)
      setGeneratedImageUrl(dataUrl)
      toast({
        title: 'Imagem gerada com sucesso!',
        description: 'Foto 1080x1080 com faixa AmbicorpFlow pronta para download.',
      })
    } catch (err: any) {
      console.error('Erro ao gerar imagem:', err)
      setImageError('Falha ao processar a foto no Canvas. Você ainda pode usar a imagem original.')
      toast({
        title: 'Erro ao gerar imagem',
        description: 'Não foi possível criar o post em 1080x1080.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingImage(false)
    }
  }

  // Download da imagem PNG gerada
  const handleDownloadImage = () => {
    if (!generatedImageUrl || !selectedProduct) return
    const link = document.createElement('a')
    const fileName = `post-insta-${(selectedProduct.model || selectedProduct.sku || 'notebook')
      .toLowerCase()
      .replace(/\s+/g, '-')}-1080x1080.png`
    link.download = fileName
    link.href = generatedImageUrl
    link.click()
  }

  // Copiar legenda para clipboard
  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(editableCaption)
      setCopied(true)
      toast({
        title: 'Legenda copiada!',
        description: 'Texto pronto para colar no Instagram.',
      })
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      toast({
        title: 'Erro ao copiar',
        description: 'Selecione o texto e copie manualmente.',
        variant: 'destructive',
      })
    }
  }

  // Adicionar à fila de publicações
  const handleAddToQueue = async () => {
    if (!selectedProduct) return
    setSavingToQueue(true)
    try {
      await socialPostsService.create({
        product_id: selectedProduct.id,
        status: 'Pendente',
        format: captionFormat,
        caption: editableCaption,
      })
      toast({
        title: 'Adicionado à fila!',
        description: `O ${selectedProduct.name} agora está marcado na fila de postagens.`,
      })
      loadQueue()
    } catch (err: any) {
      console.error('Erro ao adicionar à fila:', err)
      toast({
        title: 'Erro ao salvar na fila',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingToQueue(false)
    }
  }

  // Alternar status na fila (Marcar postado / pendente)
  const handleTogglePostStatus = async (item: SocialPost) => {
    try {
      if (item.status === 'Postado') {
        await socialPostsService.markAsPending(item.id)
        toast({ title: 'Marcado como pendente' })
      } else {
        await socialPostsService.markAsPosted(item.id)
        toast({ title: 'Marcado como postado no Instagram!' })
      }
      loadQueue()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  // Remover da fila
  const handleDeleteFromQueue = async (id: string) => {
    try {
      await socialPostsService.delete(id)
      toast({ title: 'Item removido da fila' })
      loadQueue()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white rounded-xl shadow-xs">
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Estúdio de Post para Instagram
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Gere legendas otimizadas, artes em 1080x1080 com faixa da marca e controle sua fila
                de divulgação.
              </p>
            </div>
          </div>
        </div>

        {/* Info Loja / WhatsApp e Atalho Fila Diária */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const queueSection = document.getElementById('fila-instagram-section')
              if (queueSection) {
                queueSection.scrollIntoView({ behavior: 'smooth' })
              }
            }}
            className="text-xs h-8 border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-rose-600" />
            Ir para fila diária do Instagram
          </Button>

          <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200">
            <span className="font-semibold">WhatsApp da loja:</span>
            <span>{STORE_CONFIG.whatsappDisplay}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA 1: Seleção de Equipamento (4 colunas) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-emerald-600" />
                  Equipamentos Disponíveis ({filteredProducts.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-500 hover:text-slate-800"
                  onClick={loadProducts}
                  title="Atualizar lista"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
              <CardDescription className="text-xs">
                Selecione o notebook que deseja divulgar no Instagram.
              </CardDescription>

              {/* Campo de Busca */}
              <div className="relative mt-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Buscar por modelo, marca, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
                />
              </div>
            </CardHeader>

            <CardContent className="p-2 pt-0 max-h-[600px] overflow-y-auto space-y-1.5">
              {loadingProducts ? (
                <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                  Carregando estoque disponível...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhum equipamento disponível encontrado.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const cover = getProductCoverPhoto(p)
                  const isSelected = selectedProduct?.id === p.id
                  const priceFormatted = Number(p.unit_price || 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProduct(p)}
                      className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center p-0.5">
                        <img
                          src={cover}
                          alt={p.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`font-bold text-xs truncate ${
                              isSelected ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {p.model || p.name}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.sku || p.serial_number}
                          </span>
                        </div>
                        <p
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {[p.processor, p.ram, p.storage].filter(Boolean).join(' · ')}
                        </p>
                        <p
                          className={`text-xs font-bold mt-1 ${
                            isSelected ? 'text-emerald-400' : 'text-emerald-700'
                          }`}
                        >
                          {priceFormatted}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA 2: Gerador de Legenda & Imagem 1080x1080 (8 colunas) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedProduct ? (
            <>
              {/* Card de Configuração e Geração */}
              <Card className="shadow-xs border-slate-200">
                <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                        >
                          {selectedProduct.brand || 'Notebook'}
                        </Badge>
                        <span className="text-xs font-mono text-slate-500">
                          {selectedProduct.sku}
                        </span>
                      </div>
                      <CardTitle className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                        {selectedProduct.name}
                      </CardTitle>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleAddToQueue}
                        disabled={savingToQueue}
                        variant="outline"
                        className="text-xs font-semibold gap-1.5 border-slate-300"
                      >
                        <Calendar className="w-3.5 h-3.5 text-rose-500" />
                        {savingToQueue ? 'Salvando...' : 'Adicionar à Fila'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-5">
                  {/* Seletor de Formato do Post */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                      Escolha o Tom / Formato do Post:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setCaptionFormat('tecnico')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          captionFormat === 'tecnico'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs mb-1">
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          Post Técnico
                        </div>
                        <p
                          className={`text-[11px] leading-relaxed ${
                            captionFormat === 'tecnico' ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          Specs detalhadas, checklist de 16 itens, condição e garantia.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCaptionFormat('urgencia')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          captionFormat === 'urgencia'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          Post de Urgência
                        </div>
                        <p
                          className={`text-[11px] leading-relaxed ${
                            captionFormat === 'urgencia' ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          "Última unidade!", tom de escassez e chamada rápida para WhatsApp.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCaptionFormat('lote')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          captionFormat === 'lote'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs mb-1">
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                          Post de Lote
                        </div>
                        <p
                          className={`text-[11px] leading-relaxed ${
                            captionFormat === 'lote' ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          Para revendedores e empresas: volume, atacado e nota fiscal.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Pré-visualização da Imagem 1080x1080 com Faixa */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Instagram className="w-4 h-4 text-rose-500" />
                          Imagem para Feed (1080x1080 PNG)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Foto centralizada com faixa profissional AmbicorpFlow, preço e WhatsApp.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleGenerateImage}
                          disabled={generatingImage}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          {generatingImage ? 'Gerando Canvas...' : 'Gerar Arte 1080x1080'}
                        </Button>

                        {generatedImageUrl && (
                          <Button
                            size="sm"
                            onClick={handleDownloadImage}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Baixar PNG
                          </Button>
                        )}
                      </div>
                    </div>

                    {imageError && (
                      <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-md">
                        {imageError}
                      </p>
                    )}

                    {generatedImageUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-lg border border-slate-200">
                        <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-200 shadow-md shrink-0 bg-white">
                          <img
                            src={generatedImageUrl}
                            alt="Post Instagram AmbicorpFlow"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                          <div className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Arte Pronta (1080 x 1080 px)
                          </div>
                          <p className="text-slate-700 font-medium">
                            Inclui selo de procedência garantida, valor à vista, WhatsApp e QR Code
                            de compra direta na loja online.
                          </p>
                          <p className="text-slate-400 text-[11px]">
                            Clique em <strong>Baixar PNG</strong> para salvar diretamente na sua
                            máquina e postar no feed.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg bg-white/60">
                        <p className="text-xs text-slate-500">
                          Clique em <strong>Gerar Arte 1080x1080</strong> para criar a imagem
                          formatada do post no navegador.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Caixa de Texto da Legenda (Editável) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        Legenda do Post (Pronta para Copiar):
                      </label>
                      <Button
                        size="sm"
                        onClick={handleCopyCaption}
                        className={`text-xs font-bold gap-1.5 transition-all ${
                          copied
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Legenda Copiada!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copiar Legenda
                          </>
                        )}
                      </Button>
                    </div>

                    <Textarea
                      rows={12}
                      value={editableCaption}
                      onChange={(e) => setEditableCaption(e.target.value)}
                      className="text-xs font-mono leading-relaxed bg-slate-50 border-slate-200 focus:bg-white resize-y"
                    />

                    <p className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>
                        Você pode editar o texto acima antes de copiar. Hashtags do nicho já
                        inclusas no final.
                      </span>
                      <span>{editableCaption.length} caracteres</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="py-24 text-center bg-white rounded-2xl border border-slate-200 p-8">
              <Laptop className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">Nenhum equipamento selecionado</h3>
              <p className="text-xs text-slate-400 mt-1">
                Escolha um dos notebooks disponíveis na coluna à esquerda para gerar o conteúdo.
              </p>
            </div>
          )}

          {/* Calendário e Fila de Publicações */}
          <Card id="fila-instagram-section" className="shadow-xs border-slate-200 scroll-mt-20">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-500" />
                  Fila de Publicação do Instagram ({postsQueue.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Acompanhe os equipamentos marcados para postagem e registre a data em que foram
                  publicados.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadQueue}
                className="text-xs text-slate-500 hover:text-slate-800 h-8"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Atualizar
              </Button>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              {loadingQueue ? (
                <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  Carregando fila...
                </div>
              ) : postsQueue.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  Nenhum post agendado na fila. Use o botão <strong>"Adicionar à Fila"</strong>{' '}
                  acima para organizar suas publicações.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {postsQueue.map((item) => {
                    const prod = item.expand?.product_id
                    const isPosted = item.status === 'Postado'

                    return (
                      <div
                        key={item.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {prod?.name || 'Notebook'}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold ${
                                isPosted
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {item.status}
                            </Badge>
                            {item.format && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase">
                                {item.format}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span>
                              Criado em:{' '}
                              {new Date(item.created).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {item.posted_at && (
                              <span className="text-emerald-700 font-medium">
                                Postado em:{' '}
                                {new Date(item.posted_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Copiar legenda do item salvo */}
                          {item.caption && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(item.caption || '')
                                toast({ title: 'Legenda copiada do histórico!' })
                              }}
                              className="text-xs h-8 text-slate-600"
                              title="Copiar legenda deste post"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* Alternar status */}
                          <Button
                            variant={isPosted ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handleTogglePostStatus(item)}
                            className={`text-xs h-8 font-semibold ${
                              isPosted
                                ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {isPosted ? 'Desmarcar' : 'Marcar como Postado'}
                          </Button>

                          {/* Remover */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteFromQueue(item.id)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600"
                            title="Remover da fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
