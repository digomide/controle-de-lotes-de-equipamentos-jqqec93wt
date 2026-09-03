import React, { useRef } from 'react'
import {
  Printer,
  QrCode,
  Barcode,
  Layers,
  MapPin,
  Laptop,
  Check,
  Tag,
  Copy,
  ExternalLink,
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
  data: EtiquetaData | null
}

export function EtiquetaModal({ open, onOpenChange, data }: EtiquetaModalProps) {
  const { toast } = useToast()
  const printContainerRef = useRef<HTMLDivElement>(null)

  if (!data) return null

  const prod = data.product
  const batch = data.batch

  const serial = data.serialNumber || prod?.serial_number || prod?.sku || prod?.code || '—'

  const sku = data.sku || prod?.sku || ''
  const batchNum = data.batchNumber || batch?.batch_number || 'LOTE-PADRAO'
  const productName = data.productName || prod?.name || 'Equipamento / Notebook'
  const brand = data.brand || prod?.brand || 'Notebook'
  const model = data.model || prod?.model || ''
  const location = data.location || batch?.location || 'Depósito Central'
  const status = data.status || prod?.status || 'Disponível'
  const price = data.price ?? prod?.unit_price ?? 0
  const processor = prod?.processor || ''
  const ram = prod?.ram || ''
  const storage = prod?.storage || ''

  // Valor contido no QR Code: prioriza serial, depois SKU/código
  const qrValue = prod?.serial_number
    ? `SN:${prod.serial_number}|SKU:${prod.sku || ''}|LOTE:${batchNum}`
    : `SKU:${sku || serial}|LOTE:${batchNum}`

  const handlePrint = () => {
    window.print()
  }

  const handleCopySerial = () => {
    if (serial && serial !== '—') {
      navigator.clipboard.writeText(serial)
      toast({
        title: 'Copiado!',
        description: `Serial/P/N ${serial} copiado para a área de transferência.`,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-slate-50 border-slate-200">
        <DialogHeader className="p-5 pb-3 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600" />
                Etiqueta Identificadora do Equipamento
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Visualização formatada para impressoras térmicas (Zebra/Argox) ou folhas A4 padrão.
              </DialogDescription>
            </div>
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
          </div>
        </DialogHeader>

        {/* Preview Container */}
        <div className="p-6 flex flex-col items-center justify-center">
          {/* Printable Label Box */}
          <div
            id="printable-etiqueta"
            ref={printContainerRef}
            className="w-full max-w-md bg-white text-black p-4 rounded-lg border-2 border-dashed border-slate-400 shadow-sm print:border-solid print:border-black print:shadow-none print:p-3 print:m-0 print:w-full print:max-w-none"
          >
            {/* Top header row */}
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Laptop className="w-4 h-4 text-black print:text-black" />
                <span className="font-extrabold text-xs tracking-tight uppercase">
                  LoteEquip · Controle de Ativos
                </span>
              </div>
              <span className="font-mono text-[11px] font-black border border-black px-1.5 py-0.2 rounded">
                {batchNum}
              </span>
            </div>

            {/* Core Label Content: QR Code Left + Info Right */}
            <div className="grid grid-cols-12 gap-3 items-center">
              {/* QR Code Container */}
              <div className="col-span-4 flex flex-col items-center justify-center p-1 bg-white border border-slate-300 rounded print:border-black">
                <QRCodeSVG value={qrValue} size={105} className="w-full h-auto aspect-square" />
                <span className="text-[9px] font-mono font-bold text-slate-600 text-center mt-1 truncate max-w-full print:text-black">
                  {sku || serial}
                </span>
              </div>

              {/* Data Specifications */}
              <div className="col-span-8 space-y-1 text-left">
                {/* Equipment Model Name */}
                <h3 className="font-bold text-sm leading-tight text-black line-clamp-2">
                  {productName}
                </h3>

                {/* Brand / Model subtitle */}
                <p className="text-[11px] text-slate-700 font-medium print:text-black">
                  {brand} {model && `· ${model}`}
                </p>

                {/* Serial / Part Number Box */}
                <div className="bg-slate-100 print:bg-slate-50 border border-slate-300 print:border-black rounded px-2 py-1 mt-1">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-slate-600 print:text-black">
                    Serial / Part Number:
                  </div>
                  <div className="font-mono text-xs font-black text-black tracking-wider break-all">
                    {serial}
                  </div>
                </div>

                {/* Specs badges (RAM / SSD / CPU) */}
                {(processor || ram || storage) && (
                  <div className="text-[10px] text-slate-800 font-mono flex flex-wrap gap-x-2 gap-y-0.5 pt-0.5 print:text-black">
                    {processor && <span>{processor}</span>}
                    {ram && <span>• {ram}</span>}
                    {storage && <span>• {storage}</span>}
                  </div>
                )}

                {/* Location and Status footer */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 print:border-black text-[10px] font-semibold text-slate-700 print:text-black">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-600 print:text-black" />
                    {location}
                  </span>
                  {price > 0 && (
                    <span className="font-mono font-bold text-black">
                      R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Micro barcode lines decoration for visual scanning standard */}
            <div className="mt-3 pt-1.5 border-t border-dashed border-slate-300 print:border-black flex items-center justify-between text-[9px] text-slate-500 font-mono print:text-black">
              <span>Rastreabilidade: {qrValue.slice(0, 32)}</span>
              <span>{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-3 text-center">
            Pressione <strong>Imprimir Etiqueta</strong> para abrir o diálogo de impressão do
            navegador. A folha ocultará menus e exibirá apenas a etiqueta.
          </p>
        </div>

        <DialogFooter className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopySerial}
              className="text-xs h-9 gap-1.5 border-slate-300 text-slate-700"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar Serial
            </Button>
            {prod?.id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  window.open(`/catalogo/${prod.sku || prod.code || prod.id}`, '_blank')
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
              Imprimir Etiqueta
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
