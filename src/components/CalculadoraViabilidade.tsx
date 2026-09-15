import React, { useState, useEffect } from 'react'
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Percent,
  Truck,
  DollarSign,
  TrendingUp,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface ViabilityDefaults {
  feePercent: number // Anúncio / Comissão ML (ex: 13%)
  taxPercent: number // NF / Imposto Nota Fiscal (ex: 10%)
  opPercent: number // Custos Operacionais (ex: 2%)
  shippingValue: number // Frete R$ pago ao ML (ex: 19.00)
  profitPercent: number // Margem de lucro desejada (ex: 20%)
}

export const VIABILITY_STORAGE_KEY = 'ml_viability_calculator_defaults_v1'

export const DEFAULT_VIABILITY_CONFIG: ViabilityDefaults = {
  feePercent: 13,
  taxPercent: 10,
  opPercent: 2,
  shippingValue: 19.0,
  profitPercent: 20,
}

export function loadViabilityDefaults(): ViabilityDefaults {
  if (typeof window === 'undefined') return DEFAULT_VIABILITY_CONFIG
  try {
    const raw = localStorage.getItem(VIABILITY_STORAGE_KEY)
    if (!raw) return DEFAULT_VIABILITY_CONFIG
    const parsed = JSON.parse(raw)
    return {
      feePercent:
        typeof parsed.feePercent === 'number' && !isNaN(parsed.feePercent)
          ? parsed.feePercent
          : DEFAULT_VIABILITY_CONFIG.feePercent,
      taxPercent:
        typeof parsed.taxPercent === 'number' && !isNaN(parsed.taxPercent)
          ? parsed.taxPercent
          : DEFAULT_VIABILITY_CONFIG.taxPercent,
      opPercent:
        typeof parsed.opPercent === 'number' && !isNaN(parsed.opPercent)
          ? parsed.opPercent
          : DEFAULT_VIABILITY_CONFIG.opPercent,
      shippingValue:
        typeof parsed.shippingValue === 'number' && !isNaN(parsed.shippingValue)
          ? parsed.shippingValue
          : DEFAULT_VIABILITY_CONFIG.shippingValue,
      profitPercent:
        typeof parsed.profitPercent === 'number' && !isNaN(parsed.profitPercent)
          ? parsed.profitPercent
          : DEFAULT_VIABILITY_CONFIG.profitPercent,
    }
  } catch {
    return DEFAULT_VIABILITY_CONFIG
  }
}

export function saveViabilityDefaults(values: ViabilityDefaults): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VIABILITY_STORAGE_KEY, JSON.stringify(values))
  } catch {
    /* ignore storage quota errors */
  }
}

export interface CalculadoraViabilidadeProps {
  /** Preço atual configurado no card / formPrice */
  currentPrice: number
  /** Preço líder da Buy Box (se houver) */
  buyBoxLeaderPrice?: number | null
  /** Nome ou identificador do líder */
  leaderName?: string | null
  /** Frete sugerido da API se disponível */
  suggestedShipping?: number | null
  /** Se o card está selecionado / desabilitado */
  disabled?: boolean
  /** Callback para sincronizar de volta o preço no card se o usuário desejar */
  onSyncCardPrice?: (newPrice: number) => void
  /** Se o bloco está expandido (usado no modo collapsible padrão) */
  isOpen?: boolean
  /** Toggle abrir/fechar (usado no modo collapsible padrão) */
  onToggle?: () => void
  /** Modo popover flutuante (sem toggle colapsável externo, renderiza o corpo diretamente) */
  isPopover?: boolean
  /** Título customizado opcional do item para contexto */
  itemTitle?: string
}

export function CalculadoraViabilidade({
  currentPrice,
  buyBoxLeaderPrice,
  leaderName,
  suggestedShipping,
  disabled = false,
  onSyncCardPrice,
  isOpen = false,
  onToggle,
  isPopover = false,
  itemTitle,
}: CalculadoraViabilidadeProps) {
  // Inicialização a partir de localStorage
  const [defaults, setDefaults] = useState<ViabilityDefaults>(() => loadViabilityDefaults())

  // Campos locais editáveis da calculadora
  const [sellingPrice, setSellingPrice] = useState<number>(currentPrice || 0)
  const [feePercent, setFeePercent] = useState<number>(defaults.feePercent)
  const [taxPercent, setTaxPercent] = useState<number>(defaults.taxPercent)
  const [opPercent, setOpPercent] = useState<number>(defaults.opPercent)
  const [shippingValue, setShippingValue] = useState<number>(
    suggestedShipping != null && suggestedShipping > 0 ? suggestedShipping : defaults.shippingValue,
  )
  const [profitPercent, setProfitPercent] = useState<number>(defaults.profitPercent)

  // Sincroniza o sellingPrice se o currentPrice mudar externamente enquanto a calculadora está sincronizada
  useEffect(() => {
    if (currentPrice > 0) {
      setSellingPrice(currentPrice)
    }
  }, [currentPrice])

  // Atualiza frete se suggestedShipping vier da API depois do mount
  useEffect(() => {
    if (suggestedShipping != null && suggestedShipping > 0) {
      setShippingValue(suggestedShipping)
    }
  }, [suggestedShipping])

  // Salvar novos percentuais no localStorage automaticamente para reutilização em buscas futuras
  const updateDefaultsAndSave = (partial: Partial<ViabilityDefaults>) => {
    const updated: ViabilityDefaults = {
      feePercent: partial.feePercent ?? feePercent,
      taxPercent: partial.taxPercent ?? taxPercent,
      opPercent: partial.opPercent ?? opPercent,
      shippingValue: partial.shippingValue ?? shippingValue,
      profitPercent: partial.profitPercent ?? profitPercent,
    }
    setDefaults(updated)
    saveViabilityDefaults(updated)
  }

  // Cálculos matemáticos de viabilidade
  const effectivePrice = Math.max(0, sellingPrice || 0)
  const feeAmount = (effectivePrice * (feePercent || 0)) / 100
  const taxAmount = (effectivePrice * (taxPercent || 0)) / 100
  const opAmount = (effectivePrice * (opPercent || 0)) / 100
  const shippingAmount = Math.max(0, shippingValue || 0)
  const profitAmount = (effectivePrice * (profitPercent || 0)) / 100

  // Custo operacional total da venda: Anúncio + NF + OP + Frete
  const totalOperationalCost = feeAmount + taxAmount + opAmount + shippingAmount

  // Preço teto máximo de compra para atingir o lucro desejado:
  // Preço de Venda − Custo Operacional − Lucro Desejado
  const maxPurchasePrice = effectivePrice - totalOperationalCost - profitAmount

  // Comparação com líder da Buy Box
  const hasLeader = buyBoxLeaderPrice != null && Number(buyBoxLeaderPrice) > 0
  const leaderPriceNum = hasLeader ? Number(buyBoxLeaderPrice) : 0

  // Margem em relação ao preço líder: se vendermos ao preço líder, qual seria o teto de compra?
  const leaderFeeAmount = (leaderPriceNum * (feePercent || 0)) / 100
  const leaderTaxAmount = (leaderPriceNum * (taxPercent || 0)) / 100
  const leaderOpAmount = (leaderPriceNum * (opPercent || 0)) / 100
  const leaderProfitAmount = (leaderPriceNum * (profitPercent || 0)) / 100
  const leaderTotalOpCost = leaderFeeAmount + leaderTaxAmount + leaderOpAmount + shippingAmount
  const leaderMaxPurchasePrice = leaderPriceNum - leaderTotalOpCost - leaderProfitAmount

  // Formatação em moeda
  const formatBrl = (val: number) =>
    Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  const resetToDefaultParams = () => {
    setFeePercent(DEFAULT_VIABILITY_CONFIG.feePercent)
    setTaxPercent(DEFAULT_VIABILITY_CONFIG.taxPercent)
    setOpPercent(DEFAULT_VIABILITY_CONFIG.opPercent)
    setShippingValue(DEFAULT_VIABILITY_CONFIG.shippingValue)
    setProfitPercent(DEFAULT_VIABILITY_CONFIG.profitPercent)
    saveViabilityDefaults(DEFAULT_VIABILITY_CONFIG)
  }

  const handleApplyLeaderPrice = () => {
    if (!hasLeader) return
    setSellingPrice(leaderPriceNum)
    if (onSyncCardPrice) {
      onSyncCardPrice(leaderPriceNum)
    }
  }

  // Renderizador do corpo central da calculadora (compartilhado entre collapsible inline e popover)
  const renderCalculatorBody = () => (
    <div
      className={`rounded-lg bg-white border border-blue-200 shadow-sm space-y-3 animate-fadeIn ${
        isPopover ? 'p-3 w-full' : 'p-3 mt-2.5'
      }`}
    >
      {/* Header interno com identificação e botão de restaurar/líder */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800 truncate">
            Viabilidade de Compra & Margem
          </span>
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-300 shrink-0"
          >
            Local / Leitura
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasLeader && leaderPriceNum !== effectivePrice && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleApplyLeaderPrice}
              className="h-6 text-[10px] px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold flex items-center gap-1"
              title={`Preencher com o preço do líder atual (${formatBrl(leaderPriceNum)})`}
            >
              <ArrowRight className="w-2.5 h-2.5 text-emerald-600" />
              <span>Usar preço líder ({formatBrl(leaderPriceNum)})</span>
            </Button>
          )}

          <button
            type="button"
            onClick={resetToDefaultParams}
            className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            title="Restaurar percentuais padrão (13% anúncio, 10% NF, 2% OP, R$ 19 frete, 20% lucro)"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Padrões</span>
          </button>
        </div>
      </div>

      {itemTitle && (
        <p
          className="text-[11px] font-medium text-slate-600 truncate -mt-1 pb-0.5"
          title={itemTitle}
        >
          {itemTitle}
        </p>
      )}

      {/* Grid de Inputs Editáveis */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {/* 1. Preço de Venda */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-600 flex items-center justify-between">
            <span>Venda (R$)</span>
            {onSyncCardPrice && (
              <span className="text-[9px] text-blue-600 font-normal">Sincronizado</span>
            )}
          </label>
          <div className="relative">
            <Input
              type="number"
              min={1}
              step={1}
              value={sellingPrice}
              onChange={(e) => {
                const val = Number(e.target.value)
                setSellingPrice(val)
                if (onSyncCardPrice && val > 0) {
                  onSyncCardPrice(val)
                }
              }}
              disabled={disabled}
              className="h-7 text-xs font-mono font-bold bg-slate-50 pr-2 pl-2"
            />
          </div>
        </div>

        {/* 2. % Anúncio (Comissão ML) */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-600 flex items-center justify-between">
            <span>% Anúncio</span>
            <span className="text-[10px] text-slate-400 font-mono font-normal">
              {formatBrl(feeAmount)}
            </span>
          </label>
          <div className="relative flex items-center">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={feePercent}
              onChange={(e) => {
                const val = Number(e.target.value)
                setFeePercent(val)
                updateDefaultsAndSave({ feePercent: val })
              }}
              className="h-7 text-xs font-mono font-bold bg-slate-50 pr-5 pl-2"
            />
            <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
          </div>
        </div>

        {/* 3. % NF (Imposto Nota Fiscal) */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-600 flex items-center justify-between">
            <span>% NF</span>
            <span className="text-[10px] text-slate-400 font-mono font-normal">
              {formatBrl(taxAmount)}
            </span>
          </label>
          <div className="relative flex items-center">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={taxPercent}
              onChange={(e) => {
                const val = Number(e.target.value)
                setTaxPercent(val)
                updateDefaultsAndSave({ taxPercent: val })
              }}
              className="h-7 text-xs font-mono font-bold bg-slate-50 pr-5 pl-2"
            />
            <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
          </div>
        </div>

        {/* 4. % Operacional */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-600 flex items-center justify-between">
            <span>% OP (Operac.)</span>
            <span className="text-[10px] text-slate-400 font-mono font-normal">
              {formatBrl(opAmount)}
            </span>
          </label>
          <div className="relative flex items-center">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={opPercent}
              onChange={(e) => {
                const val = Number(e.target.value)
                setOpPercent(val)
                updateDefaultsAndSave({ opPercent: val })
              }}
              className="h-7 text-xs font-mono font-bold bg-slate-50 pr-5 pl-2"
            />
            <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
          </div>
        </div>

        {/* 5. Frete R$ */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Truck className="w-2.5 h-2.5 text-slate-500" /> Frete (R$)
            </span>
            <span className="text-[9px] text-slate-400 font-normal">ML</span>
          </label>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={shippingValue}
            onChange={(e) => {
              const val = Number(e.target.value)
              setShippingValue(val)
              updateDefaultsAndSave({ shippingValue: val })
            }}
            className="h-7 text-xs font-mono font-bold bg-slate-50 pr-2 pl-2"
          />
        </div>

        {/* 6. % Lucro Desejado */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-emerald-800 flex items-center justify-between">
            <span>% Lucro</span>
            <span className="text-[10px] text-emerald-700 font-mono font-normal">
              {formatBrl(profitAmount)}
            </span>
          </label>
          <div className="relative flex items-center">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={profitPercent}
              onChange={(e) => {
                const val = Number(e.target.value)
                setProfitPercent(val)
                updateDefaultsAndSave({ profitPercent: val })
              }}
              className="h-7 text-xs font-mono font-bold bg-emerald-50/50 border-emerald-300 text-emerald-950 pr-5 pl-2"
            />
            <Percent className="w-3 h-3 text-emerald-600 absolute right-1.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Discriminação Rápida dos Valores de Custo com Rótulos Alinhados */}
      <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1.5">
        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            <span>Comissão ML ({feePercent}%):</span>
          </span>
          <span className="font-semibold text-slate-800">{formatBrl(feeAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
            <span>Imposto NF ({taxPercent}%):</span>
          </span>
          <span className="font-semibold text-slate-800">{formatBrl(taxAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            <span>Operacional ({opPercent}%):</span>
          </span>
          <span className="font-semibold text-slate-800">{formatBrl(opAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>Frete fixo Mercado Livre:</span>
          </span>
          <span className="font-semibold text-slate-800">{formatBrl(shippingAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-emerald-700 pt-1.5 border-t border-slate-200">
          <span className="font-sans font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Margem de Lucro Desejada ({profitPercent}%):</span>
          </span>
          <span className="font-black text-xs">{formatBrl(profitAmount)}</span>
        </div>
      </div>

      {/* Destaque Principal dos Resultados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
        {/* Custo Operacional Total */}
        <div className="p-2.5 rounded-lg bg-slate-100/90 border border-slate-300">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">
            Custo Operacional Total
          </span>
          <span className="text-base font-black font-mono text-slate-900 block mt-0.5">
            {formatBrl(totalOperationalCost)}
          </span>
          <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
            Anúncio + NF + Operacional + Frete
          </span>
        </div>

        {/* Linha Principal: Comprar abaixo de R$ X */}
        <div
          className={`p-2.5 rounded-lg border shadow-2xs transition-colors ${
            maxPurchasePrice > 0
              ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
              : 'bg-rose-50/95 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] uppercase font-extrabold text-emerald-900 block tracking-tight">
              🎯 Comprar abaixo de:
            </span>
            <Badge
              variant="outline"
              className={`text-[9px] px-1 py-0 font-bold ${
                maxPurchasePrice > 0
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-rose-600 text-white border-rose-700'
              }`}
            >
              {maxPurchasePrice > 0 ? 'Viável' : 'Inviável'}
            </Badge>
          </div>

          <span
            className={`text-lg font-black font-mono block mt-0.5 ${
              maxPurchasePrice > 0 ? 'text-emerald-800' : 'text-rose-700'
            }`}
          >
            {formatBrl(maxPurchasePrice)}
          </span>
          <span className="text-[10px] opacity-85 block leading-tight mt-0.5">
            Preço teto de compra para garantir {profitPercent}% de lucro.
          </span>
        </div>
      </div>

      {/* Comparativo com o Preço Líder (se houver líder registrado) */}
      {hasLeader && (
        <div className="p-2 rounded bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 font-bold">
              <TrendingUp className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span className="truncate">
                Comparativo Líder Buy Box: <strong>{formatBrl(leaderPriceNum)}</strong>
                {leaderName ? ` (${leaderName})` : ''}
              </span>
            </div>
            <p className="text-[11px] text-blue-800 leading-tight">
              Vendendo no preço do líder ({formatBrl(leaderPriceNum)}), o teto de compra seria{' '}
              <strong className="font-mono">{formatBrl(leaderMaxPurchasePrice)}</strong>.
            </p>
          </div>

          {leaderPriceNum !== effectivePrice && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleApplyLeaderPrice}
              className="h-7 text-xs bg-white hover:bg-blue-100/60 text-blue-900 border-blue-300 font-semibold shrink-0"
            >
              Aplicar R$ {leaderPriceNum}
            </Button>
          )}
        </div>
      )}

      {/* Nota de rodapé explicativa */}
      <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-0.5">
        <Info className="w-3 h-3 text-slate-400 shrink-0" />
        <span>
          Cálculo 100% local e seguro. Valores salvos no navegador; nenhuma alteração é enviada ao
          Mercado Livre.
        </span>
      </div>
    </div>
  )

  // Caso seja usado diretamente no Popover (sem gatilho externo de sanfona)
  if (isPopover) {
    return renderCalculatorBody()
  }

  // Caso padrão: bloco recolhível / expansível no rodapé do card
  return (
    <div className="w-full mt-1.5 pt-1.5 border-t border-slate-200">
      {/* Gatilho recolhido / cabeçalho com preview do teto */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer border ${
            isOpen
              ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
          }`}
          title="Calculadora rápida de viabilidade de compra e margem de revenda"
        >
          <Calculator className={`w-3.5 h-3.5 ${isOpen ? 'text-white' : 'text-blue-600'}`} />
          <span>Calculadora de Viabilidade</span>
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-200" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>

        {/* Resumo compacto quando recolhido */}
        {!isOpen && effectivePrice > 0 && (
          <div className="text-[11px] text-right font-mono flex items-center gap-1.5">
            <span className="text-slate-500">Comprar abaixo:</span>
            <span
              className={`font-black ${
                maxPurchasePrice > 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {formatBrl(maxPurchasePrice)}
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo expandido da calculadora */}
      {isOpen && renderCalculatorBody()}
    </div>
  )
}
