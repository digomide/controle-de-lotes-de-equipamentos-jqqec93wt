import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Cpu, HardDrive, Layers, Monitor, ExternalLink } from 'lucide-react'
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
}

export function MLItemMatchedProductsDisplay({
  item,
  variant = 'card',
  maxVisible = 2,
}: ProductSpecsDisplayProps) {
  const [expanded, setExpanded] = useState(false)

  const products: MatchedProductItem[] =
    item.matchedProducts && item.matchedProducts.length > 0
      ? item.matchedProducts
      : item.matchedProduct
        ? [item.matchedProduct]
        : []

  if (products.length === 0) {
    return (
      <div
        className={
          variant === 'table'
            ? 'text-[11px] text-slate-400 italic'
            : 'text-[11px] text-slate-400 italic py-1'
        }
      >
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          Sem produto vinculado
        </span>
      </div>
    )
  }

  const visibleProducts = expanded ? products : products.slice(0, maxVisible)
  const remainingCount = products.length - maxVisible

  if (variant === 'table') {
    return (
      <div className="text-[11px] max-w-[260px] space-y-1.5">
        <div className="space-y-1">
          {visibleProducts.map((prod) => {
            const specLine = formatProductSpecs(prod)
            return (
              <div
                key={prod.id}
                className="p-1.5 rounded bg-emerald-50/70 border border-emerald-100 text-[11px] space-y-0.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="font-bold text-emerald-950 truncate max-w-[170px]"
                    title={prod.name}
                  >
                    {prod.name}
                  </span>
                  <Link
                    to={`/catalogo/${prod.id}`}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5 shrink-0"
                    title="Ver no Catálogo"
                  >
                    <span>Ver</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {/* Linha com Especificações em destaque */}
                <div
                  className="text-[10.5px] text-emerald-800 font-medium flex items-center gap-1 truncate"
                  title={specLine}
                >
                  <Cpu className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">{specLine}</span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <span>SKU: {prod.sku || 'N/A'}</span>
                  {prod.status && <span className="text-slate-400">({prod.status})</span>}
                </div>
              </div>
            )
          })}
        </div>

        {products.length > maxVisible && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100/70 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Recolher ({products.length} configurações)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>+{remainingCount} configuração(ões) vinculada(s)</span>
              </>
            )}
          </button>
        )}
      </div>
    )
  }

  // ===================== MODO CARD =====================
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-sans font-bold uppercase text-emerald-900 tracking-wider flex items-center gap-1">
          <Layers className="w-3 h-3 text-emerald-600" />
          Produtos & Configurações ({products.length})
        </span>
        {products.length > maxVisible && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 transition-colors cursor-pointer"
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
      </div>

      <div className="space-y-1.5">
        {visibleProducts.map((prod) => {
          const specLine = formatProductSpecs(prod)
          return (
            <div
              key={prod.id}
              className="p-2 rounded-md bg-emerald-50/80 border border-emerald-200/80 text-[11px] space-y-1"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-emerald-950 truncate flex-1" title={prod.name}>
                  {prod.name}
                </span>
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
