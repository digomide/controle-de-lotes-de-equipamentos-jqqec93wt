import React, { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Printer, QrCode, MapPin, Laptop, Copy, ExternalLink, Cpu, HardDrive } from 'lucide-react'
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
import { resolveCondition, getConditionBadgeStyles } from '@/lib/condition'
import type { Product, Batch } from '@/types/inventory'

export interface EtiquetaData {
  product?: Product | null
  batch?: Batch | null
  // Fallbacks if only raw values available
  serialNumber?: string
  sku?: string
  code?: string
  productName?: string
  brand?: string
  model?: string
  batchNumber?: string
  location?: string
  status?: string
  price?: number
}

interface EtiquetaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data?: EtiquetaData | null
  items?: EtiquetaData[] | null
}

function resolveEquipmentTitle(item: EtiquetaData): string {
  const prod = item.product
  if (item.productName && item.productName !== 'Equipamento' && item.productName !== 'Notebook') {
    return item.productName
  }
  if (prod?.name && prod.name !== 'Equipamento' && prod.name !== 'Notebook') {
    return prod.name
  }
  // Monta fallback rico com Marca + Modelo + Processador se disponível
  const brand = item.brand || prod?.brand || ''
  const model = item.model || prod?.model || ''
  const proc = prod?.processor || ''
  const composed = [brand, model, proc].filter(Boolean).join(' ')
  return composed || item.productName || prod?.name || 'Equipamento / Notebook'
}

function EtiquetaCard({ item }: { item: EtiquetaData }) {
  const prod = item.product
  const batch = item.batch

  const serial = item.serialNumber || prod?.serial_number || prod?.sku || prod?.code || '—'
  const sku = item.sku || prod?.sku || ''
  const batchNum = item.batchNumber || batch?.batch_number || 'LOTE-PADRAO'
  const fullEquipmentName = resolveEquipmentTitle(item)
  const brand = item.brand || prod?.brand || 'Notebook'
  const model = item.model || prod?.model || ''
  const location = item.location || batch?.location || 'Depósito Central'
  const price = item.price ?? prod?.unit_price ?? 0
  const processor = prod?.processor || ''
  const ram = prod?.ram || ''
  const storage = prod?.storage || ''
  const screenSize = prod?.screen_size || ''
  const condBadge = resolveCondition(prod?.condition_type, prod?.condition_grade, prod?.condition)
  const badgeInfo = getConditionBadgeStyles(condBadge.type, condBadge.grade)

  // QR Code value: prioriza serial, depois SKU/código
  const qrValue = prod?.serial_number
    ? `SN:${prod.serial_number}|SKU:${prod.sku || ''}|LOTE:${batchNum}`
    : `SKU:${sku || serial}|LOTE:${batchNum}`

  return (
    <div className="printable-etiqueta-item w-full max-w-md bg-white text-black p-3.5 rounded-lg border-2 border-dashed border-slate-400 shadow-sm print:border print:border-solid print:border-black print:shadow-none print:p-1.5 print:m-0 print:w-full print:h-full print:max-w-none print:flex print:flex-col print:justify-between print:rounded-none">
      {/* 1. Header do Ativo / Topo da Etiqueta */}
      <div className="flex items-center justify-between border-b-2 print:border-b border-black pb-1 mb-1.5 print:pb-0.5 print:mb-1 shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <Laptop className="w-3.5 h-3.5 print:w-3 print:h-3 text-black shrink-0" />
          <span className="font-extrabold text-[11px] print:text-[8.5px] tracking-tight uppercase truncate">
            AmbicorpFlow · Ativos
          </span>
        </div>
        <span className="font-mono text-[10px] print:text-[8px] font-black border border-black px-1.5 print:px-1 py-0.2 rounded print:rounded-none shrink-0 uppercase">
          {batchNum}
        </span>
      </div>

      {/* 2. Corpo Central da Etiqueta: Coluna Esquerda (QR Code + SKU) e Coluna Direita (Configuração Completa) */}
      <div className="grid grid-cols-12 gap-2 print:gap-1.5 items-stretch flex-1 min-h-0">
        {/* QR Code Container */}
        <div className="col-span-4 flex flex-col items-center justify-between p-1 bg-white border border-slate-300 rounded print:border-black print:rounded-none print:p-0.5">
          <div className="w-full flex items-center justify-center flex-1">
            <QRCodeSVG
              value={qrValue}
              size={90}
              className="w-full h-auto aspect-square max-h-[20mm] print:max-h-[19mm]"
            />
          </div>
          <div className="w-full text-center mt-0.5 pt-0.5 border-t border-slate-200 print:border-black">
            <span className="text-[9px] print:text-[7.5px] font-mono font-bold text-black block truncate leading-none">
              {sku || serial}
            </span>
          </div>
        </div>

        {/* Data Specifications & Notebook Full Config */}
        <div className="col-span-8 flex flex-col justify-between text-left min-w-0 space-y-1 print:space-y-0.5">
          {/* Nome do Notebook Vinculado (DESTAQUE MÁXIMO) */}
          <div className="min-w-0">
            <div className="text-[8px] print:text-[6.5px] uppercase font-bold text-slate-500 print:text-black leading-none tracking-wider mb-0.5">
              Equipamento Vinculado:
            </div>
            <h3
              className="font-extrabold text-xs print:text-[9.5px] print:leading-[1.15] text-black line-clamp-2 leading-tight"
              title={fullEquipmentName}
            >
              {fullEquipmentName}
            </h3>
            {(brand || model) && (
              <p className="text-[10px] print:text-[7.5px] print:leading-tight text-slate-700 font-semibold print:text-black truncate mt-0.5">
                {brand} {model && `· ${model}`}
              </p>
            )}
          </div>

          {/* Configuração Técnica Visível (CPU, RAM, SSD/Armazenamento, Display) */}
          {(processor || ram || storage || screenSize) && (
            <div className="bg-slate-50 print:bg-white border border-slate-300 print:border-black rounded print:rounded-none p-1 print:p-0.5 text-[9.5px] print:text-[7.5px] print:leading-tight font-mono text-black">
              {processor && (
                <div className="flex items-center gap-1 truncate font-bold">
                  <Cpu className="w-2.5 h-2.5 print:w-2 print:h-2 shrink-0 hidden sm:inline print:hidden" />
                  <span className="truncate">{processor}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 truncate mt-0.5 font-medium">
                {ram && <span className="font-bold">RAM: {ram}</span>}
                {storage && (
                  <span>
                    {ram ? '• ' : ''}
                    {storage}
                  </span>
                )}
                {screenSize && <span>• {screenSize}</span>}
              </div>
            </div>
          )}

          {/* Condição / Grau do Produto + Serial / Part Number */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-black">
              <span className="font-bold text-[9px] print:text-[7px] uppercase tracking-wide bg-slate-100 print:bg-transparent px-1 print:px-0.5 py-0.2 rounded print:rounded-none border border-slate-300 print:border-black leading-tight">
                {badgeInfo.label}
                {badgeInfo.gradeLabel && ` · Grau ${badgeInfo.gradeLabel}`}
              </span>
            </div>

            {/* Serial / Part Number Box */}
            <div className="bg-slate-100 print:bg-transparent border border-slate-300 print:border-black rounded print:rounded-none px-1 py-0.5 leading-none">
              <span className="text-[7.5px] print:text-[6.5px] uppercase tracking-wider font-bold text-slate-600 print:text-black">
                S/N:
              </span>{' '}
              <span className="font-mono text-[10px] print:text-[8px] font-black text-black tracking-wide break-all">
                {serial}
              </span>
            </div>
          </div>

          {/* Location and Price footer */}
          <div className="flex items-center justify-between pt-0.5 border-t border-slate-300 print:border-black text-[9.5px] print:text-[7.5px] font-semibold text-black">
            <span className="flex items-center gap-0.5 truncate max-w-[62%]">
              <MapPin className="w-2.5 h-2.5 print:w-2 print:h-2 text-black shrink-0" />
              <span className="truncate">{location}</span>
            </span>
            {price > 0 && (
              <span className="font-mono font-black text-black shrink-0">
                R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Rodapé Micro: Rastreabilidade e Data */}
      <div className="mt-1 print:mt-0.5 pt-1 print:pt-0.5 border-t border-dashed border-slate-300 print:border-black flex items-center justify-between text-[8px] print:text-[6.5px] text-slate-500 font-mono print:text-black shrink-0">
        <span className="truncate">Rastreabilidade: {qrValue.slice(0, 32)}</span>
        <span className="shrink-0">{new Date().toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  )
}

export function EtiquetaModal({ open, onOpenChange, data, items }: EtiquetaModalProps) {
  const { toast } = useToast()
  const printContainerRef = useRef<HTMLDivElement>(null)

  // Resolve list of items: either explicit `items` array or wrapped single `data`
  const labelItems: EtiquetaData[] = React.useMemo(() => {
    if (items && items.length > 0) return items
    if (data) return [data]
    return []
  }, [items, data])

  // Agrupa as etiquetas em páginas/folhas de exatamente 8 por página (padrão 8-up: 2 colunas x 4 linhas A4)
  const labelSheets: EtiquetaData[][] = React.useMemo(() => {
    const sheets: EtiquetaData[][] = []
    for (let i = 0; i < labelItems.length; i += 8) {
      sheets.push(labelItems.slice(i, i + 8))
    }
    return sheets
  }, [labelItems])

  if (labelItems.length === 0 && !open) return null

  const isBulk = labelItems.length > 1
  const firstItem = labelItems[0] || {}
  const status = firstItem.status || firstItem.product?.status || 'Disponível'
  const firstSerial =
    firstItem.serialNumber ||
    firstItem.product?.serial_number ||
    firstItem.product?.sku ||
    firstItem.product?.code ||
    '—'

  const handlePrint = () => {
    window.print()
  }

  const handleCopySerial = () => {
    if (isBulk) {
      const allSerials = labelItems
        .map(
          (it) =>
            it.serialNumber ||
            it.product?.serial_number ||
            it.product?.sku ||
            it.product?.code ||
            '',
        )
        .filter(Boolean)
        .join('\n')
      navigator.clipboard.writeText(allSerials)
      toast({
        title: 'Seriais copiados!',
        description: `${labelItems.length} seriais copiados para a área de transferência.`,
      })
    } else if (firstSerial && firstSerial !== '—') {
      navigator.clipboard.writeText(firstSerial)
      toast({
        title: 'Copiado!',
        description: `Serial/P/N ${firstSerial} copiado para a área de transferência.`,
      })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-slate-200">
          <DialogHeader className="p-5 pb-3 bg-white border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  {isBulk
                    ? `Imprimir Etiquetas em Massa (${labelItems.length})`
                    : 'Etiqueta Identificadora do Equipamento'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Folha A4 padrão com grade de 8 etiquetas por folha (2 colunas × 4 linhas).
                </DialogDescription>
              </div>
              {isBulk ? (
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border-emerald-300"
                >
                  {labelItems.length} etiquetas ({labelSheets.length}{' '}
                  {labelSheets.length === 1 ? 'folha A4' : 'folhas A4'})
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={`text-[11px] font-bold ${
                    status === 'Disponível'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : status === 'Reservado'
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {/* Preview Container na tela */}
          <div className="p-6 flex-1 overflow-y-auto">
            {/* Visualização em tela: lista amigável e scrollável */}
            <div className="flex flex-col items-center gap-6 w-full">
              {labelItems.map((item, idx) => (
                <EtiquetaCard key={item.product?.id || item.serialNumber || idx} item={item} />
              ))}
            </div>

            <p className="text-[11px] text-slate-400 mt-4 text-center">
              Pressione{' '}
              <strong>Imprimir {isBulk ? `${labelItems.length} Etiquetas` : 'Etiqueta'}</strong>{' '}
              para abrir o diálogo de impressão do navegador (Chrome). A saída imprime em folhas A4
              com grade exata de <strong>8 etiquetas por folha</strong> (2 colunas × 4 linhas, 99 ×
              67,7 mm), ocupando a folha a partir do topo sem cortes.
            </p>
          </div>

          <DialogFooter className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopySerial}
                className="text-xs h-9 gap-1.5 border-slate-300 text-slate-700"
              >
                <Copy className="w-3.5 h-3.5" />
                {isBulk ? 'Copiar Todos os Seriais' : 'Copiar Serial'}
              </Button>
              {!isBulk && firstItem.product?.id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    window.open(
                      `/catalogo/${firstItem.product?.sku || firstItem.product?.code || firstItem.product?.id}`,
                      '_blank',
                    )
                  }}
                  className="text-xs h-9 gap-1 text-slate-600 hover:text-slate-900"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver Ficha
                </Button>
              )}
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
                {isBulk ? `Imprimir ${labelItems.length} Etiquetas` : 'Imprimir Etiqueta'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        PORTAL DE IMPRESSÃO INDEPENDENTE:
        Renderizado DIRETAMENTE sob document.body para ficar completamente fora
        do fluxo de modais, overlays fixed, scrollboxes ou transform do Radix UI.
        Em tela comum permanece hidden (display: none via CSS).
        Durante @media print, o CSS torna o container #printable-etiqueta-root visível
        e esconde todo o restante da página.
      */}
      {open &&
        labelSheets.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div id="printable-etiqueta-root" className="printable-root-hidden">
            {labelSheets.map((sheet, sheetIdx) => (
              <div key={`sheet-${sheetIdx}`} className="printable-etiqueta-sheet">
                {sheet.map((item, itemIdx) => (
                  <div
                    key={`cell-${sheetIdx}-${item.product?.id || item.serialNumber || itemIdx}`}
                    className="printable-etiqueta-cell"
                  >
                    <EtiquetaCard item={item} />
                  </div>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
