import React, { useState } from 'react'
import {
  Layers,
  Percent,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calculator,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lock,
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { mlService, type MLSellerItem } from '@/services/mlService'
import { isItemCatalog } from '@/pages/AnunciosML'

interface MLBulkPriceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedItems: MLSellerItem[]
  onSuccess: () => void
}

type BulkActionType =
  | 'percent_increase'
  | 'percent_decrease'
  | 'match_catalog_price'
  | 'margin_over_cost'

export function MLBulkPriceModal({
  open,
  onOpenChange,
  selectedItems,
  onSuccess,
}: MLBulkPriceModalProps) {
  const { toast } = useToast()

  const [actionType, setActionType] = useState<BulkActionType>('percent_increase')
  const [percentValue, setPercentValue] = useState<number>(10)
  const [targetMargin, setTargetMargin] = useState<number>(30)
  const [loading, setLoading] = useState(false)
  const [progressText, setProgressText] = useState('')

  // Separação de itens de catálogo vs tradicionais
  const catalogCount = selectedItems.filter((i) => isItemCatalog(i)).length

  // Pré-visualização dos cálculos para os itens selecionados
  const previews = selectedItems.map((item) => {
    const currentPrice = Number(item.price) || 0
    let suggestedPrice = currentPrice
    let note = ''

    if (isItemCatalog(item)) {
      return {
        item,
        currentPrice,
        suggestedPrice: currentPrice,
        note: 'Catálogo Unificado (preço gerenciado via ML/Ideris)',
        canApply: false,
      }
    }

    if (actionType === 'percent_increase') {
      suggestedPrice = currentPrice * (1 + (percentValue || 0) / 100)
      note = `+${percentValue}%`
    } else if (actionType === 'percent_decrease') {
      suggestedPrice = Math.max(1, currentPrice * (1 - (percentValue || 0) / 100))
      note = `-${percentValue}%`
    } else if (actionType === 'match_catalog_price') {
      if (item.matchedProduct?.unit_price && item.matchedProduct.unit_price > 0) {
        suggestedPrice = item.matchedProduct.unit_price
        note = 'Preço de venda do catálogo'
      } else {
        note = 'Sem preço no catálogo'
      }
    } else if (actionType === 'margin_over_cost') {
      const cost = Number(item.matchedProduct?.cost_price) || 0
      if (cost > 0) {
        // Margem alvo: Preço = Custo / (1 - margem%)
        const marginDecimal = (targetMargin || 30) / 100
        if (marginDecimal < 0.95) {
          suggestedPrice = cost / (1 - marginDecimal)
          note = `Margem ${targetMargin}% s/ custo (R$ ${cost.toFixed(2)})`
        }
      } else {
        note = 'Sem custo de aquisição vinculado'
      }
    }

    return {
      item,
      currentPrice,
      suggestedPrice: Number(suggestedPrice.toFixed(2)),
      note,
      canApply: suggestedPrice > 0 && suggestedPrice !== currentPrice,
    }
  })

  const applicableCount = previews.filter((p) => p.canApply && !isItemCatalog(p.item)).length

  const handleApplyBulk = async () => {
    if (applicableCount === 0) {
      toast({
        title: 'Nenhum item aplicável',
        description:
          catalogCount > 0 && catalogCount === selectedItems.length
            ? 'Todos os anúncios selecionados são de Catálogo Unificado e têm o preço gerenciado via painel do ML ou Ideris.'
            : 'Nenhum dos anúncios selecionados pode ser atualizado com esta regra.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    let appliedCount = 0
    let failedCount = 0

    try {
      const itemsToUpdate = previews.filter((p) => p.canApply && !isItemCatalog(p.item))

      for (let i = 0; i < itemsToUpdate.length; i++) {
        const p = itemsToUpdate[i]
        setProgressText(`Atualizando ${i + 1} de ${itemsToUpdate.length} anúncios...`)

        try {
          await mlService.updateItemPrice(p.item.id, p.suggestedPrice, p.item.matchedProduct?.id)
          appliedCount++
        } catch (err: any) {
          console.error(`Falha ao atualizar preço do item ${p.item.id}:`, err)
          failedCount++
        }
      }

      toast({
        title: 'Ação em massa finalizada!',
        description: `${appliedCount} anúncio(s) atualizados com sucesso via fila oficial.${failedCount > 0 ? ` (${failedCount} falha(s))` : ''}`,
      })

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error('Erro na ação em massa:', err)
      const rawMsg = err.message || 'Falha ao processar ações.'
      const isPolicyAgent =
        rawMsg.includes('PolicyAgent') ||
        rawMsg.includes('PA_UNAUTHORIZED_RESULT_FROM_POLICIES') ||
        rawMsg.includes('At least one policy returned UNAUTHORIZED')

      toast({
        title: 'Erro na atualização em massa',
        description: isPolicyAgent
          ? rawMsg.includes('Preço Automático')
            ? rawMsg
            : 'Este anúncio é de Catálogo e o ML bloqueou a edição direta por política de catálogo. Atualize pelo painel do ML ou Ideris.'
          : rawMsg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setProgressText('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && onOpenChange(val)}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Calculator className="w-5 h-5 text-amber-600" />
            Editar Preço em Massa ({selectedItems.length} selecionados)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Aplique regras de reprecificação aos anúncios tradicionais selecionados.
          </DialogDescription>
        </DialogHeader>

        {/* Aviso de Catálogo Unificado quando houver itens de catálogo entre os selecionados */}
        {catalogCount > 0 && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
            <div className="flex items-center gap-2 font-bold text-blue-950">
              <Lock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                {catalogCount} de {selectedItems.length} anúncio(s) são de Catálogo Unificado
              </span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed font-sans">
              Este anúncio é de Catálogo Unificado — edite o preço pelo painel do ML ou Ideris. O
              sistema sincroniza o valor na próxima coleta. O sistema protegerá esses anúncios
              contra alterações diretas, aplicando as mudanças somente nos anúncios tradicionais.
            </p>
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Seletor do Tipo de Ação */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActionType('percent_increase')}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                actionType === 'percent_increase'
                  ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold ring-1 ring-emerald-500'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-emerald-700">
                <TrendingUp className="w-4 h-4" /> Aumento Percentual
              </div>
              <p className="text-[11px] font-normal text-slate-500">
                Aumentar X% sobre o preço atual do anúncio
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActionType('percent_decrease')}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                actionType === 'percent_decrease'
                  ? 'border-blue-500 bg-blue-50/50 text-blue-950 font-bold ring-1 ring-blue-500'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-blue-700">
                <TrendingDown className="w-4 h-4" /> Redução Percentual
              </div>
              <p className="text-[11px] font-normal text-slate-500">
                Desconto promocional de X% sobre o valor
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActionType('match_catalog_price')}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                actionType === 'match_catalog_price'
                  ? 'border-purple-500 bg-purple-50/50 text-purple-950 font-bold ring-1 ring-purple-500'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-purple-700">
                <RotateCcw className="w-4 h-4" /> Preço do Catálogo
              </div>
              <p className="text-[11px] font-normal text-slate-500">
                Replicar preço de venda do produto interno
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActionType('margin_over_cost')}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                actionType === 'margin_over_cost'
                  ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold ring-1 ring-amber-500'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-amber-700">
                <Sparkles className="w-4 h-4" /> Margem s/ Custo
              </div>
              <p className="text-[11px] font-normal text-slate-500">
                Margem alvo (%) sobre custo de lote/produto
              </p>
            </button>
          </div>

          {/* Campo de Parâmetro conforme a regra */}
          {(actionType === 'percent_increase' || actionType === 'percent_decrease') && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-4">
              <label className="text-xs font-semibold text-slate-700">
                Percentual a aplicar (%):
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.5"
                  max="200"
                  step="0.5"
                  value={percentValue}
                  onChange={(e) => setPercentValue(Number(e.target.value))}
                  className="w-24 text-xs h-8 font-mono font-bold bg-white"
                />
                <span className="text-xs font-bold text-slate-500">%</span>
              </div>
            </div>
          )}

          {actionType === 'margin_over_cost' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block">
                  Margem Alvo Desejada (%):
                </label>
                <span className="text-[11px] text-slate-500">
                  Preço sugerido = Custo ÷ (1 - Margem%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="5"
                  max="90"
                  step="1"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(Number(e.target.value))}
                  className="w-24 text-xs h-8 font-mono font-bold bg-white"
                />
                <span className="text-xs font-bold text-slate-500">%</span>
              </div>
            </div>
          )}

          {/* Prévia da Reprecificação */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>
                Prévia das alterações ({applicableCount} de {selectedItems.length} atualizáveis):
              </span>
            </h4>
            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs bg-white">
              {previews.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate">
                      {isItemCatalog(p.item) && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 shrink-0">
                          <Lock className="w-2.5 h-2.5 text-blue-600" />
                          Catálogo
                        </span>
                      )}
                      <p className="font-semibold text-slate-900 truncate" title={p.item.title}>
                        {p.item.title}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      MLB: {p.item.id} {p.note && `· ${p.note}`}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 font-mono">
                      {isItemCatalog(p.item) ? (
                        <span className="font-bold text-slate-500 text-xs">
                          R$ {p.currentPrice.toFixed(2)}
                        </span>
                      ) : (
                        <>
                          <span className="text-slate-400 line-through text-[11px]">
                            R$ {p.currentPrice.toFixed(2)}
                          </span>
                          <span
                            className={`font-bold ${p.canApply ? 'text-emerald-700' : 'text-slate-500'}`}
                          >
                            R$ {p.suggestedPrice.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleApplyBulk}
            disabled={loading || applicableCount === 0}
            className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {progressText || 'Aplicando...'}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmar Atualização de {applicableCount} anúncio(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
