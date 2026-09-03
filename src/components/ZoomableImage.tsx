import React, { useState, useRef, useCallback } from 'react'
import { ZoomIn } from 'lucide-react'

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
}

const ZOOM_LEVELS = [2, 2.5, 3.5] as const
export type ZoomLevel = (typeof ZOOM_LEVELS)[number]
const STORAGE_DEFAULT_KEY = 'ambicorp_zoom_scale'

/**
 * ZoomableImage - Componente de imagem com hover zoom estilo Mercado Livre (lens zoom).
 * - Desktop/mouse: ao passar o mouse, exibe a região sob o cursor ampliada (transform-origin dinâmica + scale).
 * - Controle de grau de zoom discreto (2x / 2.5x / 3.5x) persistente no localStorage.
 * - Inclui indicador sutil de zoom / lupa.
 * - Mobile/touch: não interfere com scroll/touch, mantém o clique/toque para abrir modal de tela cheia.
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isZoomed, setIsZoomed] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const [imgSrc, setImgSrc] = useState(src)

  // Recupera zoom persistido no localStorage (padrão 2.5x)
  const [currentScale, setCurrentScale] = useState<number>(() => {
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
  })

  // Permite override se a scaleProp for informada dinamicamente
  React.useEffect(() => {
    if (scaleProp) {
      setCurrentScale(scaleProp)
    }
  }, [scaleProp])

  const handleSelectScale = useCallback(
    (newScale: number, e: React.MouseEvent) => {
      e.stopPropagation()
      setCurrentScale(newScale)
      try {
        localStorage.setItem(storageKey, String(newScale))
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

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

    setOrigin({ x, y })
  }, [])

  const handleMouseEnter = useCallback(() => {
    setIsZoomed(true)
  }, [])

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
        }}
      />

      {/* Seletor de grau de zoom discreto no canto inferior direito quando ativo ou em hover */}
      {showScaleControl && (
        <div
          className={`absolute bottom-3 right-3 hidden sm:flex items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-lg z-20 transition-all duration-200 ${
            isZoomed
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1 pointer-events-none group-hover:opacity-90 group-hover:pointer-events-auto'
          }`}
          onClick={(e) => e.stopPropagation()}
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

      {/* Indicador de dica de zoom no canto inferior esquerdo/direito quando não estiver ampliado */}
      {showHint && !isZoomed && (
        <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-md pointer-events-none opacity-80 transition-opacity">
          <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
          Passe o mouse para zoom ({currentScale}x)
        </div>
      )}
    </div>
  )
}

export default ZoomableImage
