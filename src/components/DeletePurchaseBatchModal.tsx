import React, { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { AlertTriangle, ShieldAlert, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { purchaseBatchesService, type PurchaseBatchSafetyCheck } from '@/services/purchaseBatches'
import type { PurchaseBatch } from '@/types/inventory'

interface DeletePurchaseBatchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  batch: PurchaseBatch | null
  onSuccess?: () => void
}

export function DeletePurchaseBatchModal({
  open,
  onOpenChange,
  batch,
  onSuccess,
}: DeletePurchaseBatchModalProps) {
  const { toast } = useToast()
  const [loadingSafety, setLoadingSafety] = useState(false)
  const [safetyCheck, setSafetyCheck] = useState<PurchaseBatchSafetyCheck | null>(null)
  const [deleteMode, setDeleteMode] = useState<'unlink' | 'delete_available'>('unlink')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (open && batch) {
      setLoadingSafety(true)
      setDeleteMode('unlink')
      purchaseBatchesService
        .checkDeleteSafety(batch.id)
        .then((res) => {
          setSafetyCheck(res)
        })
        .catch((err) => {
          console.error(err)
          toast({
            title: 'Erro ao analisar lote',
            description: 'Não foi possível verificar vínculos de estoque do lote.',
            variant: 'destructive',
          })
        })
        .finally(() => {
          setLoadingSafety(false)
        })
    } else {
      setSafetyCheck(null)
    }
  }, [open, batch, toast])

  const handleDelete = async () => {
    if (!batch) return
    setIsDeleting(true)
    try {
      const result = await purchaseBatchesService.deleteSafe(batch.id, {
        action: deleteMode,
      })

      toast({
        title: 'Pedido de Compra excluído com sucesso!',
        description:
          deleteMode === 'unlink'
            ? `Lote removido. ${result.unlinkedCount} equipamento(s) foram desvinculados com segurança e mantidos no catálogo.`
            : `Lote removido. ${result.deletedProductsCount} equipamento(s) não vendidos foram excluídos do inventário.`,
      })

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Falha ao excluir pedido de compra',
        description: err?.message || 'Não foi possível remover o lote.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (!batch) return null

  const isBlocked = safetyCheck && !safetyCheck.canDelete

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg bg-white p-6 font-sans">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isBlocked ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isBlocked ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-bold text-slate-900">
                {isBlocked
                  ? 'Exclusão Bloqueada por Segurança'
                  : 'Confirmar Exclusão do Pedido de Compra'}
              </AlertDialogTitle>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {batch.supplier} {batch.invoice_number ? `— NF ${batch.invoice_number}` : ''}
              </p>
            </div>
          </div>

          <AlertDialogDescription className="text-slate-600 text-xs sm:text-sm pt-2 space-y-3">
            {loadingSafety ? (
              <div className="py-6 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                <span>Verificando integridade do estoque e vendas vinculadas...</span>
              </div>
            ) : isBlocked ? (
              <div className="space-y-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-2">
                  <p className="font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    Este lote possui histórico comercial ativo e não pode ser excluído diretamente:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {safetyCheck?.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-slate-500">
                  Para manter a integridade fiscal, contábil e as vendas já concretizadas com nota
                  fiscal ou baixa, você pode alterar o status do lote para &quot;Concluído&quot; ou
                  editar suas informações caso haja erro de digitação.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p>
                  Você está prestes a excluir o pedido de compra <strong>{batch.supplier}</strong>
                  {batch.invoice_number ? ` (NF: ${batch.invoice_number})` : ''}.
                </p>

                {/* Estatísticas de itens vinculados */}
                {safetyCheck && safetyCheck.totalProducts > 0 && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1.5">
                    <div className="font-semibold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Equipamentos vinculados a este lote ({safetyCheck.totalProducts} no total):
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-700 pl-1 pt-1">
                      <div>
                        • Disponíveis no estoque: <strong>{safetyCheck.availableProducts}</strong>
                      </div>
                      <div>
                        • Pendentes de ativação:{' '}
                        <strong>{safetyCheck.pendingActivationProducts}</strong>
                      </div>
                      <div>
                        • Vendidos / Faturados: <strong className="text-emerald-700">0</strong>
                      </div>
                      <div>
                        • Peças/Custos no lote: <strong>{safetyCheck.partsCount}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seleção do modo de exclusão */}
                {safetyCheck && safetyCheck.totalProducts > 0 && (
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <Label className="text-xs font-semibold text-slate-800">
                      O que fazer com os {safetyCheck.totalProducts} equipamentos já cadastrados?
                    </Label>
                    <RadioGroup
                      value={deleteMode}
                      onValueChange={(val: 'unlink' | 'delete_available') => setDeleteMode(val)}
                      className="space-y-2"
                    >
                      <div className="flex items-start space-x-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100/60 cursor-pointer">
                        <RadioGroupItem value="unlink" id="opt-unlink" className="mt-0.5" />
                        <div className="text-xs">
                          <Label
                            htmlFor="opt-unlink"
                            className="font-semibold text-slate-900 cursor-pointer"
                          >
                            Desvincular do lote e manter equipamentos no catálogo (Recomendado)
                          </Label>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Os equipamentos continuam cadastrados e disponíveis para venda, apenas o
                            lote de entrada é excluído.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-2.5 p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-50 cursor-pointer">
                        <RadioGroupItem
                          value="delete_available"
                          id="opt-del"
                          className="mt-0.5 text-rose-600"
                        />
                        <div className="text-xs">
                          <Label
                            htmlFor="opt-del"
                            className="font-semibold text-rose-900 cursor-pointer"
                          >
                            Excluir também todos os equipamentos e peças deste lote
                          </Label>
                          <p className="text-[11px] text-rose-700 mt-0.5">
                            Remove permanentemente do catálogo os{' '}
                            {safetyCheck.availableProducts + safetyCheck.pendingActivationProducts}{' '}
                            equipamentos não vendidos.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                <p className="text-xs text-rose-600 font-medium">
                  Esta ação é irreversível. O registro do pedido de compra será removido
                  permanentemente.
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="pt-3 border-t border-slate-100 gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isDeleting} className="text-xs">
            {isBlocked ? 'Fechar' : 'Cancelar'}
          </AlertDialogCancel>

          {!isBlocked && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting || loadingSafety}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Excluindo Lote...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirmar Exclusão
                </>
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
