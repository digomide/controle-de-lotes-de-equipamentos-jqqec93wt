import React from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CONDITION_TYPE_OPTIONS,
  CONDITION_GRADE_OPTIONS,
  type ConditionType,
  type ConditionGrade,
} from '@/lib/condition'
import { Info } from 'lucide-react'

interface ProductConditionSelectProps {
  conditionType: ConditionType
  conditionGrade?: ConditionGrade
  onTypeChange: (type: ConditionType) => void
  onGradeChange: (grade?: ConditionGrade) => void
  className?: string
  layout?: 'grid' | 'stack'
  disabled?: boolean
  error?: string
}

export const ProductConditionSelect: React.FC<ProductConditionSelectProps> = ({
  conditionType,
  conditionGrade,
  onTypeChange,
  onGradeChange,
  className = '',
  layout = 'grid',
  disabled = false,
  error,
}) => {
  const currentTypeOpt = CONDITION_TYPE_OPTIONS.find((t) => t.value === conditionType)
  const allowsGrade = currentTypeOpt ? currentTypeOpt.allowsGrade : false
  const requiresGrade = currentTypeOpt ? currentTypeOpt.requiresGrade : false

  const handleTypeSelect = (newType: ConditionType) => {
    onTypeChange(newType)
    const targetOpt = CONDITION_TYPE_OPTIONS.find((t) => t.value === newType)
    if (!targetOpt?.allowsGrade) {
      onGradeChange(undefined)
    } else if (targetOpt?.requiresGrade && !conditionGrade) {
      // Recondicionado exige grau: seleciona excelente por padrão se vazio
      onGradeChange('excelente')
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className={layout === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' : 'space-y-3'}>
        {/* Select Tipo de Produto */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Tipo de produto (Mercado Livre) *</span>
          </Label>
          <Select
            value={conditionType}
            onValueChange={(val: ConditionType) => handleTypeSelect(val)}
            disabled={disabled}
          >
            <SelectTrigger className="h-10 text-xs bg-white border-slate-300">
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  <div className="flex flex-col text-left py-0.5">
                    <span className="font-semibold text-slate-900">{opt.label}</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {opt.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Select Grau de Estado */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>
              Grau de estado {requiresGrade && <strong className="text-orange-600">*</strong>}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {requiresGrade
                ? 'Obrigatório para recondicionados'
                : allowsGrade
                  ? 'Opcional para usados'
                  : 'Não aplicável'}
            </span>
          </Label>
          <Select
            value={conditionGrade || 'none'}
            onValueChange={(val: string) =>
              onGradeChange(val === 'none' ? undefined : (val as ConditionGrade))
            }
            disabled={disabled || !allowsGrade}
          >
            <SelectTrigger
              className={`h-10 text-xs bg-white border-slate-300 ${
                !allowsGrade ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''
              } ${error ? 'border-rose-500 focus-visible:ring-rose-500' : ''}`}
            >
              <SelectValue
                placeholder={!allowsGrade ? 'Desabilitado para este tipo' : 'Selecione o grau...'}
              />
            </SelectTrigger>
            <SelectContent>
              {!requiresGrade && (
                <SelectItem value="none" className="text-xs text-slate-500 italic">
                  Sem grau definido
                </SelectItem>
              )}
              {CONDITION_GRADE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  <div className="flex flex-col text-left py-0.5">
                    <span className="font-semibold text-slate-900">{opt.label}</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {opt.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
        </div>
      </div>

      {/* Explicação contextual compacta */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="leading-snug">
          {conditionType === 'recondicionado' && (
            <span>
              <strong>Recondicionado:</strong> Equipamento revisado em bancada com testes e laudo. O
              grau{' '}
              <strong>
                (
                {conditionGrade === 'excelente'
                  ? 'Excelente'
                  : conditionGrade === 'bom'
                    ? 'Bom'
                    : 'Aceitável'}
                )
              </strong>{' '}
              é obrigatório e enviado ao Mercado Livre (ITEM_CONDITION: <code>refurbished</code>).
            </span>
          )}
          {conditionType === 'usado' && (
            <span>
              <strong>Usado:</strong> Equipamento de segundo uso funcional (ITEM_CONDITION:{' '}
              <code>used</code>). O grau ajuda o comprador a entender o nível estético.
            </span>
          )}
          {conditionType === 'caixa_aberta' && (
            <span>
              <strong>Caixa aberta:</strong> Produto deslacrado/devolvido sem marcas de uso
              (ITEM_CONDITION: <code>clipped</code>). Não possui grau de desgaste.
            </span>
          )}
          {conditionType === 'novo' && (
            <span>
              <strong>Novo:</strong> Equipamento zero km na embalagem original lacrada
              (ITEM_CONDITION: <code>new</code>).
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
