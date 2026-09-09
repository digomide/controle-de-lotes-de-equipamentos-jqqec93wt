import React, { useEffect, useState, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Layers, Search, X, ChevronRight, FolderTree, Check } from 'lucide-react'
import {
  mlCategoriesService,
  MLCategoryRecord,
  TOP_ML_FAMILIES,
} from '@/services/mlCategoriesService'

export interface SelectedCategoryFilter {
  categoryId: string
  categoryName: string
  familyId?: string
  familyName?: string
  subfamilyId?: string
  subfamilyName?: string
  fullPath?: string
}

interface MLFamilySelectorProps {
  selectedCategory: SelectedCategoryFilter | null
  onChange: (category: SelectedCategoryFilter | null) => void
  disabled?: boolean
  className?: string
}

export const MLFamilySelector: React.FC<MLFamilySelectorProps> = ({
  selectedCategory,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [families, setFamilies] = useState<MLCategoryRecord[]>(TOP_ML_FAMILIES)
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')

  const [subfamilies, setSubfamilies] = useState<MLCategoryRecord[]>([])
  const [selectedSubfamilyId, setSelectedSubfamilyId] = useState<string>('')

  const [leafCategories, setLeafCategories] = useState<MLCategoryRecord[]>([])
  const [selectedLeafId, setSelectedLeafId] = useState<string>('')

  // Modo busca livre na árvore
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<MLCategoryRecord[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)

  // Carregar famílias de topo
  useEffect(() => {
    let mounted = true
    mlCategoriesService.getTopFamilies().then((res) => {
      if (mounted && res && res.length > 0) {
        setFamilies(res)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  // Sincronizar estado interno se selectedCategory for alterado externamente
  useEffect(() => {
    if (!selectedCategory) {
      setSelectedFamilyId('')
      setSelectedSubfamilyId('')
      setSelectedLeafId('')
      return
    }
    if (selectedCategory.familyId) {
      setSelectedFamilyId(selectedCategory.familyId)
    }
    if (selectedCategory.subfamilyId) {
      setSelectedSubfamilyId(selectedCategory.subfamilyId)
    }
  }, [selectedCategory])

  // Carregar subfamílias quando família é escolhida
  useEffect(() => {
    if (!selectedFamilyId || selectedFamilyId === 'all') {
      setSubfamilies([])
      setSelectedSubfamilyId('')
      setLeafCategories([])
      setSelectedLeafId('')
      return
    }

    let mounted = true
    mlCategoriesService.getSubfamilies(selectedFamilyId).then((subs) => {
      if (mounted) {
        setSubfamilies(subs)
      }
    })
    return () => {
      mounted = false
    }
  }, [selectedFamilyId])

  // Carregar folhas quando subfamília é escolhida
  useEffect(() => {
    if (!selectedSubfamilyId || selectedSubfamilyId === 'all') {
      setLeafCategories([])
      setSelectedLeafId('')
      return
    }

    let mounted = true
    mlCategoriesService.getLeafCategories(selectedSubfamilyId).then((leaves) => {
      if (mounted) {
        setLeafCategories(leaves)
      }
    })
    return () => {
      mounted = false
    }
  }, [selectedSubfamilyId])

  // Handler de seleção de família
  const handleFamilyChange = (famId: string) => {
    if (!famId || famId === 'all') {
      setSelectedFamilyId('')
      setSelectedSubfamilyId('')
      setSelectedLeafId('')
      onChange(null)
      return
    }

    const fam = families.find((f) => f.category_id === famId)
    setSelectedFamilyId(famId)
    setSelectedSubfamilyId('')
    setSelectedLeafId('')

    onChange({
      categoryId: famId,
      categoryName: fam ? fam.name : famId,
      familyId: famId,
      familyName: fam ? fam.name : famId,
      fullPath: fam?.full_path || fam?.name,
    })
  }

  // Handler de seleção de subfamília
  const handleSubfamilyChange = (subId: string) => {
    if (!subId || subId === 'all') {
      setSelectedSubfamilyId('')
      setSelectedLeafId('')
      // Mantém a família pai ativa
      const fam = families.find((f) => f.category_id === selectedFamilyId)
      if (fam) {
        onChange({
          categoryId: fam.category_id,
          categoryName: fam.name,
          familyId: fam.category_id,
          familyName: fam.name,
          fullPath: fam.full_path || fam.name,
        })
      }
      return
    }

    const sub = subfamilies.find((s) => s.category_id === subId)
    const fam = families.find((f) => f.category_id === selectedFamilyId)
    setSelectedSubfamilyId(subId)
    setSelectedLeafId('')

    onChange({
      categoryId: subId,
      categoryName: sub ? sub.name : subId,
      familyId: selectedFamilyId,
      familyName: fam?.name,
      subfamilyId: subId,
      subfamilyName: sub?.name,
      fullPath: sub?.full_path || `${fam?.name} > ${sub?.name}`,
    })
  }

  // Handler de seleção de folha fina
  const handleLeafChange = (leafId: string) => {
    if (!leafId || leafId === 'all') {
      setSelectedLeafId('')
      // Volta para a subfamília
      handleSubfamilyChange(selectedSubfamilyId)
      return
    }

    const leaf = leafCategories.find((l) => l.category_id === leafId)
    const sub = subfamilies.find((s) => s.category_id === selectedSubfamilyId)
    const fam = families.find((f) => f.category_id === selectedFamilyId)
    setSelectedLeafId(leafId)

    onChange({
      categoryId: leafId,
      categoryName: leaf ? leaf.name : leafId,
      familyId: selectedFamilyId,
      familyName: fam?.name,
      subfamilyId: selectedSubfamilyId,
      subfamilyName: sub?.name,
      fullPath: leaf?.full_path || `${fam?.name} > ${sub?.name} > ${leaf?.name}`,
    })
  }

  // Busca rápida na árvore toda
  const handleSearchCategories = async (q: string) => {
    setSearchQuery(q)
    if (!q || q.trim().length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await mlCategoriesService.searchCategories(q, 15)
      setSearchResults(results)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectSearchResult = (cat: MLCategoryRecord) => {
    onChange({
      categoryId: cat.category_id,
      categoryName: cat.name,
      familyId: cat.family_id || cat.category_id,
      familyName: cat.family_name || cat.name,
      subfamilyId: cat.subfamily_id,
      subfamilyName: cat.subfamily_name,
      fullPath: cat.full_path || cat.name,
    })
    setIsSearchMode(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleClear = () => {
    setSelectedFamilyId('')
    setSelectedSubfamilyId('')
    setSelectedLeafId('')
    setIsSearchMode(false)
    setSearchQuery('')
    setSearchResults([])
    onChange(null)
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Barra superior de controle do seletor */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
          <FolderTree className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Família / Categoria Oficial ML (Opcional):</span>
        </div>

        <div className="flex items-center gap-2">
          {!isSearchMode ? (
            <button
              type="button"
              onClick={() => setIsSearchMode(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Search className="w-3 h-3" />
              <span>Buscar na árvore</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsSearchMode(false)
                setSearchQuery('')
                setSearchResults([])
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Voltar aos filtros
            </button>
          )}

          {selectedCategory && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5"
              title="Limpar categoria selecionada"
            >
              <X className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Modo de busca por texto em toda a árvore */}
      {isSearchMode ? (
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Digite para buscar qualquer categoria oficial do ML (ex: Placas-Mãe, Monitores, Notebooks)..."
              value={searchQuery}
              onChange={(e) => handleSearchCategories(e.target.value)}
              disabled={disabled}
              className="pl-9 pr-8 text-xs h-9 bg-white dark:bg-slate-900 border-blue-200 focus:border-blue-500"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchCategories('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Lista de resultados da busca */}
          {searchQuery.trim().length >= 2 && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg p-1">
              {isSearching ? (
                <div className="p-3 text-xs text-slate-500 text-center">Buscando categorias...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((cat) => (
                  <button
                    key={cat.id || cat.category_id}
                    type="button"
                    onClick={() => handleSelectSearchResult(cat)}
                    className="w-full text-left px-3 py-2 rounded text-xs hover:bg-blue-50 dark:hover:bg-blue-950/50 flex flex-col gap-0.5 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800/50"
                  >
                    <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>{cat.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {cat.category_id}
                      </span>
                    </div>
                    {cat.full_path && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span>{cat.full_path}</span>
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-3 text-xs text-slate-500 text-center">
                  Nenhuma categoria encontrada para &ldquo;{searchQuery}&rdquo;.
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Modo Cascata: Família -> Subfamília -> Folha Fina */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Nível 1: Família Principal */}
          <div>
            <Select
              value={selectedFamilyId || 'all'}
              onValueChange={handleFamilyChange}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-900">
                <SelectValue placeholder="1. Todas as Famílias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as Famílias
                </SelectItem>
                {families.map((fam) => (
                  <SelectItem key={fam.category_id} value={fam.category_id} className="text-xs">
                    {fam.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nível 2: Subfamília */}
          <div>
            <Select
              value={selectedSubfamilyId || 'all'}
              onValueChange={handleSubfamilyChange}
              disabled={disabled || !selectedFamilyId || selectedFamilyId === 'all'}
            >
              <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-900">
                <SelectValue
                  placeholder={
                    selectedFamilyId ? '2. Todas as Subfamílias' : '2. Subfamília (escolha família)'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as Subfamílias
                </SelectItem>
                {subfamilies.map((sub) => (
                  <SelectItem key={sub.category_id} value={sub.category_id} className="text-xs">
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nível 3: Folha / Especificidade */}
          <div>
            <Select
              value={selectedLeafId || 'all'}
              onValueChange={handleLeafChange}
              disabled={
                disabled ||
                !selectedSubfamilyId ||
                selectedSubfamilyId === 'all' ||
                leafCategories.length === 0
              }
            >
              <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-900">
                <SelectValue
                  placeholder={
                    leafCategories.length > 0
                      ? '3. Folha Específica (Opcional)'
                      : '3. Folha (nenhuma sub-divisão)'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Toda a Subfamília
                </SelectItem>
                {leafCategories.map((leaf) => (
                  <SelectItem key={leaf.category_id} value={leaf.category_id} className="text-xs">
                    {leaf.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Exibição do caminho ativo selecionado com badge */}
      {selectedCategory && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">Segmentação ativa:</span>
          <Badge
            variant="outline"
            className="text-[11px] font-normal border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 flex items-center gap-1 py-0 px-2"
          >
            <span>{selectedCategory.fullPath || selectedCategory.categoryName}</span>
            <span className="font-mono text-[9px] opacity-75">({selectedCategory.categoryId})</span>
            <button
              type="button"
              onClick={handleClear}
              className="ml-1 text-blue-500 hover:text-blue-800 dark:hover:text-blue-200"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        </div>
      )}
    </div>
  )
}
export default MLFamilySelector
