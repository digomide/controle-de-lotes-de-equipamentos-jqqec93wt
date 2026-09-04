import React, { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import type { Product } from '@/types/inventory'
import {
  mlService,
  generateMLTitle,
  generateMLDescription,
  getProductImageUrls,
  translateMLErrorMessage,
  validateProductForML,
  ML_CATEGORIES,
  type MLStatusResponse,
  type MLCategoryAttribute,
} from '@/services/mlService'
import {
  CONDITION_TYPE_OPTIONS,
  CONDITION_GRADE_OPTIONS,
  resolveCondition,
  getMLItemCondition,
  type ConditionType,
  type ConditionGrade,
} from '@/lib/condition'
import {
  ShoppingBag,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Settings,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface SingleMLPublishModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  onPublished?: (updatedProduct: Product) => void
}

export function SingleMLPublishModal({
  isOpen,
  onClose,
  product,
  onPublished,
}: SingleMLPublishModalProps) {
  const { toast } = useToast()

  const [loadingStatus, setLoadingStatus] = useState(true)
  const [mlStatus, setMlStatus] = useState<MLStatusResponse | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Cache de atributos da categoria
  const [categoryAttributes, setCategoryAttributes] = useState<MLCategoryAttribute[]>([])

  // Campos do formulário de anúncio
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [categoryId, setCategoryId] = useState('MLB1652')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  // Condição & Grau de estado para publicação
  const [conditionType, setConditionType] = useState<ConditionType>('recondicionado')
  const [conditionGrade, setConditionGrade] = useState<ConditionGrade | undefined>('excelente')

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
      setPublishing(false)

      // Resolver valores iniciais a partir do cadastro do produto
      const resolved = resolveCondition(
        product.condition_type,
        product.condition_grade,
        product.condition,
      )
      const initialType = resolved.type
      const initialGrade =
        resolved.grade || (initialType === 'recondicionado' ? 'excelente' : undefined)

      setConditionType(initialType)
      setConditionGrade(initialGrade)

      const initialTitle = generateMLTitle(product, {
        conditionType: initialType,
        conditionGrade: initialGrade,
      })
      setTitle(initialTitle)
      setPrice(Number(product.unit_price) || 0)
      setCategoryId('MLB1652')
      setDescription(
        generateMLDescription(product, {
          conditionType: initialType,
          conditionGrade: initialGrade,
        }),
      )
      setPhotos(getProductImageUrls(product))

      // Checar status de conexão do ML e obter atributos da categoria com cache no backend
      setLoadingStatus(true)
      Promise.all([
        mlService.getStatus(),
        mlService.getCategoryAttributes('MLB1652').catch(() => []),
      ])
        .then(([st, attrs]) => {
          setMlStatus(st)
          setCategoryAttributes(attrs)
        })
        .catch(() => {
          setMlStatus(null)
          setCategoryAttributes([])
        })
        .finally(() => setLoadingStatus(false))
    }
  }, [isOpen, product])

  // Informações da opção atual
  const currentTypeOpt = CONDITION_TYPE_OPTIONS.find((t) => t.value === conditionType)
  const allowsGrade = currentTypeOpt ? currentTypeOpt.allowsGrade : false
  const requiresGrade = currentTypeOpt ? currentTypeOpt.requiresGrade : false

  // Ao alterar o tipo
  const handleTypeChange = (newType: ConditionType) => {
    setConditionType(newType)
    const opt = CONDITION_TYPE_OPTIONS.find((t) => t.value === newType)
    let newGrade: ConditionGrade | undefined = conditionGrade
    if (!opt?.allowsGrade) {
      newGrade = undefined
      setConditionGrade(undefined)
    } else if (opt?.requiresGrade && !conditionGrade) {
      newGrade = 'excelente'
      setConditionGrade('excelente')
    }

    // Atualiza automaticamente título e descrição para refletir a nova condição escolhida
    setTitle(
      generateMLTitle(product, {
        conditionType: newType,
        conditionGrade: newGrade,
      }),
    )
    setDescription(
      generateMLDescription(product, {
        conditionType: newType,
        conditionGrade: newGrade,
      }),
    )
  }

  // Ao alterar o grau
  const handleGradeChange = (newGrade?: ConditionGrade) => {
    setConditionGrade(newGrade)
    setTitle(
      generateMLTitle(product, {
        conditionType,
        conditionGrade: newGrade,
      }),
    )
    setDescription(
      generateMLDescription(product, {
        conditionType,
        conditionGrade: newGrade,
      }),
    )
  }

  // Regenerar título com a nova condição
  const handleRegenerateTitle = () => {
    setTitle(
      generateMLTitle(product, {
        conditionType,
        conditionGrade,
      }),
    )
  }

  // Validação proativa local antes de permitir o clique no botão publicar
  const localValidation = validateProductForML(product, {
    title,
    price,
    conditionType,
    conditionGrade,
    categoryAttributes,
  })

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!localValidation.eligible) {
      setErrorMessage(
        'Corrija as pendências antes de publicar:\n• ' + localValidation.reasons.join('\n• '),
      )
      return
    }

    const cleanTitle = title.trim().slice(0, 60)

    setPublishing(true)
    setPublishProgress('Enviando anúncio para processamento no servidor...')
    try {
      const res = await mlService.publish(
        {
          product_id: product.id,
          title: cleanTitle,
          price: Number(price),
          category_id: categoryId,
          description: description.trim(),
          pictures: photos,
          condition_type: conditionType,
          condition_grade: conditionGrade,
        },
        (msg) => setPublishProgress(msg),
      )

      if (res.success) {
        toast({
          title: 'Anúncio publicado com sucesso no Mercado Livre!',
          description: `ID do anúncio: ${res.ml_listing_id}`,
        })

        if (onPublished) {
          onPublished({
            ...product,
            condition_type: conditionType,
            condition_grade: conditionGrade,
            ml_listing_id: res.ml_listing_id,
            ml_listing_url: res.ml_listing_url,
            ml_listing_status: res.ml_listing_status,
            ml_published_at: new Date().toISOString(),
          })
        }
        onClose()
      } else {
        const friendly = translateMLErrorMessage(res.error || '')
        setErrorMessage(friendly)
      }
    } catch (err: any) {
      console.error('Erro na publicação ML:', err)
      const rawMsg =
        err?.data?.error || err?.message || 'Erro ao comunicar com a API do Mercado Livre.'
      const msg = translateMLErrorMessage(rawMsg)
      setErrorMessage(msg)
    } finally {
      setPublishProgress(null)
      setPublishing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ffe600] border border-amber-400 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Anunciar Equipamento no Mercado Livre
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Revise os dados antes do envio oficial para o catálogo do Mercado Livre
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
                Para publicar anúncios automaticamente, você precisa vincular sua conta do Mercado
                Livre em Configurações.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Como funciona:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Crie um App gratuito no portal developers.mercadolivre.com.br;</li>
                <li>Cadastre o Client ID e Secret na tela de Configurações do sistema;</li>
                <li>Clique em Conectar e autorize o acesso da loja à sua conta ML.</li>
              </ul>
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
          /* Formulário de Revisão do Anúncio */
          <form onSubmit={handlePublish} className="space-y-4 text-xs pt-1">
            {/* Aviso de Conta Conectada */}
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Conectado como <strong>{mlStatus.nickname || 'Vendedor ML'}</strong>
              </span>
              <span className="text-[11px] text-emerald-700 font-mono">Conta Oficial</span>
            </div>

            {/* Mensagem de Erro da API se houver */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="font-bold">Não foi possível publicar no Mercado Livre:</p>
                  <div className="text-[11px] leading-relaxed whitespace-pre-line">
                    {errorMessage}
                  </div>
                </div>
              </div>
            )}

            {/* Seleção de Condição ML (Tipo de Produto & Grau de Estado) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Condição do Equipamento no Mercado Livre
                </span>
                <span className="text-[10px] text-slate-500">
                  API: <code>{getMLItemCondition(conditionType)}</code>
                  {conditionGrade && allowsGrade && (
                    <>
                      {' · '}
                      <code>ITEM_GRADE: {conditionGrade}</code>
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tipo de Produto */}
                <div className="space-y-1">
                  <Label className="text-slate-700 font-semibold">Tipo de Produto *</Label>
                  <Select
                    value={conditionType}
                    onValueChange={(val: ConditionType) => handleTypeChange(val)}
                  >
                    <SelectTrigger className="text-xs bg-white h-9">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          <div className="flex flex-col text-left py-0.5">
                            <span className="font-semibold text-slate-900">{opt.label}</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              {opt.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Grau de Estado */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-700 font-semibold">
                      Grau de Estado {requiresGrade && <span className="text-orange-600">*</span>}
                    </Label>
                    <span className="text-[10px] text-slate-400">
                      {requiresGrade
                        ? 'Obrigatório (Recondicionado)'
                        : allowsGrade
                          ? 'Opcional (Usado)'
                          : 'Não aplicável'}
                    </span>
                  </div>
                  <Select
                    value={conditionGrade || 'none'}
                    onValueChange={(val: string) =>
                      handleGradeChange(val === 'none' ? undefined : (val as ConditionGrade))
                    }
                    disabled={!allowsGrade}
                  >
                    <SelectTrigger
                      className={`text-xs bg-white h-9 ${
                        !allowsGrade ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''
                      }`}
                    >
                      <SelectValue
                        placeholder={
                          !allowsGrade ? 'Não aplicável para este tipo' : 'Selecione o grau...'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {!requiresGrade && (
                        <SelectItem value="none" className="text-xs text-slate-500 italic">
                          Sem grau definido
                        </SelectItem>
                      )}
                      {CONDITION_GRADE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          <div className="flex flex-col text-left py-0.5">
                            <span className="font-semibold text-slate-900">{opt.label}</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              {opt.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dica oficial ML do tipo selecionado */}
              <p className="text-[11px] text-slate-500 leading-relaxed bg-white/70 p-2 rounded border border-slate-200/60">
                {currentTypeOpt?.description}
                {allowsGrade && conditionGrade && (
                  <>
                    {' — '}
                    <strong>
                      {CONDITION_GRADE_OPTIONS.find((g) => g.value === conditionGrade)?.label}:
                    </strong>{' '}
                    {CONDITION_GRADE_OPTIONS.find((g) => g.value === conditionGrade)?.description}
                  </>
                )}
              </p>
            </div>

            {/* Título do Anúncio (máximo 60 caracteres, editável pelo usuário com contador) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700 font-semibold flex items-center gap-2">
                  <span>Título do Anúncio (máx. 60 caracteres) *</span>
                  <button
                    type="button"
                    onClick={handleRegenerateTitle}
                    className="text-[10px] text-blue-600 hover:underline font-normal"
                    title="Regerar sugestão de título padronizado (≤60 chars)"
                  >
                    Regerar sugestão
                  </button>
                </Label>
                <span
                  className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    title.length > 60
                      ? 'text-rose-700 bg-rose-100'
                      : 'text-emerald-700 bg-emerald-100'
                  }`}
                >
                  {title.length}/60 caracteres
                </span>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className={`text-xs bg-white h-9 ${
                  title.length > 60 ? 'border-rose-500 focus-visible:ring-rose-500' : ''
                }`}
                placeholder='Ex: Notebook Lenovo ThinkPad T580 i7 16GB SSD 256 15.6"'
                required
              />
              <p className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  Formato padronizado: "Notebook" + Marca + Modelo + Processador + RAM + SSD + Tela
                </span>
                {title.length > 60 && (
                  <span className="text-rose-600 font-semibold">
                    Excede 60 caracteres! Reduza para publicar.
                  </span>
                )}
              </p>
            </div>

            {/* Linha com Preço, Categoria e Estoque */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-700 font-semibold">Preço de Venda (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={price || ''}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="text-xs bg-white h-9 font-mono font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-700 font-semibold">Categoria ML</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="text-xs bg-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ML_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-slate-700 font-semibold">Estoque Local</Label>
                <div className="h-9 px-3 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-between text-slate-700">
                  <Badge variant="outline" className="bg-white text-slate-800 text-[11px]">
                    Pronto para envio
                  </Badge>
                  <span className="text-[11px] font-mono">1 un</span>
                </div>
              </div>
            </div>

            {/* Fotos que serão enviadas */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold flex items-center justify-between">
                <span>Fotos do Anúncio ({photos.length})</span>
                <span className="text-[11px] text-slate-400">URLs públicas do equipamento</span>
              </Label>
              {photos.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Nenhuma foto cadastrada. O Mercado Livre exige pelo menos 1 imagem válida.
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {photos.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-14 rounded-md overflow-hidden border border-slate-200 shrink-0 bg-white shadow-2xs group"
                    >
                      <img
                        src={url}
                        alt={`Foto ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).src =
                            'https://img.usecurling.com/p/200/200?q=laptop'
                        }}
                      />
                      <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[9px] px-1 rounded-tl">
                        #{i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Descrição do Anúncio */}
            <div className="space-y-1">
              <Label className="text-slate-700 font-semibold flex items-center justify-between">
                <span>Descrição Completa (Texto Puro)</span>
                <span className="text-[11px] text-slate-400">Editável para este anúncio</span>
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                className="text-xs bg-white font-mono leading-relaxed"
                placeholder="Detalhes, especificações e contato..."
              />
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Texto neutro e seguro sem dados de contato, em conformidade com as regras do Mercado
                Livre.
              </p>
            </div>

            {/* Alerta de Validação Proativa se houver pendências locais */}
            {!localValidation.eligible && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5 text-amber-900">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Pendências para publicar no Mercado Livre:
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800">
                  {localValidation.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                <p className="text-[10px] text-amber-700 italic pt-0.5">
                  Ajuste o título, preço ou condição acima para liberar o botão de publicação.
                </p>
              </div>
            )}

            <DialogFooter className="flex sm:justify-between items-center gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={publishing}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={publishing || !localValidation.eligible}
                className="bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-sm min-w-[200px]"
              >
                {publishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {publishProgress || 'Processando no servidor...'}
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Confirmar e Publicar Anúncio
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
