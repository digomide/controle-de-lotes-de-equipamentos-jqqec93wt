import React, { useState, useEffect, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Check, Link as LinkIcon, Cpu, Layers, HardDrive } from 'lucide-react'
import { MLSellerItem, formatProductConfigSpecs } from '@/services/mlService'
import { formatProductSpecs } from '@/components/MLItemMatchedProductsDisplay'

interface MLManualProductSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MLSellerItem | null
  onSelectProduct: (productId: string, mlItemId: string) => Promise<void>
}

interface ProductItemMini {
  id: string
  name: string
  sku: string
  brand?: string
  model?: string
  processor?: string
  ram?: string
  storage?: string
  screen_size?: string
  status?: string
  unit_price?: number
  ml_listing_id?: string
}

export function MLManualProductSelectorModal({
  open,
  onOpenChange,
  item,
  onSelectProduct,
}: MLManualProductSelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [products, setProducts] = useState<ProductItemMini[]>([])
  const [loading, setLoading] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)

  // Carregar produtos quando o modal abre
  useEffect(() => {
    if (!open) {
      setSearchTerm('')
      return
    }

    let isMounted = true
    setLoading(true)

    pb.collection('products')
      .getFullList<ProductItemMini>({
        fields:
          'id,name,sku,brand,model,processor,ram,storage,screen_size,status,unit_price,ml_listing_id',
        sort: '-created',
      })
      .then((records) => {
        if (isMounted) {
          setProducts(records)
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar produtos para seleção:', err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [open])

  // Filtrar produtos conforme a busca digitada
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return products.slice(0, 50)
    }
    const q = searchTerm.toLowerCase().trim()
    return products
      .filter((p) => {
        const nameMatch = (p.name || '').toLowerCase().includes(q)
        const skuMatch = (p.sku || '').toLowerCase().includes(q)
        const brandMatch = (p.brand || '').toLowerCase().includes(q)
        const modelMatch = (p.model || '').toLowerCase().includes(q)
        const procMatch = (p.processor || '').toLowerCase().includes(q)
        const ramMatch = (p.ram || '').toLowerCase().includes(q)
        const storageMatch = (p.storage || '').toLowerCase().includes(q)
        return (
          nameMatch || skuMatch || brandMatch || modelMatch || procMatch || ramMatch || storageMatch
        )
      })
      .slice(0, 50)
  }, [products, searchTerm])

  const handleLink = async (productId: string) => {
    if (!item) return
    setLinkingId(productId)
    try {
      await onSelectProduct(productId, item.id)
      onOpenChange(false)
    } finally {
      setLinkingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b border-slate-100">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-blue-600" />
            <span>Vincular Produto Interno ao Anúncio</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Selecione o equipamento do estoque que corresponde ao anúncio ML abaixo:
          </DialogDescription>

          {item && (
            <div className="mt-2 p-2.5 rounded-md bg-blue-50/70 border border-blue-200 text-xs">
              <div className="font-bold text-blue-950 line-clamp-2">{item.title}</div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-blue-800 font-mono">
                <span>MLB: {item.id}</span>
                <span>•</span>
                <span>Preço: R$ {Number(item.price || 0).toFixed(2)}</span>
                <span>•</span>
                <span>Estoque: {item.available_quantity} un</span>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Barra de Busca de Produtos */}
        <div className="relative my-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar produto por nome, SKU, modelo, processador ou RAM..."
            className="pl-9 h-9 text-xs"
            autoFocus
          />
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[260px]">
          {loading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Carregando estoque interno...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-1 text-slate-400 text-center">
              <span className="text-sm font-semibold">Nenhum produto encontrado</span>
              <span className="text-xs">
                Tente buscar por termos mais genéricos (ex: Thinkpad, i5, Latitude).
              </span>
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const specLine = formatProductSpecs(prod)
              const isAlreadyLinkedThis = prod.ml_listing_id === item?.id

              return (
                <div
                  key={prod.id}
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 transition-colors ${
                    isAlreadyLinkedThis
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 truncate" title={prod.name}>
                        {prod.name}
                      </span>
                      {prod.status && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[9px] uppercase font-mono font-semibold"
                        >
                          {prod.status}
                        </Badge>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                      <Cpu className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-medium">{specLine}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[10.5px] text-slate-400 font-mono">
                      <span>SKU: {prod.sku || 'S/ SKU'}</span>
                      {prod.unit_price && prod.unit_price > 0 && (
                        <span>• R$ {Number(prod.unit_price).toFixed(2)}</span>
                      )}
                      {prod.ml_listing_id && prod.ml_listing_id !== item?.id && (
                        <span className="text-amber-600 font-sans">
                          (já vinculado a {prod.ml_listing_id})
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={linkingId === prod.id}
                    onClick={() => handleLink(prod.id)}
                    className={`h-7 px-3 text-xs font-bold gap-1 shrink-0 cursor-pointer ${
                      isAlreadyLinkedThis
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {linkingId === prod.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isAlreadyLinkedThis ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <LinkIcon className="w-3 h-3" />
                    )}
                    <span>{isAlreadyLinkedThis ? 'Vinculado' : 'Vincular este'}</span>
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
