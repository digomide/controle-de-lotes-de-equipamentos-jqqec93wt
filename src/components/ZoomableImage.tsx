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
}

/**
 * ZoomableImage - Componente de imagem com hover zoom estilo Mercado Livre (lens zoom).
 * - Desktop/mouse: ao passar o mouse, exibe a região sob o cursor ampliada (transform-origin dinâmica + scale).
 * - Inclui indicador sutil de zoom / lupa.
 * - Mobile/touch: não interfere com scroll/touch, mantém o clique/toque para abrir modal de tela cheia.
 */
export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  src,
  alt,
  className = '',
  scale = 2.4,
  fallbackSrc = 'https://img.usecurling.com/p/800/600?q=laptop',
  onClick,
  showHint = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isZoomed, setIsZoomed] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const [imgSrc, setImgSrc] = useState(src)

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
          transform: isZoomed ? `scale(${scale})` : 'scale(1)',
          transitionDuration: isZoomed ? '75ms' : '200ms',
          transitionTimingFunction: 'cubic-bezier(0.2, 0, 0.2, 1)',
        }}
      />

      {/* Indicador de dica de zoom no canto inferior direito quando não estiver ampliado */}
      {showHint && !isZoomed && (
        <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-md pointer-events-none opacity-80 transition-opacity">
          <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
          Passe o mouse para zoom
        </div>
      )}
    </div>
  )
}

export default ZoomableImage
