import React, { useState, useEffect, useMemo } from 'react'
import {
  Send,
  Plus,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
  Calendar,
  Sparkles,
  RefreshCw,
  Trash2,
  Users,
  Package,
  Layers,
  ArrowRight,
  MessageSquare,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { marketingService } from '@/services/marketingService'
import type {
  MarketingCampaign,
  MarketingCampaignStatus,
  MarketingChannel,
  MarketingContact,
  MarketingMessage,
} from '@/types/marketing'
import type { Product } from '@/types/inventory'

const TEMPLATE_SUGGESTIONS = [
  {
    title: 'Aviso de Chegada de Lote (Revendedores)',
    channel: 'whatsapp' as const,
    batch_notice: true,
    tipo: 'revendedor' as const,
    body: `Olá {{nome}}, tudo bem?\n\nAcabou de chegar um novo lote corporativo aqui na AmbicorpFlow:\n📦 *{{produto}}*\n🏷️ Preço especial de lote: *{{preco}}*\n\nEquipamentos testados, higienizados e com garantia. Lote limitado!\nConfira as fotos e especificações completas:\n👉 {{link_loja}}\n\nPodemos separar um lote para você? Responda direto neste WhatsApp!`,
  },
  {
    title: 'Oferta Especial Direta (Equipamento Específico)',
    channel: 'whatsapp' as const,
    batch_notice: false,
    tipo: 'todos' as const,
    body: `Olá {{nome}}!\n\nSeparamos uma oportunidade única no nosso estoque:\n💻 *{{produto}}*\n⚡ Estado impecável e revisado\n💰 Apenas *{{preco}}*\n\nVeja todos os detalhes e fotos reais:\n🔗 {{link_loja}}\n\nQualquer dúvida me chame aqui: {{whatsapp}}`,
  },
  {
    title: 'Reativação de Contatos Corporativos',
    channel: 'whatsapp' as const,
    batch_notice: true,
    tipo: 'corporativo' as const,
    body: `Olá {{nome}}, como está a demanda de TI da sua empresa?\n\nEstamos com disponibilidade imediata para fornecimento corporativo em quantidade de notebooks Dell, Lenovo ThinkPad e HP.\n\nAtendemos com emissão de NF, garantia estendida e faturamento para empresas.\nConfira nosso catálogo corporativo:\n👉 {{link_loja}}\n\nCaso precise de cotação formal, fico à disposição!`,
  },
]

export function MarketingCampaignsTab() {
  const { toast } = useToast()

  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)

  // Dados auxiliares para o preview e seleção
  const [products, setProducts] = useState<Product[]>([])
  const [sampleContacts, setSampleContacts] = useState<MarketingContact[]>([])

  // Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [campName, setCampName] = useState('')
  const [campChannel, setCampChannel] = useState<MarketingChannel>('whatsapp')
  const [campProductId, setCampProductId] = useState<string>('')
  const [campBatchNotice, setCampBatchNotice] = useState(false)
  const [campAudienceTipo, setCampAudienceTipo] = useState<string>('todos')
  const [campMessageBody, setCampMessageBody] = useState('')
  const [campScheduledAt, setCampScheduledAt] = useState('')
  const [savingCamp, setSavingCamp] = useState(false)

  // Modal de Visualização de Mensagens / Logs
  const [modalLogsOpen, setModalLogsOpen] = useState(false)
  const [selectedCampaignForLogs, setSelectedCampaignForLogs] = useState<MarketingCampaign | null>(
    null,
  )
  const [messagesLog, setMessagesLog] = useState<MarketingMessage[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Disparo manual
  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [campList, prodList, contactList] = await Promise.all([
        marketingService.getCampaigns(),
        pb.collection('products').getFullList<Product>({
          filter: 'status = "Disponível"',
          sort: '-created',
          fields: 'id,name,model,brand,unit_price,sku,photos,images',
        }),
        marketingService.getContacts({ perPage: 10 }),
      ])
      setCampaigns(campList)
      setProducts(prodList)
      setSampleContacts(contactList.items)
    } catch (err: any) {
      console.error('Erro ao carregar dados de campanhas:', err)
      toast({
        title: 'Erro ao carregar campanhas',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Selecionar produto selecionado atualmente no formulário
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === campProductId) || products[0] || null
  }, [products, campProductId])

  const sampleContact = useMemo(() => {
    return sampleContacts[0] || null
  }, [sampleContacts])

  // Gerar preview real do texto da campanha
  const previewBody = useMemo(() => {
    let text = campMessageBody
    const contactName = sampleContact ? sampleContact.name : 'João da Silva'
    const waStore = '(31) 99231-0866'

    text = text.replace(/{{\s*nome\s*}}/gi, contactName)
    text = text.replace(/{{\s*whatsapp\s*}}/gi, waStore)

    if (selectedProduct) {
      const prodName = selectedProduct.name || 'Lenovo ThinkPad T580 i7'
      const priceStr = Number(selectedProduct.unit_price || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
      text = text.replace(/{{\s*produto\s*}}/gi, prodName)
      text = text.replace(/{{\s*preco\s*}}/gi, priceStr)
      text = text.replace(
        /{{\s*link_loja\s*}}/gi,
        `${window.location.origin}/loja/${selectedProduct.id}`,
      )
    } else {
      text = text.replace(/{{\s*produto\s*}}/gi, 'Lote de Notebooks Corporativos')
      text = text.replace(/{{\s*preco\s*}}/gi, 'Sob Consulta')
      text = text.replace(/{{\s*link_loja\s*}}/gi, `${window.location.origin}/loja`)
    }

    return text
  }, [campMessageBody, selectedProduct, sampleContact])

  const handleOpenNewCampaign = () => {
    setCampName('')
    setCampChannel('whatsapp')
    setCampProductId(products[0]?.id || '')
    setCampBatchNotice(true)
    setCampAudienceTipo('revendedor')
    setCampMessageBody(TEMPLATE_SUGGESTIONS[0].body)
    setCampScheduledAt('')
    setModalOpen(true)
  }

  const handleApplyTemplate = (tmpl: (typeof TEMPLATE_SUGGESTIONS)[0]) => {
    setCampChannel(tmpl.channel)
    setCampBatchNotice(tmpl.batch_notice)
    setCampAudienceTipo(tmpl.tipo)
    setCampMessageBody(tmpl.body)
  }

  const handleSaveCampaign = async (isScheduled = false) => {
    if (!campName.trim() || !campMessageBody.trim()) {
      toast({
        title: 'Campos incompletos',
        description: 'Informe o título da campanha e a mensagem.',
        variant: 'destructive',
      })
      return
    }

    setSavingCamp(true)
    try {
      const status: MarketingCampaignStatus =
        isScheduled && campScheduledAt ? 'agendada' : 'rascunho'
      await marketingService.createCampaign({
        name: campName.trim(),
        channel: campChannel,
        product_id: campProductId || undefined,
        batch_notice: campBatchNotice,
        message_body: campMessageBody,
        audience_filter: {
          tipo: campAudienceTipo as any,
        },
        status,
        scheduled_at:
          isScheduled && campScheduledAt ? new Date(campScheduledAt).toISOString() : undefined,
      })

      toast({
        title: 'Campanha criada!',
        description: isScheduled
          ? 'Campanha agendada para envio automático pelo robô.'
          : 'Campanha salva como rascunho.',
      })
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar campanha',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSavingCamp(false)
    }
  }

  const handleTriggerCampaign = async (campaign: MarketingCampaign) => {
    setTriggeringId(campaign.id)
    try {
      const res = await marketingService.triggerCampaignProcess(campaign.id)
      toast({
        title: 'Disparo executado',
        description: res.message,
      })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro no disparo',
        description: err?.message || 'Falha ao processar campanha.',
        variant: 'destructive',
      })
    } finally {
      setTriggeringId(null)
    }
  }

  const handlePauseCampaign = async (id: string) => {
    try {
      await marketingService.updateCampaign(id, { status: 'pausada' })
      toast({ title: 'Campanha pausada' })
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao pausar', description: err?.message, variant: 'destructive' })
    }
  }

  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Deseja remover a campanha "${name}"?`)) return
    try {
      await marketingService.deleteCampaign(id)
      toast({ title: 'Campanha removida' })
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err?.message, variant: 'destructive' })
    }
  }

  const handleViewLogs = async (camp: MarketingCampaign) => {
    setSelectedCampaignForLogs(camp)
    setModalLogsOpen(true)
    setLoadingLogs(true)
    try {
      const logs = await marketingService.getCampaignMessages(camp.id)
      setMessagesLog(logs)
    } catch (err: any) {
      console.error('Erro ao carregar logs:', err)
      toast({ title: 'Erro ao carregar mensagens', variant: 'destructive' })
    } finally {
      setLoadingLogs(false)
    }
  }

  const getStatusBadge = (status: MarketingCampaignStatus) => {
    switch (status) {
      case 'concluida':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold text-[10px]">
            Concluída
          </Badge>
        )
      case 'enviando':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-none font-semibold text-[10px] animate-pulse">
            Enviando...
          </Badge>
        )
      case 'agendada':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-none font-semibold text-[10px]">
            Agendada
          </Badge>
        )
      case 'pausada':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-none font-semibold text-[10px]">
            Pausada
          </Badge>
        )
      case 'erro':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-none font-semibold text-[10px]">
            Erro
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-slate-600 bg-slate-50 text-[10px]">
            Rascunho
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de Ações Superior */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Campanhas Automatizadas</h3>
          <p className="text-xs text-slate-500">
            Crie comunicados de lote ou ofertas de notebooks com envio oficial via Meta WhatsApp
            Cloud API.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="text-xs text-slate-600 h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={handleOpenNewCampaign}
            className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {/* Grid de Campanhas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Carregando campanhas...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8">
            <Send className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">Nenhuma campanha cadastrada</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Crie sua primeira campanha para avisar os revendedores sobre a chegada de novos lotes
              ou promover um notebook específico.
            </p>
            <Button
              size="sm"
              onClick={handleOpenNewCampaign}
              className="mt-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              Criar Campanha Agora
            </Button>
          </div>
        ) : (
          campaigns.map((camp) => {
            const prod = camp.expand?.product_id
            const stats = camp.stats || {}
            const isProcessing = triggeringId === camp.id || camp.status === 'enviando'

            return (
              <Card
                key={camp.id}
                className="border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-3 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {camp.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase font-semibold">
                          {camp.channel}
                        </span>
                        {camp.batch_notice && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                            Aviso de Lote
                          </span>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(camp.status)}
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between text-xs">
                  <div className="space-y-2">
                    {/* Equipamento vinculado */}
                    {prod ? (
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
                        <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate text-[11px]">
                            {prod.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {Number(prod.unit_price || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-[11px] flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Campanha institucional / geral (sem equipamento fixo)</span>
                      </div>
                    )}

                    {/* Trecho da mensagem */}
                    <p className="text-slate-600 line-clamp-3 bg-white p-2 rounded border border-slate-100 text-[11px] font-mono whitespace-pre-line">
                      {camp.message_body}
                    </p>

                    {/* Stats de disparo */}
                    <div className="grid grid-cols-3 gap-2 text-center p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Total</span>
                        <span className="font-bold text-slate-800 text-xs">
                          {stats.total_destinatarios || stats.total || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 block">Enviados</span>
                        <span className="font-bold text-emerald-700 text-xs">
                          {stats.enviados || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-500 block">Erros</span>
                        <span className="font-bold text-rose-600 text-xs">
                          {stats.erros || stats.sem_credencial || 0}
                        </span>
                      </div>
                    </div>

                    {/* Aviso de modo sem credencial */}
                    {stats.sem_credencial ? (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                        ⚠️ Aguardando credenciais da Meta Cloud API. As mensagens foram registradas
                        em modo degradado.
                      </div>
                    ) : null}
                  </div>

                  {/* Ações da Campanha */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewLogs(camp)}
                      className="text-xs text-slate-600 h-8 gap-1 px-2"
                      title="Ver disparos e logs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Logs
                    </Button>

                    <div className="flex items-center gap-1.5">
                      {camp.status === 'enviando' || camp.status === 'agendada' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePauseCampaign(camp.id)}
                          className="text-xs h-8 text-amber-700 border-amber-300 hover:bg-amber-50"
                        >
                          <Pause className="w-3 h-3 mr-1" /> Pausar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleTriggerCampaign(camp)}
                          className="text-xs h-8 bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-semibold gap-1"
                        >
                          {isProcessing ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          {camp.status === 'concluida' ? 'Reenviar' : 'Disparar'}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600"
                        title="Excluir campanha"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Modal Nova Campanha */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-600" />
              Criar Nova Campanha de Marketing
            </DialogTitle>
            <DialogDescription>
              Dispare mensagens personalizadas no WhatsApp ou crie posts combinados com o catálogo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
            {/* Coluna de Configuração (7 colunas) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1">
                <Label className="text-slate-700">Nome da Campanha *</Label>
                <Input
                  placeholder="Ex: Chegada Lote ThinkPad T580 - Março"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Sugestões de Modelos Prontos */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 flex items-center gap-1.5 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Modelos prontos de mensagem:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_SUGGESTIONS.map((tmpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 px-2 py-1 rounded-lg text-slate-700 transition-colors"
                    >
                      {tmpl.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-700">Canal de Disparo</Label>
                  <Select
                    value={campChannel}
                    onValueChange={(v) => setCampChannel(v as MarketingChannel)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp (Oficial Meta)</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="ambos">Ambos (WhatsApp + Insta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-slate-700">Público-Alvo (Filtro)</Label>
                  <Select value={campAudienceTipo} onValueChange={setCampAudienceTipo}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Contatos Ativos</SelectItem>
                      <SelectItem value="revendedor">Apenas Revendedores</SelectItem>
                      <SelectItem value="cliente">Apenas Clientes Finais</SelectItem>
                      <SelectItem value="corporativo">Apenas Corporativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Produto Vinculado */}
              <div className="space-y-1">
                <Label className="text-slate-700">Equipamento em Destaque (Opcional)</Label>
                <Select value={campProductId} onValueChange={setCampProductId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione um equipamento..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum (Campanha Geral / Institucional)</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.model || p.name} — R$ {Number(p.unit_price || 0).toFixed(2)} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Mensagem e Variáveis */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-700">Corpo da Mensagem *</Label>
                  <span className="text-[10px] text-slate-400">
                    Variáveis: {'{{nome}}'}, {'{{produto}}'}, {'{{preco}}'}, {'{{link_loja}}'},{' '}
                    {'{{whatsapp}}'}
                  </span>
                </div>
                <Textarea
                  rows={8}
                  value={campMessageBody}
                  onChange={(e) => setCampMessageBody(e.target.value)}
                  className="font-mono text-xs resize-y"
                  placeholder="Escreva sua mensagem aqui usando as variáveis..."
                />
              </div>

              {/* Agendamento */}
              <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <Label className="text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  Agendar Disparo Automático (Opcional)
                </Label>
                <Input
                  type="datetime-local"
                  value={campScheduledAt}
                  onChange={(e) => setCampScheduledAt(e.target.value)}
                  className="h-9 text-xs bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  Deixe vazio para salvar como rascunho ou disparar manualmente na hora.
                </p>
              </div>
            </div>

            {/* Coluna de Preview Real (5 colunas) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 bg-emerald-950 text-white rounded-2xl shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-800 pb-2 text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    Preview Real no WhatsApp
                  </span>
                  <span className="text-[10px] text-emerald-400/80">Exemplo</span>
                </div>

                <div className="bg-emerald-900/60 p-3 rounded-xl border border-emerald-700/50 space-y-2 text-[11px] leading-relaxed">
                  <div className="text-[10px] text-emerald-300 font-semibold">
                    Destinatário:{' '}
                    <span className="text-white">
                      {sampleContact ? sampleContact.name : 'João da Silva (Revendedor)'}
                    </span>
                  </div>

                  <div className="bg-emerald-800/90 p-3 rounded-lg text-white font-sans whitespace-pre-line shadow-xs">
                    {previewBody || (
                      <span className="text-emerald-300 italic">
                        O texto renderizado com dados reais aparecerá aqui...
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-emerald-300/80 leading-normal">
                  * No momento do envio, as variáveis entre chaves serão substituídas
                  automaticamente pelo nome de cada contato e pelos dados reais do notebook
                  selecionado.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={savingCamp}
                onClick={() => handleSaveCampaign(false)}
                className="text-xs"
              >
                Salvar Rascunho
              </Button>
              <Button
                type="button"
                disabled={savingCamp}
                onClick={() => handleSaveCampaign(Boolean(campScheduledAt))}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {savingCamp
                  ? 'Salvando...'
                  : campScheduledAt
                    ? 'Agendar Campanha'
                    : 'Criar Campanha'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Logs de Disparos */}
      <Dialog open={modalLogsOpen} onOpenChange={setModalLogsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-700" />
              Logs de Envio: {selectedCampaignForLogs?.name}
            </DialogTitle>
            <DialogDescription>
              Histórico de cada mensagem gerada para os destinatários desta campanha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            {loadingLogs ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                Carregando histórico...
              </div>
            ) : messagesLog.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl">
                Nenhum disparo registrado ainda para esta campanha.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {messagesLog.map((msg) => (
                  <div key={msg.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {msg.expand?.contact_id?.name || msg.phone}
                        </span>
                        <span className="font-mono text-slate-500 text-[11px]">{msg.phone}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-1">{msg.body_final}</p>
                      {msg.error && (
                        <p className="text-[11px] text-rose-600 font-medium">Motivo: {msg.error}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          msg.status === 'enviado' || msg.status === 'entregue'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : msg.status === 'sem_credencial'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                        }
                      >
                        {msg.status}
                      </Badge>
                      <span className="block text-[10px] text-slate-400 mt-1">
                        {new Date(msg.created).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalLogsOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
