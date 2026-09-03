import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Edit3, DollarSign, Layers } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { purchaseBatchesService } from '@/services/purchaseBatches'
import type { PurchaseBatch } from '@/types/inventory'

interface EditBatchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  batch: PurchaseBatch | null
  onSuccess?: () => void
}

export function EditBatchModal({ open, onOpenChange, batch, onSuccess }: EditBatchModalProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [supplier, setSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [totalCost, setTotalCost] = useState<number>(0)
  const [expectedQuantity, setExpectedQuantity] = useState<number>(1)
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<'em_processamento' | 'concluido'>('em_processamento')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (batch && open) {
      setSupplier(batch.supplier || '')
      setInvoiceNumber(batch.invoice_number || '')
      setPurchaseDate(batch.purchase_date ? batch.purchase_date.split('T')[0] : '')
      setTotalCost(Number(batch.total_cost) || 0)
      setExpectedQuantity(Number(batch.expected_quantity) || 1)
      setLocation(batch.location || '')
      setStatus(batch.status || 'em_processamento')
      setNotes(batch.notes || '')
    }
  }, [batch, open])

  // Calculated preview KPI
  const calculatedCostPerItem = expectedQuantity > 0 ? totalCost / expectedQuantity : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batch) return

    if (!supplier.trim()) {
      toast({
        title: 'Fornecedor obrigatório',
        description: 'Por favor, informe o fornecedor do lote.',
        variant: 'destructive',
      })
      return
    }

    if (expectedQuantity <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'A quantidade total esperada deve ser pelo menos 1.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await purchaseBatchesService.update(batch.id, {
        supplier: supplier.trim(),
        invoice_number: invoiceNumber.trim() || undefined,
        purchase_date: purchaseDate ? new Date(purchaseDate).toISOString() : undefined,
        total_cost: Number(totalCost) || 0,
        expected_quantity: Number(expectedQuantity) || 1,
        location: location.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
      })

      toast({
        title: 'Lote atualizado com sucesso!',
        description: 'Os dados e os KPIs financeiros foram recalculados.',
      })
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao atualizar lote',
        description: err?.message || 'Falha ao salvar as alterações do lote.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto font-sans">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#d9532f]" />
            Editar Lote de Entrada
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Corrija ou atualize todas as informações cadastrais e financeiras do lote. Os KPIs serão
            recalculados na hora.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Fornecedor */}
          <div>
            <Label className="text-xs font-semibold text-slate-700">Fornecedor *</Label>
            <Input
              required
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Ex.: Dell Brasil Indústria Ltda, Mercado Livre, Leilão SP"
              className="mt-1 text-sm"
            />
          </div>

          {/* Nota Fiscal e Data da Compra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Nota Fiscal / Identificador *
              </Label>
              <Input
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ex.: 310826 ou BHR3302"
                className="mt-1 text-sm font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Data da Compra *</Label>
              <Input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>
          </div>

          {/* Custo Total e Quantidade Total Esperada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Custo Total de Aquisição (R$) *
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={totalCost}
                onChange={(e) => setTotalCost(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="mt-1 text-sm font-semibold"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Quantidade Total Esperada *
              </Label>
              <Input
                type="number"
                min="1"
                step="1"
                required
                value={expectedQuantity}
                onChange={(e) => setExpectedQuantity(parseInt(e.target.value) || 1)}
                placeholder="Ex.: 17"
                className="mt-1 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Preview Dinâmico de Custo Médio Unitário */}
          <div className="bg-[#f5ede4]/70 border border-[#edd5c3] rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#d9532f]" />
              <span className="text-slate-600 font-medium">
                Novo Custo-Base por Item projetado:
              </span>
            </div>
            <span className="font-extrabold text-[#d9532f] text-sm">
              {calculatedCostPerItem.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </span>
          </div>

          {/* Localização e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Localização Física / Armazém
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex.: Prateleira A-1, Gaveta B3, Depósito Central"
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Status do Lote *</Label>
              <Select
                value={status}
                onValueChange={(val: 'em_processamento' | 'concluido') => setStatus(val)}
              >
                <SelectTrigger className="mt-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_processamento">Em processamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações / Notas */}
          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Observações / Notas do Lote
            </Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações gerais sobre o lote, estado de conservação na chegada, observações fiscais, etc."
              className="mt-1 text-sm"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#d9532f] hover:bg-[#c24624] text-white font-semibold shadow-sm"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando Alterações...
                </>
              ) : (
                'Salvar Alterações do Lote'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
