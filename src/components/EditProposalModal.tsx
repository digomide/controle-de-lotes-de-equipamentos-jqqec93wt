import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, Trash2, RotateCcw, Save, Loader2, Building2, Banknote, FileText } from 'lucide-react'
import { PropertyProposalConfig, DEFAULT_PROPOSAL_CONFIG } from '@/services/propertyProposalService'

interface EditProposalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposal: PropertyProposalConfig
  onSave: (updated: PropertyProposalConfig) => Promise<void> | void
  onResetToDefault: () => Promise<void> | void
}

export const EditProposalModal: React.FC<EditProposalModalProps> = ({
  open,
  onOpenChange,
  proposal,
  onSave,
  onResetToDefault,
}) => {
  const [formData, setFormData] = useState<PropertyProposalConfig>(() =>
    JSON.parse(JSON.stringify(proposal)),
  )
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Atualiza formData se proposal mudar enquanto aberto
  React.useEffect(() => {
    if (open) {
      setFormData(JSON.parse(JSON.stringify(proposal)))
    }
  }, [open, proposal])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(formData)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (
      !window.confirm(
        'Tem certeza que deseja restaurar todos os valores e textos para o padrão original da proposta?',
      )
    ) {
      return
    }
    setResetting(true)
    try {
      await onResetToDefault()
      setFormData(JSON.parse(JSON.stringify(DEFAULT_PROPOSAL_CONFIG)))
      onOpenChange(false)
    } finally {
      setResetting(false)
    }
  }

  // Recalcula totais automaticamente quando valores principais são editados
  const handleValorReferenciaChange = (newRef: number) => {
    const oferta = Math.round(newRef * (formData.valoresOperacao.percentualOferta / 100))
    const saldo = Math.max(0, oferta - formData.valoresOperacao.entradaDivida)
    const itbi = Math.round(oferta * 0.03)
    const custos = itbi + formData.valoresOperacao.escrituraRegistroEstimado
    const totalComp = oferta + custos

    setFormData((prev) => ({
      ...prev,
      valoresOperacao: {
        ...prev.valoresOperacao,
        valorReferencia: newRef,
        valorOferta: oferta,
        saldoFinanciado: saldo,
        itbiEstimado: itbi,
        custosTransferencia: custos,
        totalComprometimento: totalComp,
      },
    }))
  }

  const handlePercentualOfertaChange = (newPct: number) => {
    const oferta = Math.round(formData.valoresOperacao.valorReferencia * (newPct / 100))
    const saldo = Math.max(0, oferta - formData.valoresOperacao.entradaDivida)
    const itbi = Math.round(oferta * 0.03)
    const custos = itbi + formData.valoresOperacao.escrituraRegistroEstimado
    const totalComp = oferta + custos

    setFormData((prev) => ({
      ...prev,
      valoresOperacao: {
        ...prev.valoresOperacao,
        percentualOferta: newPct,
        valorOferta: oferta,
        saldoFinanciado: saldo,
        itbiEstimado: itbi,
        custosTransferencia: custos,
        totalComprometimento: totalComp,
      },
    }))
  }

  const handleValorOfertaChange = (newOferta: number) => {
    const pct =
      formData.valoresOperacao.valorReferencia > 0
        ? Math.round((newOferta / formData.valoresOperacao.valorReferencia) * 100)
        : 70
    const saldo = Math.max(0, newOferta - formData.valoresOperacao.entradaDivida)
    const itbi = Math.round(newOferta * 0.03)
    const custos = itbi + formData.valoresOperacao.escrituraRegistroEstimado
    const totalComp = newOferta + custos

    setFormData((prev) => ({
      ...prev,
      valoresOperacao: {
        ...prev.valoresOperacao,
        valorOferta: newOferta,
        percentualOferta: pct,
        saldoFinanciado: saldo,
        itbiEstimado: itbi,
        custosTransferencia: custos,
        totalComprometimento: totalComp,
      },
    }))
  }

  const handleEntradaDividaChange = (newEntrada: number) => {
    const saldo = Math.max(0, formData.valoresOperacao.valorOferta - newEntrada)
    setFormData((prev) => ({
      ...prev,
      valoresOperacao: {
        ...prev.valoresOperacao,
        entradaDivida: newEntrada,
        saldoFinanciado: saldo,
      },
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-700" />
                Editar Dados da Proposta de Compra
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Altere valores, número de parcelas, textos explicativos e cláusulas jurídicas da
                proposta.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={resetting || saving}
              className="text-xs text-slate-600 gap-1.5"
            >
              {resetting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Restaurar Padrão
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="valores" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-3 border-b border-slate-100 bg-slate-50/50">
              <TabsList className="grid grid-cols-3 w-full max-w-md h-9 text-xs">
                <TabsTrigger value="valores" className="gap-1.5 text-xs">
                  <Banknote className="w-3.5 h-3.5" />
                  Valores & Parcelas
                </TabsTrigger>
                <TabsTrigger value="imovel" className="gap-1.5 text-xs">
                  <Building2 className="w-3.5 h-3.5" />
                  Imóvel & Avaliação
                </TabsTrigger>
                <TabsTrigger value="textos" className="gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5" />
                  Textos & Cláusulas
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* ABA 1: VALORES E PARCELAS */}
              <TabsContent value="valores" className="m-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Valor de Referência (R$)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.valorReferencia}
                      onChange={(e) => handleValorReferenciaChange(Number(e.target.value) || 0)}
                      className="mt-1 h-9 text-xs font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-500">Ex: 350.000 (100% de pedida)</span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Percentual da Oferta (%)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.percentualOferta}
                      onChange={(e) => handlePercentualOfertaChange(Number(e.target.value) || 0)}
                      className="mt-1 h-9 text-xs font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-500">Ex: 70% da referência</span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Valor da Oferta (R$)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.valorOferta}
                      onChange={(e) => handleValorOfertaChange(Number(e.target.value) || 0)}
                      className="mt-1 h-9 text-xs font-mono font-black text-emerald-700"
                    />
                    <span className="text-[10px] text-slate-500">Ex: 245.000 (preço proposto)</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Entrada via Dívida Judicial (R$)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.entradaDivida}
                      onChange={(e) => handleEntradaDividaChange(Number(e.target.value) || 0)}
                      className="mt-1 h-9 text-xs font-mono font-bold text-rose-700"
                    />
                    <span className="text-[10px] text-slate-500">
                      Ex: 45.000 (assunção de cuidadoras)
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Saldo Financiado Restante (R$)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.saldoFinanciado}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          valoresOperacao: {
                            ...prev.valoresOperacao,
                            saldoFinanciado: Number(e.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 h-9 text-xs font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-500">
                      Ex: 200.000 (pago à vendedora)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Total de Parcelas
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.totalParcelas}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          valoresOperacao: {
                            ...prev.valoresOperacao,
                            totalParcelas: Number(e.target.value) || 1,
                          },
                        }))
                      }
                      className="mt-1 h-9 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-500">Ex: 29 meses</span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Valor Parcela Padrão (R$)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.valorParcelaPadrao}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          valoresOperacao: {
                            ...prev.valoresOperacao,
                            valorParcelaPadrao: Number(e.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 h-9 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-500">Ex: 7.000 (parcelas 1 a 28)</span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Valor Última Parcela (R$)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.valorUltimaParcela}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          valoresOperacao: {
                            ...prev.valoresOperacao,
                            valorUltimaParcela: Number(e.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 h-9 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-500">Ex: 6.000 (ajuste final)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      ITBI Estimado (R$)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.itbiEstimado}
                      onChange={(e) => {
                        const itbi = Number(e.target.value) || 0
                        const custos = itbi + formData.valoresOperacao.escrituraRegistroEstimado
                        setFormData((prev) => ({
                          ...prev,
                          valoresOperacao: {
                            ...prev.valoresOperacao,
                            itbiEstimado: itbi,
                            custosTransferencia: custos,
                            totalComprometimento: prev.valoresOperacao.valorOferta + custos,
                          },
                        }))
                      }}
                      className="mt-1 h-9 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Escritura + Registro (R$)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.escrituraRegistroEstimado}
                      onChange={(e) => {
                        const reg = Number(e.target.value) || 0
                        const custos = formData.valoresOperacao.itbiEstimado + reg
                        setFormData((prev) => ({
                          ...prev,
                          valoresOperacao: {
                            ...prev.valoresOperacao,
                            escrituraRegistroEstimado: reg,
                            custosTransferencia: custos,
                            totalComprometimento: prev.valoresOperacao.valorOferta + custos,
                          },
                        }))
                      }}
                      className="mt-1 h-9 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Total Comprometimento (R$)
                    </Label>
                    <Input
                      type="number"
                      value={formData.valoresOperacao.totalComprometimento}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          valoresOperacao: {
                            ...prev.valoresOperacao,
                            totalComprometimento: Number(e.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 h-9 text-xs font-mono font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500">Oferta + custas cartorárias</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Detalhamento do Pagamento da Entrada
                  </Label>
                  <Textarea
                    rows={2}
                    value={formData.detalhesEntrada}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, detalhesEntrada: e.target.value }))
                    }
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Detalhamento do Saldo Financiado
                  </Label>
                  <Textarea
                    rows={2}
                    value={formData.detalhesSaldo}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, detalhesSaldo: e.target.value }))
                    }
                    className="mt-1 text-xs"
                  />
                </div>
              </TabsContent>

              {/* ABA 2: IMÓVEL E AVALIAÇÃO DE MERCADO */}
              <TabsContent value="imovel" className="m-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Endereço Principal
                    </Label>
                    <Input
                      value={formData.dadosImovel.endereco}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dadosImovel: { ...prev.dadosImovel, endereco: e.target.value },
                        }))
                      }
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Bairro, Cidade, CEP
                    </Label>
                    <Input
                      value={formData.dadosImovel.bairroCidade}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dadosImovel: { ...prev.dadosImovel, bairroCidade: e.target.value },
                        }))
                      }
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Área Privativa</Label>
                    <Input
                      value={formData.dadosImovel.areaPrivativa}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dadosImovel: { ...prev.dadosImovel, areaPrivativa: e.target.value },
                        }))
                      }
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Fração Ideal</Label>
                    <Input
                      value={formData.dadosImovel.fracaoIdeal}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dadosImovel: { ...prev.dadosImovel, fracaoIdeal: e.target.value },
                        }))
                      }
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Padrão & Zoneamento
                    </Label>
                    <Input
                      value={formData.dadosImovel.padraoEdificio}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dadosImovel: { ...prev.dadosImovel, padraoEdificio: e.target.value },
                        }))
                      }
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Estado de Conservação
                    </Label>
                    <Input
                      value={formData.dadosImovel.estadoConservacao}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dadosImovel: { ...prev.dadosImovel, estadoConservacao: e.target.value },
                        }))
                      }
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Status IPTU</Label>
                    <Input
                      value={formData.dadosImovel.iptuStatus}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dadosImovel: { ...prev.dadosImovel, iptuStatus: e.target.value },
                        }))
                      }
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Detalhes IPTU & Venal
                    </Label>
                    <Input
                      value={formData.dadosImovel.iptuDetalhes}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          dadosImovel: { ...prev.dadosImovel, iptuDetalhes: e.target.value },
                        }))
                      }
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 mb-2">Faixas de Avaliação</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                      <Label className="text-[11px] font-bold text-slate-700">
                        Conservador (R$)
                      </Label>
                      <Input
                        type="number"
                        value={formData.faixasMercado.conservadorValor}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            faixasMercado: {
                              ...prev.faixasMercado,
                              conservadorValor: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="mt-1 h-8 text-xs font-mono"
                      />
                      <Input
                        value={formData.faixasMercado.conservadorM2}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            faixasMercado: {
                              ...prev.faixasMercado,
                              conservadorM2: e.target.value,
                            },
                          }))
                        }
                        placeholder="R$/m²"
                        className="mt-1 h-7 text-[10px]"
                      />
                    </div>

                    <div className="bg-blue-50/70 p-2.5 rounded border border-blue-200">
                      <Label className="text-[11px] font-bold text-blue-900">
                        Base / Adotado (R$)
                      </Label>
                      <Input
                        type="number"
                        value={formData.faixasMercado.baseValorAdotado}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            faixasMercado: {
                              ...prev.faixasMercado,
                              baseValorAdotado: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="mt-1 h-8 text-xs font-mono font-bold"
                      />
                      <Input
                        value={formData.faixasMercado.baseM2}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            faixasMercado: {
                              ...prev.faixasMercado,
                              baseM2: e.target.value,
                            },
                          }))
                        }
                        placeholder="R$/m²"
                        className="mt-1 h-7 text-[10px]"
                      />
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                      <Label className="text-[11px] font-bold text-slate-700">Otimista (R$)</Label>
                      <Input
                        type="number"
                        value={formData.faixasMercado.otimistaValor}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            faixasMercado: {
                              ...prev.faixasMercado,
                              otimistaValor: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="mt-1 h-8 text-xs font-mono"
                      />
                      <Input
                        value={formData.faixasMercado.otimistaM2}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            faixasMercado: {
                              ...prev.faixasMercado,
                              otimistaM2: e.target.value,
                            },
                          }))
                        }
                        placeholder="R$/m²"
                        className="mt-1 h-7 text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ABA 3: TEXTOS E CLÁUSULAS */}
              <TabsContent value="textos" className="m-0 space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Título do Documento
                  </Label>
                  <Input
                    value={formData.titulo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, titulo: e.target.value }))}
                    className="mt-1 h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Subtítulo / Linha de Identificação
                  </Label>
                  <Input
                    value={formData.subtitulo}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, subtitulo: e.target.value }))
                    }
                    className="mt-1 h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Alerta de Referência do Edifício
                  </Label>
                  <Textarea
                    rows={2}
                    value={formData.faixasMercado.alertaReferencia}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        faixasMercado: {
                          ...prev.faixasMercado,
                          alertaReferencia: e.target.value,
                        },
                      }))
                    }
                    className="mt-1 text-xs"
                  />
                </div>

                {/* Justificativas do Desconto */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-bold text-slate-900">
                      Justificativas do Coeficiente / Desconto
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          justificativasDesconto: [
                            ...prev.justificativasDesconto,
                            { titulo: 'Novo motivo:', texto: '' },
                          ],
                        }))
                      }
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.justificativasDesconto.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            value={item.titulo}
                            onChange={(e) => {
                              const val = e.target.value
                              setFormData((prev) => {
                                const list = [...prev.justificativasDesconto]
                                list[idx].titulo = val
                                return { ...prev, justificativasDesconto: list }
                              })
                            }}
                            className="h-7 text-xs font-semibold"
                            placeholder="Título da justificativa"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                justificativasDesconto: prev.justificativasDesconto.filter(
                                  (_, i) => i !== idx,
                                ),
                              }))
                            }
                            className="h-7 w-7 text-rose-500 hover:text-rose-700 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          rows={2}
                          value={item.texto}
                          onChange={(e) => {
                            const val = e.target.value
                            setFormData((prev) => {
                              const list = [...prev.justificativasDesconto]
                              list[idx].texto = val
                              return { ...prev, justificativasDesconto: list }
                            })
                          }}
                          className="text-xs"
                          placeholder="Texto detalhado"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cláusulas Jurídicas */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-bold text-slate-900">
                      Cláusulas Jurídicas e de Proteção Mútua
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          clausulasJuridicas: [
                            ...prev.clausulasJuridicas,
                            { titulo: 'Nova cláusula:', texto: '' },
                          ],
                        }))
                      }
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.clausulasJuridicas.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            value={item.titulo}
                            onChange={(e) => {
                              const val = e.target.value
                              setFormData((prev) => {
                                const list = [...prev.clausulasJuridicas]
                                list[idx].titulo = val
                                return { ...prev, clausulasJuridicas: list }
                              })
                            }}
                            className="h-7 text-xs font-semibold"
                            placeholder="Título da cláusula"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                clausulasJuridicas: prev.clausulasJuridicas.filter(
                                  (_, i) => i !== idx,
                                ),
                              }))
                            }
                            className="h-7 w-7 text-rose-500 hover:text-rose-700 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          rows={2}
                          value={item.texto}
                          onChange={(e) => {
                            const val = e.target.value
                            setFormData((prev) => {
                              const list = [...prev.clausulasJuridicas]
                              list[idx].texto = val
                              return { ...prev, clausulasJuridicas: list }
                            })
                          }}
                          className="text-xs"
                          placeholder="Texto da cláusula"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Nota Legal de Rodapé
                  </Label>
                  <Textarea
                    rows={2}
                    value={formData.notaImportante}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notaImportante: e.target.value }))
                    }
                    className="mt-1 text-xs"
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 sm:justify-between">
            <span className="text-[11px] text-slate-500">
              As alterações serão salvas imediatamente e refletidas na impressão e no PDF.
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Salvar Alterações
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
