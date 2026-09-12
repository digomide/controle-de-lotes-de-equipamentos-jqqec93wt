import React, { useState, useEffect, useMemo } from 'react'
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Truck,
  FileText,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Package,
  Calendar,
  Hourglass,
  ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  mlOrdersService,
  type MLOrder,
  type MLReputationRisk,
  type MLDeadlinesKPIs,
} from '@/services/mlOrdersService'

export function MLDeadlinesTab() {
  const { toast } = useToast()

  const [orders, setOrders] = useState<MLOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<
    'pending_scan' | 'invoice_pending' | 'shipped' | 'all'
  >('pending_scan')

  // Relógio ao vivo atualizado a cada minuto
  const [currentTime, setCurrentTime] = useState<number>(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 30000) // a cada 30 segundos para contagem precisa
    return () => clearInterval(timer)
  }, [])

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { items } = await mlOrdersService.getOrders({
        page: 1,
        perPage: 250,
      })
      setOrders(items)
    } catch (err: any) {
      console.error('Erro ao buscar pedidos para prazos:', err)
      toast({
        title: 'Erro ao carregar envios',
        description: err.message || 'Falha ao buscar dados de envios.',
        variant: 'destructive',
      })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncProgress('Revalidando status e limites de envio com a API do Mercado Livre...')
    try {
      const res = await mlOrdersService.syncOrders({
        daysBack: 180,
        onProgress: (p) => setSyncProgress(p),
      })
      toast({
        title: 'Envios sincronizados!',
        description: `${res.ordersSaved} pedido(s) atualizados com sucesso da API oficial.`,
      })
      await loadOrders(true)
    } catch (err: any) {
      console.error('Erro na sincronização de envios:', err)
      toast({
        title: 'Falha na sincronização',
        description: err.message || 'Erro ao sincronizar com a API do ML.',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
      setSyncProgress('')
    }
  }

  // KPIs e Reputação
  const reputation: MLReputationRisk = useMemo(() => {
    return mlOrdersService.calculateReputationRisk(orders)
  }, [orders])

  const kpis: MLDeadlinesKPIs = useMemo(() => {
    return mlOrdersService.calculateDeadlinesKPIs(orders)
  }, [orders])

  // Pedidos com Nota Fiscal Pendente (shipping_substatus: 'invoice_pending')
  const invoicePendingOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === 'cancelled') return false
      const sub = (o.shipping_substatus || '').toLowerCase()
      return sub === 'invoice_pending'
    })
  }, [orders])

  // Pedidos A Bipar (Pendentes de despacho)
  const pendingScanOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (o.status === 'cancelled') return false
        const effShip = (o.shipping_status || '').toLowerCase()
        const sub = (o.shipping_substatus || '').toLowerCase()
        if (sub === 'invoice_pending') return false

        const isShipped = effShip === 'shipped' || effShip === 'delivered'
        if (isShipped) return false

        return (
          effShip === 'ready_to_ship' ||
          effShip === 'pending' ||
          sub === 'in_hub' ||
          sub === 'in_packing_list' ||
          sub === 'buffered'
        )
      })
      .sort((a, b) => {
        // Ordenar pelo horário-limite mais próximo (shipping_handling_limit)
        const timeA = a.shipping_handling_limit
          ? new Date(a.shipping_handling_limit).getTime()
          : Infinity
        const timeB = b.shipping_handling_limit
          ? new Date(b.shipping_handling_limit).getTime()
          : Infinity
        return timeA - timeB
      })
  }, [orders])

  // Pedidos já despachados/bipados
  const shippedOrders = useMemo(() => {
    return orders.filter((o) => {
      const effShip = (o.shipping_status || '').toLowerCase()
      return effShip === 'shipped' || effShip === 'delivered'
    })
  }, [orders])

  // Filtragem e busca para a exibição na tabela
  const displayedOrders = useMemo(() => {
    let list: MLOrder[] = []

    if (activeFilter === 'pending_scan') {
      list = pendingScanOrders
    } else if (activeFilter === 'invoice_pending') {
      list = invoicePendingOrders
    } else if (activeFilter === 'shipped') {
      list = shippedOrders
    } else {
      list = orders.filter((o) => o.status !== 'cancelled')
    }

    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((o) => {
      const matchesId = o.order_id?.toLowerCase().includes(q)
      const matchesNick = o.buyer_nickname?.toLowerCase().includes(q)
      const matchesName = o.buyer_name?.toLowerCase().includes(q)
      const matchesItem = o.items?.some((it) => it.title?.toLowerCase().includes(q))
      const matchesShipId = o.shipping_id?.toLowerCase().includes(q)
      return matchesId || matchesNick || matchesName || matchesItem || matchesShipId
    })
  }, [orders, activeFilter, pendingScanOrders, invoicePendingOrders, shippedOrders, search])

  // Formatação fuso horário de São Paulo (America/Sao_Paulo)
  const formatTimeSP = (isoStr?: string | null) => {
    if (!isoStr) return '-'
    const d = new Date(isoStr)
    return d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateTimeSP = (isoStr?: string | null) => {
    if (!isoStr) return '-'
    const d = new Date(isoStr)
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Semáforo e Contagem Regressiva para envios pendentes
  const getDeadlineStatus = (handlingLimitIso?: string | null) => {
    if (!handlingLimitIso) {
      return {
        type: 'unknown',
        label: 'Limite não informado',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        remainingText: '',
      }
    }

    const limitMs = new Date(handlingLimitIso).getTime()
    const diffMs = limitMs - currentTime
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffMs <= 0) {
      // Passou do limite sem bip: atrasado!
      const overdueMins = Math.abs(Math.floor(diffMs / (1000 * 60)))
      const overdueHours = Math.floor(overdueMins / 60)
      const remMins = overdueMins % 60
      const delayText =
        overdueHours > 0 ? `${overdueHours}h ${remMins}m atrasado` : `${remMins} min atrasado`

      return {
        type: 'delayed',
        label: 'Atrasado',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
        remainingText: delayText,
        timeColor: 'text-rose-600',
        dotColor: 'bg-rose-500',
      }
    }

    if (diffHours < 12) {
      // Vence hoje (< 12h)
      const hours = Math.floor(diffHours)
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      return {
        type: 'warning',
        label: 'Vence hoje',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 font-bold',
        remainingText: `Faltam ${hours}h ${mins}m`,
        timeColor: 'text-amber-700',
        dotColor: 'bg-amber-500',
      }
    }

    // No prazo (> 12h)
    const hours = Math.floor(diffHours)
    return {
      type: 'ontime',
      label: 'No prazo',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium',
      remainingText: `Faltam ${hours}h`,
      timeColor: 'text-emerald-700',
      dotColor: 'bg-emerald-500',
    }
  }

  // Comparação para envios bipados (shipped)
  const getBipComparison = (order: MLOrder) => {
    const shippedIso = order.shipping_date_shipped
    const limitIso = order.shipping_handling_limit

    if (!shippedIso) {
      return (
        <span className="text-xs text-slate-500">
          {order.shipping_status === 'delivered' ? 'Entregue' : 'Bipado sem registro de hora'}
        </span>
      )
    }

    const shippedTimeText = formatTimeSP(shippedIso)

    if (!limitIso) {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[11px]">
          Bipado às {shippedTimeText}
        </Badge>
      )
    }

    const limitMs = new Date(limitIso).getTime()
    const shippedMs = new Date(shippedIso).getTime()
    const diffMs = shippedMs - limitMs

    if (diffMs > 60000 || order.shipping_delayed) {
      const overdueMins = Math.max(1, Math.floor(Math.abs(diffMs) / 60000))
      const overdueHours = Math.floor(overdueMins / 60)
      const remMins = overdueMins % 60
      const delayText =
        overdueHours > 0 ? `${overdueHours}h ${remMins}m atrasado` : `${overdueMins} min atrasado`

      return (
        <div className="flex flex-col items-start gap-1">
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-mono text-[11px] gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping inline-block" />
            Bipado às {shippedTimeText} · {delayText}
          </Badge>
          <span className="text-[10px] text-slate-500">
            Limite era {formatDateTimeSP(limitIso)}
          </span>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-start gap-0.5">
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-mono text-[11px] gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Bipado às {shippedTimeText} · no prazo
        </Badge>
        <span className="text-[10px] text-slate-500">Limite era {formatTimeSP(limitIso)}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. PAINEL DE RISCO DE REPUTAÇÃO DO MERCADO LIVRE */}
      <Card
        className={`border shadow-xs ${
          reputation.riskLevel === 'danger'
            ? 'border-rose-300 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40'
            : reputation.riskLevel === 'warning'
              ? 'border-amber-300 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40'
              : 'border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/30'
        }`}
      >
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Termômetro de Despachos & Reputação ML
                </span>
                <Badge
                  variant="outline"
                  className={
                    reputation.riskLevel === 'danger'
                      ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold text-xs gap-1'
                      : reputation.riskLevel === 'warning'
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs gap-1'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-xs gap-1'
                  }
                >
                  {reputation.riskLevel === 'danger' ? (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      Risco Crítico de Reputação (&ge; 10%)
                    </>
                  ) : reputation.riskLevel === 'warning' ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Alerta Amarelo (&ge; 7%)
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Reputação Saudável (&lt; 10%)
                    </>
                  )}
                </Badge>
                <Badge variant="outline" className="text-[11px] text-slate-600 bg-white">
                  {reputation.windowDescription}
                </Badge>
              </div>

              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-2">
                <span>{reputation.delayedRatePercent.toFixed(1)}%</span>
                <span className="text-xs font-semibold text-slate-500">
                  de envios atrasados no período (limite ML: <strong>10,0%</strong>)
                </span>
              </h2>

              <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                O Mercado Livre exige que menos de 10% dos envios sofram atraso no bip da agência.
                Qualquer atraso registrado nos últimos 3 meses + mês atual impacta diretamente a
                medalha de MercadoLíder.
              </p>
            </div>

            {/* Barra Visual da Régua ML (0% até 15%) */}
            <div className="w-full lg:w-80 space-y-2 bg-white/80 p-3.5 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-600">Taxa de Atrasos:</span>
                <span
                  className={`font-mono font-bold ${
                    reputation.delayedRatePercent >= 10
                      ? 'text-rose-600'
                      : reputation.delayedRatePercent >= 7
                        ? 'text-amber-600'
                        : 'text-emerald-700'
                  }`}
                >
                  {reputation.delayedSalesCount} de {reputation.totalSalesInWindow} vendas
                </span>
              </div>

              {/* Barra de Progresso personalizada */}
              <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-500 ${
                    reputation.delayedRatePercent >= 10
                      ? 'bg-rose-500'
                      : reputation.delayedRatePercent >= 7
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (reputation.delayedRatePercent / 15) * 100)}%` }}
                />
                {/* Linha demarcadora dos 10% (10 / 15 = 66.6%) */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-600 z-10"
                  style={{ left: '66.6%' }}
                  title="Teto máximo permitido (10%)"
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>0% (Ideal)</span>
                <span className="text-rose-600 font-bold">Régua 10% (Teto)</span>
                <span>15%+</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. ALERTA DE NOTA FISCAL PENDENTE (se houver) */}
      {invoicePendingOrders.length > 0 && (
        <Card className="border-rose-300 bg-rose-50/70 shadow-xs">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-rose-950">
                      Atenção: {invoicePendingOrders.length} pedido(s) aguardando emissão de Nota
                      Fiscal!
                    </h3>
                    <Badge className="bg-rose-600 text-white font-bold text-[10px]">
                      Risco Imediato
                    </Badge>
                  </div>
                  <p className="text-xs text-rose-800 mt-0.5">
                    O Mercado Livre só libera a etiqueta de envio após a validação da NF-e. Enquanto
                    estiver em <code>invoice_pending</code>, o cronômetro de despacho continua
                    correndo!
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {invoicePendingOrders.map((inv) => (
                      <span
                        key={inv.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-rose-200 text-xs font-mono font-bold text-rose-900 shadow-2xs"
                      >
                        <span>Pedido #{inv.order_id}</span>
                        <span className="text-slate-500 font-sans font-normal">
                          ({inv.buyer_nickname || 'Cliente'})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveFilter('invoice_pending')}
                className="text-xs h-8 bg-white border-rose-300 text-rose-800 hover:bg-rose-100 font-semibold shrink-0"
              >
                Filtrar com NF Pendente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. BARRA DE AÇÃO & KPIs RÁPIDOS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* A bipar hoje */}
        <Card
          onClick={() => setActiveFilter('pending_scan')}
          className={`cursor-pointer transition-all border shadow-xs ${
            activeFilter === 'pending_scan'
              ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/30'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-amber-700 font-bold block flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              A Bipar Pendentes
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {pendingScanOrders.length}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Prontos para expedição e bip
            </span>
          </CardContent>
        </Card>

        {/* Atrasados */}
        <Card
          onClick={() => setActiveFilter('pending_scan')}
          className="border-slate-200 bg-white shadow-xs"
        >
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-rose-600 font-bold block flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Atrasos Identificados
            </span>
            <span className="text-2xl font-black text-rose-700 mt-1 block font-mono">
              {kpis.totalDelayed}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Passaram do limite estipulado
            </span>
          </CardContent>
        </Card>

        {/* NF Pendente */}
        <Card
          onClick={() => setActiveFilter('invoice_pending')}
          className={`cursor-pointer transition-all border shadow-xs ${
            activeFilter === 'invoice_pending'
              ? 'border-rose-400 bg-rose-50/50 ring-2 ring-rose-400/30'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-rose-600 font-bold block flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              NF Pendente (Bloqueados)
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {kpis.totalInvoicePending}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Aguardando emissão fiscal
            </span>
          </CardContent>
        </Card>

        {/* No Prazo */}
        <Card
          onClick={() => setActiveFilter('shipped')}
          className={`cursor-pointer transition-all border shadow-xs ${
            activeFilter === 'shipped'
              ? 'border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-400/30'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold block flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Bipados / Despachados
            </span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block font-mono">
              {shippedOrders.length}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Histórico com hora do bip
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 4. CABEÇALHO DA LISTAGEM COM BOTÃO SINCRONIZAR E FILTROS */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar pedido, comprador, produto ou shipping ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>

              <Select value={activeFilter} onValueChange={(val: any) => setActiveFilter(val)}>
                <SelectTrigger className="text-xs h-9 w-[190px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_scan">A Bipar ({pendingScanOrders.length})</SelectItem>
                  <SelectItem value="invoice_pending">
                    NF Pendente ({invoicePendingOrders.length})
                  </SelectItem>
                  <SelectItem value="shipped">Já Bipados ({shippedOrders.length})</SelectItem>
                  <SelectItem value="all">Todos os pedidos ({orders.length})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing || loading}
                className="text-xs h-9 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border-amber-400 gap-1.5 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando com ML...' : 'Sincronizar'}
              </Button>
            </div>
          </div>

          {syncing && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
              <span>{syncProgress || 'Atualizando limites e status de envio...'}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. TABELA DE ENVIOS & PRAZOS */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500" />
          <p className="text-sm font-semibold text-slate-700">
            Carregando envios e horários limites...
          </p>
        </div>
      ) : displayedOrders.length === 0 ? (
        <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
          <CardContent className="p-12 text-center space-y-3">
            <Package className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="font-bold text-slate-800 text-base">Nenhum envio nesta categoria</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Todos os pedidos filtrados foram atendidos ou não há pendências de despacho no
              momento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-3">Status de Expedição</th>
                  <th className="py-3 px-3">Horário-Limite / Bip</th>
                  <th className="py-3 px-3">Pedido & Comprador</th>
                  <th className="py-3 px-3">Item(ns)</th>
                  <th className="py-3 px-3">Destino</th>
                  <th className="py-3 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedOrders.map((order) => {
                  const effShipStatus = (order.shipping_status || '').toLowerCase()
                  const effSubstatus = (order.shipping_substatus || '').toLowerCase()
                  const isShipped = effShipStatus === 'shipped' || effShipStatus === 'delivered'
                  const isInvoicePending = effSubstatus === 'invoice_pending'
                  const deadline = getDeadlineStatus(order.shipping_handling_limit)
                  const item = order.items?.[0]

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Status de Expedição */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          {isInvoicePending ? (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-[11px] gap-1">
                              <FileText className="w-3 h-3 text-rose-600" />
                              Nota Fiscal Pendente
                            </Badge>
                          ) : isShipped ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px] gap-1 font-medium">
                              <Truck className="w-3 h-3 text-emerald-600" />
                              {effShipStatus === 'delivered' ? 'Entregue' : 'Bipado / Em trânsito'}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-900 border-amber-300 font-bold text-[11px] gap-1">
                              <Package className="w-3 h-3 text-amber-700" />
                              Pronto para Envio
                            </Badge>
                          )}

                          {effSubstatus && !isInvoicePending && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Substatus:{' '}
                              <span className="font-semibold text-slate-700">{effSubstatus}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 2. Horário-Limite e Relógio de Contagem / Bip */}
                      <td className="py-3 px-3">
                        {isShipped ? (
                          getBipComparison(order)
                        ) : isInvoicePending ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Bloqueado por NF
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Limite: {formatDateTimeSP(order.shipping_handling_limit)}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {/* Semáforo com contagem regressiva ao vivo */}
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${deadline.dotColor || 'bg-slate-400'}`}
                              />
                              <span className="font-extrabold text-xs text-slate-900">
                                Bipar até {formatTimeSP(order.shipping_handling_limit)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge className={`text-[10px] font-mono ${deadline.badgeClass}`}>
                                {deadline.label} · {deadline.remainingText}
                              </Badge>
                            </div>

                            <div className="text-[10px] text-slate-400 font-mono">
                              Data limite: {formatDateTimeSP(order.shipping_handling_limit)}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 3. Pedido & Comprador */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-slate-900">
                            #{order.order_id}
                          </div>
                          <div className="text-xs font-semibold text-slate-700">
                            {order.buyer_nickname || order.buyer_name || 'Comprador'}
                          </div>
                          {order.shipping_id && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Envio #{order.shipping_id}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 4. Item */}
                      <td className="py-3 px-3 max-w-[240px]">
                        {item ? (
                          <div className="space-y-0.5 truncate">
                            <div
                              className="font-medium text-slate-800 text-xs truncate"
                              title={item.title}
                            >
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Qtd: <strong>{item.quantity}</strong> ·{' '}
                              {Number(order.total_amount || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* 5. Destino */}
                      <td className="py-3 px-3">
                        {order.receiver_address ? (
                          <div className="space-y-0.5 text-xs text-slate-700 max-w-[200px]">
                            <div className="font-medium">
                              {order.receiver_address.city?.name || '-'},{' '}
                              {order.receiver_address.state?.name || ''}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate font-mono">
                              {order.receiver_address.zip_code
                                ? `CEP ${order.receiver_address.zip_code}`
                                : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Endereço no ML</span>
                        )}
                      </td>

                      {/* 6. Ação */}
                      <td className="py-3 px-3 text-right">
                        <a
                          href={`https://myaccount.mercadolivre.com.br/vendas/lista?order_id=${order.order_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Ver no ML <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
