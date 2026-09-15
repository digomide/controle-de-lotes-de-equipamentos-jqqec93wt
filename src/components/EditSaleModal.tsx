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
import { useToast } from '@/hooks/use-toast'
import { salesService } from '@/services/sales'
import { Edit, User, Phone, FileText, Loader2, AlertCircle, Info } from 'lucide-react'
import type { Sale } from '@/types/inventory'

interface EditSaleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
  onSuccess?: () => void
}

export function EditSaleModal({ open, onOpenChange, sale, onSuccess }: EditSaleModalProps) {
  const { toast } = useToast()
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'draft' | 'completed' | 'cancelled'>('completed')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && sale) {
      setCustomerName(sale.customer_name || '')
      setCustomerContact(sale.customer_contact || '')
      setNotes(sale.notes || '')
      setStatus(sale.status || 'completed')
    }
  }, [open, sale])

  if (!sale) return null

  const isCancelled = sale.status === 'cancelled'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerName.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'O nome do cliente não pode ficar em branco.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await salesService.updateSale(sale.id, {
        customer_name: customerName,
        customer_contact: customerContact,
        notes,
        status,
      })

      toast({
        title: 'Venda atualizada com sucesso',
        description: `Os dados da venda #${sale.id.slice(0, 6)} foram salvos.`,
      })

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao atualizar venda',
        description: err?.message || 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-6 font-sans">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Editar Venda Interna
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-mono">
                Identificador: #{sale.id} • Criada em{' '}
                {new Date(sale.created).toLocaleDateString('pt-BR')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Informação sobre integridade do estoque */}
          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Regra de Segurança de Estoque:</p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Para evitar corrupção no saldo dos lotes e manter a rastreabilidade fiscal, a
                alteração dos equipamentos/lotes faturados só pode ser feita cancelando a venda (que
                devolve o estoque aos lotes) e criando uma nova.
              </p>
            </div>
          </div>

          {/* Nome do Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-customer-name" className="text-xs font-semibold text-slate-700">
              Nome do Cliente / Empresa *
            </Label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                id="edit-customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: Empresa Exemplo Ltda"
                className="pl-9 text-sm"
                required
              />
            </div>
          </div>

          {/* Contato do Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-customer-contact" className="text-xs font-semibold text-slate-700">
              Contato (Telefone / WhatsApp / E-mail)
            </Label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                id="edit-customer-contact"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                placeholder="Ex: (11) 98765-4321 - contato@cliente.com"
                className="pl-9 text-sm"
              />
            </div>
          </div>

          {/* Status da Venda */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Status da Venda</Label>
            <Select
              value={status}
              onValueChange={(val: any) => setStatus(val)}
              disabled={isCancelled}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Concluída (Completo — Estoque baixado)</SelectItem>
                <SelectItem value="draft">Pendente (Rascunho)</SelectItem>
                {isCancelled && <SelectItem value="cancelled">Cancelada</SelectItem>}
              </SelectContent>
            </Select>
            {isCancelled && (
              <p className="text-[11px] text-slate-500">
                Uma venda cancelada não pode ter o status reativado por aqui (o estoque já foi
                devolvido).
              </p>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes" className="text-xs font-semibold text-slate-700">
              Observações / Instruções Fiscais e de Entrega
            </Label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione observações da venda..."
                className="pl-9 min-h-[90px] text-xs"
              />
            </div>
          </div>

          {/* Card com resumo financeiro não editável diretamente para segurança */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
            <span className="text-slate-500">Valor Total Vinculado aos Lotes:</span>
            <span className="font-bold font-mono text-slate-900 text-sm">
              R${' '}
              {Number(sale.total_amount).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Salvando alterações...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
