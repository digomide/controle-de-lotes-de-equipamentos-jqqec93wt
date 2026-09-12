import React, { useState } from 'react'
import {
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  Loader2,
  ShieldAlert,
  Layers,
  Wand2,
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { mlQuestionsService, type MLInsightCorrectionProposal } from '@/services/mlQuestionsService'

interface MLInsightCorrectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposal: MLInsightCorrectionProposal | null
  loadingProposal: boolean
  onSuccess?: () => void
}

export function MLInsightCorrectionModal({
  open,
  onOpenChange,
  proposal,
  loadingProposal,
  onSuccess,
}: MLInsightCorrectionModalProps) {
  const [editableProposedText, setEditableProposedText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [successResult, setSuccessResult] = useState<{
    message: string
    appliedAt: string
    itemPermalink: string
  } | null>(null)

  // Atualiza texto quando a proposta carrega
  React.useEffect(() => {
    if (proposal) {
      setEditableProposedText(proposal.proposed_text || '')
      setIsEditing(false)
      setSuccessResult(null)
    }
  }, [proposal])

  // Ação explícita de aplicar correção com 1 clique
  const handleApplyCorrection = async () => {
    if (!proposal || !proposal.item_id) return
    const textToApply = editableProposedText.trim()
    if (!textToApply) {
      toast({
        variant: 'destructive',
        title: 'Texto não pode ser vazio',
        description: 'Digite o conteúdo a ser adicionado na descrição do anúncio.',
      })
      return
    }

    setApplying(true)
    try {
      const res = await mlQuestionsService.applyInsightCorrection({
        item_id: proposal.item_id,
        proposed_text: textToApply,
      })

      if (res.ok) {
        setSuccessResult({
          message: res.message || 'Descrição atualizada com sucesso no Mercado Livre!',
          appliedAt: res.applied_at || new Date().toISOString(),
          itemPermalink: res.item_permalink || proposal.item_permalink,
        })
        toast({
          title: 'Correção aplicada com sucesso!',
          description: `O anúncio ${proposal.item_id} foi atualizado no Mercado Livre. As dúvidas frequentes agora estão na descrição.`,
        })
        onSuccess?.()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao aplicar no Mercado Livre',
          description: res.error || 'Não foi possível atualizar o anúncio.',
        })
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha na aplicação',
        description:
          err?.message ||
          'Verifique a conexão com o Mercado Livre ou se o anúncio permite alteração.',
      })
    } finally {
      setApplying(false)
    }
  }

  // Visual da prévia com texto editado
  const computedFinalDescription = React.useMemo(() => {
    if (!proposal) return ''
    const prev = (proposal.current_description || '').trim()
    const added = editableProposedText.trim()
    if (!added) return prev
    if (!prev) return added
    return prev + '\n\n---\n\n' + added
  }, [proposal, editableProposedText])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>Correção de 1 Clique: Descrição do Anúncio</span>
                  <Badge className="bg-amber-500 text-slate-950 font-bold text-xs">
                    Insight Acionável
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Responde automaticamente às dúvidas recorrentes adicionando uma seção explicativa
                  ao final da descrição real no Mercado Livre.
                </DialogDescription>
              </div>
            </div>

            {proposal?.item_permalink && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 shrink-0"
                onClick={() => window.open(proposal.item_permalink, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no ML
              </Button>
            )}
          </div>
        </DialogHeader>

        {loadingProposal ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Gerando proposta de correção e consultando descrição no Mercado Livre...
            </p>
            <p className="text-xs text-muted-foreground">
              Analisando perguntas recebidas, templates compatíveis e estoque real em lote.
            </p>
          </div>
        ) : !proposal ? (
          <div className="py-16 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-sm font-semibold">Não foi possível carregar a proposta</p>
            <p className="text-xs text-muted-foreground">
              Verifique se o anúncio possui ID MLB válido e se as credenciais do ML estão ativas.
            </p>
          </div>
        ) : successResult ? (
          /* TELA DE SUCESSO APÓS APLICAÇÃO */
          <div className="py-10 px-4 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Anúncio Corrigido com Sucesso!
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                A nova seção foi concatenada à descrição oficial do anúncio no Mercado Livre via API
                sem sobrescrever o conteúdo anterior.
              </p>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border max-w-lg mx-auto text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-muted-foreground border-b pb-2">
                <span>Anúncio MLB:</span>
                <span className="font-mono font-bold text-foreground">{proposal.item_id}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground border-b pb-2">
                <span>Título:</span>
                <span className="font-semibold text-foreground truncate max-w-[280px]">
                  {proposal.item_title}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Aplicado em:</span>
                <span className="font-mono text-foreground">
                  {new Date(successResult.appliedAt).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {successResult.itemPermalink && (
                <Button
                  onClick={() => window.open(successResult.itemPermalink, '_blank')}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Conferir Anúncio Atualizado no ML
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar Janela
              </Button>
            </div>
          </div>
        ) : (
          /* CONTEÚDO PRINCIPAL: PROPOSTA & PREVIEW LADO A LADO */
          <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-2">
            {/* 1. Contexto do Produto & Perguntas Detectadas */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-foreground line-clamp-1">
                    {proposal.item_title || proposal.item_id}
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                    {proposal.item_id}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="bg-blue-600 text-white text-[10px]">
                    Estoque Real: {proposal.matching_stock} unid.
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]"
                  >
                    {proposal.total_questions} dúvidas recebidas
                  </Badge>
                </div>
              </div>

              {proposal.sample_questions && proposal.sample_questions.length > 0 && (
                <div className="text-[11px] text-muted-foreground pt-1 border-t border-amber-500/20">
                  <span className="font-semibold text-amber-900 dark:text-amber-200">
                    Dúvidas reais que originaram este insight:
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {proposal.sample_questions.map((q, idx) => (
                      <span
                        key={idx}
                        className="bg-background/80 border px-2 py-0.5 rounded text-[11px] italic"
                      >
                        "{q}"
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Aviso se já foi corrigido antes */}
            {proposal.already_corrected && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Este anúncio já recebeu uma correção em{' '}
                    <strong>
                      {proposal.last_correction?.applied_at
                        ? new Date(proposal.last_correction.applied_at).toLocaleString('pt-BR')
                        : 'data anterior'}
                    </strong>
                    . Você pode anexar uma nova atualização caso deseje.
                  </span>
                </div>
              </div>
            )}

            {/* 2. Caixa do Texto Proposto (com opção de editar antes de aplicar) */}
            <div className="space-y-2 border rounded-xl p-3.5 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-foreground">
                    Texto Gerado Automaticamente para Adicionar ao Anúncio:
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="h-7 text-xs text-amber-700 hover:text-amber-900"
                >
                  {isEditing ? 'Pronto' : 'Personalizar Texto'}
                </Button>
              </div>

              {isEditing ? (
                <Textarea
                  value={editableProposedText}
                  onChange={(e) => setEditableProposedText(e.target.value)}
                  rows={5}
                  className="text-xs font-mono leading-relaxed"
                  placeholder="Edite a proposta que será concatenada ao anúncio..."
                />
              ) : (
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap font-medium text-slate-800 dark:text-slate-200">
                  {editableProposedText}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                ℹ O texto será <strong>anexado ao final</strong> da descrição existente, separado
                por uma linha divisória (<code>---</code>), preservando 100% das fotos e do texto
                original do produto.
              </p>
            </div>

            {/* 3. PREVIEW LADO A LADO: ATUAL VS. FINAL COM DESTAQUE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Pré-Visualização Lado a Lado da Descrição
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Regra de Ouro: Nada substitui sem ação explícita
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Lado Esquerdo: Descrição Atual no ML */}
                <div className="border rounded-xl p-3.5 bg-muted/30 flex flex-col h-[280px]">
                  <div className="flex items-center justify-between pb-2 border-b mb-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      Descrição Atual do Anúncio
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {proposal.current_description ? 'Existe no ML' : 'Vazia no ML'}
                    </Badge>
                  </div>

                  <div className="flex-1 overflow-y-auto text-[11px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed bg-background/50 p-2.5 rounded-lg border">
                    {proposal.current_description?.trim() || (
                      <span className="italic text-slate-400">
                        (Anúncio sem descrição cadastrada no Mercado Livre)
                      </span>
                    )}
                  </div>
                </div>

                {/* Lado Direito: Descrição Final Combinada com Destaque */}
                <div className="border-2 border-amber-500/40 rounded-xl p-3.5 bg-amber-500/5 flex flex-col h-[280px]">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/20 mb-2">
                    <span className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      Descrição Final Após a Correção
                    </span>
                    <Badge className="bg-amber-600 text-white text-[10px]">
                      + Trecho Novo Anexado
                    </Badge>
                  </div>

                  <div className="flex-1 overflow-y-auto text-[11px] whitespace-pre-wrap font-mono leading-relaxed bg-background p-2.5 rounded-lg border space-y-2">
                    {proposal.current_description?.trim() && (
                      <div className="text-muted-foreground">
                        {proposal.current_description.trim()}
                      </div>
                    )}

                    {proposal.current_description?.trim() && (
                      <div className="text-amber-500 font-bold py-1 select-none">
                        --- [SEPARADOR VISUAL] ---
                      </div>
                    )}

                    <div className="bg-amber-500/15 border border-amber-500/40 p-2.5 rounded text-amber-950 dark:text-amber-100 font-semibold shadow-xs">
                      {editableProposedText || '(Nenhum texto inserido)'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            <span>Nenhuma alteração é feita sem seu clique de confirmação.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={applying}
            >
              Cancelar
            </Button>
            {!successResult && (
              <Button
                size="sm"
                onClick={handleApplyCorrection}
                disabled={applying || loadingProposal || !proposal || !editableProposedText.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 px-4 gap-1.5 shadow-sm"
              >
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aplicando no Mercado Livre...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Aplicar no Anúncio com 1 Clique
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
