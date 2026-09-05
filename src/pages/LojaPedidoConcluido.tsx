import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  ShoppingBag,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  QrCode,
  Package,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PublicStoreHeader, PublicStoreFooter } from '@/components/PublicStoreLayout'
import { storeOrdersService } from '@/services/storeOrders'
import { buildGeneralWhatsAppLink } from '@/lib/storeConfig'
import type { StoreOrder } from '@/types/inventory'

export default function LojaPedidoConcluido() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order_id') || searchParams.get('external_reference') || ''
  const statusParam = searchParams.get('status') || searchParams.get('collection_status') || ''

  const [order, setOrder] = useState<StoreOrder | null>(null)
  const [loading, setLoading] = useState(Boolean(orderId))
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrder = async () => {
    if (!orderId) return
    try {
      const data = await storeOrdersService.getById(orderId)
      setOrder(data)
    } catch (err) {
      console.warn('Erro ao carregar dados do pedido de retorno:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchOrder()
  }, [orderId])

  const handleRefreshStatus = () => {
    setRefreshing(true)
    fetchOrder()
  }

  // Define se o status aponta para aprovado, pendente ou falha
  const isApproved =
    order?.status === 'aprovado' || statusParam === 'approved' || statusParam === 'success'
  const isPending =
    order?.status === 'pendente' ||
    statusParam === 'pending' ||
    statusParam === 'in_process' ||
    (!isApproved && statusParam !== 'failure' && statusParam !== 'rejected')
  const isFailure =
    order?.status === 'recusado' ||
    order?.status === 'cancelado' ||
    statusParam === 'failure' ||
    statusParam === 'rejected'

  const whatsappLink = buildGeneralWhatsAppLink(
    orderId
      ? `Acompanhamento do Pedido #${orderId.slice(-6).toUpperCase()}`
      : 'Confirmação de pedido na loja',
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <PublicStoreHeader />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
        <Card className="border-slate-200/90 rounded-2xl bg-white shadow-md overflow-hidden">
          {/* Header de Status */}
          <div
            className={`p-6 sm:p-8 text-center text-white ${
              isApproved
                ? 'bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900'
                : isPending
                  ? 'bg-gradient-to-br from-amber-950 via-amber-900 to-slate-900'
                  : 'bg-gradient-to-br from-rose-950 via-rose-900 to-slate-900'
            }`}
          >
            <div className="inline-flex p-3 rounded-full bg-white/10 backdrop-blur-xs mb-3 shadow-inner">
              {isApproved && <CheckCircle2 className="w-10 h-10 text-emerald-400" />}
              {isPending && <Clock className="w-10 h-10 text-amber-400 animate-pulse" />}
              {isFailure && <AlertCircle className="w-10 h-10 text-rose-400" />}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isApproved && 'Pagamento Confirmado com Sucesso!'}
              {isPending && 'Pedido Recebido! Aguardando Confirmação'}
              {isFailure && 'Não Foi Possível Concluir o Pagamento'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-200 mt-2 max-w-lg mx-auto">
              {isApproved &&
                'Seu pagamento foi aprovado pelo Mercado Pago. Nosso estoque foi atualizado e nossa equipe já iniciou os preparativos para o envio do seu notebook.'}
              {isPending &&
                'Recebemos sua solicitação. Se você pagou via Pix ou Boleto, a compensação pode levar alguns instantes. Assim que o Mercado Pago confirmar, o status será atualizado.'}
              {isFailure &&
                'A transação não pôde ser aprovada pelo Mercado Pago ou foi cancelada. Você pode tentar novamente com outro cartão ou falar com nossa equipe pelo WhatsApp.'}
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Bloco de Dados do Pedido */}
            {orderId && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Código do Pedido:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    #{orderId.slice(-8).toUpperCase()}
                  </span>
                </div>

                {order?.expand?.product_id && (
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-slate-500 font-medium">Equipamento:</span>
                    <span className="font-semibold text-slate-900 text-right truncate max-w-[240px]">
                      {order.expand.product_id.name}
                    </span>
                  </div>
                )}

                {order && (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500 font-medium">Comprador:</span>
                      <span className="font-semibold text-slate-800">{order.customer_name}</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500 font-medium">Valor Total:</span>
                      <span className="font-mono font-extrabold text-emerald-700 text-sm">
                        R${' '}
                        {Number(order.total_amount).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Status do Pedido:</span>
                      <Badge
                        variant="outline"
                        className={
                          order.status === 'aprovado'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                            : order.status === 'pendente'
                              ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                              : 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                        }
                      >
                        {order.status === 'aprovado' && 'Aprovado'}
                        {order.status === 'pendente' && 'Aguardando Pagamento'}
                        {order.status === 'recusado' && 'Recusado'}
                        {order.status === 'cancelado' && 'Cancelado'}
                        {order.status === 'expirado' && 'Expirado'}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Botão para atualizar status em tempo real */}
            {isPending && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshStatus}
                  disabled={refreshing}
                  className="text-xs gap-1.5 border-slate-300 text-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Verificar Atualização do Pagamento
                </Button>
              </div>
            )}

            {/* Informações de Envio e Garantia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-emerald-600" />
                  Próximos Passos
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Nossa equipe de expedição embalará o notebook com proteção reforçada e entrará em
                  contato via WhatsApp com o código de rastreamento.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Garantia de Bancada
                </div>
                <p className="text-slate-600 leading-relaxed">
                  O equipamento segue com laudo técnico dos 16 itens do checklist e garantia
                  completa de funcionamento.
                </p>
              </div>
            </div>

            {/* CTAs de Navegação e WhatsApp */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link to="/loja" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full text-xs sm:text-sm h-11 font-bold border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao Catálogo de Equipamentos
                </Button>
              </Link>

              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Falar com Vendas no WhatsApp
              </a>
            </div>
          </CardContent>
        </Card>
      </main>

      <PublicStoreFooter />
    </div>
  )
}
