import React, { useState, useEffect, useMemo } from 'react'
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Search,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { mlCategoriesService, MLCategoryRecord } from '@/services/mlCategoriesService'

export interface CategorySelectorProps {
  selectedCategoryId: string
  selectedCategoryName?: string
  onSelectCategory: (categoryId: string, categoryName: string) => void
  disabled?: boolean
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategoryId,
  selectedCategoryName,
  onSelectCategory,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<MLCategoryRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({
    MLB1648: true, // Informática aberta por padrão para conveniência
  })

  // Carrega as categorias do banco
  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await mlCategoriesService.getAll()
        if (mounted) {
          setCategories(data)
        }
      } catch (err) {
        console.warn('Falha ao carregar categorias:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  // Agrupamento hierárquico
  const { families, subfamiliesByParent, directMatches } = useMemo(() => {
    const fams: MLCategoryRecord[] = []
    const subMap: Record<string, MLCategoryRecord[]> = {}

    categories.forEach((cat) => {
      if (!cat.level || cat.level === 1 || !cat.parent_id) {
        fams.push(cat)
      } else {
        const parentKey = cat.family_id || cat.parent_id
        if (parentKey) {
          if (!subMap[parentKey]) subMap[parentKey] = []
          subMap[parentKey].push(cat)
        }
      }
    })

    // Se houver busca por texto, filtra direto por nome
    let filteredMatches: MLCategoryRecord[] = []
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      filteredMatches = categories.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.full_path && c.full_path.toLowerCase().includes(q)),
      )
    }

    return {
      families: fams,
      subfamiliesByParent: subMap,
      directMatches: filteredMatches,
    }
  }, [categories, searchTerm])

  const toggleExpand = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedFamilies((prev) => ({ ...prev, [catId]: !prev[catId] }))
  }

  const handleSelect = (catId: string, name: string) => {
    onSelectCategory(catId, name)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectCategory('', '')
  }

  const currentLabel = useMemo(() => {
    if (selectedCategoryName) return selectedCategoryName
    if (!selectedCategoryId) return 'Todas as famílias'
    const found = categories.find((c) => c.category_id === selectedCategoryId)
    return found ? found.name : selectedCategoryId
  }, [selectedCategoryId, selectedCategoryName, categories])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={`h-11 justify-between text-xs font-semibold px-3.5 border-slate-200 transition-colors ${
            selectedCategoryId
              ? 'bg-blue-50/80 hover:bg-blue-100/80 text-blue-900 border-blue-300'
              : 'bg-slate-50 hover:bg-white text-slate-700'
          }`}
          title={selectedCategoryId ? `Filtrando por: ${currentLabel}` : 'Selecione uma família'}
        >
          <div className="flex items-center gap-2 truncate max-w-[200px] sm:max-w-[240px]">
            <FolderTree
              className={`w-4 h-4 shrink-0 ${
                selectedCategoryId ? 'text-blue-600' : 'text-slate-400'
              }`}
            />
            <span className="truncate">{currentLabel}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selectedCategoryId && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === 'Enter' && handleClear(e as any)}
                className="p-0.5 rounded-full hover:bg-blue-200/60 text-blue-700 cursor-pointer"
                title="Limpar filtro de família"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-0 shadow-lg border-slate-200" align="start">
        <div className="p-3 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Árvore de Categorias Mercado Livre
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Opcional</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar família ou sub-família..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs bg-white border-slate-200"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-72 overflow-y-auto p-2">
          {/* Opção Padrão: Todas as Famílias */}
          <button
            type="button"
            onClick={() => handleSelect('', '')}
            className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center justify-between transition-colors ${
              !selectedCategoryId
                ? 'bg-blue-50 text-blue-900 font-bold'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              <span>Todas as famílias (busca ampla)</span>
            </div>
            {!selectedCategoryId && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>

          <div className="my-1.5 border-t border-slate-100" />

          {loading ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Carregando árvore de categorias...
            </div>
          ) : searchTerm.trim() ? (
            /* Resultados diretos por busca textual */
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {directMatches.length} categoria(s) encontrada(s)
              </div>
              {directMatches.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  Nenhuma categoria com esse nome.
                </div>
              ) : (
                directMatches.map((cat) => (
                  <button
                    key={cat.category_id}
                    type="button"
                    onClick={() => handleSelect(cat.category_id, cat.name)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                      selectedCategoryId === cat.category_id
                        ? 'bg-blue-50 text-blue-900 font-bold'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate font-medium">{cat.name}</div>
                      {cat.full_path && (
                        <div className="text-[10px] text-slate-400 truncate font-mono">
                          {cat.full_path}
                        </div>
                      )}
                    </div>
                    {selectedCategoryId === cat.category_id && (
                      <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Visualização em Cascata (Família -> Sub-famílias) */
            <div className="space-y-1">
              {families.map((fam) => {
                const subs = subfamiliesByParent[fam.category_id] || []
                const isExpanded = Boolean(expandedFamilies[fam.category_id])
                const isSelected = selectedCategoryId === fam.category_id

                return (
                  <div key={fam.category_id} className="space-y-0.5">
                    <div
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900 font-bold'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                      onClick={() => handleSelect(fam.category_id, fam.name)}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        {subs.length > 0 ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => toggleExpand(fam.category_id, e)}
                            className="p-0.5 rounded hover:bg-slate-200/80 text-slate-500 cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </span>
                        ) : (
                          <span className="w-4" />
                        )}
                        <span className="truncate">{fam.name}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {subs.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4 bg-slate-100 text-slate-600 font-mono"
                          >
                            {subs.length}
                          </Badge>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    </div>

                    {/* Sub-categorias em cascata */}
                    {isExpanded && subs.length > 0 && (
                      <div className="pl-6 pr-1 space-y-0.5 border-l-2 border-slate-200 ml-3.5 my-1">
                        {subs.map((sub) => {
                          const isSubSelected = selectedCategoryId === sub.category_id
                          return (
                            <button
                              key={sub.category_id}
                              type="button"
                              onClick={() => handleSelect(sub.category_id, sub.name)}
                              className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center justify-between transition-colors ${
                                isSubSelected
                                  ? 'bg-blue-100/70 text-blue-900 font-bold'
                                  : 'hover:bg-slate-100 text-slate-600'
                              }`}
                            >
                              <span className="truncate">{sub.name}</span>
                              {isSubSelected && (
                                <Check className="w-3 h-3 text-blue-600 shrink-0 ml-1" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {selectedCategoryId && (
          <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
            <span className="truncate pr-2">
              Selecionado: <strong className="text-slate-800">{currentLabel}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 text-[10px] px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              Remover filtro
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
