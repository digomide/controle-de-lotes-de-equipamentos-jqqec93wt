import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Loader2, Copy, Check, Boxes, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { purchaseBatchesService } from '@/services/purchaseBatches'
import { productsService } from '@/services/products'
import { equipmentService } from '@/services/equipment'
import type { PurchaseBatch, Product, EquipmentPart } from '@/types/inventory'

interface CloneEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSuccess?: (createdCount: number, targetBatchId: string) => void
}

interface BatchStats extends PurchaseBatch {
  inventoriedCount: number
  missingCount: number
  costBasePerItem: number
}

export function CloneEquipmentModal({
  open,
  onOpenChange,
  product,
  onSuccess,
}: CloneEquipmentModalProps) {
  const { toast } = useToast()
  const navigate = useNavigate()

  // Form states
  const [copiesCount, setCopiesCount] = useState<number>(1)
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [family, setFamily] = useState<string>('Notebooks')
  const [title, setTitle] = useState<string>('')
  const [brand, setBrand] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [serialNumber, setSerialNumber] = useState<string>('')

  // Batch listing and additional costs info
  const [allBatches, setAllBatches] = useState<BatchStats[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [originalParts, setOriginalParts] = useState<EquipmentPart[]>([])
  const [isCloning, setIsCloning] = useState(false)

  useEffect(() => {
    if (open && product) {
      // Pre-fill fields from original product
      setCopiesCount(1)
      setFamily(product.category || 'Notebooks')
      setTitle(product.name || '')
      setBrand(product.brand || '')
      setModel(product.model || '')
      setSerialNumber('') // Always starts empty as required ("SN... VAZIO por padrão")
      setSelectedBatchId(product.purchase_batch_id || '')

      loadData(product)
    }
  }, [open, product])

  const loadData = async (targetProduct: Product) => {
    setLoadingBatches(true)
    try {
      // Load parts of original product to report count and duplicate them
      const parts = await equipmentService.getPartsByProduct(targetProduct.id)
      setOriginalParts(parts)

      // Load all batches
      const batches = await purchaseBatchesService.getAll()
      const statsList: BatchStats[] = await Promise.all(
        batches.map(async (b) => {
          try {
            const prods = await purchaseBatchesService.getProductsByBatchId(b.id)
            const count = prods.length
            const expected = Number(b.expected_quantity) || 1
            const missing = Math.max(0, expected - count)
            const cost = Number(b.total_cost) || 0
            const costBase = expected > 0 ? Math.round(cost / expected) : 0
            return {
              ...b,
              inventoriedCount: count,
              missingCount: missing,
              costBasePerItem: costBase,
            }
          } catch {
            const expected = Number(b.expected_quantity) || 1
            const cost = Number(b.total_cost) || 0
            return {
              ...b,
              inventoriedCount: 0,
              missingCount: expected,
              costBasePerItem: expected > 0 ? Math.round(cost / expected) : 0,
            }
          }
        }),
      )

      setAllBatches(statsList)
      if (!selectedBatchId && statsList.length > 0) {
        setSelectedBatchId(statsList[0].id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingBatches(false)
    }
  }

  const selectedBatch = allBatches.find((b) => b.id === selectedBatchId)
  const availableCapacity = selectedBatch ? selectedBatch.missingCount : 0
  const additionalCostsCount = originalParts.length

  const handleCopiesChange = (val: number) => {
    const validVal = Math.max(1, Math.min(99, val || 1))
    setCopiesCount(validVal)
    if (validVal > 1) {
      // "Números de série são deixados em branco ao criar várias peças."
      setSerialNumber('')
    }
  }

  const handleConfirmClone = async () => {
    if (!product) return

    if (!selectedBatchId) {
      toast({
        title: 'Selecione o lote de origem',
        description: 'É necessário vincular o(s) clone(s) a um lote de compra.',
        variant: 'destructive',
      })
      return
    }

    if (!title.trim()) {
      toast({
        title: 'Título do equipamento obrigatório',
        description: 'Informe o título do equipamento para os clones.',
        variant: 'destructive',
      })
      return
    }

    setIsCloning(true)
    const createdProductIds: string[] = []
    const createdPartIds: string[] = []

    try {
      // "A operação é única/transactions: ou cria todas as cópias ou nenhuma; nunca deixar estado parcial."
      for (let i = 0; i < copiesCount; i++) {
        const uniqueSuffix = Math.random().toString(36).substring(2, 7).toUpperCase()
        const skuGenerated =
          copiesCount === 1 && serialNumber.trim()
            ? serialNumber.trim()
            : `${(product.brand || 'EQ').toUpperCase().substring(0, 3)}-${Date.now().toString().slice(-4)}${uniqueSuffix}`

        const singleSerial = copiesCount === 1 ? serialNumber.trim() : ''

        // Prepare copy payload with all original product data (specs, photos, images, checklist)
        const newProductPayload: Partial<Product> = {
          name: title.trim(),
          brand: brand.trim() || product.brand,
          model: model.trim() || product.model,
          category: family,
          sku: skuGenerated,
          code: `EQ-${new Date().getFullYear()}-${uniqueSuffix}`,
          serial_number: singleSerial || undefined,
          purchase_batch_id: selectedBatchId,
          processor: product.processor,
          ram: product.ram,
          storage: product.storage,
          condition: product.condition || 'Excelente',
          aesthetic_grade: product.aesthetic_grade || 'A - Excelente',
          battery_health: product.battery_health || '100%',
          screen_size: product.screen_size,
          has_numeric_keypad: product.has_numeric_keypad,
          includes_charger: product.includes_charger,
          bench_notes: product.bench_notes,
          description: product.description,
          unit_price: Number(product.unit_price) || 0,
          cost_price: Number(product.cost_price) || selectedBatch?.costBasePerItem || 0,
          status: 'Disponível',
          images: Array.isArray(product.images) ? [...product.images] : [],
          technical_checklist: Array.isArray(product.technical_checklist)
            ? [...product.technical_checklist]
            : [],
          history_events: [
            {
              title: `Clonado a partir de ${product.name} (${product.sku || product.serial_number || 'original'})`,
              date: new Date().toISOString().replace('T', ' ').substring(0, 19),
            },
          ],
        }

        const createdProd = await productsService.create(newProductPayload)
        createdProductIds.push(createdProd.id)

        // Clone each additional cost / part to the newly created product
        for (const part of originalParts) {
          const newPart = await equipmentService.createPart({
            name: part.name,
            cost: Number(part.cost) || 0,
            status: part.status || 'Instalado',
            notes: part.notes ? `${part.notes} (Clonado)` : undefined,
            supplier: part.supplier,
            purchase_date: part.purchase_date,
            purchase_batch_id: selectedBatchId,
            product_id: createdProd.id,
          })
          createdPartIds.push(newPart.id)
        }
      }

      toast({
        title: copiesCount === 1 ? 'Equipamento clonado!' : `${copiesCount} cópias criadas!`,
        description: `O(s) clone(s) foram inseridos no lote ${selectedBatch?.invoice_number ? `NF ${selectedBatch.invoice_number}` : selectedBatch?.supplier || ''}.`,
      })

      onOpenChange(false)
      if (onSuccess) {
        onSuccess(copiesCount, selectedBatchId)
      }
    } catch (err: any) {
      console.error('Falha durante a clonagem em massa, efetuando rollback:', err)
      // Rollback: delete any created products & parts to guarantee atomicity
      for (const pId of createdProductIds) {
        try {
          await productsService.delete(pId)
        } catch {
          /* intentionally ignored */
        }
      }
      for (const partId of createdPartIds) {
        try {
          await equipmentService.deletePart(partId)
        } catch {
          /* intentionally ignored */
        }
      }

      toast({
        title: 'Operação cancelada',
        description:
          err?.message ||
          'Ocorreu uma falha ao criar as cópias. Nenhum equipamento foi criado (rollback efetuado).',
        variant: 'destructive',
      })
    } finally {
      setIsCloning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-[#faf8f5] border border-orange-100 p-6 sm:p-7 font-sans text-slate-900">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
            Clonar {product?.name || 'Equipamento'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Banner 1: Explicativo rosa/pêssego idêntico ao Replit Screenshot 2 */}
          <div className="bg-[#f5ede4] border border-[#edd5c3] rounded-xl px-4 py-3 text-xs text-slate-700">
            Escolha quantas peças deseja criar. Cada cópia receberá os dados, as fotos e{' '}
            {additionalCostsCount > 0 ? `${additionalCostsCount} ` : 'os '}
            custo(s) adicional(is) desta ficha.
          </div>

          {/* Banner 2: Lote de Origem com Chips Financeiros */}
          <div className="bg-[#f5ede4]/80 border border-[#edd5c3] rounded-xl p-4 space-y-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Lote de origem *
              </Label>
              <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                <SelectTrigger className="w-full bg-white border-slate-300 text-sm h-10 font-medium">
                  <SelectValue placeholder="Selecione o lote de origem..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {allBatches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      <span className="font-semibold text-slate-900">
                        {b.invoice_number ? `${b.invoice_number} · ` : ''}
                        {b.inventoriedCount}/{b.expected_quantity} inventariados
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBatch && (
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#edd5c3]/60 text-xs text-slate-600">
                <div>
                  Faltam{' '}
                  <strong className="text-slate-900">{selectedBatch.missingCount} itens</strong>
                </div>
                <div>
                  Custo do lote{' '}
                  <strong className="text-slate-900">
                    {(Number(selectedBatch.total_cost) || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </strong>
                </div>
                <div>
                  Custo-base por item{' '}
                  <strong className="text-[#d9532f] font-bold">
                    {selectedBatch.costBasePerItem.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Banner 3: Quantidade de Cópias & Regra Atômica */}
          <div className="bg-[#f0ebe3]/70 border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="sm:w-44 shrink-0">
              <Label className="text-xs font-semibold text-slate-700 block mb-1">
                Quantidade de cópias
              </Label>
              <Input
                type="number"
                min="1"
                max="99"
                value={copiesCount}
                onChange={(e) => handleCopiesChange(parseInt(e.target.value) || 1)}
                className="bg-white border-slate-300 text-sm font-semibold h-10"
              />
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">
              Capacidade disponível: <strong className="text-slate-800">{availableCapacity}</strong>
              . A operação é única: se uma cópia falhar, nenhuma será criada. Números de série são
              deixados em branco ao criar várias peças.
            </div>
          </div>

          {/* Formulário: Família & Título */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Família *</Label>
              <Select value={family} onValueChange={setFamily}>
                <SelectTrigger className="bg-white border-slate-300 text-sm h-10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Notebooks">Notebooks</SelectItem>
                  <SelectItem value="Desktops">Desktops</SelectItem>
                  <SelectItem value="Monitores">Monitores</SelectItem>
                  <SelectItem value="Servidores">Servidores</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">
                Título do equipamento *
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Notebook Dell Latitude 5320..."
                className="bg-white border-slate-300 text-sm h-10 mt-1"
                required
              />
            </div>
          </div>

          {/* Formulário: Marca & Modelo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Marca</Label>
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex.: Dell"
                className="bg-white border-slate-300 text-sm h-10 mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Modelo</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex.: Latitude 5320"
                className="bg-white border-slate-300 text-sm h-10 mt-1"
              />
            </div>
          </div>

          {/* Formulário: Número de série */}
          <div>
            <Label className="text-xs font-semibold text-slate-700">Número de série</Label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="SN . . ."
              disabled={copiesCount > 1}
              className="bg-white border-slate-300 text-sm h-10 mt-1 font-mono disabled:opacity-60 disabled:bg-slate-100"
            />
            {copiesCount > 1 && (
              <p className="text-[11px] text-slate-400 mt-1">
                Ao clonar mais de 1 peça, os números de série são gerados em branco para
                preenchimento posterior.
              </p>
            )}
          </div>
        </div>

        {/* Rodapé / Botões */}
        <div className="pt-4 mt-2 border-t border-orange-100 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCloning}
            className="bg-white hover:bg-slate-50 border-slate-300 text-slate-700 text-xs h-9"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleConfirmClone}
            disabled={isCloning || !selectedBatchId || !title.trim()}
            className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs font-semibold h-9 shadow-sm gap-1.5"
          >
            {isCloning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Clonando ({copiesCount})...
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Criar {copiesCount === 1 ? '1 cópia' : `${copiesCount} cópias`}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
