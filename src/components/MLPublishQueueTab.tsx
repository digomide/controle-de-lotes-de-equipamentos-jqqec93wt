import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { mlService } from '@/services/mlService'

export function MLPublishQueueTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'error' | 'all'>('error')

  const loadQueue = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const queueItems = await mlService.getPublishQueueItems({
        status: filter === 'all' ? 'all' : 'error',
        limit: 100,
      })
      setItems(queueItems)
    } catch (err: any) {
      console.error('Erro ao carregar fila de publicação:', err)
      toast({
        title: 'Erro ao carregar fila',
        description: err.message || 'Falha ao buscar itens da fila de publicação.',
        variant: 'destructive',
      })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
  }, [filter])

  const handleRetry = async (queueItem: any) => {
    setRetryingId(queueItem.id)
    try {
      await mlService.retryPublishQueueItem(queueItem.id)
      toast({
        title: 'Item reenviado para a fila!',
        description: 'O servidor reprocessará a publicação em segundo plano.',
      })
      await loadQueue(true)
    } catch (err: any) {
      console.error('Erro ao reenfileirar publicação:', err)
      toast({
        title: 'Falha ao reenfileirar',
        description: err.message || 'Não foi possível reprocessar este item.',
        variant: 'destructive',
      })
    } finally {
      setRetryingId(null)
    }
  }

  const errorCount = items.filter((i) => i.status === 'error').length

  return (
    <div className="space-y-6">
      {/* Topo Informativo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-rose-500/10 via-rose-400/5 to-transparent border border-rose-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Fila de Publicação & Erros
              {errorCount > 0 && (
                <Badge className="bg-rose-600 text-white border-none text-[10px] font-bold">
                  {errorCount} com falha
                </Badge>
              )}
            </h2>
            <p className="text-xs text-slate-600">
              Acompanhe anúncios que falharam ao publicar no Mercado Livre. Veja o motivo retornado
              pela API oficial e tente novamente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="bg-white p-1 rounded-lg border border-slate-200 flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setFilter('error')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filter === 'error'
                  ? 'bg-rose-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Com Erro ({errorCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos da Fila
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => loadQueue()}
            disabled={loading}
            className="text-xs h-8 border-slate-300 text-slate-700 hover:bg-slate-50 gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Lista de Itens com Falha */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-rose-500" />
          <p className="text-sm font-semibold text-slate-700">Carregando fila de publicações...</p>
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
          <CardContent className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">
              Nenhum erro na fila de publicação!
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {filter === 'error'
                ? 'Todas as publicações enviadas foram processadas com êxito ou não há falhas registradas.'
                : 'A fila de publicação está limpa no momento.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const product = item.expand?.product
            const payload = item.payload || {}
            const title = payload.title || product?.name || 'Equipamento sem título'
            const isError = item.status === 'error'

            return (
              <Card
                key={item.id}
                className={`border shadow-xs overflow-hidden transition-all ${
                  isError ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 bg-white'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isError ? (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold text-[10px] gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-600" /> Falha no envio
                          </Badge>
                        ) : item.status === 'done' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Publicado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-[10px] gap-1">
                            <Clock className="w-3 h-3 text-amber-600" /> Processando
                          </Badge>
                        )}

                        <span className="text-[11px] text-slate-400 font-mono">
                          ID Fila: {item.id}
                        </span>

                        {payload.category_id && (
                          <Badge variant="outline" className="text-[10px] font-mono text-slate-600">
                            Cat: {payload.category_id}
                          </Badge>
                        )}
                        {payload.price && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono font-bold text-slate-700"
                          >
                            R$ {Number(payload.price).toFixed(2)}
                          </Badge>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm truncate" title={title}>
                        {title}
                      </h4>

                      {/* Motivo do Erro Explícito */}
                      {item.error_message && (
                        <div className="p-2.5 rounded-lg bg-rose-100/70 border border-rose-300 text-xs text-rose-950 space-y-0.5">
                          <p className="font-bold flex items-center gap-1 text-[11px] text-rose-900">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                            Motivo retornado pelo Mercado Livre:
                          </p>
                          <p className="text-[11px] leading-relaxed break-words font-mono text-rose-900">
                            {item.error_message}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono pt-1">
                        <span>Tentativa: {new Date(item.created).toLocaleString('pt-BR')}</span>
                        {product?.sku && <span>SKU Interno: {product.sku}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      {isError && (
                        <Button
                          size="sm"
                          onClick={() => handleRetry(item)}
                          disabled={retryingId === item.id}
                          className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5 shadow-xs"
                        >
                          <RotateCcw
                            className={`w-3.5 h-3.5 ${retryingId === item.id ? 'animate-spin' : ''}`}
                          />
                          {retryingId === item.id ? 'Reenfileirando...' : 'Tentar novamente'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
