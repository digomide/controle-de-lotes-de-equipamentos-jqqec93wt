import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import type { Product } from '@/types/inventory'
import {
  mlService,
  generateMLTitle,
  generateMLDescription,
  getProductImageUrls,
  ML_CATEGORIES,
  type MLStatusResponse,
} from '@/services/mlService'
import {
  ShoppingBag,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Settings,
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface SingleMLPublishModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  onPublished?: (updatedProduct: Product) => void
}

export function SingleMLPublishModal({
  isOpen,
  onClose,
  product,
  onPublished,
}: SingleMLPublishModalProps) {
  const { toast } = useToast()

  const [loadingStatus, setLoadingStatus] = useState(true)
  const [mlStatus, setMlStatus] = useState<MLStatusResponse | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Campos do formulário de anúncio
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [categoryId, setCategoryId] = useState('MLB1652')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
      setPublishing(false)
      setTitle(generateMLTitle(product))
      setPrice(Number(product.unit_price) || 0)
      setCategoryId('MLB1652')
      setDescription(generateMLDescription(product))
      setPhotos(getProductImageUrls(product))

      // Checar status de conexão do ML
      setLoadingStatus(true)
      mlService
        .getStatus()
        .then((st) => setMlStatus(st))
        .catch(() => setMlStatus(null))
        .finally(() => setLoadingStatus(false))
    }
  }, [isOpen, product])

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!title.trim()) {
      setErrorMessage('O título do anúncio é obrigatório.')
      return
    }

    if (title.length > 60) {
      setErrorMessage(
        `O título excede 60 caracteres (atual: ${title.length}). Encurte para prosseguir.`,
      )
      return
    }

    if (!price || price <= 0) {
      setErrorMessage('Informe um preço de venda válido maior que zero.')
      return
    }

    if (photos.length === 0) {
      setErrorMessage('É obrigatório ter pelo menos 1 foto acessível publicamente.')
      return
    }

    setPublishing(true)
    try {
      const res = await mlService.publish({
        product_id: product.id,
        title: title.trim(),
        price: Number(price),
        category_id: categoryId,
        description: description.trim(),
        pictures: photos,
      })

      if (res.success) {
        toast({
          title: 'Anúncio publicado com sucesso no Mercado Livre!',
          description: `ID do anúncio: ${res.ml_listing_id}`,
        })

        if (onPublished) {
          onPublished({
            ...product,
            ml_listing_id: res.ml_listing_id,
            ml_listing_url: res.ml_listing_url,
            ml_listing_status: res.ml_listing_status,
            ml_published_at: new Date().toISOString(),
          })
        }
        onClose()
      } else {
        setErrorMessage(res.error || 'Falha desconhecida ao publicar anúncio.')
      }
    } catch (err: any) {
      console.error('Erro na publicação ML:', err)
      const msg =
        err?.data?.error || err?.message || 'Erro ao comunicar com a API do Mercado Livre.'
      setErrorMessage(msg)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ffe600] border border-amber-400 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Anunciar Equipamento no Mercado Livre
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Revise os dados antes do envio oficial para o catálogo do Mercado Livre
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingStatus ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs">Verificando autorização do Mercado Livre...</span>
          </div>
        ) : !mlStatus?.connected ? (
          /* Estado: Mercado Livre não conectado */
          <div className="py-6 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Conta Mercado Livre não conectada
              </div>
              <p className="text-amber-800">
                Para publicar anúncios automaticamente, você precisa vincular sua conta do Mercado
                Livre em Configurações.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Como funciona:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Crie um App gratuito no portal developers.mercadolivre.com.br;</li>
                <li>Cadastre o Client ID e Secret na tela de Configurações do sistema;</li>
                <li>Clique em Conectar e autorize o acesso da loja à sua conta ML.</li>
              </ul>
            </div>

            <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Fechar
              </Button>
              <Link to="/configuracoes">
                <Button className="bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 font-bold text-xs gap-1.5 h-9">
                  <Settings className="w-3.5 h-3.5" />
                  Ir para Configurações do Mercado Livre
                </Button>
              </Link>
            </DialogFooter>
          </div>
        ) : (
          /* Formulário de Revisão do Anúncio */
          <form onSubmit={handlePublish} className="space-y-4 text-xs pt-1">
            {/* Aviso de Conta Conectada */}
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Conectado como <strong>{mlStatus.nickname || 'Vendedor ML'}</strong>
              </span>
              <span className="text-[11px] text-emerald-700 font-mono">Conta Oficial</span>
            </div>

            {/* Mensagem de Erro da API se houver */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Não foi possível publicar no Mercado Livre:</p>
                  <p className="text-[11px] leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Título do Anúncio (máximo 60 caracteres) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700 font-semibold">
                  Título do Anúncio (máx. 60 caracteres) *
                </Label>
                <span
                  className={`text-[11px] font-mono ${
                    title.length > 60
                      ? 'text-rose-600 font-bold'
                      : title.length >= 50
                        ? 'text-amber-600 font-semibold'
                        : 'text-slate-400'
                  }`}
                >
                  {title.length}/60
                </span>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                className="text-xs bg-white h-9"
                placeholder="Ex: Dell Latitude 5320 Core i7 16GB SSD 256GB"
                required
              />
              <p className="text-[11px] text-slate-400">
                O Mercado Livre exige título claro com marca, modelo e specs principais.
              </p>
            </div>

            {/* Linha com Preço, Categoria e Condição */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-700 font-semibold">Preço de Venda (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={price || ''}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="text-xs bg-white h-9 font-mono font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-700 font-semibold">Categoria ML</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="text-xs bg-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ML_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-slate-700 font-semibold">Condição & Estoque</Label>
                <div className="h-9 px-3 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-between text-slate-700">
                  <Badge variant="outline" className="bg-white text-slate-800 text-[11px]">
                    Usado (Used)
                  </Badge>
                  <span className="text-[11px] font-mono">Qtd: 1 un</span>
                </div>
              </div>
            </div>

            {/* Fotos que serão enviadas */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold flex items-center justify-between">
                <span>Fotos do Anúncio ({photos.length})</span>
                <span className="text-[11px] text-slate-400">URLs públicas do equipamento</span>
              </Label>
              {photos.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Nenhuma foto cadastrada. O Mercado Livre exige pelo menos 1 imagem válida.
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {photos.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-14 rounded-md overflow-hidden border border-slate-200 shrink-0 bg-white shadow-2xs group"
                    >
                      <img
                        src={url}
                        alt={`Foto ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).src =
                            'https://img.usecurling.com/p/200/200?q=laptop'
                        }}
                      />
                      <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[9px] px-1 rounded-tl">
                        #{i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Descrição do Anúncio */}
            <div className="space-y-1">
              <Label className="text-slate-700 font-semibold flex items-center justify-between">
                <span>Descrição Completa (Texto Puro)</span>
                <span className="text-[11px] text-slate-400">Editável para este anúncio</span>
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                className="text-xs bg-white font-mono leading-relaxed"
                placeholder="Detalhes, especificações e contato..."
              />
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Inclui especificações, checklist dos 16 itens e dados de contato da AMbicorpFlow.
              </p>
            </div>

            <DialogFooter className="flex sm:justify-between items-center gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={publishing}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={publishing || photos.length === 0}
                className="bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-sm"
              >
                {publishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando ao Mercado Livre...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Confirmar e Publicar Anúncio
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
