import React, { useState, useEffect, useRef } from 'react'
import {
  Bookmark,
  Copy,
  Check,
  Upload,
  FileJson,
  TrendingUp,
  HelpCircle,
  Database,
  Trash2,
  RefreshCw,
  Sparkles,
  Zap,
  Cpu,
  Key,
  Globe,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Activity,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  getBookmarkletScript,
  getTurboBookmarkletScript,
  getTampermonkeyUserscript,
  type MLCollectorPayload,
} from '@/lib/mlBookmarklet'
import { mlCollectorService, type MLCollectorImportRecord } from '@/services/mlCollectorService'
import { detectCollectorNoiseAd } from '@/lib/catalogFilter'
import type { MLCollectorResultItem } from '@/lib/mlBookmarklet'
import {
  positionOverridesService,
  type PositionOverrideAction,
} from '@/services/positionOverridesService'
import pb from '@/lib/pocketbase/client'

interface ColetorNavegadorPanelProps {
  initialSearchTerm?: string
  onImportApplied?: (imported: MLCollectorImportRecord) => void
}

export function ColetorNavegadorPanel({
  initialSearchTerm = '',
  onImportApplied,
}: ColetorNavegadorPanelProps) {
  const { toast } = useToast()
  const { logout } = useAuth()
  const navigate = useNavigate()

  // Chave de coleta e URL do backend PocketBase (para evitar erro HTTP 405 ao dar POST em frontend estático)
  const [collectorKey, setCollectorKey] = useState('')
  const [keyAuthError, setKeyAuthError] = useState(false)
  const [keyErrorMessage, setKeyErrorMessage] = useState<string | null>(null)
  const [backendUrl, setBackendUrl] = useState(() => {
    const pbUrl = pb.baseUrl
    if (pbUrl) return pbUrl
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return 'https://controle-de-lotes.app'
  })
  const [loadingKey, setLoadingKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Tabs do coletor: "tampermonkey", "turbo", "manual", "history"
  const [collectorMode, setCollectorMode] = useState<'tampermonkey' | 'turbo' | 'manual'>(
    'tampermonkey',
  )

  // Scripts gerados dinamicamente apontando para o backend PocketBase (POST /api/collections/ml_collector_imports/records com fallback /api/ml-collector/ingest)
  const manualScript = getBookmarkletScript()
  const currentAppOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const turboScript = getTurboBookmarkletScript({
    backendUrl,
    appUrl: currentAppOrigin,
    collectorKey,
  })
  const tampermonkeyScript = getTampermonkeyUserscript({
    backendUrl,
    appUrl: currentAppOrigin,
    collectorKey,
  })

  const [copiedManual, setCopiedManual] = useState(false)
  const [copiedTurbo, setCopiedTurbo] = useState(false)
  const [copiedTamper, setCopiedTamper] = useState(false)

  // Estados de formulário manual/upload
  const [searchTermInput, setSearchTermInput] = useState(initialSearchTerm)
  const [jsonInput, setJsonInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [previewPayload, setPreviewPayload] = useState<MLCollectorPayload | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Histórico
  const [history, setHistory] = useState<MLCollectorImportRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyAuthError, setHistoryAuthError] = useState(false)
  const [activeImportId, setActiveImportId] = useState<string | null>(null)

  // Gerenciamento de itens e ruído por coleta
  const [inspectingImport, setInspectingImport] = useState<MLCollectorImportRecord | null>(null)
  const [filterOnlyNoiseInModal, setFilterOnlyNoiseInModal] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // A chave é considerada válida se foi carregada e não começa com fallback inválido
  const hasValidKey = Boolean(
    collectorKey && !collectorKey.startsWith('mlk_default_') && !keyAuthError,
  )

  // Handler para redirecionar ao login com limpeza consistente do authStore
  function handleGoToLogin() {
    logout()
    navigate('/login')
  }

  // Carregar ou gerar chave de coleta
  async function loadCollectorKey() {
    setLoadingKey(true)
    setKeyAuthError(false)
    setKeyErrorMessage(null)
    try {
      const key = await mlCollectorService.getOrCreateCollectorKey(pb.authStore.record?.id)
      setCollectorKey(key)
    } catch (err: any) {
      console.warn('[ColetorNavegadorPanel] Erro ao carregar chave de coleta:', err)
      const isAuth = mlCollectorService.isAuthError(err)
      if (isAuth) {
        setKeyAuthError(true)
        setKeyErrorMessage('Sessão expirada — faça login para carregar sua chave de coleta.')
        setCollectorKey('')
        // Se a sessão expirou no backend, limpar auth local
        if (!pb.authStore.isValid) {
          logout()
        }
      } else {
        setKeyErrorMessage(err.message || 'Falha ao carregar chave de coleta.')
      }
    } finally {
      setLoadingKey(false)
    }
  }

  // Regenerar chave de coleta
  async function handleRegenerateKey() {
    if (keyAuthError || !hasValidKey) {
      handleGoToLogin()
      return
    }

    if (
      !confirm(
        'Deseja gerar uma nova chave de coleta? Se fizer isso, lembre-se de atualizar seus scripts no Tampermonkey.',
      )
    ) {
      return
    }
    setLoadingKey(true)
    try {
      const newKey = await mlCollectorService.regenerateCollectorKey(pb.authStore.record?.id)
      setCollectorKey(newKey)
      setKeyAuthError(false)
      setKeyErrorMessage(null)
      toast({
        title: 'Nova chave gerada com sucesso!',
        description: 'Copie novamente o script do Tampermonkey ou o Bookmarklet Turbo atualizados.',
      })
    } catch (err: any) {
      if (mlCollectorService.isAuthError(err)) {
        setKeyAuthError(true)
        setKeyErrorMessage('Sessão expirada. Faça login novamente.')
        logout()
      } else {
        toast({
          title: 'Erro ao regenerar chave',
          description: err.message || 'Tente novamente.',
          variant: 'destructive',
        })
      }
    } finally {
      setLoadingKey(false)
    }
  }

  // Copiar chave
  async function handleCopyKey() {
    if (!hasValidKey) {
      toast({
        title: 'Chave não disponível',
        description: 'Faça login para carregar uma chave de coleta válida.',
        variant: 'destructive',
      })
      return
    }
    try {
      await navigator.clipboard.writeText(collectorKey)
      setCopiedKey(true)
      toast({ title: 'Chave copiada!' })
      setTimeout(() => setCopiedKey(false), 2500)
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' })
    }
  }

  // Atualizar termo se a prop mudar
  useEffect(() => {
    if (initialSearchTerm && !searchTermInput) {
      setSearchTermInput(initialSearchTerm)
    }
  }, [initialSearchTerm])

  // Carregar histórico e chave ao montar
  useEffect(() => {
    loadHistory()
    loadCollectorKey()
  }, [])

  // Carregar histórico de coletas
  async function loadHistory() {
    setLoadingHistory(true)
    setHistoryAuthError(false)
    try {
      const list = await mlCollectorService.listRecentImports(40)
      setHistory(list)
    } catch (err: any) {
      console.warn('[ColetorNavegadorPanel] Falha ao carregar histórico:', err)
      if (mlCollectorService.isAuthError(err)) {
        setHistoryAuthError(true)
        setHistory([])
        // Desloga o cliente se a sessão estiver de fato morta
        if (!pb.authStore.isValid) {
          logout()
        }
      } else {
        toast({
          title: 'Falha ao carregar histórico',
          description: err.message || 'Verifique sua conexão.',
          variant: 'destructive',
        })
      }
    } finally {
      setLoadingHistory(false)
    }
  }

  // Parse dinâmico conforme o usuário digita/cola no textarea
  useEffect(() => {
    if (!jsonInput.trim()) {
      setPreviewPayload(null)
      setPreviewError(null)
      return
    }

    try {
      const parsed = mlCollectorService.parseAndValidatePayload(jsonInput)
      setPreviewPayload(parsed)
      setPreviewError(null)
      if (parsed.search_term && !searchTermInput) {
        setSearchTermInput(parsed.search_term)
      }
    } catch (err: any) {
      setPreviewPayload(null)
      setPreviewError(err.message || 'JSON inválido.')
    }
  }, [jsonInput])

  // Upload de arquivo .json
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setJsonInput(content)
        toast({
          title: 'Arquivo carregado',
          description: `Arquivo ${file.name} carregado. Verifique os dados abaixo e clique em Salvar Coleta.`,
        })
      }
    }
    reader.onerror = () => {
      toast({
        title: 'Erro ao ler arquivo',
        description: 'Não foi possível ler o arquivo .json selecionado.',
        variant: 'destructive',
      })
    }
    reader.readAsText(file)
  }

  // Salvar importação manual no PocketBase
  async function handleSaveImport() {
    const term = (searchTermInput || previewPayload?.search_term || '').trim()
    if (!term) {
      toast({
        title: 'Informe o termo de busca',
        description: 'Identifique a qual busca ou produto exato estes dados pertencem.',
        variant: 'destructive',
      })
      return
    }

    if (!previewPayload) {
      toast({
        title: 'Nenhum dado válido para importar',
        description: previewError || 'Cole o JSON gerado pelo coletor.',
        variant: 'destructive',
      })
      return
    }

    setImporting(true)
    try {
      const record = await mlCollectorService.saveCollectorImport({
        searchTerm: term,
        payload: previewPayload,
        sourceUrl: previewPayload.source_url,
        notes: previewPayload.source || 'manual',
      })

      toast({
        title: 'Coleta importada com sucesso!',
        description: `${record.results_count} anúncios lidos (${record.with_sales_count} com vendas explícitas) registrados para "${term}".`,
      })

      setJsonInput('')
      setPreviewPayload(null)
      setActiveImportId(record.id)
      await loadHistory()

      if (onImportApplied) {
        onImportApplied(record)
      }
    } catch (err: any) {
      if (mlCollectorService.isAuthError(err)) {
        toast({
          title: 'Sessão expirada',
          description: 'Sua sessão expirou. Faça login novamente.',
          variant: 'destructive',
        })
        handleGoToLogin()
        return
      }
      toast({
        title: 'Falha ao salvar coleta',
        description: err.message || 'Erro ao registrar no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  // Deletar item do histórico
  async function handleDeleteHistory(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Deseja excluir esta coleta salva?')) return
    try {
      const ok = await mlCollectorService.deleteImport(id)
      if (ok) {
        toast({ title: 'Coleta removida' })
        loadHistory()
        if (activeImportId === id) setActiveImportId(null)
      } else {
        toast({
          title: 'Não foi possível remover',
          description: 'Verifique se sua sessão tem permissão para remover coletas.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      if (mlCollectorService.isAuthError(err)) {
        handleGoToLogin()
      }
    }
  }

  // Aplicar uma coleta do histórico
  function handleSelectHistoryItem(item: MLCollectorImportRecord) {
    setActiveImportId(item.id)
    if (onImportApplied) {
      onImportApplied(item)
      toast({
        title: `Coleta aplicada: "${item.search_term}"`,
        description: 'As métricas do Raio-X foram atualizadas com as vendas desta coleta.',
      })
    }
  }

  // Helper para obter métricas de ruído de um registro do histórico
  function getImportNoiseStats(record: MLCollectorImportRecord): {
    total: number
    noiseCount: number
    noisePercent: number
  } {
    const payload = mlCollectorService.decodePayload(record.payload)
    const results = payload?.results || []
    const total = results.length || record.results_count || 0
    if (!total) return { total: 0, noiseCount: 0, noisePercent: 0 }

    let noiseCount = 0
    for (const it of results) {
      const check = detectCollectorNoiseAd(it.title || '', record.search_term)
      if (check.isNoise) {
        noiseCount++
      }
    }
    const noisePercent = total > 0 ? Math.round((noiseCount / total) * 100) : 0
    return { total, noiseCount, noisePercent }
  }

  // Remover item de uma coleta com persistência
  async function handleRemoveItemFromImport(importId: string, itemMlbId: string) {
    setDeletingItemId(itemMlbId)
    try {
      const success = await mlCollectorService.removeItemFromImport(importId, itemMlbId)
      if (success) {
        toast({
          title: 'Item removido da coleta!',
          description: `O anúncio ${itemMlbId} foi excluído da coleta salva e recalculado no banco.`,
        })

        // Atualizar lista de histórico localmente
        await loadHistory()

        // Se a modal estiver inspecionando esta coleta, atualizar o item inspecionado
        if (inspectingImport && inspectingImport.id === importId) {
          const fresh = await pb
            .collection('ml_collector_imports')
            .getOne<MLCollectorImportRecord>(importId)
          setInspectingImport(fresh)
          if (activeImportId === importId && onImportApplied) {
            onImportApplied(fresh)
          }
        }
      } else {
        toast({
          title: 'Falha ao remover item',
          description: 'Não foi possível encontrar ou excluir o item na coleta.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao remover',
        description: err.message || 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeletingItemId(null)
    }
  }

  // Copiadores de scripts com validação obrigatória de chave para os scripts automatizados
  async function copyScript(text: string, type: 'manual' | 'turbo' | 'tamper') {
    if (type !== 'manual' && !hasValidKey) {
      toast({
        title: 'Chave de coleta obrigatória',
        description:
          'Faça login para carregar sua chave antes de copiar o script. Enviar com chave inválida fará o servidor recusar a coleta.',
        variant: 'destructive',
      })
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      if (type === 'manual') {
        setCopiedManual(true)
        setTimeout(() => setCopiedManual(false), 3000)
        toast({ title: 'Código do Favorito Manual copiado!' })
      } else if (type === 'turbo') {
        setCopiedTurbo(true)
        setTimeout(() => setCopiedTurbo(false), 3000)
        toast({ title: 'Código do Coletor Turbo copiado!' })
      } else {
        setCopiedTamper(true)
        setTimeout(() => setCopiedTamper(false), 3000)
        toast({ title: 'Userscript do Tampermonkey copiado!' })
      }
    } catch {
      toast({ title: 'Erro ao copiar código', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal */}
      <Card className="border-indigo-900/60 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    Coletores do Mercado Livre
                    <Badge className="bg-emerald-500 text-slate-950 text-[10px] font-bold">
                      Bypass WAF 100% Legal
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-300">
                    O Mercado Livre bloqueia servidores que tentam raspar contadores de vendas (+500
                    vendidos, +5 mil vendidos). Com estes coletores, seu navegador contorna o WAF e
                    sincroniza os dados reais com o Raio-X.
                  </p>
                </div>
              </div>
            </div>

            {/* Painel de Credencial / Chave de Coleta */}
            <div className="p-3 bg-slate-900/90 border border-slate-700/80 rounded-lg text-xs space-y-2 shrink-0 w-full lg:w-auto">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Sua Chave de Coleta
                </span>
                {hasValidKey ? (
                  <button
                    type="button"
                    onClick={handleRegenerateKey}
                    disabled={loadingKey}
                    className="text-[10px] text-slate-400 hover:text-amber-300 underline"
                    title="Gerar nova chave de coleta"
                  >
                    Regenerar
                  </button>
                ) : null}
              </div>

              {keyAuthError ? (
                <div className="p-2 bg-rose-950/80 border border-rose-800/80 rounded text-[11px] text-rose-200 space-y-1.5 max-w-[280px]">
                  <div className="flex items-center gap-1.5 font-bold text-rose-300">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>Sessão Expirada</span>
                  </div>
                  <p className="text-[10px] leading-tight text-rose-200/90">
                    Faça login novamente para carregar sua chave de coleta de verdade.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleGoToLogin}
                    className="h-6 text-[10px] px-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold w-full"
                  >
                    Entrar novamente
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-slate-950 text-emerald-400 rounded font-mono text-xs border border-slate-800 select-all max-w-[200px] truncate">
                    {loadingKey ? 'Carregando chave...' : collectorKey || 'Nenhuma chave ativa'}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyKey}
                    disabled={!hasValidKey || loadingKey}
                    className="h-7 px-2.5 text-xs text-slate-200 border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {copiedKey ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedKey ? 'Copiada' : 'Copiar'}
                  </Button>
                </div>
              )}

              {keyErrorMessage && !keyAuthError && (
                <p className="text-[10px] text-amber-400">{keyErrorMessage}</p>
              )}

              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Globe className="w-3 h-3 text-indigo-400" />
                <span>Endpoint Ingestão: </span>
                <span
                  className="font-mono text-slate-300"
                  title="API nativa com validação por chave no hook"
                >
                  {backendUrl
                    ? `${backendUrl.replace(/\/+$/, '')}/api/collections/ml_collector_imports/records`
                    : '/api/collections/ml_collector_imports/records'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuração de URL do Backend PocketBase */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>URL do Backend PocketBase:</strong> Usada pelos scripts para enviar os dados via
            POST direto à API padrão da collection com validação de chave (evita 404 e HTTP 405 de
            servidor estático).
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value.trim())}
            placeholder="https://sua-instancia-pocketbase"
            className="h-8 text-xs font-mono w-full sm:w-80 bg-white"
          />
        </div>
      </div>

      {/* Tabs de Seleção do Coletor: Automático (Tampermonkey) vs Turbo Multi-páginas vs Manual */}
      <Tabs
        value={collectorMode}
        onValueChange={(val) => setCollectorMode(val as any)}
        className="w-full space-y-4"
      >
        <TabsList className="grid grid-cols-3 p-1 bg-slate-100 border border-slate-200 rounded-lg">
          <TabsTrigger
            value="tampermonkey"
            className="text-xs font-bold flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            1. Coletor Automático (Tampermonkey)
            <Badge className="bg-indigo-600 text-white text-[9px] px-1 py-0 h-4">Sem Clique</Badge>
          </TabsTrigger>

          <TabsTrigger
            value="turbo"
            className="text-xs font-bold flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            2. Coletor Turbo (Favorito Multi-páginas)
            <Badge className="bg-amber-500 text-slate-950 text-[9px] px-1 py-0 h-4 font-bold">
              1 Clique
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="manual"
            className="text-xs font-bold flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
          >
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            3. Coletor Manual (Página Atual)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: COLETOR AUTOMÁTICO (TAMPERMONKEY) */}
        <TabsContent value="tampermonkey" className="space-y-4 outline-hidden">
          <Card className="border-indigo-200 bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-indigo-100 bg-indigo-50/50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-indigo-950 flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-indigo-600" />
                      Coletor Automático com Tampermonkey v1.3.2 (Zero Clique)
                    </CardTitle>
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                      Recomendado
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-indigo-700 border-indigo-300 text-[10px] font-bold"
                    >
                      v1.3.2 Atualizada
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-600">
                    Roda em segundo plano enquanto você navega no Mercado Livre. Detecta as buscas,
                    lê vendas reais, exibe o HUD ativo imediatamente em qualquer página do ML e
                    sincroniza tudo com o app de Lotes. Se você já instalou antes,{' '}
                    <strong>copie novamente e substitua no Tampermonkey</strong> para aplicar a
                    v1.3.2 com o HUD sempre visível e suporte a todas as variações de busca.
                  </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                  {!hasValidKey && (
                    <span className="text-[11px] text-amber-600 font-medium">
                      {keyAuthError
                        ? 'Login necessário para liberar script'
                        : 'Carregando chave...'}
                    </span>
                  )}
                  <Button
                    onClick={() => copyScript(tampermonkeyScript, 'tamper')}
                    disabled={!hasValidKey}
                    className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-xs gap-2 shrink-0 shadow-xs"
                    title={
                      !hasValidKey ? 'Faça login para carregar sua chave de coleta' : undefined
                    }
                  >
                    {copiedTamper ? (
                      <Check className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copiedTamper ? 'Userscript Copiado!' : 'Copiar Userscript Tampermonkey'}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Instruções de instalação em 4 passos */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <strong className="text-xs text-slate-900">Instale a Extensão</strong>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Instale a extensão gratuita <strong>Tampermonkey</strong> na Chrome Web Store
                    (ou Edge / Firefox).
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <strong className="text-xs text-slate-900">Criar Novo Script</strong>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Clique no ícone do Tampermonkey no navegador e selecione{' '}
                    <strong>&quot;Criar novo script...&quot;</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <strong className="text-xs text-slate-900">Cole o Código e Salve</strong>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Substitua o conteúdo pelo código copiado no botão acima e salve com{' '}
                    <kbd className="font-mono text-[10px] px-1 bg-slate-200 rounded">Ctrl+S</kbd>.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      4
                    </span>
                    <strong className="text-xs text-slate-900">Pronto! Use o ML</strong>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Abra qualquer busca no Mercado Livre. Um HUD flutuante &quot;Coletor Lotes&quot;
                    aparecerá no canto inferior direito mostrando anúncios e vendas lidas, enviando
                    direto ao banco com botão de Reenviar se necessário.
                  </p>
                </div>
              </div>

              {/* Características e Preview do Script */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileJson className="w-3.5 h-3.5 text-indigo-600" />
                    Código Completo do Userscript (com sua Chave e URL embutidas)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyScript(tampermonkeyScript, 'tamper')}
                    disabled={!hasValidKey}
                    className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 font-bold underline"
                  >
                    Copiar Script Completo
                  </button>
                </div>
                {!hasValidKey ? (
                  <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-center space-y-2">
                    <p className="text-xs text-amber-400 font-medium">
                      {keyAuthError
                        ? 'Sessão expirada — faça login para visualizar e copiar o Userscript com sua chave real.'
                        : 'Carregando chave de coleta...'}
                    </p>
                    {keyAuthError && (
                      <Button
                        size="sm"
                        onClick={handleGoToLogin}
                        className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                      >
                        Entrar novamente
                      </Button>
                    )}
                  </div>
                ) : (
                  <Textarea
                    value={tampermonkeyScript}
                    readOnly
                    rows={8}
                    className="font-mono text-[11px] bg-slate-900 text-emerald-400 border-slate-700"
                  />
                )}
              </div>

              {/* Recursos inclusos no Userscript */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Deduplicação por MLB ID</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Envio automático com debounce (12s)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>HUD flutuante discreto com status</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: COLETOR TURBO MULTI-PÁGINAS (BOOKMARKLET) */}
        <TabsContent value="turbo" className="space-y-4 outline-hidden">
          <Card className="border-amber-200 bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-amber-100 bg-amber-50/50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-amber-950 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Coletor Turbo Multi-páginas (Bookmarklet de 1 Clique)
                    </CardTitle>
                    <Badge className="bg-amber-500 text-slate-950 text-[10px] font-bold">
                      Até 20 Páginas
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-600">
                    Instalado como favorito no navegador. Ao clicar nele numa busca do Mercado
                    Livre, ele segue sozinho o botão de próxima página, acumula centenas de anúncios
                    deduplicados e envia ao app com 1 clique.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => copyScript(turboScript, 'turbo')}
                    disabled={!hasValidKey}
                    className="h-9 px-5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:text-slate-500 text-slate-950 font-bold text-xs gap-2 shadow-xs"
                    title={
                      !hasValidKey ? 'Faça login para carregar sua chave de coleta' : undefined
                    }
                  >
                    {copiedTurbo ? (
                      <Check className="w-4 h-4 text-slate-950" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copiedTurbo ? 'Código Copiado!' : 'Copiar Código Turbo'}
                  </Button>
                  {hasValidKey ? (
                    <Button
                      variant="outline"
                      className="h-9 text-xs border-amber-300 text-amber-950 bg-amber-50 hover:bg-amber-100"
                      asChild
                    >
                      <a
                        href={turboScript}
                        onClick={(e) => {
                          e.preventDefault()
                          toast({
                            title: 'Arraste para os Favoritos',
                            description:
                              'Arraste este botão para a sua Barra de Favoritos (Ctrl+Shift+B) ou use o botão "Copiar Código Turbo".',
                          })
                        }}
                        title="Arraste para a Barra de Favoritos do Chrome"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500 mr-1.5" />
                        Arraste p/ Favoritos
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                  <strong className="text-xs text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                      1
                    </span>
                    Crie o Favorito no Chrome
                  </strong>
                  <p className="text-[11px] text-slate-600">
                    Crie um novo favorito no Chrome com o nome de{' '}
                    <strong>&quot;⚡ Turbo ML&quot;</strong> e cole o código copiado no campo{' '}
                    <strong>URL</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                  <strong className="text-xs text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                      2
                    </span>
                    Clique na Busca do ML
                  </strong>
                  <p className="text-[11px] text-slate-600">
                    Abra uma busca no Mercado Livre (ex.: <em>cooler lenovo m900</em>) e clique no
                    favorito &quot;⚡ Turbo ML&quot;.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                  <strong className="text-xs text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                      3
                    </span>
                    Varredura & Envio Direto
                  </strong>
                  <p className="text-[11px] text-slate-600">
                    O painel varrerá as páginas 1, 2, 3... e no final basta clicar no botão{' '}
                    <strong>&quot;🚀 Enviar ao App&quot;</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Segurança e Gentileza com o Mercado Livre:
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  O Coletor Turbo inclui um delay seguro (~1,4 segundos) entre cada página para
                  navegar de maneira natural sob a sessão ativa do usuário, respeitando limites e
                  coletando até 20 páginas por clique sem disparar captchas.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: COLETOR MANUAL ORIGINAL (PÁGINA ATUAL) */}
        <TabsContent value="manual" className="space-y-4 outline-hidden">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-blue-600" />
                  Coletor Manual (Página Atual)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Bookmarklet clássico que extrai os dados apenas da página onde você estiver no
                  momento.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => copyScript(manualScript, 'manual')}
                  className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                >
                  {copiedManual ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedManual ? 'Copiado!' : 'Copiar Código'}
                </Button>
                <Button
                  variant="outline"
                  className="h-8 text-xs text-slate-700 border-slate-300 bg-white hover:bg-slate-50"
                  asChild
                >
                  <a
                    href={manualScript}
                    onClick={(e) => {
                      e.preventDefault()
                      toast({
                        title: 'Arraste para os Favoritos',
                        description:
                          'Arraste este botão para a sua Barra de Favoritos (Ctrl+Shift+B).',
                      })
                    }}
                  >
                    Arraste p/ Favoritos
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-xs text-slate-600">
                Gera um modal overlay nativo no DOM do Mercado Livre com opções de copiar JSON ou
                baixar o arquivo .json para importação manual no formulário abaixo.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Formulário de Importação: Colar JSON ou Upload de Arquivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-slate-200 shadow-xs bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-blue-600" />
                  Importar ou Visualizar JSON de Coleta
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Cole o JSON copiado do navegador ou faça upload do arquivo .json
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs h-8 gap-1.5 border-slate-300"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload .json
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Termo de Busca / Produto Exato</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Será vinculado às buscas do Raio-X
                  </span>
                </label>
                <Input
                  value={searchTermInput}
                  onChange={(e) => setSearchTermInput(e.target.value)}
                  placeholder="Ex.: cooler lenovo m900, thinkpad t480, latitude 5420..."
                  className="h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileJson className="w-3.5 h-3.5 text-blue-600" />
                    Conteúdo JSON da Coleta
                  </label>
                  {jsonInput && (
                    <button
                      type="button"
                      onClick={() => setJsonInput('')}
                      className="text-[10px] text-slate-400 hover:text-rose-600 underline"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <Textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='Cole aqui o JSON gerado pelo coletor (começa com {"version": "1.1.0", "results": [...]})'
                  rows={8}
                  className="font-mono text-xs bg-slate-50 border-slate-200 focus:bg-white resize-y"
                />
              </div>

              {previewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Formato Inválido:</strong> {previewError}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  disabled={importing || !previewPayload}
                  onClick={handleSaveImport}
                  className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 shadow-xs"
                >
                  {importing ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  {importing ? 'Importando e Vinculando...' : 'Importar Coleta para o Raio-X'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pré-visualização do que foi lido */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-200 shadow-xs bg-white h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Feedback da Leitura
                </span>
                {previewPayload && (
                  <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                    ✓ Validado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Resumo dos contadores extraídos antes de salvar
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
              {previewPayload ? (
                <div className="space-y-4">
                  {/* Grade de estatísticas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Anúncios Lidos
                      </span>
                      <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                        {previewPayload.results_count}
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                        Com Vendas Explícitas
                      </span>
                      <span className="text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
                        {previewPayload.with_sales_count}
                      </span>
                    </div>
                  </div>

                  {previewPayload.source_url && (
                    <div className="text-[11px] text-slate-500 truncate">
                      <strong>Origem:</strong>{' '}
                      <span className="font-mono text-[10px]">{previewPayload.source_url}</span>
                    </div>
                  )}

                  {/* Amostra dos primeiros anúncios lidos */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                      Exemplos Lidos da Página:
                    </span>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-md p-2 bg-slate-50/50">
                      {previewPayload.results.slice(0, 5).map((item, i) => (
                        <div
                          key={i}
                          className="p-2 bg-white rounded border border-slate-200 text-xs space-y-1 shadow-2xs"
                        >
                          <div className="font-semibold text-slate-800 line-clamp-1">
                            {item.title}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              {item.price
                                ? item.price.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })
                                : 'Preço não lido'}
                            </span>
                            {item.sold_quantity != null ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono">
                                🔥 {item.sold_quantity} vendidos
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 text-[9px]">
                                Vendas não visíveis
                              </Badge>
                            )}
                          </div>
                          {item.seller_name && (
                            <div className="text-[10px] text-slate-400 truncate">
                              Seller: {item.seller_name}
                            </div>
                          )}
                        </div>
                      ))}
                      {previewPayload.results.length > 5 && (
                        <div className="text-center text-[10px] text-slate-400 pt-1">
                          + {previewPayload.results.length - 5} outros anúncios no payload
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-lg">
                  <FileJson className="w-8 h-8 text-slate-300" />
                  <p className="text-xs">
                    Cole o código JSON ao lado para ver o resumo de anúncios e contadores de vendas
                    capturados.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico de Coletas Salvas */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" />
              Histórico de Coletas do Navegador
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Coletas salvas ficam vinculadas ao termo de pesquisa e alimentam o Raio-X
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={loadingHistory}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {historyAuthError ? (
            <div className="text-center py-10 px-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 max-w-lg mx-auto my-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-950">
                  Sessão Expirada ou Não Autenticada
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  As coletas do Tampermonkey continuam sendo gravadas com sucesso no banco, mas sua
                  sessão no navegador expirou ou foi invalidada (ex: alteração de senha). Faça login
                  novamente para visualizar o histórico de coletas e carregar sua chave.
                </p>
              </div>
              <Button
                onClick={handleGoToLogin}
                className="h-9 px-6 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-2"
              >
                Entrar novamente
              </Button>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Nenhuma coleta realizada ainda. Execute o Tampermonkey, Coletor Turbo ou Bookmarklet
              na busca do Mercado Livre para iniciar!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((item) => {
                const isSelected = activeImportId === item.id
                const originNote = (item.notes || '').toLowerCase()
                const isAuto = originNote.includes('auto')
                const isTurbo = originNote.includes('turbo')

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectHistoryItem(item)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer space-y-2 relative ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          {isAuto ? (
                            <Badge className="bg-indigo-100 text-indigo-900 border-indigo-200 text-[9px] px-1.5 py-0 h-4 font-bold">
                              ⚡ Automático (Tampermonkey)
                            </Badge>
                          ) : isTurbo ? (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] px-1.5 py-0 h-4 font-bold">
                              ⚡ Turbo Multi-páginas
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-slate-600 text-[9px] px-1.5 py-0 h-4"
                            >
                              Manual
                            </Badge>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {item.search_term}
                        </h4>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteHistory(item.id, e)}
                        className="h-6 w-6 text-slate-400 hover:text-rose-600 -mr-1"
                        title="Excluir coleta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {item.results_count || 0} anúncios
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono font-bold">
                        🔥 {item.with_sales_count || 0} com vendas
                      </Badge>
                      {(() => {
                        const noiseStats = getImportNoiseStats(item)
                        if (noiseStats.noiseCount > 0) {
                          return (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-900 border-amber-300 text-[10px] font-medium"
                              title={`${noiseStats.noiseCount} de ${noiseStats.total} anúncios parecem fora de contexto`}
                            >
                              ⚠️ {noiseStats.noiseCount} de {noiseStats.total} fora de contexto
                            </Badge>
                          )
                        }
                        return (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                          >
                            ✓ 0 ruídos
                          </Badge>
                        )
                      })()}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>
                        {item.imported_at ? new Date(item.imported_at).toLocaleString('pt-BR') : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setInspectingImport(item)
                            setFilterOnlyNoiseInModal(false)
                          }}
                          className="text-slate-600 hover:text-indigo-600 underline font-medium"
                          title="Ver anúncios coletados e excluir ruídos"
                        >
                          Gerenciar itens
                        </button>
                        <span className="text-indigo-600 font-bold flex items-center gap-0.5">
                          {isSelected ? '✓ Aplicado' : 'Reaplicar →'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Inspecionar e Excluir Itens com Persistência */}
      <Dialog
        open={Boolean(inspectingImport)}
        onOpenChange={(open) => {
          if (!open) {
            setInspectingImport(null)
            setFilterOnlyNoiseInModal(false)
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
          {inspectingImport && (() => {
            const payload = mlCollectorService.decodePayload(inspectingImport.payload)
            const allItems: MLCollectorResultItem[] = payload?.results || []
            const noiseItems = allItems.filter(
              (it) => detectCollectorNoiseAd(it.title || '', inspectingImport.search_term).isNoise,
            )
            const displayedItems = filterOnlyNoiseInModal ? noiseItems : allItems

            return (
              <>
                <DialogHeader className="pb-3 border-b border-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>Gerenciar Itens da Coleta:</span>
                        <span className="text-indigo-600">"{inspectingImport.search_term}"</span>
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500 mt-1">
                        Exclua itens irrelevantes ou fora de contexto. A exclusão é salva no banco e
                        recalcula os totais e vendas da coleta.
                      </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {allItems.length} total
                      </Badge>
                      {noiseItems.length > 0 ? (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs font-semibold">
                          ⚠️ {noiseItems.length} ruídos detectados
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
                          ✓ Nenhum ruído detectado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Filtro de exibição */}
                  <div className="flex items-center justify-between pt-3 mt-1">
                    <div className="flex items-center gap-2 text-xs">
                      <Button
                        size="sm"
                        variant={!filterOnlyNoiseInModal ? 'default' : 'outline'}
                        onClick={() => setFilterOnlyNoiseInModal(false)}
                        className="h-7 text-xs"
                      >
                        Todos ({allItems.length})
                      </Button>
                      <Button
                        size="sm"
                        variant={filterOnlyNoiseInModal ? 'default' : 'outline'}
                        onClick={() => setFilterOnlyNoiseInModal(true)}
                        className="h-7 text-xs gap-1.5"
                      >
                        <Filter className="w-3 h-3" />
                        Apenas fora de contexto ({noiseItems.length})
                      </Button>
                    </div>

                    {noiseItems.length > 0 && !filterOnlyNoiseInModal && (
                      <span className="text-[11px] text-amber-700 font-medium">
                        Dica: use o filtro para revisar os {noiseItems.length} itens suspeitos.
                      </span>
                    )}
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2 pr-1">
                  {displayedItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      {filterOnlyNoiseInModal
                        ? 'Nenhum anúncio marcado como ruído nesta coleta!'
                        : 'Nenhum anúncio nesta coleta.'}
                    </div>
                  ) : (
                    displayedItems.map((item, idx) => {
                      const noiseCheck = detectCollectorNoiseAd(
                        item.title || '',
                        inspectingImport.search_term,
                      )
                      const isNoise = noiseCheck.isNoise
                      const itemId = item.id || item.mlb_id || `item_${idx}`
                      const isDeleting = deletingItemId === itemId

                      return (
                        <div
                          key={itemId}
                          className={`p-3 flex items-start justify-between gap-3 transition-colors ${
                            isNoise ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-400 font-semibold">
                                #{idx + 1}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-700">
                                {item.mlb_id || item.id}
                              </span>
                              {isNoise && (
                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold">
                                  ⚠️ Fora de contexto
                                </Badge>
                              )}
                              {item.sold_quantity != null && item.sold_quantity > 0 ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono font-bold">
                                  🔥 {item.sold_quantity} vendas
                                </Badge>
                              ) : null}
                              {item.price != null && item.price > 0 ? (
                                <span className="text-xs text-slate-600 font-medium">
                                  {item.price.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </span>
                              ) : null}
                            </div>

                            <p className="text-xs text-slate-900 font-medium leading-snug">
                              {item.title}
                            </p>

                            {isNoise && noiseCheck.reason && (
                              <p className="text-[11px] text-amber-800 italic">
                                Motivo: {noiseCheck.reason}
                              </p>
                            )}

                            {item.permalink && (
                              <a
                                href={item.permalink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 underline mt-0.5"
                              >
                                Ver no Mercado Livre <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>

                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isDeleting}
                            onClick={() =>
                              handleRemoveItemFromImport(
                                inspectingImport.id,
                                item.id || item.mlb_id || '',
                              )
                            }
                            className="h-7 text-xs px-2.5 shrink-0 bg-rose-600 hover:bg-rose-700"
                            title="Excluir este item da coleta permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            {isDeleting ? 'Excluindo...' : 'Excluir'}
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
