import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ncmCestService, normalizeNcm, type NcmCestEntry } from '@/services/ncmCestService'
import { Sparkles, Check, ChevronDown, Loader2 } from 'lucide-react'

interface NcmAutocompleteProps {
  value: string
  onChange: (ncm: string) => void
  onSelectCest?: (cest: string, entry?: NcmCestEntry) => void
  currentCest?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  showBadge?: boolean
}

export function NcmAutocomplete({
  value,
  onChange,
  onSelectCest,
  currentCest,
  placeholder = 'Ex: 84733042',
  className = '',
  disabled = false,
  showBadge = true,
}: NcmAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<NcmCestEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [matchedEntry, setMatchedEntry] = useState<NcmCestEntry | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Atualiza sugestões quando o usuário digita
  useEffect(() => {
    let active = true

    async function search() {
      const clean = normalizeNcm(value)
      // Se tiver pelo menos 2 caracteres ou dígitos, busca
      if (!value || value.trim().length < 2) {
        setSuggestions([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const results = await ncmCestService.searchSuggestions(value, 8)
        if (active) {
          setSuggestions(results)
        }
      } catch {
        if (active) setSuggestions([])
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = setTimeout(search, 120)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [value])

  // Verifica se o NCM atual de 8 dígitos possui CEST na tabela oficial
  useEffect(() => {
    let active = true
    const clean = normalizeNcm(value)

    if (clean.length === 8) {
      ncmCestService.findByNcm(clean).then((entry) => {
        if (active) {
          setMatchedEntry(entry)
        }
      })
    } else {
      setMatchedEntry(null)
    }

    return () => {
      active = false
    }
  }, [value])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Selecionar item da lista
  const handleSelect = (item: NcmCestEntry) => {
    onChange(item.ncm)
    if (onSelectCest && item.cest) {
      onSelectCest(item.cest, item)
    }
    setOpen(false)
    setSuggestions([])
    setFocusedIndex(-1)
  }

  // Teclado (navegação por setas e Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
        e.preventDefault()
        handleSelect(suggestions[focusedIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const cleanCurrentNcm = normalizeNcm(value)
  const hasExactCest = matchedEntry && matchedEntry.cest
  const hasNoCestOfficial = cleanCurrentNcm.length === 8 && !matchedEntry

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Input
          className={`font-mono ${className}`}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            if (suggestions.length > 0 || value.trim().length >= 2) {
              setOpen(true)
            }
          }}
          onChange={(e) => {
            const nextVal = e.target.value
            onChange(nextVal)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />

        {loading && (
          <div className="absolute right-2 top-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
      </div>

      {/* Indicador sutil de CEST oficial encontrado ou ausente */}
      {showBadge && (
        <div className="mt-1 flex items-center justify-between min-h-[16px] text-[10px]">
          {hasExactCest ? (
            <div className="flex items-center gap-1 text-emerald-700 font-medium">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>
                CEST oficial: <strong className="font-mono">{matchedEntry.cest}</strong>
              </span>
              {currentCest !== matchedEntry.cest && onSelectCest && (
                <button
                  type="button"
                  onClick={() => onSelectCest(matchedEntry.cest, matchedEntry)}
                  className="text-emerald-800 underline hover:text-emerald-950 ml-1 font-semibold"
                >
                  (Aplicar)
                </button>
              )}
            </div>
          ) : hasNoCestOfficial ? (
            <span className="text-slate-400 italic">Sem CEST na tabela oficial (campo livre)</span>
          ) : null}
        </div>
      )}

      {/* Dropdown com sugestões da tabela NCM -> CEST */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg divide-y divide-slate-100 text-xs">
          <div className="px-2.5 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-600 flex items-center justify-between border-b border-slate-200">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Tabela Oficial Convênio ICMS 92/15
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {suggestions.length} resultado(s)
            </span>
          </div>

          {suggestions.map((item, idx) => {
            const isSelected = focusedIndex === idx
            return (
              <button
                type="button"
                key={`${item.ncm}-${item.cest}-${idx}`}
                className={`w-full text-left px-3 py-2 transition-colors flex items-start justify-between gap-2 hover:bg-emerald-50/70 ${
                  isSelected ? 'bg-emerald-50' : ''
                }`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-xs">{item.ncm}</span>
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-300 font-mono text-[10px] px-1.5 py-0"
                    >
                      CEST {item.cest}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate mt-0.5" title={item.descricao}>
                    {item.descricao}
                  </p>
                </div>
                {item.ncm === normalizeNcm(value) && (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
