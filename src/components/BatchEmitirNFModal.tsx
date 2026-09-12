import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import { nfService, type NFConfig, type NFItem, type EmitNFInput } from '@/services/nfService'
import { taxRulesService, type TaxRule } from '@/services/taxRulesService'
import { type MLOrder } from '@/services/mlOrdersService'
import {
  FileCheck,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Layers,
  ArrowRight,
  ShieldAlert,
  FileText,
  Clock,
} from 'lucide-react'

export interface OrderValidationResult {
  order: MLOrder
  valid: boolean
  invalidReason?: string
  destinatario: {
    nome_completo: string
    cpf?: string
    cnpj?: string
    logradouro: string
    numero: string
    complemento: string
    bairro: string
    municipio: string
    uf: string
    cep: string
  }
  itens: NFItem[]
  valorTotal: number
  categoriaIdentificada?: string
  cfopAplicado: string
  alreadyInvoiced?: boolean
  existingInvoice?: any
}

export interface BatchItemExecution {
  orderId: string
  status: 'pending' | 'transmitting' | 'autorizada' | 'rejeitada' | 'erro_transmissao'
  numero?: string
  serie?: string
  chave_nfe?: string
  caminho_danfe?: string
  mensagem?: string
  errorDetail?: string
}

interface BatchEmitirNFModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: MLOrder[]
  onSuccess?: () => void
}

export function BatchEmitirNFModal({
  open,
  onOpenChange,
  orders,
  onSuccess,
}: BatchEmitirNFModalProps) {
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [config, setConfig] = useState<NFConfig | null>(null)
  const [taxRules, setTaxRules] = useState<TaxRule[]>([])
  const [existingInvoicesMap, setExistingInvoicesMap] = useState<Record<string, any>>({})

  // Estado de execução do lote
  const [stage, setStage] = useState<'review' | 'transmitting' | 'summary'>('review')
  const [executions, setExecutions] = useState<BatchItemExecution[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const isCancelledRef = useRef<boolean>(false)

  // CFOP helper baseado em regras e UF
  const resolveItemCfop = (
    rule: TaxRule | null,
    emitterUf: string | undefined,
    destUf: string | undefined,
    cfg: NFConfig | null,
  ): string => {
    const isSameUf =
      destUf && emitterUf && destUf.toUpperCase().trim() === emitterUf.toUpperCase().trim()

    if (rule) {
      return isSameUf ? rule.cfop_dentro || '5405' : rule.cfop_fora || '6404'
    }

    return isSameUf
      ? cfg?.default_cfop_estadual || '5405'
      : cfg?.default_cfop_interestadual || '6404'
  }

  // Carregar dados de configuração e notas existentes
  useEffect(() => {
    if (!open) {
      setStage('review')
      setExecutions([])
      setCurrentIndex(0)
      isCancelledRef.current = false
      return
    }

    let isMounted = true

    async function loadData() {
      setLoadingConfig(true)
      try {
        const [cfg, rules] = await Promise.all([nfService.getConfig(), taxRulesService.getActive()])
        if (!isMounted) return
        setConfig(cfg)
        setTaxRules(rules)

        // Verificar notas existentes dos pedidos selecionados
        const invMap: Record<string, any> = {}
        await Promise.all(
          orders.map(async (ord) => {
            try {
              const inv = await nfService.getInvoiceByMLOrder(ord.order_id)
              if (inv) {
                invMap[ord.order_id] = inv
              }
            } catch {
              // ignora erro pontual de busca
            }
          }),
        )

        if (!isMounted) return
        setExistingInvoicesMap(invMap)
      } catch (err) {
        console.error('Erro ao preparar lote de emissão de NF-e:', err)
      } finally {
        if (isMounted) setLoadingConfig(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [open, orders])

  // Avaliação de cada pedido selecionado
  const validationResults: OrderValidationResult[] = useMemo(() => {
    const emitterUf = config?.uf || 'MG'

    return orders.map((order) => {
      const existing = existingInvoicesMap[order.order_id]
      const isAlreadyAuthorized =
        existing && (existing.status === 'autorizada' || existing.status === 'processando')

      const raw = order.raw_order || {}
      const buyer = raw.buyer || {}
      const shipping = raw.shipping || {}
      const receiver = shipping.receiver_address || order.receiver_address || {}

      // Comprador: busca de nome
      const buyerName = (
        receiver.receiver_name ||
        [buyer.first_name, buyer.last_name].filter(Boolean).join(' ') ||
        order.buyer_name ||
        order.buyer_nickname ||
        buyer.nickname ||
        ''
      ).trim()

      // Documento (CPF / CNPJ)
      const rawDoc =
        order.buyer_document ||
        buyer.billing_info?.doc_number ||
        buyer.doc_number ||
        buyer.identification?.number ||
        ''
      const cleanDoc = String(rawDoc).replace(/\D/g, '')
      const isCpf = cleanDoc.length === 11
      const isCnpj = cleanDoc.length === 14
      const hasValidDoc = isCpf || isCnpj

      // Endereço e UF
      const destUf = (
        receiver.state?.name ||
        receiver.state?.id ||
        (typeof receiver.state === 'string' ? receiver.state : '') ||
        'SP'
      )
        .substring(0, 2)
        .toUpperCase()

      const logradouro =
        receiver.street_name ||
        receiver.address_line ||
        (receiver.comment ? 'Endereço fornecido' : '') ||
        ''

      const municipio =
        receiver.city?.name || (typeof receiver.city === 'string' ? receiver.city : '') || ''

      const hasValidAddress = Boolean(logradouro && (municipio || destUf))

      // Itens e Regras
      const orderItems =
        order.items && order.items.length > 0
          ? order.items
          : raw.order_items?.map((oi: any) => ({
              item_id: oi.item?.id || 'PROD',
              title: oi.item?.title || 'Notebook Usado',
              seller_sku: oi.item?.seller_custom_field || oi.item?.id || '',
              quantity: oi.quantity || 1,
              unit_price: oi.unit_price || 0,
            })) || []

      let mainCategory = ''
      let mainCfop = ''

      const mappedItens: NFItem[] = (
        orderItems.length > 0
          ? orderItems
          : [
              {
                item_id: order.order_id || 'PROD-01',
                title: 'Notebook Usado',
                quantity: 1,
                unit_price: order.total_amount || 0,
              },
            ]
      ).map((it: any, idx: number) => {
        const title = it.title || 'Notebook Usado'
        const qtd = Number(it.quantity) || 1
        const unitPrice =
          Number(it.unit_price) || (order.total_amount ? Number(order.total_amount) / qtd : 0)
        const matchedRule = taxRulesService.matchRule(taxRules, title)
        const cfop = resolveItemCfop(matchedRule, emitterUf, destUf, config)

        if (idx === 0) {
          mainCategory = matchedRule?.categoria || 'Padrão'
          mainCfop = cfop
        }

        return {
          codigo_produto: it.item_id || it.seller_sku || `PROD-${idx + 1}`,
          sku: it.seller_sku || '',
          descricao: title,
          categoria: matchedRule?.categoria || '',
          ncm: matchedRule?.ncm_sugerido || config?.default_ncm || '84713012',
          cest: matchedRule?.cest_sugerido || '',
          cfop: cfop,
          csosn: matchedRule?.csosn || config?.default_csosn || '500',
          cst_icms: matchedRule?.cst || '',
          pis_cst: '01',
          cofins_cst: '01',
          ipi_cst: '99',
          origem: typeof matchedRule?.origem === 'number' ? matchedRule.origem : 0,
          quantidade: qtd,
          valor_unitario: unitPrice,
          valor_total: Math.round(qtd * unitPrice * 100) / 100,
        }
      })

      const totalCalculated = mappedItens.reduce((acc, it) => acc + (it.valor_total || 0), 0)

      // Validação geral do pedido
      let valid = true
      let invalidReason = ''

      if (isAlreadyAuthorized) {
        valid = false
        invalidReason = `NF-e já ${existing.status === 'autorizada' ? 'autorizada' : 'em processamento'} (Nº ${existing.numero || existing.ref || '-'})`
      } else if (!buyerName) {
        valid = false
        invalidReason = 'Comprador sem nome / identificação'
      } else if (!hasValidDoc) {
        valid = false
        invalidReason = 'CPF ou CNPJ ausente / incompleto'
      } else if (!hasValidAddress) {
        valid = false
        invalidReason = 'Endereço de entrega incompleto'
      } else if (mappedItens.length === 0) {
        valid = false
        invalidReason = 'Pedido sem itens faturáveis'
      }

      return {
        order,
        valid,
        invalidReason,
        destinatario: {
          nome_completo: buyerName,
          cpf: isCpf ? cleanDoc : undefined,
          cnpj: isCnpj ? cleanDoc : undefined,
          logradouro: logradouro || 'Rua',
          numero: receiver.street_number || 'S/N',
          complemento: receiver.comment || '',
          bairro: receiver.neighborhood?.name || receiver.city?.name || 'Centro',
          municipio: municipio || 'Município',
          uf: destUf.length === 2 ? destUf : 'SP',
          cep: String(receiver.zip_code || '').replace(/\D/g, ''),
        },
        itens: mappedItens,
        valorTotal: totalCalculated > 0 ? totalCalculated : Number(order.total_amount || 0),
        categoriaIdentificada: mainCategory,
        cfopAplicado: mainCfop || (destUf === emitterUf ? '5405' : '6404'),
        alreadyInvoiced: Boolean(isAlreadyAuthorized),
        existingInvoice: existing,
      }
    })
  }, [orders, config, taxRules, existingInvoicesMap])

  // Pedidos elegíveis para emissão
  const eligibleOrders = useMemo(() => {
    return validationResults.filter((r) => r.valid)
  }, [validationResults])

  const ineligibleOrders = useMemo(() => {
    return validationResults.filter((r) => !r.valid)
  }, [validationResults])

  // Formatação de Moeda
  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  // Executar transmissão SEQUENCIAL do lote
  const handleStartBatch = async () => {
    if (!config?.focus_token) {
      toast({
        title: 'Emissor não configurado',
        description: 'Configure o token da Focus NFe em Notas Fiscais para transmitir.',
        variant: 'destructive',
      })
      return
    }

    if (eligibleOrders.length === 0) {
      toast({
        title: 'Nenhum pedido apto',
        description:
          'Todos os pedidos selecionados possuem pendências fiscais ou já têm nota emitida.',
        variant: 'destructive',
      })
      return
    }

    // Inicializar fila de execuções
    const initialExecutions: BatchItemExecution[] = eligibleOrders.map((eo) => ({
      orderId: eo.order.order_id,
      status: 'pending',
    }))

    setExecutions(initialExecutions)
    setCurrentIndex(0)
    setStage('transmitting')
    isCancelledRef.current = false

    const defaultNatureza = config.natureza_operacao_padrao || 'VENDA DE MERCADORIA'
    const defaultInfo =
      config.informacoes_complementares_padrao ||
      'Documento emitido por ME ou EPP optante pelo Simples Nacional.'

    let authorizedCount = 0
    let rejectedCount = 0

    for (let i = 0; i < eligibleOrders.length; i++) {
      if (isCancelledRef.current) {
        break
      }

      const itemTarget = eligibleOrders[i]
      setCurrentIndex(i)

      // Atualiza status do item atual para transmitting
      setExecutions((prev) =>
        prev.map((ex, idx) => (idx === i ? { ...ex, status: 'transmitting' } : ex)),
      )

      try {
        const payload: EmitNFInput = {
          origin_type: 'ml_order',
          ml_order_id: itemTarget.order.order_id,
          destinatario: itemTarget.destinatario,
          itens: itemTarget.itens,
          natureza_operacao: defaultNatureza,
          informacoes_complementares: defaultInfo,
        }

        const res = await nfService.emitInvoice(payload)

        if (res.status === 'autorizada') {
          authorizedCount++
          setExecutions((prev) =>
            prev.map((ex, idx) =>
              idx === i
                ? {
                    ...ex,
                    status: 'autorizada',
                    numero: res.numero,
                    serie: config.serie_nfe || '2',
                    chave_nfe: res.chave_nfe,
                    caminho_danfe: res.caminho_danfe,
                    mensagem: res.mensagem || 'Autorizada com sucesso pela SEFAZ.',
                  }
                : ex,
            ),
          )
        } else if (res.status === 'rejeitada' || res.status === 'erro_transmissao') {
          rejectedCount++
          setExecutions((prev) =>
            prev.map((ex, idx) =>
              idx === i
                ? {
                    ...ex,
                    status: res.status as any,
                    numero: res.numero,
                    mensagem: res.mensagem || 'Nota rejeitada pela SEFAZ.',
                  }
                : ex,
            ),
          )
        } else {
          // Status processando na SEFAZ (contabiliza como sucesso parcial / em fila)
          authorizedCount++
          setExecutions((prev) =>
            prev.map((ex, idx) =>
              idx === i
                ? {
                    ...ex,
                    status: 'autorizada',
                    numero: res.numero,
                    mensagem: res.mensagem || 'Em processamento na SEFAZ.',
                    caminho_danfe: res.caminho_danfe,
                  }
                : ex,
            ),
          )
        }
      } catch (err: any) {
        rejectedCount++
        const errorMsg =
          err?.data?.error ||
          err?.data?.mensagem ||
          err?.message ||
          'Falha de comunicação com Focus NFe'

        setExecutions((prev) =>
          prev.map((ex, idx) =>
            idx === i
              ? {
                  ...ex,
                  status: 'erro_transmissao',
                  mensagem: errorMsg,
                  errorDetail: String(err),
                }
              : ex,
          ),
        )
      }

      // Pequena pausa entre transmissões (400ms) para respiro da API e evitar concorrência
      await new Promise((resolve) => setTimeout(resolve, 400))
    }

    setStage('summary')

    if (authorizedCount > 0 && onSuccess) {
      onSuccess()
    }

    toast({
      title: 'Processamento do lote concluído!',
      description: `${authorizedCount} autorizada(s), ${rejectedCount} com erro/rejeição.`,
      variant: authorizedCount > 0 ? 'default' : 'destructive',
    })
  }

  const progressPercent =
    eligibleOrders.length > 0 && stage !== 'review'
      ? Math.round(
          (executions.filter((e) => e.status !== 'pending' && e.status !== 'transmitting').length /
            eligibleOrders.length) *
            100,
        )
      : 0

  const summaryStats = useMemo(() => {
    const autorizadas = executions.filter((e) => e.status === 'autorizada')
    const rejeitadas = executions.filter(
      (e) => e.status === 'rejeitada' || e.status === 'erro_transmissao',
    )
    return {
      autorizadas,
      rejeitadas,
    }
  }, [executions])

  return (
    <Dialog open={open} onOpenChange={stage === 'transmitting' ? () => {} : onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Emissão de NF-e em Lote
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-xs"
                  >
                    {orders.length} selecionado{orders.length > 1 ? 's' : ''}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Transmissão sequencial direta via Focus NFe · Próximo número e série gerenciados
                  automaticamente
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-slate-50 font-mono text-xs">
                Série {config?.serie_nfe || '2'}
              </Badge>
              {config?.environment && (
                <Badge
                  variant="outline"
                  className={
                    config.environment === 'producao'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-semibold'
                      : 'bg-amber-50 text-amber-900 border-amber-300 text-xs font-semibold'
                  }
                >
                  {config.environment === 'producao' ? 'Produção SEFAZ' : 'Homologação (Testes)'}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {loadingConfig ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium">Carregando dados fiscais e validando pedidos...</p>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Aviso de Homologação em destaque */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Ambiente atual:{' '}
                  <strong>
                    {config?.environment === 'producao'
                      ? 'PRODUÇÃO SEFAZ (Validade Fiscal Real)'
                      : 'HOMOLOGAÇÃO SEFAZ (Ambiente de Testes da Focus NFe)'}
                  </strong>
                  . As notas serão emitidas na <strong>Série {config?.serie_nfe || '2'}</strong>.
                </span>
              </div>
            </div>

            {/* FASE 1: REVISÃO ANTES DE TRANSMITIR */}
            {stage === 'review' && (
              <div className="space-y-4">
                {/* Resumo de Aptos vs Inaptos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card className="border-slate-200 shadow-xs bg-slate-50">
                    <CardContent className="p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block">
                        Total Selecionado
                      </span>
                      <span className="text-2xl font-black text-slate-900 mt-0.5 block font-mono">
                        {orders.length}
                      </span>
                    </CardContent>
                  </Card>

                  <Card className="border-emerald-200 shadow-xs bg-emerald-50/50">
                    <CardContent className="p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold block flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Aptos para Emissão
                      </span>
                      <span className="text-2xl font-black text-emerald-800 mt-0.5 block font-mono">
                        {eligibleOrders.length}
                      </span>
                    </CardContent>
                  </Card>

                  <Card className="border-rose-200 shadow-xs bg-rose-50/50">
                    <CardContent className="p-3.5">
                      <span className="text-[11px] uppercase tracking-wider text-rose-700 font-bold block flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Inaptos / Bloqueados
                      </span>
                      <span className="text-2xl font-black text-rose-800 mt-0.5 block font-mono">
                        {ineligibleOrders.length}
                      </span>
                    </CardContent>
                  </Card>
                </div>

                {/* Lista de Pedidos Elegíveis */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Pedidos Prontos para Emissão ({eligibleOrders.length})
                  </h4>

                  {eligibleOrders.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500">
                      Nenhum pedido apto para emissão no lote. Verifique se os pedidos selecionados
                      possuem comprador e endereço completos ou se já possuem NF emitida.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                      {eligibleOrders.map((item) => (
                        <div
                          key={item.order.order_id}
                          className="p-3 bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-slate-900">
                                #{item.order.order_id}
                              </span>
                              <span className="text-slate-700 font-medium truncate max-w-[200px]">
                                {item.destinatario.nome_completo}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                UF: {item.destinatario.uf}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]"
                              >
                                CFOP {item.cfopAplicado} · {item.categoriaIdentificada || 'Geral'}
                              </Badge>
                            </div>
                            <p
                              className="text-[11px] text-slate-500 truncate mt-0.5"
                              title={item.itens[0]?.descricao}
                            >
                              {item.itens[0]?.descricao || 'Produto'}
                              {item.itens.length > 1 ? ` (+ ${item.itens.length - 1} item)` : ''}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-slate-900 block">
                              {formatCurrency(item.valorTotal)}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-medium">
                              Pronto para envio
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lista de Inaptos / Alertas se houver */}
                {ineligibleOrders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      Pedidos que NÃO serão transmitidos ({ineligibleOrders.length})
                    </h4>
                    <div className="border border-rose-200 bg-rose-50/30 rounded-lg overflow-hidden divide-y divide-rose-100 max-h-48 overflow-y-auto">
                      {ineligibleOrders.map((item) => (
                        <div
                          key={item.order.order_id}
                          className="p-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">
                                #{item.order.order_id}
                              </span>
                              <span className="text-slate-600 truncate max-w-[200px]">
                                {item.destinatario.nome_completo || 'Sem nome'}
                              </span>
                            </div>
                            <p className="text-[11px] text-rose-700 font-medium mt-0.5 flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                              {item.invalidReason}
                            </p>
                          </div>
                          <span className="font-mono text-slate-500 text-xs shrink-0">
                            {formatCurrency(item.valorTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FASE 2: TRANSMISSÃO EM ANDAMENTO */}
            {stage === 'transmitting' && (
              <div className="space-y-5 py-4">
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-700 animate-pulse">
                    <Loader2 className="w-7 h-7 animate-spin" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Emitindo NF-e em lote...</h3>
                  <p className="text-xs text-slate-500">
                    Processando pedido{' '}
                    <strong>
                      {currentIndex + 1} de {eligibleOrders.length}
                    </strong>{' '}
                    (Série {config?.serie_nfe || '2'})
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Progresso total</span>
                    <span className="font-mono font-bold">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2.5 bg-slate-100" />
                </div>

                {/* Grade de status de cada item da fila */}
                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {executions.map((ex, idx) => {
                    const itemData = eligibleOrders[idx]
                    return (
                      <div
                        key={ex.orderId}
                        className={`p-3 text-xs flex items-center justify-between gap-3 ${
                          ex.status === 'transmitting'
                            ? 'bg-amber-50/70 border-l-4 border-l-amber-500'
                            : ex.status === 'autorizada'
                              ? 'bg-emerald-50/40'
                              : ex.status === 'rejeitada' || ex.status === 'erro_transmissao'
                                ? 'bg-rose-50/40'
                                : 'bg-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              #{ex.orderId}
                            </span>
                            <span className="text-slate-600 truncate max-w-[220px]">
                              {itemData?.destinatario.nome_completo}
                            </span>
                          </div>
                          {ex.mensagem && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {ex.mensagem}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {ex.status === 'pending' && (
                            <Badge variant="outline" className="text-[10px] text-slate-500 gap-1">
                              <Clock className="w-3 h-3" /> Na fila
                            </Badge>
                          )}
                          {ex.status === 'transmitting' && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] gap-1 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" /> Transmitindo...
                            </Badge>
                          )}
                          {ex.status === 'autorizada' && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Autorizada #{ex.numero || ''}
                            </Badge>
                          )}
                          {(ex.status === 'rejeitada' || ex.status === 'erro_transmissao') && (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] gap-1">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Rejeitada
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* FASE 3: RESUMO FINAL */}
            {stage === 'summary' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-400/5 to-transparent border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-emerald-950 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        Lote de Emissão Finalizado!
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {summaryStats.autorizadas.length} autorizada(s) com sucesso na Série{' '}
                        {config?.serie_nfe || '2'}
                        {summaryStats.rejeitadas.length > 0 &&
                          ` · ${summaryStats.rejeitadas.length} com rejeição ou erro`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <Badge className="bg-emerald-600 text-white text-xs px-2.5 py-1">
                        {summaryStats.autorizadas.length} Autorizada(s)
                      </Badge>
                      {summaryStats.rejeitadas.length > 0 && (
                        <Badge variant="destructive" className="text-xs px-2.5 py-1">
                          {summaryStats.rejeitadas.length} Rejeitada(s)
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detalhes dos Resultados */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Resultado Detalhado por Pedido
                  </h4>

                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {executions.map((ex) => {
                      const isOk = ex.status === 'autorizada'
                      return (
                        <div
                          key={ex.orderId}
                          className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {isOk ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <span className="font-mono font-bold text-slate-900">
                                Pedido #{ex.orderId}
                              </span>
                              {ex.numero && (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[10px] bg-slate-50"
                                >
                                  NF-e nº {ex.numero}
                                </Badge>
                              )}
                            </div>
                            <p
                              className={`text-[11px] mt-1 ${
                                isOk ? 'text-slate-600' : 'text-rose-700 font-medium'
                              }`}
                            >
                              {ex.mensagem || (isOk ? 'Autorizada' : 'Erro')}
                            </p>
                            {ex.chave_nfe && (
                              <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                Chave: {ex.chave_nfe}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {ex.caminho_danfe && (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1"
                              >
                                <a
                                  href={ex.caminho_danfe}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FileText className="w-3 h-3" />
                                  DANFE
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-0 border-t border-slate-100 pt-3">
          {stage === 'review' && (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={handleStartBatch}
                disabled={loadingConfig || eligibleOrders.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm"
              >
                <Send className="w-4 h-4" />
                Confirmar e Emitir {eligibleOrders.length} NF-e
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </Button>
            </>
          )}

          {stage === 'transmitting' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                isCancelledRef.current = true
                toast({
                  title: 'Parada solicitada',
                  description: 'A transmissão será interrompida após o item atual.',
                })
              }}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              Interromper lote
            </Button>
          )}

          {stage === 'summary' && (
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              Concluir e Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
