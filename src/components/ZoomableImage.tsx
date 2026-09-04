import React, { useState, useRef, useCallback } from 'react'
import { ZoomIn, SlidersHorizontal, Sun } from 'lucide-react'
import { useImageAdjustments } from '@/lib/imageAdjustments'
import { ImageAdjustControls } from '@/components/ImageAdjustControls'
import { ImageFilterSvg } from '@/components/ImageFilterSvg'

export interface ZoomableImageProps {
  src: string
  alt: string
  className?: string
  scale?: number
  fallbackSrc?: string
  onClick?: () => void
  showHint?: boolean
  showScaleControl?: boolean
  storageKey?: string
  /** Exibe botão e painel de melhoria de luz/nitidez (padrão true quando não for compact) */
  showAdjustControl?: boolean
  /** Modo compacto para cards de listagem (desativa controles inline para manter cards limpos) */
  compact?: boolean
}

const ZOOM_LEVELS = [2, 2.5, 3.5] as const
export type ZoomLevel = (typeof ZOOM_LEVELS)[number]
const STORAGE_DEFAULT_KEY = 'ambicorp_zoom_scale'

/**
 * ZoomableImage - Componente de imagem com hover zoom estilo Mercado Livre (lens zoom).
 * - Desktop/mouse: ao passar o mouse, exibe a região sob o cursor ampliada (transform-origin dinâmica + scale).
 * - Controle de grau de zoom discreto (2x / 2.5x / 3.5x) sincronizado via localStorage e custom event em toda a loja.
 * - Inclui indicador sutil de zoom / lupa.
 * - Mobile/touch: não interfere com scroll/touch, mantém o clique/toque para abrir modal de tela cheia ou detalhe.
 */
export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  src,
  alt,
  className = '',
  scale: scaleProp,
  fallbackSrc = 'https://img.usecurling.com/p/800/600?q=laptop',
  onClick,
  showHint = true,
  showScaleControl = true,
  storageKey = STORAGE_DEFAULT_KEY,
  showAdjustControl,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isZoomed, setIsZoomed] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const [imgSrc, setImgSrc] = useState(src)
  const [adjustPanelOpen, setAdjustPanelOpen] = useState(false)

  // Hook central de melhoria de luz sincronizado
  const { adjustments, setAdjustments, resetAdjustments, filterString, isModified } =
    useImageAdjustments()

  const canShowAdjust = !compact && (showAdjustControl ?? true)

  // Recupera zoom persistido no localStorage (padrão 2.5x)
  const readSavedScale = useCallback((): number => {
    if (scaleProp) return scaleProp
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const parsed = parseFloat(saved)
          if (!isNaN(parsed) && parsed >= 1.5 && parsed <= 5) {
            return parsed
          }
        }
      } catch (err) {
        console.warn('Erro ao ler escala de zoom do localStorage:', err)
      }
    }
    return 2.5
  }, [scaleProp, storageKey])

  const [currentScale, setCurrentScale] = useState<number>(readSavedScale)

  // Ouve mudanças de escala vindas de outras instâncias ou abas
  React.useEffect(() => {
    if (scaleProp) {
      setCurrentScale(scaleProp)
      return
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        const parsed = parseFloat(e.newValue)
        if (!isNaN(parsed)) setCurrentScale(parsed)
      }
    }

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ scale: number }>
      if (customEvent.detail && typeof customEvent.detail.scale === 'number') {
        setCurrentScale(customEvent.detail.scale)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('ambicorp_zoom_scale_change', handleCustomChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('ambicorp_zoom_scale_change', handleCustomChange)
    }
  }, [scaleProp, storageKey])

  const handleSelectScale = useCallback(
    (newScale: number, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setCurrentScale(newScale)
      try {
        localStorage.setItem(storageKey, String(newScale))
        // Dispara evento interno para sincronizar todas as instâncias montadas na mesma tela
        window.dispatchEvent(
          new CustomEvent('ambicorp_zoom_scale_change', {
            detail: { scale: newScale },
          }),
        )
      } catch (err) {
        console.warn('Erro ao salvar escala de zoom:', err)
      }
    },
    [storageKey],
  )

  // Sincroniza caso a prop src mude (ex: ao trocar de foto na galeria)
  React.useEffect(() => {
    setImgSrc(src)
  }, [src])

  const updateOrigin = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))

    setOrigin({ x, y })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      updateOrigin(e.clientX, e.clientY)
      if (!isZoomed) setIsZoomed(true)
    },
    [updateOrigin, isZoomed],
  )

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      updateOrigin(e.clientX, e.clientY)
      setIsZoomed(true)
    },
    [updateOrigin],
  )

  const handleMouseLeave = useCallback(() => {
    setIsZoomed(false)
    setOrigin({ x: 50, y: 50 })
  }, [])

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative w-full h-full overflow-hidden cursor-zoom-in select-none ${className}`}
    >
      <ImageFilterSvg sharpness={adjustments.sharpness} />

      <img
        src={imgSrc}
        alt={alt}
        onError={() => {
          if (fallbackSrc && imgSrc !== fallbackSrc) {
            setImgSrc(fallbackSrc)
          }
        }}
        className="w-full h-full object-cover object-center pointer-events-none transition-transform will-change-transform"
        style={{
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transform: isZoomed ? `scale(${currentScale})` : 'scale(1)',
          transitionDuration: isZoomed ? '75ms' : '200ms',
          transitionTimingFunction: 'cubic-bezier(0.2, 0, 0.2, 1)',
          filter: filterString,
        }}
      />

      {/* Botão de Toggle do Painel de Ajustes de Imagem (Luz / Nitidez) */}
      {canShowAdjust && (
        <div
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setAdjustPanelOpen((prev) => !prev)
            }}
            title={
              adjustPanelOpen ? 'Fechar controles de iluminação' : 'Melhorar luz e nitidez da foto'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-md backdrop-blur-md transition-all ${
              adjustPanelOpen
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 font-bold'
                : isModified
                  ? 'bg-slate-950/85 text-amber-300 border border-amber-500/40 hover:bg-slate-900'
                  : 'bg-slate-950/75 hover:bg-slate-900 text-white border border-white/10'
            }`}
          >
            {isModified ? (
              <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            ) : (
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden sm:inline">{isModified ? 'Luz Ajustada' : 'Ajustar Luz'}</span>
            <span className="sm:hidden">Luz</span>
            {isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
          </button>
        </div>
      )}

      {/* Painel Flutuante de Ajustes */}
      {canShowAdjust && adjustPanelOpen && (
        <div
          className="absolute top-12 left-3 z-30 w-72 max-w-[calc(100%-24px)]"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
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

      {/* Seletor de grau de zoom discreto no canto inferior direito quando ativo ou em hover */}
      {showScaleControl && !compact && (
        <div
          className={`absolute bottom-3 right-3 hidden sm:flex items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-lg z-20 transition-all duration-200 ${
            isZoomed
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1 pointer-events-none group-hover:opacity-90 group-hover:pointer-events-auto'
          }`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <span className="text-[10px] font-semibold text-slate-400 px-1.5 flex items-center gap-1 select-none">
            <ZoomIn className="w-3 h-3 text-emerald-400" />
            Zoom
          </span>
          <div className="flex items-center bg-slate-900/90 rounded-md p-0.5 border border-slate-800">
            {ZOOM_LEVELS.map((lvl) => {
              const isSelected = Math.abs(currentScale - lvl) < 0.1
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={(e) => handleSelectScale(lvl, e)}
                  title={`Definir zoom em ${lvl}x`}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-tight transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs font-mono'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {lvl}x
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Indicador de dica de zoom no canto inferior direito quando não estiver ampliado */}
      {showHint && !isZoomed && !compact && (
        <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-md pointer-events-none opacity-80 transition-opacity z-10">
          <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
          Passe o mouse para zoom ({currentScale}x)
        </div>
      )}

      {/* Indicador sutil para modo compacto (card de vitrine) */}
      {compact && isZoomed && (
        <div className="absolute bottom-2 right-2 hidden sm:flex items-center gap-1 bg-slate-950/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none z-10">
          <ZoomIn className="w-3 h-3 text-emerald-400" />
          {currentScale}x
        </div>
      )}
    </div>
  )
}

export default ZoomableImage
