import React, { useState } from 'react'
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight,
  MessageSquare,
  Package,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { storeOrdersService, mercadoPagoService } from '@/services/storeOrders'
import { buildWhatsAppLink } from '@/lib/storeConfig'
import type { Product } from '@/types/inventory'

interface CheckoutModalProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (orderId: string) => void
}

export function StoreCheckoutModal({ product, open, onOpenChange }: CheckoutModalProps) {
  const { toast } = useToast()

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerDocument, setCustomerDocument] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fallbackWhatsApp, setFallbackWhatsApp] = useState(false)

  if (!product) return null

  const unitPrice = Number(product.unit_price) || 0

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 11) val = val.slice(0, 11)
    if (val.length > 6) {
      val = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`
    } else if (val.length > 2) {
      val = `(${val.slice(0, 2)}) ${val.slice(2)}`
    }
    setCustomerPhone(val)
  }

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 14) val = val.slice(0, 14)
    if (val.length <= 11) {
      // CPF
      if (val.length > 9)
        val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6, 9)}-${val.slice(9)}`
      else if (val.length > 6) val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6)}`
      else if (val.length > 3) val = `${val.slice(0, 3)}.${val.slice(3)}`
    } else {
      // CNPJ
      val = `${val.slice(0, 2)}.${val.slice(2, 5)}.${val.slice(5, 8)}/${val.slice(8, 12)}-${val.slice(12)}`
    }
    setCustomerDocument(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setFallbackWhatsApp(false)

    if (!customerName.trim()) {
      setErrorMsg('Por favor, informe seu nome completo.')
      return
    }

    const cleanPhone = customerPhone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      setErrorMsg('Por favor, informe um telefone/WhatsApp válido com DDD.')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Criar o pedido na coleção store_orders com status pendente
      const order = await storeOrdersService.create({
        product_id: product.id,
        quantity: 1,
        unit_price: unitPrice,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_document: customerDocument,
        origin: 'loja',
        notes: `Compra iniciada via Checkout Pro - Produto: ${product.name} (SKU: ${product.sku || product.code})`,
      })

      // 2. Chamar o endpoint que cria a preferência no Mercado Pago
      const prefResult = await mercadoPagoService.createPreference(order.id, window.location.origin)

      if (prefResult.ok && prefResult.init_point) {
        toast({
          title: 'Pedido iniciado!',
          description: 'Redirecionando com segurança para o Mercado Pago...',
        })

        // Redireciona o comprador para o checkout seguro do Mercado Pago
        window.location.href = prefResult.init_point
      } else {
        // Modo degradado / erro na criação de preferência do MP
        setErrorMsg(
          prefResult.error ||
            'Não foi possível iniciar o checkout online no momento. Você pode finalizar este pedido diretamente com nosso consultor via WhatsApp.',
        )
        setFallbackWhatsApp(true)
      }
    } catch (err: any) {
      console.error('Erro ao processar checkout:', err)
      setErrorMsg(
        'Ocorreu uma instabilidade ao conectar com o meio de pagamento. Use o botão abaixo para negociar via WhatsApp.',
      )
      setFallbackWhatsApp(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const whatsappFallbackUrl = buildWhatsAppLink({
    name: product.name,
    brand: product.brand,
    model: product.model,
    sku: product.sku,
    serial_number: product.serial_number,
    unit_price: unitPrice,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-slate-200 bg-white">
        {/* Header com destaque esmeralda / Mercado Pago */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Checkout Pro Mercado Pago
            </span>
            <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
              <Lock className="w-3 h-3 text-emerald-400" />
              Ambiente Seguro
            </div>
          </div>

          <DialogTitle className="text-xl font-extrabold text-white">
            Finalizar Compra Online
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300 mt-1">
            Pague via <strong>Pix com aprovação imediata</strong>, Cartão de Crédito parcelado ou
            Boleto.
          </DialogDescription>
        </div>

        {/* Resumo do Produto */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 block truncate">{product.name}</span>
              <span className="text-slate-500 font-mono text-[11px]">
                SKU: {product.serial_number || product.sku}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
            <span className="text-base font-extrabold text-emerald-700 font-mono">
              R$ {unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Formulário de Identificação do Comprador */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cust_name" className="text-xs font-bold text-slate-700">
              Nome Completo *
            </Label>
            <Input
              id="cust_name"
              required
              placeholder="Ex: Carlos Eduardo Silva"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="text-xs sm:text-sm h-10 bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust_phone" className="text-xs font-bold text-slate-700">
                WhatsApp / Telefone *
              </Label>
              <Input
                id="cust_phone"
                required
                type="tel"
                placeholder="(31) 99999-9999"
                value={customerPhone}
                onChange={handlePhoneChange}
                className="text-xs sm:text-sm h-10 bg-slate-50 border-slate-200 focus:bg-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust_email" className="text-xs font-bold text-slate-700">
                E-mail para Recibo
              </Label>
              <Input
                id="cust_email"
                type="email"
                placeholder="seu@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="text-xs sm:text-sm h-10 bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust_doc" className="text-xs font-bold text-slate-700">
              CPF ou CNPJ (Opcional — agiliza NF-e)
            </Label>
            <Input
              id="cust_doc"
              placeholder="000.000.000-00"
              value={customerDocument}
              onChange={handleDocumentChange}
              className="text-xs sm:text-sm h-10 bg-slate-50 border-slate-200 focus:bg-white font-mono"
            />
          </div>

          {/* Badges de Formas de Pagamento do Mercado Pago */}
          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100 flex items-center justify-between text-xs text-sky-950">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-sky-700" />
              <span className="font-semibold">Pix, Cartões e Boleto pelo Mercado Pago</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <CreditCard className="w-4 h-4 text-slate-700" />
            </div>
          </div>

          {/* Alerta de Erro ou Fallback */}
          {errorMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {fallbackWhatsApp && (
                <a
                  href={whatsappFallbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  Finalizar Pedido com Atendente no WhatsApp
                </a>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="pt-2 space-y-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm rounded-xl shadow-md gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando checkout no Mercado Pago...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Prosseguir para Pagamento Mercado Pago
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            <p className="text-[11px] text-center text-slate-400">
              🔒 Você será redirecionado para o ambiente protegido do Mercado Pago para escolher
              Pix, Cartão ou Boleto.
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
