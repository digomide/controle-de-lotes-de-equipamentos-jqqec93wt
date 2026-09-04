import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Boxes,
  Camera,
  Upload,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Laptop,
  Layers,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { purchaseBatchesService } from '@/services/purchaseBatches'
import { productsService } from '@/services/products'
import type {
  PurchaseBatch,
  Product,
  TechnicalChecklistItem,
  ProductStatus,
  ChecklistItemStatus,
} from '@/types/inventory'
import {
  CHECKLIST_CANONICAL_ITEMS,
  CHECKLIST_OPTIONS,
  normalizeChecklistStatus,
  getChecklistStatusStyles,
} from '@/lib/checklist'
import { ProductConditionSelect } from '@/components/ProductConditionSelect'
import type { ConditionType, ConditionGrade } from '@/lib/condition'

interface ChecklistStateItem {
  item: string
  status: 'Ok' | 'Atenção' | 'Falha' | 'Não testado' | 'N/A'
  observation: string
}

export default function LoteInventariar() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  // Batches for selection dropdown
  const [allBatches, setAllBatches] = useState<PurchaseBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string>(id || '')
  const [batch, setBatch] = useState<PurchaseBatch | null>(null)
  const [batchProducts, setBatchProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Equipment Fields
  const [family, setFamily] = useState('Notebooks')
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('Lenovo')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')

  // Specs & Aesthetics
  const [processor, setProcessor] = useState('Core i5 8ª ger')
  const [ram, setRam] = useState('8GB DDR4')
  const [storage, setStorage] = useState('SSD 256GB')
  const [screenSize, setScreenSize] = useState('14"')
  const [hasNumericKeypad, setHasNumericKeypad] = useState<boolean>(false)
  const [batteryHealth, setBatteryHealth] = useState('Boa (85%)')
  const [aestheticGrade, setAestheticGrade] = useState('B - Bom')
  const [includesCharger, setIncludesCharger] = useState(true)

  // Checklist of 16 items
  const [checklist, setChecklist] = useState<ChecklistStateItem[]>(() =>
    CHECKLIST_CANONICAL_ITEMS.map((item) => ({
      item,
      status: 'Ok',
      observation: '',
    })),
  )
  const [inspectionStatus, setInspectionStatus] = useState<
    'Concluída' | 'Em andamento' | 'Pendente'
  >('Concluída')

  // Classification & Pricing
  const [conditionType, setConditionType] = useState<ConditionType>('recondicionado')
  const [conditionGrade, setConditionGrade] = useState<ConditionGrade | undefined>('bom')
  const [conditionError, setConditionError] = useState<string>('')
  const [status, setStatus] = useState<ProductStatus>('Disponível')
  const [customStatus, setCustomStatus] = useState('Em teste')
  const [costPrice, setCostPrice] = useState<number | string>(1000)
  const [unitPrice, setUnitPrice] = useState<number | string>('')

  // Notes
  const [benchNotes, setBenchNotes] = useState('')

  // Photos (up to 6)
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initial Data Load
  useEffect(() => {
    async function loadData() {
      try {
        const batches = await purchaseBatchesService.getAll()
        setAllBatches(batches)

        const currentBatchId = id || (batches[0] ? batches[0].id : '')
        if (currentBatchId) {
          setSelectedBatchId(currentBatchId)
          await loadBatchInfo(currentBatchId)
        }
      } catch (err: any) {
        console.error(err)
        toast({
          title: 'Erro ao carregar dados do lote',
          description: err?.message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  const loadBatchInfo = async (bId: string) => {
    try {
      const [b, prods] = await Promise.all([
        purchaseBatchesService.getById(bId),
        purchaseBatchesService.getProductsByBatchId(bId),
      ])
      setBatch(b)
      setBatchProducts(prods)

      // Calculate suggested unit cost: total_cost / expected_quantity
      const expQty = Number(b.expected_quantity) || 1
      const totalCost = Number(b.total_cost) || 0
      const suggestedCost = Math.round(totalCost / expQty)
      setCostPrice(suggestedCost)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSelectBatch = async (newId: string) => {
    setSelectedBatchId(newId)
    await loadBatchInfo(newId)
  }

  // Quick preset for checklist: mark all as Ok, Não testado, etc.
  const handleSetAllChecklist = (newStatus: 'Ok' | 'Não testado') => {
    setChecklist((prev) =>
      prev.map((c) => ({
        ...c,
        status: newStatus,
      })),
    )
  }

  const handleChecklistStatusChange = (
    index: number,
    val: 'Ok' | 'Atenção' | 'Falha' | 'Não testado' | 'N/A',
  ) => {
    setChecklist((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], status: normalizeChecklistStatus(val) }
      return copy
    })
  }

  const handleChecklistObsChange = (index: number, val: string) => {
    setChecklist((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], observation: val }
      return copy
    })
  }

  // Photo handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newFiles = Array.from(files)
    const combined = [...selectedPhotos, ...newFiles].slice(0, 6)
    setSelectedPhotos(combined)

    const urls = combined.map((f) => URL.createObjectURL(f))
    setPreviewUrls(urls)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = (index: number) => {
    const nextFiles = selectedPhotos.filter((_, i) => i !== index)
    setSelectedPhotos(nextFiles)
    const urls = nextFiles.map((f) => URL.createObjectURL(f))
    setPreviewUrls(urls)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedBatchId) {
      toast({
        title: 'Selecione um lote',
        description: 'É necessário selecionar o lote de origem para o equipamento.',
        variant: 'destructive',
      })
      return
    }

    if (conditionType === 'recondicionado' && !conditionGrade) {
      setConditionError('Selecione o grau de estado obrigatório para recondicionados.')
      toast({
        title: 'Grau de estado obrigatório',
        description:
          'Para produtos recondicionados, é necessário selecionar o grau (Excelente, Bom ou Aceitável).',
        variant: 'destructive',
      })
      return
    }
    setConditionError('')

    const equipmentTitle = title.trim() || `Notebook ${brand} ${model || 'Corporativo'}`.trim()

    // Determine SKU: use serial number if provided, else generate unique identifier
    const generatedSku = serialNumber.trim()
      ? serialNumber.trim().toUpperCase()
      : `SN-${brand.slice(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const code = `EQ-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`

    // Effective product status for catalog
    let effectiveProductStatus: ProductStatus = 'Disponível'
    if (customStatus === 'Reservado') effectiveProductStatus = 'Reservado'
    if (customStatus === 'Vendido') effectiveProductStatus = 'Vendido'

    setIsSubmitting(true)

    try {
      // Use FormData to support direct photo upload
      const formData = new FormData()
      formData.append('name', equipmentTitle)
      formData.append('sku', generatedSku)
      formData.append('code', code)
      formData.append('category', family)
      formData.append('brand', brand)
      formData.append('model', model)
      formData.append('serial_number', serialNumber.trim())
      formData.append('purchase_batch_id', selectedBatchId)
      formData.append('processor', processor)
      formData.append('ram', ram)
      formData.append('storage', storage)
      formData.append('screen_size', screenSize)
      formData.append('has_numeric_keypad', String(hasNumericKeypad))
      formData.append('battery_health', batteryHealth)
      formData.append('aesthetic_grade', aestheticGrade)
      formData.append('condition_type', conditionType)
      if (conditionGrade) {
        formData.append('condition_grade', conditionGrade)
      }
      const legacyCondition =
        conditionGrade === 'excelente'
          ? 'Excelente'
          : conditionGrade === 'aceitavel'
            ? 'Aceitável'
            : 'Bom'
      formData.append('condition', legacyCondition)
      formData.append('includes_charger', String(includesCharger))
      formData.append('cost_price', String(Number(costPrice) || 0))
      formData.append('unit_price', String(Number(unitPrice) || 0))
      formData.append('status', effectiveProductStatus)
      formData.append('bench_notes', benchNotes)

      // Technical checklist JSON
      formData.append('technical_checklist', JSON.stringify(checklist))

      // History events
      formData.append(
        'history_events',
        JSON.stringify([
          {
            title: 'Equipamento inventariado e inspecionado na bancada',
            date: new Date().toISOString().replace('T', ' ').substring(0, 19),
          },
        ]),
      )

      // Append up to 6 photo files
      for (const file of selectedPhotos) {
        formData.append('photos', file)
      }

      await productsService.create(formData)

      toast({
        title: 'Equipamento inventariado com sucesso!',
        description: `"${equipmentTitle}" foi vinculado ao lote e disponibilizado no catálogo.`,
      })

      // Navigate back to the batch view
      navigate(`/lotes-entrada/${selectedBatchId}`)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao inventariar equipamento',
        description: err?.message || 'Verifique se o número de série/SKU já existe.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculations for batch card
  const expectedQty = Number(batch?.expected_quantity) || 1
  const inventoriedCount = batchProducts.length
  const missingCount = Math.max(0, expectedQty - inventoriedCount)
  const batchTotalCost = Number(batch?.total_cost) || 0
  const suggestedBaseCost = expectedQty > 0 ? Math.round(batchTotalCost / expectedQty) : 0

  if (loading) {
    return (
      <div className="p-16 text-center max-w-4xl mx-auto">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-500">Carregando formulário de inventário...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-24 font-sans text-slate-900">
      {/* Top Header matching Screenshot 1 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[11px] font-bold text-orange-600 tracking-wider uppercase mb-1">
            Inventário do Lote
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Novo equipamento</h1>
          <p className="text-sm text-slate-500 mt-1">
            Teste, classifique e vincule o item ao lote recebido.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            navigate(selectedBatchId ? `/lotes-entrada/${selectedBatchId}` : '/lotes-entrada')
          }
          className="bg-white hover:bg-slate-50 border-slate-300 text-slate-700 text-xs h-9 gap-1.5 shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao lote
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Card with Warm White Background matching screenshots */}
        <div className="bg-[#faf8f5] border border-orange-100/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-7">
          {/* Section: Ficha de inventário & Lote Banner */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Ficha de inventário</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  A média do lote é sugerida como custo-base e pode ser ajustada para este item;
                  peças e serviços são somados separadamente.
                </p>
              </div>
            </div>

            {/* Lote de origem highlighted box */}
            <div className="bg-[#f5ede4]/80 border border-[#edd5c3] rounded-xl p-4 sm:p-5 space-y-3">
              <div>
                <Label
                  htmlFor="batchSelect"
                  className="text-xs font-semibold text-slate-700 block mb-1.5"
                >
                  Lote de origem *
                </Label>
                <Select value={selectedBatchId} onValueChange={handleSelectBatch}>
                  <SelectTrigger
                    id="batchSelect"
                    className="bg-white border-slate-300 text-sm font-medium h-10 w-full"
                  >
                    <SelectValue placeholder="Selecione o lote..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allBatches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.invoice_number ? `${b.invoice_number} · ` : ''}
                        {b.supplier} ({b.expected_quantity} esperados)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lote summary chips */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-[#edd5c3]/60 text-xs">
                <div className="text-slate-600">
                  Faltam <strong className="text-slate-900">{missingCount} itens</strong>
                </div>
                <div className="text-slate-600">
                  Custo do lote{' '}
                  <strong className="text-slate-900">
                    {batchTotalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </div>
                <div className="text-slate-600">
                  Custo-base por item{' '}
                  <strong className="text-orange-600 font-bold">
                    {suggestedBaseCost.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </strong>
                </div>
              </div>
            </div>

            {/* Family & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <Label htmlFor="family" className="text-xs font-semibold text-slate-700">
                  Família *
                </Label>
                <Select value={family} onValueChange={setFamily}>
                  <SelectTrigger
                    id="family"
                    className="bg-white border-slate-300 text-sm h-10 mt-1"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Notebooks">Notebooks</SelectItem>
                    <SelectItem value="Desktops">Desktops</SelectItem>
                    <SelectItem value="Monitores">Monitores</SelectItem>
                    <SelectItem value="Servidores">Servidores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="title" className="text-xs font-semibold text-slate-700">
                  Título do equipamento *
                </Label>
                <Input
                  id="title"
                  placeholder="Ex.: ThinkPad T480"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1"
                />
              </div>
            </div>

            {/* Brand & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brand" className="text-xs font-semibold text-slate-700">
                  Marca
                </Label>
                <Input
                  id="brand"
                  placeholder="Lenovo"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="model" className="text-xs font-semibold text-slate-700">
                  Modelo
                </Label>
                <Input
                  id="model"
                  placeholder="20L5"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1"
                />
              </div>
            </div>

            {/* Serial Number */}
            <div>
              <Label htmlFor="serial" className="text-xs font-semibold text-slate-700">
                Número de série
              </Label>
              <Input
                id="serial"
                placeholder="SN . . ."
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="bg-white border-slate-300 text-sm h-10 mt-1 font-mono"
              />
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Section: Especificações e Estética */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900">Especificações e Estética</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="proc" className="text-xs font-semibold text-slate-700">
                  Processador
                </Label>
                <Input
                  id="proc"
                  placeholder="Core i5 8ª ger"
                  value={processor}
                  onChange={(e) => setProcessor(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="ram" className="text-xs font-semibold text-slate-700">
                  Memória RAM
                </Label>
                <Input
                  id="ram"
                  placeholder="8GB DDR4"
                  value={ram}
                  onChange={(e) => setRam(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="storage" className="text-xs font-semibold text-slate-700">
                  Armazenamento
                </Label>
                <Input
                  id="storage"
                  placeholder="SSD 256GB"
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="screen" className="text-xs font-semibold text-slate-700">
                  Tamanho da Tela
                </Label>
                <Input
                  id="screen"
                  placeholder='14", 15.6"'
                  value={screenSize}
                  onChange={(e) => setScreenSize(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="numericKeypad" className="text-xs font-semibold text-slate-700">
                  Teclado Numérico
                </Label>
                <Select
                  value={hasNumericKeypad ? 'sim' : 'nao'}
                  onValueChange={(v) => setHasNumericKeypad(v === 'sim')}
                >
                  <SelectTrigger
                    id="numericKeypad"
                    className="bg-white border-slate-300 text-sm h-10 mt-1"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim (Possui teclado numérico)</SelectItem>
                    <SelectItem value="nao">Não (Sem teclado numérico)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <Label htmlFor="battery" className="text-xs font-semibold text-slate-700">
                  Saúde da Bateria
                </Label>
                <Input
                  id="battery"
                  placeholder="Boa (85%)"
                  value={batteryHealth}
                  onChange={(e) => setBatteryHealth(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="grade" className="text-xs font-semibold text-slate-700">
                  Grau Estético
                </Label>
                <Select value={aestheticGrade} onValueChange={setAestheticGrade}>
                  <SelectTrigger id="grade" className="bg-white border-slate-300 text-sm h-10 mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A - Excelente">A - Excelente (Sem marcas)</SelectItem>
                    <SelectItem value="B - Bom">B - Bom (Leves marcas de uso)</SelectItem>
                    <SelectItem value="C - Regular">C - Regular (Marcas visíveis)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <Checkbox
                  id="charger"
                  checked={includesCharger}
                  onCheckedChange={(checked) => setIncludesCharger(!!checked)}
                  className="border-slate-400 data-[state=checked]:bg-[#d9532f] data-[state=checked]:border-[#d9532f]"
                />
                <Label
                  htmlFor="charger"
                  className="text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Acompanha Carregador
                </Label>
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Section: Checklist de Inspeção (16 Itens em grade responsiva idêntica ao print do Replit) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-orange-100/70">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Checklist de Inspeção</h2>
                  <p className="text-xs text-slate-500">
                    16 itens de bancada com dropdown de status colorido e observação opcional.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Status geral:</span>
                  <Select
                    value={inspectionStatus}
                    onValueChange={(v: any) => setInspectionStatus(v)}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs bg-white border-slate-300 font-semibold text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Concluída">Concluída</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetAllChecklist('Ok')}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-md transition-colors"
                  >
                    Todos Ok
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllChecklist('Não testado')}
                    className="text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1.5 rounded-md transition-colors"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            {/* Grid of 16 inspection cards - exatamente como na imagem do Replit:
                Caixa com cantos arredondados, título do item em cima, dropdown colorido e input "Observação opcional" abaixo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {checklist.map((item, idx) => {
                const normStatus = normalizeChecklistStatus(item.status)
                const styles = getChecklistStatusStyles(normStatus)
                return (
                  <div
                    key={item.item}
                    className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-2 hover:border-orange-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 tracking-tight">
                        {item.item}
                      </span>
                    </div>

                    <Select
                      value={normStatus}
                      onValueChange={(val: any) => handleChecklistStatusChange(idx, val)}
                    >
                      <SelectTrigger
                        className={`h-9 text-xs font-semibold rounded-lg transition-colors ${styles.select}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {CHECKLIST_OPTIONS.map((opt) => {
                          const optStyles = getChecklistStatusStyles(opt.value)
                          return (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              className="text-xs font-medium cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${optStyles.dot}`} />
                                <span className="font-semibold">{opt.label}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="Observação opcional"
                      value={item.observation}
                      onChange={(e) => handleChecklistObsChange(idx, e.target.value)}
                      className="h-8 text-xs bg-slate-50/80 border-slate-200 text-slate-700 placeholder:text-slate-400 rounded-lg focus-visible:bg-white"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Section: Classificação e Valores */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900">Classificação e Valores</h2>

            {/* Condição do Mercado Livre: Tipo de Produto + Grau de Estado */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
              <ProductConditionSelect
                conditionType={conditionType}
                conditionGrade={conditionGrade}
                onTypeChange={(t) => {
                  setConditionType(t)
                  setConditionError('')
                }}
                onGradeChange={(g) => {
                  setConditionGrade(g)
                  setConditionError('')
                }}
                error={conditionError}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="status" className="text-xs font-semibold text-slate-700">
                  Status
                </Label>
                <Select value={customStatus} onValueChange={setCustomStatus}>
                  <SelectTrigger
                    id="status"
                    className="bg-white border-slate-300 text-sm h-10 mt-1"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Em teste">Em teste</SelectItem>
                    <SelectItem value="Disponível">Disponível</SelectItem>
                    <SelectItem value="Reservado">Reservado</SelectItem>
                    <SelectItem value="Aguardando peça">Aguardando peça</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="costBase" className="text-xs font-semibold text-slate-700">
                  Custo base atribuído
                </Label>
                <Input
                  id="costBase"
                  type="number"
                  step="0.01"
                  placeholder="1000,00"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="priceTarget" className="text-xs font-semibold text-slate-700">
                  Preço alvo de venda
                </Label>
                <Input
                  id="priceTarget"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="bg-white border-slate-300 text-sm h-10 mt-1 font-semibold text-emerald-700"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="benchNotes" className="text-xs font-semibold text-slate-700">
                Notas da bancada
              </Label>
              <Textarea
                id="benchNotes"
                rows={3}
                placeholder="O que precisa ser lembrado sobre este item?"
                value={benchNotes}
                onChange={(e) => setBenchNotes(e.target.value)}
                className="bg-white border-slate-300 text-sm mt-1"
              />
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Section: Fotos do equipamento (Até 6 fotos) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Fotos do equipamento</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Até 6 imagens JPEG, PNG ou WebP, com no máximo 5 MB cada. Use as setas para
                  definir a ordem no catálogo e no PDF.
                </p>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-orange-700 border-orange-300 bg-orange-50/50 hover:bg-orange-100 text-xs font-semibold h-9 gap-1.5"
                >
                  <Camera className="w-4 h-4 text-orange-600" />
                  Adicionar fotos
                </Button>
              </div>
            </div>

            {/* Photos Display Area */}
            {previewUrls.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-white/70 hover:bg-white cursor-pointer transition-colors"
              >
                <p className="text-xs text-slate-400">Nenhuma foto adicionada.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {previewUrls.map((url, i) => (
                  <div
                    key={i}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square shadow-xs"
                  >
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(i)}
                      className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-80 group-hover:opacity-100 hover:bg-rose-700 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded font-mono">
                      #{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions (matching screenshot 3) */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate(selectedBatchId ? `/lotes-entrada/${selectedBatchId}` : '/lotes-entrada')
              }
              className="bg-white border-slate-300 text-slate-700 text-sm h-11 px-5"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#d9532f] hover:bg-[#c24624] text-white text-sm font-semibold h-11 px-6 shadow-sm gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Salvando equipamento...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />+ Inventariar equipamento
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
