import React, { useState, useEffect, useMemo } from 'react'
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Copy,
  Check,
  Edit3,
  ExternalLink,
  Phone,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  MessageSquare,
  FileText,
  Plus,
  Trash2,
  X,
  History,
  Shield,
  HelpCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { reputationDisputesService } from '@/services/reputationDisputesService'
import type {
  MLReputationDispute,
  DisputeStatus,
  DisputeExclusionStatus,
} from '@/types/reputationDisputes'

export default function ContestacaoReputacao() {
  const [disputes, setDisputes] = useState<MLReputationDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Estado do Modal de Edição / Defesa
  const [selectedDispute, setSelectedDispute] = useState<MLReputationDispute | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [savingDispute, setSavingDispute] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Formulário de Edição
  const [editForm, setEditForm] = useState<{
    customer_name: string
    customer_nickname: string
    customer_phone: string
    claim_id: string
    claim_reason: string
    defense_text: string
    dispute_status: DisputeStatus
    contact_history: string
    exclusion_status: DisputeExclusionStatus
    exclusion_detail: string
  }>({
    customer_name: '',
    customer_nickname: '',
    customer_phone: '',
    claim_id: '',
    claim_reason: '',
    defense_text: '',
    dispute_status: 'Para redigir',
    contact_history: '',
    exclusion_status: 'Nao solicitada',
    exclusion_detail: '',
  })

  // Modal de Criação Manual
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [creatingDispute, setCreatingDispute] = useState(false)
  const [newForm, setNewForm] = useState({
    sale_id_ml: '',
    sale_date: '',
    product_title: '',
    customer_name: '',
    customer_phone: '',
    claim_id: '',
    claim_reason: '',
    exclusion_status: 'Nao solicitada' as DisputeExclusionStatus,
    defense_text: '',
    dispute_status: 'Para redigir' as DisputeStatus,
    contact_history: '',
  })

  // Mensagem de sincronização da API (ex: 403 escopo de claims)
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  // Carrega disputas da coleção
  const loadDisputes = async () => {
    setLoading(true)
    try {
      const data = await reputationDisputesService.listDisputes({
        status: statusFilter,
        search: searchQuery,
      })
      setDisputes(data)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as contestações de reputação.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDisputes()
  }, [statusFilter])

  // Disparar sincronização manual com API do ML e cruzamento local
  const handleSyncML = async () => {
    setSyncing(true)
    try {
      const res = await reputationDisputesService.syncClaims()
      if (res.warning) {
        setSyncNotice(res.warning)
      } else {
        setSyncNotice(null)
      }

      toast({
        title: res.ok ? 'Sincronização finalizada' : 'Aviso de Sincronização',
        description:
          res.message || `Cruzamento concluído (${res.local_orders_linked} pedidos vinculados).`,
      })
      await loadDisputes()
    } catch (err: any) {
      toast({
        title: 'Erro de conexão',
        description: err.message || 'Falha ao contatar servidor de sincronização.',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Abrir Modal de Edição
  const handleOpenEdit = (dispute: MLReputationDispute) => {
    setSelectedDispute(dispute)
    setEditForm({
      customer_name: dispute.customer_name || '',
      customer_nickname: dispute.customer_nickname || '',
      customer_phone: dispute.customer_phone || '',
      claim_id: dispute.claim_id || '',
      claim_reason: dispute.claim_reason || '',
      defense_text: dispute.defense_text || '',
      dispute_status: dispute.dispute_status || 'Para redigir',
      contact_history: dispute.contact_history || '',
      exclusion_status: dispute.exclusion_status || 'Nao solicitada',
      exclusion_detail: dispute.exclusion_detail || '',
    })
    setIsModalOpen(true)
  }

  // Salvar Edição
  const handleSaveEdit = async () => {
    if (!selectedDispute) return
    setSavingDispute(true)
    try {
      const updated = await reputationDisputesService.updateDispute(selectedDispute.id, {
        customer_name: editForm.customer_name,
        customer_nickname: editForm.customer_nickname,
        customer_phone: editForm.customer_phone,
        claim_id: editForm.claim_id,
        claim_reason: editForm.claim_reason,
        defense_text: editForm.defense_text,
        dispute_status: editForm.dispute_status,
        contact_history: editForm.contact_history,
        exclusion_status: editForm.exclusion_status,
        exclusion_detail: editForm.exclusion_detail,
      })

      setDisputes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      toast({
        title: 'Contestação salva com sucesso',
        description: `Defesa e dados do caso #${updated.sale_id_ml} foram atualizados.`,
      })
      setIsModalOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      })
    } finally {
      setSavingDispute(false)
    }
  }

  // Copiar Texto de Defesa para Área de Transferência
  const handleCopyDefense = (text: string, id: string) => {
    if (!text?.trim()) {
      toast({
        title: 'Defesa em branco',
        description: 'Redija o texto de defesa antes de copiar para o atendimento.',
        variant: 'destructive',
      })
      return
    }

    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast({
      title: 'Texto copiado!',
      description: 'Defesa pronta para colar no WhatsApp ou chat com o atendente do ML.',
    })
    setTimeout(() => {
      setCopiedId(null)
    }, 2500)
  }

  // Criar Caso Manualmente
  const handleCreateDispute = async () => {
    if (!newForm.sale_id_ml.trim()) {
      toast({
        title: 'Número da venda obrigatório',
        description: 'Informe o ID da venda do Mercado Livre.',
        variant: 'destructive',
      })
      return
    }

    setCreatingDispute(true)
    try {
      const created = await reputationDisputesService.createDispute({
        sale_id_ml: newForm.sale_id_ml.trim(),
        sale_date: newForm.sale_date.trim() || new Date().toLocaleDateString('pt-BR'),
        product_title: newForm.product_title.trim() || 'Equipamento',
        customer_name: newForm.customer_name.trim(),
        customer_phone: newForm.customer_phone.trim(),
        claim_id: newForm.claim_id.trim(),
        claim_reason: newForm.claim_reason.trim() || 'com o produto entregue',
        exclusion_status: newForm.exclusion_status,
        defense_text: newForm.defense_text.trim(),
        dispute_status: newForm.dispute_status,
        contact_history: newForm.contact_history.trim(),
      })

      setDisputes((prev) => [created, ...prev])
      toast({
        title: 'Caso adicionado com sucesso',
        description: `Venda #${created.sale_id_ml} incluída para contestação.`,
      })
      setIsNewModalOpen(false)
      setNewForm({
        sale_id_ml: '',
        sale_date: '',
        product_title: '',
        customer_name: '',
        customer_phone: '',
        claim_id: '',
        claim_reason: '',
        exclusion_status: 'Nao solicitada',
        defense_text: '',
        dispute_status: 'Para redigir',
        contact_history: '',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar',
        description: err.message || 'Falha ao incluir nova contestação.',
        variant: 'destructive',
      })
    } finally {
      setCreatingDispute(false)
    }
  }

  // Excluir Caso
  const handleDeleteDispute = async (id: string, saleId: string) => {
    if (!confirm(`Deseja realmente remover a contestação da venda #${saleId}?`)) {
      return
    }
    const success = await reputationDisputesService.deleteDispute(id)
    if (success) {
      setDisputes((prev) => prev.filter((d) => d.id !== id))
      toast({
        title: 'Caso removido',
        description: `Contestação da venda #${saleId} excluída.`,
      })
      if (selectedDispute?.id === id) {
        setIsModalOpen(false)
      }
    }
  }

  // Métricas do topo
  const metrics = useMemo(() => {
    const total = disputes.length
    const paraRedigir = disputes.filter((d) => d.dispute_status === 'Para redigir').length
    const prontos = disputes.filter((d) => d.dispute_status === 'Pronto para contato').length
    const contatoFeito = disputes.filter(
      (d) => d.dispute_status === 'Contato feito' || d.dispute_status === 'Enviado ao ML',
    ).length
    const resolvidos = disputes.filter((d) => d.dispute_status === 'Resolvido').length
    return { total, paraRedigir, prontos, contatoFeito, resolvidos }
  }, [disputes])

  // Filtragem de busca na lista
  const filteredDisputes = useMemo(() => {
    if (!searchQuery.trim()) return disputes
    const q = searchQuery.toLowerCase().trim()
    return disputes.filter(
      (d) =>
        d.sale_id_ml.toLowerCase().includes(q) ||
        (d.product_title && d.product_title.toLowerCase().includes(q)) ||
        (d.customer_name && d.customer_name.toLowerCase().includes(q)) ||
        (d.customer_nickname && d.customer_nickname.toLowerCase().includes(q)) ||
        (d.claim_id && d.claim_id.toLowerCase().includes(q)) ||
        (d.claim_reason && d.claim_reason.toLowerCase().includes(q)) ||
        (d.defense_text && d.defense_text.toLowerCase().includes(q)),
    )
  }, [disputes, searchQuery])

  // Cores de Badge de Exclusão (fiel ao ML)
  const getExclusionBadge = (status?: DisputeExclusionStatus) => {
    switch (status) {
      case 'Nao solicitada':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-800 border-amber-300 font-medium text-xs gap-1"
          >
            <Clock className="w-3 h-3 text-amber-600" />
            Não solicitada
          </Badge>
        )
      case 'Solicitada':
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-800 border-blue-300 font-medium text-xs gap-1"
          >
            <RefreshCw className="w-3 h-3 text-blue-600" />
            Solicitada
          </Badge>
        )
      case 'Recusada':
        return (
          <Badge
            variant="outline"
            className="bg-rose-50 text-rose-700 border-rose-300 font-medium text-xs gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Recusada
          </Badge>
        )
      case 'Mediacao':
      case 'Nao se aplica':
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-300 font-medium text-xs gap-1"
          >
            <Info className="w-3 h-3 text-slate-500" />
            {status === 'Mediacao' ? 'Mediação' : 'Não se aplica'}
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status || 'Pendente'}
          </Badge>
        )
    }
  }

  // Cores de Status da Contestação Interna
  const getDisputeStatusBadge = (status: DisputeStatus) => {
    switch (status) {
      case 'Para redigir':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs">
            Para redigir
          </Badge>
        )
      case 'Pronto para contato':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
            Pronto para contato
          </Badge>
        )
      case 'Contato feito':
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs">
            Contato feito
          </Badge>
        )
      case 'Enviado ao ML':
        return (
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs">
            Enviado ao ML
          </Badge>
        )
      case 'Resolvido':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Resolvido (Excluída)
          </Badge>
        )
      case 'Recusado':
        return (
          <Badge className="bg-slate-700 hover:bg-slate-800 text-white font-medium text-xs">
            Recusado / Mantida
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Contexto */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Contestação de Reputação
              </h1>
              <p className="text-sm text-slate-500">
                Gestão interna de exclusão de vendas afetadas no Mercado Livre (preparação de
                defesas para atendimento telefônico/WhatsApp com suporte ML).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncML}
            disabled={syncing}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-orange-600' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar do ML'}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Venda Reclamada
          </Button>
        </div>
      </div>

      {/* Aviso discreto se a API de Claims do ML tiver escopo restrito */}
      {syncNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-3 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <button
            onClick={() => setSyncNotice(null)}
            className="text-amber-600 hover:text-amber-900"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total de Casos
              </span>
              <Shield className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{metrics.total}</span>
              <span className="text-xs text-slate-500">vendas afetadas</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">
                Para Redigir
              </span>
              <Edit3 className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-800">{metrics.paraRedigir}</span>
              <span className="text-xs text-amber-600">sem defesa pronta</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700 uppercase tracking-wider">
                Pronto p/ Contato
              </span>
              <Check className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-800">{metrics.prontos}</span>
              <span className="text-xs text-blue-600">defesas prontas</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/30 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-700 uppercase tracking-wider">
                Em Andamento
              </span>
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-800">{metrics.contatoFeito}</span>
              <span className="text-xs text-purple-600">contatados/enviados</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">
                Resolvidos
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-800">{metrics.resolvidos}</span>
              <span className="text-xs text-emerald-600">exclusão aceita</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por venda, cliente, produto, reclamação..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Status:</span>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                <SelectTrigger className="h-9 w-full sm:w-48 bg-white border-slate-200 text-xs">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Para redigir">Para redigir</SelectItem>
                  <SelectItem value="Pronto para contato">Pronto para contato</SelectItem>
                  <SelectItem value="Contato feito">Contato feito</SelectItem>
                  <SelectItem value="Enviado ao ML">Enviado ao ML</SelectItem>
                  <SelectItem value="Resolvido">Resolvido (Excluída)</SelectItem>
                  <SelectItem value="Recusado">Recusado (Mantida)</SelectItem>
                </SelectContent>
              </Select>

              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-500 hover:text-slate-800 h-9 px-2"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Vendas e Defesas */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200 py-3.5 px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span>Vendas com Exclusão de Reputação Afetada</span>
                <Badge variant="secondary" className="text-xs font-normal">
                  {filteredDisputes.length} caso{filteredDisputes.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Acompanhe o status do caso, texto da defesa e cliente associado para contato com o
                atendente do ML.
              </CardDescription>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    <span className="hidden sm:inline">Régua ML</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  O Mercado Livre afeta a reputação por reclamações e atrasos. No contato com o
                  atendente, justifique fatos alheios ao vendedor (ex: atraso de transportadora,
                  produto entregue conforme anúncio, desistência indevida) para remover o impacto da
                  venda.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-orange-600" />
              <span>Carregando contestações...</span>
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-3">
              <Shield className="w-8 h-8 text-slate-300" />
              <div>
                <p className="font-semibold text-slate-700">Nenhum caso localizado</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Não há contestações registradas com os filtros aplicados.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
                className="text-xs"
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 sm:px-4">Venda & Data</th>
                    <th className="py-3 px-3 sm:px-4">Produto</th>
                    <th className="py-3 px-3 sm:px-4">Cliente</th>
                    <th className="py-3 px-3 sm:px-4">Status ML (Exclusão)</th>
                    <th className="py-3 px-3 sm:px-4">O que alega</th>
                    <th className="py-3 px-3 sm:px-4">Defesa da Reputação</th>
                    <th className="py-3 px-3 sm:px-4">Status Interno</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredDisputes.map((dispute) => {
                    const hasDefense = Boolean(dispute.defense_text?.trim())
                    const isCopied = copiedId === dispute.id

                    return (
                      <tr key={dispute.id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Venda & Data */}
                        <td className="py-3.5 px-3 sm:px-4 align-top">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                              #{dispute.sale_id_ml}
                            </span>
                            <span className="text-[11px] text-slate-500 mt-0.5">
                              {dispute.sale_date || 'Data não informada'}
                            </span>
                            {dispute.claim_id && (
                              <span className="text-[11px] text-slate-600 font-medium mt-1 inline-flex items-center gap-1">
                                <span className="text-slate-400">Reclamação:</span> #
                                {dispute.claim_id}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Produto */}
                        <td className="py-3.5 px-3 sm:px-4 align-top max-w-[200px]">
                          <p
                            className="font-medium text-slate-900 truncate"
                            title={dispute.product_title}
                          >
                            {dispute.product_title || 'Equipamento não especificado'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-purple-600" />
                            <span className="text-[11px] text-slate-500">
                              {dispute.problems_count || 1} problema
                            </span>
                            <span className="text-[11px] font-semibold text-rose-600 ml-1">
                              • {dispute.reputation_impact || 'Afetada'}
                            </span>
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="py-3.5 px-3 sm:px-4 align-top max-w-[180px]">
                          {dispute.customer_name || dispute.customer_nickname ? (
                            <div>
                              <p className="font-medium text-slate-800 truncate">
                                {dispute.customer_name || dispute.customer_nickname}
                              </p>
                              {dispute.customer_nickname &&
                                dispute.customer_name !== dispute.customer_nickname && (
                                  <p className="text-[11px] text-slate-400 truncate">
                                    @{dispute.customer_nickname}
                                  </p>
                                )}
                              {dispute.customer_phone && (
                                <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-700">
                                  <Phone className="w-3 h-3 text-emerald-600" />
                                  <span>{dispute.customer_phone}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Não identificado no pedido
                            </span>
                          )}
                        </td>

                        {/* Status de Exclusão ML */}
                        <td className="py-3.5 px-3 sm:px-4 align-top">
                          <div className="flex flex-col items-start gap-1">
                            {getExclusionBadge(dispute.exclusion_status)}
                            {dispute.exclusion_detail && (
                              <span
                                className="text-[11px] text-slate-500 max-w-[190px] leading-tight mt-0.5 line-clamp-2"
                                title={dispute.exclusion_detail}
                              >
                                {dispute.exclusion_detail}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* O que o cliente alega */}
                        <td className="py-3.5 px-3 sm:px-4 align-top max-w-[180px]">
                          {dispute.claim_reason ? (
                            <div className="text-xs text-slate-700 bg-slate-100/70 p-2 rounded border border-slate-200 line-clamp-3">
                              {dispute.claim_reason}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Aguardando preenchimento
                            </span>
                          )}
                        </td>

                        {/* Defesa da Reputação */}
                        <td className="py-3.5 px-3 sm:px-4 align-top max-w-[240px]">
                          {hasDefense ? (
                            <div className="relative group/box bg-amber-50/50 p-2 rounded border border-amber-200">
                              <p className="text-xs text-slate-800 line-clamp-3 whitespace-pre-line pr-6">
                                {dispute.defense_text}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleCopyDefense(dispute.defense_text || '', dispute.id)
                                }
                                className="absolute top-1 right-1 h-6 w-6 p-0 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                                title="Copiar texto de defesa"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div className="p-2 border border-dashed border-slate-300 rounded text-center">
                              <span className="text-xs text-slate-400 block mb-1">
                                Defesa não redigida
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEdit(dispute)}
                                className="h-6 text-[11px] text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2"
                              >
                                + Redigir defesa
                              </Button>
                            </div>
                          )}
                        </td>

                        {/* Status Interno */}
                        <td className="py-3.5 px-3 sm:px-4 align-top">
                          <div className="flex flex-col gap-1">
                            {getDisputeStatusBadge(dispute.dispute_status)}
                            {dispute.contact_history && (
                              <span
                                className="text-[10px] text-slate-500 line-clamp-1 italic max-w-[130px]"
                                title={dispute.contact_history}
                              >
                                {dispute.contact_history}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-3 sm:px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenEdit(dispute)}
                                    className="h-8 w-8 p-0 text-slate-700 hover:text-orange-600 border-slate-200"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar caso e defesa</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {hasDefense && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleCopyDefense(dispute.defense_text || '', dispute.id)
                                      }
                                      className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 border-slate-200"
                                    >
                                      {isCopied ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copiar defesa para WhatsApp/chat</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleDeleteDispute(dispute.id, dispute.sale_id_ml)
                                    }
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Excluir registro</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal / Dialog de Edição da Defesa e Status */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 rounded-md text-orange-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Defesa da Venda #{selectedDispute?.sale_id_ml}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {selectedDispute?.product_title} • {selectedDispute?.sale_date}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Linha 1: Dados do Cliente e Reclamação */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nome do Cliente
                </label>
                <Input
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  placeholder="Nome do comprador"
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Telefone / WhatsApp
                </label>
                <Input
                  value={editForm.customer_phone}
                  onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nº da Reclamação (Claim ID)
                </label>
                <Input
                  value={editForm.claim_id}
                  onChange={(e) => setEditForm({ ...editForm, claim_id: e.target.value })}
                  placeholder="Ex: 5012345678"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Linha 2: Status do ML e Status Interno */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Status da Exclusão no ML
                </label>
                <Select
                  value={editForm.exclusion_status}
                  onValueChange={(val: DisputeExclusionStatus) =>
                    setEditForm({ ...editForm, exclusion_status: val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o status no ML" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nao solicitada">Não solicitada</SelectItem>
                    <SelectItem value="Solicitada">Solicitada</SelectItem>
                    <SelectItem value="Recusada">Recusada</SelectItem>
                    <SelectItem value="Mediacao">Mediação</SelectItem>
                    <SelectItem value="Nao se aplica">Não se aplica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Status Interno do Caso
                </label>
                <Select
                  value={editForm.dispute_status}
                  onValueChange={(val: DisputeStatus) =>
                    setEditForm({ ...editForm, dispute_status: val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs font-medium">
                    <SelectValue placeholder="Status do atendimento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Para redigir">Para redigir</SelectItem>
                    <SelectItem value="Pronto para contato">Pronto para contato</SelectItem>
                    <SelectItem value="Contato feito">Contato feito</SelectItem>
                    <SelectItem value="Enviado ao ML">Enviado ao ML</SelectItem>
                    <SelectItem value="Resolvido">Resolvido (Exclusão Concedida)</SelectItem>
                    <SelectItem value="Recusado">Recusado (Impacto Mantido)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 3: O que o cliente alega */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                O que o cliente alega (Resumo do Problema)
              </label>
              <Input
                value={editForm.claim_reason}
                onChange={(e) => setEditForm({ ...editForm, claim_reason: e.target.value })}
                placeholder="Ex: Alega que equipamento não ligou ou reclama de atraso de correio..."
                className="h-9 text-xs"
              />
            </div>

            {/* Linha 4: CAMPO DE DEFESA (Grande e editável) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-orange-600" />
                  Texto de Defesa da Reputação (Para atendente do ML)
                </label>

                {editForm.defense_text && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleCopyDefense(editForm.defense_text, selectedDispute?.id || '')
                    }
                    className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1 px-2"
                  >
                    <Copy className="w-3 h-3" />
                    Copiar Defesa
                  </Button>
                )}
              </div>
              <Textarea
                rows={6}
                value={editForm.defense_text}
                onChange={(e) => setEditForm({ ...editForm, defense_text: e.target.value })}
                placeholder="Redija aqui os argumentos e fatos que comprovam que a loja agiu corretamente e que a reputação não deve ser afetada. Exemplo: 'O produto foi postado rigorosamente no prazo; comprovante de envio em anexo; o cliente confirmou recebimento e solicitou devolução por arrependimento sem defeito técnico...'"
                className="text-xs font-sans leading-relaxed border-slate-300 focus:border-orange-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Dica: Tenha em mãos a NF, data do envio e comprovante de postagem ao falar com o
                atendente do Mercado Livre.
              </p>
            </div>

            {/* Linha 5: Histórico de Contato / Observações */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                Histórico de Contatos & Observações Internas
              </label>
              <Textarea
                rows={2}
                value={editForm.contact_history}
                onChange={(e) => setEditForm({ ...editForm, contact_history: e.target.value })}
                placeholder="Ex: Liguei em 05/10 às 14h, protocolo #123456. Atendente Maria disse que enviou para o time de mediação avaliar em 48h..."
                className="text-xs border-slate-300"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-slate-200 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSaveEdit}
                disabled={savingDispute}
                className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
              >
                {savingDispute ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Salvar Alterações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Nova Contestação Manual */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-600" />
              Adicionar Venda Reclamada para Contestação
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre manualmente uma venda com reputação afetada exibida no painel do Mercado
              Livre.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nº da Venda ML (Obrigatório) *
                </label>
                <Input
                  value={newForm.sale_id_ml}
                  onChange={(e) => setNewForm({ ...newForm, sale_id_ml: e.target.value })}
                  placeholder="Ex: 2000018659048666"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Data da Venda
                </label>
                <Input
                  value={newForm.sale_date}
                  onChange={(e) => setNewForm({ ...newForm, sale_date: e.target.value })}
                  placeholder="Ex: 26 de setembro de 2026"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Título do Produto
              </label>
              <Input
                value={newForm.product_title}
                onChange={(e) => setNewForm({ ...newForm, product_title: e.target.value })}
                placeholder="Ex: Dell Latitude 5420 i5 11a 16gb..."
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nome do Cliente
                </label>
                <Input
                  value={newForm.customer_name}
                  onChange={(e) => setNewForm({ ...newForm, customer_name: e.target.value })}
                  placeholder="Nome do comprador"
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Telefone / WhatsApp
                </label>
                <Input
                  value={newForm.customer_phone}
                  onChange={(e) => setNewForm({ ...newForm, customer_phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nº da Reclamação (Claim ID)
                </label>
                <Input
                  value={newForm.claim_id}
                  onChange={(e) => setNewForm({ ...newForm, claim_id: e.target.value })}
                  placeholder="Ex: 5012345678"
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Status da Exclusão no ML
                </label>
                <Select
                  value={newForm.exclusion_status}
                  onValueChange={(val: DisputeExclusionStatus) =>
                    setNewForm({ ...newForm, exclusion_status: val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nao solicitada">Não solicitada</SelectItem>
                    <SelectItem value="Solicitada">Solicitada</SelectItem>
                    <SelectItem value="Recusada">Recusada</SelectItem>
                    <SelectItem value="Mediacao">Mediação</SelectItem>
                    <SelectItem value="Nao se aplica">Não se aplica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                O que o cliente alega
              </label>
              <Input
                value={newForm.claim_reason}
                onChange={(e) => setNewForm({ ...newForm, claim_reason: e.target.value })}
                placeholder="Ex: com o produto entregue..."
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Texto Inicial de Defesa (Opcional)
              </label>
              <Textarea
                rows={3}
                value={newForm.defense_text}
                onChange={(e) => setNewForm({ ...newForm, defense_text: e.target.value })}
                placeholder="Rascunho de defesa para o atendente..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsNewModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateDispute}
              disabled={creatingDispute}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
            >
              {creatingDispute ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Incluir Caso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
