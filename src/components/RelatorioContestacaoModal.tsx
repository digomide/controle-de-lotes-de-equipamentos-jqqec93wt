import React, { useState, useMemo } from 'react'
import {
  FileText,
  Copy,
  Check,
  Download,
  AlertCircle,
  Eye,
  ShieldAlert,
  Calendar,
  Building2,
  User,
  Phone,
  FileCheck2,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react'
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
import { toast } from '@/hooks/use-toast'
import type { MLReputationDispute } from '@/types/reputationDisputes'
import { downloadReputationReportPdf } from '@/utils/reputationReportPdfGenerator'

export interface RelatorioContestacaoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  disputes: MLReputationDispute[]
  userName?: string
  storeName?: string
}

export function RelatorioContestacaoModal({
  open,
  onOpenChange,
  disputes,
  userName = 'Responsável Operacional (INFOPRECOBAIXO)',
  storeName = 'INFOPRECOBAIXO',
}: RelatorioContestacaoModalProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [pdfProgress, setPdfProgress] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview' | 'text'>('preview')

  const nowFormatted = useMemo(() => {
    return new Date().toLocaleString('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
  }, [])

  const dateFileTag = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}`
  }, [])

  // Métricas de resumo executivo
  const summary = useMemo(() => {
    const total = disputes.length
    const withDefense = disputes.filter((d) => Boolean(d.defense_text?.trim())).length
    const withoutDefense = total - withDefense

    // Agrupamento por status de exclusão ML
    const byExclusion: Record<string, number> = {}
    disputes.forEach((d) => {
      const status = d.exclusion_status || 'Não informada'
      byExclusion[status] = (byExclusion[status] || 0) + 1
    })

    // Agrupamento por status do caso
    const byDisputeStatus: Record<string, number> = {}
    disputes.forEach((d) => {
      const st = d.dispute_status || 'Para redigir'
      byDisputeStatus[st] = (byDisputeStatus[st] || 0) + 1
    })

    return {
      total,
      withDefense,
      withoutDefense,
      byExclusion,
      byDisputeStatus,
    }
  }, [disputes])

  // Formatação em texto simples para WhatsApp/chat com atendente do ML
  const formattedText = useMemo(() => {
    const lines: string[] = []
    lines.push(`📄 *RELATÓRIO DE CONTESTAÇÃO DE REPUTAÇÃO - MERCADO LIVRE*`)
    lines.push(`🏢 *Loja / Conta:* ${storeName}`)
    lines.push(`📅 *Data de Emissão:* ${nowFormatted}`)
    lines.push(`👤 *Responsável:* ${userName}`)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(
      `📊 *RESUMO EXECUTIVO:* ${summary.total} venda(s) reclamada(s) selecionada(s) para revisão`,
    )
    if (summary.withoutDefense > 0) {
      lines.push(
        `⚠️ *Atenção:* ${summary.withoutDefense} caso(s) constam sem defesa preenchida detalhada.`,
      )
    }
    lines.push(`Exclusões por status:`)
    Object.entries(summary.byExclusion).forEach(([k, v]) => {
      lines.push(`  • ${k}: ${v} caso(s)`)
    })
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

    disputes.forEach((d, idx) => {
      lines.push(`*CASO #${idx + 1} | VENDA #${d.sale_id_ml}*`)
      lines.push(`• *Data da Venda:* ${d.sale_date || 'Não informada'}`)
      lines.push(`• *Produto:* ${d.product_title || 'Equipamento'}`)
      if (d.claim_id) {
        lines.push(`• *Nº Reclamação (Claim):* #${d.claim_id}`)
      }
      lines.push(
        `• *Cliente:* ${d.customer_name || d.customer_nickname || 'Comprador'}${
          d.customer_phone ? ` | Contato: ${d.customer_phone}` : ''
        }`,
      )
      lines.push(`• *Status Exclusão ML:* ${d.exclusion_status || 'Não solicitada'}`)
      if (d.exclusion_detail) {
        lines.push(`  ↳ Detalhe ML: ${d.exclusion_detail}`)
      }
      lines.push(`• *Status Interno:* ${d.dispute_status || 'Para redigir'}`)
      lines.push(
        `• *Alegação do Cliente:* ${d.claim_reason?.trim() ? d.claim_reason : 'Não detalhada'}`,
      )
      lines.push(
        `• *DEFESA DO VENDEDOR:*\n${
          d.defense_text?.trim()
            ? d.defense_text.trim()
            : '(Defesa a preencher pelo operador da conta)'
        }`,
      )
      if (d.contact_history?.trim()) {
        lines.push(`• *Histórico de Contato / Protocolos:* ${d.contact_history.trim()}`)
      }
      lines.push(`────────────────────────────────────\n`)
    })

    lines.push(`*Finalidade:* Pedido de exclusão de impacto em reputação por suporte humano ML.`)
    lines.push(`*Emitido por:* ${userName} | ${storeName}`)
    return lines.join('\n')
  }, [disputes, storeName, userName, nowFormatted, summary])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText)
      setCopied(true)
      toast({
        title: 'Relatório copiado!',
        description:
          'Texto formatado copiado com sucesso. Pronto para colar no WhatsApp ou chat do atendente do Mercado Livre.',
      })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar automaticamente para a área de transferência.',
        variant: 'destructive',
      })
    }
  }

  const handleDownloadPdf = async () => {
    if (disputes.length === 0) return
    setDownloadingPdf(true)
    setPdfProgress('Iniciando geração...')
    try {
      const filename = `Relatorio-Contestacao-Reputacao-${dateFileTag}.pdf`
      await downloadReputationReportPdf({
        elementId: 'relatorio-contestacao-pdf-doc',
        filename,
        onProgress: (_prog, label) => setPdfProgress(label),
      })
      toast({
        title: 'PDF gerado com sucesso!',
        description: `Arquivo salvo como ${filename}`,
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Falha ao gerar PDF',
        description: err.message || 'Ocorreu um erro durante a renderização do PDF.',
        variant: 'destructive',
      })
    } finally {
      setDownloadingPdf(false)
      setPdfProgress('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-200 bg-slate-50/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 text-orange-700 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>Relatório de Contestação de Reputação</span>
                  <Badge className="bg-orange-600 hover:bg-orange-600 text-white font-normal text-xs">
                    {disputes.length} caso{disputes.length !== 1 ? 's' : ''} selecionado
                    {disputes.length !== 1 ? 's' : ''}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Documento formal consolidado com defesas, alegações e dados dos pedidos para envio
                  ao atendente do Mercado Livre.
                </DialogDescription>
              </div>
            </div>

            {/* Alternador de visualização (A4 x Texto) */}
            <div className="flex items-center gap-1.5 self-start sm:self-center bg-slate-200/80 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Visualizar A4
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'text'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                Texto Formatado (WhatsApp/Chat)
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Alerta de defesas em branco se houver */}
        {summary.withoutDefense > 0 && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Atenção:</strong> {summary.withoutDefense} dos {summary.total} casos
              selecionados ainda não possuem o texto da defesa redigido. Eles foram incluídos com o
              indicativo <em>"(Defesa a preencher)"</em>.
            </span>
          </div>
        )}

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
          {activeTab === 'preview' ? (
            /* VISUALIZAÇÃO A4 FORMAL (renderizada na DOM para ser capturada pelo html2pdf) */
            <div className="flex justify-center">
              <div
                id="relatorio-contestacao-pdf-doc"
                className="w-full max-w-[820px] bg-white text-slate-900 shadow-md border border-slate-200 rounded-sm p-6 sm:p-10 font-sans text-xs leading-relaxed"
                style={{ minHeight: '1050px' }}
              >
                {/* Cabeçalho do Relatório */}
                <div className="report-header-block border-b-2 border-orange-500 pb-4 mb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-sm bg-orange-600" />
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                          Relatório de Contestação de Reputação
                        </h1>
                      </div>
                      <p className="text-slate-500 text-xs mt-1">
                        Dossiê consolidado de pedidos afetados para análise de exclusão humana junto
                        ao Mercado Livre
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-xs">
                        <Building2 className="w-3.5 h-3.5 text-orange-600" />
                        <span>{storeName}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                        <Calendar className="w-3 h-3" />
                        {nowFormatted}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resumo Executivo */}
                <div className="report-summary-block bg-slate-50 border border-slate-200 rounded-md p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-orange-600" />
                      Resumo Executivo da Demanda
                    </h2>
                    <span className="text-[11px] text-slate-500">
                      Total de Vendas Reclamadas:{' '}
                      <strong className="text-slate-900">{summary.total}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase block">
                        Defesas Prontas
                      </span>
                      <span className="text-base font-bold text-emerald-700">
                        {summary.withDefense}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase block">
                        Defesas Pendentes
                      </span>
                      <span className="text-base font-bold text-amber-700">
                        {summary.withoutDefense}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase block">
                        Não Solicitadas
                      </span>
                      <span className="text-base font-bold text-slate-800">
                        {summary.byExclusion['Nao solicitada'] || 0}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase block">
                        Recusadas / Mediação
                      </span>
                      <span className="text-base font-bold text-rose-700">
                        {(summary.byExclusion['Recusada'] || 0) +
                          (summary.byExclusion['Mediacao'] || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista Detalhada de Casos */}
                <div className="space-y-4 mb-6">
                  {disputes.map((dispute, index) => {
                    const hasDefense = Boolean(dispute.defense_text?.trim())

                    return (
                      <div
                        key={dispute.id}
                        className="report-case-card border border-slate-300 rounded-md p-4 bg-white shadow-xs break-inside-avoid"
                      >
                        {/* Topo do Card */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[10px]">
                              {index + 1}
                            </span>
                            <span className="font-mono font-bold text-sm text-blue-700">
                              Venda #{dispute.sale_id_ml}
                            </span>
                            {dispute.sale_date && (
                              <span className="text-slate-500 text-xs">• {dispute.sale_date}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-slate-50 text-slate-700 border-slate-300"
                            >
                              Status ML: {dispute.exclusion_status || 'Não solicitada'}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-orange-50 text-orange-800 border-orange-300"
                            >
                              {dispute.dispute_status || 'Para redigir'}
                            </Badge>
                          </div>
                        </div>

                        {/* Metadados: Produto, Cliente e Reclamação */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-xs bg-slate-50/70 p-2.5 rounded border border-slate-200">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">
                              Produto
                            </span>
                            <p className="font-semibold text-slate-900">
                              {dispute.product_title || 'Equipamento'}
                            </p>
                            {dispute.reputation_impact && (
                              <span className="text-[11px] text-rose-600 font-medium">
                                Impacto: {dispute.reputation_impact}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">
                              Cliente / Contato
                            </span>
                            <div className="font-medium text-slate-800 flex items-center gap-2 flex-wrap">
                              <span>
                                {dispute.customer_name ||
                                  dispute.customer_nickname ||
                                  'Não identificado'}
                              </span>
                              {dispute.customer_phone && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                                  <Phone className="w-3 h-3" />
                                  {dispute.customer_phone}
                                </span>
                              )}
                            </div>
                            {dispute.claim_id && (
                              <span className="text-[11px] text-slate-600 block mt-0.5">
                                Reclamação ML: <strong>#{dispute.claim_id}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* O que o cliente alega */}
                        <div className="mb-3">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                            Alegação do Comprador
                          </span>
                          <div className="bg-slate-100 p-2.5 rounded border border-slate-200 text-slate-800 text-xs">
                            {dispute.claim_reason?.trim() ? (
                              dispute.claim_reason
                            ) : (
                              <span className="text-slate-400 italic">
                                Alegação não especificada
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Defesa redigida */}
                        <div>
                          <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1 mb-1">
                            <Sparkles className="w-3 h-3" />
                            Defesa da Reputação (Argumentação ao Atendente)
                          </span>
                          <div
                            className={`p-3 rounded border text-xs leading-relaxed whitespace-pre-line ${
                              hasDefense
                                ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-normal'
                                : 'bg-slate-50 border-dashed border-slate-300 text-slate-400 italic'
                            }`}
                          >
                            {hasDefense
                              ? dispute.defense_text
                              : 'Defesa ainda não redigida pelo vendedor. Caso incluído para análise preliminar de exclusão.'}
                          </div>
                        </div>

                        {/* Histórico de contato se houver */}
                        {dispute.contact_history && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Histórico de Contato / Protocolos:
                            </span>
                            <p className="mt-0.5 text-slate-600 italic">
                              {dispute.contact_history}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Rodapé do Relatório */}
                <div className="report-footer-block border-t-2 border-slate-300 pt-4 mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-slate-500 break-inside-avoid">
                  <div>
                    <p className="font-semibold text-slate-700">Conta Mercado Livre: {storeName}</p>
                    <p>Documento oficial interno para suporte telefônico / WhatsApp do ML</p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="flex items-center sm:justify-end gap-1 font-semibold text-slate-800">
                      <User className="w-3.5 h-3.5 text-orange-600" />
                      {userName}
                    </p>
                    <p>Emissão: {nowFormatted}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TEXTO FORMATADO (Área para cópia rápida com WhatsApp) */
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-orange-600" />
                  Texto pronto para WhatsApp / Chat com atendente
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-8 text-xs gap-1.5 border-slate-300"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copiado!' : 'Copiar Texto'}
                </Button>
              </div>

              <textarea
                readOnly
                rows={18}
                value={formattedText}
                className="w-full bg-white border border-slate-300 rounded-md p-3 font-mono text-xs text-slate-800 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <p className="text-[11px] text-slate-500">
                Este formato já contém quebras de linha e destaques em negrito padrão do WhatsApp
                para facilitar a leitura pelo atendente do Mercado Livre durante o contato.
              </p>
            </div>
          )}
        </div>

        {/* Footer com botões de ação */}
        <DialogFooter className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 self-start sm:self-center">
            {summary.total} caso{summary.total !== 1 ? 's' : ''} incluso
            {summary.total !== 1 ? 's' : ''} no relatório.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Fechar
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="text-xs gap-1.5 border-slate-300 text-slate-800 hover:bg-slate-100"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? 'Copiado!' : 'Copiar Relatório'}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || disputes.length === 0}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              {downloadingPdf ? pdfProgress || 'Gerando PDF...' : 'Baixar PDF'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
