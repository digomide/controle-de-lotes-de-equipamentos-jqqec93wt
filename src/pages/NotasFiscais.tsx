import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { nfService, type NFConfig, type NFInvoice } from '@/services/nfService'
import { taxRulesService, type TaxRule } from '@/services/taxRulesService'
import { EmitirNFModal } from '@/components/EmitirNFModal'
import { TaxRulesTab } from '@/components/TaxRulesTab'
import {
  FileCheck,
  Building,
  KeyRound,
  FileText,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Search,
  Sliders,
  Sparkles,
} from 'lucide-react'

export default function NotasFiscais() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'tax_rules' | 'config'>('invoices')
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [loadingTaxRules, setLoadingTaxRules] = useState(true)
  const [taxRules, setTaxRules] = useState<TaxRule[]>([])
  const [savingConfig, setSavingConfig] = useState(false)
  const [consultingId, setConsultingId] = useState<string | null>(null)

  // Configuração
  const [config, setConfig] = useState<NFConfig>({
    focus_token: '',
    environment: 'homologacao',
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    inscricao_estadual: '',
    regime_tributario: '1',
    cnae: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: 'SP',
    cep: '',
    telefone: '',
    email: '',
    serie_nfe: '1',
    proximo_numero_nfe: 1,
    default_ncm: '84713012',
    default_cfop_estadual: '5108',
    default_cfop_interestadual: '6108',
    default_csosn: '102',
    natureza_operacao_padrao: 'VENDA DE MERCADORIA USADA',
    informacoes_complementares_padrao:
      'Mercadoria usada. Documento emitido por ME ou EPP optante pelo Simples Nacional.',
  })
  const [certPassword, setCertPassword] = useState('')
  const [certFile, setCertFile] = useState<File | null>(null)

  // Histórico de Notas
  const [invoices, setInvoices] = useState<NFInvoice[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  // Modal de Emissão Avulsa
  const [emitModalOpen, setEmitModalOpen] = useState(false)

  // Carregar Configuração
  const loadConfig = async () => {
    setLoadingConfig(true)
    try {
      const cfg = await nfService.getConfig()
      if (cfg) {
        setConfig((prev) => ({
          ...prev,
          ...cfg,
        }))
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar configurações',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoadingConfig(false)
    }
  }

  // Indicador de configuração ativa do emissor:
  // Considera configurado se o focus_token estiver preenchido no registro ativo
  const isEmissorConfigured = Boolean(config.focus_token && config.focus_token.trim().length > 0)

  // Carregar Notas
  const loadInvoices = async () => {
    setLoadingInvoices(true)
    try {
      const res = await nfService.getInvoices({ perPage: 100 })
      setInvoices(res.items)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar histórico de notas',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoadingInvoices(false)
    }
  }

  // Carregar Regras Fiscais
  const loadTaxRules = async () => {
    setLoadingTaxRules(true)
    try {
      const data = await taxRulesService.getAll()
      setTaxRules(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar regras fiscais',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoadingTaxRules(false)
    }
  }

  useEffect(() => {
    loadConfig()
    loadInvoices()
    loadTaxRules()
  }, [])

  // Salvar Configuração
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingConfig(true)
    try {
      const dataToSave: Partial<NFConfig> = {
        ...config,
      }
      if (certPassword) {
        dataToSave.certificate_password = certPassword
      }

      await nfService.saveConfig(dataToSave, certFile || undefined)
      toast({
        title: 'Configuração salva!',
        description: 'Os parâmetros da empresa emissora foram gravados com sucesso.',
      })
      await loadConfig()
      setCertPassword('')
      setCertFile(null)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Falha ao salvar configuração.',
        variant: 'destructive',
      })
    } finally {
      setSavingConfig(false)
    }
  }

  // Consultar Status de uma NF na SEFAZ
  const handleConsultarStatus = async (inv: NFInvoice) => {
    setConsultingId(inv.id)
    try {
      const res = await nfService.consultStatus(inv.ref)
      toast({
        title: `Status: ${res.status.toUpperCase()}`,
        description: res.mensagem || 'Consulta realizada junto à SEFAZ.',
      })
      await loadInvoices()
    } catch (err: any) {
      toast({
        title: 'Falha na consulta',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setConsultingId(null)
    }
  }

  // Filtragem
  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'todos' && inv.status !== statusFilter) return false
    if (!searchTerm) return true

    const term = searchTerm.toLowerCase()
    const refMatch = inv.ref?.toLowerCase().includes(term)
    const numMatch = inv.numero?.includes(term)
    const chaveMatch = inv.chave_nfe?.toLowerCase().includes(term)
    const destMatch = inv.destinatario?.nome_completo?.toLowerCase().includes(term)
    const docMatch = (inv.destinatario?.cpf || inv.destinatario?.cnpj || '').includes(term)
    const mlMatch = inv.ml_order_id?.toLowerCase().includes(term)

    return refMatch || numMatch || chaveMatch || destMatch || docMatch || mlMatch
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'autorizada':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 font-medium gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Autorizada
          </Badge>
        )
      case 'processando':
        return (
          <Badge className="bg-blue-50 text-blue-800 border-blue-300 font-medium gap-1">
            <Clock className="w-3 h-3 text-blue-600 animate-spin" />
            Processando
          </Badge>
        )
      case 'rejeitada':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-300 font-medium gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Rejeitada
          </Badge>
        )
      case 'cancelada':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-medium">
            Cancelada
          </Badge>
        )
      case 'erro_transmissao':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-medium gap-1">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            Erro de Envio
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Notas Fiscais (NF-e)
              </h1>
              <p className="text-sm text-slate-500">
                Emissor próprio de NF-e para notebooks usados · Transmissão SEFAZ via Focus NFe
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadInvoices()
              loadConfig()
              loadTaxRules()
            }}
            disabled={loadingInvoices || loadingConfig || loadingTaxRules}
            className="h-9 gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingInvoices || loadingConfig || loadingTaxRules ? 'animate-spin' : ''}`}
            />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={() => setEmitModalOpen(true)}
            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Nota Fiscal
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="invoices" className="gap-2 text-xs font-medium">
            <FileText className="w-4 h-4" />
            Histórico de Notas ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="tax_rules" className="gap-2 text-xs font-medium">
            <Sliders className="w-4 h-4" />
            Padrões Fiscais ({taxRules.length})
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 text-xs font-medium">
            <Building className="w-4 h-4" />
            Configuração do Emissor
            <span
              className={`w-2 h-2 rounded-full ml-1 ${
                isEmissorConfigured ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
              title={isEmissorConfigured ? 'Emissor configurado' : 'Aguardando credenciais'}
            />
          </TabsTrigger>
        </TabsList>

        {/* Aba: Histórico de Notas */}
        <TabsContent value="invoices" className="space-y-4">
          {/* Alerta de configuração se ausente */}
          {!isEmissorConfigured && (
            <Card className="border-amber-200 bg-amber-50/70">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="text-xs text-amber-900">
                    <p className="font-semibold text-sm">
                      Emissor próprio aguardando credenciais Focus NFe
                    </p>
                    <p>
                      Para habilitar a transmissão oficial à SEFAZ, acesse a aba "Configuração do
                      Emissor" e adicione seu Token da Focus NFe e dados da empresa.
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100 text-xs shrink-0"
                  onClick={() => setActiveTab('config')}
                >
                  Configurar Agora
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar por número, chave de acesso, cliente, CPF/CNPJ ou pedido ML..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                aria-label="Filtrar por status da nota fiscal"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-xs text-slate-700"
              >
                <option value="todos">Todos os Status</option>
                <option value="autorizada">Autorizadas</option>
                <option value="processando">Em Processamento</option>
                <option value="rejeitada">Rejeitadas</option>
                <option value="cancelada">Canceladas</option>
                <option value="erro_transmissao">Erro de Envio</option>
              </select>
            </div>
          </div>

          {/* Tabela de Notas */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Data</TableHead>
                    <TableHead className="w-[100px]">Número / Ref</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead className="w-[120px]">Origem</TableHead>
                    <TableHead className="w-[110px] text-right">Valor</TableHead>
                    <TableHead className="w-[130px] text-center">Status SEFAZ</TableHead>
                    <TableHead className="w-[140px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInvoices ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                        Carregando notas fiscais...
                      </TableCell>
                    </TableRow>
                  ) : filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        Nenhuma nota fiscal encontrada no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <TableRow key={inv.id} className="text-xs">
                        <TableCell className="font-mono text-slate-600">
                          {new Date(inv.created).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 font-mono">
                            {inv.numero ? `NF-e #${inv.numero}` : inv.ref}
                          </div>
                          {inv.serie && (
                            <span className="text-[10px] text-slate-500">Série {inv.serie}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900 line-clamp-1">
                            {inv.destinatario?.nome_completo || 'Sem nome'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {inv.destinatario?.cpf || inv.destinatario?.cnpj || 'Sem documento'}
                            {inv.destinatario?.uf ? ` · ${inv.destinatario.uf}` : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          {inv.origin_type === 'ml_order' ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-800 text-[10px]"
                            >
                              ML #{inv.ml_order_id}
                            </Badge>
                          ) : inv.origin_type === 'sale_internal' ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-800 text-[10px]"
                            >
                              Venda Interna
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Avulsa
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-slate-900">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(inv.valor_total || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {getStatusBadge(inv.status)}
                            {inv.mensagem_sefaz && inv.status !== 'autorizada' && (
                              <span
                                className="text-[10px] text-slate-500 max-w-[150px] truncate"
                                title={inv.mensagem_sefaz}
                              >
                                {inv.mensagem_sefaz}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.caminho_danfe && (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 gap-1"
                              >
                                <a
                                  href={inv.caminho_danfe}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir DANFE"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  DANFE
                                </a>
                              </Button>
                            )}

                            {inv.status === 'processando' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConsultarStatus(inv)}
                                disabled={consultingId === inv.id}
                                className="h-7 px-2 text-[11px] text-blue-700 hover:text-blue-800 gap-1"
                                title="Consultar status na SEFAZ"
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${
                                    consultingId === inv.id ? 'animate-spin' : ''
                                  }`}
                                />
                                Consultar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba: Padrões Fiscais por Categoria */}
        <TabsContent value="tax_rules" className="space-y-4">
          <TaxRulesTab rules={taxRules} loading={loadingTaxRules} onReload={loadTaxRules} />
        </TabsContent>

        {/* Aba: Configuração do Emissor */}
        <TabsContent value="config">
          <form onSubmit={handleSaveConfig} className="space-y-6">
            {/* Bloco 1: Conexão Focus NFe & Ambiente */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-600" />
                  <CardTitle className="text-base">Credenciais da Focus NFe</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Integração invisível com a SEFAZ. O token é fornecido pelo painel da Focus NFe
                  (https://focusnfe.com.br).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label className="text-xs font-semibold">
                      Token de Acesso (API Focus NFe) *
                    </Label>
                    <Input
                      type="password"
                      className="mt-1 h-9 font-mono text-xs"
                      value={config.focus_token || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, focus_token: e.target.value }))
                      }
                      placeholder="Cole aqui seu token fornecido pela Focus NFe"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Você pode deixar em branco enquanto aguarda o cadastro e salvar os outros
                      dados da empresa.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Ambiente de Emissão</Label>
                    <select
                      aria-label="Ambiente de Emissão da NF-e"
                      value={config.environment}
                      onChange={(e: any) =>
                        setConfig((prev) => ({ ...prev, environment: e.target.value }))
                      }
                      className="w-full mt-1 h-9 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium"
                    >
                      <option value="homologacao">Homologação (Testes / Sem valor fiscal)</option>
                      <option value="producao">Produção (SEFAZ Real / Valor fiscal)</option>
                    </select>
                  </div>
                </div>

                <Separator />

                {/* Certificado Digital A1 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-semibold text-slate-900">
                      Certificado Digital A1 (.pfx)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Arquivo do Certificado (.pfx / .p12)</Label>
                      <Input
                        type="file"
                        accept=".pfx,.p12"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setCertFile(e.target.files[0])
                          }
                        }}
                        className="mt-1 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      />
                      {config.certificate_file && !certFile && (
                        <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Certificado salvo no sistema.
                        </p>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs">Senha do Certificado A1</Label>
                      <Input
                        type="password"
                        className="mt-1 h-9 text-xs"
                        value={certPassword}
                        onChange={(e) => setCertPassword(e.target.value)}
                        placeholder="Digite a senha somente se for atualizar o .pfx"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bloco 2: Dados Cadastrais da Empresa */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-600" />
                  <CardTitle className="text-base">Dados Cadastrais da Empresa Emissora</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Estes dados serão inseridos no cabeçalho das notas fiscais transmitidas à SEFAZ.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">CNPJ</Label>
                    <Input
                      className="mt-1 h-9 text-xs font-mono"
                      value={config.cnpj || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cnpj: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      placeholder="Somente dígitos"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs">Razão Social</Label>
                    <Input
                      className="mt-1 h-9 text-xs"
                      value={config.razao_social || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, razao_social: e.target.value }))
                      }
                      placeholder="Razão Social completa"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Nome Fantasia</Label>
                    <Input
                      className="mt-1 h-9 text-xs"
                      value={config.nome_fantasia || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, nome_fantasia: e.target.value }))
                      }
                      placeholder="Nome Fantasia"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Inscrição Estadual (IE)</Label>
                    <Input
                      className="mt-1 h-9 text-xs font-mono"
                      value={config.inscricao_estadual || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, inscricao_estadual: e.target.value }))
                      }
                      placeholder="IE da empresa"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Regime Tributário da Empresa</Label>
                    <select
                      aria-label="Regime Tributário da Empresa"
                      value={config.regime_tributario || '1'}
                      onChange={(e: any) =>
                        setConfig((prev) => ({ ...prev, regime_tributario: e.target.value }))
                      }
                      className="w-full mt-1 h-9 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="1">Simples Nacional (ME / EPP - Padrão)</option>
                      <option value="2">Lucro Presumido</option>
                      <option value="3">Lucro Real</option>
                    </select>
                    <span className="text-[10px] text-slate-500">
                      Adaptação dinâmica para empresas no Simples ou Regime Normal
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Endereço */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">CEP</Label>
                    <Input
                      className="mt-1 h-9 text-xs font-mono"
                      value={config.cep || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cep: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      placeholder="00000-000"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs">Logradouro</Label>
                    <Input
                      className="mt-1 h-9 text-xs"
                      value={config.logradouro || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, logradouro: e.target.value }))
                      }
                      placeholder="Rua / Avenida"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Número</Label>
                    <Input
                      className="mt-1 h-9 text-xs"
                      value={config.numero || ''}
                      onChange={(e) => setConfig((prev) => ({ ...prev, numero: e.target.value }))}
                      placeholder="123"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Complemento</Label>
                    <Input
                      className="mt-1 h-9 text-xs"
                      value={config.complemento || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, complemento: e.target.value }))
                      }
                      placeholder="Sala, Galpão..."
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Bairro</Label>
                    <Input
                      className="mt-1 h-9 text-xs"
                      value={config.bairro || ''}
                      onChange={(e) => setConfig((prev) => ({ ...prev, bairro: e.target.value }))}
                      placeholder="Bairro"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Município</Label>
                    <Input
                      className="mt-1 h-9 text-xs"
                      value={config.municipio || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, municipio: e.target.value }))
                      }
                      placeholder="São Paulo"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">UF</Label>
                    <Input
                      maxLength={2}
                      className="mt-1 h-9 text-xs uppercase text-center"
                      value={config.uf || 'SP'}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, uf: e.target.value.toUpperCase() }))
                      }
                      placeholder="SP"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bloco 3: Configurações de Numeração e Emissão Própria */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-emerald-600" />
                  <CardTitle className="text-base">Numeração e Série do Emissor Próprio</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Série separada (Série 2) para emissão sem colidir com o Bling (Série 1). O próximo
                  número é incrementado automaticamente a cada autorização.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Série da NF-e *</Label>
                    <Input
                      className="mt-1 h-9 text-xs font-mono font-bold text-emerald-800 bg-emerald-50/50"
                      value={config.serie_nfe || '2'}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, serie_nfe: e.target.value }))
                      }
                      placeholder="2"
                    />
                    <span className="text-[10px] text-slate-500">
                      Default "2" (não colide com o Bling na Série 1)
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Próximo Número da NF-e *</Label>
                    <Input
                      type="number"
                      min="1"
                      className="mt-1 h-9 text-xs font-mono font-bold text-slate-900"
                      value={config.proximo_numero_nfe ?? 1}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          proximo_numero_nfe: parseInt(e.target.value, 10) || 1,
                        }))
                      }
                    />
                    <span className="text-[10px] text-slate-500">
                      Controle sequencial editável da Série {config.serie_nfe || '2'}
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Natureza da Operação Padrão</Label>
                    <Input
                      className="mt-1 h-9 text-xs"
                      value={config.natureza_operacao_padrao || 'Venda de Mercadorias'}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          natureza_operacao_padrao: e.target.value,
                        }))
                      }
                      placeholder="Venda de Mercadorias"
                    />
                    <span className="text-[10px] text-slate-500">
                      Default: "Venda de Mercadorias"
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div>
                    <Label className="text-xs">NCM Padrão Fallback</Label>
                    <Input
                      className="mt-1 h-9 text-xs font-mono"
                      value={config.default_ncm || '84713012'}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, default_ncm: e.target.value }))
                      }
                    />
                    <span className="text-[10px] text-slate-500">
                      Usado se o produto não tiver regra
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs">CFOP Estadual Fallback</Label>
                    <Input
                      className="mt-1 h-9 text-xs font-mono"
                      value={config.default_cfop_estadual || '5405'}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, default_cfop_estadual: e.target.value }))
                      }
                    />
                    <span className="text-[10px] text-slate-500">Dentro UF (fallback: 5405)</span>
                  </div>

                  <div>
                    <Label className="text-xs">CFOP Interestadual Fallback</Label>
                    <Input
                      className="mt-1 h-9 text-xs font-mono"
                      value={config.default_cfop_interestadual || '6404'}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          default_cfop_interestadual: e.target.value,
                        }))
                      }
                    />
                    <span className="text-[10px] text-slate-500">Fora UF (fallback: 6404)</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">
                    Informações Complementares Padrão (DANFE)
                  </Label>
                  <Textarea
                    className="mt-1 text-xs"
                    rows={3}
                    value={
                      config.informacoes_complementares_padrao ||
                      'Empresa optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI. Tributos aprox.: R$ 0,00 (fonte IBPT)'
                    }
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        informacoes_complementares_padrao: e.target.value,
                      }))
                    }
                  />
                  <span className="text-[10px] text-slate-500">
                    Padrão Bling para optantes pelo Simples Nacional com menção à lei e valor IBPT
                    editável por nota.
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                disabled={savingConfig}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {savingConfig ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Salvando Parâmetros...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Salvar Configurações
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>

      {/* Modal de Emissão Manual */}
      <EmitirNFModal
        open={emitModalOpen}
        onOpenChange={setEmitModalOpen}
        originType="manual"
        onSuccess={() => {
          loadInvoices()
        }}
      />
    </div>
  )
}
