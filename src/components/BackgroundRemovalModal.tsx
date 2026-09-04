import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Wand2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Download,
  Info,
} from 'lucide-react'
import {
  removeBackgroundClientSide,
  type BackgroundRemovalProgress,
  type RemoveBackgroundResult,
} from '@/lib/backgroundRemoval'

interface BackgroundRemovalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalImageUrl: string
  photoIndex: number
  equipmentName?: string
  /**
   * Chamado quando o usuário clica em 'Salvar e Substituir Imagem'
   */
  onSaveProcessedPhoto: (
    newFile: File,
    photoIndex: number,
    replaceOriginal: boolean,
  ) => Promise<void>
}

export function BackgroundRemovalModal({
  open,
  onOpenChange,
  originalImageUrl,
  photoIndex,
  equipmentName = 'Equipamento',
  onSaveProcessedPhoto,
}: BackgroundRemovalModalProps) {
  const { toast } = useToast()
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState<BackgroundRemovalProgress | null>(null)
  const [result, setResult] = useState<RemoveBackgroundResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [replaceMode, setReplaceMode] = useState<boolean>(true) // substituir foto atual ou adicionar como nova

  const startProcessing = async () => {
    setProcessing(true)
    setError(null)
    setResult(null)
    setProgress({
      key: 'start',
      current: 0,
      total: 100,
      percentage: 5,
      message: 'Iniciando IA no navegador...',
    })

    try {
      const res = await removeBackgroundClientSide(originalImageUrl, {
        minDimension: 1200, // Requisito do Mercado Livre
        quality: 0.92,
        onProgress: (p) => {
          setProgress(p)
        },
      })
      setResult(res)
      toast({
        title: 'Fundo branco gerado!',
        description:
          'O notebook foi isolado com fundo branco puro (#FFFFFF) no padrão do Mercado Livre.',
      })
    } catch (err: any) {
      console.error('Erro na remoção de fundo com IA:', err)
      const msg =
        err?.message ||
        'Falha ao processar a imagem com IA. Verifique sua conexão ou tente outra foto.'
      setError(msg)
      toast({
        title: 'Falha no processamento',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleClose = () => {
    if (processing) return
    if (result?.previewUrl) {
      try {
        URL.revokeObjectURL(result.previewUrl)
      } catch {
        /* intentionally ignored */
      }
    }
    setResult(null)
    setError(null)
    setProgress(null)
    onOpenChange(false)
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const fileName = `notebook_ml_bg_white_${Date.now()}.jpg`
      const processedFile = new File([result.blob], fileName, {
        type: 'image/jpeg',
      })
      await onSaveProcessedPhoto(processedFile, photoIndex, replaceMode)
      toast({
        title: 'Foto salva com sucesso!',
        description: replaceMode
          ? `A foto #${photoIndex + 1} foi substituída pela versão com fundo branco.`
          : 'A nova foto com fundo branco foi adicionada à galeria.',
      })
      handleClose()
    } catch (err: any) {
      console.error('Erro ao salvar foto:', err)
      toast({
        title: 'Erro ao salvar foto',
        description: err?.message || 'Não foi possível enviar a imagem atualizada.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Wand2 className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Remoção de Fundo com IA (Fundo Branco Mercado Livre)
                  <Badge className="bg-indigo-600 text-white text-[10px] gap-1 font-semibold">
                    <Sparkles className="w-3 h-3" /> No Navegador
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Processamento 100% no seu dispositivo via WebAssembly / ONNX. Gera fundo branco
                  puro (#FFFFFF) em alta resolução (1200x1200px) exigido pelo Mercado Livre.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Informações do requisito Mercado Livre */}
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center gap-2.5 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <p>
            <strong>Requisito ML:</strong> A foto principal do anúncio deve ter fundo branco puro
            (#FFFFFF) sem elementos de fundo, sombras fortes ou marcas d'água, com mínimo de
            1200x1200 pixels.
          </p>
        </div>

        {/* Visualizador Antes / Depois */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {/* Lado Esquerdo: Original */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                Foto Original (#{photoIndex + 1})
              </span>
              <Badge variant="outline" className="text-[10px] text-slate-500">
                Entrada
              </Badge>
            </div>
            <div className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center p-2 relative shadow-xs">
              <img
                src={originalImageUrl}
                alt="Foto Original"
                className="max-h-full max-w-full object-contain rounded"
              />
            </div>
          </div>

          {/* Lado Direito: Resultado Processado com Fundo Branco */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                Resultado com Fundo Branco
                {result && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    #FFFFFF 1200x1200px
                  </Badge>
                )}
              </span>
              {result && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {(result.size / 1024).toFixed(0)} KB
                </span>
              )}
            </div>

            <div className="aspect-square rounded-xl overflow-hidden border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-3 relative shadow-xs">
              {result ? (
                <div className="w-full h-full flex items-center justify-center bg-white border border-slate-100 rounded">
                  <img
                    src={result.previewUrl}
                    alt="Resultado com Fundo Branco"
                    className="max-h-full max-w-full object-contain"
                  />
                  <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded font-mono shadow">
                    {result.width} × {result.height} px
                  </div>
                </div>
              ) : processing ? (
                <div className="text-center p-6 space-y-3 w-full max-w-xs">
                  <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">
                      {progress?.message || 'Processando imagem com inteligência artificial...'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Pode levar cerca de 20 a 30 segundos no primeiro carregamento do modelo.
                    </p>
                  </div>
                  <Progress value={progress?.percentage || 15} className="h-2" />
                  <span className="text-[10px] font-mono text-slate-400 block">
                    {progress?.percentage || 15}% concluído
                  </span>
                </div>
              ) : error ? (
                <div className="text-center p-6 space-y-2 text-rose-600">
                  <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
                  <p className="text-xs font-bold text-rose-800">Falha ao processar imagem</p>
                  <p className="text-[11px] text-rose-600 max-w-xs">{error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startProcessing}
                    className="mt-2 text-xs border-rose-300 text-rose-700"
                  >
                    Tentar Novamente
                  </Button>
                </div>
              ) : (
                <div className="text-center p-6 space-y-3 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700">Pronto para processar</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Clique em <strong>"Iniciar Remoção de Fundo"</strong> para rodar a IA
                      diretamente no seu navegador.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={startProcessing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-xs"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Iniciar Remoção de Fundo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Escolha do modo ao salvar: substituir original ou adicionar */}
        {result && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-800">Como deseja salvar a nova imagem?</span>
              <p className="text-slate-500 text-[11px]">
                Você pode substituir a foto atual na galeria ou adicioná-la como uma foto extra no
                final.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={replaceMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setReplaceMode(true)}
                className={`text-xs h-8 ${replaceMode ? 'bg-slate-900 text-white' : 'border-slate-300'}`}
              >
                Substituir foto #{photoIndex + 1}
              </Button>
              <Button
                type="button"
                variant={!replaceMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setReplaceMode(false)}
                className={`text-xs h-8 ${!replaceMode ? 'bg-slate-900 text-white' : 'border-slate-300'}`}
              >
                Adicionar como nova foto
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={processing || saving}
            className="text-xs text-slate-500"
          >
            Cancelar
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {result ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startProcessing}
                  disabled={processing || saving}
                  className="text-xs border-slate-300 text-slate-700 gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reprocessar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-bold shadow-xs"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {replaceMode ? 'Salvar e Substituir Imagem' : 'Salvar como Nova Imagem'}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={startProcessing}
                disabled={processing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 font-bold shadow-xs"
              >
                {processing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                {processing ? 'Processando IA...' : 'Iniciar Remoção de Fundo'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
