import { useState } from 'react'
import { Copy, Download, Check, RefreshCw, FileCode2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import {
  formatFocusPayload,
  buildFocusPayloadFilename,
  copyToClipboardSafe,
  downloadJsonFile,
} from '@/utils/focusPayload'

export interface FocusPayloadActionsProps {
  payload: any
  refCode?: string
  variant?: 'compact' | 'inline' | 'detail'
  className?: string
  onOpenViewer?: () => void
}

/**
 * Componente com botões compactos e discretos para:
 * 1. Copiar JSON de envio (focus_payload formatado 2 espaços, idêntico ao gravado)
 * 2. Baixar JSON (focus_payload_<ref>.json pronto para anexar no e-mail ao suporte)
 *
 * Visual consistente com botões secundários do projeto (ex.: "Ver no ML").
 */
export function FocusPayloadActions({
  payload,
  refCode,
  variant = 'compact',
  className = '',
  onOpenViewer,
}: FocusPayloadActionsProps) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const formattedJson = formatFocusPayload(payload)
  const hasPayload = Boolean(formattedJson && formattedJson.trim().length > 0)

  if (!hasPayload) {
    return null
  }

  const filename = buildFocusPayloadFilename(refCode)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setCopyFailed(false)
    try {
      const ok = await copyToClipboardSafe(formattedJson)
      if (ok) {
        setCopied(true)
        setCopyFailed(false)
        toast({
          title: 'JSON copiado!',
          description: `Payload de envio (${filename}) copiado para a área de transferência.`,
        })
        setTimeout(() => setCopied(false), 2500)
      } else {
        setCopyFailed(true)
        toast({
          title: 'Não foi possível copiar',
          description: 'A permissão do clipboard falhou. Use o botão "Baixar JSON".',
          variant: 'destructive',
        })
      }
    } catch {
      setCopyFailed(true)
      toast({
        title: 'Erro ao copiar',
        description: 'Tente novamente ou baixe o arquivo JSON.',
        variant: 'destructive',
      })
    }
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDownloading(true)
    try {
      downloadJsonFile(filename, formattedJson)
      toast({
        title: 'Download iniciado!',
        description: `Arquivo "${filename}" pronto para anexar no e-mail de suporte da Focus.`,
      })
    } catch {
      toast({
        title: 'Erro no download',
        description: 'Não foi possível gerar o arquivo.',
        variant: 'destructive',
      })
    } finally {
      setTimeout(() => setDownloading(false), 800)
    }
  }

  // Estilo consistente com o botão "Ver no ML" de AnunciosML.tsx:
  // inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors
  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        {/* Botão Copiar */}
        <button
          type="button"
          onClick={handleCopy}
          title={
            copyFailed ? 'Falha ao copiar. Tentar novamente' : 'Copiar JSON de envio (Focus NFe)'
          }
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border transition-colors ${
            copied
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : copyFailed
                ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Copiado!</span>
            </>
          ) : copyFailed ? (
            <>
              <RefreshCw className="w-3 h-3 text-rose-600" />
              <span>Tentar copiar</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-500" />
              <span>Copiar JSON</span>
            </>
          )}
        </button>

        {/* Botão Baixar */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          title={`Baixar ${filename} para enviar por e-mail`}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Download className="w-3 h-3 text-slate-500" />
          <span>Baixar</span>
        </button>

        {/* Botão opcional para abrir visualizador completo */}
        {onOpenViewer && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenViewer()
            }}
            title="Visualizar JSON completo"
            className="inline-flex items-center p-1 text-[11px] font-medium rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <FileCode2 className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  // Variante inline com botões do shadcn (usada no detalhe da nota ou modais)
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className={`h-7 px-2.5 text-xs font-semibold gap-1.5 ${
          copied
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
            : copyFailed
              ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
              : 'text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50'
        }`}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Copiado!
          </>
        ) : copyFailed ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
            Tentar novamente
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            Copiar JSON de envio
          </>
        )}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={downloading}
        className="h-7 px-2.5 text-xs font-semibold gap-1.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50"
      >
        <Download className="w-3.5 h-3.5 text-slate-500" />
        Baixar JSON
      </Button>

      {onOpenViewer && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenViewer}
          className="h-7 px-2 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-50 font-semibold gap-1"
        >
          <FileCode2 className="w-3.5 h-3.5" />
          Ver JSON
        </Button>
      )}
    </div>
  )
}
