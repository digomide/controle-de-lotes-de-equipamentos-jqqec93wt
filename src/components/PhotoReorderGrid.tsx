import React, { useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, Sparkles, Star, GripVertical } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export interface PhotoOrderItem {
  id: string // Identificador único (url, filename ou temp id)
  url: string
  label?: string
  isCover?: boolean
}

interface PhotoReorderGridProps {
  items: PhotoOrderItem[]
  onReorder: (newItems: PhotoOrderItem[]) => void
  onRemove?: (index: number) => void
  onOpenBgRemoval?: (index: number) => void
  disabled?: boolean
  maxPhotos?: number
}

export const PhotoReorderGrid: React.FC<PhotoReorderGridProps> = ({
  items,
  onReorder,
  onRemove,
  onOpenBgRemoval,
  disabled = false,
  maxPhotos = 6,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= items.length) return
    const updated = [...items]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    onReorder(updated)
  }

  const handleMakeCover = (index: number) => {
    if (index === 0) return
    moveItem(index, 0)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (disabled) return
    e.preventDefault()
    const sourceIndex = draggedIndex ?? parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      moveItem(sourceIndex, targetIndex)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
      {items.map((item, idx) => {
        const isDragging = draggedIndex === idx
        const isTarget = dragOverIndex === idx && !isDragging
        const isCover = idx === 0

        return (
          <div
            key={item.id || `${item.url}-${idx}`}
            draggable={!disabled}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`group relative rounded-xl border bg-white overflow-hidden shadow-xs transition-all flex flex-col select-none ${
              isDragging
                ? 'opacity-40 scale-95 border-orange-400 ring-2 ring-orange-400/40 shadow-lg'
                : isTarget
                  ? 'border-orange-500 ring-2 ring-orange-500/50 scale-[1.02] bg-orange-50/30'
                  : isCover
                    ? 'border-orange-300 ring-1 ring-orange-200'
                    : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {/* Foto preview container com aspect 4/3 */}
            <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden cursor-grab active:cursor-grabbing">
              <img
                src={item.url}
                alt={item.label || `Foto ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'https://img.usecurling.com/p/400/300?q=laptop'
                }}
              />

              {/* Indicador de Capa */}
              {isCover && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold shadow-md flex items-center gap-1 z-10">
                  <Star className="w-3 h-3 fill-white" />
                  Capa
                </div>
              )}

              {/* Drag Handle indicator */}
              <div
                className="absolute bottom-2 left-2 p-1 rounded-md bg-black/60 text-white opacity-60 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 pointer-events-none"
                title="Arraste para reordenar"
              >
                <GripVertical className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium font-mono pr-0.5">#{idx + 1}</span>
              </div>

              {/* Ações de topo à direita: Remoção de fundo (se habilitada) e Exclusão */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                {onOpenBgRemoval && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenBgRemoval(idx)
                    }}
                    disabled={disabled}
                    className="p-1.5 rounded-lg bg-white/95 hover:bg-white text-indigo-700 shadow-sm border border-indigo-100 transition-transform hover:scale-105 active:scale-95"
                    title="Remover fundo com IA"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                )}

                {onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(idx)
                    }}
                    disabled={disabled}
                    className="p-1.5 rounded-lg bg-white/95 hover:bg-rose-50 text-rose-600 shadow-sm border border-rose-100 transition-transform hover:scale-105 active:scale-95"
                    title="Remover esta foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Barra de Reordenação: Setas ↑/↓, Seletor 1..N e Tornar Capa */}
            <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs">
              {/* Controles de posição: Setas e Posição */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => moveItem(idx, idx - 1)}
                  disabled={disabled || idx === 0}
                  className="w-7 h-7 rounded flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  title="Mover para a esquerda / cima"
                >
                  <ArrowUp className="w-3.5 h-3.5 -rotate-90 sm:rotate-0" />
                </button>

                {/* Seletor direto de posição 1..N */}
                <div className="px-1 min-w-[50px]">
                  <Select
                    value={String(idx + 1)}
                    onValueChange={(val) => {
                      const targetPos = parseInt(val, 10) - 1
                      if (!isNaN(targetPos)) {
                        moveItem(idx, targetPos)
                      }
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-6 text-[11px] font-bold font-mono px-1.5 py-0 border-0 bg-transparent shadow-none focus:ring-0 gap-1 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((_, pIdx) => (
                        <SelectItem
                          key={pIdx + 1}
                          value={String(pIdx + 1)}
                          className="text-xs font-mono"
                        >
                          Posição {pIdx + 1} {pIdx === 0 ? '(Capa)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <button
                  type="button"
                  onClick={() => moveItem(idx, idx + 1)}
                  disabled={disabled || idx === items.length - 1}
                  className="w-7 h-7 rounded flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  title="Mover para a direita / baixo"
                >
                  <ArrowDown className="w-3.5 h-3.5 -rotate-90 sm:rotate-0" />
                </button>
              </div>

              {/* Botão rápido: Tornar capa */}
              {!isCover ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMakeCover(idx)}
                  disabled={disabled}
                  className="h-7 text-[11px] px-2 text-orange-700 hover:text-orange-800 hover:bg-orange-50 font-semibold gap-1"
                  title="Mover foto direto para a capa (posição 1)"
                >
                  <Star className="w-3 h-3" />
                  Tornar capa
                </Button>
              ) : (
                <span className="text-[11px] font-bold text-orange-600 px-2 py-0.5">
                  Foto Principal
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
