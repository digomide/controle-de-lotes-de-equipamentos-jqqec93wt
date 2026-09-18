import React, { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowRightLeft, Boxes, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTenant } from '@/contexts/TenantContext'
import { purchaseBatchesService } from '@/services/purchaseBatches'
import { productsService } from '@/services/products'
import { equipmentService } from '@/services/equipment'
import type { PurchaseBatch, Product } from '@/types/inventory'

interface TransferEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBatchId: string
  selectedProducts: Product[]
  onSuccess?: () => void
}

interface BatchWithDetails extends PurchaseBatch {
  inventoriedCount: number
  missingCount: number
  costBasePerItem: number
}

export function TransferEquipmentModal({
  open,
  onOpenChange,
  currentBatchId,
  selectedProducts,
  onSuccess,
}: TransferEquipmentModalProps) {
  const { toast } = useToast()
  const { currentTenant } = useTenant()
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [destinationBatches, setDestinationBatches] = useState<BatchWithDetails[]>([])
  const [targetBatchId, setTargetBatchId] = useState<string>('')
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    if (open) {
      loadOtherBatches()
    } else {
      setTargetBatchId('')
    }
  }, [open, currentBatchId])

  const loadOtherBatches = async () => {
    setLoadingBatches(true)
    try {
      const allBatches = await purchaseBatchesService.getAll(currentTenant?.id)
      // Filter out the current batch
      const others = allBatches.filter((b) => b.id !== currentBatchId)

      // Fetch products for each to calculate accurate counts
      const batchesWithStats: BatchWithDetails[] = await Promise.all(
        others.map(async (b) => {
          try {
            const batchProds = await purchaseBatchesService.getProductsByBatchId(b.id)
            const count = batchProds.length
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

      setDestinationBatches(batchesWithStats)
      if (batchesWithStats.length > 0) {
        setTargetBatchId(batchesWithStats[0].id)
      }
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao carregar lotes de destino',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setLoadingBatches(false)
    }
  }

  const selectedDestinationBatch = destinationBatches.find((b) => b.id === targetBatchId)

  // Calculations for after-transfer destination stats preview
  const newDestinationInventoriedCount =
    (selectedDestinationBatch?.inventoriedCount ?? 0) + selectedProducts.length
  const newDestinationMissingCount = Math.max(
    0,
    (Number(selectedDestinationBatch?.expected_quantity) || 1) - newDestinationInventoriedCount,
  )

  const handleConfirmTransfer = async () => {
    if (!targetBatchId || selectedProducts.length === 0) return

    setTransferring(true)
    try {
      // 1. Move each selected product to the new purchase_batch_id
      // Update cost_price to match the destination batch's base cost if applicable
      const targetBaseCost = selectedDestinationBatch?.costBasePerItem ?? 0

      for (const prod of selectedProducts) {
        const updatePayload: Partial<Product> = {
          purchase_batch_id: targetBatchId,
        }
        // Recalculate or keep base cost
        if (targetBaseCost > 0) {
          updatePayload.cost_price = targetBaseCost
        }

        // Also add history event
        const existingEvents = Array.isArray(prod.history_events) ? [...prod.history_events] : []
        existingEvents.push({
          title: `Transferido para o lote ${selectedDestinationBatch?.invoice_number ? `NF ${selectedDestinationBatch.invoice_number}` : selectedDestinationBatch?.supplier || targetBatchId}`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 19),
        })
        updatePayload.history_events = existingEvents

        await productsService.update(prod.id, updatePayload)

        // 2. Also move any equipment parts tied to this product to have purchase_batch_id updated
        try {
          const parts = await equipmentService.getPartsByProduct(prod.id)
          for (const part of parts) {
            await equipmentService.updatePart(part.id, {
              purchase_batch_id: targetBatchId,
            })
          }
        } catch (partErr) {
          console.warn('Aviso ao transferir peças do equipamento:', partErr)
        }
      }

      toast({
        title: 'Transferência concluída!',
        description: `${selectedProducts.length} equipamento(s) transferido(s) para o lote de destino com sucesso.`,
      })

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao transferir equipamentos',
        description: err?.message || 'Falha ao mover os itens para o novo lote.',
        variant: 'destructive',
      })
    } finally {
      setTransferring(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl font-sans">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-[#d9532f]" />
            Transferir Equipamento(s) para Outro Lote
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Mova os {selectedProducts.length} equipamento(s) selecionado(s) para outro lote de
            entrada. As contagens e custos de ambos os lotes serão recalculados.
          </DialogDescription>
        </DialogHeader>

        {loadingBatches ? (
          <div className="py-10 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#d9532f] mx-auto mb-2" />
            <p className="text-xs text-slate-500">Carregando lotes disponíveis...</p>
          </div>
        ) : destinationBatches.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Nenhum outro lote cadastrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Para transferir equipamentos, é necessário existir pelo menos mais um lote de entrada
              no sistema.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Resumo dos itens a serem transferidos */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700 block mb-1">
                Itens selecionados ({selectedProducts.length}):
              </span>
              <ul className="divide-y divide-slate-100 max-h-32 overflow-y-auto pr-1">
                {selectedProducts.map((p) => (
                  <li key={p.id} className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-800 font-medium truncate max-w-[280px]">
                      {p.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {p.serial_number || p.sku}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Seletor Lote de Destino — Estilo Replit idêntico às telas */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Lote de destino *</Label>

              <Select value={targetBatchId} onValueChange={setTargetBatchId}>
                <SelectTrigger className="w-full h-11 bg-white border-slate-300 text-sm font-medium">
                  <SelectValue placeholder="Selecione o lote de destino..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {destinationBatches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs py-2">
                      <div className="font-semibold text-slate-900">
                        {b.invoice_number ? `${b.invoice_number} · ` : ''}
                        {b.supplier} · {b.inventoriedCount}/{b.expected_quantity} inventariados
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Banner com estatísticas do lote de destino (Idêntico ao card rosa/pêssego do Replit) */}
            {selectedDestinationBatch && (
              <div className="bg-[#f5ede4]/80 border border-[#edd5c3] rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-800 pb-2 border-b border-[#edd5c3]/60">
                  <span className="flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-[#d9532f]" />
                    {selectedDestinationBatch.invoice_number
                      ? `Lote ${selectedDestinationBatch.invoice_number}`
                      : selectedDestinationBatch.supplier}
                  </span>
                  <span className="text-slate-500 font-normal">
                    {selectedDestinationBatch.supplier}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Status atual:</span>
                    <strong className="text-slate-800 block mt-0.5">
                      Faltam {selectedDestinationBatch.missingCount} itens
                    </strong>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Custo do lote:</span>
                    <strong className="text-slate-800 block mt-0.5">
                      {(Number(selectedDestinationBatch.total_cost) || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block">Custo-base por item:</span>
                    <strong className="text-[#d9532f] font-bold block mt-0.5">
                      {selectedDestinationBatch.costBasePerItem.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#edd5c3]/60 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Após a transferência:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Destino passará a ter {newDestinationInventoriedCount} de{' '}
                    {selectedDestinationBatch.expected_quantity} equipamentos
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={transferring}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmTransfer}
            disabled={
              transferring || loadingBatches || destinationBatches.length === 0 || !targetBatchId
            }
            className="bg-[#d9532f] hover:bg-[#c24624] text-white font-semibold shadow-sm"
          >
            {transferring ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transferindo...
              </>
            ) : (
              `Confirmar Transferência (${selectedProducts.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
