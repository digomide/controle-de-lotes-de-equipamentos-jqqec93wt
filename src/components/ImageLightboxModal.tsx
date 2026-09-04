import React, { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, X, SlidersHorizontal, Sun } from 'lucide-react'
import { useImageAdjustments } from '@/lib/imageAdjustments'
import { ImageAdjustControls } from '@/components/ImageAdjustControls'
import { ImageFilterSvg } from '@/components/ImageFilterSvg'

interface ImageLightboxModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  photos: string[]
  currentIndex: number
  onIndexChange: (index: number | ((prev: number) => number)) => void
  title?: string
}

/**
 * ImageLightboxModal - Modal de visualização de foto em tela cheia compartilhado.
 * Inclui:
 * - Filtro de melhoria de luz, contraste, saturação e nitidez sincronizado em tempo real.
 * - Suporte a navegação por setas (anterior / próxima) e miniaturas no rodapé.
 * - Painel de ajustes de luz acionável por botão discreto "Ajustar Luz".
 */
export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  open,
  onOpenChange,
  photos,
  currentIndex,
  onIndexChange,
  title,
}) => {
  const [adjustPanelOpen, setAdjustPanelOpen] = useState(false)
  const { adjustments, setAdjustments, resetAdjustments, filterString, isModified } =
    useImageAdjustments()

  const safeIndex = Math.max(0, Math.min(photos.length - 1, currentIndex))
  const currentPhoto = photos[safeIndex] || photos[0]

  const handlePrev = () => {
    onIndexChange((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
  }

  const handleNext = () => {
    onIndexChange((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full p-0 bg-slate-950 border-slate-800 text-white overflow-hidden rounded-2xl shadow-2xl">
        <ImageFilterSvg sharpness={adjustments.sharpness} />

        <div className="relative flex flex-col h-[85vh]">
          {/* Header do Modal */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-900/95 border-b border-slate-800 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-bold text-white text-sm sm:text-base truncate max-w-xs sm:max-w-md">
                {title || 'Visualização de Foto'}
              </span>
              <span className="text-xs text-slate-400 font-mono shrink-0">
                Foto {safeIndex + 1} de {photos.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Botão de Toggle do Painel de Ajustes de Luz */}
              <button
                type="button"
                onClick={() => setAdjustPanelOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all ${
                  adjustPanelOpen
                    ? 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-400'
                    : isModified
                      ? 'bg-slate-800 text-amber-300 border border-amber-500/40 hover:bg-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title="Melhorar iluminação, contraste e nitidez"
              >
                {isModified ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                ) : (
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span className="hidden sm:inline">
                  {isModified ? 'Luz Ajustada' : 'Ajustar Luz'}
                </span>
                <span className="sm:hidden">Luz</span>
                {isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Painel Flutuante de Ajustes */}
          {adjustPanelOpen && (
            <div className="absolute top-14 right-4 z-30 w-72 max-w-[calc(100%-32px)]">
              <ImageAdjustControls
                adjustments={adjustments}
                onChange={setAdjustments}
                onReset={resetAdjustments}
                onClose={() => setAdjustPanelOpen(false)}
                isModified={isModified}
                theme="dark"
              />
            </div>
          )}

          {/* Imagem Ampliada com Navegação */}
          <div className="flex-1 relative flex items-center justify-center p-4 bg-black/70 overflow-hidden">
            <img
              src={currentPhoto}
              alt={title || 'Foto ampliada'}
              className="max-w-full max-h-full object-contain select-none transition-all duration-150"
              style={{
                filter: filterString,
              }}
            />

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg transition-all z-10"
                  title="Foto anterior (Seta esquerda)"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg transition-all z-10"
                  title="Próxima foto (Seta direita)"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Miniaturas no Rodapé do Zoom */}
          {photos.length > 1 && (
            <div className="p-3 bg-slate-900/95 border-t border-slate-800 flex gap-2 overflow-x-auto justify-center z-10">
              {photos.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onIndexChange(idx)}
                  className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    safeIndex === idx
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'border-slate-700 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={url}
                    alt={`Thumb ${idx + 1}`}
                    className="w-full h-full object-cover"
                    style={{
                      filter: filterString,
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
