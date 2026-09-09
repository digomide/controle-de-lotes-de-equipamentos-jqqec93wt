import React, { useState, useEffect } from 'react'
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  ExternalLink,
  ShieldAlert,
  Info,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { kabumService } from '@/services/kabumService'
import { kabumCategoriesService, DEFAULT_KABUM_CATEGORIES } from '@/services/kabumCategoriesService'
import type { Product } from '@/types/inventory'
import type { KabumCategoryRecord } from '@/types/kabum'

interface BatchKabumPublishModalProps {
  isOpen: boolean
  onClose: () => void
  selectedProducts: Product[]
  hasKabumKey: boolean
  onSuccessFinished?: () => void
}

export function BatchKabumPublishModal({
  isOpen,
  onClose,
  selectedProducts,
  hasKabumKey,
  onSuccessFinished,
}: BatchKabumPublishModalProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<KabumCategoryRecord[]>([])

  const [selectedFamily, setSelectedFamily] = useState<string>('computadores')
  const [selectedSubfamily, setSelectedSubfamily] = useState<string>('notebooks')
  const [selectedCategory, setSelectedCategory] = useState<string>('nb-usados-recond')

  useEffect(() => {
    if (isOpen) {
      kabumCategoriesService.getAll().then((cats) => {
        setCategories(cats)
      })
    }
  }, [isOpen])

  const hierarchy = kabumCategoriesService.buildCategoryHierarchy(categories)
  const availableSubfamilies = hierarchy.getSubfamilies(selectedFamily)
  const availableCategories = hierarchy.getCategories(selectedFamily, selectedSubfamily)

  const handlePublish = async () => {
    if (!hasKabumKey) {
      toast({
        title: 'Chave do Kabum não configurada',
        description:
          'Configure sua chave de API nas Configurações para habilitar envios para o Kabum.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const productIds = selectedProducts.map((p) => p.id)
      const res = await kabumService.enqueuePublishProducts(productIds)

      toast({
        title: 'Fila do Kabum criada com sucesso!',
        description: `${res.enqueuedCount} equipamento(s) enfileirados para importação assíncrona Mirakl (P41).`,
      })

      if (onSuccessFinished) {
        onSuccessFinished()
      }
      onClose()
    } catch (err: any) {
      toast({
        title: 'Erro ao enfileirar',
        description: err?.message || 'Falha ao comunicar com o serviço do Kabum.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !submitting && !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ff6500]/10 border border-[#ff6500]/20 flex items-center justify-center text-[#ff6500] font-black text-sm">
              K!
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Anunciar no Kabum Marketplace (Mirakl)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Envio em lote via importação assíncrona P41 com mapeamento de categoria e ofertas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!hasKabumKey ? (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-amber-950">Chave de API do Kabum/Mirakl ausente</p>
                <p>
                  Para publicar ofertas e criar produtos no Kabum, cole a chave da API no menu{' '}
                  <strong>Configurações &gt; Kabum Marketplace</strong>.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo de itens selecionados */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span>{selectedProducts.length} equipamento(s) selecionado(s) para anúncio</span>
                <span className="font-mono text-emerald-600 font-bold">
                  Total: R${' '}
                  {selectedProducts
                    .reduce((sum, p) => sum + (Number(p.unit_price) || 0), 0)
                    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-slate-500">
                O Kabum receberá os títulos, descrições técnicas, fotos e preços de venda
                configurados em cada notebook.
              </p>
            </div>

            {/* Mapeamento de Categoria Mirakl H11 */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#ff6500]" /> Categoria Kabum (Árvore Mirakl
                H11)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px] text-slate-500 mb-1 block">Família</Label>
                  <Select
                    value={selectedFamily}
                    onValueChange={(val) => {
                      setSelectedFamily(val)
                      const subs = hierarchy.getSubfamilies(val)
                      if (subs.length > 0) {
                        setSelectedSubfamily(subs[0].id)
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hierarchy.families.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-slate-500 mb-1 block">Subfamília</Label>
                  <Select
                    value={selectedSubfamily}
                    onValueChange={(val) => setSelectedSubfamily(val)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubfamilies.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-slate-500 mb-1 block">Categoria Folha</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(val) => setSelectedCategory(val)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((c) => (
                        <SelectItem key={c.category_id} value={c.category_id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Informações de fluxo Mirakl */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-blue-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Info className="w-3.5 h-3.5 text-blue-600" /> Fluxo de Publicação Mirakl P41
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Ao confirmar, os produtos são enfileirados no worker assíncrono. O Mirakl processa a
                planilha de produtos e ofertas e gera o código de importação P42 com log de
                conformidade.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handlePublish}
            disabled={!hasKabumKey || submitting || selectedProducts.length === 0}
            className="bg-[#ff6500] hover:bg-[#e65c00] text-white font-semibold text-xs gap-1.5 shadow-xs"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1" />
            )}
            {submitting ? 'Enfileirando...' : `Confirmar e Enviar (${selectedProducts.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
