import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  AlertTriangle,
  Clock,
  FileText,
  TrendingUp,
  ArrowRight,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MessageSquare,
} from 'lucide-react'
import { mlQuestionsService, type MLQuestionMetrics } from '@/services/mlQuestionsService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { salesService } from '@/services/sales'
import { batchesService } from '@/services/batches'
import { productsService } from '@/services/products'
import { useRealtime } from '@/hooks/use-realtime'
import type { Sale, Batch, Product } from '@/types/inventory'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'

export default function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [questionsMetrics, setQuestionsMetrics] = useState<MLQuestionMetrics | null>(null)

  const loadData = async () => {
    try {
      const [salesData, batchesData, productsData, qMetrics] = await Promise.all([
        salesService.getAll(),
        batchesService.getAll(),
        productsService.getAll(),
        mlQuestionsService.getMetrics().catch(() => null),
      ])
      setSales(salesData)
      setBatches(batchesData)
      setProducts(productsData)
      if (qMetrics) setQuestionsMetrics(qMetrics)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Realtime subscriptions on batches and sales
  useRealtime<Batch>('batches', () => {
    batchesService.getAll().then(setBatches)
  })

  useRealtime<Sale>('sales', () => {
    salesService.getAll().then(setSales)
  })

  // Calculate Metrics
  const metrics = useMemo(() => {
    // 1. Total sales (completed)
    const completedSales = sales.filter((s) => s.status === 'completed')
    const totalAmount = completedSales.reduce((acc, s) => acc + (s.total_amount || 0), 0)

    // Monthly sales calculation (current month)
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const monthlySales = completedSales.filter((s) => {
      const d = new Date(s.created)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    const monthlyAmount = monthlySales.reduce((acc, s) => acc + (s.total_amount || 0), 0)

    // 2. Low stock items (batches with quantity <= 5)
    const lowStockBatches = batches.filter((b) => b.quantity <= 5)

    // 3. Batches expiring within next 180 days or already expired
    const next180Days = new Date()
    next180Days.setDate(next180Days.getDate() + 180)

    const expiringBatches = batches.filter((b) => {
      if (!b.expiry_date) return false
      const exp = new Date(b.expiry_date)
      return exp <= next180Days
    })

    // 4. Pending orders (sales with status 'draft')
    const pendingSales = sales.filter((s) => s.status === 'draft')

    return {
      totalAmount,
      monthlyAmount,
      completedCount: completedSales.length,
      lowStockCount: lowStockBatches.length,
      expiringCount: expiringBatches.length,
      pendingCount: pendingSales.length,
      lowStockBatches,
    }
  }, [sales, batches])

  // Stock Distribution Data for chart (by product category)
  const chartData = useMemo(() => {
    const categoryMap: { [cat: string]: number } = {}

    batches.forEach((b) => {
      const prod = b.expand?.product_id
      const cat = prod?.category || 'Geral'
      categoryMap[cat] = (categoryMap[cat] || 0) + (b.quantity || 0)
    })

    return Object.entries(categoryMap).map(([name, total]) => ({
      name,
      total,
    }))
  }, [batches])

  const COLORS = ['#0F172A', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']

  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
      .slice(0, 5)
  }, [sales])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Welcome bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Painel Operacional</h2>
          <p className="text-sm text-slate-500">
            Visão consolidada de saídas, disponibilidade de lotes e alertas de estoque.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/vendas?nova=true">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2">
              <DollarSign className="w-4 h-4" />
              Nova Venda
            </Button>
          </Link>
          <Link to="/ajustes">
            <Button variant="outline" className="gap-2 border-slate-300">
              <TrendingUp className="w-4 h-4" />
              Inventário
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerta de Perguntas Críticas ML no Dashboard */}
      {questionsMetrics &&
        (questionsMetrics.critical_count > 0 || questionsMetrics.pending_total > 0) && (
          <div className="p-4 rounded-xl border bg-yellow-500/10 border-yellow-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${questionsMetrics.critical_count > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-yellow-500 text-slate-950'}`}
              >
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    Central de Perguntas ML: {questionsMetrics.pending_total} pendência(s)
                  </span>
                  {questionsMetrics.critical_count > 0 && (
                    <Badge variant="destructive" className="font-bold text-xs animate-bounce">
                      🚨 {questionsMetrics.critical_count} CRÍTICA(S) (&gt;4h)
                    </Badge>
                  )}
                  {questionsMetrics.waiting_real_reply > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-semibold"
                    >
                      ⏳ {questionsMetrics.waiting_real_reply} aguardando resposta real
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {questionsMetrics.critical_count > 0
                    ? 'Existem dúvidas de clientes sem resposta real há mais de 4 horas, com risco direto de queda na reputação do ML.'
                    : 'Responda as dúvidas dos compradores para acelerar a conversão e manter o SLA saudável.'}
                </p>
              </div>
            </div>
            <Link to="/anuncios-ml">
              <Button
                size="sm"
                className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold text-xs shrink-0 shadow-xs"
              >
                Abrir Central de Perguntas ML <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Vendas */}
        <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Vendas</CardTitle>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              R$ {metrics.monthlyAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Neste mês</span>
              <span className="font-semibold text-slate-700">
                Total Geral: R${' '}
                {metrics.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Baixo Estoque */}
        <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Baixo Estoque</CardTitle>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              {metrics.lowStockCount}
              {metrics.lowStockCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-semibold animate-pulse">
                  Crítico
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Lotes com 5 ou menos unidades restantes</p>
          </CardContent>
        </Card>

        {/* KPI 3: Lotes Vencendo */}
        <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Lotes em Atenção</CardTitle>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{metrics.expiringCount}</div>
            <p className="text-xs text-slate-500 mt-1">Validade nos próximos 180 dias</p>
          </CardContent>
        </Card>

        {/* KPI 4: Pedidos Pendentes */}
        <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Pedidos Pendentes</CardTitle>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{metrics.pendingCount}</div>
            <p className="text-xs text-slate-500 mt-1">Em rascunho / aguardando pagamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Highlights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock by Category Chart */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Distribuição de Equipamentos em Estoque
                </CardTitle>
                <CardDescription>
                  Unidades físicas disponíveis somando todos os lotes ativos por categoria
                </CardDescription>
              </div>
              <Link
                to="/estoque"
                className="text-xs text-blue-600 hover:underline flex items-center"
              >
                Ver todos os lotes <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Nenhum estoque cadastrado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: any) => [`${value} unidades`, 'Total no Estoque']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      color: '#fff',
                      borderRadius: '8px',
                      border: 'none',
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts Sidebar */}
        <Card className="border-slate-200 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center justify-between">
              <span>Alerta de Reposição</span>
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs">
                {metrics.lowStockBatches.length} lotes
              </Badge>
            </CardTitle>
            <CardDescription>
              Lotes que requerem compras ou novo faturamento imediato
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-72 space-y-3">
            {metrics.lowStockBatches.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-center p-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-sm text-slate-600 font-medium">
                  Nenhum lote crítico no momento.
                </p>
                <p className="text-xs text-slate-400">Todos os lotes possuem mais de 5 unidades.</p>
              </div>
            ) : (
              metrics.lowStockBatches.map((b) => (
                <div
                  key={b.id}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-between transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {b.expand?.product_id?.name || 'Equipamento'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono text-slate-500">{b.batch_number}</span>
                      <span className="text-[11px] text-slate-400">
                        • {b.location || 'Sem local'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                      {b.quantity} un
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Vendas Recentes
            </CardTitle>
            <CardDescription>
              Últimas 5 saídas registradas com baixa automatizada de lotes
            </CardDescription>
          </div>
          <Link to="/vendas">
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-800">
              Ver histórico completo <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-t border-slate-200 bg-slate-50/75 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                    Nenhuma venda registrada ainda.
                  </td>
                </tr>
              ) : (
                recentSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap text-xs font-mono">
                      {new Date(s.created).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(s.created).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {s.customer_name}
                      {s.customer_contact && (
                        <span className="block text-xs text-slate-400 font-normal truncate max-w-xs">
                          {s.customer_contact}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs whitespace-nowrap">
                      {s.expand?.user_id?.name || 'Equipe'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900 whitespace-nowrap font-mono">
                      R${' '}
                      {Number(s.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {s.status === 'completed' && (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none text-[11px] font-semibold gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Completo
                        </Badge>
                      )}
                      {s.status === 'draft' && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-[11px] font-semibold gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Pendente
                        </Badge>
                      )}
                      {s.status === 'cancelled' && (
                        <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none text-[11px] font-semibold gap-1">
                          <XCircle className="w-3 h-3" />
                          Cancelado
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link to={`/vendas?detalhe=${s.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-slate-600 hover:text-slate-900"
                        >
                          Detalhes
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
