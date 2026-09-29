import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
import { useToast } from '@/hooks/use-toast'
import { magaluService, MagaluOrder } from '@/services/magaluService'
import {
  ShoppingBag,
  RefreshCw,
  Search,
  ExternalLink,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  DollarSign,
  User,
} from 'lucide-react'

export function MagaluOrdersTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [orders, setOrders] = useState<MagaluOrder[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await magaluService.getLocalOrders({
        status: statusFilter,
        search,
      })
      setOrders(res.items)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar pedidos Magalu',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadOrders()
  }

  const handleSyncOrders = async () => {
    setSyncing(true)
    setProgressText('Conectando ao Magalu...')
    try {
      const res = await magaluService.syncOrders({
        daysBack: 30,
        onProgress: (msg) => setProgressText(msg),
      })

      if (res.error) {
        toast({
          title: 'Aviso sobre Pedidos Magalu',
          description: res.error,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Pedidos Sincronizados!',
          description: `${res.saved} pedido(s) foram atualizados ou baixados da Open API Magalu.`,
        })
      }
      await loadOrders()
    } catch (err: unknown) {
      toast({
        title: 'Erro na sincronização',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
      setProgressText('')
    }
  }

  // Estatísticas de pedidos
  const stats = useMemo(() => {
    const total = orders.length
    const totalAmount = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0)
    const pending = orders.filter((o) => o.status === 'pending' || o.status === 'created').length
    const approved = orders.filter((o) => o.status === 'approved' || o.status === 'paid').length
    const shipped = orders.filter(
      (o) => o.status === 'shipped' || o.shipping_status === 'shipped',
    ).length
    const delivered = orders.filter((o) => o.status === 'delivered').length
    return { total, totalAmount, pending, approved, shipped, delivered }
  }, [orders])

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'paid':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Aprovado / Pago
          </Badge>
        )
      case 'shipped':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] flex items-center gap-1">
            <Truck className="w-3 h-3" /> Enviado
          </Badge>
        )
      case 'delivered':
        return (
          <Badge className="bg-slate-700 hover:bg-slate-700 text-white text-[10px] flex items-center gap-1">
            <Package className="w-3 h-3" /> Entregue
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="outline" className="text-rose-600 border-rose-200 text-[10px]">
            Cancelado
          </Badge>
        )
      default:
        return (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] flex items-center gap-1">
            <Clock className="w-3 h-3" /> {status}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Contadores */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Total de Pedidos
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {stats.total}
            </span>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold block flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Faturamento Total
            </span>
            <span className="text-xl font-black text-emerald-700 mt-1 block font-mono">
              R${' '}
              {stats.totalAmount.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-amber-700 font-bold block flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Pendentes / Novos
            </span>
            <span className="text-2xl font-black text-amber-700 mt-1 block font-mono">
              {stats.pending}
            </span>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/30 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-blue-700 font-bold block flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" /> Enviados
            </span>
            <span className="text-2xl font-black text-blue-700 mt-1 block font-mono">
              {stats.shipped}
            </span>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-600 font-bold block flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> Entregues
            </span>
            <span className="text-2xl font-black text-slate-800 mt-1 block font-mono">
              {stats.delivered}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros & Sincronização */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por ID do pedido, código ou nome do comprador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-xs h-9 w-[150px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="shipped">Enviados</SelectItem>
                  <SelectItem value="delivered">Entregues</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSyncOrders}
                disabled={syncing}
                className="text-xs h-9 font-medium border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Pedidos Magalu'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Conteúdo: Lista de Pedidos */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-700">
            {progressText || 'Carregando pedidos Magalu...'}
          </p>
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
          <CardContent className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Nenhum pedido Magalu registrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Clique em &quot;Sincronizar Pedidos Magalu&quot; para buscar as vendas mais recentes
              realizadas no marketplace.
            </p>
            <Button variant="outline" size="sm" onClick={handleSyncOrders} className="text-xs h-8">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Buscar Vendas do Magalu
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-3">Pedido Magalu</th>
                  <th className="py-3 px-3">Data da Compra</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Itens / SKUs</th>
                  <th className="py-3 px-3">Total</th>
                  <th className="py-3 px-3">Status do Pedido</th>
                  <th className="py-3 px-3">Entrega / Envio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Código do Pedido */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-blue-700 text-xs">
                          {order.order_code || order.order_id}
                        </span>
                        {order.order_id !== order.order_code && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            ID: {order.order_id}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Data */}
                    <td className="py-3 px-3 text-slate-600">
                      {order.date_created ? (
                        <div>
                          <span className="font-medium text-slate-900 block">
                            {new Date(order.date_created).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(order.date_created).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Cliente */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-slate-900 truncate block">
                            {order.buyer_name || 'Cliente Magalu'}
                          </span>
                          {order.buyer_document && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {order.buyer_document}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Itens */}
                    <td className="py-3 px-3">
                      {order.items && order.items.length > 0 ? (
                        <div className="space-y-1">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-[11px]">
                              <span className="font-bold text-slate-700">{it.quantity}x</span>
                              <span className="text-slate-600 truncate max-w-xs">{it.name}</span>
                              <span className="font-mono text-[10px] text-blue-600">
                                ({it.sku})
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Total */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 text-sm">
                      R${' '}
                      {order.total_amount
                        ? order.total_amount.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '0,00'}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">{getStatusBadge(order.status)}</td>

                    {/* Envio */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-slate-700 text-xs">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{order.carrier_name || 'Magalu Entregas'}</span>
                        </div>
                        {order.tracking_url && (
                          <a
                            href={order.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                          >
                            Rastreamento <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
