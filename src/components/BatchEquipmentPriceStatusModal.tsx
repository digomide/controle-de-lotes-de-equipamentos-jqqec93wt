import React, { useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  HelpCircle,
  Tag,
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
import { Input } from '@/components/ui/input'
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
import { useAuth } from '@/contexts/AuthContext'
import { productsService } from '@/services/products'
import type { Product } from '@/types/inventory'

export interface BatchEquipmentPriceStatusModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedProducts: Product[]
  onSuccess: () => void
}

type PriceChangeMode = 'fixed' | 'percent_increase' | 'percent_decrease' | 'keep'

export function BatchEquipmentPriceStatusModal({
  open,
  onOpenChange,
  selectedProducts,
  onSuccess,
}: BatchEquipmentPriceStatusModalProps) {
  const { toast } = useToast()
  const { user } = useAuth()

  const [priceMode, setPriceMode] = useState<PriceChangeMode>('fixed')
  const [fixedPrice, setFixedPrice] = useState<number | string>('')
  const [percentValue, setPercentValue] = useState<number | string>(10)
  const [changeStatus, setChangeStatus] = useState<boolean>(false)
  const [targetStatus, setTargetStatus] = useState<
    'Disponível' | 'Reservado' | 'Pendente de ativação'
  >('Disponível')
  const [changeCostPrice, setChangeCostPrice] = useState<boolean>(false)
  const [costPriceValue, setCostPriceValue] = useState<number | string>('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'config' | 'confirm'>('config')

  // Itens elegíveis: produtos que NÃO estão vendidos (ou todos para preço)
  const eligibleProducts = selectedProducts.filter((p) => p.status !== 'Vendido')
  const soldCount = selectedProducts.length - eligibleProducts.length

  // Pré-visualização do preço resultante para cada produto
  const previewItems = selectedProducts.map((p) => {
    const currentPrice = Number(p.unit_price) || 0
    let newPrice = currentPrice

    if (priceMode === 'fixed') {
      const parsed = Number(fixedPrice)
      if (!isNaN(parsed) && parsed >= 0 && fixedPrice !== '') {
        newPrice = parsed
      }
    } else if (priceMode === 'percent_increase') {
      const pct = Number(percentValue) || 0
      newPrice = Math.round(currentPrice * (1 + pct / 100) * 100) / 100
    } else if (priceMode === 'percent_decrease') {
      const pct = Number(percentValue) || 0
      newPrice = Math.max(0, Math.round(currentPrice * (1 - pct / 100) * 100) / 100)
    }

    const priceChanged = priceMode !== 'keep' && newPrice !== currentPrice
    const willChangeStatus = changeStatus && p.status !== 'Vendido' && p.status !== targetStatus

    return {
      product: p,
      currentPrice,
      newPrice,
      priceChanged,
      willChangeStatus,
      isSold: p.status === 'Vendido',
    }
  })

  const willHavePriceChange =
    priceMode !== 'keep' &&
    ((priceMode === 'fixed' && fixedPrice !== '' && Number(fixedPrice) >= 0) ||
      (priceMode !== 'fixed' && Number(percentValue) > 0))

  const willHaveCostChange = changeCostPrice && costPriceValue !== '' && Number(costPriceValue) >= 0

  const canProceed = willHavePriceChange || changeStatus || willHaveCostChange

  const handleResetAndClose = () => {
    setStep('config')
    setIsSubmitting(false)
    onOpenChange(false)
  }

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canProceed) {
      toast({
        title: 'Nenhuma alteração informada',
        description: 'Defina um novo preço, alteração percentual ou mudança de status.',
        variant: 'destructive',
      })
      return
    }
    setStep('confirm')
  }

  const handleConfirmSubmit = async () => {
    if (selectedProducts.length === 0) return

    setIsSubmitting(true)
    try {
      let totalUpdated = 0
      const ids = selectedProducts.map((p) => p.id)

      // Se for preço percentual, cada produto tem seu novo preço calculado individualmente
      if (priceMode === 'percent_increase' || priceMode === 'percent_decrease') {
        const pct = Number(percentValue) || 0
        const isInc = priceMode === 'percent_increase'

        for (const item of previewItems) {
          const updates: any = {}
          if (item.priceChanged) {
            updates.unit_price = item.newPrice
          }
          if (changeStatus && !item.isSold) {
            updates.status = targetStatus
          }
          if (changeCostPrice && costPriceValue !== '') {
            updates.cost_price = Number(costPriceValue)
          }

          if (Object.keys(updates).length > 0) {
            const res = await productsService.updateBulk(
              [item.product.id],
              updates,
              user?.name || user?.email,
            )
            totalUpdated += res.updatedCount
          }
        }
      } else {
        // Preço fixo ou mantém
        const updates: any = {}
        if (priceMode === 'fixed' && fixedPrice !== '' && Number(fixedPrice) >= 0) {
          updates.unit_price = Number(fixedPrice)
        }
        if (changeStatus) {
          updates.status = targetStatus
        }
        if (changeCostPrice && costPriceValue !== '') {
          updates.cost_price = Number(costPriceValue)
        }

        const res = await productsService.updateBulk(ids, updates, user?.name || user?.email)
        totalUpdated = res.updatedCount
      }

      toast({
        title: 'Atualização em massa concluída!',
        description: `${totalUpdated} equipamento(s) atualizados com sucesso.`,
      })

      handleResetAndClose()
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao aplicar alterações em massa',
        description: err?.message || 'Falha ao processar atualização.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isSubmitting) {
          if (!isOpen) handleResetAndClose()
          else onOpenChange(true)
        }
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto font-sans">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#d9532f] flex items-center justify-center mb-1">
            <DollarSign className="w-5 h-5" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {step === 'config'
              ? 'Alteração em Massa de Equipamentos'
              : 'Confirmar Alterações em Massa'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {step === 'config'
              ? `Defina os novos valores e status para os ${selectedProducts.length} equipamento(s) selecionado(s).`
              : `Revise o resumo das alterações que serão aplicadas a ${selectedProducts.length} equipamento(s).`}
          </DialogDescription>
        </DialogHeader>

        {step === 'config' ? (
          <form onSubmit={handleProceedToConfirm} className="space-y-4 py-2">
            {/* Bloco 1: Alteração de Preço de Venda */}
            <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-[#d9532f]" />
                  Preço de Venda (R$)
                </Label>
                <span className="text-[11px] text-slate-500">Escolha a regra de precificação</span>
              </div>

              {/* Botões seletores de modo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPriceMode('fixed')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    priceMode === 'fixed'
                      ? 'border-[#d9532f] bg-orange-50/70 text-[#d9532f] font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 mx-auto mb-1" />
                  Valor Fixo
                </button>

                <button
                  type="button"
                  onClick={() => setPriceMode('percent_increase')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    priceMode === 'percent_increase'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-600" />
                  Acréscimo %
                </button>

                <button
                  type="button"
                  onClick={() => setPriceMode('percent_decrease')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    priceMode === 'percent_decrease'
                      ? 'border-blue-500 bg-blue-50 text-blue-800 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5 mx-auto mb-1 text-blue-600" />
                  Desconto %
                </button>

                <button
                  type="button"
                  onClick={() => setPriceMode('keep')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    priceMode === 'keep'
                      ? 'border-slate-600 bg-slate-100 text-slate-900 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-[11px] mb-1 font-mono">===</span>
                  Manter Atual
                </button>
              </div>

              {/* Inputs conforme o modo */}
              {priceMode === 'fixed' && (
                <div className="space-y-1 pt-1">
                  <Label htmlFor="fixedPrice" className="text-xs font-semibold text-slate-700">
                    Novo Preço de Venda Unitário (R$)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">
                      R$
                    </span>
                    <Input
                      id="fixedPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 2499,00"
                      value={fixedPrice}
                      onChange={(e) => setFixedPrice(e.target.value)}
                      className="pl-9 font-bold font-mono text-sm bg-white"
                      required={priceMode === 'fixed'}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Todos os equipamentos selecionados receberão exatamente este preço de venda.
                  </p>
                </div>
              )}

              {(priceMode === 'percent_increase' || priceMode === 'percent_decrease') && (
                <div className="space-y-1 pt-1">
                  <Label htmlFor="percentVal" className="text-xs font-semibold text-slate-700">
                    Percentual a {priceMode === 'percent_increase' ? 'Acrescentar' : 'Subtrair'} (%)
                  </Label>
                  <div className="relative">
                    <Input
                      id="percentVal"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="200"
                      placeholder="Ex: 10"
                      value={percentValue}
                      onChange={(e) => setPercentValue(e.target.value)}
                      className="font-bold font-mono text-sm bg-white pr-9"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Calculado individualmente sobre o preço atual de cada equipamento.
                  </p>
                </div>
              )}
            </div>

            {/* Bloco 2: Alteração de Status */}
            <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changeStatus}
                    onChange={(e) => setChangeStatus(e.target.checked)}
                    className="w-4 h-4 rounded text-[#d9532f] focus:ring-[#d9532f] border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-900">
                    Alterar Status dos Equipamentos
                  </span>
                </label>
                {soldCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-amber-700 bg-amber-50 border-amber-200"
                  >
                    {soldCount} vendido(s) protegidos
                  </Badge>
                )}
              </div>

              {changeStatus && (
                <div className="pt-1.5 space-y-1">
                  <Select value={targetStatus} onValueChange={(val: any) => setTargetStatus(val)}>
                    <SelectTrigger className="h-9 bg-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Disponível">Disponível (Pronto para venda)</SelectItem>
                      <SelectItem value="Reservado">
                        Reservado (Separado para cliente/cotação)
                      </SelectItem>
                      <SelectItem value="Pendente de ativação">
                        Pendente de ativação (Aguardando bancada/PN)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500">
                    * Status &quot;Vendido&quot; não pode ser aplicado em massa sem pedido/venda
                    fiscal formal vinculada.
                  </p>
                </div>
              )}
            </div>

            {/* Bloco 3: Opcional - Custo Base */}
            <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={changeCostPrice}
                  onChange={(e) => setChangeCostPrice(e.target.checked)}
                  className="w-4 h-4 rounded text-[#d9532f] focus:ring-[#d9532f] border-slate-300"
                />
                <span className="text-xs font-bold text-slate-900">
                  Ajustar Custo Unitário de Aquisição (Opcional)
                </span>
              </label>

              {changeCostPrice && (
                <div className="pt-1.5 space-y-1">
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 1200,00"
                      value={costPriceValue}
                      onChange={(e) => setCostPriceValue(e.target.value)}
                      className="pl-9 font-mono text-xs bg-white"
                      required={changeCostPrice}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Atualiza o custo de aquisição contábil de cada item selecionado.
                  </p>
                </div>
              )}
            </div>

            {/* Prévia curta dos itens afetados */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                <span>Itens Selecionados ({selectedProducts.length}):</span>
                {willHavePriceChange && (
                  <span className="text-emerald-700 text-[11px] font-bold">
                    Preços serão recalculados
                  </span>
                )}
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 text-xs">
                {previewItems.slice(0, 10).map((it) => (
                  <div key={it.product.id} className="p-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-slate-800">{it.product.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                        {it.product.serial_number || it.product.sku || 'Sem serial'}
                      </span>
                    </div>
                    <div className="text-right shrink-0 font-mono text-[11px]">
                      {it.priceChanged ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 line-through">
                            R$ {it.currentPrice.toFixed(2)}
                          </span>
                          <span className="font-bold text-emerald-700">
                            R$ {it.newPrice.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">R$ {it.currentPrice.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                ))}
                {previewItems.length > 10 && (
                  <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50">
                    + {previewItems.length - 10} outro(s) equipamento(s)...
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetAndClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!canProceed || isSubmitting}
                className="bg-[#d9532f] hover:bg-[#c24624] text-white font-semibold shadow-xs"
              >
                Revisar e Confirmar ({selectedProducts.length})
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Step 2: Confirmação com Resumo Detalhado */
          <div className="space-y-4 py-2">
            <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <CheckCircle2 className="w-4 h-4 text-[#d9532f]" />
                Resumo da Operação
              </div>
              <ul className="space-y-1.5 text-slate-700">
                <li className="flex items-center justify-between">
                  <span>Equipamentos afetados:</span>
                  <strong className="font-bold text-slate-900 font-mono">
                    {selectedProducts.length} itens
                  </strong>
                </li>

                {willHavePriceChange && (
                  <li className="flex items-center justify-between">
                    <span>Novo Preço de Venda:</span>
                    <strong className="font-bold text-emerald-700 font-mono">
                      {priceMode === 'fixed'
                        ? `R$ ${Number(fixedPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} fixo`
                        : priceMode === 'percent_increase'
                          ? `+${percentValue}% sobre valor atual`
                          : `-${percentValue}% sobre valor atual`}
                    </strong>
                  </li>
                )}

                {changeStatus && (
                  <li className="flex items-center justify-between">
                    <span>Novo Status:</span>
                    <Badge variant="outline" className="font-bold bg-white text-slate-800">
                      {targetStatus}
                    </Badge>
                  </li>
                )}

                {willHaveCostChange && (
                  <li className="flex items-center justify-between">
                    <span>Novo Custo de Aquisição:</span>
                    <strong className="font-mono text-slate-800">
                      R${' '}
                      {Number(costPriceValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </li>
                )}

                <li className="flex items-center justify-between pt-1 border-t border-orange-200/60 text-[11px] text-slate-500">
                  <span>Auditoria / Histórico:</span>
                  <span>Registrado em cada ficha técnica</span>
                </li>
              </ul>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px] space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#d9532f]" />
                Segurança e Consistência:
              </div>
              <p>
                Esta alteração será gravada em lote no banco de dados e refletida imediatamente no
                catálogo, detalhes do lote e visualizações agrupadas, sem necessidade de recarregar
                a página.
              </p>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('config')}
                disabled={isSubmitting}
              >
                Voltar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="bg-[#d9532f] hover:bg-[#c24624] text-white font-semibold shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aplicando alterações...
                  </>
                ) : (
                  `Confirmar e Aplicar em ${selectedProducts.length} Itens`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
