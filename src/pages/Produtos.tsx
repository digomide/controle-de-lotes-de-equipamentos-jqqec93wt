import React, { useState, useEffect, useMemo } from 'react'
import {
  Package,
  Plus,
  Search,
  Filter,
  Check,
  CheckSquare,
  Square,
  Eye,
  Layers,
  TrendingUp,
  DollarSign,
  Cpu,
  HardDrive,
  CircuitBoard,
  Monitor,
  Keyboard,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Send,
  Loader2,
  Trash2,
  Edit2,
  AlertCircle,
  FileSpreadsheet,
  Laptop,
  Boxes,
  ShoppingBag,
  Printer,
  QrCode,
} from 'lucide-react'
import { BatchMLPublishModal } from '@/components/BatchMLPublishModal'
import { BatchKabumPublishModal } from '@/components/BatchKabumPublishModal'
import { EtiquetaModal, type EtiquetaData } from '@/components/EtiquetaModal'
import { ChecklistPrintModal, type ChecklistPrintData } from '@/components/ChecklistPrintModal'
import { kabumService } from '@/services/kabumService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { productsService } from '@/services/products'
import { ProductConditionSelect } from '@/components/ProductConditionSelect'
import {
  resolveCondition,
  getConditionBadgeStyles,
  CONDITION_TYPE_OPTIONS,
  CONDITION_GRADE_OPTIONS,
  type ConditionType,
  type ConditionGrade,
} from '@/lib/condition'
import { batchesService } from '@/services/batches'
import type { Product, Batch, ProductStatus } from '@/types/inventory'
import { Link, useNavigate } from 'react-router-dom'

export default function Catalogo() {
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  // View mode: 'cards' (igual ao Replit) ou 'table' (visão gerencial densa)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [familyFilter, setFamilyFilter] = useState<'all' | 'Notebooks' | 'outros'>('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')

  // Multi-seleção de propostas (como no Replit)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [proposalModalOpen, setProposalModalOpen] = useState(false)
  const [mlBatchModalOpen, setMlBatchModalOpen] = useState(false)
  const [kabumBatchModalOpen, setKabumBatchModalOpen] = useState(false)
  const [hasKabumKey, setHasKabumKey] = useState(false)
  const [checklistPrintModalOpen, setChecklistPrintModalOpen] = useState(false)
  const [checklistSingleTarget, setChecklistSingleTarget] = useState<Product | null>(null)
  const [etiquetaModalOpen, setEtiquetaModalOpen] = useState(false)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  // Modal Novo / Editar Equipamento
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [code, setCode] = useState('')
  const [brand, setBrand] = useState('Dell')
  const [model, setModel] = useState('')
  const [category, setCategory] = useState('Notebooks')
  const [processor, setProcessor] = useState('')
  const [ram, setRam] = useState('')
  const [storage, setStorage] = useState('')
  const [condition, setCondition] = useState('Excelente')
  const [conditionType, setConditionType] = useState<ConditionType>('recondicionado')
  const [conditionGrade, setConditionGrade] = useState<ConditionGrade | undefined>('excelente')
  const [conditionFilter, setConditionFilter] = useState<'all' | ConditionType>('all')
  const [aestheticGrade, setAestheticGrade] = useState('A - Excelente')
  const [batteryHealth, setBatteryHealth] = useState('100%')
  const [screenSize, setScreenSize] = useState('14"')
  const [hasNumericKeypad, setHasNumericKeypad] = useState<boolean>(false)
  const [includesCharger, setIncludesCharger] = useState<boolean>(true)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [costPrice, setCostPrice] = useState<number>(0)
  const [status, setStatus] = useState<ProductStatus>('Disponível')
  const [description, setDescription] = useState('')
  const [imagesText, setImagesText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const loadData = async () => {
    try {
      const [prodData, batchData, kabumSettings] = await Promise.all([
        productsService.getAll(),
        batchesService.getAll(),
        kabumService.getSettings().catch(() => null),
      ])
      setProducts(prodData)
      setBatches(batchData)
      setHasKabumKey(Boolean(kabumSettings?.api_key && kabumSettings.api_key.trim().length > 0))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Aggregate stock per product
  const productStockMap = useMemo(() => {
    const map = new Map<string, { totalQty: number; batchCount: number }>()
    batches.forEach((b) => {
      const prev = map.get(b.product_id) || { totalQty: 0, batchCount: 0 }
      map.set(b.product_id, {
        totalQty: prev.totalQty + (b.quantity || 0),
        batchCount: prev.batchCount + 1,
      })
    })
    return map
  }, [batches])

  // Distinct Brands
  const availableBrands = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.brand) set.add(p.brand)
    })
    return Array.from(set).sort()
  }, [products])

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.processor?.toLowerCase().includes(q) ||
        p.ram?.toLowerCase().includes(q) ||
        p.storage?.toLowerCase().includes(q)

      const matchesFamily =
        familyFilter === 'all'
          ? true
          : familyFilter === 'Notebooks'
            ? p.category === 'Notebooks'
            : p.category !== 'Notebooks'

      const matchesBrand = brandFilter === 'all' || p.brand === brandFilter

      const effectiveStatus = p.status || 'Disponível'
      const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter

      const resolved = resolveCondition(p.condition_type, p.condition_grade, p.condition)
      const matchesCondition = conditionFilter === 'all' || resolved.type === conditionFilter

      const price = Number(p.unit_price) || 0
      const matchesMinPrice = !minPrice || price >= parseFloat(minPrice)
      const matchesMaxPrice = !maxPrice || price <= parseFloat(maxPrice)

      return (
        matchesSearch &&
        matchesFamily &&
        matchesBrand &&
        matchesStatus &&
        matchesCondition &&
        matchesMinPrice &&
        matchesMaxPrice
      )
    })
  }, [
    products,
    searchTerm,
    familyFilter,
    brandFilter,
    statusFilter,
    conditionFilter,
    minPrice,
    maxPrice,
  ])

  // Multi-select actions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)))
    }
  }

  const selectedProducts = useMemo(() => {
    return products.filter((p) => selectedIds.has(p.id))
  }, [products, selectedIds])

  const selectedEtiquetasData = useMemo<EtiquetaData[]>(() => {
    return selectedProducts.map((p) => ({
      product: p,
      batchNumber: p.batch_id || 'CATALOGO',
      location: 'Estoque / Catálogo',
      status: p.status,
      price: Number(p.unit_price) || 0,
      serialNumber: p.serial_number || p.part_number || p.sku || p.code,
      sku: p.sku,
      productName:
        p.name || [p.brand, p.model, p.processor].filter(Boolean).join(' ') || 'Equipamento',
      brand: p.brand,
      model: p.model,
    }))
  }, [selectedProducts])

  const selectedChecklistData = useMemo<ChecklistPrintData[]>(() => {
    if (checklistSingleTarget) {
      const b = batches.find((batch) => batch.product_id === checklistSingleTarget.id)
      return [
        {
          product: checklistSingleTarget,
          batchNumber: b?.batch_number || `LOTE-${checklistSingleTarget.sku || 'UN'}`,
          location: b?.location || 'Depósito Central',
          checklist: checklistSingleTarget.technical_checklist,
          photos:
            Array.isArray(checklistSingleTarget.images) && checklistSingleTarget.images.length > 0
              ? checklistSingleTarget.images
              : undefined,
        },
      ]
    }

    return selectedProducts.map((p) => {
      const b = batches.find((batch) => batch.product_id === p.id)
      return {
        product: p,
        batchNumber: b?.batch_number || p.batch_id || `LOTE-${p.sku || 'UN'}`,
        location: b?.location || 'Depósito Central',
        checklist: p.technical_checklist,
        photos: Array.isArray(p.images) && p.images.length > 0 ? p.images : undefined,
      }
    })
  }, [selectedProducts, checklistSingleTarget, batches])

  const totalSelectedPrice = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + (Number(p.unit_price) || 0), 0)
  }, [selectedProducts])

  const totalSelectedCost = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + (Number(p.cost_price) || 0), 0)
  }, [selectedProducts])

  // Dialog Form Handlers
  const handleOpenCreate = () => {
    setEditingProduct(null)
    setName('')
    setSku('')
    setCode(
      `EQ-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    )
    setBrand('Dell')
    setModel('')
    setCategory('Notebooks')
    setProcessor('Core I7 11ª Geração')
    setRam('16GB DDR4')
    setStorage('SSD 256GB')
    setCondition('Excelente')
    setConditionType('recondicionado')
    setConditionGrade('excelente')
    setAestheticGrade('A - Excelente')
    setBatteryHealth('100%')
    setScreenSize('14"')
    setHasNumericKeypad(false)
    setIncludesCharger(true)
    setUnitPrice(2500)
    setCostPrice(1500)
    setStatus('Disponível')
    setDescription('')
    setImagesText('')
    setDialogOpen(true)
  }

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p)
    setName(p.name)
    setSku(p.sku)
    setCode(p.code || '')
    setBrand(p.brand || 'Dell')
    setModel(p.model || '')
    setCategory(p.category || 'Notebooks')
    setProcessor(p.processor || '')
    setRam(p.ram || '')
    setStorage(p.storage || '')
    const resolved = resolveCondition(p.condition_type, p.condition_grade, p.condition)
    setConditionType(resolved.type)
    setConditionGrade(
      resolved.grade || (resolved.type === 'recondicionado' ? 'excelente' : undefined),
    )
    setCondition(p.condition || 'Excelente')
    setAestheticGrade(p.aesthetic_grade || 'A - Excelente')
    setBatteryHealth(p.battery_health || '')
    setScreenSize(p.screen_size || '')
    setHasNumericKeypad(Boolean(p.has_numeric_keypad))
    setIncludesCharger(p.includes_charger !== undefined ? Boolean(p.includes_charger) : true)
    setUnitPrice(Number(p.unit_price) || 0)
    setCostPrice(Number(p.cost_price) || 0)
    setStatus(p.status || 'Disponível')
    setDescription(p.description || '')
    setImagesText(p.images ? p.images.join('\n') : '')
    setDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !sku) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome e o código SKU.',
        variant: 'destructive',
      })
      return
    }

    const imagesList = imagesText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    setIsSubmitting(true)
    try {
      const payload: Partial<Product> = {
        name,
        sku,
        code: code || sku,
        brand,
        model,
        category,
        processor,
        ram,
        storage,
        condition,
        condition_type: conditionType,
        condition_grade: conditionGrade || null,
        aesthetic_grade: aestheticGrade,
        battery_health: batteryHealth,
        screen_size: screenSize,
        has_numeric_keypad: hasNumericKeypad,
        includes_charger: includesCharger,
        unit_price: Number(unitPrice) || 0,
        cost_price: Number(costPrice) || 0,
        status,
        description,
        images: imagesList.length > 0 ? imagesList : undefined,
      }

      if (editingProduct) {
        await productsService.update(editingProduct.id, payload)
        toast({
          title: 'Equipamento atualizado',
          description: `Os dados de "${name}" foram salvos com sucesso.`,
        })
      } else {
        await productsService.create(payload)
        toast({
          title: 'Equipamento cadastrado',
          description: `O notebook "${name}" foi adicionado ao catálogo.`,
        })
      }

      setDialogOpen(false)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Verifique se o SKU já existe no sistema.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, prodName: string) => {
    if (
      !window.confirm(
        `Tem certeza que deseja remover o equipamento "${prodName}"? Todos os registros vinculados serão removidos.`,
      )
    ) {
      return
    }

    try {
      await productsService.delete(id)
      toast({
        title: 'Equipamento removido',
        description: `"${prodName}" foi excluído do catálogo.`,
      })
      await loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o produto.',
        variant: 'destructive',
      })
    }
  }

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setDeletingBulk(true)
    try {
      const idsToDelete = Array.from(selectedIds)
      const result = await productsService.deleteBulk(idsToDelete)

      if (result.deletedCount > 0) {
        toast({
          title: 'Equipamentos excluídos com sucesso!',
          description: `${result.deletedCount} equipamento(s) foram removidos permanentemente.`,
        })
      }

      if (result.failedCount > 0) {
        const detailMsg = result.blockedNames.slice(0, 3).join(', ')
        toast({
          title: `${result.failedCount} equipamento(s) não puderam ser excluídos`,
          description:
            result.blockedNames.length > 0
              ? `Motivo: ${detailMsg}${result.blockedNames.length > 3 ? ` (+${result.blockedNames.length - 3})` : ''}`
              : 'Verifique se há vendas vinculadas ou status que impede a exclusão.',
          variant: 'destructive',
        })
      }

      setBulkDeleteModalOpen(false)
      setSelectedIds(new Set())
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro na exclusão em lote',
        description: err?.message || 'Falha ao processar a exclusão.',
        variant: 'destructive',
      })
    } finally {
      setDeletingBulk(false)
    }
  }

  // Enviar para Vendas / Proposta
  const handleProceedToSale = () => {
    setProposalModalOpen(false)
    navigate('/vendas?nova=true')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Equipamentos disponíveis e revisados
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Catálogo de Equipamentos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Explore nosso inventário de notebooks testados e revisados com controle de Custo × Venda
            e baixa em estoque.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/loja" target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              className="text-xs h-9 font-semibold gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              title="Abrir o Catálogo Público da Loja em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver Loja Pública
            </Button>
          </Link>

          <Link to="/lotes-entrada">
            <Button className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs h-9 font-medium shadow-xs gap-1.5">
              <Boxes className="w-4 h-4" />
              Lotes de Entrada
            </Button>
          </Link>

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'cards'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cards Catálogo
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tabela Gerencial
            </button>
          </div>

          {isAdmin && (
            <Button
              onClick={handleOpenCreate}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow gap-2 text-xs h-9"
            >
              <Plus className="w-4 h-4" />
              Novo Notebook
            </Button>
          )}
        </div>
      </div>

      {/* Floating / Sticky Selection Bar (estilo Replit: "X selecionados | Revise antes de enviar") */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-30 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
              {selectedIds.size}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {selectedIds.size}{' '}
                {selectedIds.size === 1 ? 'item selecionado' : 'itens selecionados'}
              </p>
              <p className="text-xs text-slate-300">
                Total de venda:{' '}
                <span className="font-bold text-emerald-400">
                  R$ {totalSelectedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                {isAdmin && (
                  <span className="text-slate-400 ml-2">
                    (Custo: R${' '}
                    {totalSelectedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
            >
              Limpar seleção
            </Button>
            <Button
              type="button"
              onClick={() => {
                setChecklistSingleTarget(null)
                setChecklistPrintModalOpen(true)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
              title="Imprimir laudo e checklist de revisão com fotos dos equipamentos selecionados em A4"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Checklists ({selectedIds.size})
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEtiquetaModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 font-semibold text-xs gap-1.5 shadow-sm"
              title="Imprimir etiquetas identificadoras dos equipamentos selecionados"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              Etiquetas ({selectedIds.size})
            </Button>
            <Button
              type="button"
              onClick={() => setMlBatchModalOpen(true)}
              className="bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 font-bold text-xs gap-1.5 shadow-sm"
              title="Anunciar os notebooks selecionados no Mercado Livre"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Anunciar no ML ({selectedIds.size})
            </Button>
            <Button
              type="button"
              disabled={!hasKabumKey}
              onClick={() => {
                if (!hasKabumKey) {
                  toast({
                    title: 'Configure a chave do Kabum',
                    description:
                      'Acesse Configurações para colar sua chave de API Mirakl antes de anunciar no Kabum.',
                    variant: 'destructive',
                  })
                  return
                }
                setKabumBatchModalOpen(true)
              }}
              className={
                hasKabumKey
                  ? 'bg-[#ff6500] hover:bg-[#e65c00] text-white font-bold text-xs gap-1.5 shadow-sm'
                  : 'bg-slate-800 text-slate-400 font-normal text-xs gap-1.5 cursor-not-allowed border border-slate-700/60'
              }
              title={
                hasKabumKey
                  ? 'Anunciar os notebooks selecionados no Kabum Marketplace'
                  : 'Configure a chave do Kabum em Configurações'
              }
            >
              <div className="w-3.5 h-3.5 rounded bg-white/20 flex items-center justify-center font-black text-[9px] leading-none">
                K!
              </div>
              Anunciar no Kabum ({selectedIds.size})
            </Button>
            <Button
              onClick={() => setProposalModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              Revise antes de enviar
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkDeleteModalOpen(true)}
                className="bg-rose-950/40 hover:bg-rose-900 border-rose-500/50 text-rose-300 hover:text-white font-semibold text-xs gap-1.5"
                title="Excluir permanentemente os equipamentos selecionados"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                Excluir selecionados ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filter Toolbar (Replicando o visual e campos do Replit) */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Busca por texto */}
            <div className="lg:col-span-2">
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Busca</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Nome, código único (ex: FS0V6K3), processador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-50 border-slate-200 text-xs h-10"
                />
              </div>
            </div>

            {/* Família */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Família</Label>
              <Select
                value={familyFilter}
                onValueChange={(v: 'all' | 'Notebooks' | 'outros') => setFamilyFilter(v)}
              >
                <SelectTrigger className="bg-slate-50 border-slate-200 text-xs h-10">
                  <SelectValue placeholder="Todas as Famílias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Famílias</SelectItem>
                  <SelectItem value="Notebooks">Notebooks</SelectItem>
                  <SelectItem value="outros">Outros Equipamentos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Marca */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Marca</Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200 text-xs h-10">
                  <SelectValue placeholder="Todas as Marcas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Marcas</SelectItem>
                  {availableBrands.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200 text-xs h-10">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="Disponível">Disponíveis</SelectItem>
                  <SelectItem value="Reservado">Reservado</SelectItem>
                  <SelectItem value="Vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Condição ML */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Condição ML</Label>
              <Select
                value={conditionFilter}
                onValueChange={(v: 'all' | ConditionType) => setConditionFilter(v)}
              >
                <SelectTrigger className="bg-slate-50 border-slate-200 text-xs h-10">
                  <SelectValue placeholder="Todas as Condições" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Condições</SelectItem>
                  {CONDITION_TYPE_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Segunda linha de filtros: Faixa de Preço */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Faixa de Preço:
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Preço Mínimo (R$)"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-36 h-8 text-xs bg-slate-50"
              />
              <span className="text-slate-400">até</span>
              <Input
                type="number"
                placeholder="Preço Máximo (R$)"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-36 h-8 text-xs bg-slate-50"
              />
            </div>

            {(searchTerm ||
              familyFilter !== 'all' ||
              brandFilter !== 'all' ||
              statusFilter !== 'all' ||
              conditionFilter !== 'all' ||
              minPrice ||
              maxPrice) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setFamilyFilter('all')
                  setBrandFilter('all')
                  setStatusFilter('all')
                  setConditionFilter('all')
                  setMinPrice('')
                  setMaxPrice('')
                }}
                className="text-slate-500 hover:text-slate-800 text-xs h-8 px-2 ml-auto"
              >
                Limpar filtros
              </Button>
            )}

            <div className="text-slate-400 ml-auto">
              Mostrando <strong className="text-slate-700">{filteredProducts.length}</strong> de{' '}
              {products.length} itens
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Cards (Igual ao Replit) */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200">
              <Laptop className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700">
                Nenhum equipamento encontrado
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Tente ajustar os filtros de busca, marca ou preço.
              </p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isSelected = selectedIds.has(p.id)
              const firstImage =
                p.images && p.images.length > 0
                  ? p.images[0]
                  : 'https://img.usecurling.com/p/600/400?q=laptop'

              const detailPath = `/catalogo/${p.code || p.sku || p.id}`
              const statusValue = p.status || 'Disponível'
              const cost = Number(p.cost_price) || 0
              const price = Number(p.unit_price) || 0
              const marginAmount = price - cost
              const marginPercent = cost > 0 ? ((marginAmount / cost) * 100).toFixed(1) : '100'

              return (
                <Card
                  key={p.id}
                  className={`overflow-hidden border transition-all duration-200 hover:shadow-lg flex flex-col ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                      : 'border-slate-200 shadow-sm'
                  }`}
                >
                  {/* Card Image Header with Overlays */}
                  <div className="relative w-full aspect-16/10 h-48 sm:h-52 bg-slate-100 overflow-hidden group shrink-0">
                    <img
                      src={firstImage}
                      alt={p.name}
                      className="w-full h-full object-cover object-center block group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src =
                          'https://img.usecurling.com/p/600/400?q=laptop'
                      }}
                    />

                    {/* Checkbox multi-select top-left */}
                    <button
                      type="button"
                      onClick={() => toggleSelect(p.id)}
                      className={`absolute top-3 left-3 p-1.5 rounded-lg transition-colors z-10 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-white/90 text-slate-600 hover:bg-white backdrop-blur-xs'
                      }`}
                      title={isSelected ? 'Desmarcar' : 'Selecionar para proposta'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-white" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-700" />
                      )}
                    </button>

                    {/* Status badge top-right */}
                    <div className="absolute top-3 right-3 z-10">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shadow-xs ${
                          statusValue === 'Disponível'
                            ? 'bg-emerald-600 text-white'
                            : statusValue === 'Reservado'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-700 text-white'
                        }`}
                      >
                        {statusValue}
                      </span>
                    </div>

                    {/* View Details hover link bottom overlay */}
                    <Link
                      to={detailPath}
                      className="absolute inset-x-0 bottom-0 py-2 bg-gradient-to-t from-slate-950/80 to-transparent text-white text-xs font-medium text-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver detalhes do equipamento
                    </Link>
                  </div>

                  {/* Card Body */}
                  <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      {/* Unique Code & Brand */}
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {p.sku}
                        </span>
                        <span className="text-slate-500 font-medium">
                          {p.brand} · {p.model || p.category}
                        </span>
                      </div>

                      {/* Title */}
                      <Link to={detailPath} className="block group">
                        <h3 className="font-bold text-slate-900 text-base line-clamp-2 group-hover:text-emerald-700 transition-colors">
                          {p.name}
                        </h3>
                      </Link>

                      {/* Condition badge */}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {(() => {
                          const resolved = resolveCondition(
                            p.condition_type,
                            p.condition_grade,
                            p.condition,
                          )
                          const badge = getConditionBadgeStyles(resolved.type, resolved.grade)
                          return (
                            <>
                              <Badge
                                variant="outline"
                                className={`text-[11px] font-semibold border px-2 py-0.5 ${badge.classes}`}
                              >
                                {badge.label}
                              </Badge>
                              {badge.gradeLabel && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-white text-slate-700 border-slate-200 px-1.5 py-0.2"
                                >
                                  Grau: {badge.gradeLabel}
                                </Badge>
                              )}
                            </>
                          )
                        })()}
                        {p.aesthetic_grade && (
                          <span className="text-[11px] text-slate-500">
                            · Nota: {p.aesthetic_grade}
                          </span>
                        )}
                      </div>

                      {/* Technical Specs List (igual ao Replit) */}
                      <div className="mt-3.5 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                        {p.processor && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-slate-500" /> Processador
                            </span>
                            <span className="font-medium text-slate-800 truncate max-w-[170px]">
                              {p.processor}
                            </span>
                          </div>
                        )}
                        {p.ram && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <CircuitBoard className="w-3.5 h-3.5 text-slate-500" /> Memória
                            </span>
                            <span className="font-medium text-slate-800">{p.ram}</span>
                          </div>
                        )}
                        {p.storage && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <HardDrive className="w-3.5 h-3.5 text-slate-500" /> Armazenamento
                            </span>
                            <span className="font-medium text-slate-800">{p.storage}</span>
                          </div>
                        )}
                        {p.screen_size && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Monitor className="w-3.5 h-3.5 text-slate-500" /> Tela
                            </span>
                            <span className="font-medium text-slate-800">{p.screen_size}</span>
                          </div>
                        )}
                        {p.has_numeric_keypad !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Keyboard className="w-3.5 h-3.5 text-slate-500" /> Teclado numérico
                            </span>
                            <span className="font-medium text-slate-800">
                              {p.has_numeric_keypad ? 'Sim' : 'Não'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Financial control: Custo x Venda x Margem (visível para Admin) */}
                      {isAdmin && (
                        <div className="mt-3.5 bg-slate-50 rounded-lg p-2.5 border border-slate-200/80 text-xs space-y-1">
                          <div className="flex justify-between items-center text-slate-500">
                            <span>Custo Aquisição:</span>
                            <span className="font-mono font-medium text-slate-700">
                              R$ {cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-emerald-600" /> Margem Bruta:
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                marginAmount >= 0 ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              R${' '}
                              {marginAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{' '}
                              <span className="text-[10px] font-normal">({marginPercent}%)</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Price and Add button (igual ao Replit) */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">
                          Preço sugerido
                        </span>
                        <div className="text-xl font-extrabold text-slate-900 tracking-tight">
                          R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setChecklistSingleTarget(p)
                            setChecklistPrintModalOpen(true)
                          }}
                          className="text-xs h-9 p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                          title="Imprimir checklist com fotos deste notebook em folha A4"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Link to={detailPath}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-100 gap-1"
                            title="Abrir lote e detalhes do notebook"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Abrir
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => toggleSelect(p.id)}
                          className={`text-xs h-9 font-semibold ${
                            isSelected
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Selecionado
                            </>
                          ) : (
                            'Adicionar'
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* Tabela Gerencial Densa (Visão operacional alternativa) */}
      {viewMode === 'table' && (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">
                    <button onClick={selectAll} title="Selecionar todos">
                      {selectedIds.size === filteredProducts.length &&
                      filteredProducts.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Equipamento</th>
                  <th className="py-3 px-4">Código / SKU</th>
                  <th className="py-3 px-4">Specs Principais</th>
                  <th className="py-3 px-4 text-center">Condição</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Custo</th>}
                  <th className="py-3 px-4 text-right">Preço Venda</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Margem (R$ / %)</th>}
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Nenhum equipamento cadastrado ou correspondente à busca.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = selectedIds.has(p.id)
                    const cost = Number(p.cost_price) || 0
                    const price = Number(p.unit_price) || 0
                    const marginAmount = price - cost
                    const marginPercent =
                      cost > 0 ? ((marginAmount / cost) * 100).toFixed(1) : '100'
                    const detailPath = `/catalogo/${p.code || p.sku || p.id}`

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isSelected ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <button onClick={() => toggleSelect(p.id)}>
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              <img
                                src={
                                  p.images && p.images.length > 0
                                    ? p.images[0]
                                    : 'https://img.usecurling.com/p/200/150?q=laptop'
                                }
                                alt={p.name}
                                className="w-full h-full object-cover object-center"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).src =
                                    'https://img.usecurling.com/p/200/150?q=laptop'
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={detailPath}
                                className="font-semibold text-slate-900 hover:text-emerald-700 block truncate max-w-xs sm:max-w-sm"
                              >
                                {p.name}
                              </Link>
                              <span className="text-xs text-slate-500 font-normal">
                                {p.brand} {p.model ? `· ${p.model}` : ''}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                          <Badge variant="outline" className="bg-slate-50 text-slate-700 font-mono">
                            {p.sku}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                          {p.processor} | {p.ram} | {p.storage}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {(() => {
                            const resolved = resolveCondition(
                              p.condition_type,
                              p.condition_grade,
                              p.condition,
                            )
                            const badge = getConditionBadgeStyles(resolved.type, resolved.grade)
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-semibold border ${badge.classes}`}
                                >
                                  {badge.label}
                                </Badge>
                                {badge.gradeLabel && (
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    Grau {badge.gradeLabel}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                              p.status === 'Disponível'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'Reservado'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {p.status || 'Disponível'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                            R$ {cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap">
                            <span
                              className={marginAmount >= 0 ? 'text-emerald-700' : 'text-rose-600'}
                            >
                              R${' '}
                              {marginAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{' '}
                              <span className="text-[10px] font-normal text-slate-500">
                                ({marginPercent}%)
                              </span>
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setChecklistSingleTarget(p)
                              setChecklistPrintModalOpen(true)
                            }}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Imprimir checklist com fotos (A4)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          <Link to={detailPath}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-slate-700 hover:text-slate-900 gap-1 border-slate-300"
                              title="Abrir este lote separadamente"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Abrir Lote
                            </Button>
                          </Link>
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEdit(p)}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(p.id, p.name)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO EM MASSA */}
      <AlertDialog
        open={bulkDeleteModalOpen}
        onOpenChange={(open) => !deletingBulk && setBulkDeleteModalOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="w-5 h-5 text-rose-600" />
              Excluir {selectedIds.size} {selectedIds.size === 1 ? 'equipamento' : 'equipamentos'}{' '}
              em lote?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 space-y-2 pt-1 text-xs sm:text-sm">
              <p>
                Você está prestes a excluir permanentemente{' '}
                <strong className="text-slate-900">{selectedIds.size}</strong> equipamento(s)
                selecionado(s) do catálogo.
              </p>
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                ⚠️ <strong>Aviso permanente:</strong> Esta ação não pode ser desfeita. Todos os
                dados técnicos, histórico, fotos e registros vinculados serão excluídos.
                Equipamentos já vendidos ou com faturamento registrado serão preservados para manter
                a integridade fiscal e financeira.
              </div>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50 text-xs text-slate-700">
                <ul className="list-disc pl-4 space-y-0.5">
                  {selectedProducts.slice(0, 8).map((p) => (
                    <li key={p.id} className="truncate">
                      {p.name} ({p.sku || p.code || 'Sem SKU'})
                    </li>
                  ))}
                  {selectedProducts.length > 8 && (
                    <li className="text-slate-400 italic">
                      + {selectedProducts.length - 8} outro(s)...
                    </li>
                  )}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBulk}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmBulkDelete()
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
              disabled={deletingBulk}
            >
              {deletingBulk ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Sim, excluir {selectedIds.size} equipamento(s)
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DE IMPRESSÃO DE CHECKLIST COM FOTOS EM A4 */}
      <ChecklistPrintModal
        open={checklistPrintModalOpen}
        onOpenChange={(open) => {
          setChecklistPrintModalOpen(open)
          if (!open) setChecklistSingleTarget(null)
        }}
        items={selectedChecklistData}
      />

      {/* MODAL DE IMPRESSÃO DE ETIQUETAS EM MASSA */}
      <EtiquetaModal
        open={etiquetaModalOpen}
        onOpenChange={setEtiquetaModalOpen}
        items={selectedEtiquetasData}
      />

      {/* MODAL DE PUBLICAÇÃO EM MASSA NO MERCADO LIVRE */}
      <BatchMLPublishModal
        isOpen={mlBatchModalOpen}
        onClose={() => setMlBatchModalOpen(false)}
        selectedProducts={selectedProducts}
        onSuccessFinished={() => {
          loadData()
        }}
      />

      {/* MODAL DE PUBLICAÇÃO EM MASSA NO KABUM */}
      <BatchKabumPublishModal
        isOpen={kabumBatchModalOpen}
        onClose={() => setKabumBatchModalOpen(false)}
        selectedProducts={selectedProducts}
        hasKabumKey={hasKabumKey}
        onSuccessFinished={() => {
          loadData()
        }}
      />

      {/* MODAL: REVISE ANTES DE ENVIAR / PROPOSTA COMERCIAL */}
      <Dialog open={proposalModalOpen} onOpenChange={setProposalModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Revisão da Proposta de Venda
            </DialogTitle>
            <DialogDescription>
              Confira os notebooks selecionados, o valor consolidado e avance para a emissão da
              venda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="divide-y divide-slate-100 border rounded-lg bg-slate-50/50">
              {selectedProducts.map((p) => (
                <div key={p.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {p.sku}
                      </span>
                      <span className="font-semibold text-slate-900 truncate">{p.name}</span>
                    </div>
                    <p className="text-slate-500 mt-0.5">
                      {p.processor} · {p.ram} · {p.storage} · {p.condition}
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      R${' '}
                      {Number(p.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleSelect(p.id)}
                      className="block text-[11px] text-rose-600 hover:underline ml-auto mt-0.5"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totalizadores da Proposta */}
            <div className="bg-slate-900 text-white rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Total de Itens:</span>
                <span className="font-bold text-white">{selectedProducts.length} un</span>
              </div>
              {isAdmin && (
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Custo Total de Aquisição:</span>
                  <span className="font-mono">
                    R$ {totalSelectedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {isAdmin && (
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Margem Bruta Estimada:</span>
                  <span className="font-mono font-bold">
                    R${' '}
                    {(totalSelectedPrice - totalSelectedCost).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-white">Valor Total da Proposta:</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  R$ {totalSelectedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setProposalModalOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={handleProceedToSale}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
            >
              <Send className="w-4 h-4" />
              Lançar Venda no Sistema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE / EDIT NOTEBOOK DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Laptop className="w-5 h-5 text-slate-700" />
              {editingProduct ? 'Editar Equipamento' : 'Novo Notebook'}
            </DialogTitle>
            <DialogDescription>
              Cadastre ou altere as especificações completas, fotos, custo e preço de venda.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Nome do Notebook *</Label>
                <Input
                  placeholder="Ex: Notebook Dell Latitude 5320 (Intel Core I7 11ª Geração...)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Código Único / SKU *</Label>
                <Input
                  placeholder="Ex: FS0V6K3"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Código Sistema</Label>
                <Input
                  placeholder="EQ-2026-DC218"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Marca</Label>
                <Input
                  placeholder="Dell, Lenovo, HP, Apple..."
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Modelo</Label>
                <Input
                  placeholder="Latitude 5320, ThinkPad T580..."
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Processador</Label>
                <Input
                  placeholder="Core I7 11ª Geração"
                  value={processor}
                  onChange={(e) => setProcessor(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Memória RAM</Label>
                <Input
                  placeholder="16GB DDR4"
                  value={ram}
                  onChange={(e) => setRam(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Armazenamento</Label>
                <Input
                  placeholder="SSD 256GB"
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tela / Display</Label>
                <Input
                  placeholder='13.3", 14", 15.6"'
                  value={screenSize}
                  onChange={(e) => setScreenSize(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Teclado Numérico</Label>
                <Select
                  value={hasNumericKeypad ? 'sim' : 'nao'}
                  onValueChange={(v) => setHasNumericKeypad(v === 'sim')}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim (Possui teclado numérico)</SelectItem>
                    <SelectItem value="nao">Não (Sem teclado numérico)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Acompanha carregador</Label>
                <Select
                  value={includesCharger ? 'sim' : 'nao'}
                  onValueChange={(v) => setIncludesCharger(v === 'sim')}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim (Acompanha)</SelectItem>
                    <SelectItem value="nao">Não acompanha</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product Condition Select integrado */}
              <div className="sm:col-span-2">
                <ProductConditionSelect
                  conditionType={conditionType}
                  conditionGrade={conditionGrade}
                  onTypeChange={setConditionType}
                  onGradeChange={setConditionGrade}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nota Estética</Label>
                <Input
                  placeholder="A - Excelente, B - Bom"
                  value={aestheticGrade}
                  onChange={(e) => setAestheticGrade(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Saúde Bateria</Label>
                <Input
                  placeholder="100%, 92%"
                  value={batteryHealth}
                  onChange={(e) => setBatteryHealth(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select value={status} onValueChange={(v: ProductStatus) => setStatus(v)}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Disponível">Disponível</SelectItem>
                    <SelectItem value="Reservado">Reservado</SelectItem>
                    <SelectItem value="Vendido">Vendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Financeiro Custo x Venda */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Custo de Aquisição (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Preço de Venda (R$) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            {/* URLs de Imagens */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                URLs das Fotos (uma por linha)
              </Label>
              <Textarea
                placeholder="https://...
https://..."
                value={imagesText}
                onChange={(e) => setImagesText(e.target.value)}
                rows={3}
                className="font-mono text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Equipamento'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
