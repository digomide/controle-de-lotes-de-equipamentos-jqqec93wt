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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertTriangle,
  ShieldAlert,
  Loader2,
  XCircle,
  FileCheck,
  CheckCircle2,
  PackageCheck,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { salesService, type SaleFiscalStatus } from '@/services/sales'
import type { Sale } from '@/types/inventory'

interface CancelSaleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
  onSuccess?: () => void
}

export function CancelSaleModal({ open, onOpenChange, sale, onSuccess }: CancelSaleModalProps) {
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [loadingFiscal, setLoadingFiscal] = useState(false)
  const [fiscalStatus, setFiscalStatus] = useState<SaleFiscalStatus | null>(null)
  const [forceFiscalAcknowledged, setForceFiscalAcknowledged] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    if (open && sale) {
      setReason('')
      setForceFiscalAcknowledged(false)
      setLoadingFiscal(true)

      salesService
        .checkFiscalStatus(sale.id)
        .then((res) => {
          setFiscalStatus(res)
        })
        .catch((err) => {
          console.error(err)
          setFiscalStatus(null)
        })
        .finally(() => {
          setLoadingFiscal(false)
        })
    } else {
      setFiscalStatus(null)
    }
  }, [open, sale])

  if (!sale) return null

  const isAlreadyCancelled = sale.status === 'cancelled'
  const hasAuthorizedNF = Boolean(fiscalStatus?.hasAuthorized)

  const handleCancelSale = async () => {
    if (isAlreadyCancelled) {
      toast({
        title: 'Venda já cancelada',
        description: 'Esta venda já se encontra no status Cancelado.',
      })
      onOpenChange(false)
      return
    }

    if (hasAuthorizedNF && !forceFiscalAcknowledged) {
      toast({
        title: 'Atenção Fiscal Requerida',
        description:
          'Marque a confirmação de que está ciente da Nota Fiscal autorizada antes de prosseguir.',
        variant: 'destructive',
      })
      return
    }

    setIsCancelling(true)
    try {
      const result = await salesService.cancelSale({
        sale_id: sale.id,
        reason: reason.trim(),
        force_fiscal: forceFiscalAcknowledged,
      })

      if (!result.ok && result.has_authorized_nf) {
        toast({
          title: 'Bloqueio Fiscal',
          description:
            result.error ||
            'Existe Nota Fiscal autorizada. Cancele a NF-e primeiro ou confirme a responsabilidade.',
          variant: 'destructive',
        })
        setIsCancelling(false)
        return
      }

      toast({
        title: 'Venda cancelada com sucesso!',
        description:
          result.message ||
          `O estoque dos lotes foi restaurado e os equipamentos voltaram ao status Disponível.`,
      })

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao cancelar venda',
        description: err?.message || 'Falha ao processar cancelamento no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg bg-white p-6 font-sans">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isAlreadyCancelled
                  ? 'bg-slate-100 text-slate-500'
                  : hasAuthorizedNF
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isAlreadyCancelled ? (
                <XCircle className="w-5 h-5" />
              ) : hasAuthorizedNF ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-bold text-slate-900">
                {isAlreadyCancelled ? 'Venda Já Cancelada' : 'Cancelar Venda Interna'}
              </AlertDialogTitle>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Venda #{sale.id.slice(0, 6)} • Cliente: {sale.customer_name}
              </p>
            </div>
          </div>

          <AlertDialogDescription
            className="text-slate-600 text-xs sm:text-sm pt-2 space-y-3"
            asChild
          >
            <div>
              {loadingFiscal ? (
                <div className="py-6 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                  <span>Verificando status de estoque e notas fiscais vinculadas...</span>
                </div>
              ) : isAlreadyCancelled ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-2">
                  <p className="font-semibold text-slate-900">
                    Esta venda já foi cancelada anteriormente.
                  </p>
                  <p className="text-slate-500">
                    O saldo de estoque já foi devolvido aos lotes originais e o status está
                    consolidado.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Você está prestes a cancelar a venda para{' '}
                    <strong className="text-slate-900">{sale.customer_name}</strong> no valor total
                    de{' '}
                    <strong className="text-slate-900 font-mono">
                      R${' '}
                      {Number(sale.total_amount).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                    .
                  </p>

                  {/* Alerta de Devolução de Estoque Automática */}
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1.5">
                    <div className="font-semibold text-emerald-800 flex items-center gap-1.5">
                      <PackageCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      Restauração Automática de Estoque:
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Ao cancelar, todas as quantidades faturadas serão{' '}
                      <strong>creditadas de volta aos lotes físicos correspondentes</strong> e os
                      equipamentos individuais terão o status restaurado para{' '}
                      <span className="font-bold">&quot;Disponível&quot;</span>, com registro de
                      auditoria no histórico.
                    </p>
                  </div>

                  {/* Alerta de Nota Fiscal Vinculada se houver */}
                  {hasAuthorizedNF && fiscalStatus && (
                    <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-900 space-y-2.5">
                      <div className="font-semibold text-rose-800 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        Alerta Fiscal Crítico: Nota Fiscal Eletrônica Emitida
                      </div>
                      <p className="text-[11px] text-rose-800 leading-relaxed">
                        Existe nota fiscal <strong>autorizada pela SEFAZ</strong> vinculada a esta
                        venda:
                      </p>
                      <div className="space-y-1 pl-1">
                        {fiscalStatus.invoices.map((inv) => (
                          <div
                            key={inv.id}
                            className="bg-white/80 p-2 rounded border border-rose-200 font-mono text-[11px] flex items-center justify-between"
                          >
                            <span>{inv.numero ? `NF-e nº ${inv.numero}` : `Ref: ${inv.ref}`}</span>
                            <span className="text-emerald-700 font-bold uppercase text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {inv.status}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-rose-700">
                        O cancelamento interno no sistema <strong>não cancela</strong> a NF-e na
                        SEFAZ automaticamente. Lembre-se de emitir o cancelamento fiscal ou carta de
                        correção via módulo de Notas Fiscais, se aplicável pelo prazo legal.
                      </p>

                      <div className="flex items-start space-x-2 pt-1 border-t border-rose-200/60">
                        <Checkbox
                          id="ack-fiscal"
                          checked={forceFiscalAcknowledged}
                          onCheckedChange={(checked) =>
                            setForceFiscalAcknowledged(Boolean(checked))
                          }
                          className="mt-0.5 data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                        />
                        <Label
                          htmlFor="ack-fiscal"
                          className="text-[11px] text-rose-900 font-semibold cursor-pointer leading-tight"
                        >
                          Estou ciente de que há Nota Fiscal autorizada para esta venda e assumo a
                          responsabilidade de cancelamento fiscal correspondente.
                        </Label>
                      </div>
                    </div>
                  )}

                  {/* Motivo do Cancelamento */}
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="cancel-reason" className="text-xs font-semibold text-slate-800">
                      Motivo do Cancelamento (opcional — ficará registrado no histórico)
                    </Label>
                    <Textarea
                      id="cancel-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ex: Desistência do cliente, erro de digitação de lote, devolução na entrega..."
                      className="text-xs min-h-[70px] bg-slate-50"
                    />
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="pt-3 border-t border-slate-100 gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isCancelling} className="text-xs">
            Voltar
          </AlertDialogCancel>

          {!isAlreadyCancelled && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleCancelSale()
              }}
              disabled={
                isCancelling || loadingFiscal || (hasAuthorizedNF && !forceFiscalAcknowledged)
              }
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs gap-1.5"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Cancelando & Devolvendo Estoque...
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  Confirmar Cancelamento da Venda
                </>
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
