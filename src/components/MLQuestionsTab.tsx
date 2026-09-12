import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  MessageSquare,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bot,
  User,
  ShoppingBag,
  ExternalLink,
  Send,
  Sparkles,
  Settings,
  BookOpen,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  Lightbulb,
  Award,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  mlQuestionsService,
  MLQuestionRecord,
  MLQuestionsConfig,
  MLQuestionTemplate,
  MLQuestionMetrics,
} from '@/services/mlQuestionsService'
import { mlCustomersService } from '@/services/mlCustomersService'
import type { MLCustomer } from '@/types/customers'

interface MLQuestionsTabProps {
  onRefreshBadge?: () => void
}

export function MLQuestionsTab({ onRefreshBadge }: MLQuestionsTabProps) {
  // Estados principais
  const [questions, setQuestions] = useState<MLQuestionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<MLQuestionRecord | null>(null)
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'unanswered' | 'auto_replied' | 'answered'
  >('all')
  const [search, setSearch] = useState('')

  // Configuração & Auto-resposta
  const [config, setConfig] = useState<MLQuestionsConfig | null>(null)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false)
  const [autoReplyText, setAutoReplyText] = useState('')

  // Resposta atual & Envio
  const [answerDraft, setAnswerDraft] = useState('')
  const [sendingAnswer, setSendingAnswer] = useState(false)
  const [saveAnswerAsTemplate, setSaveAnswerAsTemplate] = useState(false)
  const [templateTitleDraft, setTemplateTitleDraft] = useState('')

  // Templates inteligentes & CRM
  const [templates, setTemplates] = useState<MLQuestionTemplate[]>([])
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false)
  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const [newTemplateTitle, setNewTemplateTitle] = useState('')
  const [newTemplateCategory, setNewTemplateCategory] = useState('geral')
  const [newTemplateKeywords, setNewTemplateKeywords] = useState('')
  const [newTemplateContent, setNewTemplateContent] = useState('')
  const [newTemplateStockPlaceholder, setNewTemplateStockPlaceholder] = useState(false)

  // CRM do Comprador
  const [buyerCrm, setBuyerCrm] = useState<MLCustomer | null>(null)
  const [loadingCrm, setLoadingCrm] = useState(false)

  // Estoque real do produto correspondente
  const [matchingStockCount, setMatchingStockCount] = useState<number | null>(null)
  const [loadingStock, setLoadingStock] = useState(false)

  // Métricas & Insights
  const [metrics, setMetrics] = useState<MLQuestionMetrics | null>(null)

  // Polling automático (60s)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    const runPolling = async () => {
      try {
        await mlQuestionsService.syncQuestions()
        loadQuestions(false)
        loadMetrics()
        onRefreshBadge?.()
      } catch {
        /* intentionally ignored */
      }
    }

    interval = setInterval(runPolling, 60000)
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [onRefreshBadge])

  // Carga inicial
  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadQuestions(true), loadConfig(), loadTemplates(), loadMetrics()])
    setLoading(false)
  }

  const loadConfig = async () => {
    try {
      const cfg = await mlQuestionsService.getConfig()
      if (cfg) {
        setConfig(cfg)
        setAutoReplyEnabled(cfg.auto_reply_enabled)
        setAutoReplyText(cfg.auto_reply_text || '')
      }
    } catch (err) {
      console.error('Erro ao carregar config ML:', err)
    }
  }

  const loadTemplates = async () => {
    try {
      const list = await mlQuestionsService.getTemplates()
      setTemplates(list)
    } catch (err) {
      console.error('Erro ao carregar templates:', err)
    }
  }

  const loadMetrics = async () => {
    try {
      const m = await mlQuestionsService.getMetrics()
      setMetrics(m)
      onRefreshBadge?.()
    } catch (err) {
      console.error('Erro ao carregar métricas:', err)
    }
  }

  const loadQuestions = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const res = await mlQuestionsService.listQuestions({
        filterStatus,
        search,
      })
      setQuestions(res.items)
      // Se tiver uma pergunta selecionada, atualiza seu estado
      if (selectedQuestion) {
        const updated = res.items.find((q) => q.question_id === selectedQuestion.question_id)
        if (updated) setSelectedQuestion(updated)
      } else if (res.items.length > 0 && !selectedQuestion) {
        setSelectedQuestion(res.items[0])
      }
    } catch (err) {
      console.error('Erro ao carregar perguntas:', err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Recarregar quando filtros mudarem
  useEffect(() => {
    loadQuestions(false)
  }, [filterStatus, search])

  // Sincronização manual com a API do ML
  const handleManualSync = async () => {
    setSyncing(true)
    try {
      const res = await mlQuestionsService.syncQuestions()
      toast({
        title: 'Central de Perguntas sincronizada',
        description: `${res.total_unanswered_in_ml} pendentes no ML. ${res.saved_count} registradas/atualizadas.${
          res.auto_replied_count > 0
            ? ` ⚡ ${res.auto_replied_count} auto-respostas iniciais enviadas!`
            : ''
        }`,
      })
      await loadQuestions(false)
      await loadMetrics()
      onRefreshBadge?.()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: err?.message || 'Falha ao sincronizar com Mercado Livre.',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Carregar dados de CRM e Estoque ao trocar de pergunta
  useEffect(() => {
    if (!selectedQuestion) {
      setBuyerCrm(null)
      setMatchingStockCount(null)
      return
    }

    setAnswerDraft('')
    setSaveAnswerAsTemplate(false)
    setTemplateTitleDraft('')

    // 1. CRM do comprador
    const loadCrmData = async () => {
      setLoadingCrm(true)
      try {
        if (selectedQuestion.buyer_id || selectedQuestion.buyer_nickname) {
          const qList = await mlCustomersService.getCustomers({
            search: selectedQuestion.buyer_id || selectedQuestion.buyer_nickname,
            perPage: 1,
          })
          if (qList.items.length > 0) {
            setBuyerCrm(qList.items[0])
          } else {
            setBuyerCrm(null)
          }
        } else {
          setBuyerCrm(null)
        }
      } catch (_) {
        setBuyerCrm(null)
      } finally {
        setLoadingCrm(false)
      }
    }

    // 2. Estoque real do produto anunciado
    const loadStockData = async () => {
      setLoadingStock(true)
      try {
        let stock = 0
        // Procurar por ml_listing_id igual ao item_id da pergunta
        const directProducts = await pb.collection('products').getFullList({
          filter: `ml_listing_id = "${selectedQuestion.item_id}" && status = "Disponível"`,
          fields: 'id',
        })

        if (directProducts.length > 0) {
          stock = directProducts.length
        } else {
          // Buscar por similaridade de título ou catálogo
          const words = (selectedQuestion.item_title || '')
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .slice(0, 3)

          if (words.length > 0) {
            const f = words.map((w) => `name ~ "${w}"`).join(' || ')
            const matches = await pb.collection('products').getList(1, 20, {
              filter: `status = "Disponível" && (${f})`,
              fields: 'id',
            })
            stock = matches.totalItems
          }
        }
        setMatchingStockCount(stock)
      } catch (_) {
        setMatchingStockCount(0)
      } finally {
        setLoadingStock(false)
      }
    }

    loadCrmData()
    loadStockData()
  }, [selectedQuestion?.question_id, selectedQuestion?.item_id, selectedQuestion?.buyer_id])

  // Salvar configurações
  const handleSaveConfig = async () => {
    if (!config) return
    setSavingConfig(true)
    try {
      await mlQuestionsService.updateConfig(config.id, {
        auto_reply_enabled: autoReplyEnabled,
        auto_reply_text: autoReplyText,
      })
      toast({
        title: 'Configurações salvas',
        description: autoReplyEnabled
          ? 'Motor de auto-resposta ATIVADO. Novas perguntas receberão resposta inicial automática com saudação por horário.'
          : 'Motor de auto-resposta DESATIVADO.',
      })
      setConfigModalOpen(false)
      await loadConfig()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configurações',
        description: err?.message || 'Falha ao gravar.',
      })
    } finally {
      setSavingConfig(false)
    }
  }

  // Enviar resposta real/definitiva
  const handleSendAnswer = async () => {
    if (!selectedQuestion) return
    if (!answerDraft.trim()) {
      toast({
        variant: 'destructive',
        title: 'Texto obrigatório',
        description: 'Digite uma resposta antes de enviar.',
      })
      return
    }

    setSendingAnswer(true)
    try {
      const res = await mlQuestionsService.answerQuestion({
        question_id: selectedQuestion.question_id,
        text: answerDraft.trim(),
        save_as_template: saveAnswerAsTemplate,
        template_title:
          templateTitleDraft || `Resposta sobre ${selectedQuestion.item_title?.slice(0, 30)}...`,
        template_category: 'geral',
      })

      toast({
        title: 'Resposta enviada com sucesso!',
        description: `Enviada para o Mercado Livre. Tempo de resposta: ${res.sla_minutes} min.`,
      })

      // Atualizar no local
      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === selectedQuestion.question_id
            ? {
                ...q,
                queue_status: 'answered',
                real_reply_sent: true,
                real_reply_text: answerDraft.trim(),
                real_reply_sent_at: new Date().toISOString(),
                sla_minutes_to_real_reply: res.sla_minutes,
              }
            : q,
        ),
      )

      setSelectedQuestion((prev) =>
        prev && prev.question_id === selectedQuestion.question_id
          ? {
              ...prev,
              queue_status: 'answered',
              real_reply_sent: true,
              real_reply_text: answerDraft.trim(),
              real_reply_sent_at: new Date().toISOString(),
              sla_minutes_to_real_reply: res.sla_minutes,
            }
          : prev,
      )

      setAnswerDraft('')
      setSaveAnswerAsTemplate(false)
      await loadMetrics()
      if (saveAnswerAsTemplate) await loadTemplates()
      onRefreshBadge?.()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar resposta',
        description: err?.message || 'Falha na comunicação com o Mercado Livre.',
      })
    } finally {
      setSendingAnswer(false)
    }
  }

  // Criação de template
  const handleCreateTemplate = async () => {
    if (!newTemplateTitle.trim() || !newTemplateContent.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Título e conteúdo são obrigatórios.',
      })
      return
    }

    try {
      const kwList = newTemplateKeywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0)

      await mlQuestionsService.createTemplate({
        title: newTemplateTitle.trim(),
        category: newTemplateCategory,
        keywords: kwList,
        content: newTemplateContent.trim(),
        use_stock_placeholder: newTemplateStockPlaceholder,
        active: true,
      })

      toast({
        title: 'Template criado com sucesso',
        description: 'O novo template já está disponível para respostas inteligentes.',
      })

      setNewTemplateOpen(false)
      setNewTemplateTitle('')
      setNewTemplateContent('')
      setNewTemplateKeywords('')
      setNewTemplateStockPlaceholder(false)
      await loadTemplates()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar template',
        description: err?.message || 'Falha ao salvar template.',
      })
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await mlQuestionsService.deleteTemplate(id)
      toast({ title: 'Template removido' })
      await loadTemplates()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover template',
        description: err?.message,
      })
    }
  }

  // Aplicar template ao campo de resposta substituindo variáveis ({estoque_real}, {saudacao}, etc)
  const applyTemplate = (t: MLQuestionTemplate) => {
    let text = t.content
    const stockVal =
      matchingStockCount !== null && matchingStockCount > 0 ? String(matchingStockCount) : 'algumas'
    text = text.replace(/\{estoque_real\}/g, stockVal)

    // Saudação pelo horário de Brasília
    const now = new Date()
    const utcHour = now.getUTCHours()
    const brHour = (utcHour - 3 + 24) % 24
    let greeting = 'Olá'
    if (brHour >= 5 && brHour < 12) greeting = 'Bom dia'
    else if (brHour >= 12 && brHour < 18) greeting = 'Boa tarde'
    else greeting = 'Boa noite'

    text = text.replace(/\{saudacao\}/g, greeting)

    setAnswerDraft(text)
    mlQuestionsService.incrementTemplateUsage(t.id, t.times_used)
    toast({
      title: 'Sugestão aplicada',
      description: `Template "${t.title}" inserido na caixa de resposta.`,
    })
  }

  // Sugestões recomendadas para a pergunta atual (matching por palavra-chave)
  const recommendedTemplates = useMemo(() => {
    if (!selectedQuestion || templates.length === 0) return []
    const qText = (selectedQuestion.text || '').toLowerCase()

    return templates
      .map((t) => {
        let score = 0
        if (t.keywords && Array.isArray(t.keywords)) {
          for (const kw of t.keywords) {
            if (qText.includes(kw.toLowerCase())) {
              score += 2
            }
          }
        }
        if (t.title && qText.includes(t.title.toLowerCase())) {
          score += 3
        }
        return { template: t, score }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.template)
  }, [selectedQuestion, templates])

  // Helper para timer de SLA da pergunta
  const getSlaInfo = (
    dateCreatedStr: string,
    queueStatus: string,
    realReplySentAt?: string | null,
  ) => {
    const createdDate = new Date(dateCreatedStr)
    const endDate = realReplySentAt ? new Date(realReplySentAt) : new Date()
    const diffHours = (endDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60)
    const diffMinutes = Math.max(
      1,
      Math.round((endDate.getTime() - createdDate.getTime()) / (1000 * 60)),
    )

    let color = 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
    let label = '< 1h'
    let level: 'ok' | 'warning' | 'critical' = 'ok'

    if (diffHours >= 4) {
      color = 'bg-red-500/15 text-red-600 border-red-500/30'
      label = `Crítico (>4h: ${Math.floor(diffHours)}h)`
      level = 'critical'
    } else if (diffHours >= 1) {
      color = 'bg-amber-500/15 text-amber-600 border-amber-500/30'
      label = `Atenção (${Math.floor(diffHours)}h ${diffMinutes % 60}m)`
      level = 'warning'
    } else {
      label = `${diffMinutes} min`
    }

    return { color, label, level, diffHours, diffMinutes }
  }

  // Contadores rápidos para abas do inbox
  const countUnanswered = questions.filter((q) => q.queue_status === 'unanswered').length
  const countAutoReplied = questions.filter((q) => q.queue_status === 'auto_replied').length
  const countAnswered = questions.filter((q) => q.queue_status === 'answered').length

  return (
    <div className="space-y-6">
      {/* 1. TOPO: Título, Métricas Rápidas e Ações Globais */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Central de Perguntas ML</h2>
                <Badge
                  variant="outline"
                  className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 font-medium"
                >
                  INFOPRECOBAIXO
                </Badge>
                {config?.auto_reply_enabled ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 text-xs">
                    <Bot className="h-3 w-3" /> Auto-Resposta Ligada
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-muted-foreground flex items-center gap-1 text-xs"
                  >
                    <Bot className="h-3 w-3" /> Auto-Resposta Pausada
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inbox em tempo real, motor de auto-resposta inicial com saudação inteligente, SLA e
                CRM integrado.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTemplatesModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <BookOpen className="h-4 w-4 text-blue-600" />
            Templates ({templates.length})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Settings className="h-4 w-4 text-slate-600" />
            Configurar Auto-Resposta
          </Button>

          <Button
            size="sm"
            onClick={handleManualSync}
            disabled={syncing}
            className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-medium flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ML'}
          </Button>
        </div>
      </div>

      {/* 2. CARDS DE SLA, STATUS E INSIGHTS */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <Card className="border-l-4 border-l-red-500 shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-600 uppercase">
                  SLA Crítico (&gt;4h)
                </span>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-2xl font-black text-red-600 mt-1">{metrics.critical_count}</p>
              <p className="text-[11px] text-muted-foreground">Exige ação imediata</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600 uppercase">
                  Aguardando Resposta Real
                </span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {metrics.waiting_real_reply}
              </p>
              <p className="text-[11px] text-muted-foreground">Auto-resposta já enviada</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500 shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-yellow-600 uppercase">
                  Sem Resposta
                </span>
                <HelpCircle className="h-4 w-4 text-yellow-500" />
              </div>
              <p className="text-2xl font-black text-yellow-600 mt-1">
                {metrics.pending_unanswered}
              </p>
              <p className="text-[11px] text-muted-foreground">Total pendente na fila</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600 uppercase">
                  Respondidas Hoje
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-1">{metrics.answered_today}</p>
              <p className="text-[11px] text-muted-foreground">Respostas definitivas</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 uppercase">
                  Tempo Médio SLA
                </span>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {metrics.avg_sla_minutes > 0 ? `${metrics.avg_sla_minutes} min` : '--'}
              </p>
              <p className="text-[11px] text-muted-foreground">Até a resposta real</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. DICA DE ANÚNCIO (INSIGHT AUTOMÁTICO SE HOUVER PRODUTOS COM MUITAS DÚVIDAS) */}
      {metrics?.top_products_with_questions &&
        metrics.top_products_with_questions.length > 0 &&
        (() => {
          const topItem = metrics.top_products_with_questions[0]
          if (topItem.total_questions >= 3) {
            return (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 shrink-0 mt-0.5">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-amber-900 dark:text-amber-300">
                      Insight de Conversão: Dúvidas repetidas no mesmo anúncio
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-700"
                    >
                      {topItem.total_questions} perguntas recebidas
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    O produto <span className="font-semibold">"{topItem.item_title}"</span> tem
                    recebido muitas perguntas semelhantes (
                    {topItem.sample_texts
                      .slice(0, 2)
                      .map((t) => `"${t}"`)
                      .join(', ')}
                    ).
                    <span className="font-medium text-amber-950 dark:text-amber-100 ml-1">
                      💡 Recomendação: adicione essas especificações diretamente na descrição do
                      anúncio para aumentar sua conversão!
                    </span>
                  </p>
                </div>
              </div>
            )
          }
          return null
        })()}

      {/* 4. LAYOUT PRINCIPAL: INBOX (FILA) + DETALHE & RESPOSTA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* COLUNA ESQUERDA: LISTA DE PERGUNTAS (FILA) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Filtros da fila */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por pergunta, comprador ou produto..."
                className="pl-9 h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-4 gap-1 p-1 bg-muted/60 rounded-lg text-xs">
              <button
                onClick={() => setFilterStatus('all')}
                className={`py-1.5 px-2 rounded-md font-medium transition-all ${
                  filterStatus === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todas ({questions.length})
              </button>
              <button
                onClick={() => setFilterStatus('unanswered')}
                className={`py-1.5 px-2 rounded-md font-medium transition-all ${
                  filterStatus === 'unanswered'
                    ? 'bg-background text-yellow-600 shadow-sm'
                    : 'text-muted-foreground hover:text-yellow-600'
                }`}
              >
                Novas ({countUnanswered})
              </button>
              <button
                onClick={() => setFilterStatus('auto_replied')}
                className={`py-1.5 px-2 rounded-md font-medium transition-all ${
                  filterStatus === 'auto_replied'
                    ? 'bg-background text-amber-600 shadow-sm'
                    : 'text-muted-foreground hover:text-amber-600'
                }`}
              >
                ⏳ Aguard. ({countAutoReplied})
              </button>
              <button
                onClick={() => setFilterStatus('answered')}
                className={`py-1.5 px-2 rounded-md font-medium transition-all ${
                  filterStatus === 'answered'
                    ? 'bg-background text-emerald-600 shadow-sm'
                    : 'text-muted-foreground hover:text-emerald-600'
                }`}
              >
                ✅ Finaliz. ({countAnswered})
              </button>
            </div>
          </div>

          {/* Lista de cards das perguntas */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-yellow-500" />
                Carregando perguntas da fila...
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl p-6 bg-card">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium">Nenhuma pergunta encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhuma dúvida corresponde aos filtros aplicados.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  className="mt-3 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sincronizar com ML agora
                </Button>
              </div>
            ) : (
              questions.map((q) => {
                const isSelected = selectedQuestion?.question_id === q.question_id
                const sla = getSlaInfo(q.date_created, q.queue_status, q.real_reply_sent_at)

                return (
                  <div
                    key={q.question_id}
                    onClick={() => setSelectedQuestion(q)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-yellow-500 bg-yellow-500/5 shadow-sm'
                        : 'border-border bg-card hover:border-yellow-500/50 hover:bg-muted/40'
                    }`}
                  >
                    {/* Header do Card: Status da fila & Timer SLA */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {q.queue_status === 'unanswered' && (
                          <Badge
                            variant="outline"
                            className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 text-[11px] font-semibold"
                          >
                            Pendente
                          </Badge>
                        )}
                        {q.queue_status === 'auto_replied' && (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <span>⏳</span> Aguardando resposta real
                          </Badge>
                        )}
                        {q.queue_status === 'answered' && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <Check className="h-3 w-3" /> Respondida
                          </Badge>
                        )}

                        {q.initial_auto_reply_sent && (
                          <span
                            className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1"
                            title="Resposta inicial automática já disparada"
                          >
                            <Bot className="h-2.5 w-2.5 text-blue-500" /> Auto-resposta OK
                          </span>
                        )}
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono border ${sla.color}`}
                      >
                        SLA: {sla.label}
                      </Badge>
                    </div>

                    {/* Texto da pergunta */}
                    <p className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed mb-2">
                      "{q.text}"
                    </p>

                    {/* Informações do produto e comprador */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2 gap-2">
                      <span className="truncate max-w-[190px] font-medium" title={q.item_title}>
                        📦 {q.item_title || q.item_id || 'Anúncio ML'}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-[10px]">
                        <User className="h-3 w-3" />
                        {q.buyer_nickname ||
                          (q.buyer_id ? `Cliente #${q.buyer_id.slice(-4)}` : 'Comprador')}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHE DA PERGUNTA SELECIONADA, CRM, SUGESTÕES INTELIGENTES & RESPOSTA */}
        <div className="lg:col-span-7 space-y-4">
          {selectedQuestion ? (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="font-mono text-xs">
                        ID: {selectedQuestion.question_id}
                      </Badge>

                      {selectedQuestion.queue_status === 'unanswered' && (
                        <Badge className="bg-yellow-500 text-slate-950 hover:bg-yellow-600 text-xs">
                          Pendente sem resposta
                        </Badge>
                      )}
                      {selectedQuestion.queue_status === 'auto_replied' && (
                        <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-xs flex items-center gap-1">
                          <span>⏳</span> Aguardando resposta real
                        </Badge>
                      )}
                      {selectedQuestion.queue_status === 'answered' && (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Respondida de verdade
                        </Badge>
                      )}

                      {/* Timer de SLA */}
                      {(() => {
                        const sla = getSlaInfo(
                          selectedQuestion.date_created,
                          selectedQuestion.queue_status,
                          selectedQuestion.real_reply_sent_at,
                        )
                        return (
                          <Badge
                            variant="outline"
                            className={`text-xs font-mono border ${sla.color}`}
                          >
                            ⏱ SLA: {sla.label}
                          </Badge>
                        )
                      })()}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>
                        Criada em: {new Date(selectedQuestion.date_created).toLocaleString('pt-BR')}
                      </span>
                      <span>•</span>
                      <span>
                        Comprador:{' '}
                        <strong className="text-foreground">
                          {selectedQuestion.buyer_nickname ||
                            selectedQuestion.buyer_id ||
                            'Não identificado'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {selectedQuestion.item_permalink && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 shrink-0 flex items-center gap-1"
                      onClick={() => window.open(selectedQuestion.item_permalink, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver anúncio no ML
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* 1. FICHA DO ANÚNCIO E ESTOQUE REAL */}
                <div className="bg-muted/40 rounded-xl p-3 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {selectedQuestion.item_thumbnail ? (
                      <img
                        src={selectedQuestion.item_thumbnail}
                        alt="Produto"
                        className="w-12 h-12 object-contain rounded-lg border bg-white p-0.5"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-600">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-foreground line-clamp-1">
                        {selectedQuestion.item_title || 'Anúncio no Mercado Livre'}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-mono">{selectedQuestion.item_id}</span>
                        {selectedQuestion.item_price > 0 && (
                          <span>
                            • Preço: R${' '}
                            {Number(selectedQuestion.item_price).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Estoque Real Disponível
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {loadingStock ? (
                        <span className="text-xs text-muted-foreground">Consultando lotes...</span>
                      ) : matchingStockCount !== null && matchingStockCount > 0 ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                          {matchingStockCount} unid. prontas
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-amber-600 border-amber-500/30 text-xs"
                        >
                          0 ou sob consulta
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. FICHA DO COMPRADOR INTEGRADA AO CRM */}
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          CRM Comprador:{' '}
                          {selectedQuestion.buyer_nickname || selectedQuestion.buyer_id}
                        </span>
                        {buyerCrm ? (
                          <Badge className="bg-blue-600 text-white text-[10px] flex items-center gap-1">
                            <Award className="h-3 w-3" /> Já é Cliente Ambicorp
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Novo Interessado
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {loadingCrm
                          ? 'Consultando histórico de pedidos...'
                          : buyerCrm
                            ? `Cliente cadastrado na base • Telefone: ${buyerCrm.phone || 'Não informado'} • Documento: ${buyerCrm.document || 'Pessoa Física'}`
                            : 'Primeira interação registrada deste comprador no nosso gestor.'}
                      </p>{' '}
                    </div>
                  </div>
                </div>

                {/* 3. BALÃO DA PERGUNTA DO CLIENTE */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 text-yellow-500" /> Pergunta do Comprador:
                  </span>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm font-medium text-foreground leading-relaxed">
                    "{selectedQuestion.text}"
                  </div>
                </div>

                {/* 4. HISTÓRICO: RESPOSTA INICIAL AUTOMÁTICA ENVIADA */}
                {selectedQuestion.initial_auto_reply_sent && (
                  <div className="bg-slate-500/5 border border-slate-500/20 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-600 flex items-center gap-1">
                        <Bot className="h-3.5 w-3.5" /> Resposta inicial enviada automaticamente
                        pelo motor:
                      </span>
                      {selectedQuestion.initial_auto_reply_sent_at && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(selectedQuestion.initial_auto_reply_sent_at).toLocaleTimeString(
                            'pt-BR',
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground italic pl-4 border-l-2 border-blue-500/40">
                      "{selectedQuestion.initial_auto_reply_text}"
                    </p>
                  </div>
                )}

                {/* 5. HISTÓRICO: RESPOSTA REAL / DEFINITIVA JÁ ENVIADA */}
                {selectedQuestion.real_reply_sent && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Resposta Real enviada pelo operador:
                      </span>
                      {selectedQuestion.real_reply_sent_at && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(selectedQuestion.real_reply_sent_at).toLocaleString('pt-BR')}
                          {selectedQuestion.sla_minutes_to_real_reply > 0 &&
                            ` (SLA: ${selectedQuestion.sla_minutes_to_real_reply} min)`}
                        </span>
                      )}
                    </div>
                    <p className="text-foreground font-medium pl-4 border-l-2 border-emerald-500 mt-1">
                      "{selectedQuestion.real_reply_text}"
                    </p>
                    {selectedQuestion.real_reply_user_name && (
                      <p className="text-[10px] text-muted-foreground text-right">
                        Enviada por: {selectedQuestion.real_reply_user_name}
                      </p>
                    )}
                  </div>
                )}

                {/* 6. SUGESTÕES INTELIGENTES COM CONTEXTO DE ESTOQUE REAL */}
                {recommendedTemplates.length > 0 && !selectedQuestion.real_reply_sent && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                        Sugestões Inteligentes detectadas por palavra-chave:
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Clique para preencher
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {recommendedTemplates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className="text-left p-2.5 rounded-lg border border-border hover:border-yellow-500/60 bg-card hover:bg-yellow-500/5 transition-all text-xs group"
                        >
                          <div className="flex items-center justify-between font-semibold text-foreground group-hover:text-yellow-600 mb-1">
                            <span>{t.title}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-yellow-600 transition-transform" />
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {t.content.replace(
                              /\{estoque_real\}/g,
                              String(matchingStockCount || 0),
                            )}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7. CAMPO PARA DIGITAR E ENVIAR RESPOSTA DEFINITIVA */}
                {!selectedQuestion.real_reply_sent && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="answerInput"
                        className="text-xs font-bold flex items-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5 text-yellow-600" />
                        Enviar Resposta Definitiva ao Mercado Livre:
                      </Label>
                      {templates.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => setTemplatesModalOpen(true)}
                        >
                          Ver todos os templates ({templates.length})
                        </Button>
                      )}
                    </div>

                    <Textarea
                      id="answerInput"
                      placeholder="Digite a resposta completa para o cliente... (ex: Olá! Temos sim o produto em estoque pronto para envio imediato...)"
                      rows={4}
                      className="text-xs leading-relaxed"
                      value={answerDraft}
                      onChange={(e) => setAnswerDraft(e.target.value)}
                    />

                    {/* Opção para salvar resposta como template para aprender */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="saveTemplateSwitch"
                          checked={saveAnswerAsTemplate}
                          onCheckedChange={setSaveAnswerAsTemplate}
                        />
                        <Label
                          htmlFor="saveTemplateSwitch"
                          className="text-xs cursor-pointer text-muted-foreground"
                        >
                          Salvar esta resposta como novo template que aprende
                        </Label>
                      </div>

                      <Button
                        onClick={handleSendAnswer}
                        disabled={sendingAnswer || !answerDraft.trim()}
                        className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-semibold text-xs h-9 px-5 flex items-center gap-1.5 ml-auto"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sendingAnswer ? 'Enviando ao ML...' : 'Enviar Resposta Real'}
                      </Button>
                    </div>

                    {saveAnswerAsTemplate && (
                      <div className="pt-2">
                        <Input
                          placeholder="Título do novo template (ex: Resposta sobre Memória RAM e Lotes)"
                          className="text-xs h-8"
                          value={templateTitleDraft}
                          onChange={(e) => setTemplateTitleDraft(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground bg-card">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-medium text-sm">Selecione uma pergunta na fila ao lado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Você poderá ver a ficha do anúncio, estoque real, CRM do comprador e sugestões
                inteligentes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. MODAL DE CONFIGURAÇÃO DA CENTRAL & AUTO-RESPOSTA */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-yellow-600" />
              Configuração do Motor de Auto-Resposta ML
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajuste as regras da resposta inicial automática. Conforme as regras aprovadas, a
              auto-resposta envia uma saudação inicial e mantém o item na fila com selo "⏳
              Aguardando resposta real".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Chave liga/desliga */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/30">
              <div className="space-y-0.5">
                <Label
                  htmlFor="autoReplyToggle"
                  className="text-sm font-semibold flex items-center gap-2"
                >
                  <Bot className="h-4 w-4 text-blue-600" />
                  Ativar Motor de Resposta Inicial Automática
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ligado, envia imediatamente a resposta inicial pelo ML ao detectar pergunta
                  nova.
                </p>
              </div>
              <Switch
                id="autoReplyToggle"
                checked={autoReplyEnabled}
                onCheckedChange={setAutoReplyEnabled}
              />
            </div>

            {/* Texto editável */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="autoReplyTextInput" className="text-xs font-semibold">
                  Texto da Resposta Inicial (após a saudação)
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  A saudação "Bom dia", "Boa tarde" ou "Boa noite" é prefixada automaticamente pelo
                  horário de Brasília.
                </span>
              </div>
              <Textarea
                id="autoReplyTextInput"
                rows={3}
                className="text-xs leading-relaxed"
                value={autoReplyText}
                onChange={(e) => setAutoReplyText(e.target.value)}
                placeholder="Já estamos analisando sua pergunta e retornaremos com as especificações em breve..."
              />
            </div>

            {/* Pré-visualização da saudação pelo horário */}
            <div className="p-3 rounded-lg border bg-blue-500/5 text-xs space-y-1">
              <span className="font-semibold text-blue-600 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Exemplo de envio no horário atual:
              </span>
              <p className="text-foreground italic pl-3 border-l-2 border-blue-500 font-medium">
                "
                {(() => {
                  const now = new Date()
                  const utcHour = now.getUTCHours()
                  const brHour = (utcHour - 3 + 24) % 24
                  let g = 'Olá'
                  if (brHour >= 5 && brHour < 12) g = 'Bom dia'
                  else if (brHour >= 12 && brHour < 18) g = 'Boa tarde'
                  else g = 'Boa noite'
                  return `${g}! ${autoReplyText.trim() || 'Já estamos analisando sua dúvida.'}`
                })()}
                "
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setConfigModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-semibold"
            >
              {savingConfig ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. MODAL DE GERENCIAMENTO DE TEMPLATES */}
      <Dialog open={templatesModalOpen} onOpenChange={setTemplatesModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Templates de Respostas Inteligentes
              </DialogTitle>
              <Button
                size="sm"
                onClick={() => setNewTemplateOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Template
              </Button>
            </div>
            <DialogDescription className="text-xs">
              Respostas pré-definidas com palavras-chave que aprendem e sugerem automaticamente
              conforme a pergunta do comprador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto pr-1 flex-1 py-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition-all text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{tpl.title}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {tpl.category}
                    </Badge>
                    {tpl.times_used > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Usado {tpl.times_used}x
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedQuestion && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] text-yellow-700 border-yellow-500/30 hover:bg-yellow-500/10"
                        onClick={() => {
                          applyTemplate(tpl)
                          setTemplatesModalOpen(false)
                        }}
                      >
                        Usar nesta pergunta
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDeleteTemplate(tpl.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <p className="text-foreground leading-relaxed bg-muted/40 p-2.5 rounded-lg font-medium">
                  "{tpl.content}"
                </p>

                {tpl.keywords && Array.isArray(tpl.keywords) && tpl.keywords.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    <span className="text-[10px] text-muted-foreground">Palavras-chave:</span>
                    {tpl.keywords.map((kw, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[10px] py-0 px-1.5 font-normal"
                      >
                        {kw}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTemplatesModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. MODAL DE CADASTRO DE NOVO TEMPLATE */}
      <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              Criar Novo Template de Resposta
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Título do Template</Label>
              <Input
                placeholder="Ex: Política de Garantia e Devolução"
                value={newTemplateTitle}
                onChange={(e) => setNewTemplateTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Input
                placeholder="Ex: estoque, fiscal, tecnico, logistica"
                value={newTemplateCategory}
                onChange={(e) => setNewTemplateCategory(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Palavras-chave (separadas por vírgula)</Label>
              <Input
                placeholder="garantia, prazo, troca, quebrado, 90 dias"
                value={newTemplateKeywords}
                onChange={(e) => setNewTemplateKeywords(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Conteúdo da Resposta</Label>
                <span className="text-[10px] text-muted-foreground">
                  Use {'{estoque_real}'} ou {'{saudacao}'}
                </span>
              </div>
              <Textarea
                rows={4}
                placeholder="Digite o texto do template..."
                value={newTemplateContent}
                onChange={(e) => setNewTemplateContent(e.target.value)}
                className="text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setNewTemplateOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreateTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
