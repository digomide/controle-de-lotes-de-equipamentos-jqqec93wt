// Tipos e utilitários para Condição de Produtos alinhados ao Mercado Livre (ITEM_CONDITION + ITEM_GRADE)
// Fonte oficial ML:
// - Tipos: Novo, Usado, Recondicionado, Caixa aberta
// - Grau de estado (obrigatório para Recondicionado, exibido também para Usado):
//   Excelente (marcas de uso sutis, tela sem detalhes)
//   Bom (marcas pequenas, tela sem detalhes)
//   Aceitável (marcas visíveis, tela arranhada/riscada)

export type ConditionType = 'novo' | 'usado' | 'recondicionado' | 'caixa_aberta'
export type ConditionGrade = 'excelente' | 'bom' | 'aceitavel'

export interface ConditionOption {
  value: ConditionType
  label: string
  description: string
  mlItemCondition: 'new' | 'used' | 'refurbished' | 'clipped'
  requiresGrade: boolean
  allowsGrade: boolean
}

export interface GradeOption {
  value: ConditionGrade
  label: string
  description: string
  mlGradeAttrValue: string // MLB / ML attribute value if applicable
}

export const CONDITION_TYPE_OPTIONS: ConditionOption[] = [
  {
    value: 'recondicionado',
    label: 'Recondicionado',
    description: 'Equipamento revisado, testado e restaurado com garantia',
    mlItemCondition: 'refurbished',
    requiresGrade: true,
    allowsGrade: true,
  },
  {
    value: 'usado',
    label: 'Usado',
    description: 'Equipamento de segundo uso em perfeito funcionamento',
    mlItemCondition: 'used',
    requiresGrade: false,
    allowsGrade: true,
  },
  {
    value: 'caixa_aberta',
    label: 'Caixa aberta',
    description: 'Produto que foi deslacrado ou devolvido, nunca ou pouco usado',
    mlItemCondition: 'clipped',
    requiresGrade: false,
    allowsGrade: false,
  },
  {
    value: 'novo',
    label: 'Novo',
    description: 'Produto novo e lacrado na embalagem original',
    mlItemCondition: 'new',
    requiresGrade: false,
    allowsGrade: false,
  },
]

export const CONDITION_GRADE_OPTIONS: GradeOption[] = [
  {
    value: 'excelente',
    label: 'Excelente',
    description: 'Marcas de uso sutis, tela sem detalhes',
    mlGradeAttrValue: 'Excelente',
  },
  {
    value: 'bom',
    label: 'Bom',
    description: 'Marcas pequenas de uso, tela sem detalhes',
    mlGradeAttrValue: 'Bom',
  },
  {
    value: 'aceitavel',
    label: 'Aceitável',
    description: 'Marcas visíveis de uso, tela arranhada/riscada',
    mlGradeAttrValue: 'Aceitável',
  },
]

/**
 * Normaliza o tipo e grau a partir de um produto existente ou de valores legados
 */
export function resolveCondition(
  conditionType?: string | null,
  conditionGrade?: string | null,
  legacyCondition?: string | null,
): {
  type: ConditionType
  grade?: ConditionGrade
  displayLabel: string
  shortLabel: string
} {
  // 1. Resolver tipo
  let type: ConditionType = 'recondicionado'
  const tNorm = (conditionType || '').toLowerCase().trim()
  if (tNorm === 'novo' || tNorm === 'new') {
    type = 'novo'
  } else if (tNorm === 'usado' || tNorm === 'used') {
    type = 'usado'
  } else if (tNorm === 'caixa_aberta' || tNorm === 'caixa aberta' || tNorm === 'clipped') {
    type = 'caixa_aberta'
  } else if (tNorm === 'recondicionado' || tNorm === 'refurbished') {
    type = 'recondicionado'
  } else {
    // Inferência baseada em legado se conditionType estiver vazio
    const legNorm = (legacyCondition || '').toLowerCase().trim()
    if (legNorm.includes('novo')) type = 'novo'
    else if (legNorm.includes('caixa')) type = 'caixa_aberta'
    else if (legNorm.includes('usado')) type = 'usado'
    else type = 'recondicionado'
  }

  // 2. Resolver grau
  let grade: ConditionGrade | undefined = undefined
  const gNorm = (conditionGrade || '').toLowerCase().trim()
  if (gNorm === 'excelente') grade = 'excelente'
  else if (gNorm === 'bom') grade = 'bom'
  else if (gNorm === 'aceitavel' || gNorm === 'aceitável' || gNorm === 'regular')
    grade = 'aceitavel'
  else {
    // Inferência pelo campo legacyCondition
    const legNorm = (legacyCondition || '').toLowerCase().trim()
    if (legNorm.includes('excelente')) grade = 'excelente'
    else if (
      legNorm.includes('aceitavel') ||
      legNorm.includes('aceitável') ||
      legNorm.includes('regular')
    )
      grade = 'aceitavel'
    else if (legNorm.includes('bom')) grade = 'bom'
    else if (type === 'recondicionado') grade = 'bom' // fallback para recondicionado
  }

  // Se o tipo não permite grau (novo ou caixa aberta), limpar grau
  if (type === 'novo' || type === 'caixa_aberta') {
    grade = undefined
  }

  // 3. Montar rótulos legíveis
  const typeLabel =
    type === 'recondicionado'
      ? 'Recondicionado'
      : type === 'usado'
        ? 'Usado'
        : type === 'caixa_aberta'
          ? 'Caixa aberta'
          : 'Novo'

  const gradeLabel =
    grade === 'excelente'
      ? 'Excelente'
      : grade === 'bom'
        ? 'Bom'
        : grade === 'aceitavel'
          ? 'Aceitável'
          : ''

  const displayLabel = gradeLabel ? `${typeLabel} · ${gradeLabel}` : typeLabel
  const shortLabel = gradeLabel ? `${typeLabel} · ${gradeLabel}` : typeLabel

  return {
    type,
    grade,
    displayLabel,
    shortLabel,
  }
}

/**
 * Mapeia o condition_type para o valor aceito pela API do Mercado Livre no campo ITEM_CONDITION
 * novo -> "new"
 * usado -> "used"
 * recondicionado -> "refurbished"
 * caixa_aberta -> "clipped"
 */
export function getMLItemCondition(
  type: ConditionType,
): 'new' | 'used' | 'refurbished' | 'clipped' {
  switch (type) {
    case 'novo':
      return 'new'
    case 'usado':
      return 'used'
    case 'caixa_aberta':
      return 'clipped'
    case 'recondicionado':
    default:
      return 'refurbished'
  }
}

/**
 * Retorna o rótulo amigável do grau para inclusão no título e descrição do ML
 */
export function getMLGradeLabel(grade?: ConditionGrade): string {
  switch (grade) {
    case 'excelente':
      return 'Excelente'
    case 'bom':
      return 'Bom'
    case 'aceitavel':
      return 'Aceitável'
    default:
      return ''
  }
}

/**
 * Estilos Tailwind para badges baseados no tipo e grau
 */
export interface ConditionBadgeResult {
  badgeClass: string
  dotClass: string
  classes: string
  label: string
  gradeLabel?: string
}

/**
 * Estilos Tailwind e rótulos para badges baseados no tipo e grau
 */
export function getConditionBadgeStyles(
  type: ConditionType,
  grade?: ConditionGrade,
): ConditionBadgeResult {
  const typeOpt = CONDITION_TYPE_OPTIONS.find((t) => t.value === type)
  const label = typeOpt ? typeOpt.label : 'Usado'

  const gradeOpt = grade ? CONDITION_GRADE_OPTIONS.find((g) => g.value === grade) : undefined
  const gradeLabel = gradeOpt?.label

  let badgeClass = 'bg-slate-100 text-slate-800 border-slate-300'
  let dotClass = 'bg-slate-400'

  if (type === 'novo') {
    badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200'
    dotClass = 'bg-emerald-500'
  } else if (type === 'caixa_aberta') {
    badgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200'
    dotClass = 'bg-indigo-500'
  } else if (type === 'recondicionado') {
    if (grade === 'excelente') {
      badgeClass = 'bg-blue-50 text-blue-800 border-blue-200'
      dotClass = 'bg-blue-500'
    } else if (grade === 'aceitavel') {
      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200'
      dotClass = 'bg-amber-500'
    } else {
      badgeClass = 'bg-cyan-50 text-cyan-800 border-cyan-200'
      dotClass = 'bg-cyan-500'
    }
  } else {
    // usado
    if (grade === 'excelente') {
      badgeClass = 'bg-slate-100 text-slate-800 border-slate-300'
      dotClass = 'bg-emerald-500'
    } else if (grade === 'aceitavel') {
      badgeClass = 'bg-slate-100 text-slate-700 border-slate-300'
      dotClass = 'bg-amber-500'
    } else {
      badgeClass = 'bg-slate-100 text-slate-800 border-slate-300'
      dotClass = 'bg-slate-400'
    }
  }

  return {
    badgeClass,
    dotClass,
    classes: badgeClass,
    label,
    gradeLabel,
  }
}
