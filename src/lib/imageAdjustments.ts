import { useState, useEffect, useCallback, useMemo } from 'react'

export interface ImageAdjustments {
  /** Brilho: -50 a +100 (padrão 0 = 100%) */
  brightness: number
  /** Contraste: -50 a +100 (padrão 0 = 100%) */
  contrast: number
  /** Saturação: -50 a +100 (padrão 0 = 100%) */
  saturation: number
  /** Nitidez: 0 a 100 (padrão 0 = sem filtro de nitidez extra) */
  sharpness: number
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
}

export const IMAGE_ADJUST_STORAGE_KEY = 'ambicorp_img_adjust'
export const IMAGE_ADJUST_EVENT = 'ambicorp_img_adjust_change'

/**
 * Converte os valores da interface em string de CSS filter pronta para style.filter.
 * O sharpness aqui aplica um blend sutil de contraste/detalhe de borda quando acionado.
 * Caso o filtro SVG `ambicorp-sharpness-filter` esteja montado no DOM, pode ser combinado
 * com url(#ambicorp-sharpness-filter).
 */
export function buildCssFilter(adjustments: ImageAdjustments, useSvgFilter = false): string {
  const { brightness, contrast, saturation, sharpness } = adjustments

  // Se tudo estiver no padrão e sem nitidez, não aplica filtro
  const isDefault = brightness === 0 && contrast === 0 && saturation === 0 && sharpness === 0

  if (isDefault) return 'none'

  // brightness: 0 -> 100%, +50 -> 150%, -30 -> 70%
  const b = Math.max(20, Math.min(250, 100 + brightness))
  // contrast: 0 -> 100%, +50 -> 150%, etc.
  // Um pequeno bônus de contraste acoplado à nitidez aumenta a percepção de foco
  const sharpnessBonus = sharpness > 0 ? Math.round(sharpness * 0.15) : 0
  const c = Math.max(30, Math.min(250, 100 + contrast + sharpnessBonus))
  // saturation: 0 -> 100%
  const s = Math.max(0, Math.min(250, 100 + saturation))

  const parts = [`brightness(${b}%)`, `contrast(${c}%)`, `saturate(${s}%)`]

  // Se houver nitidez ativa e o filtro SVG estiver disponível
  if (sharpness > 0 && useSvgFilter) {
    parts.push('url(#ambicorp-sharpness-filter)')
  }

  return parts.join(' ')
}

/**
 * Verifica se os ajustes estão diferentes do original
 */
export function hasActiveAdjustments(adjustments: ImageAdjustments): boolean {
  return (
    adjustments.brightness !== 0 ||
    adjustments.contrast !== 0 ||
    adjustments.saturation !== 0 ||
    adjustments.sharpness !== 0
  )
}

/**
 * Hook para gerenciar e sincronizar os ajustes de imagem entre componentes e abas
 */
export function useImageAdjustments(storageKey = IMAGE_ADJUST_STORAGE_KEY) {
  const readSaved = useCallback((): ImageAdjustments => {
    if (typeof window === 'undefined') return DEFAULT_ADJUSTMENTS
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          brightness: typeof parsed.brightness === 'number' ? parsed.brightness : 0,
          contrast: typeof parsed.contrast === 'number' ? parsed.contrast : 0,
          saturation: typeof parsed.saturation === 'number' ? parsed.saturation : 0,
          sharpness: typeof parsed.sharpness === 'number' ? parsed.sharpness : 0,
        }
      }
    } catch (e) {
      console.warn('Erro ao ler ajustes de imagem:', e)
    }
    return DEFAULT_ADJUSTMENTS
  }, [storageKey])

  const [adjustments, setAdjustments] = useState<ImageAdjustments>(readSaved)

  // Ouve mudanças de storage e evento customizado para refletir em tempo real em todas as fotos abertas
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          setAdjustments({
            brightness: parsed.brightness ?? 0,
            contrast: parsed.contrast ?? 0,
            saturation: parsed.saturation ?? 0,
            sharpness: parsed.sharpness ?? 0,
          })
        } catch {
          // ignore
        }
      }
    }

    const handleCustom = (e: Event) => {
      const ce = e as CustomEvent<{ adjustments: ImageAdjustments }>
      if (ce.detail?.adjustments) {
        setAdjustments(ce.detail.adjustments)
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(IMAGE_ADJUST_EVENT, handleCustom)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(IMAGE_ADJUST_EVENT, handleCustom)
    }
  }, [storageKey])

  const updateAdjustments = useCallback(
    (newAdjustments: ImageAdjustments | ((prev: ImageAdjustments) => ImageAdjustments)) => {
      setAdjustments((prev) => {
        const next = typeof newAdjustments === 'function' ? newAdjustments(prev) : newAdjustments
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
          window.dispatchEvent(
            new CustomEvent(IMAGE_ADJUST_EVENT, { detail: { adjustments: next } }),
          )
        } catch (e) {
          console.warn('Erro ao salvar ajustes de imagem:', e)
        }
        return next
      })
    },
    [storageKey],
  )

  const resetAdjustments = useCallback(() => {
    updateAdjustments(DEFAULT_ADJUSTMENTS)
  }, [updateAdjustments])

  const filterString = useMemo(() => buildCssFilter(adjustments, true), [adjustments])
  const isModified = useMemo(() => hasActiveAdjustments(adjustments), [adjustments])

  return {
    adjustments,
    setAdjustments: updateAdjustments,
    resetAdjustments,
    filterString,
    isModified,
  }
}
