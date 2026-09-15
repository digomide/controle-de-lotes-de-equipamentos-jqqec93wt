import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  FileCode2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Calendar,
  Building,
  User,
  ShoppingBag,
} from 'lucide-react'
import type { NFInvoice } from '@/services/nfService'
import { FocusPayloadActions } from '@/components/FocusPayloadActions'
import { formatFocusPayload, buildFocusPayloadFilename } from '@/utils/focusPayload'

export interface InvoiceDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: NFInvoice | null
  onConsultStatus?: (invoice: NFInvoice) => void
  consulting?: boolean
}

export function InvoiceDetailModal({
  open,
  onOpenChange,
  invoice,
  onConsultStatus,
  consulting = false,
}: InvoiceDetailModalProps) {
  const [activeView, setActiveView] = useState<'details' | 'json'>('details')

  if (!invoice) return null

  const formattedPayload = formatFocusPayload(invoice.focus_payload)
  const hasPayload = Boolean(formattedPayload && formattedPayload.trim().length > 0)
  const filename = buildFocusPayloadFilename(invoice.ref)

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {invoice.numero ? `NF-e #${invoice.numero}` : 'Nota Fiscal'}
                </DialogTitle>
                {getStatusBadge(invoice.status)}
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5 font-mono">
                Ref: {invoice.ref} · Série: {invoice.serie || '2'}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right font-mono">
                <span className="text-base font-black text-slate-900">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(invoice.valor_total || 0)}
                </span>
                <span className="block text-[10px] text-slate-400">
                  {new Date(invoice.created).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Banner com botões de Payload caso o suporte peça */}
        {hasPayload && (
          <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                <FileCode2 className="w-4 h-4 text-blue-600" />
                <span>Payload de Envio à API Focus NFe</span>
              </div>
              <p className="text-[11px] text-blue-800">
                Arquivo solicitado pelo suporte técnico Danilo / Focus para análise de pendências:{' '}
                <strong className="font-mono">{filename}</strong>
              </p>
            </div>

            <FocusPayloadActions
              payload={invoice.focus_payload}
              refCode={invoice.ref}
              variant="detail"
            />
          </div>
        )}

        {/* Abas internas rápidas: Detalhes da Nota ou Visualizar JSON */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveView('details')}
            className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
              activeView === 'details'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Dados da Nota
          </button>
          {hasPayload && (
            <button
              type="button"
              onClick={() => setActiveView('json')}
              className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                activeView === 'json'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              Ver JSON Focus ({filename})
            </button>
          )}
        </div>

        {activeView === 'json' && hasPayload ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                Conteúdo exato gravado em `focus_payload`:
              </span>
              <FocusPayloadActions
                payload={invoice.focus_payload}
                refCode={invoice.ref}
                variant="inline"
              />
            </div>
            <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-[380px] leading-relaxed border border-slate-800">
              {formattedPayload}
            </pre>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Mensagem SEFAZ / Erro se houver */}
            {invoice.mensagem_sefaz && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                  invoice.status === 'rejeitada' || invoice.status === 'erro_transmissao'
                    ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                    : invoice.status === 'autorizada'
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-blue-50/80 border-blue-200 text-blue-950'
                }`}
              >
                {invoice.status === 'autorizada' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">
                    Retorno SEFAZ / Focus {invoice.status_sefaz ? `(${invoice.status_sefaz})` : ''}
                  </p>
                  <p className="font-mono text-[11px] mt-0.5 whitespace-pre-wrap">
                    {invoice.mensagem_sefaz}
                  </p>
                </div>
              </div>
            )}

            {/* Chave e DANFE */}
            {(invoice.chave_nfe || invoice.caminho_danfe) && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                {invoice.chave_nfe && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Chave de Acesso NF-e
                    </span>
                    <span className="font-mono font-semibold text-slate-800 break-all select-all">
                      {invoice.chave_nfe}
                    </span>
                  </div>
                )}
                {invoice.caminho_danfe && (
                  <div className="pt-1 flex items-center gap-2">
                    <Button
                      asChild
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-semibold"
                    >
                      <a href={invoice.caminho_danfe} target="_blank" rel="noopener noreferrer">
                        <FileText className="w-3.5 h-3.5" />
                        Abrir DANFE (PDF)
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                    {invoice.caminho_xml_nota_fiscal && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 text-xs font-semibold"
                      >
                        <a
                          href={invoice.caminho_xml_nota_fiscal}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
                          Baixar XML SEFAZ
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Destinatário & Origem */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3" /> Destinatário
                </span>
                <p className="font-bold text-slate-900">
                  {invoice.destinatario?.nome_completo || 'Sem nome informado'}
                </p>
                <p className="font-mono text-slate-600">
                  Doc: {invoice.destinatario?.cpf || invoice.destinatario?.cnpj || 'Sem documento'}
                </p>
                {invoice.destinatario?.municipio && (
                  <p className="text-slate-500">
                    {invoice.destinatario.municipio} - {invoice.destinatario.uf}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" /> Origem da Emissão
                </span>
                <p className="font-bold text-slate-900">
                  {invoice.origin_type === 'ml_order'
                    ? `Pedido Mercado Livre #${invoice.ml_order_id}`
                    : invoice.origin_type === 'sale_internal'
                      ? `Venda Interna #${invoice.sale_id}`
                      : 'Emissão Avulsa / Manual'}
                </p>
                <p className="text-slate-500">
                  Natureza: {invoice.natureza_operacao || 'Venda de Mercadorias'}
                </p>
              </div>
            </div>

            {/* Itens */}
            {invoice.itens && invoice.itens.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Itens da Nota ({invoice.itens.length})
                </span>
                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                  {invoice.itens.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 flex items-center justify-between gap-3 bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{it.descricao}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          <span>NCM: {it.ncm}</span>
                          <span>CFOP: {it.cfop}</span>
                          <span>Qtd: {it.quantidade}</span>
                        </div>
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <span className="font-bold text-slate-900 block">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(it.valor_total || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
          {invoice.status === 'processando' && onConsultStatus ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={consulting}
              onClick={() => onConsultStatus(invoice)}
              className="text-blue-700 hover:text-blue-800 gap-1.5 text-xs font-semibold"
            >
              Consultar Status na SEFAZ
            </Button>
          ) : (
            <div />
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
