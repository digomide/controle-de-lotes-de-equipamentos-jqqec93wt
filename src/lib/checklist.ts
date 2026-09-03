import type { ChecklistItemStatus } from '@/types/inventory'

export const CHECKLIST_CANONICAL_ITEMS = [
  'Boot/BIOS',
  'Tela/Display',
  'Teclado',
  'Touchpad/Mouse',
  'Portas USB/Vídeo',
  'Bateria',
  'Carregador',
  'Câmera/Webcam',
  'Microfone',
  'Alto-falantes',
  'Wi-Fi',
  'Bluetooth',
  'Dobradiças',
  'Carcaça/Chassi',
  'Memória RAM',
  'Armazenamento',
] as const

export const CHECKLIST_OPTIONS: {
  label: string
  value: 'Ok' | 'Atenção' | 'Falha' | 'Não testado' | 'N/A'
}[] = [
  { label: 'Ok', value: 'Ok' },
  { label: 'Atenção', value: 'Atenção' },
  { label: 'Falha', value: 'Falha' },
  { label: 'Não testado', value: 'Não testado' },
  { label: 'N/A', value: 'N/A' },
]

export function normalizeChecklistStatus(
  status?: string,
): 'Ok' | 'Atenção' | 'Falha' | 'Não testado' | 'N/A' {
  if (!status) return 'Não testado'
  const normalized = status.trim()
  if (normalized === 'OK' || normalized === 'Ok' || normalized.toLowerCase() === 'ok') return 'Ok'
  if (
    normalized === 'Atenção' ||
    normalized.toLowerCase() === 'atenção' ||
    normalized.toLowerCase() === 'atencao'
  )
    return 'Atenção'
  if (normalized === 'Falha' || normalized.toLowerCase() === 'falha') return 'Falha'
  if (
    normalized === 'Não testado' ||
    normalized.toLowerCase() === 'não testado' ||
    normalized.toLowerCase() === 'nao testado'
  )
    return 'Não testado'
  if (
    normalized === 'N/A' ||
    normalized.toUpperCase() === 'N/A' ||
    normalized.toLowerCase() === 'n/a'
  )
    return 'N/A'
  return 'N/A'
}

/**
 * Cores solicitadas pelo usuário:
 * - Ok → verde (#16a34a)
 * - Atenção → amarelo (#ca8a04)
 * - Falha → vermelho (#dc2626)
 * - Não testado → azul (#2563eb)
 * - N/A (outros) → roxo (#7c3aed)
 */
export function getChecklistStatusStyles(status?: string) {
  const norm = normalizeChecklistStatus(status)

  switch (norm) {
    case 'Ok':
      return {
        key: 'Ok',
        label: 'Ok',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        badgeSolid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        select:
          'bg-emerald-50/80 text-emerald-800 border-emerald-300 hover:bg-emerald-100/70 focus:ring-emerald-400',
        dot: 'bg-emerald-500',
        colorHex: '#16a34a',
      }
    case 'Atenção':
      return {
        key: 'Atenção',
        label: 'Atenção',
        badge: 'bg-amber-50 text-amber-800 border-amber-200/80',
        badgeSolid: 'bg-amber-100 text-amber-800 border-amber-300',
        select:
          'bg-amber-50/90 text-amber-900 border-amber-300 hover:bg-amber-100/70 focus:ring-amber-400',
        dot: 'bg-amber-500',
        colorHex: '#ca8a04',
      }
    case 'Falha':
      return {
        key: 'Falha',
        label: 'Falha',
        badge: 'bg-rose-50 text-rose-700 border-rose-200/80',
        badgeSolid: 'bg-rose-100 text-rose-800 border-rose-300',
        select:
          'bg-rose-50/80 text-rose-800 border-rose-300 hover:bg-rose-100/70 focus:ring-rose-400',
        dot: 'bg-rose-500',
        colorHex: '#dc2626',
      }
    case 'Não testado':
      return {
        key: 'Não testado',
        label: 'Não testado',
        badge: 'bg-blue-50 text-blue-700 border-blue-200/80',
        badgeSolid: 'bg-blue-100 text-blue-800 border-blue-300',
        select:
          'bg-blue-50/80 text-blue-800 border-blue-300 hover:bg-blue-100/70 focus:ring-blue-400',
        dot: 'bg-blue-500',
        colorHex: '#2563eb',
      }
    case 'N/A':
    default:
      return {
        key: 'N/A',
        label: 'N/A',
        badge: 'bg-purple-50 text-purple-700 border-purple-200/80',
        badgeSolid: 'bg-purple-100 text-purple-800 border-purple-300',
        select:
          'bg-purple-50/80 text-purple-800 border-purple-300 hover:bg-purple-100/70 focus:ring-purple-400',
        dot: 'bg-purple-500',
        colorHex: '#7c3aed',
      }
  }
}
