import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Layers,
  Monitor,
  ExternalLink,
  Check,
  Link as LinkIcon,
  Sparkles,
  Loader2,
  Unlink,
} from 'lucide-react'
import { MLSellerItem, MLMatchedProduct, formatProductConfigSpecs } from '@/services/mlService'

export type MatchedProductItem = MLMatchedProduct

export function formatProductSpecs(product: {
  name?: string
  processor?: string
  ram?: string
  storage?: string
  screen_size?: string
  brand?: string
  model?: string
}): string {
  const parsed = formatProductConfigSpecs(product, { includeModel: false })
  return parsed.specsOnly || parsed.compactSummary || 'Configuração padrão'
}

interface ProductSpecsDisplayProps {
  item: MLSellerItem
  variant?: 'table' | 'card'
  maxVisible?: number
  onConfirmLink?: (productId: string, mlItemId: string) => Promise<void>
  onUnlink?: (productId: string) => Promise<void>
  onOpenManualSelector?: (item: MLSellerItem) => void
}

export function MLItemMatchedProductsDisplay({
  item,
  variant = 'card',
  maxVisible = 2,
  onConfirmLink,
  onUnlink,
  onOpenManualSelector,
}: ProductSpecsDisplayProps) {
  const [expanded, setExpanded] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  const products: MatchedProductItem[] =
    item.matchedProducts && item.matchedProducts.length > 0
      ? item.matchedProducts
      : item.matchedProduct
        ? [item.matchedProduct]
        : []

  const handleLink = async (productId: string) => {
    if (!onConfirmLink) return
    setLinkingId(productId)
    try {
      await onConfirmLink(productId, item.id)
    } finally {
      setLinkingId(null)
    }
  }

  const handleUnlink = async (productId: string) => {
    if (!onUnlink) return
    setUnlinkingId(productId)
    try {
      await onUnlink(productId)
    } finally {
      setUnlinkingId(null)
    }
  }

  const isCatalog = Boolean(item.catalog_product_id || item.catalog_listing)

  // Para anúncios de catálogo, o indicador mora na célula ANÚNCIO.
  // Esta coluna exibe um traço discreto (—) quando for anúncio de catálogo no modo tabela,
  // ou os produtos vinculados caso existam.
  if (isCatalog) {
    if (variant === 'table') {
      if (!products || products.length === 0) {
        return (
          <span
            className="text-slate-300 text-xs font-mono select-none"
            title="Anúncio de catálogo ML (indicador de variações exibido na coluna Anúncio)"
          >
            —
          </span>
        )
      }
      // Se houver produto vinculado no catálogo local, permite visualizar/confirmar
    } else if (!products || products.length === 0) {
      // No modo card, não exibe o bloco se não houver produto interno vinculado
      return null
    }
  }

  const visibleProducts = expanded ? products : products.slice(0, maxVisible)
  const remainingCount = products.length - maxVisible

  if (products.length === 0) {
    return (
      <div
        className={
          variant === 'table'
            ? 'text-[11px] text-slate-400 py-1 space-y-1'
            : 'text-[11px] text-slate-400 py-1 space-y-1.5'
        }
      >
        <div className="flex items-center gap-1.5 text-slate-400 italic">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span>Sem produto vinculado</span>
        </div>
        {onOpenManualSelector && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenManualSelector(item)}
            className="h-6 text-[10px] px-2 text-blue-700 bg-blue-50/70 border-blue-200 hover:bg-blue-100 font-medium inline-flex items-center gap-1 cursor-pointer"
            title="Escolher manualmente um produto do estoque para vincular"
          >
            <LinkIcon className="w-3 h-3 text-blue-600" />
            <span>Vincular produto</span>
          </Button>
        )}
      </div>
    )
  }

  // ===================== MODO TABELA =====================
  if (variant === 'table') {
    return (
      <div className="text-[11px] max-w-[280px] space-y-1.5">
        <div className="space-y-1.5">
          {visibleProducts.map((prod) => {
            const specLine = formatProductSpecs(prod)
            const isSuggested = prod.is_suggested || prod.match_type === 'similarity'

            return (
              <div
                key={prod.id}
                className={`p-1.5 rounded text-[11px] space-y-1 transition-colors ${
                  isSuggested
                    ? 'bg-amber-50/80 border border-amber-200/90'
                    : 'bg-emerald-50/70 border border-emerald-100'
                }`}
              >
                {/* Cabeçalho do item de produto */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    {isSuggested ? (
                      <span
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-200/70 text-amber-900 border border-amber-300 shrink-0"
                        title={
                          prod.match_score
                            ? `Sugestão automática (${prod.match_score}% de correspondência)`
                            : 'Sugestão automática'
                        }
                      >
                        <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                        <span>Sugerido</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-200/70 text-emerald-900 border border-emerald-300 shrink-0"
                        title="Vínculo confirmado no estoque"
                      >
                        <Check className="w-2.5 h-2.5 text-emerald-700" />
                        <span>Confirmado</span>
                      </span>
                    )}

                    <span
                      className={`font-bold truncate max-w-[150px] ${
                        isSuggested ? 'text-amber-950' : 'text-emerald-950'
                      }`}
                      title={prod.name}
                    >
                      {prod.name}
                    </span>
                  </div>

                  <Link
                    to={`/catalogo/${prod.id}`}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5 shrink-0"
                    title="Ver no Catálogo de Produtos"
                  >
                    <span>Ver</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {/* Linha com Especificações em destaque (Processador, RAM, Storage, Tela) */}
                <div
                  className={`text-[10.5px] font-medium flex items-center gap-1 truncate ${
                    isSuggested ? 'text-amber-900' : 'text-emerald-900'
                  }`}
                  title={specLine}
                >
                  <Cpu
                    className={`w-3 h-3 shrink-0 ${
                      isSuggested ? 'text-amber-700' : 'text-emerald-600'
                    }`}
                  />
                  <span className="truncate font-semibold">{specLine}</span>
                </div>

                {/* SKU + Botão de Ação */}
                <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px] text-slate-500 font-mono">
                  <span className="truncate">SKU: {prod.sku || 'N/A'}</span>

                  {isSuggested && onConfirmLink && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={linkingId === prod.id}
                      onClick={() => handleLink(prod.id)}
                      className="h-5 px-1.5 text-[9.5px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-2xs gap-1 cursor-pointer shrink-0"
                      title="Confirmar e gravar vínculo permanente deste produto no estoque"
                    >
                      {linkingId === prod.id ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Check className="w-2.5 h-2.5" />
                      )}
                      <span>Vincular</span>
                    </Button>
                  )}

                  {!isSuggested && onUnlink && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={unlinkingId === prod.id}
                      onClick={() => handleUnlink(prod.id)}
                      className="h-5 px-1 text-[9.5px] text-slate-400 hover:text-red-600 hover:bg-red-50 gap-0.5 cursor-pointer shrink-0"
                      title="Desvincular produto deste anúncio"
                    >
                      {unlinkingId === prod.id ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Unlink className="w-2.5 h-2.5" />
                      )}
                      <span>Desvincular</span>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Expansão e Botão manual */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          {products.length > maxVisible && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-1.5 py-0.5 rounded transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Recolher</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>+{remainingCount} configs</span>
                </>
              )}
            </button>
          )}

          {onOpenManualSelector && (
            <button
              type="button"
              onClick={() => onOpenManualSelector(item)}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 hover:underline ml-auto"
              title="Trocar ou vincular outro produto"
            >
              <LinkIcon className="w-2.5 h-2.5" />
              <span>Alterar</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // ===================== MODO CARD =====================
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-sans font-bold uppercase tracking-wider flex items-center gap-1 text-slate-700">
          <Layers className="w-3 h-3 text-slate-500" />
          Vínculo Catálogo ({products.length})
        </span>

        <div className="flex items-center gap-1.5">
          {products.length > maxVisible && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              {expanded ? (
                <>
                  <span>Menos</span>
                  <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  <span>+{remainingCount} configs</span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}

          {onOpenManualSelector && (
            <button
              type="button"
              onClick={() => onOpenManualSelector(item)}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5 hover:underline"
              title="Vincular ou trocar produto manualmente"
            >
              <LinkIcon className="w-2.5 h-2.5" />
              <span>Vincular</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {visibleProducts.map((prod) => {
          const specLine = formatProductSpecs(prod)
          const isSuggested = prod.is_suggested || prod.match_type === 'similarity'

          return (
            <div
              key={prod.id}
              className={`p-2 rounded-md text-[11px] space-y-1.5 transition-colors ${
                isSuggested
                  ? 'bg-amber-50/80 border border-amber-200/90'
                  : 'bg-emerald-50/80 border border-emerald-200/80'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  {isSuggested ? (
                    <span
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300 shrink-0"
                      title={
                        prod.match_score
                          ? `Sugestão por similaridade (${prod.match_score}%)`
                          : 'Sugestão'
                      }
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                      <span>Sugerido</span>
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-200/80 text-emerald-900 border border-emerald-300 shrink-0"
                      title="Vínculo confirmado no estoque"
                    >
                      <Check className="w-2.5 h-2.5 text-emerald-700" />
                      <span>Confirmado</span>
                    </span>
                  )}

                  <span
                    className={`font-bold truncate ${
                      isSuggested ? 'text-amber-950' : 'text-emerald-950'
                    }`}
                    title={prod.name}
                  >
                    {prod.name}
                  </span>
                </div>

                <Link
                  to={`/catalogo/${prod.id}`}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 shrink-0 inline-flex items-center gap-0.5 font-mono"
                >
                  <span>#{prod.sku || prod.id.slice(0, 6)}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>

              {/* Badges de Specs formatadas de forma legível */}
              {(() => {
                const parsed = formatProductConfigSpecs(prod, { includeModel: false })
                const effectiveProc = prod.processor || parsed.processor
                const effectiveRam = prod.ram || parsed.ram
                const effectiveStorage = prod.storage || parsed.storage
                const effectiveScreen = prod.screen_size || parsed.screen

                return (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    {effectiveProc && (
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px] font-medium bg-white text-slate-800 border-slate-300 gap-1 shrink-0"
                      >
                        <Cpu className="w-2.5 h-2.5 text-blue-600" />
                        <span>{effectiveProc}</span>
                      </Badge>
                    )}
                    {effectiveRam && (
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px] font-medium bg-white text-slate-800 border-slate-300 gap-1 shrink-0"
                      >
                        <Layers className="w-2.5 h-2.5 text-purple-600" />
                        <span>{effectiveRam}</span>
                      </Badge>
                    )}
                    {effectiveStorage && (
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px] font-medium bg-white text-slate-800 border-slate-300 gap-1 shrink-0"
                      >
                        <HardDrive className="w-2.5 h-2.5 text-amber-600" />
                        <span>{effectiveStorage}</span>
                      </Badge>
                    )}
                    {effectiveScreen && (
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px] font-medium bg-white text-slate-800 border-slate-300 gap-1 shrink-0"
                      >
                        <Monitor className="w-2.5 h-2.5 text-emerald-600" />
                        <span>{effectiveScreen}</span>
                      </Badge>
                    )}

                    {!effectiveProc && !effectiveRam && !effectiveStorage && (
                      <span className="text-[10px] text-slate-600 italic">{specLine}</span>
                    )}
                  </div>
                )
              })()}

              {/* Botão de confirmação de vínculo (1 clique) */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50">
                <span className="text-[10px] text-slate-500 font-mono">
                  {prod.status ? `Status: ${prod.status}` : ''}
                </span>

                {isSuggested && onConfirmLink && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={linkingId === prod.id}
                    onClick={() => handleLink(prod.id)}
                    className="h-6 px-2 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-2xs gap-1 cursor-pointer"
                  >
                    {linkingId === prod.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    <span>Vincular ao estoque</span>
                  </Button>
                )}

                {!isSuggested && onUnlink && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={unlinkingId === prod.id}
                    onClick={() => handleUnlink(prod.id)}
                    className="h-6 px-1.5 text-[10px] text-slate-400 hover:text-red-600 hover:bg-red-50 gap-1 cursor-pointer"
                  >
                    {unlinkingId === prod.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Unlink className="w-3 h-3" />
                    )}
                    <span>Desvincular</span>
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
