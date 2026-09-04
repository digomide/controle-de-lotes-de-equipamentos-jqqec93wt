import React from 'react'

interface ImageFilterSvgProps {
  sharpness: number
}

/**
 * ImageFilterSvg - Filtro SVG de convolução de nitidez (Laplacian/sharpen matrix).
 * Só tem efeito visual quando sharpness > 0.
 * A matriz calcula:
 *  0,    -factor,     0
 * -factor, 1 + 4*factor, -factor
 *  0,    -factor,     0
 * Onde factor varia de 0 (neutro) até 0.4 (nitidez bem visível para realçar textos de etiquetas, teclado e arranhões).
 */
export const ImageFilterSvg: React.FC<ImageFilterSvgProps> = ({ sharpness }) => {
  // Converte 0..100 em fator de 0 a 0.35
  const factor = (Math.max(0, Math.min(100, sharpness)) / 100) * 0.35
  const center = (1 + 4 * factor).toFixed(3)
  const neg = (-factor).toFixed(3)
  const matrix = `0 ${neg} 0 ${neg} ${center} ${neg} 0 ${neg} 0`

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <filter id="ambicorp-sharpness-filter" colorInterpolationFilters="sRGB">
        <feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix={matrix} />
      </filter>
    </svg>
  )
}
