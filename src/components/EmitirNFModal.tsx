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
import { taxRulesService, type TaxRule } from '@/services/taxRulesService'
import { ncmCestService, normalizeNcm } from '@/services/ncmCestService'
import { mlOrdersService } from '@/services/mlOrdersService'
import { validateFiscalDocument, formatDocument } from '@/utils/documentValidator'
import { NcmAutocomplete } from '@/components/NcmAutocomplete'
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
  User,
  FileText,
  BookmarkPlus,
  Sliders,
  Sparkles,
  Search,
  Check,
  XCircle,
  Info,
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
  const [taxRules, setTaxRules] = useState<TaxRule[]>([])

  // Regime tributário selecionado no momento da emissão (default vem da config)
  // '1' = Simples Nacional, '2' = Lucro Presumido, '3' = Lucro Real
  const [regimeTributario, setRegimeTributario] = useState<string>('1')

  // Feedback SEFAZ / Focus
  const [resultStatus, setResultStatus] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [danfeUrl, setDanfeUrl] = useState<string | null>(null)
  const [chaveNfe, setChaveNfe] = useState<string | null>(null)
  const [numeroNfe, setNumeroNfe] = useState<string | null>(null)
  const [createdRef, setCreatedRef] = useState<string | null>(null)

  // Form State Cabeçalho
  const [naturezaOperacao, setNaturezaOperacao] = useState('')
  const [informacoesComplementares, setInformacoesComplementares] = useState('')
  const [valorIbpt, setValorIbpt] = useState<number>(0)
  const [lookingUpFiscal, setLookingUpFiscal] = useState<boolean>(false)

  // Destinatário
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

  // Itens da NF
  const [itens, setItens] = useState<NFItem[]>([])

  // Modal para "Salvar como regra"
  const [saveRuleModalOpen, setSaveRuleModalOpen] = useState(false)
  const [ruleToSave, setRuleToSave] = useState<{
    categoria: string
    cfop_dentro: string
    cfop_fora: string
    csosn: string
    cst: string
    origem: number
    ncm_sugerido: string
    cest_sugerido: string
  }>({
    categoria: '',
    cfop_dentro: '5405',
    cfop_fora: '6404',
    csosn: '500',
    cst: '',
    origem: 0,
    ncm_sugerido: '',
    cest_sugerido: '',
  })
  const [savingRule, setSavingRule] = useState(false)

  /**
   * Determina o CFOP de um item baseado na regra fiscal e na comparação de UF:
   * Mesma UF da empresa emissora -> cfop_dentro (default 5405)
   * UF diferente -> cfop_fora (default 6404)
   */
  const resolveItemCfop = (
    rule: TaxRule | null,
    emitterUf: string | undefined,
    destUf: string | undefined,
  ): string => {
    const isSameUf =
      destUf && emitterUf && destUf.toUpperCase().trim() === emitterUf.toUpperCase().trim()

    if (rule) {
      return isSameUf ? rule.cfop_dentro || '5405' : rule.cfop_fora || '6404'
    }

    // Fallback geral
    return isSameUf
      ? config?.default_cfop_estadual || '5405'
      : config?.default_cfop_interestadual || '6404'
  }

  // Constrói texto padrão de Informações Complementares com padrão Bling + IBPT
  const buildSimplesObs = (ibptVal: number) => {
    const ibptFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(ibptVal || 0)
    return `Empresa optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI. Tributos aprox.: ${ibptFormatted} (fonte IBPT).`
  }

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
        const [cfg, rules] = await Promise.all([nfService.getConfig(), taxRulesService.getActive()])
        setConfig(cfg)
        setTaxRules(rules)

        const activeRegime = cfg?.regime_tributario || '1'
        setRegimeTributario(activeRegime)

        const defaultNatureza = cfg?.natureza_operacao_padrao || 'Venda de Mercadorias'
        setNaturezaOperacao(defaultNatureza)

        const initialIbpt = 0
        setValorIbpt(initialIbpt)

        if (activeRegime === '1') {
          setInformacoesComplementares(
            cfg?.informacoes_complementares_padrao || buildSimplesObs(initialIbpt),
          )
        } else {
          setInformacoesComplementares(
            cfg?.informacoes_complementares_padrao ||
              'Documento emitido conforme legislação aplicável.',
          )
        }

        const emitterUf = cfg?.uf || 'MG'

        // 1. Preenchimento a partir de Pedido ML
        if (originType === 'ml_order' && mlOrder) {
          const buyer = mlOrder.buyer || {}
          const shipping = mlOrder.shipping || {}
          const receiver = shipping.receiver_address || mlOrder.receiver_address || {}

          const buyerName =
            mlOrder.buyer_name ||
            receiver.receiver_name ||
            [buyer.first_name, buyer.last_name].filter(Boolean).join(' ') ||
            mlOrder.buyer_nickname ||
            buyer.nickname ||
            ''
          const buyerDoc = (
            mlOrder.buyer_document ||
            buyer.billing_info?.doc_number ||
            buyer.doc_number ||
            ''
          ).replace(/\D/g, '')
          const isCnpj = buyerDoc.length === 14

          const destUf = (receiver.state?.name || receiver.state?.id || 'SP')
            .substring(0, 2)
            .toUpperCase()

          setDestinatario({
            nome_completo: buyerName,
            cpf: !isCnpj ? buyerDoc : '',
            cnpj: isCnpj ? buyerDoc : '',
            logradouro: receiver.street_name || '',
            numero: receiver.street_number || 'S/N',
            complemento: receiver.comment || '',
            bairro: receiver.neighborhood?.name || receiver.city?.name || 'Centro',
            municipio: receiver.city?.name || '',
            uf: destUf.length === 2 ? destUf : 'SP',
            cep: (receiver.zip_code || '').replace(/\D/g, ''),
          })

          // Itens do Pedido ML
          const orderItems = mlOrder.order_items || []
          if (orderItems.length > 0) {
            const mappedItens: NFItem[] = orderItems.map((oi: any) => {
              const qtd = oi.quantity || 1
              const unitPrice = oi.unit_price || 0
              const itemTitle = oi.item?.title || 'Notebook Usado'

              // Motor de categoria e regra fiscal
              const matchedRule = taxRulesService.matchRule(rules, itemTitle)
              const resolvedCfop = resolveItemCfop(matchedRule, emitterUf, destUf)

              return {
                codigo_produto: oi.item?.id || 'PROD',
                sku: oi.item?.seller_custom_field || oi.item?.id || '',
                descricao: itemTitle,
                categoria: matchedRule?.categoria || '',
                ncm: matchedRule?.ncm_sugerido || cfg?.default_ncm || '84713012',
                cest: matchedRule?.cest_sugerido || '',
                cfop: resolvedCfop,
                csosn: matchedRule?.csosn || cfg?.default_csosn || '500',
                cst_icms: matchedRule?.cst || '',
                pis_cst: '01',
                cofins_cst: '01',
                ipi_cst: '99',
                origem: typeof matchedRule?.origem === 'number' ? matchedRule.origem : 0,
                quantidade: qtd,
                valor_unitario: unitPrice,
                valor_total: qtd * unitPrice,
              }
            })
            setItens(mappedItens)
          } else {
            const itemTitle = mlOrder.item_title || 'Notebook Usado'
            const matchedRule = taxRulesService.matchRule(rules, itemTitle)
            const resolvedCfop = resolveItemCfop(matchedRule, emitterUf, destUf)

            setItens([
              {
                codigo_produto: mlOrder.order_id || 'PROD-01',
                descricao: itemTitle,
                categoria: matchedRule?.categoria || '',
                ncm: matchedRule?.ncm_sugerido || cfg?.default_ncm || '84713012',
                cest: matchedRule?.cest_sugerido || '',
                cfop: resolvedCfop,
                csosn: matchedRule?.csosn || cfg?.default_csosn || '500',
                cst_icms: matchedRule?.cst || '',
                pis_cst: '01',
                cofins_cst: '01',
                ipi_cst: '99',
                origem: typeof matchedRule?.origem === 'number' ? matchedRule.origem : 0,
                quantidade: 1,
                valor_unitario: mlOrder.total_amount || 0,
                valor_total: mlOrder.total_amount || 0,
              },
            ])
          }
        } else if (originType === 'sale_internal' && sale) {
          // 2. Preenchimento a partir de venda interna
          const clientName = sale.client_name || sale.buyer_name || ''
          const clientDoc = (sale.client_document || sale.document || '').replace(/\D/g, '')
          const isCnpj = clientDoc.length === 14

          const destUf = (sale.client_uf || 'MG').substring(0, 2).toUpperCase()

          setDestinatario({
            nome_completo: clientName,
            cpf: !isCnpj ? clientDoc : '',
            cnpj: isCnpj ? clientDoc : '',
            logradouro: sale.client_address || '',
            numero: sale.client_number || 'S/N',
            complemento: sale.client_complement || '',
            bairro: sale.client_bairro || 'Centro',
            municipio: sale.client_city || '',
            uf: destUf.length === 2 ? destUf : 'MG',
            cep: (sale.client_cep || '').replace(/\D/g, ''),
          })

          const itemDesc = sale.product_description || sale.description || 'Notebook Usado'
          const matchedRule = taxRulesService.matchRule(rules, itemDesc)
          const resolvedCfop = resolveItemCfop(matchedRule, emitterUf, destUf)

          setItens([
            {
              codigo_produto: sale.id || 'NOTEBOOK',
              descricao: itemDesc,
              categoria: matchedRule?.categoria || '',
              ncm: matchedRule?.ncm_sugerido || cfg?.default_ncm || '84713012',
              cest: matchedRule?.cest_sugerido || '',
              cfop: resolvedCfop,
              csosn: matchedRule?.csosn || cfg?.default_csosn || '500',
              cst_icms: matchedRule?.cst || '',
              pis_cst: '01',
              cofins_cst: '01',
              ipi_cst: '99',
              origem: typeof matchedRule?.origem === 'number' ? matchedRule.origem : 0,
              quantidade: sale.quantity || 1,
              valor_unitario: sale.unit_price || sale.total_value || 0,
              valor_total: sale.total_value || 0,
            },
          ])
        } else {
          // 3. Emissão manual em branco
          const destUf = 'SP'
          const defaultRule = rules.find((r) => r.categoria.toLowerCase() === 'notebook') || null
          const resolvedCfop = resolveItemCfop(defaultRule, emitterUf, destUf)

          setItens([
            {
              codigo_produto: 'PROD-01',
              descricao: 'Notebook Usado Core i5 8GB SSD',
              categoria: defaultRule?.categoria || 'Notebook',
              ncm: defaultRule?.ncm_sugerido || cfg?.default_ncm || '84713012',
              cest: defaultRule?.cest_sugerido || '',
              cfop: resolvedCfop,
              csosn: defaultRule?.csosn || cfg?.default_csosn || '500',
              cst_icms: defaultRule?.cst || '',
              pis_cst: '01',
              cofins_cst: '01',
              ipi_cst: '99',
              origem: typeof defaultRule?.origem === 'number' ? defaultRule.origem : 0,
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

  /**
   * Recalcula o CFOP de todos os itens quando a UF do destinatário muda
   */
  const handleDestUfChange = (newUf: string) => {
    const formattedUf = newUf.toUpperCase().substring(0, 2)
    setDestinatario((prev) => ({ ...prev, uf: formattedUf }))

    const emitterUf = config?.uf || 'MG'
    setItens((prev) =>
      prev.map((item) => {
        // Encontra regra da categoria do item se existir
        const rule = item.categoria
          ? taxRules.find((r) => r.categoria.toLowerCase() === item.categoria?.toLowerCase()) ||
            null
          : taxRulesService.matchRule(taxRules, item.descricao)

        const newCfop = resolveItemCfop(rule, emitterUf, formattedUf)
        return { ...item, cfop: newCfop }
      }),
    )
  }

  /**
   * Quando o usuário escolhe ou muda a Categoria de um Item:
   * Carrega CFOP (por UF), CSOSN, CST, Origem e preenche NCM e CEST como SUGESTÃO editável
   */
  const handleItemCategoryChange = (index: number, newCategory: string) => {
    const emitterUf = config?.uf || 'MG'
    const destUf = destinatario.uf || 'SP'

    const rule =
      taxRules.find((r) => r.categoria.toLowerCase() === newCategory.toLowerCase()) || null

    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item

        if (!rule) {
          // Sem regra encontrada para a categoria digitada
          return { ...item, categoria: newCategory }
        }

        const resolvedCfop = resolveItemCfop(rule, emitterUf, destUf)

        return {
          ...item,
          categoria: rule.categoria,
          cfop: resolvedCfop,
          csosn: rule.csosn || item.csosn || '500',
          cst_icms: rule.cst || item.cst_icms || '',
          origem: typeof rule.origem === 'number' ? rule.origem : (item.origem ?? 0),
          // NCM e CEST são sugestões editáveis: se o usuário já digitou, mantemos override ou sugerimos
          ncm: rule.ncm_sugerido || item.ncm,
          cest: rule.cest_sugerido || item.cest || '',
        }
      }),
    )
  }

  const handleAddItem = () => {
    const emitterUf = config?.uf || 'MG'
    const destUf = destinatario.uf || 'SP'
    const defaultRule = taxRules.find((r) => r.categoria.toLowerCase() === 'notebook') || null
    const defaultCfop = resolveItemCfop(defaultRule, emitterUf, destUf)

    setItens((prev) => [
      ...prev,
      {
        codigo_produto: `ITEM-${prev.length + 1}`,
        descricao: '',
        categoria: defaultRule?.categoria || '',
        ncm: defaultRule?.ncm_sugerido || config?.default_ncm || '84713012',
        cest: defaultRule?.cest_sugerido || '',
        cfop: defaultCfop,
        csosn: defaultRule?.csosn || config?.default_csosn || '500',
        cst_icms: defaultRule?.cst || '',
        pis_cst: '01',
        cofins_cst: '01',
        ipi_cst: '99',
        origem: typeof defaultRule?.origem === 'number' ? defaultRule.origem : 0,
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

  /**
   * Trata a alteração do NCM de um item no modal de emissão:
   * 1. Atualiza o NCM no item.
   * 2. Se o NCM atingir 8 dígitos (exato), consulta a tabela de referência NCM->CEST.
   * 3. Se encontrar CEST correspondente e o CEST atual estiver vazio ou compatível,
   *    auto-preenche automaticamente igual o Bling faz.
   * 4. Se o NCM não possuir CEST na tabela oficial (ex: Notebook 84713012 ou HD 84717090),
   *    mantém livre (e limpa caso fosse herança não confirmada).
   */
  const handleItemNcmChange = async (index: number, newNcm: string) => {
    handleUpdateItem(index, 'ncm', newNcm)

    const clean = normalizeNcm(newNcm)
    if (clean.length === 8) {
      try {
        const found = await ncmCestService.findByNcm(clean)
        if (found && found.cest) {
          // Preenche automaticamente o CEST se estiver vazio ou com valor anterior
          setItens((prev) =>
            prev.map((it, i) => {
              if (i !== index) return it
              // Se já tiver CEST e for diferente, não sobrescreve sem intenção, exceto se estiver vazio
              if (!it.cest || it.cest.trim() === '') {
                return { ...it, cest: found.cest }
              }
              return it
            }),
          )
        }
      } catch (err) {
        console.error('Erro ao consultar NCM/CEST:', err)
      }
    }
  }

  /**
   * Aplica explicitamente um CEST selecionado via autocomplete de NCM
   */
  const handleApplyItemCest = (index: number, cest: string) => {
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, cest } : it)))
  }

  const valorTotalGeral = itens.reduce((acc, it) => acc + (it.valor_total || 0), 0)

  // Abrir modal "Salvar como regra"
  const handleOpenSaveAsRule = (item: NFItem) => {
    const isSameUf =
      destinatario.uf && config?.uf && destinatario.uf.toUpperCase() === config.uf.toUpperCase()

    setRuleToSave({
      categoria: item.categoria || item.descricao || '',
      cfop_dentro: isSameUf ? item.cfop : '5405',
      cfop_fora: !isSameUf ? item.cfop : '6404',
      csosn: item.csosn || '500',
      cst: item.cst_icms || '',
      origem: typeof item.origem === 'number' ? item.origem : 0,
      ncm_sugerido: item.ncm || '',
      cest_sugerido: item.cest || '',
    })
    setSaveRuleModalOpen(true)
  }

  // Confirmar salvamento da regra
  const handleConfirmSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleToSave.categoria.trim()) {
      toast({
        title: 'Nome da categoria obrigatório',
        description: 'Informe o nome da categoria para a regra fiscal.',
        variant: 'destructive',
      })
      return
    }

    setSavingRule(true)
    try {
      const existing = taxRules.find(
        (r) => r.categoria.toLowerCase() === ruleToSave.categoria.trim().toLowerCase(),
      )

      if (existing?.id) {
        await taxRulesService.update(existing.id, {
          categoria: ruleToSave.categoria.trim(),
          cfop_dentro: ruleToSave.cfop_dentro.trim(),
          cfop_fora: ruleToSave.cfop_fora.trim(),
          csosn: ruleToSave.csosn.trim(),
          cst: ruleToSave.cst.trim(),
          origem: ruleToSave.origem,
          ncm_sugerido: ruleToSave.ncm_sugerido.trim(),
          cest_sugerido: ruleToSave.cest_sugerido.trim(),
          ativo: true,
        })
        toast({
          title: 'Regra fiscal atualizada!',
          description: `A categoria "${ruleToSave.categoria}" foi salva com sucesso.`,
        })
      } else {
        await taxRulesService.create({
          categoria: ruleToSave.categoria.trim(),
          cfop_dentro: ruleToSave.cfop_dentro.trim(),
          cfop_fora: ruleToSave.cfop_fora.trim(),
          csosn: ruleToSave.csosn.trim(),
          cst: ruleToSave.cst.trim(),
          origem: ruleToSave.origem,
          ncm_sugerido: ruleToSave.ncm_sugerido.trim(),
          cest_sugerido: ruleToSave.cest_sugerido.trim(),
          ativo: true,
        })
        toast({
          title: 'Nova regra fiscal criada!',
          description: `A categoria "${ruleToSave.categoria}" agora possui padrões fiscais automáticos.`,
        })
      }

      const updatedRules = await taxRulesService.getActive()
      setTaxRules(updatedRules)
      setSaveRuleModalOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar regra fiscal',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSavingRule(false)
    }
  }

  // Atualizar valor IBPT e informações complementares automaticamente
  const handleUpdateIbpt = (newVal: number) => {
    setValorIbpt(newVal)
    if (regimeTributario === '1') {
      setInformacoesComplementares(buildSimplesObs(newVal))
    }
  }

  // Buscar automaticamente CPF/CNPJ na API oficial do Mercado Livre
  const handleLookupFiscalFromML = async () => {
    if (!mlOrder?.order_id) return
    setLookingUpFiscal(true)
    try {
      const res = await mlOrdersService.lookupFiscalData(mlOrder.order_id)
      if (res.found && res.document) {
        const cleanDoc = res.document.replace(/\D/g, '')
        const isCnpj = cleanDoc.length === 14
        setDestinatario((prev) => ({
          ...prev,
          nome_completo: res.buyer_name || prev.nome_completo,
          cpf: !isCnpj ? cleanDoc : '',
          cnpj: isCnpj ? cleanDoc : '',
        }))
        toast({
          title: 'Dados fiscais encontrados!',
          description: `Documento: ${formatDocument(cleanDoc)}${res.buyer_name ? ` · ${res.buyer_name}` : ''}. Gravado no cadastro do cliente!`,
        })
      } else {
        toast({
          title: 'Não retornado pela API do ML',
          description:
            res.message ||
            'O ML não expôs o CPF para este pedido. Digite o CPF da etiqueta de envio.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      const isUnauthorized =
        err?.status === 401 ||
        err?.statusCode === 401 ||
        err?.response?.status === 401 ||
        err?.data?.status === 401 ||
        (typeof err?.message === 'string' && err.message.includes('401'))

      const description = isUnauthorized
        ? 'Sessão expirada — faça login novamente'
        : err?.data?.error || err.message || 'Falha na comunicação com o Mercado Livre.'

      toast({
        title: isUnauthorized ? 'Sessão expirada' : 'Erro ao consultar API do ML',
        description,
        variant: 'destructive',
      })
    } finally {
      setLookingUpFiscal(false)
    }
  }

  // Transmitir NF-e
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
    const docVal = validateFiscalDocument(doc)
    if (!docVal.valid) {
      toast({
        title: 'CPF ou CNPJ inválido',
        description:
          docVal.error || 'Verifique o número do documento e os dígitos verificadores (Módulo 11).',
        variant: 'destructive',
      })
      return
    }

    // Se a emissão for de pedido ML, salvar automaticamente os dados no pedido e no ml_customers
    if (originType === 'ml_order' && mlOrder) {
      try {
        await mlOrdersService.updateOrderFiscalData(mlOrder.id, {
          buyer_document: docVal.clean,
          buyer_name: destinatario.nome_completo,
          buyer_id: mlOrder.buyer_id,
          buyer_nickname: mlOrder.buyer_nickname,
        })
      } catch (saveErr) {
        console.error('Erro ao salvar documento em ml_customers:', saveErr)
      }
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
          description: `Nota nº ${res.numero} emitida com sucesso na Série ${config?.serie_nfe || '2'}.`,
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
      const isUnauthorized =
        err?.status === 401 ||
        err?.statusCode === 401 ||
        err?.response?.status === 401 ||
        err?.data?.status === 401 ||
        (typeof err?.message === 'string' && err.message.includes('401'))

      const msg = isUnauthorized
        ? 'Sessão expirada — faça login novamente'
        : err?.data?.error || err?.message || 'Falha na transmissão da nota fiscal'

      setResultStatus('erro_transmissao')
      setResultMessage(msg)
      toast({
        title: isUnauthorized ? 'Sessão expirada' : 'Erro de emissão',
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
      const isUnauthorized =
        err?.status === 401 ||
        err?.statusCode === 401 ||
        err?.response?.status === 401 ||
        err?.data?.status === 401 ||
        (typeof err?.message === 'string' && err.message.includes('401'))

      const msg = isUnauthorized
        ? 'Sessão expirada — faça login novamente'
        : err?.data?.error || err.message || 'Falha ao consultar status da nota fiscal.'

      toast({
        title: isUnauthorized ? 'Sessão expirada' : 'Erro ao consultar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setTransmitting(false)
    }
  }

  const isSimples = regimeTributario === '1'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  Emissão de Nota Fiscal Eletrônica (NF-e)
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {originType === 'ml_order'
                    ? `Venda Mercado Livre #${mlOrder?.order_id || ''}`
                    : originType === 'sale_internal'
                      ? `Venda Interna #${sale?.id || ''}`
                      : 'Emissão Avulsa'}
                  {' · '}Transmissão SEFAZ Série {config?.serie_nfe || '2'}
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
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-xs'
                      : 'bg-amber-50 text-amber-800 border-amber-300 text-xs'
                  }
                >
                  {config.environment === 'producao' ? 'Produção SEFAZ' : 'Homologação (Testes)'}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {loadingConfig ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm">Carregando dados fiscais e regras por categoria...</p>
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
                      <strong>Notas Fiscais → Configuração do Emissor</strong> e preencha o Token da
                      Focus NFe, dados do CNPJ e certificado A1 (.pfx).
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dica visual sobre a etiqueta ML caso o CPF esteja em branco */}
            {originType === 'ml_order' && !(destinatario.cpf || destinatario.cnpj) && (
              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-900">
                    CPF não veio preenchido pela API do Mercado Livre?
                  </p>
                  <p className="text-slate-700 text-[11px]">
                    Clique em <strong>Buscar no ML</strong> ao lado do campo CPF ou consulte a
                    etiqueta de envio no painel do Mercado Livre onde o CPF sempre vem impresso. Ao
                    preencher e transmitir, o CPF fica gravado permanentemente neste pedido e no CRM
                    (ml_customers).
                  </p>
                </div>
              </div>
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
                          <span className="font-mono font-semibold">
                            {numeroNfe} (Série {config?.serie_nfe || '2'})
                          </span>
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

            {/* Cabeçalho da Nota: Natureza, Regime Tributário e Empresa */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Natureza da Operação</Label>
                <Input
                  className="h-9 mt-1 text-xs"
                  value={naturezaOperacao}
                  onChange={(e) => setNaturezaOperacao(e.target.value)}
                  placeholder="Ex: Venda de Mercadorias"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Regime Tributário da Emissão</Label>
                <select
                  aria-label="Regime Tributário para emissão"
                  value={regimeTributario}
                  onChange={(e) => {
                    const newReg = e.target.value
                    setRegimeTributario(newReg)
                    if (newReg === '1') {
                      setInformacoesComplementares(buildSimplesObs(valorIbpt))
                    }
                  }}
                  className="w-full mt-1 h-9 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium"
                >
                  <option value="1">Simples Nacional (CSOSN)</option>
                  <option value="2">Lucro Presumido (CST ICMS/PIS/COFINS)</option>
                  <option value="3">Lucro Real (CST ICMS/PIS/COFINS)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">
                  Empresa Emissora (UF Origem: {config?.uf || 'MG'})
                </Label>
                <div className="h-9 mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs flex items-center justify-between text-slate-700">
                  <span className="truncate">
                    {config?.razao_social || config?.nome_fantasia || 'Empresa Emissora'}
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
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Destinatário / Comprador</h3>
                </div>

                <Badge variant="outline" className="text-[11px] font-mono">
                  {destinatario.uf === config?.uf ? (
                    <span className="text-emerald-700 font-semibold">
                      Operação Interna (Mesma UF: {destinatario.uf}) → CFOP Estadual
                    </span>
                  ) : (
                    <span className="text-blue-700 font-semibold">
                      Operação Interestadual ({config?.uf || 'MG'} → {destinatario.uf}) → CFOP Fora
                      UF
                    </span>
                  )}
                </Badge>
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
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">CPF ou CNPJ *</Label>
                    {originType === 'ml_order' && mlOrder?.order_id && (
                      <button
                        type="button"
                        onClick={handleLookupFiscalFromML}
                        disabled={lookingUpFiscal}
                        className="text-[11px] text-blue-700 hover:text-blue-900 font-medium flex items-center gap-1 hover:underline"
                        title="Buscar dados fiscais na API do ML"
                      >
                        {lookingUpFiscal ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Search className="w-3 h-3" />
                        )}
                        Buscar no ML
                      </button>
                    )}
                  </div>
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
                  {/* Validador de documento em tempo real */}
                  {destinatario.cpf || destinatario.cnpj ? (
                    <div className="mt-1">
                      {validateFiscalDocument(destinatario.cpf || destinatario.cnpj).valid ? (
                        <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Documento válido:{' '}
                          {validateFiscalDocument(destinatario.cpf || destinatario.cnpj).formatted}
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-600 font-medium flex items-center gap-1">
                          <XCircle className="w-3 h-3" />{' '}
                          {validateFiscalDocument(destinatario.cpf || destinatario.cnpj).error}
                        </span>
                      )}
                    </div>
                  ) : null}
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
                        placeholder="Belo Horizonte"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-emerald-800">UF Destino *</Label>
                      <Input
                        className="h-9 mt-1 text-xs uppercase text-center font-bold bg-emerald-50 border-emerald-300"
                        maxLength={2}
                        value={destinatario.uf || 'MG'}
                        onChange={(e) => handleDestUfChange(e.target.value)}
                        placeholder="MG"
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

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    Regra por categoria define CFOP por UF, CSOSN e Origem (+ sugestão de NCM/CEST)
                  </span>
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
              </div>

              <div className="space-y-3">
                {itens.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">Item #{idx + 1}</span>
                        {it.categoria && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-800 text-[10px]"
                          >
                            Regra: {it.categoria}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSaveAsRule(it)}
                          className="h-6 px-2 text-[10px] text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1"
                          title="Salvar valores deste item como regra permanente da categoria"
                        >
                          <BookmarkPlus className="w-3 h-3" />
                          Salvar como regra
                        </Button>

                        {itens.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(idx)}
                            className="h-6 w-6 p-0 text-rose-600 hover:bg-rose-50"
                            title="Remover item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <div className="md:col-span-4">
                        <Label className="text-[11px]">Descrição do Produto</Label>
                        <Input
                          className="h-8 text-xs bg-white"
                          value={it.descricao}
                          onChange={(e) => handleUpdateItem(idx, 'descricao', e.target.value)}
                          placeholder="Ex: Notebook Lenovo ThinkPad T580 16GB"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <Label className="text-[11px] text-emerald-800 font-semibold">
                          Categoria (Aplica Regra Fiscal)
                        </Label>
                        <div className="flex gap-1">
                          <select
                            aria-label="Selecionar categoria da regra fiscal"
                            value={it.categoria || ''}
                            onChange={(e) => handleItemCategoryChange(idx, e.target.value)}
                            className="h-8 px-2 rounded-md border border-emerald-200 bg-emerald-50/40 text-xs font-medium w-full"
                          >
                            <option value="">Sem categoria (Manual)</option>
                            {taxRules.map((rule) => (
                              <option key={rule.id} value={rule.categoria}>
                                {rule.categoria} (CFOP {rule.cfop_dentro}/{rule.cfop_fora})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="md:col-span-3">
                        <Label className="text-[11px]">
                          NCM{' '}
                          <span className="text-slate-400 font-normal">(Auto-completa CEST)</span>
                        </Label>
                        <NcmAutocomplete
                          value={it.ncm || ''}
                          currentCest={it.cest}
                          onChange={(val) => handleItemNcmChange(idx, val)}
                          onSelectCest={(cest) => handleApplyItemCest(idx, cest)}
                          className="h-8 text-xs bg-white"
                          placeholder="84733042"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label className="text-[11px]">
                          CEST <span className="text-slate-400 font-normal">(Editável)</span>
                        </Label>
                        <Input
                          className="h-8 text-xs font-mono bg-white"
                          value={it.cest || ''}
                          onChange={(e) => handleUpdateItem(idx, 'cest', e.target.value)}
                          placeholder="21.035.00"
                        />
                      </div>
                    </div>

                    {/* Linha Fiscal: CFOP, Tributação (CSOSN / CST) e Origem */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-1 border-t border-slate-200/60">
                      <div>
                        <Label className="text-[11px] font-semibold text-emerald-800">
                          CFOP (Auto p/ UF)
                        </Label>
                        <Input
                          className="h-8 text-xs font-mono font-bold bg-white border-emerald-300 text-emerald-900"
                          value={it.cfop}
                          onChange={(e) => handleUpdateItem(idx, 'cfop', e.target.value)}
                          placeholder="5405"
                        />
                      </div>

                      {isSimples ? (
                        <div>
                          <Label className="text-[11px] font-semibold">CSOSN (Simples)</Label>
                          <Input
                            className="h-8 text-xs font-mono bg-white"
                            value={it.csosn || '500'}
                            onChange={(e) => handleUpdateItem(idx, 'csosn', e.target.value)}
                            placeholder="500"
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            <Label className="text-[11px] font-semibold">CST ICMS</Label>
                            <Input
                              className="h-8 text-xs font-mono bg-white"
                              value={it.cst_icms || ''}
                              onChange={(e) => handleUpdateItem(idx, 'cst_icms', e.target.value)}
                              placeholder="60 ou 00"
                            />
                          </div>

                          <div>
                            <Label className="text-[11px]">CST PIS</Label>
                            <Input
                              className="h-8 text-xs font-mono bg-white"
                              value={it.pis_cst || '01'}
                              onChange={(e) => handleUpdateItem(idx, 'pis_cst', e.target.value)}
                              placeholder="01"
                            />
                          </div>

                          <div>
                            <Label className="text-[11px]">CST COFINS</Label>
                            <Input
                              className="h-8 text-xs font-mono bg-white"
                              value={it.cofins_cst || '01'}
                              onChange={(e) => handleUpdateItem(idx, 'cofins_cst', e.target.value)}
                              placeholder="01"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <Label className="text-[11px]">Origem</Label>
                        <select
                          aria-label="Origem da mercadoria"
                          value={it.origem ?? 0}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'origem', parseInt(e.target.value, 10))
                          }
                          className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs w-full"
                        >
                          <option value={0}>0 - Nacional</option>
                          <option value={1}>1 - Estrangeira direta</option>
                          <option value={2}>2 - Estrangeira int.</option>
                        </select>
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
                        <Label className="text-[11px]">Valor Unit. (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 text-xs text-right bg-white font-mono"
                          value={it.valor_unitario}
                          onChange={(e) => handleUpdateItem(idx, 'valor_unitario', e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px]">Subtotal (R$)</Label>
                        <div className="h-8 px-2 bg-slate-200/60 rounded flex items-center justify-end font-semibold text-slate-800 font-mono">
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
                      Valor Total da Nota (Série {config?.serie_nfe || '2'})
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

            {/* Informações Complementares & IBPT */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Informações Complementares de Interesse do Contribuinte (DANFE)
                </Label>

                {isSimples && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500">Valor IBPT (R$):</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-7 w-24 text-xs font-mono text-right"
                      value={valorIbpt}
                      onChange={(e) => handleUpdateIbpt(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}
              </div>

              <Textarea
                className="mt-1 text-xs"
                rows={2}
                value={informacoesComplementares}
                onChange={(e) => setInformacoesComplementares(e.target.value)}
                placeholder="Ex: Empresa optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI."
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
          >
            {transmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Transmitindo à SEFAZ...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Transmitir NF-e (Série {config?.serie_nfe || '2'})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Modal Secundário: "Salvar como regra da categoria" */}
      <Dialog open={saveRuleModalOpen} onOpenChange={setSaveRuleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <BookmarkPlus className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Salvar como Regra Fiscal</DialogTitle>
                <DialogDescription className="text-xs">
                  Crie ou atualize os parâmetros fiscais padrão desta categoria.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleConfirmSaveRule} className="space-y-3 pt-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Nome da Categoria *</Label>
              <Input
                className="h-8 mt-1 text-xs"
                value={ruleToSave.categoria}
                onChange={(e) => setRuleToSave((p) => ({ ...p, categoria: e.target.value }))}
                placeholder="Ex: Memória, Notebook, HD/SSD"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-emerald-800">CFOP Dentro UF *</Label>
                <Input
                  className="h-8 mt-1 text-xs font-mono"
                  value={ruleToSave.cfop_dentro}
                  onChange={(e) => setRuleToSave((p) => ({ ...p, cfop_dentro: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-blue-800">CFOP Fora UF *</Label>
                <Input
                  className="h-8 mt-1 text-xs font-mono"
                  value={ruleToSave.cfop_fora}
                  onChange={(e) => setRuleToSave((p) => ({ ...p, cfop_fora: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">CSOSN (Simples)</Label>
                <Input
                  className="h-8 mt-1 text-xs font-mono"
                  value={ruleToSave.csosn}
                  onChange={(e) => setRuleToSave((p) => ({ ...p, csosn: e.target.value }))}
                />
              </div>

              <div>
                <Label className="text-xs">CST (Regime Normal)</Label>
                <Input
                  className="h-8 mt-1 text-xs font-mono"
                  value={ruleToSave.cst}
                  onChange={(e) => setRuleToSave((p) => ({ ...p, cst: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">NCM Sugerido</Label>
                <NcmAutocomplete
                  value={ruleToSave.ncm_sugerido}
                  currentCest={ruleToSave.cest_sugerido}
                  onChange={(val) => {
                    setRuleToSave((p) => ({ ...p, ncm_sugerido: val }))
                    const clean = normalizeNcm(val)
                    if (clean.length === 8) {
                      ncmCestService.findByNcm(clean).then((entry) => {
                        if (entry?.cest) {
                          setRuleToSave((p) => ({
                            ...p,
                            cest_sugerido: p.cest_sugerido || entry.cest,
                          }))
                        }
                      })
                    }
                  }}
                  onSelectCest={(cest) => setRuleToSave((p) => ({ ...p, cest_sugerido: cest }))}
                  className="h-8 mt-1 text-xs"
                  placeholder="84733042"
                />
              </div>

              <div>
                <Label className="text-xs">CEST Sugerido</Label>
                <Input
                  className="h-8 mt-1 text-xs font-mono"
                  value={ruleToSave.cest_sugerido}
                  onChange={(e) => setRuleToSave((p) => ({ ...p, cest_sugerido: e.target.value }))}
                  placeholder="21.035.00"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSaveRuleModalOpen(false)}
                disabled={savingRule}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingRule}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {savingRule ? 'Salvando...' : 'Confirmar e Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
