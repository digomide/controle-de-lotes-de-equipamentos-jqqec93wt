import React, { useState, useEffect, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { Product } from '@/types/inventory'
import {
  mlService,
  validateProductForML,
  generateMLTitle,
  generateMLDescription,
  getProductImageUrls,
  translateMLErrorMessage,
  type MLStatusResponse,
  type MLCategoryAttribute,
} from '@/services/mlService'
import {
  CONDITION_TYPE_OPTIONS,
  CONDITION_GRADE_OPTIONS,
  resolveCondition,
  type ConditionType,
  type ConditionGrade,
} from '@/lib/condition'
import {
  ShoppingBag,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Settings,
  Layers,
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface BatchMLPublishModalProps {
  isOpen: boolean
  onClose: () => void
  selectedProducts: Product[]
  onSuccessFinished?: () => void
}

interface EditableMLItem {
  product: Product
  title: string
  price: number
  categoryId: string
  conditionType: ConditionType
  conditionGrade?: ConditionGrade
  eligible: boolean
  reasons: string[]
  status: 'idle' | 'publishing' | 'success' | 'error'
  mlItemId?: string
  mlUrl?: string
  errorMsg?: string
}

export function BatchMLPublishModal({
  isOpen,
  onClose,
  selectedProducts,
  onSuccessFinished,
}: BatchMLPublishModalProps) {
  const { toast } = useToast()

  const [loadingStatus, setLoadingStatus] = useState(true)
  const [mlStatus, setMlStatus] = useState<MLStatusResponse | null>(null)
  const [categoryAttributes, setCategoryAttributes] = useState<MLCategoryAttribute[]>([])
  const [items, setItems] = useState<EditableMLItem[]>([])
  const [isPublishingBatch, setIsPublishingBatch] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [publishFinished, setPublishFinished] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsPublishingBatch(false)
      setCurrentIndex(0)
      setPublishFinished(false)

      // Carrega status da conexão e atributos da categoria
      setLoadingStatus(true)
      Promise.all([
        mlService.getStatus(),
        mlService.getCategoryAttributes('MLB1652').catch(() => []),
      ])
        .then(([st, attrs]) => {
          setMlStatus(st)
          setCategoryAttributes(attrs)

          // Inicializa os itens com validação prévia considerando os atributos oficiais
          const list: EditableMLItem[] = selectedProducts.map((p) => {
            const resolved = resolveCondition(p.condition_type, p.condition_grade, p.condition)
            const initialType = resolved.type
            const initialGrade =
              resolved.grade || (initialType === 'recondicionado' ? 'excelente' : undefined)
            const genTitle = generateMLTitle(p, {
              conditionType: initialType,
              conditionGrade: initialGrade,
            })
            const validation = validateProductForML(p, {
              title: genTitle,
              price: Number(p.unit_price) || 0,
              conditionType: initialType,
              conditionGrade: initialGrade,
              categoryAttributes: attrs,
            })

            return {
              product: p,
              title: genTitle,
              price: Number(p.unit_price) || 0,
              categoryId: 'MLB1652',
              conditionType: initialType,
              conditionGrade: initialGrade,
              eligible: validation.eligible,
              reasons: validation.reasons,
              status: 'idle',
            }
          })
          setItems(list)
        })
        .catch(() => {
          setMlStatus(null)
          setCategoryAttributes([])
        })
        .finally(() => setLoadingStatus(false))
    }
  }, [isOpen, selectedProducts])

  // Contadores
  const eligibleItems = useMemo(() => items.filter((it) => it.eligible), [items])
  const ineligibleItems = useMemo(() => items.filter((it) => !it.eligible), [items])
  const successCount = useMemo(() => items.filter((it) => it.status === 'success').length, [items])
  const errorCount = useMemo(() => items.filter((it) => it.status === 'error').length, [items])

  const handleUpdateItemTitle = (index: number, val: string) => {
    setItems((prev) => {
      const copy = [...prev]
      const current = copy[index]
      const newTitle = val
      const validation = validateProductForML(current.product, {
        title: newTitle,
        price: current.price,
        conditionType: current.conditionType,
        conditionGrade: current.conditionGrade,
        categoryAttributes,
      })

      copy[index] = {
        ...current,
        title: newTitle,
        eligible: validation.eligible,
        reasons: validation.reasons,
      }
      return copy
    })
  }

  const handleUpdateItemPrice = (index: number, val: number) => {
    setItems((prev) => {
      const copy = [...prev]
      const current = copy[index]
      const validation = validateProductForML(current.product, {
        title: current.title,
        price: val,
        conditionType: current.conditionType,
        conditionGrade: current.conditionGrade,
        categoryAttributes,
      })

      copy[index] = {
        ...current,
        price: val,
        eligible: validation.eligible,
        reasons: validation.reasons,
      }
      return copy
    })
  }

  const handleUpdateItemConditionType = (index: number, val: ConditionType) => {
    setItems((prev) => {
      const copy = [...prev]
      const current = copy[index]
      const opt = CONDITION_TYPE_OPTIONS.find((t) => t.value === val)
      let newGrade: ConditionGrade | undefined = current.conditionGrade
      if (!opt?.allowsGrade) {
        newGrade = undefined
      } else if (opt?.requiresGrade && !current.conditionGrade) {
        newGrade = 'excelente'
      }

      const updatedTitle = generateMLTitle(current.product, {
        conditionType: val,
        conditionGrade: newGrade,
      })

      const validation = validateProductForML(current.product, {
        title: updatedTitle,
        price: current.price,
        conditionType: val,
        conditionGrade: newGrade,
        categoryAttributes,
      })

      copy[index] = {
        ...current,
        conditionType: val,
        conditionGrade: newGrade,
        title: updatedTitle,
        eligible: validation.eligible,
        reasons: validation.reasons,
      }
      return copy
    })
  }

  const handleUpdateItemConditionGrade = (index: number, val?: ConditionGrade) => {
    setItems((prev) => {
      const copy = [...prev]
      const current = copy[index]

      const updatedTitle = generateMLTitle(current.product, {
        conditionType: current.conditionType,
        conditionGrade: val,
      })

      const validation = validateProductForML(current.product, {
        title: updatedTitle,
        price: current.price,
        conditionType: current.conditionType,
        conditionGrade: val,
        categoryAttributes,
      })

      copy[index] = {
        ...copy[index],
        conditionGrade: val,
        title: updatedTitle,
        eligible: validation.eligible,
        reasons: validation.reasons,
      }
      return copy
    })
  }

  // Publicação sequencial 1 a 1 via fila do servidor PocketBase
  const handleStartPublish = async () => {
    if (eligibleItems.length === 0) return

    setIsPublishingBatch(true)
    setPublishFinished(false)

    let eligibleProcessed = 0

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.eligible) continue

      eligibleProcessed++
      setCurrentIndex(eligibleProcessed - 1)

      // Marcar como publicando
      setItems((prev) => {
        const copy = [...prev]
        copy[i] = { ...copy[i], status: 'publishing' }
        return copy
      })

      try {
        const pictures = getProductImageUrls(it.product)
        const desc = generateMLDescription(it.product, {
          conditionType: it.conditionType,
          conditionGrade: it.conditionGrade,
        })

        const safeTitle = it.title.trim().slice(0, 60)
        const res = await mlService.publish({
          product_id: it.product.id,
          title: safeTitle,
          price: it.price,
          category_id: it.categoryId,
          condition_type: it.conditionType,
          condition_grade: it.conditionGrade,
          description: desc,
          pictures: pictures,
        })

        if (res.success) {
          setItems((prev) => {
            const copy = [...prev]
            copy[i] = {
              ...copy[i],
              status: 'success',
              mlItemId: res.ml_listing_id,
              mlUrl: res.ml_listing_url,
            }
            return copy
          })
        } else {
          setItems((prev) => {
            const copy = [...prev]
            copy[i] = {
              ...copy[i],
              status: 'error',
              errorMsg: translateMLErrorMessage(res.error || 'Falha ao publicar'),
            }
            return copy
          })
        }
      } catch (err: any) {
        const rawMsg = err?.data?.error || err?.message || 'Erro de comunicação com o servidor'
        setItems((prev) => {
          const copy = [...prev]
          copy[i] = {
            ...copy[i],
            status: 'error',
            errorMsg: translateMLErrorMessage(rawMsg),
          }
          return copy
        })
      }
    }

    setIsPublishingBatch(false)
    setPublishFinished(true)

    toast({
      title: 'Processamento em massa concluído!',
      description: 'Verifique os anúncios publicados e os resultados na tela.',
    })

    if (onSuccessFinished) {
      onSuccessFinished()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={isPublishingBatch ? () => {} : onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ffe600] border border-amber-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Publicação em Massa no Mercado Livre ({selectedProducts.length} itens)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Revise os títulos e preços individuais antes de enviar sequencialmente à API
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingStatus ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs">Verificando autorização do Mercado Livre...</span>
          </div>
        ) : !mlStatus?.connected ? (
          /* Estado: Mercado Livre não conectado */
          <div className="py-6 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Conta Mercado Livre não conectada
              </div>
              <p className="text-amber-800">
                Para publicar anúncios em massa, é necessário vincular sua conta nas Configurações.
              </p>
            </div>

            <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Fechar
              </Button>
              <Link to="/configuracoes">
                <Button className="bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 font-bold text-xs gap-1.5 h-9">
                  <Settings className="w-3.5 h-3.5" />
                  Ir para Configurações do Mercado Livre
                </Button>
              </Link>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Barra de Status da Fila */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">
                  Total selecionado: <strong>{items.length}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-semibold text-emerald-700">
                  Prontos para anúncio: <strong>{eligibleItems.length}</strong>
                </span>
                {ineligibleItems.length > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="font-semibold text-rose-600">
                      Não publicáveis: <strong>{ineligibleItems.length}</strong>
                    </span>
                  </>
                )}
              </div>

              {isPublishingBatch && (
                <Badge className="bg-amber-500 text-slate-950 font-bold animate-pulse gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Publicando {currentIndex + 1} de {eligibleItems.length}...
                </Badge>
              )}

              {publishFinished && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white font-bold gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {successCount} publicados
                  </Badge>
                  {errorCount > 0 && (
                    <Badge className="bg-rose-600 text-white font-bold gap-1">
                      <XCircle className="w-3 h-3" />
                      {errorCount} falhas
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Lista dos Equipamentos para Revisão */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {items.map((it, idx) => {
                const photos = getProductImageUrls(it.product)
                const firstThumb = photos[0] || 'https://img.usecurling.com/p/200/200?q=laptop'

                return (
                  <div
                    key={it.product.id}
                    className={`p-3 rounded-xl border transition-all ${
                      it.status === 'success'
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : it.status === 'error'
                          ? 'bg-rose-50/50 border-rose-300'
                          : it.status === 'publishing'
                            ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20'
                            : !it.eligible
                              ? 'bg-slate-50 border-slate-200 opacity-75'
                              : 'bg-white border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Miniatura */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <img
                          src={firstThumb}
                          alt={it.product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src =
                              'https://img.usecurling.com/p/200/200?q=laptop'
                          }}
                        />
                      </div>

                      {/* Dados editáveis */}
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {it.product.sku}
                          </span>

                          {/* Status de Publicação */}
                          {it.status === 'publishing' && (
                            <Badge className="bg-amber-500 text-slate-950 font-bold text-[10px] gap-1 animate-pulse">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              Publicando...
                            </Badge>
                          )}
                          {it.status === 'success' && (
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-emerald-600 text-white font-bold text-[10px] gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Publicado ({it.mlItemId})
                              </Badge>
                              {it.mlUrl && (
                                <a
                                  href={it.mlUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-700 font-semibold text-[11px] underline flex items-center gap-0.5"
                                >
                                  Abrir <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          )}
                          {it.status === 'error' && (
                            <Badge className="bg-rose-600 text-white font-bold text-[10px] gap-1">
                              <XCircle className="w-2.5 h-2.5" />
                              Falhou
                            </Badge>
                          )}
                          {it.status === 'idle' && !it.eligible && (
                            <Badge
                              variant="outline"
                              className="text-rose-600 border-rose-300 bg-rose-50 text-[10px]"
                            >
                              Não publicável
                            </Badge>
                          )}
                          {it.status === 'idle' && it.eligible && (
                            <Badge
                              variant="outline"
                              className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]"
                            >
                              Pronto para anúncio
                            </Badge>
                          )}
                        </div>

                        {it.eligible ? (
                          <div className="space-y-2">
                            {/* Linha 1: Título e Preço */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                              {/* Título do Anúncio */}
                              <div className="sm:col-span-3 space-y-0.5">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-slate-600 font-semibold">
                                    Título ML (máx. 60)
                                  </span>
                                  <span
                                    className={`font-mono font-bold px-1 rounded ${
                                      it.title.length > 60
                                        ? 'text-rose-700 bg-rose-100'
                                        : 'text-emerald-700 bg-emerald-100'
                                    }`}
                                  >
                                    {it.title.length}/60 chars
                                  </span>
                                </div>
                                <Input
                                  value={it.title}
                                  onChange={(e) => handleUpdateItemTitle(idx, e.target.value)}
                                  disabled={isPublishingBatch || it.status === 'success'}
                                  maxLength={100}
                                  className={`h-8 text-xs bg-white ${
                                    it.title.length > 60
                                      ? 'border-rose-500 focus-visible:ring-rose-500'
                                      : ''
                                  }`}
                                />
                              </div>

                              {/* Preço de Venda */}
                              <div className="space-y-0.5">
                                <div className="text-[10px] text-slate-400">Preço (R$)</div>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={it.price || ''}
                                  onChange={(e) =>
                                    handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)
                                  }
                                  disabled={isPublishingBatch || it.status === 'success'}
                                  className="h-8 text-xs font-mono font-bold bg-white"
                                />
                              </div>
                            </div>

                            {/* Linha 2: Tipo de Produto e Grau de Estado */}
                            {(() => {
                              const typeOpt = CONDITION_TYPE_OPTIONS.find(
                                (t) => t.value === it.conditionType,
                              )
                              const allows = typeOpt ? typeOpt.allowsGrade : false
                              const requires = typeOpt ? typeOpt.requiresGrade : false

                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/80 p-2 rounded-md border border-slate-200">
                                  <div className="space-y-0.5">
                                    <div className="text-[10px] text-slate-500 font-semibold">
                                      Tipo de Produto ML
                                    </div>
                                    <Select
                                      value={it.conditionType}
                                      onValueChange={(val: ConditionType) =>
                                        handleUpdateItemConditionType(idx, val)
                                      }
                                      disabled={isPublishingBatch || it.status === 'success'}
                                    >
                                      <SelectTrigger className="h-7 text-xs bg-white">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {CONDITION_TYPE_OPTIONS.map((opt) => (
                                          <SelectItem
                                            key={opt.value}
                                            value={opt.value}
                                            className="text-xs"
                                          >
                                            {opt.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-0.5">
                                    <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-between">
                                      <span>Grau de Estado</span>
                                      <span className="text-[9px] text-slate-400">
                                        {requires
                                          ? 'Obrigatório'
                                          : allows
                                            ? 'Opcional'
                                            : 'Não aplicável'}
                                      </span>
                                    </div>
                                    <Select
                                      value={it.conditionGrade || 'none'}
                                      onValueChange={(val: string) =>
                                        handleUpdateItemConditionGrade(
                                          idx,
                                          val === 'none' ? undefined : (val as ConditionGrade),
                                        )
                                      }
                                      disabled={
                                        !allows || isPublishingBatch || it.status === 'success'
                                      }
                                    >
                                      <SelectTrigger
                                        className={`h-7 text-xs bg-white ${
                                          !allows ? 'opacity-60 bg-slate-100' : ''
                                        }`}
                                      >
                                        <SelectValue
                                          placeholder={
                                            !allows ? 'Não aplicável' : 'Selecione o grau...'
                                          }
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {!requires && (
                                          <SelectItem
                                            value="none"
                                            className="text-xs text-slate-400 italic"
                                          >
                                            Sem grau
                                          </SelectItem>
                                        )}
                                        {CONDITION_GRADE_OPTIONS.map((opt) => (
                                          <SelectItem
                                            key={opt.value}
                                            value={opt.value}
                                            className="text-xs"
                                          >
                                            {opt.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        ) : (
                          /* Motivos de inelegibilidade */
                          <div className="p-2 bg-rose-50/70 border border-rose-200 rounded text-[11px] text-rose-800 space-y-0.5">
                            <p className="font-semibold">{it.product.name}</p>
                            <ul className="list-disc pl-4 text-[10px] space-y-0.5">
                              {it.reasons.map((r, ri) => (
                                <li key={ri}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {it.status === 'error' && it.errorMsg && (
                          <div className="text-[11px] text-rose-700 bg-rose-100/60 p-2 rounded whitespace-pre-line leading-relaxed">
                            {it.errorMsg}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <DialogFooter className="flex sm:justify-between items-center gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isPublishingBatch}
              >
                {publishFinished ? 'Fechar' : 'Cancelar'}
              </Button>

              <Button
                type="button"
                onClick={handleStartPublish}
                disabled={isPublishingBatch || eligibleItems.length === 0 || publishFinished}
                className="bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-sm"
              >
                {isPublishingBatch ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Publicando {currentIndex + 1} de {eligibleItems.length}...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Publicar {eligibleItems.length}{' '}
                    {eligibleItems.length === 1 ? 'Anúncio' : 'Anúncios'} no ML
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
