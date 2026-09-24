import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Printer,
  ArrowLeft,
  Download,
  Building2,
  FileCheck2,
  ShieldCheck,
  Scale,
  Calendar,
  Layers,
  CheckCircle2,
  Info,
  DollarSign,
  FileText,
  BadgePercent,
  Landmark,
  Pencil,
  Loader2,
  Save,
  RotateCcw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  propertyProposalService,
  PropertyProposalConfig,
  DEFAULT_PROPOSAL_CONFIG,
} from '@/services/propertyProposalService'
import { downloadProposalPdf } from '@/utils/proposalPdfGenerator'
import { toast } from '@/hooks/use-toast'

export const PropostaImovel: React.FC = () => {
  const [proposal, setProposal] = useState<PropertyProposalConfig>(() =>
    propertyProposalService.getProposal(),
  )
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<PropertyProposalConfig['valoresOperacao']>(
    () => proposal.valoresOperacao,
  )
  const [editFaixas, setEditFaixas] = useState<PropertyProposalConfig['faixasMercado']>(
    () => proposal.faixasMercado,
  )
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [pdfProgressLabel, setPdfProgressLabel] = useState<string>('')

  // Sincroniza estado inicial ao montar e ao receber eventos locais
  useEffect(() => {
    const loaded = propertyProposalService.getProposal()
    setProposal(loaded)
    setEditValues(loaded.valoresOperacao)
    setEditFaixas(loaded.faixasMercado)

    const handleUpdateEvent = (e: any) => {
      if (e?.detail) {
        setProposal(e.detail)
        setEditValues(e.detail.valoresOperacao)
        setEditFaixas(e.detail.faixasMercado)
      }
    }
    window.addEventListener('property_proposal_updated', handleUpdateEvent)
    return () => {
      window.removeEventListener('property_proposal_updated', handleUpdateEvent)
    }
  }, [])

  // Recalcula totais quando valor de referência ou % muda no modo de edição
  const handleEditValorReferencia = (val: number) => {
    const pct = editValues.percentualOferta || 70
    const oferta = Math.round(val * (pct / 100))
    const entrada = editValues.entradaDivida || 45000
    const saldo = Math.max(0, oferta - entrada)
    const itbi = Math.round(oferta * 0.03)
    const totalComp = oferta + itbi + (editValues.escrituraRegistroEstimado || 5000)

    setEditValues((prev) => ({
      ...prev,
      valorReferencia: val,
      valorOferta: oferta,
      saldoFinanciado: saldo,
      itbiEstimado: itbi,
      totalComprometimento: totalComp,
    }))
  }

  const handleEditPercentual = (pct: number) => {
    const ref = editValues.valorReferencia || 350000
    const oferta = Math.round(ref * (pct / 100))
    const entrada = editValues.entradaDivida || 45000
    const saldo = Math.max(0, oferta - entrada)
    const itbi = Math.round(oferta * 0.03)
    const totalComp = oferta + itbi + (editValues.escrituraRegistroEstimado || 5000)

    setEditValues((prev) => ({
      ...prev,
      percentualOferta: pct,
      valorOferta: oferta,
      saldoFinanciado: saldo,
      itbiEstimado: itbi,
      totalComprometimento: totalComp,
    }))
  }

  const handleEditValorOferta = (oferta: number) => {
    const ref = editValues.valorReferencia || 350000
    const pct = ref > 0 ? Math.round((oferta / ref) * 100) : 70
    const entrada = editValues.entradaDivida || 45000
    const saldo = Math.max(0, oferta - entrada)
    const itbi = Math.round(oferta * 0.03)
    const totalComp = oferta + itbi + (editValues.escrituraRegistroEstimado || 5000)

    setEditValues((prev) => ({
      ...prev,
      valorOferta: oferta,
      percentualOferta: pct,
      saldoFinanciado: saldo,
      itbiEstimado: itbi,
      totalComprometimento: totalComp,
    }))
  }

  const handleEditEntradaDivida = (entrada: number) => {
    const saldo = Math.max(0, editValues.valorOferta - entrada)
    setEditValues((prev) => ({
      ...prev,
      entradaDivida: entrada,
      saldoFinanciado: saldo,
    }))
  }

  const handleStartEditing = () => {
    setEditValues(proposal.valoresOperacao)
    setEditFaixas(proposal.faixasMercado)
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    setEditValues(proposal.valoresOperacao)
    setEditFaixas(proposal.faixasMercado)
    setIsEditing(false)
  }

  const handleSaveEditing = () => {
    const updated: PropertyProposalConfig = {
      ...proposal,
      faixasMercado: {
        ...proposal.faixasMercado,
        ...editFaixas,
        baseValorAdotado: editValues.valorReferencia,
      },
      valoresOperacao: {
        ...proposal.valoresOperacao,
        ...editValues,
      },
    }
    const saved = propertyProposalService.saveProposal(updated)
    setProposal(saved)
    setIsEditing(false)
    toast({
      title: 'Proposta salva no navegador',
      description: 'Valores gravados com sucesso em localStorage.',
    })
  }

  const handleResetToDefault = () => {
    if (
      !window.confirm('Deseja restaurar todos os valores para a proposta padrão original aprovada?')
    ) {
      return
    }
    const standard = propertyProposalService.resetToDefault()
    setProposal(standard)
    setEditValues(standard.valoresOperacao)
    setEditFaixas(standard.faixasMercado)
    setIsEditing(false)
    toast({
      title: 'Padrão restaurado',
      description: 'Valores originais da proposta foram redefinidos.',
    })
  }

  const handlePrint = () => {
    window.focus()
    setTimeout(() => {
      window.print()
    }, 100)
  }

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true)
    setPdfProgressLabel('Gerando PDF...')
    try {
      toast({
        title: 'Gerando PDF',
        description: 'Construindo o arquivo Proposta-Imovel-Francisco-Sales-905.pdf...',
      })
      await downloadProposalPdf({
        elementId: 'proposta-imovel-doc',
        filename: 'Proposta-Imovel-Francisco-Sales-905.pdf',
        onProgress: (_prog, label) => setPdfProgressLabel(label),
      })
      toast({
        title: 'PDF Baixado com sucesso',
        description: 'Arquivo salvo no seu navegador.',
      })
    } catch (err: any) {
      console.error('Erro ao gerar PDF client-side:', err)
      toast({
        title: 'Falha ao baixar PDF',
        description:
          'Não foi possível renderizar o arquivo diretamente. Abrindo diálogo nativo de impressão.',
        variant: 'destructive',
      })
      window.print()
    } finally {
      setIsDownloadingPdf(false)
      setPdfProgressLabel('')
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Gera o cronograma de parcelas dinamicamente com base nos dados (modo normal ou edição)
  const currentValores = isEditing ? editValues : proposal.valoresOperacao
  const parcelasArray = Array.from({ length: currentValores.totalParcelas }, (_, i) => {
    const num = i + 1
    const isUltima = num === currentValores.totalParcelas
    const valor = isUltima ? currentValores.valorUltimaParcela : currentValores.valorParcelaPadrao
    return { num, isUltima, valor }
  })

  return (
    <div
      id="proposta-imovel-container"
      className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased p-0 md:p-6 print:p-0 print:m-0 print:bg-white"
    >
      {/* BARRA DE AÇÕES SUPERIOR (TOTALMENTE OCULTADA NA IMPRESSÃO) */}
      <div className="proposta-no-print max-w-[210mm] mx-auto mb-4 px-4 sm:px-0 flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur p-3 rounded-xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Link to="/lotes-entrada">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Sistema
            </Button>
          </Link>
          <Badge variant="outline" className="text-[11px] font-medium bg-slate-50 border-slate-300">
            Documento A4 Formal
          </Badge>
          {proposal.updatedAt && (
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
                Salvar Proposta
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEditing}
              className="gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-50 font-medium"
              title="Tornar os valores numéricos editáveis na proposta"
            >
              <Pencil className="w-3.5 h-3.5 text-blue-600" />
              Editar Valores
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
            className="gap-1.5 text-xs text-slate-600 border-slate-300 hover:bg-slate-50"
            title="Restaurar valores padrão originais"
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

      {isEditing && (
        <div className="proposta-no-print max-w-[210mm] mx-auto mb-4 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Modo de Edição Ativo:</strong> altere os números diretamente abaixo nos campos
              em azul e clique em <strong>Salvar Proposta</strong> para gravar no navegador.
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleSaveEditing}
            className="gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white h-7 px-3"
          >
            <Save className="w-3.5 h-3.5" />
            Salvar
          </Button>
        </div>
      )}

      {/* DOCUMENTO FORMAL A4 */}
      <div
        id="proposta-imovel-doc"
        className="max-w-[210mm] mx-auto bg-white border border-slate-200/90 shadow-lg rounded-sm p-6 sm:p-10 print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full space-y-6 print:space-y-4"
      >
        {/* CABEÇALHO DO DOCUMENTO */}
        <header className="border-b-2 border-slate-900 pb-4 proposta-section-block">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  <FileText className="w-3 h-3 text-slate-700" /> Proposta Comercial Irretratável
                </span>
                <span className="text-[10px] text-slate-400">·</span>
                <span className="text-[10px] text-slate-500 font-medium">Ref. #PROP-FS-905</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                {proposal.titulo}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-0.5">
                {proposal.subtitulo}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] font-bold text-slate-700">{proposal.cidadeUf}</div>
              <div className="text-[10px] text-slate-500">
                {proposal.dataEmissaoPersonalizada ||
                  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}
              </div>
              <div className="mt-1">
                <span className="inline-block px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                  Válida por 15 dias
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* 1. DADOS DO IMÓVEL OBJETO */}
        <section className="proposta-section-block break-inside-avoid">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide mb-2.5 pb-1 border-b border-slate-200">
            <Building2 className="w-4 h-4 text-slate-700" />
            1. Caracterização e Descrição do Imóvel Objeto
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded bg-slate-50/80 border border-slate-200/80">
              <span className="text-[10px] font-semibold text-slate-500 block uppercase">
                Endereço Completo
              </span>
              <span className="font-bold text-slate-800">{proposal.dadosImovel.endereco}</span>
              <span className="text-[11px] text-slate-600 block mt-0.5">
                {proposal.dadosImovel.bairroCidade}
              </span>
            </div>

            <div className="p-2.5 rounded bg-slate-50/80 border border-slate-200/80">
              <span className="text-[10px] font-semibold text-slate-500 block uppercase">
                Área e Fração Ideal
              </span>
              <span className="font-bold text-slate-800">{proposal.dadosImovel.areaPrivativa}</span>
              <span className="text-[11px] text-slate-600 block mt-0.5">
                {proposal.dadosImovel.fracaoIdeal}
              </span>
            </div>

            <div className="p-2.5 rounded bg-slate-50/80 border border-slate-200/80">
              <span className="text-[10px] font-semibold text-slate-500 block uppercase">
                Padrão Construtivo e Zoneamento
              </span>
              <span className="font-bold text-slate-800">
                {proposal.dadosImovel.padraoEdificio}
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5">
                {proposal.dadosImovel.estadoConservacao}
              </span>
            </div>

            <div className="p-2.5 rounded bg-slate-50/80 border border-slate-200/80">
              <span className="text-[10px] font-semibold text-slate-500 block uppercase">
                Situação Cadastral & IPTU
              </span>
              <span className="font-bold text-emerald-700">{proposal.dadosImovel.iptuStatus}</span>
              <span className="text-[11px] text-slate-600 block mt-0.5">
                {proposal.dadosImovel.iptuDetalhes}
              </span>
            </div>
          </div>
        </section>

        {/* 2. ANÁLISE DE MERCADO LOCAL E BALIZAMENTO DE VALORES */}
        <section className="proposta-section-block break-inside-avoid">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 pb-1 border-b border-slate-200">
            <Scale className="w-4 h-4 text-slate-700" />
            2. Balizamento de Mercado da Região (Bairro Floresta / Centro)
          </div>

          <div className="p-2.5 mb-2.5 bg-amber-50/80 rounded border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Informação Crítica de Mercado do Edifício:</strong>{' '}
              {proposal.faixasMercado.alertaReferencia}
            </div>
          </div>

          {/* FAIXAS DE VALOR COMPARATIVO */}
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-semibold uppercase text-slate-500">
                Cenário Conservador
              </div>
              {isEditing ? (
                <div className="mt-1">
                  <Input
                    type="number"
                    value={editFaixas.conservadorValor}
                    onChange={(e) =>
                      setEditFaixas((prev) => ({
                        ...prev,
                        conservadorValor: Number(e.target.value) || 0,
                      }))
                    }
                    className="h-8 text-xs font-bold text-center bg-white"
                  />
                </div>
              ) : (
                <div className="text-sm font-extrabold text-slate-700 mt-0.5">
                  {formatCurrency(proposal.faixasMercado.conservadorValor)}
                </div>
              )}
              <div className="text-[10px] text-slate-500 mt-0.5">
                {proposal.faixasMercado.conservadorM2}
              </div>
            </div>

            <div className="p-2 rounded bg-blue-50/70 border border-blue-200 ring-1 ring-blue-300">
              <div className="text-[10px] font-bold uppercase text-blue-800">
                Cenário Base (Referência)
              </div>
              {isEditing ? (
                <div className="mt-1">
                  <Input
                    type="number"
                    value={editValues.valorReferencia}
                    onChange={(e) => handleEditValorReferencia(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-black text-center bg-white text-blue-900 border-blue-300"
                  />
                </div>
              ) : (
                <div className="text-sm font-extrabold text-blue-900 mt-0.5">
                  {formatCurrency(proposal.faixasMercado.baseValorAdotado)}
                </div>
              )}
              <div className="text-[10px] text-blue-700 mt-0.5">
                {proposal.faixasMercado.baseM2}
              </div>
            </div>

            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-semibold uppercase text-slate-500">
                Cenário Otimista
              </div>
              {isEditing ? (
                <div className="mt-1">
                  <Input
                    type="number"
                    value={editFaixas.otimistaValor}
                    onChange={(e) =>
                      setEditFaixas((prev) => ({
                        ...prev,
                        otimistaValor: Number(e.target.value) || 0,
                      }))
                    }
                    className="h-8 text-xs font-bold text-center bg-white"
                  />
                </div>
              ) : (
                <div className="text-sm font-extrabold text-slate-700 mt-0.5">
                  {formatCurrency(proposal.faixasMercado.otimistaValor)}
                </div>
              )}
              <div className="text-[10px] text-slate-500 mt-0.5">
                {proposal.faixasMercado.otimistaM2}
              </div>
            </div>
          </div>

          {/* TABELA DE AMOSTRAS DE MERCADO */}
          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-1.5 px-3">Amostra de Imóvel Comparável (Floresta)</th>
                  <th className="py-1.5 px-3 text-center">Área</th>
                  <th className="py-1.5 px-3 text-right">Preço Solicitado</th>
                  <th className="py-1.5 px-3 text-right">R$/m² Solicitado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {proposal.amostrasMercado.map((am, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-1 px-3 font-medium text-slate-800">{am.endereco}</td>
                    <td className="py-1 px-3 text-center">{am.area}</td>
                    <td className="py-1 px-3 text-right">{formatCurrency(am.valor)}</td>
                    <td className="py-1 px-3 text-right font-mono text-slate-700">
                      R$ {am.m2.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. PROPOSTA ECONÔMICA E CONDIÇÕES DE PAGAMENTO */}
        <section className="proposta-section-block break-inside-avoid">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide mb-2.5 pb-1 border-b border-slate-200">
            <DollarSign className="w-4 h-4 text-slate-700" />
            3. Proposta Econômica e Condições de Aquisição
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Valor Base de Referência
              </span>
              {isEditing ? (
                <div className="mt-1">
                  <Input
                    type="number"
                    value={editValues.valorReferencia}
                    onChange={(e) => handleEditValorReferencia(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-bold bg-white"
                  />
                </div>
              ) : (
                <span className="text-base font-extrabold text-slate-800">
                  {formatCurrency(proposal.valoresOperacao.valorReferencia)}
                </span>
              )}
              <span className="text-[10px] text-slate-500 block mt-0.5">Avaliação sem deságio</span>
            </div>

            <div className="p-3 bg-emerald-50/80 rounded border border-emerald-300 ring-1 ring-emerald-300">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                Valor da Oferta Formal ({currentValores.percentualOferta}%)
              </span>
              {isEditing ? (
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  <Input
                    type="number"
                    value={editValues.valorOferta}
                    onChange={(e) => handleEditValorOferta(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-black bg-white text-emerald-700"
                    placeholder="Valor R$"
                  />
                  <Input
                    type="number"
                    value={editValues.percentualOferta}
                    onChange={(e) => handleEditPercentual(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-bold bg-white text-emerald-700"
                    placeholder="%"
                  />
                </div>
              ) : (
                <span className="text-lg font-black text-emerald-700">
                  {formatCurrency(proposal.valoresOperacao.valorOferta)}
                </span>
              )}
              <span className="text-[10px] text-emerald-800 font-medium block mt-0.5">
                Proposta líquida de aquisição
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Desconto Comercial Aplicado
              </span>
              <span className="text-base font-extrabold text-rose-700">
                -{formatCurrency(currentValores.valorReferencia - currentValores.valorOferta)}{' '}
                <span className="text-xs">({100 - currentValores.percentualOferta}%)</span>
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Usufruto + Reforma + Liquidez
              </span>
            </div>
          </div>

          {/* ESTRUTURAÇÃO DO PAGAMENTO */}
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                <span className="flex items-center gap-1.5 text-rose-700">
                  <BadgePercent className="w-4 h-4" />
                  ETAPA 1: ENTRADA VIA ASSUNÇÃO DE DÍVIDA JUDICIAL
                </span>
                {isEditing ? (
                  <div className="w-36">
                    <Input
                      type="number"
                      value={editValues.entradaDivida}
                      onChange={(e) => handleEditEntradaDivida(Number(e.target.value) || 0)}
                      className="h-7 text-xs font-black text-rose-700 text-right bg-white"
                    />
                  </div>
                ) : (
                  <span className="text-sm font-black text-rose-700 font-mono">
                    {formatCurrency(proposal.valoresOperacao.entradaDivida)}
                  </span>
                )}
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {proposal.detalhesEntrada}
              </p>
            </div>

            <div className="p-3 rounded bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                <span className="flex items-center gap-1.5 text-blue-700">
                  <Calendar className="w-4 h-4" />
                  ETAPA 2: SALDO FINANCIADO DIRETO ({currentValores.totalParcelas} PARCELAS MENSAIS)
                </span>
                {isEditing ? (
                  <div className="w-36">
                    <Input
                      type="number"
                      value={editValues.saldoFinanciado}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          saldoFinanciado: Number(e.target.value) || 0,
                        }))
                      }
                      className="h-7 text-xs font-black text-blue-700 text-right bg-white"
                    />
                  </div>
                ) : (
                  <span className="text-sm font-black text-blue-700 font-mono">
                    {formatCurrency(proposal.valoresOperacao.saldoFinanciado)}
                  </span>
                )}
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">{proposal.detalhesSaldo}</p>
            </div>
          </div>
        </section>

        {/* 4. CRONOGRAMA DAS 29 PARCELAS DO SALDO (TABELA EM 3 COLUNAS) */}
        <section className="proposta-section-block break-inside-avoid">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 pb-1 border-b border-slate-200">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-700" />
              4. Cronograma Completo de Amortização das {currentValores.totalParcelas} Parcelas
            </span>
            <span className="text-[10px] font-semibold text-slate-500 lowercase">
              total amortizado: {formatCurrency(currentValores.saldoFinanciado)}
            </span>
          </div>

          {isEditing && (
            <div className="p-2 mb-2 bg-slate-50 rounded border border-slate-200 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-slate-600 block">
                  Total Parcelas:
                </span>
                <Input
                  type="number"
                  value={editValues.totalParcelas}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      totalParcelas: Number(e.target.value) || 1,
                    }))
                  }
                  className="h-7 text-xs font-mono bg-white mt-0.5"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-600 block">
                  Parcela Padrão (R$):
                </span>
                <Input
                  type="number"
                  value={editValues.valorParcelaPadrao}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      valorParcelaPadrao: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-7 text-xs font-mono bg-white mt-0.5"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-600 block">
                  Última Parcela (R$):
                </span>
                <Input
                  type="number"
                  value={editValues.valorUltimaParcela}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      valorUltimaParcela: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-7 text-xs font-mono bg-white mt-0.5"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
            {/* Coluna 1: 1 a 10 */}
            <div className="border border-slate-200 rounded divide-y divide-slate-100">
              <div className="bg-slate-100 px-2 py-1 font-bold text-slate-700 flex justify-between">
                <span>Parcelas 01 a 10</span>
                <span>Valor (R$)</span>
              </div>
              {parcelasArray.slice(0, 10).map((p) => (
                <div
                  key={p.num}
                  className="px-2 py-0.5 flex justify-between items-center text-slate-600 hover:bg-slate-50"
                >
                  <span className="font-mono">Mês {String(p.num).padStart(2, '0')}</span>
                  <span className="font-mono font-medium text-slate-800">
                    {formatCurrency(p.valor)}
                  </span>
                </div>
              ))}
            </div>

            {/* Coluna 2: 11 a 20 */}
            <div className="border border-slate-200 rounded divide-y divide-slate-100">
              <div className="bg-slate-100 px-2 py-1 font-bold text-slate-700 flex justify-between">
                <span>Parcelas 11 a 20</span>
                <span>Valor (R$)</span>
              </div>
              {parcelasArray.slice(10, 20).map((p) => (
                <div
                  key={p.num}
                  className="px-2 py-0.5 flex justify-between items-center text-slate-600 hover:bg-slate-50"
                >
                  <span className="font-mono">Mês {String(p.num).padStart(2, '0')}</span>
                  <span className="font-mono font-medium text-slate-800">
                    {formatCurrency(p.valor)}
                  </span>
                </div>
              ))}
            </div>

            {/* Coluna 3: 21 a 29 */}
            <div className="border border-slate-200 rounded divide-y divide-slate-100">
              <div className="bg-slate-100 px-2 py-1 font-bold text-slate-700 flex justify-between">
                <span>Parcelas 21 a {currentValores.totalParcelas}</span>
                <span>Valor (R$)</span>
              </div>
              {parcelasArray.slice(20).map((p) => (
                <div
                  key={p.num}
                  className={`px-2 py-0.5 flex justify-between items-center hover:bg-slate-50 ${
                    p.isUltima ? 'bg-emerald-50/60 font-bold text-emerald-900' : 'text-slate-600'
                  }`}
                >
                  <span className="font-mono">
                    Mês {String(p.num).padStart(2, '0')}
                    {p.isUltima && ' (Final)'}
                  </span>
                  <span
                    className={`font-mono ${
                      p.isUltima ? 'text-emerald-800 font-bold' : 'text-slate-800 font-medium'
                    }`}
                  >
                    {formatCurrency(p.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. ESTIMATIVA DE CUSTOS DE TRANSFERÊNCIA CARTORÁRIA */}
        <section className="proposta-section-block break-inside-avoid">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 pb-1 border-b border-slate-200">
            <Landmark className="w-4 h-4 text-slate-700" />
            5. Custas Notariais e de Registro de Imóveis (A Cargo do Comprador)
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  ITBI PBH (3% Estimado s/ Proposta)
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {formatCurrency(currentValores.itbiEstimado)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Escritura Pública + Registro de Imóveis
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {formatCurrency(currentValores.escrituraRegistroEstimado)}
                </span>
              </div>
              <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0">
                <span className="text-[10px] text-slate-700 uppercase font-bold block">
                  Comprometimento Total Comprador
                </span>
                <span className="text-base font-black text-slate-900">
                  {formatCurrency(currentValores.totalComprometimento)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 6. JUSTIFICATIVAS TÉCNICAS E ECONÔMICAS DO COEFICIENTE DE OFERTA */}
        <section className="proposta-section-block break-inside-avoid">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 pb-1 border-b border-slate-200">
            <FileCheck2 className="w-4 h-4 text-slate-700" />
            6. Justificativas e Fundamentos da Proposta Econômica
          </div>

          <div className="space-y-2 text-[11px] text-slate-700">
            {proposal.justificativasDesconto.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-slate-50/90 border border-slate-200/90 flex gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-semibold">{item.titulo}</strong>{' '}
                  <span className="leading-relaxed">{item.texto}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 7. ESTRUTURAÇÃO JURÍDICA E DE SEGURANÇA MÚTUA */}
        <section className="proposta-section-block break-inside-avoid">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 pb-1 border-b border-slate-200">
            <ShieldCheck className="w-4 h-4 text-slate-700" />
            7. Condições Jurídicas de Segurança Mútua e Proteção Familiar
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {proposal.clausulasJuridicas.map((cl, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-slate-50/80 border border-slate-200/80 leading-relaxed"
              >
                <div className="font-bold text-slate-800 mb-0.5 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  {cl.titulo}
                </div>
                <div className="text-slate-600 text-[10.5px]">{cl.texto}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 8. DECLARAÇÕES FINAIS E ASSINATURAS */}
        <section className="proposta-section-block break-inside-avoid pt-2">
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[10px] text-slate-500 text-center leading-relaxed mb-8">
            {proposal.notaImportante}
          </div>

          <div className="grid grid-cols-2 gap-8 text-center pt-4">
            <div>
              <div className="border-b border-slate-400 w-4/5 mx-auto mb-1.5" />
              <div className="text-xs font-bold text-slate-800">Proponente Comprador</div>
              <div className="text-[10px] text-slate-500">Pessoa Física / Jurídica Qualificada</div>
            </div>

            <div>
              <div className="border-b border-slate-400 w-4/5 mx-auto mb-1.5" />
              <div className="text-xs font-bold text-slate-800">Proprietária Vendedora</div>
              <div className="text-[10px] text-slate-500">Com anuência de Herdeiros Legais</div>
            </div>
          </div>
        </section>

        {/* RODAPÉ DO DOCUMENTO */}
        <footer className="pt-4 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400">
          <span>{proposal.rodapeEsquerdo}</span>
          <span>{proposal.rodapeDireito}</span>
        </footer>
      </div>
    </div>
  )
}

export default PropostaImovel
