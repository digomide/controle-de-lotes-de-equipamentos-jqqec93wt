import React, { useState, useEffect, useMemo } from 'react'
import {
  Video,
  Copy,
  Check,
  Download,
  Calendar,
  Sparkles,
  Search,
  Laptop,
  CheckCircle2,
  Layers,
  FileText,
  RefreshCw,
  ExternalLink,
  Trash2,
  TrendingUp,
  Store,
  Building,
  CreditCard,
  Truck,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
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
  type TikTokCaptionFormat,
  generateTikTokCaption,
  generateTikTokPostImage,
  getProductCoverPhoto,
} from '@/lib/tiktokGenerator'
import { socialPostsService } from '@/services/socialPosts'

// Checklist das etapas do Seller Center TikTok Brasil
interface SellerStep {
  id: string
  title: string
  subtitle: string
  details: string
  category: 'cadastro' | 'documentos' | 'operacao' | 'catalogo'
  link?: string
  linkText?: string
}

const SELLER_CENTER_STEPS: SellerStep[] = [
  {
    id: 'step_account',
    category: 'cadastro',
    title: '1. Criar conta no TikTok Seller Center Brasil',
    subtitle: 'Acesse seller.tiktok.com ou baixe o app TikTok Seller',
    details:
      'Crie ou conecte sua conta de vendedor utilizando o e-mail corporativo ou seu login TikTok comercial. Selecione o país "Brasil" para operar sob as regras e logística nacionais (lançadas oficialmente em 2025).',
    link: 'https://seller-br.tiktok.com',
    linkText: 'Acessar TikTok Seller Center Brasil',
  },
  {
    id: 'step_cnpj',
    category: 'documentos',
    title: '2. Cadastro do CNPJ da Ambicorp',
    subtitle: 'Conta corporativa Pessoa Jurídica (PJ) no seu nome',
    details:
      'Selecione o tipo de vendedor como "Pessoa Jurídica (Empresa)". Insira a Razão Social, Nome Fantasia, CNPJ da Ambicorp e o CNAE correspondente (comércio de equipamentos de informática).',
  },
  {
    id: 'step_rep_legal',
    category: 'documentos',
    title: '3. Envio de Documento do Responsável Legal',
    subtitle: 'CNH ou RG do titular da empresa e comprovante',
    details:
      'Envie foto nítida frente e verso da CNH ou RG do responsável legal pelo CNPJ, além do Contrato Social / Certificado MEI e comprovante de endereço comercial recente em nome da empresa.',
  },
  {
    id: 'step_bank',
    category: 'operacao',
    title: '4. Configuração de Conta Bancária PJ',
    subtitle: 'Conta bancária com a mesma titularidade do CNPJ',
    details:
      'Cadastre a conta corrente PJ da Ambicorp para recebimento automático dos repasses das vendas. O TikTok Shop valida que a chave/dados pertençam ao mesmo CNPJ cadastrado.',
  },
  {
    id: 'step_warehouse',
    category: 'operacao',
    title: '5. Endereço de Coleta e Logística (Envios)',
    subtitle: 'Definição do endereço do galpão/bancada para coleta das transportadoras',
    details:
      'Configure o endereço oficial de expedição (Belo Horizonte / MG) e a política de retorno/devolução. O TikTok Shop Brasil oferece integração direta com transportadoras parceiras (coleta no endereço).',
  },
  {
    id: 'step_catalog',
    category: 'catalogo',
    title: '6. Primeiro Cadastro de Produtos & Próxima Etapa de API',
    subtitle: 'Cadastro manual dos primeiros notebooks e preparação para integração via API',
    details:
      'Você pode cadastrar os primeiros notebooks manualmente no Seller Center com as fotos e especificações geradas aqui no Estúdio. Assim como no Mercado Livre, a próxima etapa será conectar a API oficial do TikTok Shop para sincronizar todo o catálogo direto do AmbicorpFlow!',
  },
]

const STORAGE_KEY_CHECKLIST = 'ambicorp_tiktok_seller_checklist'

export default function PostTikTok() {
  const { toast } = useToast()

  // Aba ativa: 'estudio' | 'seller_center' | 'fila'
  const [activeTab, setActiveTab] = useState<'estudio' | 'seller_center' | 'fila'>('estudio')

  // Lista de equipamentos disponíveis
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Gerador de legenda
  const [captionFormat, setCaptionFormat] = useState<TikTokCaptionFormat>('achadinho')
  const [editableCaption, setEditableCaption] = useState('')
  const [copied, setCopied] = useState(false)

  // Imagem do post vertical (1080x1920)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  // Fila / Calendário de publicações
  const [postsQueue, setPostsQueue] = useState<SocialPost[]>([])
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [savingToQueue, setSavingToQueue] = useState(false)

  // Checklist do Seller Center (persistido no localStorage)
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHECKLIST)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

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

  // Carregar fila de posts (focando em TikTok ou todos com filtro)
  const loadQueue = async () => {
    setLoadingQueue(true)
    try {
      // Priorizar posts com platform = 'tiktok' ou listar todos
      const items = await socialPostsService.getAll("platform = 'tiktok' || platform = ''")
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

  // Atualizar a legenda sempre que mudar o produto ou o formato
  useEffect(() => {
    if (selectedProduct) {
      const text = generateTikTokCaption(selectedProduct, captionFormat)
      setEditableCaption(text)
      setGeneratedImageUrl(null)
      setImageError(null)
    }
  }, [selectedProduct, captionFormat])

  // Alternar checkbox de etapa do Seller Center
  const toggleStep = (stepId: string) => {
    setCheckedSteps((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] }
      try {
        localStorage.setItem(STORAGE_KEY_CHECKLIST, JSON.stringify(next))
      } catch (err) {
        console.error('Erro ao salvar checklist:', err)
      }
      return next
    })
  }

  const completedStepsCount = useMemo(() => {
    return SELLER_CENTER_STEPS.filter((s) => checkedSteps[s.id]).length
  }, [checkedSteps])

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

  // Gerar imagem 1080x1920 (9:16) via Canvas
  const handleGenerateImage = async () => {
    if (!selectedProduct) return
    setGeneratingImage(true)
    setImageError(null)

    try {
      const coverUrl = getProductCoverPhoto(selectedProduct)
      const fullUrl = coverUrl.startsWith('/') ? `${window.location.origin}${coverUrl}` : coverUrl
      const dataUrl = await generateTikTokPostImage(fullUrl, selectedProduct, STORE_CONFIG.name)
      setGeneratedImageUrl(dataUrl)
      toast({
        title: 'Arte vertical gerada com sucesso!',
        description: 'Formato 1080x1920 (9:16) pronto para TikTok Shop e Stories.',
      })
    } catch (err: any) {
      console.error('Erro ao gerar imagem:', err)
      setImageError('Falha ao processar a foto no Canvas. Tente novamente ou use a foto original.')
      toast({
        title: 'Erro ao gerar imagem',
        description: 'Não foi possível criar a arte em 1080x1920.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingImage(false)
    }
  }

  // Download do PNG gerado em 1080x1920
  const handleDownloadImage = () => {
    if (!generatedImageUrl || !selectedProduct) return
    const link = document.createElement('a')
    const fileName = `post-tiktok-${(selectedProduct.model || selectedProduct.sku || 'notebook')
      .toLowerCase()
      .replace(/\s+/g, '-')}-1080x1920.png`
    link.download = fileName
    link.href = generatedImageUrl
    link.click()
  }

  // Copiar legenda para o clipboard
  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(editableCaption)
      setCopied(true)
      toast({
        title: 'Legenda copiada!',
        description: 'Texto pronto para colar no TikTok.',
      })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Selecione o texto e copie manualmente.',
        variant: 'destructive',
      })
    }
  }

  // Adicionar à fila de publicações com platform 'tiktok'
  const handleAddToQueue = async () => {
    if (!selectedProduct) return
    setSavingToQueue(true)
    try {
      await socialPostsService.create({
        product_id: selectedProduct.id,
        status: 'Pendente',
        format: captionFormat,
        platform: 'tiktok',
        caption: editableCaption,
        notes: 'Estúdio de Post TikTok',
      })
      toast({
        title: 'Adicionado à fila do TikTok!',
        description: `${selectedProduct.name} entrou na lista de publicações agendadas.`,
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

  // Alternar status na fila
  const handleTogglePostStatus = async (item: SocialPost) => {
    try {
      if (item.status === 'Postado') {
        await socialPostsService.markAsPending(item.id)
        toast({ title: 'Marcado como pendente' })
      } else {
        await socialPostsService.markAsPosted(item.id)
        toast({ title: 'Marcado como postado no TikTok!' })
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

  // Excluir item da fila
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
      {/* Cabeçalho da Tela com tema TikTok (escuro com acentos ciano e magenta) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 bg-slate-900 text-white rounded-xl shadow-xs border border-slate-800 flex items-center justify-center">
              <Video className="w-5 h-5 text-cyan-400" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Estúdio de Post TikTok & Seller Center
                </h1>
                <Badge className="bg-slate-900 text-cyan-300 hover:bg-slate-900 text-[10px] border border-cyan-500/30">
                  TikTok Shop Brasil 2025
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Gere artes verticais em 1080×1920 (9:16), legendas virais e configure sua loja
                vendedora no TikTok Shop.
              </p>
            </div>
          </div>
        </div>

        {/* Status Meta e Canal Alternativo */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs bg-cyan-50 text-cyan-900 px-3 py-1.5 rounded-lg border border-cyan-200 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-700" />
            <span>Canal liberado: sem bloqueios de Meta</span>
          </div>

          <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200">
            <span className="font-semibold">WhatsApp:</span>
            <span>{STORE_CONFIG.whatsappDisplay}</span>
          </div>
        </div>
      </div>

      {/* Navegação entre Abas Principais */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-1.5 rounded-xl border border-slate-200">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto h-9 bg-slate-100 p-1">
            <TabsTrigger
              value="estudio"
              className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
            >
              <Video className="w-3.5 h-3.5 text-cyan-600" />
              Estúdio de Post
            </TabsTrigger>
            <TabsTrigger
              value="seller_center"
              className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
            >
              <Store className="w-3.5 h-3.5 text-emerald-600" />
              Guia Seller Center
              {completedStepsCount > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                  {completedStepsCount}/{SELLER_CENTER_STEPS.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="fila"
              className="text-xs font-semibold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5 text-rose-600" />
              Fila de Publicações
              {postsQueue.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 font-mono">
                  {postsQueue.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="text-[11px] text-slate-500 px-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Formato nativo para TikTok: 1080×1920 (9:16)</span>
          </div>
        </div>

        {/* ================= ABA 1: ESTÚDIO DE POST TIKTOK ================= */}
        <TabsContent value="estudio" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna 1: Lista de Equipamentos (4 cols) */}
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
                    Selecione o notebook disponível para gerar a arte vertical e a legenda viral.
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

                <CardContent className="p-2 pt-0 max-h-[620px] overflow-y-auto space-y-1.5">
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
                                    ? 'bg-cyan-500/20 text-cyan-300'
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
                                isSelected ? 'text-cyan-400' : 'text-emerald-700'
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

            {/* Coluna 2: Configuração, Formatos de Legenda e Canvas 1080x1920 (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {selectedProduct ? (
                <>
                  <Card className="shadow-xs border-slate-200">
                    <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="bg-cyan-50 text-cyan-700 border-cyan-200 text-xs"
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
                            {savingToQueue ? 'Salvando...' : 'Adicionar à Fila TikTok'}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 space-y-5">
                      {/* Seletor de Formato de Legenda Viral */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                          Escolha a Narrativa / Formato do Post:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setCaptionFormat('achadinho')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              captionFormat === 'achadinho'
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 font-bold text-xs mb-1">
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                              Achei Desse Jeito
                            </div>
                            <p
                              className={`text-[11px] leading-relaxed ${
                                captionFormat === 'achadinho' ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              Narrativa de descoberta, custo-benefício surpreendente e recomendação
                              casual.
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
                              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                              Última Unidade
                            </div>
                            <p
                              className={`text-[11px] leading-relaxed ${
                                captionFormat === 'urgencia' ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              Gatilho de escassez forte: preço vai subir quando acabar esse lote!
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCaptionFormat('revendedor')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              captionFormat === 'revendedor'
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 font-bold text-xs mb-1">
                              <Layers className="w-3.5 h-3.5 text-emerald-400" />
                              Para Revendedores
                            </div>
                            <p
                              className={`text-[11px] leading-relaxed ${
                                captionFormat === 'revendedor' ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              Venda por volume / atacado para lojas de informática e empresas.
                            </p>
                          </button>
                        </div>
                      </div>

                      {/* Bloco de Geração de Imagem Vertical 1080x1920 (9:16) */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-cyan-600" />
                              Arte Vertical para TikTok (1080×1920 px · 9:16)
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Foto em crop central, selo de procedência garantida, faixa
                              AmbicorpFlow, specs, valor à vista e QR Code direto da loja.
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={handleGenerateImage}
                              disabled={generatingImage}
                              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                              {generatingImage ? 'Renderizando Canvas...' : 'Gerar Arte 1080×1920'}
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
                          <div className="flex flex-col sm:flex-row items-center gap-6 bg-white p-4 rounded-lg border border-slate-200">
                            {/* Preview Vertical Proporcional 9:16 */}
                            <div className="relative w-44 h-80 rounded-xl overflow-hidden border border-slate-300 shadow-lg shrink-0 bg-slate-950 flex items-center justify-center">
                              <img
                                src={generatedImageUrl}
                                alt="Post TikTok AmbicorpFlow"
                                className="w-full h-full object-contain"
                              />
                            </div>

                            <div className="space-y-2 text-xs text-slate-600">
                              <div className="inline-flex items-center gap-1 text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded text-xs font-bold border border-cyan-200">
                                <CheckCircle2 className="w-4 h-4 text-cyan-600" />
                                Formato Vertical 9:16 (1080 × 1920 px)
                              </div>
                              <p className="text-slate-800 font-semibold text-sm">
                                Perfeito para TikTok Shop, Reels e Stories.
                              </p>
                              <ul className="space-y-1 text-slate-600 text-xs">
                                <li>• Selo "RECONDICIONADO · PROCEDÊNCIA GARANTIDA"</li>
                                <li>• Foto de capa centralizada respeitando ordenação</li>
                                <li>• Destaque visual do preço à vista e specs</li>
                                <li>• QR Code escaneável de compra rápida na loja pública</li>
                                <li>• WhatsApp: {STORE_CONFIG.whatsappDisplay}</li>
                              </ul>
                              <div className="pt-2">
                                <Button
                                  size="sm"
                                  onClick={handleDownloadImage}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Baixar PNG em Alta Resolução
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg bg-white/60">
                            <p className="text-xs text-slate-500">
                              Clique em <strong>Gerar Arte 1080×1920</strong> para renderizar a
                              imagem vertical de alta qualidade diretamente no seu navegador.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Legenda do Post do TikTok */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-cyan-600" />
                            Legenda TikTok (Casual, Viral e Otimizada):
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
                          rows={11}
                          value={editableCaption}
                          onChange={(e) => setEditableCaption(e.target.value)}
                          className="text-xs font-mono leading-relaxed bg-slate-50 border-slate-200 focus:bg-white resize-y"
                        />

                        <p className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span>
                            Hashtags do nicho (#tiktokbrasil, #achadinhos, marca) e link da loja
                            inclusos.
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
                  <h3 className="text-base font-bold text-slate-700">
                    Nenhum equipamento selecionado
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Escolha um dos notebooks disponíveis na coluna à esquerda para gerar o conteúdo
                    do TikTok.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ================= ABA 2: GUIA DO SELLER CENTER TIKTOK BRASIL ================= */}
        <TabsContent value="seller_center" className="mt-0 space-y-6">
          {/* Card explicativo e visão geral */}
          <Card className="shadow-xs border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-xs">
                      TikTok Shop Brasil · 2025
                    </Badge>
                    <span className="text-xs text-slate-400">Canal Comercial Direto</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    Passo a Passo: Abrir sua Loja de Vendedor no TikTok Seller Center
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    Com a restrição temporária da Meta no seu perfil pessoal (até 19/12), o TikTok
                    Shop é o canal ideal que opera de forma totalmente independente. Siga o
                    checklist abaixo para habilitar suas vendas diretas como Pessoa Jurídica (CNPJ
                    Ambicorp).
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-800/80 rounded-xl border border-slate-700 shrink-0 min-w-[200px]">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    Progresso da Loja
                  </span>
                  <div className="text-3xl font-extrabold text-cyan-400 mt-1">
                    {completedStepsCount} / {SELLER_CENTER_STEPS.length}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">etapas concluídas</p>
                  <div className="w-full bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full transition-all duration-300"
                      style={{
                        width: `${(completedStepsCount / SELLER_CENTER_STEPS.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checklist de Etapas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SELLER_CENTER_STEPS.map((step) => {
              const isChecked = Boolean(checkedSteps[step.id])

              return (
                <div
                  key={step.id}
                  onClick={() => toggleStep(step.id)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all flex items-start gap-3.5 select-none ${
                    isChecked
                      ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                      isChecked
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4
                        className={`text-sm font-bold ${
                          isChecked ? 'text-emerald-900 line-through' : 'text-slate-900'
                        }`}
                      >
                        {step.title}
                      </h4>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-mono ${
                          step.category === 'cadastro'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : step.category === 'documentos'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : step.category === 'operacao'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {step.category}
                      </Badge>
                    </div>

                    <p className="text-xs font-semibold text-slate-600">{step.subtitle}</p>
                    <p className="text-xs text-slate-500 leading-relaxed pt-1">{step.details}</p>

                    {step.link && (
                      <div className="pt-2">
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs text-cyan-700 hover:text-cyan-800 font-bold hover:underline"
                        >
                          {step.linkText || 'Abrir link oficial'}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Nota Transparente sobre Próximos Passos (Integração de Catálogo via API) */}
          <Card className="border-cyan-200 bg-cyan-50/50 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-cyan-100 text-cyan-800 rounded-lg shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 text-xs text-cyan-950">
                  <h4 className="font-bold text-sm text-cyan-900">
                    Próxima etapa: Integração automatizada de catálogo via API do TikTok Shop
                  </h4>
                  <p className="leading-relaxed text-cyan-900/90">
                    Assim como construímos a integração completa do <strong>Mercado Livre</strong>{' '}
                    (com publicação individual e em lote, mapeamento de GTIN, fotos em nuvem e
                    condição técnica), a sincronização automática do catálogo com o TikTok Shop
                    depende apenas de você ter a conta de vendedor aprovada no Seller Center.
                  </p>
                  <p className="leading-relaxed text-cyan-900/90">
                    Enquanto a aprovação de documentos ocorre no TikTok Seller Center, você já pode
                    utilizar o <strong>Estúdio de Post TikTok</strong> para publicar fotos verticais
                    em 1080×1920 com QR Code de compra e divulgar notebooks nos vídeos e posts
                    virais.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= ABA 3: FILA DE PUBLICAÇÕES TIKTOK ================= */}
        <TabsContent value="fila" className="mt-0">
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-500" />
                  Fila de Publicações TikTok ({postsQueue.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Controle os notebooks programados para postagem no TikTok e marque quando forem ao
                  ar.
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
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" />
                  Carregando fila...
                </div>
              ) : postsQueue.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  Nenhum post agendado na fila do TikTok. Selecione um equipamento no{' '}
                  <strong>Estúdio de Post</strong> e clique em "Adicionar à Fila TikTok".
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
                            {item.platform && (
                              <span className="text-[10px] bg-cyan-50 text-cyan-800 border border-cyan-200 px-1.5 py-0.5 rounded font-semibold uppercase">
                                {item.platform}
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

                          <Button
                            variant={isPosted ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handleTogglePostStatus(item)}
                            className={`text-xs h-8 font-semibold ${
                              isPosted
                                ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                            }`}
                          >
                            {isPosted ? 'Desmarcar' : 'Marcar como Postado'}
                          </Button>

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
        </TabsContent>
      </Tabs>
    </div>
  )
}
