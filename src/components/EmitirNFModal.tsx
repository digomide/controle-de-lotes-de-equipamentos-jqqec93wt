import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import {
  nfService,
  type NFConfig,
  type NFDestinatario,
  type NFItem,
  type EmitNFInput,
} from '@/services/nfService'
import {
  FileCheck,
  Send,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Building,
  User,
  MapPin,
  FileText,
} from 'lucide-react'

interface EmitirNFModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originType: 'ml_order' | 'sale_internal' | 'manual'
  mlOrder?: any
  sale?: any
  onSuccess?: () => void
}

export function EmitirNFModal({
  open,
  onOpenChange,
  originType,
  mlOrder,
  sale,
  onSuccess,
}: EmitirNFModalProps) {
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [transmitting, setTransmitting] = useState(false)
  const [config, setConfig] = useState<NFConfig | null>(null)

  // Feedback SEFAZ / Focus
  const [resultStatus, setResultStatus] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [danfeUrl, setDanfeUrl] = useState<string | null>(null)
  const [chaveNfe, setChaveNfe] = useState<string | null>(null)
  const [numeroNfe, setNumeroNfe] = useState<string | null>(null)
  const [createdRef, setCreatedRef] = useState<string | null>(null)

  // Form State
  const [naturezaOperacao, setNaturezaOperacao] = useState('')
  const [informacoesComplementares, setInformacoesComplementares] = useState('')

  const [destinatario, setDestinatario] = useState<NFDestinatario>({
    nome_completo: '',
    cpf: '',
    cnpj: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: 'SP',
    cep: '',
  })

  const [itens, setItens] = useState<NFItem[]>([])

  // Carregar dados de configuração e preparar campos
  useEffect(() => {
    if (!open) {
      setResultStatus(null)
      setResultMessage(null)
      setDanfeUrl(null)
      setChaveNfe(null)
      setNumeroNfe(null)
      setCreatedRef(null)
      return
    }

    async function loadData() {
      setLoadingConfig(true)
      try {
        const cfg = await nfService.getConfig()
        setConfig(cfg)

        const defaultNatureza = cfg?.natureza_operacao_padrao || 'VENDA DE MERCADORIA USADA'
        const defaultObs =
          cfg?.informacoes_complementares_padrao ||
          'Mercadoria usada. Documento emitido por ME ou EPP optante pelo Simples Nacional.'
        const defaultNcm = cfg?.default_ncm || '84713012' // Notebook
        const defaultCsosn = cfg?.default_csosn || '102'

        setNaturezaOperacao(defaultNatureza)
        setInformacoesComplementares(defaultObs)

        // Preenchimento a partir de Pedido ML
        if (originType === 'ml_order' && mlOrder) {
          const buyer = mlOrder.buyer || {}
          const shipping = mlOrder.shipping || {}
          const receiver = shipping.receiver_address || {}

          const buyerName =
            receiver.receiver_name ||
            [buyer.first_name, buyer.last_name].filter(Boolean).join(' ') ||
            buyer.nickname ||
            ''
          const buyerDoc = (buyer.billing_info?.doc_number || '').replace(/\D/g, '')
          const isCnpj = buyerDoc.length === 14

          const destUf = receiver.state?.name || receiver.state?.id || 'SP'
          const defaultCfop =
            cfg?.uf && destUf.toUpperCase() !== cfg.uf.toUpperCase()
              ? cfg.default_cfop_interestadual || '6108'
              : cfg?.default_cfop_estadual || '5108'

          setDestinatario({
            nome_completo: buyerName,
            cpf: !isCnpj ? buyerDoc : '',
            cnpj: isCnpj ? buyerDoc : '',
            logradouro: receiver.street_name || '',
            numero: receiver.street_number || 'S/N',
            complemento: receiver.comment || '',
            bairro: receiver.neighborhood?.name || receiver.city?.name || 'Centro',
            municipio: receiver.city?.name || '',
            uf: destUf.length === 2 ? destUf.toUpperCase() : 'SP',
            cep: (receiver.zip_code || '').replace(/\D/g, ''),
          })

          // Itens do Pedido ML
          const orderItems = mlOrder.order_items || []
          if (orderItems.length > 0) {
            const mappedItens: NFItem[] = orderItems.map((oi: any) => {
              const qtd = oi.quantity || 1
              const unitPrice = oi.unit_price || 0
              return {
                codigo_produto: oi.item?.id || 'NOTEBOOK',
                sku: oi.item?.seller_custom_field || oi.item?.id || '',
                descricao: oi.item?.title || 'Notebook Usado',
                ncm: defaultNcm,
                cfop: defaultCfop,
                csosn: defaultCsosn,
                quantidade: qtd,
                valor_unitario: unitPrice,
                valor_total: qtd * unitPrice,
              }
            })
            setItens(mappedItens)
          } else {
            setItens([
              {
                codigo_produto: mlOrder.order_id || 'PROD-01',
                descricao: mlOrder.item_title || 'Notebook Usado',
                ncm: defaultNcm,
                cfop: defaultCfop,
                csosn: defaultCsosn,
                quantidade: 1,
                valor_unitario: mlOrder.total_amount || 0,
                valor_total: mlOrder.total_amount || 0,
              },
            ])
          }
        } else if (originType === 'sale_internal' && sale) {
          // Preenchimento a partir de venda interna
          const clientName = sale.client_name || sale.buyer_name || ''
          const clientDoc = (sale.client_document || sale.document || '').replace(/\D/g, '')
          const isCnpj = clientDoc.length === 14

          const destUf = sale.client_uf || 'SP'
          const defaultCfop =
            cfg?.uf && destUf.toUpperCase() !== cfg.uf.toUpperCase()
              ? cfg.default_cfop_interestadual || '6108'
              : cfg?.default_cfop_estadual || '5108'

          setDestinatario({
            nome_completo: clientName,
            cpf: !isCnpj ? clientDoc : '',
            cnpj: isCnpj ? clientDoc : '',
            logradouro: sale.client_address || '',
            numero: sale.client_number || 'S/N',
            complemento: sale.client_complement || '',
            bairro: sale.client_bairro || 'Centro',
            municipio: sale.client_city || '',
            uf: destUf.length === 2 ? destUf.toUpperCase() : 'SP',
            cep: (sale.client_cep || '').replace(/\D/g, ''),
          })

          setItens([
            {
              codigo_produto: sale.id || 'NOTEBOOK',
              descricao: sale.product_description || sale.description || 'Notebook Usado',
              ncm: defaultNcm,
              cfop: defaultCfop,
              csosn: defaultCsosn,
              quantidade: sale.quantity || 1,
              valor_unitario: sale.unit_price || sale.total_value || 0,
              valor_total: sale.total_value || 0,
            },
          ])
        } else {
          // Emissão manual em branco
          const defaultCfop = cfg?.default_cfop_estadual || '5108'
          setItens([
            {
              codigo_produto: 'NOTEBOOK-01',
              descricao: 'Notebook Usado Core i5 8GB SSD',
              ncm: defaultNcm,
              cfop: defaultCfop,
              csosn: defaultCsosn,
              quantidade: 1,
              valor_unitario: 0,
              valor_total: 0,
            },
          ])
        }
      } catch (err) {
        console.error('Erro ao inicializar formulário de NF:', err)
      } finally {
        setLoadingConfig(false)
      }
    }

    loadData()
  }, [open, originType, mlOrder, sale])

  const handleAddItem = () => {
    const defaultNcm = config?.default_ncm || '84713012'
    const defaultCfop = config?.default_cfop_estadual || '5108'
    const defaultCsosn = config?.default_csosn || '102'

    setItens((prev) => [
      ...prev,
      {
        codigo_produto: `ITEM-${prev.length + 1}`,
        descricao: 'Notebook Usado',
        ncm: defaultNcm,
        cfop: defaultCfop,
        csosn: defaultCsosn,
        quantidade: 1,
        valor_unitario: 0,
        valor_total: 0,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateItem = (index: number, field: keyof NFItem, value: any) => {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const updated = { ...item, [field]: value }
        if (field === 'quantidade' || field === 'valor_unitario') {
          const q = field === 'quantidade' ? parseFloat(value) || 0 : item.quantidade
          const v = field === 'valor_unitario' ? parseFloat(value) || 0 : item.valor_unitario
          updated.valor_total = Math.round(q * v * 100) / 100
        }
        return updated
      }),
    )
  }

  const valorTotalGeral = itens.reduce((acc, it) => acc + (it.valor_total || 0), 0)

  // Enviar nota fiscal
  const handleTransmitir = async () => {
    if (!config?.focus_token) {
      toast({
        title: 'Emissor não configurado',
        description:
          'Configure o emissor em Configurações → Notas Fiscais para habilitar a transmissão de NF-e.',
        variant: 'destructive',
      })
      return
    }

    if (!destinatario.nome_completo.trim()) {
      toast({
        title: 'Nome do destinatário obrigatório',
        description: 'Informe a razão social ou nome do comprador.',
        variant: 'destructive',
      })
      return
    }

    const doc = (destinatario.cpf || destinatario.cnpj || destinatario.documento || '').replace(
      /\D/g,
      '',
    )
    if (!doc) {
      toast({
        title: 'CPF ou CNPJ obrigatório',
        description: 'Preencha o CPF ou CNPJ do comprador para emissão da nota fiscal.',
        variant: 'destructive',
      })
      return
    }

    if (itens.length === 0) {
      toast({
        title: 'Sem itens',
        description: 'Adicione ao menos um item à nota fiscal.',
        variant: 'destructive',
      })
      return
    }

    setTransmitting(true)
    setResultStatus(null)
    setResultMessage(null)

    try {
      const payload: EmitNFInput = {
        origin_type: originType,
        ml_order_id: originType === 'ml_order' ? mlOrder?.order_id || mlOrder?.id : undefined,
        sale_id: originType === 'sale_internal' ? sale?.id : undefined,
        destinatario: {
          ...destinatario,
          cpf: doc.length === 11 ? doc : undefined,
          cnpj: doc.length === 14 ? doc : undefined,
        },
        itens,
        natureza_operacao: naturezaOperacao,
        informacoes_complementares: informacoesComplementares,
      }

      const res = await nfService.emitInvoice(payload)
      setResultStatus(res.status)
      setResultMessage(res.mensagem || 'Transmissão concluída.')
      setChaveNfe(res.chave_nfe || null)
      setNumeroNfe(res.numero || null)
      setDanfeUrl(res.caminho_danfe || null)
      setCreatedRef(res.ref)

      if (res.status === 'autorizada') {
        toast({
          title: 'NF-e Autorizada pela SEFAZ!',
          description: `Nota nº ${res.numero} emitida com sucesso.`,
        })
        if (onSuccess) onSuccess()
      } else if (res.status === 'processando') {
        toast({
          title: 'NF-e em Processamento',
          description: 'A nota foi enviada para a SEFAZ e está na fila de autorização.',
        })
        if (onSuccess) onSuccess()
      } else {
        toast({
          title: 'Aviso da SEFAZ',
          description: res.mensagem || 'Verifique os dados da nota.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || 'Falha na transmissão da nota fiscal'
      setResultStatus('erro_transmissao')
      setResultMessage(msg)
      toast({
        title: 'Erro de emissão',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setTransmitting(false)
    }
  }

  // Consultar status se estiver processando
  const handleConsultarStatus = async () => {
    if (!createdRef) return
    setTransmitting(true)
    try {
      const res = await nfService.consultStatus(createdRef)
      setResultStatus(res.status)
      setResultMessage(res.mensagem || 'Status atualizado.')
      if (res.caminho_danfe) setDanfeUrl(res.caminho_danfe)
      if (res.chave_nfe) setChaveNfe(res.chave_nfe)
      if (res.numero) setNumeroNfe(res.numero)

      if (res.status === 'autorizada') {
        toast({
          title: 'NF-e Autorizada com sucesso!',
          description: `Número: ${res.numero}`,
        })
        if (onSuccess) onSuccess()
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao consultar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setTransmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  Emissão de Nota Fiscal Eletrônica (NF-e)
                </DialogTitle>
                <DialogDescription>
                  {originType === 'ml_order'
                    ? `Venda Mercado Livre #${mlOrder?.order_id || ''}`
                    : originType === 'sale_internal'
                      ? `Venda Interna #${sale?.id || ''}`
                      : 'Emissão Avulsa'}
                  {' · '}Transmissão SEFAZ via Focus NFe
                </DialogDescription>
              </div>
            </div>

            {config?.environment && (
              <Badge
                variant="outline"
                className={
                  config.environment === 'producao'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }
              >
                {config.environment === 'producao' ? 'Produção' : 'Ambiente Homologação'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loadingConfig ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm">Carregando dados fiscais e pré-preenchimento...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Aviso se emissor não configurado */}
            {!config?.focus_token && (
              <Card className="border-amber-200 bg-amber-50/70">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 space-y-1">
                    <p className="font-semibold text-sm">Emissor próprio não configurado</p>
                    <p>
                      Para transmitir notas fiscais à SEFAZ, acesse{' '}
                      <strong>Configurações → Notas Fiscais</strong> e preencha o Token da Focus
                      NFe, dados do CNPJ e certificado A1 (.pfx).
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Painel de Resultado SEFAZ se houve tentativa */}
            {resultStatus && (
              <Card
                className={`border ${
                  resultStatus === 'autorizada'
                    ? 'border-emerald-300 bg-emerald-50/70'
                    : resultStatus === 'rejeitada' || resultStatus === 'erro_transmissao'
                      ? 'border-rose-300 bg-rose-50/70'
                      : 'border-blue-300 bg-blue-50/70'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {resultStatus === 'autorizada' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : resultStatus === 'processando' ? (
                        <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600" />
                      )}
                      <span className="font-semibold text-sm capitalize">
                        Status SEFAZ: {resultStatus}
                      </span>
                    </div>

                    {resultStatus === 'processando' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleConsultarStatus}
                        disabled={transmitting}
                        className="h-8 gap-1 text-xs"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${transmitting ? 'animate-spin' : ''}`}
                        />
                        Consultar Status
                      </Button>
                    )}
                  </div>

                  {resultMessage && (
                    <p className="text-xs text-slate-700 bg-white/70 p-2.5 rounded border border-slate-200">
                      <strong>Mensagem:</strong> {resultMessage}
                    </p>
                  )}

                  {(chaveNfe || numeroNfe || danfeUrl) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs pt-1">
                      {numeroNfe && (
                        <div>
                          <span className="text-slate-500 block">Número da NF-e:</span>
                          <span className="font-mono font-semibold">{numeroNfe}</span>
                        </div>
                      )}
                      {chaveNfe && (
                        <div className="md:col-span-2">
                          <span className="text-slate-500 block">Chave de Acesso:</span>
                          <span className="font-mono text-[11px] break-all">{chaveNfe}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {danfeUrl && (
                    <div className="pt-2">
                      <Button
                        asChild
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 text-xs"
                      >
                        <a href={danfeUrl} target="_blank" rel="noopener noreferrer">
                          <FileText className="w-3.5 h-3.5" />
                          Visualizar / Imprimir DANFE (PDF)
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Cabeçalho da Nota */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Natureza da Operação</Label>
                <Input
                  className="h-9 mt-1 text-xs"
                  value={naturezaOperacao}
                  onChange={(e) => setNaturezaOperacao(e.target.value)}
                  placeholder="Ex: VENDA DE MERCADORIA USADA"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Empresa Emissora</Label>
                <div className="h-9 mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs flex items-center justify-between text-slate-700">
                  <span className="truncate">
                    {config?.razao_social ||
                      config?.nome_fantasia ||
                      'Razão Social não configurada'}
                  </span>
                  <span className="font-mono text-slate-500 shrink-0 ml-2">
                    {config?.cnpj || 'Sem CNPJ'}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Bloco Destinatário */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">Destinatário / Comprador</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">Nome Completo / Razão Social *</Label>
                  <Input
                    className="h-9 mt-1 text-xs"
                    value={destinatario.nome_completo}
                    onChange={(e) =>
                      setDestinatario((prev) => ({ ...prev, nome_completo: e.target.value }))
                    }
                    placeholder="Nome do cliente ou empresa"
                  />
                </div>

                <div>
                  <Label className="text-xs">CPF ou CNPJ *</Label>
                  <Input
                    className="h-9 mt-1 text-xs font-mono"
                    value={destinatario.cpf || destinatario.cnpj || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setDestinatario((prev) => ({
                        ...prev,
                        cpf: val.length <= 11 ? val : '',
                        cnpj: val.length > 11 ? val : '',
                      }))
                    }}
                    placeholder="Somente dígitos"
                  />
                </div>

                <div>
                  <Label className="text-xs">CEP</Label>
                  <Input
                    className="h-9 mt-1 text-xs font-mono"
                    value={destinatario.cep || ''}
                    onChange={(e) =>
                      setDestinatario((prev) => ({
                        ...prev,
                        cep: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="00000-000"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs">Logradouro (Rua / Av)</Label>
                  <Input
                    className="h-9 mt-1 text-xs"
                    value={destinatario.logradouro || ''}
                    onChange={(e) =>
                      setDestinatario((prev) => ({ ...prev, logradouro: e.target.value }))
                    }
                    placeholder="Rua das Flores"
                  />
                </div>

                <div>
                  <Label className="text-xs">Número</Label>
                  <Input
                    className="h-9 mt-1 text-xs"
                    value={destinatario.numero || ''}
                    onChange={(e) =>
                      setDestinatario((prev) => ({ ...prev, numero: e.target.value }))
                    }
                    placeholder="123 ou S/N"
                  />
                </div>

                <div>
                  <Label className="text-xs">Bairro</Label>
                  <Input
                    className="h-9 mt-1 text-xs"
                    value={destinatario.bairro || ''}
                    onChange={(e) =>
                      setDestinatario((prev) => ({ ...prev, bairro: e.target.value }))
                    }
                    placeholder="Centro"
                  />
                </div>

                <div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Município</Label>
                      <Input
                        className="h-9 mt-1 text-xs"
                        value={destinatario.municipio || ''}
                        onChange={(e) =>
                          setDestinatario((prev) => ({ ...prev, municipio: e.target.value }))
                        }
                        placeholder="São Paulo"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">UF</Label>
                      <Input
                        className="h-9 mt-1 text-xs uppercase text-center"
                        maxLength={2}
                        value={destinatario.uf || 'SP'}
                        onChange={(e) =>
                          setDestinatario((prev) => ({
                            ...prev,
                            uf: e.target.value.toUpperCase(),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Bloco Itens da NF */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Itens da NF-e ({itens.length})
                  </h3>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddItem}
                  className="h-8 gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Item
                </Button>
              </div>

              <div className="space-y-3">
                {itens.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Item #{idx + 1}</span>
                      {itens.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(idx)}
                          className="h-6 w-6 p-0 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="md:col-span-3">
                        <Label className="text-[11px]">Descrição do Produto</Label>
                        <Input
                          className="h-8 text-xs bg-white"
                          value={it.descricao}
                          onChange={(e) => handleUpdateItem(idx, 'descricao', e.target.value)}
                          placeholder="Notebook Usado Dell / Lenovo / HP"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px]">NCM</Label>
                        <Input
                          className="h-8 text-xs font-mono bg-white"
                          value={it.ncm}
                          onChange={(e) => handleUpdateItem(idx, 'ncm', e.target.value)}
                          placeholder="84713012"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div>
                        <Label className="text-[11px]">CFOP</Label>
                        <Input
                          className="h-8 text-xs font-mono bg-white"
                          value={it.cfop}
                          onChange={(e) => handleUpdateItem(idx, 'cfop', e.target.value)}
                          placeholder="5108"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px]">CSOSN</Label>
                        <Input
                          className="h-8 text-xs font-mono bg-white"
                          value={it.csosn || '102'}
                          onChange={(e) => handleUpdateItem(idx, 'csosn', e.target.value)}
                          placeholder="102"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px]">Qtd (UN)</Label>
                        <Input
                          type="number"
                          min="1"
                          className="h-8 text-xs text-right bg-white"
                          value={it.quantidade}
                          onChange={(e) => handleUpdateItem(idx, 'quantidade', e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px]">Valor Unitário (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 text-xs text-right bg-white"
                          value={it.valor_unitario}
                          onChange={(e) => handleUpdateItem(idx, 'valor_unitario', e.target.value)}
                        />
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <Label className="text-[11px]">Subtotal (R$)</Label>
                        <div className="h-8 px-2 bg-slate-200/60 rounded flex items-center justify-end font-semibold text-slate-800">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(it.valor_total || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total da Nota */}
                <div className="flex justify-end pt-2">
                  <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg text-right">
                    <span className="text-xs text-emerald-800 font-medium block">
                      Valor Total da Nota
                    </span>
                    <span className="text-lg font-bold text-emerald-950 font-mono">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(valorTotalGeral)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Informações Complementares */}
            <div>
              <Label className="text-xs font-semibold">
                Informações Complementares de Interesse do Contribuinte
              </Label>
              <Textarea
                className="mt-1 text-xs"
                rows={2}
                value={informacoesComplementares}
                onChange={(e) => setInformacoesComplementares(e.target.value)}
                placeholder="Ex: Mercadoria usada com garantia de 90 dias. Tributação Simples Nacional."
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={transmitting}
          >
            Fechar
          </Button>

          <Button
            type="button"
            onClick={handleTransmitir}
            disabled={transmitting || loadingConfig || resultStatus === 'autorizada'}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {transmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Transmitindo à SEFAZ...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Transmitir NF-e
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
