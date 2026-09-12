/**
 * Utilitários para contagem de prazos de envio do Mercado Livre em dias úteis
 * Fuso horário base: America/Sao_Paulo
 *
 * Regras operacionais do Mercado Livre validadas na prática pelo lojista:
 * 1. Fim de semana (sábado e domingo) NÃO avança o relógio de contagem de atraso nem marca atraso indevido.
 * 2. Se um pacote tem prazo na sexta ou sábado e não é bipado no fim de semana,
 *    o prazo desliza para o próximo dia útil (segunda-feira) no mesmo horário da etiqueta.
 * 3. Se não for despachado na segunda-feira até o horário-limite, só então apita atraso.
 * 4. Prazos-limite que caiam no sábado ou domingo deslizam para a segunda-feira seguinte
 *    (preservando a hora original da etiqueta).
 * 5. Se o dado de shipping_delayed vier confirmado oficialmente da API do ML (true),
 *    ele NUNCA é reescrito (dado oficial preservado).
 */

export interface MLBusinessDeadline {
  adjustedLimit: Date
  isWeekendAdjusted: boolean
  originalLimit: Date
  isOverdue: boolean
  isDueToday: boolean
  remainingMs: number
  diffHours: number
  overdueMinutes: number
}

const SP_TIMEZONE = 'America/Sao_Paulo'

/**
 * Obtém partes de data (ano, mês 0-11, dia, dia da semana 0-6, hora, minuto, segundo)
 * de um objeto Date no fuso de São Paulo.
 */
export function getSPDateParts(date: Date): {
  year: number
  month: number // 0-indexed
  day: number
  dayOfWeek: number // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  hours: number
  minutes: number
  seconds: number
} {
  // Usar Intl.DateTimeFormat para decompor precisamente em America/Sao_Paulo
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SP_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) {
    map[p.type] = p.value
  }

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10) - 1,
    day: parseInt(map.day, 10),
    dayOfWeek: weekdayMap[map.weekday] ?? date.getDay(),
    hours: parseInt(map.hour, 10) === 24 ? 0 : parseInt(map.hour, 10),
    minutes: parseInt(map.minute, 10),
    seconds: parseInt(map.second, 10),
  }
}

/**
 * Cria uma data com hora local correspondente ao fuso de São Paulo.
 */
export function createSPDate(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
): Date {
  // Construir string ISO e converter considerando o offset de SP (-03:00)
  // O Brasil não utiliza mais horário de verão desde 2019, portanto SP é UTC-03:00 o ano todo.
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}-03:00`
  return new Date(iso)
}

/**
 * Ajusta um prazo-limite de envio do ML para a regra de dias úteis:
 * Se o prazo original cair em um sábado (dia 6) ou domingo (dia 0),
 * ele é deslocado para a segunda-feira seguinte no mesmo horário.
 */
export function adjustLimitToBusinessDay(originalDate: Date): {
  adjustedDate: Date
  wasAdjusted: boolean
} {
  const parts = getSPDateParts(originalDate)
  let daysToAdd = 0

  if (parts.dayOfWeek === 6) {
    // Sábado -> move 2 dias para segunda-feira
    daysToAdd = 2
  } else if (parts.dayOfWeek === 0) {
    // Domingo -> move 1 dia para segunda-feira
    daysToAdd = 1
  }

  if (daysToAdd === 0) {
    return { adjustedDate: originalDate, wasAdjusted: false }
  }

  // Desloca os dias mantendo a hora exata da etiqueta em SP
  const adjusted = new Date(originalDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
  return { adjustedDate: adjusted, wasAdjusted: true }
}

/**
 * Verifica se um instante está dentro de um fim de semana (sábado ou domingo) no fuso SP.
 */
export function isWeekendSP(date: Date): boolean {
  const parts = getSPDateParts(date)
  return parts.dayOfWeek === 0 || parts.dayOfWeek === 6
}

/**
 * Calcula se um envio pendente está atrasado, se vence hoje ou se está no prazo,
 * respeitando os dias úteis.
 *
 * Regras:
 * - Se hoje é fim de semana (sábado ou domingo), NÃO apita atraso: o prazo para despacho
 *   desliza para o próximo dia útil (segunda-feira).
 * - Se o prazo original era sexta-feira ou fim de semana, mas o pacote não foi bipado no fim de semana,
 *   o atraso só passa a contar após o horário-limite na segunda-feira.
 */
export function evaluateBusinessDeadline(
  handlingLimitIso: string,
  nowDate = new Date(),
): MLBusinessDeadline {
  const originalLimit = new Date(handlingLimitIso)
  const { adjustedDate: adjustedLimit, wasAdjusted } = adjustLimitToBusinessDay(originalLimit)

  const nowMs = nowDate.getTime()
  const limitMs = adjustedLimit.getTime()
  const diffMs = limitMs - nowMs
  const diffHours = diffMs / (1000 * 60 * 60)

  const nowParts = getSPDateParts(nowDate)
  const limitParts = getSPDateParts(adjustedLimit)

  // Vence no mesmo dia se a data em SP for a mesma
  const isDueToday =
    nowParts.year === limitParts.year &&
    nowParts.month === limitParts.month &&
    nowParts.day === limitParts.day

  // No fim de semana (sábado ou domingo), não apitamos atraso para o lojista
  // se o prazo original era fim de semana ou sexta, pois a coleta só consolida na segunda.
  const isNowWeekend = isWeekendSP(nowDate)

  let isOverdue = false
  if (!isNowWeekend && nowMs > limitMs) {
    isOverdue = true
  }

  const overdueMinutes = isOverdue ? Math.max(1, Math.floor((nowMs - limitMs) / 60000)) : 0

  return {
    adjustedLimit,
    isWeekendAdjusted: wasAdjusted,
    originalLimit,
    isOverdue,
    isDueToday,
    remainingMs: diffMs,
    diffHours,
    overdueMinutes,
  }
}

/**
 * Avalia se um envio que já foi bipado (shipped) foi considerado atrasado,
 * levando em conta dias úteis e o fuso de São Paulo.
 * Se order.shipping_delayed já for true (vindo da API oficial do ML), prevalece.
 */
export function isShippedOrderDelayed(
  shippingHandlingLimitIso?: string | null,
  shippingDateShippedIso?: string | null,
  shippingDelayedOfficial?: boolean,
): boolean {
  // Prevalece o dado oficial da API se true
  if (shippingDelayedOfficial) return true

  if (!shippingHandlingLimitIso || !shippingDateShippedIso) {
    return false
  }

  const originalLimit = new Date(shippingHandlingLimitIso)
  const shippedDate = new Date(shippingDateShippedIso)

  // Desliza prazo se cair no fim de semana
  const { adjustedDate: adjustedLimit } = adjustLimitToBusinessDay(originalLimit)

  // Tolerância de 1 minuto
  return shippedDate.getTime() - adjustedLimit.getTime() > 60000
}
