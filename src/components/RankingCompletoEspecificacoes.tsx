import React, { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Cpu,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Flame,
  DollarSign,
  TrendingUp,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  X,
  Store,
  Package,
} from 'lucide-react'
import type { CollectorSpecMetrics, CollectorDeduplicatedAd } from '@/services/mlCollectorService'

export type SortField =
  | 'totalUnits'
  | 'totalRevenue'
  | 'weightedAvgPrice'
  | 'sharePercent'
  | 'adsWithSalesCount'
  | 'adCount'
  | 'spec'

export type SortOrder = 'asc' | 'desc'

interface RankingCompletoEspecificacoesProps {
  specs: CollectorSpecMetrics[]
  selectedSpecName: string | null
  onSelectSpec: (spec: CollectorSpecMetrics | null) => void
  totalSoldUnitsAll: number
  searchTerm: string
}

export function RankingCompletoEspecificacoes({
  specs,
  selectedSpecName,
  onSelectSpec,
  totalSoldUnitsAll,
  searchTerm,
}: RankingCompletoEspecificacoesProps) {
  const [filterText, setFilterText] = useState('')
  const [sortField, setSortField] = useState<SortField>('totalUnits')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [pageSize, setPageSize] = useState<number>(25)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [expandedSpec, setExpandedSpec] = useState<string | null>(null)

  // Filtragem interna por texto
  const filteredSpecs = useMemo(() => {
    let result = specs
    const term = filterText.trim().toLowerCase()
    if (term) {
      result = result.filter((item) => item.spec.toLowerCase().includes(term))
    }

    // Ordenação
    return [...result].sort((a, b) => {
      let valA: any = a[sortField]
      let valB: any = b[sortField]

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = (valB || '').toLowerCase()
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      valA = Number(valA) || 0
      valB = Number(valB) || 0
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })
  }, [specs, filterText, sortField, sortOrder])

  // Total de páginas
  const totalPages = Math.max(1, Math.ceil(filteredSpecs.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedSpecs = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return filteredSpecs.slice(start, start + pageSize)
  }, [filteredSpecs, safeCurrentPage, pageSize])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  function renderSortIcon(field: SortField) {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
    }
    return sortOrder === 'desc' ? (
      <ArrowDown className="w-3 h-3 text-indigo-600 font-bold" />
    ) : (
      <ArrowUp className="w-3 h-3 text-indigo-600 font-bold" />
    )
  }

  if (specs.length === 0) {
    return null
  }

  return (
    <Card
      className="border-slate-200 bg-white shadow-xs overflow-hidden"
      id="ranking-completo-specs"
    >
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-indigo-600 text-white font-bold text-xs px-2.5 py-0.5 gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                RANKING COMPLETO DE ESPECIFICAÇÕES
              </Badge>
              <Badge variant="outline" className="text-[10px] text-slate-700 bg-white font-mono">
                {specs.length} especificações identificadas
              </Badge>
              {selectedSpecName && (
                <Badge className="bg-amber-500 text-slate-950 font-bold text-[10px] gap-1">
                  Filtrando: {selectedSpecName}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectSpec(null)
                    }}
                    className="hover:opacity-75 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Todas as famílias catalogadas para &quot;{searchTerm}&quot; com métricas individuais:
              vendas, giro, faturamento e dispersão de preço. Clique em qualquer linha para filtrar
              os cards de Números do Mercado.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {selectedSpecName && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectSpec(null)}
                className="h-8 text-xs border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1 font-bold shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                Ver Todas ({specs.length})
              </Button>
            )}
          </div>
        </div>

        {/* Barra de Filtro e Controles de Paginação */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Filtrar por especificação (ex: DDR3, 1600MHz, 8GB, SODIMM)..."
              className="pl-8 h-8 text-xs bg-white border-slate-200"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-between md:justify-end text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span>Exibir:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="h-8 rounded border border-slate-200 bg-white text-xs px-2 py-0.5 font-medium text-slate-700"
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>

            <span className="font-mono text-[11px] text-slate-400">
              Página {safeCurrentPage} de {totalPages} ({filteredSpecs.length} itens)
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] text-slate-600 font-semibold border-b border-slate-200 select-none">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  onClick={() => handleSort('spec')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Especificação / Família</span>
                    {renderSortIcon('spec')}
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors"
                  onClick={() => handleSort('totalUnits')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Unidades Vendidas</span>
                    {renderSortIcon('totalUnits')}
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors"
                  onClick={() => handleSort('sharePercent')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Share %</span>
                    {renderSortIcon('sharePercent')}
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors"
                  onClick={() => handleSort('weightedAvgPrice')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Preço Médio Ponderado</span>
                    {renderSortIcon('weightedAvgPrice')}
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors hidden md:table-cell"
                  onClick={() => handleSort('totalRevenue')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Faturamento Est.</span>
                    {renderSortIcon('totalRevenue')}
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-100/80 transition-colors"
                  onClick={() => handleSort('adsWithSalesCount')}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Giro vs Total</span>
                    {renderSortIcon('adsWithSalesCount')}
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right hidden sm:table-cell">Piso–Teto</th>
                <th className="py-2.5 px-3 text-center w-28">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedSpecs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Nenhuma especificação encontrada para o filtro &quot;{filterText}&quot;.
                  </td>
                </tr>
              ) : (
                paginatedSpecs.map((specItem, idx) => {
                  const globalIdx = (safeCurrentPage - 1) * pageSize + idx + 1
                  const isSelected = selectedSpecName === specItem.spec
                  const isExpanded = expandedSpec === specItem.spec
                  const percentGiro =
                    specItem.adCount > 0
                      ? Math.round((specItem.adsWithSalesCount / specItem.adCount) * 100)
                      : 0

                  return (
                    <React.Fragment key={specItem.spec}>
                      <tr
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-amber-50/90 font-medium' : 'hover:bg-slate-50/80'
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            onSelectSpec(null)
                          } else {
                            onSelectSpec(specItem)
                          }
                        }}
                      >
                        {/* Posição no Ranking */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs ${
                              globalIdx === 1
                                ? 'bg-amber-400 text-slate-950 font-black'
                                : globalIdx === 2
                                  ? 'bg-slate-300 text-slate-800'
                                  : globalIdx === 3
                                    ? 'bg-amber-700 text-white'
                                    : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{globalIdx}
                          </span>
                        </td>

                        {/* Nome da Espec e Campeão */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {specItem.spec}
                              </span>
                              {isSelected && (
                                <Badge className="bg-amber-500 text-slate-950 text-[9px] font-bold px-1.5 py-0 h-4">
                                  Ativa
                                </Badge>
                              )}
                              {globalIdx === 1 && (
                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-black px-1 py-0 h-4">
                                  🏆 Líder Geral
                                </Badge>
                              )}
                            </div>

                            {specItem.championAd && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                                Líder:{' '}
                                <span className="text-slate-600 font-medium">
                                  {specItem.championAd.title}
                                </span>
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Unidades Vendidas */}
                        <td className="py-3 px-3 text-right">
                          <span className="font-mono font-black text-sm text-emerald-700 block">
                            {specItem.totalUnits.toLocaleString('pt-BR')} un.
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {specItem.adsWithSalesCount} anúncio(s) c/ venda
                          </span>
                        </td>

                        {/* Share % com Barra Visual */}
                        <td className="py-3 px-3 text-right">
                          <span className="font-mono font-bold text-xs text-slate-800 block">
                            {specItem.sharePercent}%
                          </span>
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden ml-auto mt-1">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-emerald-600 rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(5, specItem.sharePercent))}%`,
                              }}
                            />
                          </div>
                        </td>

                        {/* Preço Médio Ponderado */}
                        <td className="py-3 px-3 text-right">
                          <span className="font-mono font-black text-xs sm:text-sm text-slate-950 block">
                            {specItem.weightedAvgPrice > 0
                              ? specItem.weightedAvgPrice.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : 'R$ 0,00'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Mediana:{' '}
                            {specItem.medianPrice > 0
                              ? specItem.medianPrice.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : 'N/D'}
                          </span>
                        </td>

                        {/* Faturamento Estimado */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-xs text-slate-700 hidden md:table-cell">
                          {specItem.totalRevenue > 0
                            ? specItem.totalRevenue.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })
                            : 'R$ 0,00'}
                        </td>

                        {/* Anúncios com Giro vs Total da Família */}
                        <td className="py-3 px-3 text-center">
                          <span className="font-mono font-bold text-xs text-slate-900 block">
                            {specItem.adsWithSalesCount} / {specItem.adCount}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1 rounded ${
                              percentGiro >= 50
                                ? 'text-emerald-700 bg-emerald-50'
                                : percentGiro > 0
                                  ? 'text-amber-700 bg-amber-50'
                                  : 'text-slate-400 bg-slate-100'
                            }`}
                          >
                            {percentGiro}% c/ giro
                          </span>
                        </td>

                        {/* Piso e Teto */}
                        <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-600 hidden sm:table-cell">
                          {specItem.minPrice > 0 ? (
                            <>
                              <span>
                                {specItem.minPrice.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </span>
                              <span className="text-slate-400"> a </span>
                              <span>
                                {specItem.maxPrice.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400">Sem vendas</span>
                          )}
                        </td>

                        {/* Botão de Ação / Filtrar */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant={isSelected ? 'default' : 'outline'}
                              onClick={() => {
                                if (isSelected) onSelectSpec(null)
                                else onSelectSpec(specItem)
                              }}
                              className={`h-7 px-2 text-[11px] font-bold ${
                                isSelected
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {isSelected ? 'Filtrado' : 'Filtrar'}
                            </Button>

                            {specItem.ads.length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExpandedSpec(isExpanded ? null : specItem.spec)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                                title="Ver anúncios desta especificação"
                              >
                                <Layers className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Gaveta interna de anúncios da especificação */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={9} className="p-3">
                            <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                                  Anúncios da especificação &quot;{specItem.spec}&quot; (
                                  {specItem.ads.length}):
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedSpec(null)}
                                  className="text-xs text-slate-400 hover:text-slate-600"
                                >
                                  Fechar
                                </button>
                              </div>

                              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                                {specItem.ads.map((ad, aIdx) => (
                                  <div
                                    key={ad.id || aIdx}
                                    className="py-2 flex items-center justify-between gap-3 text-xs"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      {ad.thumbnail ? (
                                        <img
                                          src={ad.thumbnail}
                                          alt={ad.title}
                                          className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 shrink-0" />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p
                                          className="font-medium text-slate-900 truncate"
                                          title={ad.title}
                                        >
                                          {ad.title}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                          {ad.seller_name && <span>Seller: {ad.seller_name}</span>}
                                          {ad.mlb_id && <span>· MLB: {ad.mlb_id}</span>}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      <div className="text-right">
                                        <span className="font-mono font-black text-emerald-700 block">
                                          {ad.sold_quantity != null && ad.sold_quantity > 0
                                            ? `${ad.sold_quantity.toLocaleString('pt-BR')} un.`
                                            : 'Sem vendas'}
                                        </span>
                                        <span className="font-mono text-slate-900 block">
                                          {ad.price != null
                                            ? ad.price.toLocaleString('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                              })
                                            : 'N/D'}
                                        </span>
                                      </div>

                                      {ad.permalink && (
                                        <a
                                          href={ad.permalink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                          title="Abrir no Mercado Livre"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela com Paginação */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs text-slate-500 font-mono">
              Mostrando {paginatedSpecs.length} de {filteredSpecs.length} especificações
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="h-8 text-xs px-2.5"
              >
                Anterior
              </Button>
              <span className="text-xs font-mono font-bold text-slate-700 px-2">
                {safeCurrentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="h-8 text-xs px-2.5"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
