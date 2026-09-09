import React, { useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  MinusCircle,
  Laptop,
  Layers,
  MapPin,
  Calendar,
  UserCheck,
  Check,
  Copy,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { QRCodeSVG } from '@/components/QRCodeSVG'
import { useToast } from '@/hooks/use-toast'
import type { Product, TechnicalChecklistItem, ChecklistItemStatus } from '@/types/inventory'
import {
  CHECKLIST_CANONICAL_ITEMS,
  normalizeChecklistItemName,
  normalizeChecklistStatus,
  getChecklistStatusStyles,
} from '@/lib/checklist'
import { resolveCondition, getConditionBadgeStyles } from '@/lib/condition'

export interface ChecklistPrintData {
  product: Product
  photos?: string[]
  batchNumber?: string
  location?: string
  checklist?: TechnicalChecklistItem[]
  inspectorName?: string
  inspectionDate?: string
  notes?: string
}

interface ChecklistPrintModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data?: ChecklistPrintData | null
  items?: ChecklistPrintData[]
}

/**
 * Retorna o ícone e estilo para cada status do checklist
 */
function getStatusIcon(status: 'Ok' | 'Atenção' | 'Falha' | 'Não testado' | 'N/A') {
  switch (status) {
    case 'Ok':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
    case 'Atenção':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
    case 'Falha':
      return <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
    case 'Não testado':
      return <HelpCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
    case 'N/A':
    default:
      return <MinusCircle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
  }
}

/**
 * Normaliza e consolida a lista de 17 itens canônicos para garantir
 * que nenhum item falte (inclusive 'VGA Dedicada')
 */
export function buildCanonicalChecklist(
  rawList?: TechnicalChecklistItem[],
): TechnicalChecklistItem[] {
  if (!rawList || rawList.length === 0) {
    return CHECKLIST_CANONICAL_ITEMS.map((item) => ({
      item,
      status: 'Não testado' as ChecklistItemStatus,
      observation: '',
    }))
  }

  const map = new Map<string, TechnicalChecklistItem>()
  for (const c of rawList) {
    const normalizedName = normalizeChecklistItemName(c.item)
    map.set(normalizedName.toLowerCase(), {
      ...c,
      item: normalizedName,
      status: normalizeChecklistStatus(c.status),
    })
  }

  const result: TechnicalChecklistItem[] = []
  for (const canon of CHECKLIST_CANONICAL_ITEMS) {
    const existing = map.get(canon.toLowerCase())
    if (existing) {
      result.push(existing)
    } else {
      result.push({
        item: canon,
        status: 'Não testado' as ChecklistItemStatus,
        observation: '',
      })
    }
  }

  // Itens extras que o usuário possa ter adicionado
  for (const c of rawList) {
    const normalizedName = normalizeChecklistItemName(c.item)
    const isCanon = CHECKLIST_CANONICAL_ITEMS.some(
      (it) => it.toLowerCase() === normalizedName.toLowerCase(),
    )
    if (!isCanon && !result.some((r) => r.item.toLowerCase() === normalizedName.toLowerCase())) {
      result.push({
        ...c,
        item: normalizedName,
        status: normalizeChecklistStatus(c.status),
      })
    }
  }

  return result
}

/**
 * Componente de folha A4 individual do checklist
 */
export function ChecklistSheet({ item }: { item: ChecklistPrintData }) {
  const { product, batchNumber, location, inspectorName, inspectionDate } = item
  const rawList = item.checklist || product.technical_checklist || []
  const items = buildCanonicalChecklist(rawList)

  // Fotos do equipamento (até 4 para caber na folha sem quebra)
  const allPhotos =
    item.photos && item.photos.length > 0
      ? item.photos
      : Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : ['https://img.usecurling.com/p/600/400?q=laptop']
  const displayPhotos = allPhotos.slice(0, 3)

  const resolved = resolveCondition(
    product.condition_type,
    product.condition_grade,
    product.condition,
  )
  const condBadge = getConditionBadgeStyles(resolved.type, resolved.grade)

  const okCount = items.filter((i) => normalizeChecklistStatus(i.status) === 'Ok').length
  const warningCount = items.filter((i) => normalizeChecklistStatus(i.status) === 'Atenção').length
  const failureCount = items.filter((i) => normalizeChecklistStatus(i.status) === 'Falha').length
  const untestedCount = items.filter(
    (i) => normalizeChecklistStatus(i.status) === 'Não testado',
  ).length
  const naCount = items.filter((i) => normalizeChecklistStatus(i.status) === 'N/A').length

  const serial = product.serial_number || product.part_number || product.sku || product.code || '—'
  const sku = product.sku || product.code || '—'
  const qrValue = `SKU:${sku}|SN:${serial}|LOTE:${batchNumber || 'N/A'}`

  const nowFormatted =
    inspectionDate ||
    `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

  return (
    <div className="printable-checklist-page w-full bg-white text-slate-900 p-6 sm:p-8 rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:rounded-none">
      {/* 1. CABEÇALHO DO LAUDO / CHECKLIST */}
      <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0 print:border print:border-black">
              AF
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                AmbicorpFlow · Laudo de Revisão Técnica
              </h1>
              <p className="text-[11px] text-slate-600 font-medium">
                Checklist Completo de Inspeção e Conferência de Equipamentos Recondicionados
              </p>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono font-bold text-slate-900">
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            LOTE: {batchNumber || 'LOTE-PADRÃO'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">Emissão: {nowFormatted}</div>
        </div>
      </div>

      {/* 2. IDENTIFICAÇÃO DO EQUIPAMENTO + FOTOS + QR CODE */}
      <div className="grid grid-cols-12 gap-3.5 pt-3.5 pb-3 border-b border-slate-200">
        {/* Bloco de Dados Principais (7 colunas) */}
        <div className="col-span-8 space-y-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
                SKU: {sku}
              </span>
              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded">
                Serial/PN: {serial}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded border ${condBadge.classes}`}
              >
                {condBadge.label} {condBadge.gradeLabel ? `· Grau ${condBadge.gradeLabel}` : ''}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                {product.status || 'Disponível'}
              </span>
            </div>

            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
              {product.name}
            </h2>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {product.brand} {product.model ? `· ${product.model}` : ''}{' '}
              {product.category ? `(${product.category})` : ''}
            </p>
          </div>

          {/* Grid de Especificações de Hardware */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                Processador
              </span>
              <span
                className="font-semibold text-slate-800 truncate block mt-0.5"
                title={product.processor}
              >
                {product.processor || 'N/A'}
              </span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                Memória RAM
              </span>
              <span className="font-semibold text-slate-800 truncate block mt-0.5">
                {product.ram || 'N/A'}
              </span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                Armazenamento
              </span>
              <span className="font-semibold text-slate-800 truncate block mt-0.5">
                {product.storage || 'N/A'}
              </span>
            </div>
            <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                Tela / Bateria
              </span>
              <span className="font-semibold text-slate-800 truncate block mt-0.5">
                {product.screen_size || '14"'} · {product.battery_health || '100%'}
              </span>
            </div>
          </div>

          {/* Localização e Carregador */}
          <div className="flex items-center gap-4 text-xs text-slate-600 pt-0.5">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <strong>Local:</strong> {location || 'Depósito Central'}
            </span>
            <span>•</span>
            <span>
              <strong>Carregador:</strong>{' '}
              {product.includes_charger ? 'Sim (Acompanha)' : 'Não acompanha'}
            </span>
            {product.has_numeric_keypad !== undefined && (
              <>
                <span>•</span>
                <span>
                  <strong>Teclado Numérico:</strong> {product.has_numeric_keypad ? 'Sim' : 'Não'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* QR Code de Autenticidade (4 colunas) */}
        <div className="col-span-4 flex flex-col items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-center">
          <div className="w-full flex items-center justify-center flex-1">
            <QRCodeSVG
              value={qrValue}
              size={84}
              className="w-full h-auto aspect-square max-h-[22mm]"
            />
          </div>
          <div className="w-full mt-1 pt-1 border-t border-slate-200">
            <span className="text-[9px] font-mono font-bold text-slate-800 block truncate leading-tight">
              {sku}
            </span>
            <span className="text-[8px] text-slate-500 block leading-tight">
              Rastreio / Validação Digital
            </span>
          </div>
        </div>
      </div>

      {/* 3. GALERIA DE FOTOS DO EQUIPAMENTO (FOTO PRINCIPAL + COMPLEMENTARES) */}
      <div className="py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-slate-500" />
            Registro Fotográfico do Equipamento ({displayPhotos.length} foto
            {displayPhotos.length > 1 ? 's' : ''})
          </span>
          <span className="text-[10px] text-slate-400">Fotos reais do notebook inspecionado</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {displayPhotos.map((url, idx) => (
            <div
              key={idx}
              className="relative aspect-16/10 bg-slate-100 rounded-md overflow-hidden border border-slate-300 print:border-black flex items-center justify-center"
            >
              <img
                src={url}
                alt={`${product.name} foto ${idx + 1}`}
                className="w-full h-full object-cover object-center"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'https://img.usecurling.com/p/600/400?q=laptop'
                }}
              />
              <div className="absolute top-1 left-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
                {idx === 0 ? 'Capa Principal' : `Foto #${idx + 1}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. RESUMO DOS INDICADORES DO CHECKLIST */}
      <div className="py-2.5 flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 bg-slate-50/70 px-3 rounded-lg my-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-900">
            Checklist de Inspeção ({items.length} itens verificados):
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold flex-wrap">
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
            ✓ {okCount} Ok
          </span>
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
              ⚠ {warningCount} Atenção
            </span>
          )}
          {failureCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
              ✕ {failureCount} Falha
            </span>
          )}
          {untestedCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
              ? {untestedCount} Não testado
            </span>
          )}
          {naCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
              - {naCount} N/A
            </span>
          )}
        </div>
      </div>

      {/* 5. GRADE COMPLETA DOS 17 ITENS DO CHECKLIST (INCLUINDO VGA DEDICADA) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 pb-3">
        {items.map((checkItem) => {
          const normStatus = normalizeChecklistStatus(checkItem.status)
          const styles = getChecklistStatusStyles(normStatus)
          return (
            <div
              key={checkItem.item}
              className="p-2 rounded border border-slate-200 bg-white flex flex-col justify-between text-xs space-y-1 print:border-slate-300"
            >
              <div className="flex items-start justify-between gap-1.5">
                <span
                  className="font-bold text-slate-900 text-[11px] leading-tight truncate"
                  title={checkItem.item}
                >
                  {checkItem.item}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 border ${styles.badgeSolid}`}
                >
                  {getStatusIcon(normStatus)}
                  {normStatus}
                </span>
              </div>

              {checkItem.observation ? (
                <p className="text-[10px] text-slate-600 italic leading-tight line-clamp-2">
                  Obs: {checkItem.observation}
                </p>
              ) : (
                <span className="text-[9px] text-slate-400 italic">Sem ressalvas</span>
              )}
            </div>
          )
        })}
      </div>

      {/* 6. ASSINATURA TÉCNICA E TERMO DE CONFORMIDADE */}
      <div className="pt-3 border-t-2 border-slate-900 mt-2 grid grid-cols-12 gap-4 text-xs">
        <div className="col-span-7 space-y-1">
          <p className="text-[10px] text-slate-600 leading-tight">
            <strong>Declaração de Conformidade:</strong> Este equipamento passou pelo protocolo de
            testes, higienização, revisão funcional e classificação estética da{' '}
            <strong>AmbicorpFlow</strong>. As condições registradas neste laudo refletem o estado no
            momento da liberação de bancada.
          </p>
          {item.notes && (
            <p className="text-[10px] text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 font-mono">
              Notas adicionais: {item.notes}
            </p>
          )}
        </div>

        <div className="col-span-5 flex flex-col justify-end text-center">
          <div className="border-t border-slate-400 pt-1">
            <span className="text-[11px] font-bold text-slate-900 block">
              {inspectorName || 'Técnico Responsável / Bancada'}
            </span>
            <span className="text-[9px] text-slate-500 block">
              AmbicorpFlow · Controle de Qualidade & Lotes
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Modal completo para visualização e impressão do Checklist em A4
 */
export function ChecklistPrintModal({ open, onOpenChange, data, items }: ChecklistPrintModalProps) {
  const { toast } = useToast()
  const printItems: ChecklistPrintData[] = React.useMemo(() => {
    if (items && items.length > 0) return items
    if (data) return [data]
    return []
  }, [items, data])

  if (printItems.length === 0 && !open) return null

  const isBulk = printItems.length > 1
  const first = printItems[0]

  const handlePrint = () => {
    window.print()
  }

  const handleCopySummary = () => {
    if (!first) return
    const prod = first.product
    const canonItems = buildCanonicalChecklist(first.checklist || prod.technical_checklist)
    const summary = [
      `LAUDO / CHECKLIST TÉCNICO - AmbicorpFlow`,
      `Equipamento: ${prod.name}`,
      `SKU: ${prod.sku || prod.code || 'N/A'}`,
      `Serial: ${prod.serial_number || 'N/A'}`,
      `Lote: ${first.batchNumber || 'N/A'}`,
      `Condição: ${prod.condition || 'Excelente'}`,
      `Preço: R$ ${Number(prod.unit_price || 0).toFixed(2)}`,
      ``,
      `Itens Inspecionados (${canonItems.length}):`,
      ...canonItems.map(
        (it) =>
          `[${normalizeChecklistStatus(it.status).toUpperCase()}] ${it.item}${it.observation ? ` - Obs: ${it.observation}` : ''}`,
      ),
    ].join('\n')

    navigator.clipboard.writeText(summary)
    toast({
      title: 'Resumo copiado!',
      description: 'O texto resumido do checklist foi copiado para a área de transferência.',
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-100 border-slate-300">
          <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-200 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  {isBulk
                    ? `Imprimir Checklist de Equipamentos (${printItems.length})`
                    : `Checklist de Revisão com Fotos · ${first?.product?.sku || 'Equipamento'}`}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Visualização da folha A4 com fotos reais do note, dados de rastreabilidade e lista
                  completa de testes técnicos.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs"
                >
                  {isBulk ? `${printItems.length} Folhas A4` : 'Padrão A4 Retrato'}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Área de rolagem com visualização da folha em tela */}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6 flex flex-col items-center">
            {printItems.map((pi, idx) => (
              <div key={pi.product.id || idx} className="w-full max-w-3xl">
                <ChecklistSheet item={pi} />
              </div>
            ))}
          </div>

          <DialogFooter className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopySummary}
                className="text-xs h-9 gap-1.5 border-slate-300 text-slate-700"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Texto do Laudo
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-9 text-slate-600"
              >
                Fechar
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-semibold gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                {isBulk
                  ? `Imprimir ${printItems.length} Checklists (A4)`
                  : 'Imprimir Checklist (A4)'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PORTAL DE IMPRESSÃO A4 INDEPENDENTE */}
      {open &&
        printItems.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div id="printable-checklist-root" className="printable-root-hidden">
            {printItems.map((pi, idx) => (
              <div
                key={`checklist-page-${pi.product.id || idx}`}
                className="printable-checklist-page-wrapper"
              >
                <ChecklistSheet item={pi} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
