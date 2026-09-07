import React, { useState, useEffect } from 'react'
import {
  Store,
  ExternalLink,
  ShieldAlert,
  Trophy,
  TrendingDown,
  TrendingUp,
  PackageCheck,
  RefreshCw,
  Clock,
  Layers,
  ArrowUpRight,
  Info,
  ChevronRight,
  Search,
  AlertTriangle,
  History,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import pb from '@/lib/pocketbase/client'
import { CatalogPositionAggregate } from '@/services/mlExactProductService'

interface SnapshotRecord {
  id: string
  item_id: string
  catalog_product_id?: string
  seller_id?: string
  seller_nickname?: string
  title: string
  price: number | null
  available_quantity: number | null
  sold_quantity: number | null
  listing_type?: string
  is_buy_box_winner: boolean
  snapshot_date: string
  created: string
}

interface CatalogPositionMonitorProps {
  catalogPosition: CatalogPositionAggregate
  onRefreshScrape?: (itemId: string, permalink: string) => Promise<number | null>
}

export function CatalogPositionMonitor({
  catalogPosition,
  onRefreshScrape,
}: CatalogPositionMonitorProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(false)
  const [scrapingItemId, setScrapingItemId] = useState<string | null>(null)
  const [scrapeResults, setScrapeResults] = useState<
    Record<string, { status: string; sold: number | null }>
  >({})
  const [selectedAdForModal, setSelectedAdForModal] = useState<
    (typeof catalogPosition.ads)[0] | null
  >(null)

  // Carrega histórico de snapshots (60 dias)
  useEffect(() => {
    let isMounted = true

    async function loadSnapshotsHistory() {
      setLoadingSnapshots(true)
      try {
        const catId = catalogPosition.catalogProductId
        let filterStr = ''
        if (catId && catId !== 'CATALOGO_ML') {
          filterStr = `catalog_product_id = '${catId}'`
        } else if (catalogPosition.ads.length > 0) {
          const itemIds = catalogPosition.ads
            .map((a) => a.id)
            .filter(Boolean)
            .slice(0, 10)
          filterStr = itemIds.map((id) => `item_id = '${id}'`).join(' || ')
        }

        if (filterStr) {
          const records = await pb.collection('ml_ad_snapshots').getFullList<SnapshotRecord>({
            filter: filterStr,
            sort: '-snapshot_date',
          })
          if (isMounted) {
            setSnapshots(records)
          }
        }
      } catch (err) {
        console.warn('[CatalogPositionMonitor] Erro ao carregar snapshots:', err)
      } finally {
        if (isMounted) setLoadingSnapshots(false)
      }
    }

    loadSnapshotsHistory()
    return () => {
      isMounted = false
    }
  }, [catalogPosition.catalogProductId, catalogPosition.ads])

  // Ação de scrape honesto da página pública
  const handleScrapeAd = async (item: (typeof catalogPosition.ads)[0]) => {
    setScrapingItemId(item.id)
    try {
      const res = await fetch('/api/ml-ad-scrape-sold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, permalink: item.permalink }),
      })
      const data = await res.json()
      setScrapeResults((prev) => ({
        ...prev,
        [item.id]: {
          status: data.status,
          sold: data.sold_quantity,
        },
      }))
      if (data.sold_quantity != null && onRefreshScrape) {
        await onRefreshScrape(item.id, item.permalink)
      }
    } catch (err) {
      setScrapeResults((prev) => ({
        ...prev,
        [item.id]: {
          status: 'error',
          sold: null,
        },
      }))
    } finally {
      setScrapingItemId(null)
    }
  }

  // Agrupamento de snapshots por dia para Curva de 60 dias
  const snapshotsByDate = React.useMemo(() => {
    const map = new Map<
      string,
      {
        date: string
        prices: number[]
        stocks: number[]
        solds: number[]
        winners: string[]
      }
    >()

    for (const snap of snapshots) {
      const d = snap.snapshot_date ? snap.snapshot_date.substring(0, 10) : ''
      if (!d) continue
      if (!map.has(d)) {
        map.set(d, { date: d, prices: [], stocks: [], solds: [], winners: [] })
      }
      const entry = map.get(d)!
      if (snap.price != null && snap.price > 0) entry.prices.push(snap.price)
      if (snap.available_quantity != null) entry.stocks.push(snap.available_quantity)
      if (snap.sold_quantity != null) entry.solds.push(snap.sold_quantity)
      if (snap.is_buy_box_winner && snap.seller_nickname) entry.winners.push(snap.seller_nickname)
    }

    const sortedDates = Array.from(map.keys()).sort()
    return sortedDates.map((d) => {
      const item = map.get(d)!
      const avgPrice =
        item.prices.length > 0
          ? Math.round(item.prices.reduce((a, b) => a + b, 0) / item.prices.length)
          : null
      const totalStock = item.stocks.length > 0 ? item.stocks.reduce((a, b) => a + b, 0) : null
      const totalSold = item.solds.length > 0 ? Math.max(...item.solds) : null
      return {
        date: d,
        avgPrice,
        totalStock,
        totalSold,
        winner: item.winners[0] || null,
      }
    })
  }, [snapshots])

  // Rotação de líderes da Buy Box histórico
  const buyBoxLeaderRotation = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const snap of snapshots) {
      if (snap.is_buy_box_winner && snap.seller_nickname) {
        counts[snap.seller_nickname] = (counts[snap.seller_nickname] || 0) + 1
      }
    }
    return Object.entries(counts)
      .map(([seller, count]) => ({ seller, count }))
      .sort((a, b) => b.count - a.count)
  }, [snapshots])

  // Alertas de movimentos recentes
  const recentAlerts = React.useMemo(() => {
    const alerts: Array<{
      id: string
      date: string
      type: 'price_drop' | 'stock_drop' | 'winner_change' | 'new_seller'
      title: string
      description: string
      badgeVariant: 'default' | 'destructive' | 'secondary'
    }> = []

    if (snapshotsByDate.length >= 2) {
      for (let i = 1; i < snapshotsByDate.length; i++) {
        const prev = snapshotsByDate[i - 1]
        const curr = snapshotsByDate[i]

        // Queda de preço >= 5%
        if (prev.avgPrice && curr.avgPrice && curr.avgPrice < prev.avgPrice * 0.95) {
          const diffPct = Math.round(((prev.avgPrice - curr.avgPrice) / prev.avgPrice) * 100)
          alerts.push({
            id: `price-${curr.date}`,
            date: curr.date,
            type: 'price_drop',
            title: `Queda de preço de ${diffPct}%`,
            description: `Preço médio caiu de R$ ${prev.avgPrice.toLocaleString('pt-BR')} para R$ ${curr.avgPrice.toLocaleString('pt-BR')}`,
            badgeVariant: 'secondary',
          })
        }

        // Troca de vencedor da Buy Box
        if (prev.winner && curr.winner && prev.winner !== curr.winner) {
          alerts.push({
            id: `winner-${curr.date}`,
            date: curr.date,
            type: 'winner_change',
            title: 'Liderança da Buy Box alternou',
            description: `Vencedor mudou de "${prev.winner}" para "${curr.winner}"`,
            badgeVariant: 'default',
          })
        }

        // Queda acentuada de estoque
        if (
          prev.totalStock != null &&
          curr.totalStock != null &&
          curr.totalStock < prev.totalStock
        ) {
          const dropUnits = prev.totalStock - curr.totalStock
          if (dropUnits >= 5) {
            alerts.push({
              id: `stock-${curr.date}`,
              date: curr.date,
              type: 'stock_drop',
              title: `Venda/saída rápida de estoque (-${dropUnits} un)`,
              description: `Estoque visível caiu de ${prev.totalStock} para ${curr.totalStock} unidades`,
              badgeVariant: 'default',
            })
          }
        }
      }
    }

    return alerts.reverse().slice(0, 6)
  }, [snapshotsByDate])

  // Total de vendas expostas somadas nos anúncios visíveis
  const exposedSalesSum = React.useMemo(() => {
    let sum = 0
    let hasAny = false
    for (const ad of catalogPosition.ads) {
      const liveSold = scrapeResults[ad.id]?.sold ?? ad.soldQuantity
      if (liveSold != null && liveSold > 0) {
        sum += liveSold
        hasAny = true
      }
    }
    return hasAny ? sum : null
  }, [catalogPosition.ads, scrapeResults])

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO DO MONITOR DA POSIÇÃO DE CATÁLOGO */}
      <Card className="border-amber-300 dark:border-amber-900 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1 px-2.5 py-0.5 text-xs font-semibold">
                  <Store className="h-3.5 w-3.5" />
                  Posição de Catálogo do ML
                </Badge>
                {catalogPosition.catalogProductId && (
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {catalogPosition.catalogProductId}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[11px]">
                  {catalogPosition.totalAdsCount} anúncio
                  {catalogPosition.totalAdsCount !== 1 ? 's' : ''} indexado
                  {catalogPosition.totalAdsCount !== 1 ? 's' : ''}
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {catalogPosition.title}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground flex items-center gap-2">
                Página mestre de catálogo agregadora de todas as ofertas competitivas deste produto
                no Mercado Livre
              </CardDescription>
            </div>

            {catalogPosition.permalink && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs border-amber-300 dark:border-amber-800"
                asChild
              >
                <a href={catalogPosition.permalink} target="_blank" rel="noopener noreferrer">
                  Ver no Mercado Livre
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Métricas Principais da Posição */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
            <div className="rounded-lg border bg-background/80 p-3 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Preço Mínimo
              </span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {catalogPosition.minPrice > 0
                  ? `R$ ${catalogPosition.minPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : 'N/I'}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Médio: R$ {catalogPosition.avgPrice.toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="rounded-lg border bg-background/80 p-3 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Preço Máximo
              </span>
              <span className="text-lg font-bold text-foreground">
                {catalogPosition.maxPrice > 0
                  ? `R$ ${catalogPosition.maxPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : 'N/I'}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Amplitude do produto
              </span>
            </div>

            <div className="rounded-lg border bg-background/80 p-3 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Estoque Visível
              </span>
              <span className="text-lg font-bold text-foreground">
                {catalogPosition.totalAvailableStock > 0
                  ? `${catalogPosition.totalAvailableStock} un`
                  : '1+ un'}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Somado na posição
              </span>
            </div>

            <div className="rounded-lg border bg-background/80 p-3 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Sellers Ofertando
              </span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {catalogPosition.distinctSellersCount}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                vendedores distintos
              </span>
            </div>

            <div className="rounded-lg border bg-background/80 p-3 shadow-xs col-span-2 md:col-span-1">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Giro Visível da Posição
              </span>
              {exposedSalesSum != null ? (
                <div>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    +{exposedSalesSum}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    vendas expostas
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Vendas não informadas
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    ML oculta vendas de terceiros
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              Distribuição:{' '}
              <strong className="text-foreground font-semibold">
                {catalogPosition.premiumListingsCount} Premium
              </strong>{' '}
              (
              {Math.round(
                (catalogPosition.premiumListingsCount /
                  Math.max(1, catalogPosition.totalAdsCount)) *
                  100,
              )}
              %) ×{' '}
              <strong className="text-foreground font-semibold">
                {catalogPosition.classicListingsCount} Clássico
              </strong>{' '}
              (
              {Math.round(
                (catalogPosition.classicListingsCount /
                  Math.max(1, catalogPosition.totalAdsCount)) *
                  100,
              )}
              %)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. BUY BOX AO VIVO & ROTAÇÃO DE LÍDERES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Buy Box ao Vivo */}
        <Card className="md:col-span-2 border-emerald-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-base font-semibold">
                  Buy Box ao Vivo — Vencedor Atual
                </CardTitle>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[11px]">
                Ganhador Oficial da Posição
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {catalogPosition.buyBoxWinner ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-lg border bg-muted/30 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">
                      {catalogPosition.buyBoxWinner.sellerNickname}
                    </span>
                    {catalogPosition.buyBoxWinner.isOwn && (
                      <Badge className="bg-blue-600 text-white text-[10px]">Sua Conta</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {catalogPosition.buyBoxWinner.listingTypeLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este vendedor está recebendo a maioria esmagadora dos cliques orgânicos da
                    página de catálogo neste instante.
                  </p>
                </div>

                <div className="text-right sm:border-l sm:pl-4">
                  <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                    Preço Vencedor
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    R${' '}
                    {catalogPosition.buyBoxWinner.price.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  {catalogPosition.buyBoxWinner.stock != null && (
                    <span className="text-[11px] text-muted-foreground block">
                      Estoque visível: {catalogPosition.buyBoxWinner.stock} un
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground border rounded-lg">
                Nenhum vencedor definitivo de Buy Box retornado nesta requisição.
              </div>
            )}

            {/* Histórico de Rotação de Vencedores */}
            <div className="mt-4 pt-3 border-t">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Histórico de Vencedores Registrados nos Snapshots:
              </h4>
              {buyBoxLeaderRotation.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {buyBoxLeaderRotation.map((item, idx) => (
                    <div
                      key={item.seller}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs bg-background"
                    >
                      <span className="text-muted-foreground font-mono text-[10px]">
                        #{idx + 1}
                      </span>
                      <strong className="text-foreground">{item.seller}</strong>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                        {item.count}x líder
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Ainda não há rotações acumuladas em dias diferentes. O sistema acumula
                  automaticamente a cada snapshot diário.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alertas de Movimento da Posição */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base font-semibold">Alertas de Movimento</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alt) => (
                <div key={alt.id} className="p-2 rounded border bg-muted/20 text-xs space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      {alt.type === 'price_drop' && (
                        <TrendingDown className="h-3 w-3 text-emerald-500" />
                      )}
                      {alt.type === 'winner_change' && (
                        <Trophy className="h-3 w-3 text-amber-500" />
                      )}
                      {alt.type === 'stock_drop' && (
                        <PackageCheck className="h-3 w-3 text-blue-500" />
                      )}
                      {alt.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">{alt.date}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{alt.description}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground space-y-1">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground/50 mx-auto" />
                <p className="font-medium">Sem movimentos bruscos detectados</p>
                <p className="text-[11px]">
                  Alertas como queda de preço ≥5%, rotação de Buy Box ou vendas repentinas
                  aparecerão aqui com o histórico diário.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. CURVA DE HISTÓRICO DE 60 DIAS */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Curva de Histórico de Snapshots
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              {snapshotsByDate.length} snapshot{snapshotsByDate.length !== 1 ? 's' : ''} registrado
              {snapshotsByDate.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Evolução de preço médio, estoque somado e histórico da Buy Box por data gravada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSnapshots ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
              Carregando histórico acumulado no banco...
            </div>
          ) : snapshotsByDate.length > 0 ? (
            <div className="space-y-4">
              {/* Tabela Resumo dos Snapshots Registrados */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Data do Snapshot</TableHead>
                      <TableHead>Preço Médio</TableHead>
                      <TableHead>Estoque Visível</TableHead>
                      <TableHead>Vendas Expostas</TableHead>
                      <TableHead>Líder Registrado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshotsByDate
                      .slice(-10)
                      .reverse()
                      .map((snap) => (
                        <TableRow key={snap.date} className="text-xs">
                          <TableCell className="font-mono font-medium">{snap.date}</TableCell>
                          <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {snap.avgPrice ? `R$ ${snap.avgPrice.toLocaleString('pt-BR')}` : '—'}
                          </TableCell>
                          <TableCell>
                            {snap.totalStock != null ? `${snap.totalStock} un` : '—'}
                          </TableCell>
                          <TableCell>
                            {snap.totalSold != null ? (
                              <Badge variant="secondary" className="text-[10px]">
                                +{snap.totalSold} vendidos
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Não exposto</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {snap.winner ? (
                              <span className="font-medium text-foreground">{snap.winner}</span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">N/I</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg bg-muted/10 space-y-1">
              <Clock className="h-5 w-5 mx-auto text-muted-foreground/60 mb-1" />
              <p className="font-medium text-foreground">
                Primeiro snapshot diário gerado para este produto hoje.
              </p>
              <p className="text-[11px]">
                Conforme as consultas e o cron diário rodarem, a curva de até 60 dias construirá
                automaticamente o gráfico de preço e estoque.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. ANÚNCIOS DA POSIÇÃO & VENDAS EXPOSTAS */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">
                Anúncios Agregados na Posição de Catálogo
              </CardTitle>
              <CardDescription className="text-xs">
                Contador de vendas exposto na página pública e status honesto de cada anúncio
                concorrente
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {catalogPosition.ads.length} anúncio{catalogPosition.ads.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-[80px]">Foto</TableHead>
                  <TableHead>Anúncio / ID</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Vendas Expostas</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalogPosition.ads.map((ad) => {
                  const scrape = scrapeResults[ad.id]
                  const currentSold = scrape?.sold ?? ad.soldQuantity
                  const isScraping = scrapingItemId === ad.id

                  return (
                    <TableRow key={ad.id} className="text-xs">
                      <TableCell>
                        {ad.thumbnail ? (
                          <img
                            src={ad.thumbnail}
                            alt=""
                            className="h-10 w-10 object-contain rounded border bg-white"
                          />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded flex items-center justify-center text-[10px]">
                            Sem foto
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="font-medium text-foreground truncate">{ad.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {ad.id}
                          </span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {ad.listingTypeLabel}
                          </Badge>
                          {ad.isBuyBoxWinner && (
                            <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0 h-4">
                              Buy Box
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground">{ad.sellerNickname}</span>
                        {ad.isOwnAccount && (
                          <Badge className="ml-1 bg-blue-600 text-white text-[9px] px-1 py-0 h-3.5">
                            Você
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-foreground">
                        {ad.price > 0
                          ? `R$ ${ad.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : 'N/I'}
                      </TableCell>
                      <TableCell>{ad.stock != null ? `${ad.stock} un` : '—'}</TableCell>
                      <TableCell>
                        {currentSold != null ? (
                          <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 text-[11px] font-semibold">
                            +{currentSold} vendidos
                          </Badge>
                        ) : scrape?.status === 'blocked_waf' ? (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            Bloqueio WAF (ML)
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Vendas não informadas
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 px-2"
                            disabled={isScraping}
                            onClick={() => handleScrapeAd(ad)}
                            title="Tentar ler contador público de vendas na página do anúncio"
                          >
                            <RefreshCw className={`h-3 w-3 ${isScraping ? 'animate-spin' : ''}`} />
                            {isScraping ? 'Lendo...' : 'Ler Vendas'}
                          </Button>
                          {ad.permalink && (
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" asChild>
                              <a href={ad.permalink} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
