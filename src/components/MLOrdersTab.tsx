import React, { useState, useEffect, useMemo } from 'react'
import {
  ShoppingBag,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  DollarSign,
  TrendingUp,
  Package,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  ArrowUpRight,
  User,
  MapPin,
  Calendar,
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { mlOrdersService, type MLOrder, type MLOrderKPIs } from '@/services/mlOrdersService'

export function MLOrdersTab() {
  const { toast } = useToast()

  const [orders, setOrders] = useState<MLOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [shippingFilter, setShippingFilter] = useState('all')

  // Modal de Detalhes do Pedido
  const [selectedOrder, setSelectedOrder] = useState<MLOrder | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { items } = await mlOrdersService.getOrders({
        page: 1,
        perPage: 200,
      })
      setOrders(items)
    } catch (err: any) {
      console.error('Erro ao carregar pedidos:', err)
      toast({
        title: 'Falha ao carregar pedidos',
        description: err.message || 'Não foi possível ler ml_orders.',
        variant: 'destructive',
      })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  // Sincronização manual com a API oficial do Mercado Livre
  const handleSyncOrders = async () => {
    setSyncing(true)
    setSyncProgress('Iniciando sincronização de pedidos...')
    try {
      const res = await mlOrdersService.syncOrders({
        daysBack: 60,
        onProgress: (p) => setSyncProgress(p),
      })
      toast({
        title: 'Pedidos sincronizados!',
        description: `${res.ordersSaved} pedido(s) processado(s) com sucesso.`,
      })
      await loadOrders(true)
    } catch (err: any) {
      console.error('Erro ao sincronizar pedidos:', err)
      toast({
        title: 'Erro na sincronização',
        description: err.message || 'Falha ao buscar pedidos da API oficial do Mercado Livre.',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
      setSyncProgress('')
    }
  }

  // KPIs consolidados
  const kpis: MLOrderKPIs = useMemo(() => {
    return mlOrdersService.calculateKPIs(orders)
  }, [orders])

  // Filtragem da lista
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (shippingFilter !== 'all' && o.shipping_status !== shippingFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesId = o.order_id?.toLowerCase().includes(q)
        const matchesBuyerNick = o.buyer_nickname?.toLowerCase().includes(q)
        const matchesBuyerName = o.buyer_name?.toLowerCase().includes(q)
        const matchesItemTitle = o.items?.some((it) => it.title?.toLowerCase().includes(q))
        if (!matchesId && !matchesBuyerNick && !matchesBuyerName && !matchesItemTitle) {
          return false
        }
      }
      return true
    })
  }, [orders, search, statusFilter, shippingFilter])

  // Badge de Status do Pedido
  const renderOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-[11px] gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Pago
          </Badge>
        )
      case 'confirmed':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold text-[11px] gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Confirmado
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold text-[11px] gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Cancelado
          </Badge>
        )
      case 'payment_required':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-[11px] gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            Aguardando Pagamento
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-slate-600 text-[11px]">
            {status}
          </Badge>
        )
    }
  }

  // Badge de Envio / Shipping
  const renderShippingStatusBadge = (shippingStatus: string) => {
    switch (shippingStatus) {
      case 'delivered':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium text-[11px] gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Entregue
          </Badge>
        )
      case 'shipped':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-300 font-medium text-[11px] gap-1">
            <Truck className="w-3 h-3 text-blue-600" />
            Em Trânsito
          </Badge>
        )
      case 'ready_to_ship':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-semibold text-[11px] gap-1">
            <Package className="w-3 h-3 text-amber-600" />
            Pronto para Envio
          </Badge>
        )
      case 'pending':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[11px] gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            Envio Pendente
          </Badge>
        )
      case 'to_be_agreed':
        return (
          <Badge variant="outline" className="text-slate-600 text-[11px]">
            A Combinar
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[11px]">
            Envio Cancelado
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-slate-500 text-[11px]">
            {shippingStatus || 'Sem dados'}
          </Badge>
        )
    }
  }

  const formatCurrency = (val: number, currency = 'BRL') => {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    })
  }

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-'
    const d = new Date(isoStr)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Barra de Ação & Sincronização */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ffe600] border border-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Painel de Vendas & Pedidos ML
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-semibold"
              >
                API Oficial
              </Badge>
            </h2>
            <p className="text-xs text-slate-600">
              Pedidos reais faturados na conta Mercado Livre. Histórico persistido localmente e
              atualizável sob demanda.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            onClick={handleSyncOrders}
            disabled={syncing || loading}
            className="text-xs h-9 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando ML...' : 'Sincronizar Pedidos'}
          </Button>
        </div>
      </div>

      {/* Alerta de progresso de sincronização em tempo real */}
      {syncing && (
        <Card className="border-amber-300 bg-amber-50/70 shadow-xs animate-pulse">
          <CardContent className="p-3.5 flex items-center gap-3 text-xs text-amber-950">
            <RefreshCw className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
            <span className="font-semibold">
              {syncProgress || 'Processando pedidos no servidor...'}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Grade de KPIs de Faturamento e Volume */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Faturamento Hoje */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" /> Faturamento Hoje
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {formatCurrency(kpis.faturamentoHoje)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              <strong>{kpis.pedidosHoje}</strong> pedido(s) hoje
            </span>
          </CardContent>
        </Card>

        {/* Faturamento 7 Dias */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-blue-600 font-bold block flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-blue-500" /> Últimos 7 Dias
            </span>
            <span className="text-2xl font-black text-blue-700 mt-1 block font-mono">
              {formatCurrency(kpis.faturamento7dias)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              <strong>{kpis.pedidos7dias}</strong> pedidos no período
            </span>
          </CardContent>
        </Card>

        {/* Faturamento 30 Dias */}
        <Card className="border-emerald-200 bg-emerald-50/30 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold block flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-600" /> Últimos 30 Dias
            </span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block font-mono">
              {formatCurrency(kpis.faturamento30dias)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              <strong>{kpis.pedidos30dias}</strong> pedidos faturados
            </span>
          </CardContent>
        </Card>

        {/* Ticket Médio & Entregas */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-amber-700 font-bold block flex items-center gap-1">
              <Package className="w-3 h-3 text-amber-600" /> Ticket Médio (30d)
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {formatCurrency(kpis.ticketMedio30dias)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Prontos p/ envio:{' '}
              <strong className="text-amber-700">{kpis.pedidosProntosEnvio}</strong> · Entregues:{' '}
              <strong className="text-emerald-700">{kpis.pedidosEntregues30dias}</strong>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Filtros da Tabela de Pedidos */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por ID do pedido, comprador (nickname/nome) ou título do item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-xs h-9 w-[150px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Status Pedido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                  <SelectItem value="confirmed">Confirmados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                  <SelectItem value="payment_required">Aguardando Pagamento</SelectItem>
                </SelectContent>
              </Select>

              <Select value={shippingFilter} onValueChange={setShippingFilter}>
                <SelectTrigger className="text-xs h-9 w-[160px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Status Envio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os envios</SelectItem>
                  <SelectItem value="ready_to_ship">Pronto para Envio</SelectItem>
                  <SelectItem value="shipped">Em Trânsito</SelectItem>
                  <SelectItem value="delivered">Entregues</SelectItem>
                  <SelectItem value="pending">Envio Pendente</SelectItem>
                  <SelectItem value="to_be_agreed">A Combinar</SelectItem>
                </SelectContent>
              </Select>

              {(search || statusFilter !== 'all' || shippingFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('all')
                    setShippingFilter('all')
                  }}
                  className="text-xs h-9 text-slate-600 hover:text-slate-900"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500" />
          <p className="text-sm font-semibold text-slate-700">
            Carregando pedidos do Mercado Livre...
          </p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
          <CardContent className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Nenhum pedido encontrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {orders.length === 0
                ? 'Nenhum pedido sincronizado ainda. Clique em "Sincronizar Pedidos" acima para puxar o histórico recente da conta ML.'
                : 'Nenhum pedido corresponde aos filtros aplicados.'}
            </p>
            {orders.length === 0 && (
              <Button
                size="sm"
                onClick={handleSyncOrders}
                disabled={syncing}
                className="mt-2 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Sincronizar Agora
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">Pedido</th>
                  <th className="py-3 px-4 font-bold">Data</th>
                  <th className="py-3 px-4 font-bold">Comprador</th>
                  <th className="py-3 px-4 font-bold">Itens</th>
                  <th className="py-3 px-4 font-bold">Total</th>
                  <th className="py-3 px-4 font-bold">Status Pedido</th>
                  <th className="py-3 px-4 font-bold">Status Envio</th>
                  <th className="py-3 px-4 font-bold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const firstItem = order.items?.[0]
                  const itemsCount =
                    order.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 1

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <span>#{order.order_id}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(order.date_created)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div className="truncate max-w-[150px]">
                            <p className="font-semibold text-slate-800 truncate">
                              {order.buyer_nickname || order.buyer_name || 'Comprador ML'}
                            </p>
                            {order.buyer_name && order.buyer_nickname && (
                              <p className="text-[10px] text-slate-400 truncate">
                                {order.buyer_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="max-w-[260px]">
                          <p
                            className="truncate font-medium text-slate-800"
                            title={firstItem?.title || ''}
                          >
                            {firstItem?.title || 'Item sem título'}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {itemsCount} {itemsCount > 1 ? 'itens no pedido' : 'unidade'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(order.total_amount, order.currency_id)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderOrderStatusBadge(order.status)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderShippingStatusBadge(order.shipping_status)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order)
                            setDetailOpen(true)
                          }}
                          className="text-xs h-7 px-2 text-blue-700 hover:text-blue-900 hover:bg-blue-50 font-semibold"
                        >
                          Ver Detalhes
                          <ChevronRight className="w-3 h-3 ml-0.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detalhes do Pedido */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>Pedido #{selectedOrder.order_id}</span>
                      {renderOrderStatusBadge(selectedOrder.status)}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 mt-0.5">
                      Criado em {formatDate(selectedOrder.date_created)}
                    </DialogDescription>
                  </div>
                  <span className="text-lg font-black font-mono text-slate-900">
                    {formatCurrency(selectedOrder.total_amount, selectedOrder.currency_id)}
                  </span>
                </div>
              </DialogHeader>

              {/* Comprador & Envio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-slate-500">
                    <User className="w-3.5 h-3.5 text-slate-500" /> Dados do Comprador
                  </h4>
                  <p className="font-semibold text-slate-900">
                    {selectedOrder.buyer_name ||
                      selectedOrder.buyer_nickname ||
                      'Comprador não informado'}
                  </p>
                  <p className="text-slate-500 font-mono text-[11px]">
                    Usuário: {selectedOrder.buyer_nickname || '-'} (ID:{' '}
                    {selectedOrder.buyer_id || '-'})
                  </p>
                  {selectedOrder.buyer_document && (
                    <p className="text-slate-500 font-mono text-[11px]">
                      CPF/CNPJ: {selectedOrder.buyer_document}
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-slate-500">
                    <Truck className="w-3.5 h-3.5 text-slate-500" /> Logística & Envio
                  </h4>
                  <div className="flex items-center gap-2">
                    {renderShippingStatusBadge(selectedOrder.shipping_status)}
                    {selectedOrder.shipping_mode && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Modo: {selectedOrder.shipping_mode}
                      </Badge>
                    )}
                  </div>
                  {selectedOrder.shipping_id && (
                    <p className="text-slate-500 font-mono text-[11px]">
                      ID de Envio: {selectedOrder.shipping_id}
                    </p>
                  )}
                  {selectedOrder.receiver_address && (
                    <p className="text-slate-600 text-[11px] flex items-start gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        {[
                          selectedOrder.receiver_address.street_name,
                          selectedOrder.receiver_address.street_number,
                          selectedOrder.receiver_address.city?.name,
                          selectedOrder.receiver_address.state?.name,
                          selectedOrder.receiver_address.zip_code,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Itens do Pedido */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  Itens Comprados ({selectedOrder.items?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                  {selectedOrder.items?.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between gap-3 text-xs bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate" title={it.title}>
                          {it.title}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>MLB: {it.item_id}</span>
                          {it.seller_sku && <span>SKU: {it.seller_sku}</span>}
                          <span>Qtd: {it.quantity}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-slate-900 block">
                          {formatCurrency(it.unit_price * (it.quantity || 1), it.currency_id)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatCurrency(it.unit_price, it.currency_id)} / un
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagamentos */}
              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-500">
                    Detalhes do Pagamento
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
                    {selectedOrder.payments.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-slate-700 font-mono"
                      >
                        <span>
                          Método:{' '}
                          <strong>{p.payment_method_id || p.payment_type || 'Mercado Pago'}</strong>{' '}
                          ({p.status})
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(p.transaction_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
