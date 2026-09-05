import React, { useState, useEffect, useMemo } from 'react'
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  ExternalLink,
  CreditCard,
  QrCode,
  DollarSign,
  User,
  Phone,
  Mail,
  Package,
  Layers,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { storeOrdersService } from '@/services/storeOrders'
import type { StoreOrder, StoreOrderStatus } from '@/types/inventory'

export function StoreOrdersTab() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<StoreOrder[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modal de Detalhes e Atualização Manual
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<StoreOrderStatus | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadOrders = async () => {
    setLoading(true)
    try {
      const data = await storeOrdersService.getAll()
      setOrders(data)
    } catch (err) {
      console.error('Erro ao carregar pedidos da loja:', err)
      toast({
        title: 'Erro ao carregar pedidos',
        description: 'Não foi possível carregar os pedidos da loja pública.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !q ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q) ||
        o.mp_payment_id?.toLowerCase().includes(q) ||
        o.mp_preference_id?.toLowerCase().includes(q) ||
        o.expand?.product_id?.name?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [orders, searchTerm, statusFilter])

  // Contadores
  const counts = useMemo(() => {
    const total = orders.length
    const aprovados = orders.filter((o) => o.status === 'aprovado').length
    const pendentes = orders.filter((o) => o.status === 'pendente').length
    const totalFaturado = orders
      .filter((o) => o.status === 'aprovado')
      .reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0)
    return { total, aprovados, pendentes, totalFaturado }
  }, [orders])

  const handleUpdateStatusManual = async (status: StoreOrderStatus) => {
    if (!selectedOrder) return
    setIsSubmitting(true)
    try {
      const noteAppend = actionNotes
        ? `\n[Status manual para ${status}]: ${actionNotes}`
        : `\n[Status alterado manualmente para ${status}]`

      await storeOrdersService.updateStatus(
        selectedOrder.id,
        status,
        (selectedOrder.notes || '') + noteAppend,
      )

      toast({
        title: 'Status atualizado com sucesso!',
        description: `O pedido #${selectedOrder.id.slice(-6).toUpperCase()} agora está como ${status}.`,
      })

      setSelectedOrder(null)
      setActionNotes('')
      await loadOrders()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: err.message || 'Falha ao salvar novo status do pedido.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cards de Métricas de Pedidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total de Pedidos Loja
              </span>
              <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">
                {counts.total}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/80 bg-emerald-50/40 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Pagos / Aprovados
              </span>
              <span className="text-2xl font-extrabold text-emerald-900 mt-0.5 block">
                {counts.aprovados}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-900 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/80 bg-amber-50/40 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                Pendentes Mercado Pago
              </span>
              <span className="text-2xl font-extrabold text-amber-900 mt-0.5 block">
                {counts.pendentes}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200/80 bg-sky-50/40 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider block">
                Receita Confirmada
              </span>
              <span className="text-2xl font-extrabold text-sky-950 font-mono mt-0.5 block">
                R$ {counts.totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-200 text-sky-900 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtro e Busca */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, WhatsApp, ID Mercado Pago ou equipamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 text-xs sm:text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48 bg-slate-50 border-slate-200 text-xs font-semibold">
                  <SelectValue placeholder="Status do Pedido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="aprovado">Aprovado (Pago)</SelectItem>
                  <SelectItem value="pendente">Pendente MP</SelectItem>
                  <SelectItem value="recusado">Recusado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={loadOrders}
                disabled={loading}
                className="h-9 px-3 border-slate-200 text-slate-700 hover:bg-slate-100"
                title="Recarregar lista"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Pedidos da Loja */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Pedido / Data</th>
                <th className="py-3 px-4">Comprador</th>
                <th className="py-3 px-4">Equipamento</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Status MP</th>
                <th className="py-3 px-4 text-center">Baixa Estoque</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    Carregando pedidos da loja...
                  </td>
                </tr>
              )}

              {!loading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum pedido da loja encontrado.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredOrders.map((o) => {
                  const prod = o.expand?.product_id
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 block text-xs">
                          #{o.id.slice(-8).toUpperCase()}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(o.created).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(o.created).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 block">
                          {o.customer_name}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {o.customer_phone}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="max-w-[220px]">
                          <span className="font-medium text-slate-800 line-clamp-1">
                            {prod?.name || 'Notebook'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            SKU: {prod?.sku || prod?.code || '—'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        R${' '}
                        {Number(o.total_amount).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {o.status === 'aprovado' && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold text-[11px] gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Aprovado
                          </Badge>
                        )}
                        {o.status === 'pendente' && (
                          <Badge className="bg-amber-100 text-amber-800 border-none font-semibold text-[11px] gap-1">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            Pendente
                          </Badge>
                        )}
                        {o.status === 'recusado' && (
                          <Badge className="bg-rose-100 text-rose-800 border-none font-semibold text-[11px] gap-1">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Recusado
                          </Badge>
                        )}
                        {o.status === 'cancelado' && (
                          <Badge className="bg-slate-100 text-slate-600 border-none font-semibold text-[11px]">
                            Cancelado
                          </Badge>
                        )}
                        {o.status === 'expirado' && (
                          <Badge className="bg-slate-100 text-slate-500 border-none text-[11px]">
                            Expirado
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {o.stock_decremented ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold"
                          >
                            Baixado
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(o)
                            setActionNotes('')
                          }}
                          className="h-8 text-xs gap-1 border-slate-200 hover:bg-slate-100"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Gerenciar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* DIALOG DE GERENCIAMENTO DE PEDIDO */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center justify-between">
              <span>Pedido #{selectedOrder?.id.slice(-8).toUpperCase()}</span>
              {selectedOrder?.status === 'aprovado' && (
                <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold">
                  Aprovado
                </Badge>
              )}
              {selectedOrder?.status === 'pendente' && (
                <Badge className="bg-amber-100 text-amber-800 border-none font-semibold">
                  Pendente
                </Badge>
              )}
              {selectedOrder?.status === 'recusado' && (
                <Badge className="bg-rose-100 text-rose-800 border-none font-semibold">
                  Recusado
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Detalhes cadastrais, identificadores do Mercado Pago e atualização manual de status.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-2">
              {/* Informações do Comprador */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[10px]">
                    Comprador
                  </span>
                  <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                    {selectedOrder.customer_name}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[10px]">
                    Telefone / WhatsApp
                  </span>
                  <a
                    href={`https://wa.me/55${selectedOrder.customer_phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-semibold text-emerald-700 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {selectedOrder.customer_phone}
                  </a>
                </div>

                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[10px]">
                    E-mail
                  </span>
                  <span className="font-medium text-slate-700 mt-0.5 block truncate">
                    {selectedOrder.customer_email || 'Não informado'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[10px]">
                    CPF / CNPJ
                  </span>
                  <span className="font-mono text-slate-700 mt-0.5 block">
                    {selectedOrder.customer_document || 'Não informado'}
                  </span>
                </div>
              </div>

              {/* Informações do Produto & Valores */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    Equipamento Adquirido
                  </span>
                  <span className="font-mono text-slate-500 text-[11px]">
                    Qtd: {selectedOrder.quantity} un
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">
                      {selectedOrder.expand?.product_id?.name || 'Notebook'}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      SKU: {selectedOrder.expand?.product_id?.sku || '—'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Total
                    </span>
                    <span className="text-base font-extrabold text-emerald-700 font-mono">
                      R${' '}
                      {Number(selectedOrder.total_amount).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rastreabilidade Mercado Pago */}
              <div className="p-4 bg-sky-50/60 rounded-xl border border-sky-100 space-y-2 text-xs text-sky-950">
                <span className="font-bold uppercase text-[10px] text-sky-800 tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                  Rastreabilidade Mercado Pago
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-sky-600 block text-[10px]">Preference ID:</span>
                    <span className="truncate block">
                      {selectedOrder.mp_preference_id || 'Não registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-sky-600 block text-[10px]">Payment ID:</span>
                    <span className="truncate block font-bold text-sky-900">
                      {selectedOrder.mp_payment_id || 'Aguardando webhook'}
                    </span>
                  </div>
                </div>
                {selectedOrder.mp_init_point && (
                  <div className="pt-1">
                    <a
                      href={selectedOrder.mp_init_point}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-700 font-semibold hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Link de pagamento Checkout Pro
                    </a>
                  </div>
                )}
              </div>

              {/* Observações Internas */}
              {selectedOrder.notes && (
                <div className="text-xs space-y-1">
                  <span className="text-slate-500 font-semibold">Histórico / Notas:</span>
                  <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700 whitespace-pre-wrap font-mono text-[11px]">
                    {selectedOrder.notes}
                  </div>
                </div>
              )}

              {/* Ações Manuais (Fallback se webhook falhar) */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Atualização Manual de Status (Contingência)
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Caso o webhook do Mercado Pago não tenha recebido a confirmação em tempo real ou o
                  cliente tenha pago por outro meio, você pode aprovar, cancelar ou marcar como
                  recusado manualmente.
                </p>

                <Input
                  placeholder="Motivo da alteração manual (opcional)..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="bg-white border-amber-300 text-xs h-9"
                />

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={isSubmitting || selectedOrder.status === 'aprovado'}
                    onClick={() => handleUpdateStatusManual('aprovado')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Forçar Aprovação
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSubmitting || selectedOrder.status === 'recusado'}
                    onClick={() => handleUpdateStatusManual('recusado')}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs h-8 gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Marcar como Recusado
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSubmitting || selectedOrder.status === 'cancelado'}
                    onClick={() => handleUpdateStatusManual('cancelado')}
                    className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-8"
                  >
                    Cancelar Pedido
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrder(null)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
