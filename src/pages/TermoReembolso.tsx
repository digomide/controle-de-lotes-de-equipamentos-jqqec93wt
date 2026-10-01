import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Printer,
  ArrowLeft,
  Download,
  Pencil,
  Loader2,
  Save,
  RotateCcw,
  X,
  FileCheck2,
  Building,
  User,
  Users,
  Scale,
  Plus,
  Trash2,
  CheckCircle2,
  DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  reimbursementService,
  ReembolsoConfig,
  DEFAULT_REEMBOLSO_CONFIG,
  ParcelaQuitacaoData,
} from '@/services/reimbursementService'
import { downloadReembolsoPdf } from '@/utils/reimbursementPdfGenerator'
import { toast } from '@/hooks/use-toast'

export const TermoReembolso: React.FC = () => {
  const [config, setConfig] = useState<ReembolsoConfig>(() => reimbursementService.getConfig())
  const [isEditing, setIsEditing] = useState(false)
  const [editConfig, setEditConfig] = useState<ReembolsoConfig>(() =>
    reimbursementService.getConfig(),
  )
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [pdfProgressLabel, setPdfProgressLabel] = useState<string>('')

  // Sincroniza estado inicial e ouve eventos locais
  useEffect(() => {
    const loaded = reimbursementService.getConfig()
    setConfig(loaded)
    setEditConfig(loaded)

    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setConfig(e.detail)
        setEditConfig(e.detail)
      }
    }
    window.addEventListener('reembolso_config_updated', handleUpdate)
    return () => {
      window.removeEventListener('reembolso_config_updated', handleUpdate)
    }
  }, [])

  const handleStartEditing = () => {
    setEditConfig(config)
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    setEditConfig(config)
    setIsEditing(false)
  }

  const handleSaveEditing = () => {
    const saved = reimbursementService.saveConfig(editConfig)
    setConfig(saved)
    setIsEditing(false)
    toast({
      title: 'Termo de Reembolso salvo',
      description: 'Alterações gravadas no navegador (localStorage).',
    })
  }

  const handleResetToDefault = () => {
    if (
      !window.confirm(
        'Deseja restaurar todos os campos para o padrão original da minuta de reembolso?',
      )
    ) {
      return
    }
    const standard = reimbursementService.resetToDefault()
    setConfig(standard)
    setEditConfig(standard)
    setIsEditing(false)
    toast({
      title: 'Padrão restaurado',
      description: 'Texto original do instrumento foi redefinido.',
    })
  }

  const handlePrint = () => {
    if (isEditing) {
      handleSaveEditing()
    }
    window.focus()
    setTimeout(() => {
      window.print()
    }, 150)
  }

  const handleDownloadPdf = async () => {
    if (isEditing) {
      handleSaveEditing()
    }

    setIsDownloadingPdf(true)
    setPdfProgressLabel('Preparando PDF...')
    try {
      toast({
        title: 'Gerando PDF',
        description: 'Construindo arquivo Instrumento-Obrigacao-Reembolso.pdf...',
      })
      await downloadReembolsoPdf({
        elementId: 'termo-reembolso-doc',
        filename: 'Instrumento-Obrigacao-Reembolso.pdf',
        onProgress: (_prog, label) => setPdfProgressLabel(label),
      })
      toast({
        title: 'PDF baixado com sucesso!',
        description: 'O arquivo foi salvo na sua pasta de Downloads.',
      })
    } catch (err: any) {
      console.error('Erro ao gerar PDF via html2pdf:', err)
      toast({
        title: 'Download via impressão',
        description:
          'Seu navegador abrirá o diálogo de impressão: selecione "Salvar como PDF" no destino.',
      })
      setTimeout(() => {
        window.print()
      }, 300)
    } finally {
      setIsDownloadingPdf(false)
      setPdfProgressLabel('')
    }
  }

  const current = isEditing ? editConfig : config

  // Handlers para manipular parcelas flexíveis no modo de edição
  const handleAddParcela = () => {
    const parcelas = editConfig.operacao.parcelasQuitacao || []
    const nextNum = parcelas.length + 1
    const newParcela: ParcelaQuitacaoData = {
      id: `parc-${Date.now()}-${nextNum}`,
      numero: nextNum,
      descricao: `Parcela ${nextNum.toString().padStart(2, '0')}/${nextNum}`,
      valor: '7.000,00',
      vencimento: '',
      observacao: 'Parcela mensal',
    }
    setEditConfig({
      ...editConfig,
      operacao: {
        ...editConfig.operacao,
        saldoTotalParcelas: nextNum,
        parcelasQuitacao: [...parcelas, newParcela],
      },
    })
  }

  const handleRemoveParcela = (indexToRemove: number) => {
    const parcelas = (editConfig.operacao.parcelasQuitacao || []).filter(
      (_, i) => i !== indexToRemove,
    )
    // Renumera ordenadamente
    const reindexed = parcelas.map((p, idx) => ({
      ...p,
      numero: idx + 1,
      descricao: p.descricao?.startsWith('Parcela')
        ? `Parcela ${(idx + 1).toString().padStart(2, '0')}/${parcelas.length}`
        : p.descricao,
    }))
    setEditConfig({
      ...editConfig,
      operacao: {
        ...editConfig.operacao,
        saldoTotalParcelas: reindexed.length,
        parcelasQuitacao: reindexed,
      },
    })
  }

  const handleUpdateParcela = (
    index: number,
    field: keyof ParcelaQuitacaoData,
    value: string | number,
  ) => {
    const parcelas = [...(editConfig.operacao.parcelasQuitacao || [])]
    if (parcelas[index]) {
      parcelas[index] = {
        ...parcelas[index],
        [field]: value,
      }
      setEditConfig({
        ...editConfig,
        operacao: {
          ...editConfig.operacao,
          parcelasQuitacao: parcelas,
        },
      })
    }
  }

  // Utilitários para renderizar campos com destaque se vazios
  const renderField = (value: string, placeholder: string, label?: string) => {
    const trimmed = (value || '').trim()
    if (trimmed) {
      return (
        <span className="font-semibold text-slate-900 underline decoration-slate-300 decoration-1 underline-offset-2">
          {trimmed}
        </span>
      )
    }
    return (
      <span
        className="font-mono text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 text-[13px] print:text-black print:bg-transparent print:border-b print:border-black print:rounded-none"
        title={label ? `Campo pendente: ${label}` : 'Campo a preencher'}
      >
        [{placeholder}]
      </span>
    )
  }

  return (
    <div
      id="termo-reembolso-container"
      className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased p-0 md:p-6 print:p-0 print:m-0 print:bg-white"
    >
      {/* BARRA DE AÇÕES SUPERIOR (TOTALMENTE OCULTADA NA IMPRESSÃO) */}
      <div className="reembolso-no-print max-w-[210mm] mx-auto mb-4 px-4 sm:px-0 flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur p-3 rounded-xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Link to="/configuracoes">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
              <ArrowLeft className="w-4 h-4" />
              Configurações
            </Button>
          </Link>
          <Badge variant="outline" className="text-[11px] font-medium bg-slate-50 border-slate-300">
            Minuta Jurídica A4
          </Badge>
          {config.updatedAt && (
            <span className="hidden sm:inline text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Salvo no navegador
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEditing}
                className="gap-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEditing}
                className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar Instrumento
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEditing}
              className="gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-50 font-medium"
              title="Editar todos os campos entre colchetes da minuta"
            >
              <Pencil className="w-3.5 h-3.5 text-blue-600" />
              Editar Campos
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
            className="gap-1.5 text-xs text-slate-600 border-slate-300 hover:bg-slate-50"
            title="Restaurar texto e valores padrão originais"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Restaurar Padrão
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || isEditing}
            className="gap-1.5 text-xs text-emerald-800 border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100 font-semibold"
            title="Baixar arquivo PDF direto no navegador"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
            ) : (
              <Download className="w-3.5 h-3.5 text-emerald-700" />
            )}
            {isDownloadingPdf ? pdfProgressLabel || 'Baixando PDF...' : 'Baixar PDF'}
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm"
            title="Abrir diálogo de impressão limpo A4"
          >
            <Printer className="w-3.5 h-3.5 text-slate-200" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* FORMULÁRIO DE EDIÇÃO (EXIBIDO APENAS NO MODO EDIÇÃO, NÃO IMPRIME) */}
      {isEditing && (
        <div className="reembolso-no-print max-w-[210mm] mx-auto mb-6 p-5 bg-white rounded-xl border border-blue-200 shadow-md space-y-6 text-xs print:hidden">
          <div className="flex items-center justify-between border-b pb-3 border-blue-100">
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Editar Dados do Instrumento de Reembolso
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Preencha os campos conhecidos; os demais permanecem como placeholders no documento.
            </span>
          </div>

          {/* Grupo 1: Imóvel */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold border-b pb-1">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              <span>1. Objeto / Imóvel da Operação</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-[11px] text-slate-600">Apartamento nº</Label>
                <Input
                  value={editConfig.imovel.apartamentoNumero}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      imovel: { ...editConfig.imovel, apartamentoNumero: e.target.value },
                    })
                  }
                  placeholder="ex: 905"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-[11px] text-slate-600">Endereço Completo</Label>
                <Input
                  value={editConfig.imovel.enderecoCompleto}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      imovel: { ...editConfig.imovel, enderecoCompleto: e.target.value },
                    })
                  }
                  placeholder="ex: Avenida Francisco Sales, nº 40, Floresta, Belo Horizonte/MG"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[11px] text-slate-600">Matrícula nº</Label>
                <Input
                  value={editConfig.imovel.matriculaNumero}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      imovel: { ...editConfig.imovel, matriculaNumero: e.target.value },
                    })
                  }
                  placeholder="ex: 12345"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[11px] text-slate-600">
                  Cartório de Registro de Imóveis de
                </Label>
                <Input
                  value={editConfig.imovel.cartorioRegistro}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      imovel: { ...editConfig.imovel, cartorioRegistro: e.target.value },
                    })
                  }
                  placeholder="ex: Belo Horizonte / 2º Ofício"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* Grupo 2: Comprador */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold border-b pb-1">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>2. Qualificação do Comprador</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-[11px] text-slate-600">Nome Completo</Label>
                <Input
                  value={editConfig.comprador.nomeCompleto}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      comprador: { ...editConfig.comprador, nomeCompleto: e.target.value },
                    })
                  }
                  placeholder="Nome completo do comprador"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Nacionalidade</Label>
                <Input
                  value={editConfig.comprador.nacionalidade}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      comprador: { ...editConfig.comprador, nacionalidade: e.target.value },
                    })
                  }
                  placeholder="ex: brasileiro(a)"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Estado Civil</Label>
                <Input
                  value={editConfig.comprador.estadoCivil}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      comprador: { ...editConfig.comprador, estadoCivil: e.target.value },
                    })
                  }
                  placeholder="ex: casado(a), solteiro(a)"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Profissão</Label>
                <Input
                  value={editConfig.comprador.profissao}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      comprador: { ...editConfig.comprador, profissao: e.target.value },
                    })
                  }
                  placeholder="ex: empresário"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">RG nº</Label>
                <Input
                  value={editConfig.comprador.rgNumero}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      comprador: { ...editConfig.comprador, rgNumero: e.target.value },
                    })
                  }
                  placeholder="RG do comprador"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">CPF nº</Label>
                <Input
                  value={editConfig.comprador.cpfNumero}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      comprador: { ...editConfig.comprador, cpfNumero: e.target.value },
                    })
                  }
                  placeholder="CPF do comprador"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Endereço Residencial</Label>
                <Input
                  value={editConfig.comprador.endereco}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      comprador: { ...editConfig.comprador, endereco: e.target.value },
                    })
                  }
                  placeholder="Rua, número, bairro, cidade/UF"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* Grupo 3: Proprietária e Interdição */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold border-b pb-1">
              <Scale className="w-3.5 h-3.5 text-slate-500" />
              <span>3. Dados da Proprietária e Interdição Judicial</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-[11px] text-slate-600">Sobrenome da Proprietária</Label>
                <Input
                  value={editConfig.proprietaria.sobrenome}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      proprietaria: { ...editConfig.proprietaria, sobrenome: e.target.value },
                    })
                  }
                  placeholder="ex: Silva (Anna Salomé [sobrenome])"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">CPF nº da Proprietária</Label>
                <Input
                  value={editConfig.proprietaria.cpfNumero}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      proprietaria: { ...editConfig.proprietaria, cpfNumero: e.target.value },
                    })
                  }
                  placeholder="CPF nº"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Autos do Processo nº</Label>
                <Input
                  value={editConfig.proprietaria.processoNumero}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      proprietaria: { ...editConfig.proprietaria, processoNumero: e.target.value },
                      operacao: { ...editConfig.operacao, processoAutosNumero: e.target.value },
                    })
                  }
                  placeholder="Número do processo de interdição"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Vara da Comarca</Label>
                <div className="flex gap-1 mt-1">
                  <Input
                    value={editConfig.proprietaria.varaNumero}
                    onChange={(e) =>
                      setEditConfig({
                        ...editConfig,
                        proprietaria: { ...editConfig.proprietaria, varaNumero: e.target.value },
                      })
                    }
                    placeholder="Vara (ex: 1ª Vara de Família)"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={editConfig.proprietaria.comarca}
                    onChange={(e) =>
                      setEditConfig({
                        ...editConfig,
                        proprietaria: { ...editConfig.proprietaria, comarca: e.target.value },
                      })
                    }
                    placeholder="Comarca de"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="sm:col-span-4">
                <Label className="text-[11px] text-slate-600">
                  Curador(a): Nome Completo e Qualificação
                </Label>
                <Input
                  value={editConfig.proprietaria.curadorNomeQualificacao}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      proprietaria: {
                        ...editConfig.proprietaria,
                        curadorNomeQualificacao: e.target.value,
                      },
                    })
                  }
                  placeholder="ex: João da Silva, brasileiro, casado, administrador, RG nº ..., CPF nº ..., residente em ..."
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* Grupo 4: Garantidores Solidários */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold border-b pb-1">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>4. Garantidores Solidários (Herdeiros e Familiares)</span>
            </div>
            <div className="space-y-2">
              {editConfig.garantidores.map((g, idx) => (
                <div
                  key={g.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded bg-slate-50 border border-slate-200"
                >
                  <div className="sm:col-span-2 font-bold text-slate-800">{g.nomePrimeiro}</div>
                  <div className="sm:col-span-3">
                    <Input
                      value={g.sobrenome}
                      onChange={(e) => {
                        const updated = [...editConfig.garantidores]
                        updated[idx] = { ...updated[idx], sobrenome: e.target.value }
                        setEditConfig({ ...editConfig, garantidores: updated })
                      }}
                      placeholder={`Sobrenome de ${g.nomePrimeiro}`}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="sm:col-span-7">
                    <Input
                      value={g.qualificacao}
                      onChange={(e) => {
                        const updated = [...editConfig.garantidores]
                        updated[idx] = { ...updated[idx], qualificacao: e.target.value }
                        setEditConfig({ ...editConfig, garantidores: updated })
                      }}
                      placeholder="Qualificação completa (nacionalidade, civil, profissão, RG, CPF, residência)"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grupo 5: Valores e Cláusulas Operacionais */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold border-b pb-1">
              <FileCheck2 className="w-3.5 h-3.5 text-slate-500" />
              <span>5. Valores, Condições e Cláusulas da Operação</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-slate-600">Preço Total (R$)</Label>
                <Input
                  value={editConfig.operacao.valorTotal}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, valorTotal: e.target.value },
                    })
                  }
                  placeholder="ex: 245.000,00"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[11px] text-slate-600">Valor Total por Extenso</Label>
                <Input
                  value={editConfig.operacao.valorExtenso}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, valorExtenso: e.target.value },
                    })
                  }
                  placeholder="ex: duzentos e quarenta e cinco mil reais"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Valor da ENTRADA (R$)</Label>
                <Input
                  value={editConfig.operacao.valorEntrada}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, valorEntrada: e.target.value },
                    })
                  }
                  placeholder="ex: 45.000,00"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Prazo Limite da Entrada</Label>
                <Input
                  value={editConfig.operacao.prazoLimiteEntrada}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, prazoLimiteEntrada: e.target.value },
                    })
                  }
                  placeholder="ex: dezembro de 2025"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Saldo Restante (R$)</Label>
                <Input
                  value={editConfig.operacao.saldoRestante}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, saldoRestante: e.target.value },
                    })
                  }
                  placeholder="ex: 200.000,00"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-[11px] text-slate-600">
                  Ajuste da Entrada [se os "45" forem percentual ou observação adicional]
                </Label>
                <Input
                  value={editConfig.operacao.entradaObservacao}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, entradaObservacao: e.target.value },
                    })
                  }
                  placeholder="Deixe em branco para o padrão ou personalize ex: (correspondente a 18,36% da operação)"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-[11px] text-slate-600">
                  Condições de Pagamento e Descrição Geral do Saldo
                </Label>
                <Input
                  value={editConfig.operacao.detalhesCondicoesPagamento}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: {
                        ...editConfig.operacao,
                        detalhesCondicoesPagamento: e.target.value,
                      },
                    })
                  }
                  placeholder="Descrição do parcelamento de quitação"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-[11px] text-slate-600">
                  Especificação dos Valores Pendentes (Cláusula 1.2)
                </Label>
                <Input
                  value={editConfig.operacao.valoresPendentesEspecificacao}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: {
                        ...editConfig.operacao,
                        valoresPendentesEspecificacao: e.target.value,
                      },
                    })
                  }
                  placeholder="dívidas de IPTU, condomínio, dívida sub-rogada etc."
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Índice de Correção Monetária</Label>
                <Input
                  value={editConfig.operacao.correcaoIndice}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, correcaoIndice: e.target.value },
                    })
                  }
                  placeholder="IPCA/IBGE"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Prazo de Reembolso (dias)</Label>
                <Input
                  value={editConfig.operacao.prazoReembolsoDias}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, prazoReembolsoDias: e.target.value },
                    })
                  }
                  placeholder="15 ou 30"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Forma de Pagamento</Label>
                <Input
                  value={editConfig.operacao.formaPagamento}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, formaPagamento: e.target.value },
                    })
                  }
                  placeholder="dinheiro/PIX/transferência bancária"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            {/* Sub-bloco Tabela de Parcelas de Quitação */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tabela de Parcelas de Quitação do Bem Imóvel</span>
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {editConfig.operacao.parcelasQuitacao?.length || 0} parcelas
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Valores e vencimentos das parcelas sucessivas pós-entrada (conforme proposta: 28
                    × R$ 7.000,00 + 1 × R$ 6.000,00). Você pode editar, adicionar ou remover
                    parcelas livremente.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddParcela}
                  className="gap-1 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-7"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Parcela
                </Button>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 border border-slate-200 rounded p-2 bg-white">
                {(editConfig.operacao.parcelasQuitacao || []).map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="sm:col-span-1 font-bold text-slate-700 text-center">
                      #{idx + 1}
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        value={p.descricao || ''}
                        onChange={(e) => handleUpdateParcela(idx, 'descricao', e.target.value)}
                        placeholder={`Parcela ${(idx + 1).toString().padStart(2, '0')}`}
                        className="h-7 text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1 text-[11px] text-slate-400">R$</span>
                        <Input
                          value={p.valor || ''}
                          onChange={(e) => handleUpdateParcela(idx, 'valor', e.target.value)}
                          placeholder="7.000,00"
                          className="h-7 text-xs pl-7 bg-white font-mono"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        value={p.vencimento || ''}
                        onChange={(e) => handleUpdateParcela(idx, 'vencimento', e.target.value)}
                        placeholder="Vencimento (ex: 10/01/2026)"
                        className="h-7 text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        value={p.observacao || ''}
                        onChange={(e) => handleUpdateParcela(idx, 'observacao', e.target.value)}
                        placeholder="Observação"
                        className="h-7 text-xs bg-white text-[11px]"
                      />
                    </div>
                    <div className="sm:col-span-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveParcela(idx)}
                        className="h-7 w-7 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                        title="Remover parcela"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sub-bloco Cláusula 3.2 Opcional (Juros e Multa) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 text-xs">
                    Cláusula 3.2 [Opcional] — Multa e Juros por Atraso
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Se ativada, prevê juros de mora e multa caso o reembolso não ocorra no prazo.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600">
                    {editConfig.operacao.multaJurosAtivo ? 'Ativa' : 'Desativada'}
                  </span>
                  <Switch
                    checked={editConfig.operacao.multaJurosAtivo}
                    onCheckedChange={(checked) =>
                      setEditConfig({
                        ...editConfig,
                        operacao: { ...editConfig.operacao, multaJurosAtivo: checked },
                      })
                    }
                  />
                </div>
              </div>

              {editConfig.operacao.multaJurosAtivo && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <Label className="text-[10px] text-slate-600">Prazo de carência (dias)</Label>
                    <Input
                      value={editConfig.operacao.multaJurosPrazoDias}
                      onChange={(e) =>
                        setEditConfig({
                          ...editConfig,
                          operacao: {
                            ...editConfig.operacao,
                            multaJurosPrazoDias: e.target.value,
                          },
                        })
                      }
                      placeholder="15 ou 30"
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-600">Taxa de Juros</Label>
                    <Input
                      value={editConfig.operacao.multaJurosTaxaJuros}
                      onChange={(e) =>
                        setEditConfig({
                          ...editConfig,
                          operacao: {
                            ...editConfig.operacao,
                            multaJurosTaxaJuros: e.target.value,
                          },
                        })
                      }
                      placeholder="1% ao mês"
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-600">Taxa de Multa</Label>
                    <Input
                      value={editConfig.operacao.multaJurosTaxaMulta}
                      onChange={(e) =>
                        setEditConfig({
                          ...editConfig,
                          operacao: {
                            ...editConfig.operacao,
                            multaJurosTaxaMulta: e.target.value,
                          },
                        })
                      }
                      placeholder="2% sobre o total devido"
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Foro, Local e Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <Label className="text-[11px] text-slate-600">
                  Foro da Comarca de (Cláusula 6ª)
                </Label>
                <Input
                  value={editConfig.operacao.comarcaForo}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, comarcaForo: e.target.value },
                    })
                  }
                  placeholder="ex: Belo Horizonte/MG"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">Local e Data de Assinatura</Label>
                <Input
                  value={editConfig.operacao.localData}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      operacao: { ...editConfig.operacao, localData: e.target.value },
                    })
                  }
                  placeholder="ex: Belo Horizonte/MG, 25 de fevereiro de 2026"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={handleCancelEditing} className="text-xs">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEditing}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Salvar Alterações
            </Button>
          </div>
        </div>
      )}

      {/* DOCUMENTO JURÍDICO A4 FORMAL (TEXTO INTEGRAL E EXATO DO USUÁRIO) */}
      <div
        id="termo-reembolso-doc"
        className="max-w-[210mm] mx-auto bg-white p-8 sm:p-14 shadow-lg rounded-sm text-slate-900 border border-slate-200/80 leading-relaxed font-serif text-[14px] text-justify print:shadow-none print:border-none print:p-0 print:max-w-none print:rounded-none"
      >
        {/* TÍTULO CENTRALIZADO */}
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 uppercase border-b-2 border-slate-900 pb-2 inline-block">
            INSTRUMENTO DE OBRIGAÇÃO DE REEMBOLSO COM GARANTIA SOLIDÁRIA
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-700 font-sans italic mt-2 px-4 leading-normal">
            (Referente à proposta de compra e venda do apartamento nº{' '}
            {renderField(current.imovel.apartamentoNumero, '___', 'Apartamento nº')}, situado em{' '}
            {renderField(current.imovel.enderecoCompleto, 'endereço completo', 'Endereço Completo')}
            , matrícula nº {renderField(current.imovel.matriculaNumero, '___', 'Matrícula nº')} do
            Cartório de Registro de Imóveis de{' '}
            {renderField(current.imovel.cartorioRegistro, '___', 'Cartório de Registro de Imóveis')}
            )
          </p>
        </div>

        {/* PARTES */}
        <div className="mb-6 space-y-3">
          <h2 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            PARTES
          </h2>

          <p className="indent-8 leading-relaxed">
            <strong className="font-bold text-slate-950">COMPRADOR:</strong>{' '}
            {renderField(
              current.comprador.nomeCompleto,
              'nome completo',
              'Nome Completo do Comprador',
            )}
            , {renderField(current.comprador.nacionalidade, 'nacionalidade', 'Nacionalidade')},{' '}
            {renderField(current.comprador.estadoCivil, 'estado civil', 'Estado Civil')},{' '}
            {renderField(current.comprador.profissao, 'profissão', 'Profissão')}, RG nº{' '}
            {renderField(current.comprador.rgNumero, '___', 'RG do Comprador')}, CPF nº{' '}
            {renderField(current.comprador.cpfNumero, '___', 'CPF do Comprador')}, residente em{' '}
            {renderField(current.comprador.endereco, 'endereço', 'Endereço do Comprador')}.
          </p>

          <p className="indent-8 leading-relaxed">
            <strong className="font-bold text-slate-950">PROPRIETÁRIA:</strong> ANNA SALOMÉ{' '}
            {renderField(current.proprietaria.sobrenome, 'sobrenome', 'Sobrenome da Proprietária')},
            brasileira, 98 anos, CPF nº{' '}
            {renderField(current.proprietaria.cpfNumero, '___', 'CPF da Proprietária')}, atualmente
            interditada nos autos do processo nº{' '}
            {renderField(current.proprietaria.processoNumero, '___', 'Processo de Interdição nº')},
            em trâmite na {renderField(current.proprietaria.varaNumero, '___', 'Vara')} Vara da
            Comarca de {renderField(current.proprietaria.comarca, '___', 'Comarca')}, nestes atos
            representada por sua curadora/curador,{' '}
            {renderField(
              current.proprietaria.curadorNomeQualificacao,
              'nome completo e qualificação do curador',
              'Nome e Qualificação do Curador',
            )}
            .
          </p>

          <p className="indent-8 leading-relaxed">
            <strong className="font-bold text-slate-950">
              GARANTIDORES SOLIDÁRIOS (herdeiros e familiares da Proprietária):
            </strong>{' '}
            {current.garantidores.map((g, idx) => (
              <span key={g.id}>
                {g.nomePrimeiro}{' '}
                {renderField(g.sobrenome, 'sobrenome', `Sobrenome de ${g.nomePrimeiro}`)},{' '}
                {renderField(g.qualificacao, 'qualificação', `Qualificação de ${g.nomePrimeiro}`)}
                {idx < current.garantidores.length - 1 ? '; ' : '.'}
              </span>
            ))}
          </p>
        </div>

        {/* CLÁUSULA 1ª */}
        <div className="reembolso-clausula-block mb-5 space-y-2">
          <h3 className="font-bold text-slate-950">CLÁUSULA 1ª — DA PROPOSTA E DA OPERAÇÃO</h3>
          <p className="indent-8 leading-relaxed">
            <strong>1.1.</strong> O COMPRADOR apresentou proposta de compra do imóvel descrito no
            preâmbulo, aceita pela PROPRIETÁRIA e pelos GARANTIDORES, pelo preço total de R${' '}
            {renderField(current.operacao.valorTotal, '___', 'Preço Total')} (
            {renderField(current.operacao.valorExtenso, 'valor por extenso', 'Valor por Extenso')}),
            com ENTRADA de R$ {current.operacao.valorEntrada || '45.000,00'} (quarenta e cinco mil
            reais), a ser paga até{' '}
            {renderField(
              current.operacao.prazoLimiteEntrada || 'dezembro de 2025',
              'dezembro de 2025',
              'Prazo Limite da Entrada',
            )}{' '}
            {current.operacao.entradaObservacao ? (
              <span className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2">
                [{current.operacao.entradaObservacao}]
              </span>
            ) : null}
            , na forma da proposta aceita.
          </p>
          <p className="indent-8 leading-relaxed">
            <strong>1.2.</strong> Conforme a proposta, os valores pendentes existentes sobre o
            imóvel [
            {renderField(
              current.operacao.valoresPendentesEspecificacao,
              'especificar: dívidas de IPTU, condomínio, dívida sub-rogada etc.',
              'Especificação dos Valores Pendentes',
            )}
            ] serão solvidos pela PROPRIETÁRIA/GARANTIDORES, na forma que entre si ajustarem, não
            cabendo ao COMPRADOR qualquer ônus sobre eles.
          </p>
        </div>

        {/* NOVA CLÁUSULA: DA ADESÃO IRREVOGÁVEL E CONSENTIMENTO À VENDA EM QUAISQUER OCASIÕES POSTERIORES */}
        <div className="reembolso-clausula-block mb-5 space-y-2 bg-slate-50/50 p-3 rounded border border-slate-200/60 print:bg-transparent print:border-none print:p-0">
          <h3 className="font-bold text-slate-950">
            CLÁUSULA 2ª — DA ADESÃO IRREVOGÁVEL E DO CONSENTIMENTO EXPRESSO À VENDA EM QUAISQUER
            OCASIÕES POSTERIORES
          </h3>
          <p className="indent-8 leading-relaxed">
            <strong>2.1.</strong> A PROPRIETÁRIA (neste ato representada por sua curadora/curador),
            TODOS os GARANTIDORES SOLIDÁRIOS e demais herdeiros e sucessores manifestam
            expressamente seu consentimento{' '}
            <strong>LIVRE, ESPONTÂNEO, IRREVOGÁVEL E IRRENUNCIÁVEL</strong> com a venda integral do
            apartamento residencial objeto deste instrumento ao COMPRADOR, nos exatos termos,
            valores e condições da proposta aceita.
          </p>
          <p className="indent-8 leading-relaxed">
            <strong>2.2.</strong> As partes, herdeiros e GARANTIDORES SOLIDÁRIOS convencionam de
            forma inequívoca que o consentimento aqui prestado{' '}
            <strong>
              permanece plenamente válido, eficaz e vinculante em quaisquer ocasiões posteriores
            </strong>
            , aplicando-se integralmente a:
          </p>
          <p className="indent-12 leading-relaxed">
            <strong>a) No âmbito do Processo de Interdição e Expedição de Alvará:</strong>{' '}
            obrigam-se a PROPRIETÁRIA, por sua curadora/curador, e todos os GARANTIDORES a instruir,
            requerer, emendar e peticionar perante o Juízo competente tudo o que for juridicamente
            hábil e indispensável para a homologação da venda e a expedição do alvará judicial,
            corroborando perante o Ministério Público e o Magistrado a conveniência e a manifesta
            vantagem patrimonial do negócio em favor da PROPRIETÁRIA;
          </p>
          <p className="indent-12 leading-relaxed">
            <strong>b) No âmbito de Eventual Sucessão e Inventário da PROPRIETÁRIA:</strong> na
            hipótese de falecimento da PROPRIETÁRIA antes ou no curso da escrituração definitiva, o
            consentimento dado neste ato subsiste íntegro e vincula plena e diretamente todos os
            GARANTIDORES e demais herdeiros, os quais{' '}
            <strong>renunciam de forma expressa e irretratável</strong> a qualquer impugnação da
            venda, dos valores e condições nela pactuados, bem como dos pagamentos já efetuados pelo
            COMPRADOR de boa-fé, comprometendo-se a adjudicar, colacionar e formalizar a outorga da
            escritura pública de compra e venda nos autos do inventário sem qualquer oposição;
          </p>
          <p className="indent-12 leading-relaxed">
            <strong>c) Em Disputas Futuras entre Herdeiros ou Perante Terceiros:</strong> obriga-se
            cada um dos GARANTIDORES, por si e por seus herdeiros e sucessores a qualquer título, a
            não apresentar qualquer objeção, embargo, ação judicial, protesto ou reclamação contra a
            venda ou contra o COMPRADOR de boa-fé, defendendo a higidez do negócio jurídico pactuado
            perante quaisquer terceiros, credores ou herdeiros supervenientes.
          </p>
          <p className="indent-8 leading-relaxed">
            <strong>2.3.</strong> Os GARANTIDORES declaram sob as penas da lei que o consentimento e
            a adesão aqui firmados são definitivos, operando efeitos imediatos e sucessórios
            perpétuos, constituindo obrigação de fazer e de não fazer líquida, certa e exigível.
          </p>
        </div>

        {/* NOVA CLÁUSULA: DA FORMA DE PAGAMENTO E DAS PARCELAS DE QUITAÇÃO DO BEM IMÓVEL */}
        <div className="reembolso-clausula-block mb-5 space-y-3">
          <h3 className="font-bold text-slate-950">
            CLÁUSULA 3ª — DA FORMA DE PAGAMENTO E DAS PARCELAS DE QUITAÇÃO DO BEM IMÓVEL
          </h3>
          <p className="indent-8 leading-relaxed">
            <strong>3.1.</strong> O preço global acordado para a aquisição do imóvel será quitado
            pelo COMPRADOR em estrita observância ao cronograma financeiro da proposta aprovada,
            composto pela ENTRADA e pelo saldo parcelado, conforme a seguinte discriminação:
          </p>
          <p className="indent-12 leading-relaxed">
            <strong>a) ENTRADA:</strong> R$ {current.operacao.valorEntrada || '45.000,00'} (quarenta
            e cinco mil reais), a ser quitada até{' '}
            <strong>
              {renderField(
                current.operacao.prazoLimiteEntrada || 'dezembro de 2025',
                'dezembro de 2025',
                'Prazo Limite da Entrada',
              )}
            </strong>
            , diretamente às credoras pelo adquirente mediante recibo circunstanciado e petição de
            quitação judicial da dívida homologada, valor este que integra e é integralmente abatido
            do montante total de aquisição;
          </p>
          <p className="indent-12 leading-relaxed">
            <strong>b) SALDO REMANESCENTE E PARCELAMENTO:</strong> R${' '}
            {renderField(
              current.operacao.saldoRestante || '200.000,00',
              '200.000,00',
              'Saldo Remanescente',
            )}{' '}
            ( duzentos mil reais), quitado diretamente à PROPRIETÁRIA/família através de{' '}
            <strong>
              {current.operacao.parcelasQuitacao?.length ||
                current.operacao.saldoTotalParcelas ||
                29}{' '}
              parcelas mensais e sucessivas
            </strong>
            , com primeiro vencimento no mês subsequente à formalização da autorização, nos exatos
            termos detalhados na tabela oficial de quitação a seguir discriminada:
          </p>

          {/* TABELA DE PARCELAS DE QUITAÇÃO DO BEM IMÓVEL */}
          <div className="my-4 overflow-x-auto">
            <table className="w-full text-left text-xs font-sans border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2 border-r border-slate-300 w-12 text-center">Nº</th>
                  <th className="p-2 border-r border-slate-300">Descrição da Parcela</th>
                  <th className="p-2 border-r border-slate-300 w-28 text-right">Valor (R$)</th>
                  <th className="p-2 border-r border-slate-300 w-36 text-center">Vencimento</th>
                  <th className="p-2">Condição / Observação</th>
                </tr>
              </thead>
              <tbody>
                {/* Linha da Entrada em destaque */}
                <tr className="bg-emerald-50/60 font-semibold border-b border-slate-200 reembolso-table-row">
                  <td className="p-2 border-r border-slate-200 text-center text-emerald-800">00</td>
                  <td className="p-2 border-r border-slate-200 text-emerald-950">
                    Entrada / Liquidação de Dívida Judicial
                  </td>
                  <td className="p-2 border-r border-slate-200 text-right font-mono text-emerald-900 font-bold">
                    R$ {current.operacao.valorEntrada || '45.000,00'}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center font-mono">
                    {renderField(
                      current.operacao.prazoLimiteEntrada || 'dezembro de 2025',
                      'dezembro de 2025',
                      'Prazo Entrada',
                    )}
                  </td>
                  <td className="p-2 text-slate-700 text-[11px]">
                    Até dez/2025 c/ recibo de quitação judicial abatido da compra
                  </td>
                </tr>

                {/* Linhas das parcelas sucessivas de saldo */}
                {(current.operacao.parcelasQuitacao || []).map((parc, pIdx) => (
                  <tr
                    key={parc.id || pIdx}
                    className={`border-b border-slate-200 reembolso-table-row ${
                      pIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-600">
                      {String(parc.numero || pIdx + 1).padStart(2, '0')}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-medium text-slate-900">
                      {parc.descricao ||
                        `Parcela ${String(pIdx + 1).padStart(2, '0')}/${current.operacao.parcelasQuitacao.length}`}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono text-slate-900 font-semibold">
                      R$ {parc.valor || '7.000,00'}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-700">
                      {renderField(
                        parc.vencimento,
                        `Mês ${String(pIdx + 1).padStart(2, '0')}`,
                        `Vencimento Parcela ${pIdx + 1}`,
                      )}
                    </td>
                    <td className="p-2 text-slate-600 text-[11px]">
                      {parc.observacao ||
                        (pIdx === (current.operacao.parcelasQuitacao?.length || 29) - 1
                          ? 'Parcela de quitação final integral'
                          : 'Parcela mensal sucessiva pós-autorização')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-950">
                  <td colSpan={2} className="p-2 border-r border-slate-300 text-right">
                    TOTAL DA OPERAÇÃO DE QUITAÇÃO:
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono text-emerald-800 text-[13px]">
                    R${' '}
                    {renderField(
                      current.operacao.valorTotal || '245.000,00',
                      '245.000,00',
                      'Total Quitação',
                    )}
                  </td>
                  <td colSpan={2} className="p-2 text-slate-600 text-[11px] italic">
                    Entrada de R$ 45.000,00 + {current.operacao.parcelasQuitacao?.length || 29}{' '}
                    parcelas (quitação integral do bem imóvel)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="indent-8 leading-relaxed">
            <strong>3.2.</strong> O adimplemento das parcelas nos moldes e valores acima
            estabelecidos confere ao COMPRADOR a mais ampla, geral e irrestrita quitação com relação
            ao saldo do imóvel, exonerando-o de qualquer outra cobrança ou pleito patrimonial por
            parte da PROPRIETÁRIA, seus herdeiros ou sucessores.
          </p>
        </div>

        {/* CLÁUSULA 4ª (Antiga Cláusula 2ª renumerada): DA AUTORIZAÇÃO JUDICIAL */}
        <div className="reembolso-clausula-block mb-5 space-y-2">
          <h3 className="font-bold text-slate-950">CLÁUSULA 4ª — DA AUTORIZAÇÃO JUDICIAL</h3>
          <p className="indent-8 leading-relaxed">
            <strong>4.1.</strong> As partes reconhecem que a PROPRIETÁRIA é interditada e que a
            venda do imóvel depende de autorização do Juízo encarregado da interdição (autos nº{' '}
            {renderField(
              current.operacao.processoAutosNumero || current.proprietaria.processoNumero,
              '___',
              'Autos do Processo nº',
            )}
            ), nos termos dos arts. 1.748 e 1.774 do Código Civil, somente se consumando mediante
            alvará/autorização judicial.
          </p>
        </div>

        {/* CLÁUSULA 5ª (Antiga Cláusula 3ª renumerada): DA OBRIGAÇÃO DE REEMBOLSO */}
        <div className="reembolso-clausula-block mb-5 space-y-2">
          <h3 className="font-bold text-slate-950">
            CLÁUSULA 5ª — DA OBRIGAÇÃO DE REEMBOLSO (EVENTO RESOLUTIVO)
          </h3>
          <p className="indent-8 leading-relaxed">
            <strong>5.1.</strong> Caso a venda NÃO seja autorizada pelo Juízo encarregado da
            interdição — decisão definitiva, transitada em julgado ou da qual não caiba mais recurso
            — ou, autorizada, não se consume por fato não imputável ao COMPRADOR, a PROPRIETÁRIA e
            os GARANTIDORES obrigam-se a reembolsar ao COMPRADOR, integralmente e de forma
            SOLIDÁRIA:
          </p>
          <p className="indent-12 leading-relaxed">
            a) a ENTRADA de R$ {current.operacao.valorEntrada || '45.000,00'} paga ou por pagar (a
            ser quitada até {current.operacao.prazoLimiteEntrada || 'dezembro de 2025'});
          </p>
          <p className="indent-12 leading-relaxed">
            b) todas as despesas comprovadamente realizadas pelo COMPRADOR em razão da operação —
            incluindo, sem limitação, quaisquer parcelas já pagas do preço, custas e emolumentos,
            honorários advocatícios, laudos, vistorias, deslocamentos e taxas — mediante simples
            apresentação de comprovantes;
          </p>
          <p className="indent-12 leading-relaxed">
            c) tudo com CORREÇÃO MONETÁRIA pelo índice [
            {renderField(current.operacao.correcaoIndice, 'IPCA/IBGE', 'Índice de Correção')}], a
            contar da data de cada desembolso até a efetiva restituição.
          </p>

          {current.operacao.multaJurosAtivo && (
            <p className="indent-8 leading-relaxed">
              <strong>5.2.</strong> [Opcional] Não ocorrendo o reembolso em até [
              {renderField(current.operacao.multaJurosPrazoDias, '15/30', 'Prazo em dias')}] dias do
              evento resolutivo, acrescer-se-ão juros de{' '}
              {current.operacao.multaJurosTaxaJuros || '1% ao mês'} e multa de{' '}
              {current.operacao.multaJurosTaxaMulta || '2% sobre o total devido'}.
            </p>
          )}

          <p className="indent-8 leading-relaxed">
            <strong>5.3.</strong> O reembolso será pago em{' '}
            {current.operacao.formaPagamento || 'dinheiro/PIX/transferência bancária'} no prazo de [
            {renderField(current.operacao.prazoReembolsoDias, '15/30', 'Prazo em dias')}] dias
            contados do evento resolutivo.
          </p>
        </div>

        {/* CLÁUSULA 6ª (Antiga Cláusula 4ª renumerada): DA SOLIDARIEDADE */}
        <div className="reembolso-clausula-block mb-5 space-y-2">
          <h3 className="font-bold text-slate-950">CLÁUSULA 6ª — DA SOLIDARIEDADE</h3>
          <p className="indent-8 leading-relaxed">
            <strong>6.1.</strong> Os GARANTIDORES respondem solidariamente entre si e com a
            PROPRIETÁRIA pelo cumprimento de todas as obrigações deste instrumento, de consentimento
            à venda e de reembolso em caso de não concretização do negócio, renunciando
            expressamente ao benefício de ordem (art. 828 do Código Civil).
          </p>
        </div>

        {/* CLÁUSULA 7ª (Antiga Cláusula 5ª renumerada): DA INDEPENDÊNCIA */}
        <div className="reembolso-clausula-block mb-5 space-y-2">
          <h3 className="font-bold text-slate-950">CLÁUSULA 7ª — DA INDEPENDÊNCIA</h3>
          <p className="indent-8 leading-relaxed">
            <strong>7.1.</strong> A obrigação deste instrumento é autônoma e subsiste
            independentemente de qualquer outro contrato ou instrumento firmado entre as partes.
          </p>
        </div>

        {/* CLÁUSULA 8ª (Antiga Cláusula 6ª renumerada): DO FORO */}
        <div className="reembolso-clausula-block mb-6 space-y-2">
          <h3 className="font-bold text-slate-950">CLÁUSULA 8ª — DO FORO</h3>
          <p className="indent-8 leading-relaxed">
            <strong>8.1.</strong> Fica eleito o foro da Comarca de{' '}
            {renderField(current.operacao.comarcaForo, '___', 'Comarca do Foro')} para dirimir
            quaisquer dúvidas relativas ao presente instrumento.
          </p>
        </div>

        {/* CLÁUSULA 3ª */}
        <div className="reembolso-clausula-block mb-5 space-y-2">
          <h3 className="font-bold text-slate-950">
            CLÁUSULA 3ª — DA OBRIGAÇÃO DE REEMBOLSO (EVENTO RESOLUTIVO)
          </h3>
          <p className="indent-8 leading-relaxed">
            <strong>3.1.</strong> Caso a venda NÃO seja autorizada pelo Juízo encarregado da
            interdição — decisão definitiva, transitada em julgado ou da qual não caiba mais recurso
            — ou, autorizada, não se consume por fato não imputável ao COMPRADOR, a PROPRIETÁRIA e
            os GARANTIDORES obrigam-se a reembolsar ao COMPRADOR, integralmente e de forma
            SOLIDÁRIA:
          </p>
          <p className="indent-12 leading-relaxed">
            a) a ENTRADA de R$ {current.operacao.valorEntrada || '45.000,00'} paga ou por pagar;
          </p>
          <p className="indent-12 leading-relaxed">
            b) todas as despesas comprovadamente realizadas pelo COMPRADOR em razão da operação —
            incluindo, sem limitação, custas e emolumentos, honorários advocatícios, laudos,
            vistorias, deslocamentos e taxas — mediante simples apresentação de comprovantes;
          </p>
          <p className="indent-12 leading-relaxed">
            c) tudo com CORREÇÃO MONETÁRIA pelo índice [
            {renderField(current.operacao.correcaoIndice, 'IPCA/IBGE', 'Índice de Correção')}], a
            contar da data de cada desembolso até a efetiva restituição.
          </p>

          {current.operacao.multaJurosAtivo && (
            <p className="indent-8 leading-relaxed">
              <strong>3.2.</strong> [Opcional] Não ocorrendo o reembolso em até [
              {renderField(current.operacao.multaJurosPrazoDias, '15/30', 'Prazo em dias')}] dias do
              evento resolutivo, acrescer-se-ão juros de{' '}
              {current.operacao.multaJurosTaxaJuros || '1% ao mês'} e multa de{' '}
              {current.operacao.multaJurosTaxaMulta || '2% sobre o total devido'}.
            </p>
          )}

          <p className="indent-8 leading-relaxed">
            <strong>3.3.</strong> O reembolso será pago em{' '}
            {current.operacao.formaPagamento || 'dinheiro/PIX/transferência bancária'} no prazo de [
            {renderField(current.operacao.prazoReembolsoDias, '15/30', 'Prazo em dias')}] dias
            contados do evento resolutivo.
          </p>
        </div>

        {/* CLÁUSULA 4ª */}
        <div className="reembolso-clausula-block mb-5 space-y-2">
          <h3 className="font-bold text-slate-950">CLÁUSULA 4ª — DA SOLIDARIEDADE</h3>
          <p className="indent-8 leading-relaxed">
            <strong>4.1.</strong> Os GARANTIDORES respondem solidariamente entre si e com a
            PROPRIETÁRIA, renunciando expressamente ao benefício de ordem (art. 828 do Código
            Civil).
          </p>
        </div>

        {/* CLÁUSULA 5ª */}
        <div className="reembolso-clausula-block mb-5 space-y-2">
          <h3 className="font-bold text-slate-950">CLÁUSULA 5ª — DA INDEPENDÊNCIA</h3>
          <p className="indent-8 leading-relaxed">
            <strong>5.1.</strong> A obrigação deste instrumento é autônoma e subsiste
            independentemente de qualquer outro contrato ou instrumento firmado entre as partes.
          </p>
        </div>

        {/* CLÁUSULA 6ª */}
        <div className="reembolso-clausula-block mb-6 space-y-2">
          <h3 className="font-bold text-slate-950">CLÁUSULA 6ª — DO FORO</h3>
          <p className="indent-8 leading-relaxed">
            <strong>6.1.</strong> Fica eleito o foro da Comarca de{' '}
            {renderField(current.operacao.comarcaForo, '___', 'Comarca do Foro')} para dirimir
            quaisquer dúvidas.
          </p>
        </div>

        {/* FECHO */}
        <p className="indent-8 mb-6 leading-relaxed">
          E por estarem justas e contratadas, assinam o presente instrumento em 2 (duas) vias.
        </p>

        {/* LOCAL E DATA */}
        <div className="mb-10 text-right">
          <p className="font-medium text-slate-900">
            {renderField(current.operacao.localData, '[Local], [data]', 'Local e Data')}
          </p>
        </div>

        {/* ASSINATURAS */}
        <div className="reembolso-signature-block space-y-6 pt-4 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-1">
              <div className="border-b border-slate-900 w-full pt-10"></div>
              <p className="text-xs text-center font-sans font-semibold text-slate-900">
                {current.comprador.nomeCompleto || '_______________________________'} — COMPRADOR
              </p>
            </div>

            <div className="space-y-1">
              <div className="border-b border-slate-900 w-full pt-10"></div>
              <p className="text-xs text-center font-sans font-semibold text-slate-900">
                {current.proprietaria.curadorNomeQualificacao?.split(',')[0] ||
                  '_______________________________'}{' '}
                — Curador(a) da PROPRIETÁRIA
              </p>
            </div>

            <div className="space-y-1">
              <div className="border-b border-slate-900 w-full pt-10"></div>
              <p className="text-xs text-center font-sans font-semibold text-slate-900">
                _______________________________ — GARANTIDOR: Odilon{' '}
                {current.garantidores[0]?.sobrenome || ''}
              </p>
            </div>

            <div className="space-y-1">
              <div className="border-b border-slate-900 w-full pt-10"></div>
              <p className="text-xs text-center font-sans font-semibold text-slate-900">
                _______________________________ — GARANTIDORA: Maria Luísa{' '}
                {current.garantidores[1]?.sobrenome || ''}
              </p>
            </div>

            <div className="space-y-1">
              <div className="border-b border-slate-900 w-full pt-10"></div>
              <p className="text-xs text-center font-sans font-semibold text-slate-900">
                _______________________________ — GARANTIDORA: Tereza Christina{' '}
                {current.garantidores[2]?.sobrenome || ''}
              </p>
            </div>

            <div className="space-y-1">
              <div className="border-b border-slate-900 w-full pt-10"></div>
              <p className="text-xs text-center font-sans font-semibold text-slate-900">
                _______________________________ — GARANTIDOR: João Bôsco{' '}
                {current.garantidores[3]?.sobrenome || ''}
              </p>
            </div>

            <div className="space-y-1 sm:col-span-2 sm:w-1/2 sm:mx-auto">
              <div className="border-b border-slate-900 w-full pt-10"></div>
              <p className="text-xs text-center font-sans font-semibold text-slate-900">
                _______________________________ — GARANTIDOR: José Flávio{' '}
                {current.garantidores[4]?.sobrenome || ''}
              </p>
            </div>
          </div>

          {/* TESTEMUNHAS */}
          <div className="pt-6 space-y-4">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-900">
              TESTEMUNHAS:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-xs font-sans text-slate-700">
                  1) ____________________________________
                </p>
                <p className="text-[11px] font-sans text-slate-500">
                  Nome: __________________________ CPF: ___________________
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-sans text-slate-700">
                  2) ____________________________________
                </p>
                <p className="text-[11px] font-sans text-slate-500">
                  Nome: __________________________ CPF: ___________________
                </p>
              </div>
            </div>
            <p className="text-xs italic text-slate-600 font-sans mt-3">
              (Recomendo reconhecimento de firma em todas as assinaturas.)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TermoReembolso
