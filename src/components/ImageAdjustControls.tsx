import React from 'react'
import { Sun, Contrast, Sparkles, RotateCcw, SlidersHorizontal, Droplets } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { ImageAdjustments } from '@/lib/imageAdjustments'

interface ImageAdjustControlsProps {
  adjustments: ImageAdjustments
  onChange: (adjustments: ImageAdjustments | ((prev: ImageAdjustments) => ImageAdjustments)) => void
  onReset: () => void
  onClose?: () => void
  isModified: boolean
  className?: string
  /** Tema escuro/transparente para sobrepor em fotos ou modal dark */
  theme?: 'dark' | 'light'
}

export const ImageAdjustControls: React.FC<ImageAdjustControlsProps> = ({
  adjustments,
  onChange,
  onReset,
  onClose,
  isModified,
  className = '',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark'

  const handleBrightnessChange = (val: number[]) => {
    onChange((prev) => ({ ...prev, brightness: val[0] }))
  }

  const handleContrastChange = (val: number[]) => {
    onChange((prev) => ({ ...prev, contrast: val[0] }))
  }

  const handleSharpnessChange = (val: number[]) => {
    onChange((prev) => ({ ...prev, sharpness: val[0] }))
  }

  const handleSaturationChange = (val: number[]) => {
    onChange((prev) => ({ ...prev, saturation: val[0] }))
  }

  return (
    <div
      className={`rounded-xl border shadow-xl p-3.5 space-y-3 backdrop-blur-md select-none transition-all ${
        isDark
          ? 'bg-slate-950/90 border-slate-800 text-white'
          : 'bg-white/95 border-slate-200 text-slate-900'
      } ${className}`}
      onClick={(e) => {
        // Evita que cliques nos controles fechem modais ou ativem ações da imagem
        e.stopPropagation()
      }}
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold tracking-tight">Melhoria de Luz & Nitidez</span>
          {isModified && (
            <span
              className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
              title="Ajustes aplicados"
            />
          )}
        </div>

        <div className="flex items-center gap-1">
          {isModified && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-6 px-2 text-[11px] font-semibold text-amber-400 hover:text-amber-300 hover:bg-white/10 gap-1"
              title="Restaurar valores padrão da foto"
            >
              <RotateCcw className="w-3 h-3" />
              Redefinir
            </Button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md text-xs leading-none"
              title="Fechar painel de ajustes"
              aria-label="Fechar painel de ajustes"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-3 text-xs">
        {/* Brilho */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              Brilho
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}%
            </span>
          </div>
          <Slider
            value={[adjustments.brightness]}
            min={-50}
            max={100}
            step={2}
            onValueChange={handleBrightnessChange}
            className="py-1 cursor-pointer"
          />
        </div>

        {/* Contraste */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Contrast className="w-3.5 h-3.5 text-blue-400" />
              Contraste
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}%
            </span>
          </div>
          <Slider
            value={[adjustments.contrast]}
            min={-50}
            max={100}
            step={2}
            onValueChange={handleContrastChange}
            className="py-1 cursor-pointer"
          />
        </div>

        {/* Nitidez */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Nitidez (Clareza)
            </span>
            <span className="font-mono text-[11px] text-slate-400">{adjustments.sharpness}%</span>
          </div>
          <Slider
            value={[adjustments.sharpness]}
            min={0}
            max={100}
            step={5}
            onValueChange={handleSharpnessChange}
            className="py-1 cursor-pointer"
          />
        </div>

        {/* Saturação */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Droplets className="w-3.5 h-3.5 text-pink-400" />
              Saturação
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}%
            </span>
          </div>
          <Slider
            value={[adjustments.saturation]}
            min={-50}
            max={100}
            step={2}
            onValueChange={handleSaturationChange}
            className="py-1 cursor-pointer"
          />
        </div>
      </div>

      <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-white/5">
        <span>Filtro visual em tempo real</span>
        <button
          type="button"
          onClick={() => {
            // Preset rápido para foto escura de notebook
            onChange({
              brightness: 30,
              contrast: 20,
              sharpness: 35,
              saturation: 10,
            })
          }}
          className="text-amber-400 hover:underline font-semibold"
        >
          Preset "Foto Escura"
        </button>
      </div>
    </div>
  )
}
