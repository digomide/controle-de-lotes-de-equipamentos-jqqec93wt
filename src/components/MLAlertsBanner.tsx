import React, { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Clock,
  PackageX,
  TrendingDown,
  TrendingUp,
  Radar,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowRight,
  Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MLSellerItem } from '@/services/mlService'
import type { MLCompetitorAd } from '@/services/mlCompetitorService'
import { mlSellersService } from '@/services/mlSellersService'

export interface AdAlert {
  id: string
  type: 'paused_long' | 'unmatched_active' | 'price_competitor_high' | 'price_competitor_low'
  severity: 'warning' | 'info' | 'critical'
  title: string
  description: string
  item: MLSellerItem
  competitorAd?: MLCompetitorAd
  diffPercent?: number
}

interface MLAlertsBannerProps {
  items: MLSellerItem[]
  competitorAds?: MLCompetitorAd[]
  onFilterUnmatched?: () => void
  onFilterPaused?: () => void
  onNavigateToSellers?: () => void
}

export function MLAlertsBanner({
  items,
  competitorAds = [],
  onFilterUnmatched,
  onFilterPaused,
  onNavigateToSellers,
}: MLAlertsBannerProps) {
  const [sellerAlertCount, setSellerAlertCount] = useState<number>(0)
  const [tayAlert, setTayAlert] = useState<boolean>(false)

  useEffect(() => {
    mlSellersService
      .listSellers()
      .then((res) => {
        if (res.ok) {
          setSellerAlertCount(res.kpis?.alert_count || 0)
          const hasTay = (res.sellers || []).some(
            (s) => s.nickname.includes('TAY') && s.auth_status === 'unauthorized',
          )
          setTayAlert(hasTay)
        }
      })
      .catch(() => {})
  }, [])
  const alerts: AdAlert[] = useMemo(() => {
    const list: AdAlert[] = []

    // 1. Mapa de concorrência indexado por MLB ou por palavras-chave do título
    const compMap = new Map<string, MLCompetitorAd>()
    for (const c of competitorAds) {
      if (c.mlb_item_id) compMap.set(c.mlb_item_id.trim().toUpperCase(), c)
    }

    for (const item of items) {
      // Alerta 1: Anúncio pausado
      if (item.status === 'paused') {
        list.push({
          id: `paused_${item.id}`,
          type: 'paused_long',
          severity: 'warning',
          title: `Anúncio Pausado`,
          description: `O anúncio "${item.title.slice(0, 45)}..." está pausado no ML e não está gerando impressões nem vendas.`,
          item,
        })
      }

      // Alerta 2: Anúncio ativo sem vínculo ao catálogo local
      if (item.status === 'active' && !item.matchedProduct) {
        list.push({
          id: `unmatched_${item.id}`,
          type: 'unmatched_active',
          severity: 'info',
          title: `Ativo sem vínculo no Catálogo`,
          description: `O anúncio "${item.title.slice(0, 45)}..." está ativo no ML mas não possui correspondente por ID ou GTIN no estoque interno.`,
          item,
        })
      }

      // Alerta 3: Cruzamento com Radar ML de concorrência
      // Procura se temos algum concorrente monitorando este mesmo item ou modelo similar
      const ourPrice = Number(item.price) || 0
      if (ourPrice > 0 && competitorAds.length > 0) {
        // Encontra concorrentes com títulos semelhantes
        const itemWords = item.title
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)

        let bestCompMatch: MLCompetitorAd | null = null
        let maxOverlap = 0

        for (const c of competitorAds) {
          if (!c.current_price || c.current_price <= 0) continue
          const cWords = c.title.toLowerCase().split(/\s+/)
          const overlap = itemWords.filter((w) => cWords.includes(w)).length
          if (overlap >= 4 && overlap > maxOverlap) {
            maxOverlap = overlap
            bestCompMatch = c
          }
        }

        if (bestCompMatch && bestCompMatch.current_price > 0) {
          const compPrice = bestCompMatch.current_price
          const diffPct = ((ourPrice - compPrice) / compPrice) * 100

          // Preço mais de 25% acima do concorrente
          if (diffPct > 25) {
            list.push({
              id: `radar_high_${item.id}`,
              type: 'price_competitor_high',
              severity: 'warning',
              title: `Preço Acima da Concorrência (+${Math.round(diffPct)}%)`,
              description: `Nosso preço (R$ ${ourPrice.toFixed(2)}) está bem acima de ${bestCompMatch.seller_nickname || 'concorrente'} (R$ ${compPrice.toFixed(2)}).`,
              item,
              competitorAd: bestCompMatch,
              diffPercent: diffPct,
            })
          } else if (diffPct < -25) {
            // Preço mais de 25% abaixo do concorrente (possível margem perdida)
            list.push({
              id: `radar_low_${item.id}`,
              type: 'price_competitor_low',
              severity: 'info',
              title: `Preço Abaixo da Concorrência (${Math.round(diffPct)}%)`,
              description: `Nosso preço (R$ ${ourPrice.toFixed(2)}) está significativamente abaixo de ${bestCompMatch.seller_nickname || 'concorrente'} (R$ ${compPrice.toFixed(2)}). Avalie aumentar a margem.`,
              item,
              competitorAd: bestCompMatch,
              diffPercent: diffPct,
            })
          }
        }
      }
    }

    return list
  }, [items, competitorAds])

  if (alerts.length === 0) return null

  const pausedCount = alerts.filter((a) => a.type === 'paused_long').length
  const unmatchedCount = alerts.filter((a) => a.type === 'unmatched_active').length
  const radarAlerts = alerts.filter(
    (a) => a.type === 'price_competitor_high' || a.type === 'price_competitor_low',
  )

  return (
    <Card className="border-amber-200 bg-amber-50/40 shadow-xs overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Alertas do Gestor ML
                <Badge className="bg-amber-600 text-white border-none font-bold text-[10px] px-1.5 py-0">
                  {alerts.length} alerta(s)
                </Badge>
              </h3>
              <p className="text-[11px] text-slate-600">
                Oportunidades de ajuste de preço, status e casamento de estoque detectadas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {pausedCount > 0 && onFilterPaused && (
              <button
                type="button"
                onClick={onFilterPaused}
                className="text-xs px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100 transition-colors inline-flex items-center gap-1"
              >
                <Clock className="w-3 h-3 text-amber-600" />
                {pausedCount} pausado(s)
              </button>
            )}

            {unmatchedCount > 0 && onFilterUnmatched && (
              <button
                type="button"
                onClick={onFilterUnmatched}
                className="text-xs px-2.5 py-1 rounded-md bg-white border border-amber-300 text-slate-800 font-semibold hover:bg-amber-100 transition-colors inline-flex items-center gap-1"
              >
                <PackageX className="w-3 h-3 text-slate-500" />
                {unmatchedCount} sem vínculo
              </button>
            )}

            {sellerAlertCount > 0 && (
              <button
                type="button"
                onClick={onNavigateToSellers}
                className="text-xs px-2.5 py-1 rounded-md bg-rose-100 border border-rose-300 text-rose-950 font-bold hover:bg-rose-200 transition-colors inline-flex items-center gap-1"
              >
                <Users className="w-3 h-3 text-rose-600" />
                {sellerAlertCount} alerta(s) de Sellers {tayAlert ? '(TAY TECH 401)' : ''}
              </button>
            )}

            {radarAlerts.length > 0 && (
              <Link to="/radar-ml">
                <span className="text-xs px-2.5 py-1 rounded-md bg-orange-100 border border-orange-300 text-orange-950 font-semibold hover:bg-orange-200 transition-colors inline-flex items-center gap-1">
                  <Radar className="w-3 h-3 text-orange-600" />
                  {radarAlerts.length} com desvio no Radar
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Amostra rápida dos alertas prioritários */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="p-2.5 rounded-lg bg-white border border-amber-200/90 text-xs flex flex-col justify-between space-y-1.5 shadow-2xs"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1 truncate">
                    {alert.type === 'price_competitor_high' && (
                      <TrendingUp className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    {alert.type === 'price_competitor_low' && (
                      <TrendingDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                    {alert.type === 'paused_long' && (
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                    {alert.type === 'unmatched_active' && (
                      <PackageX className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className="truncate">{alert.title}</span>
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                    {alert.item.id}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                  {alert.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                <span className="font-mono font-bold text-slate-800">
                  R$ {Number(alert.item.price || 0).toFixed(2)}
                </span>
                {alert.competitorAd && (
                  <span className="text-orange-700 font-medium">
                    Concorrente: R$ {alert.competitorAd.current_price?.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
