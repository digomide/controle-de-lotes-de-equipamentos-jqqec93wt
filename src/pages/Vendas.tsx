import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  Calendar,
  FileCheck,
  Layers,
  ArrowRight,
  ArrowLeft,
  Check,
  Package,
  Boxes,
  Trash2,
  AlertTriangle,
  User,
  Phone,
  FileText,
  DollarSign,
  Loader2,
} from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { useRealtime } from '@/hooks/use-realtime'
import { salesService } from '@/services/sales'
import { productsService } from '@/services/products'
import { EmitirNFModal } from '@/components/EmitirNFModal'
import { EditSaleModal } from '@/components/EditSaleModal'
import { CancelSaleModal } from '@/components/CancelSaleModal'
import { batchesService } from '@/services/batches'
import { purchaseBatchesService } from '@/services/purchaseBatches'
import { StoreOrdersTab } from '@/components/StoreOrdersTab'
import { PurchaseOrdersTab } from '@/components/PurchaseOrdersTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Ban } from 'lucide-react'
import type { Sale, Product, Batch, SaleItem, PurchaseBatch } from '@/types/inventory'

interface CartItem {
  tempId: string
  type: 'equipment' | 'batch'
  // Quando type === 'equipment':
  productId?: string
  productName: string
  sku?: string
  batchId?: string
  batchNumber: string
  // Quando type === 'batch':
  purchaseBatchId?: string
  purchaseBatchSupplier?: string
  purchaseBatchInvoice?: string
  availableStock: number
  quantity: number
  unitPrice: number
}

export default function Vendas() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [purchaseBatches, setPurchaseBatches] = useState<PurchaseBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'vendas' | 'pedidos_compra' | 'pedidos_loja'>('vendas')

  // Filters
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('')

  // New Sale Wizard Dialog State
  const [wizardOpen, setWizardOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step 1: Customer Data
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [saleNotes, setSaleNotes] = useState('')

  // Step 2: Item Selection (Modo Equipamento vs Modo Por Lote)
  const [selectionMode, setSelectionMode] = useState<'equipment' | 'batch'>('batch')
  const [cart, setCart] = useState<CartItem[]>([])

  // Modo Equipamento
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [itemQuantity, setItemQuantity] = useState<number>(1)
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0)
  const [itemError, setItemError] = useState<string | null>(null)

  // Modo Por Lote de Compra
  const [selectedPurchaseBatchId, setSelectedPurchaseBatchId] = useState('')
  const [batchQuantity, setBatchQuantity] = useState<number>(1)
  const [batchUnitPrice, setBatchUnitPrice] = useState<number>(0)
  const [batchItemError, setBatchItemError] = useState<string | null>(null)

  // Details Modal
  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [detailItems, setDetailItems] = useState<SaleItem[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Edit Sale Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null)

  // Cancel Sale Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null)

  // Emissão de NF-e
  const [emitNFOpen, setEmitNFOpen] = useState(false)
  const [saleToEmitNF, setSaleToEmitNF] = useState<any>(null)

  const { toast } = useToast()
  const { user } = useAuth()
  const { currentTenant } = useTenant()
  const location = useLocation()

  const loadData = async () => {
    setLoading(true)
    try {
      const tenantId = currentTenant?.id
      const [sData, pData, bData, pbData] = await Promise.all([
        salesService.getAll(tenantId),
        productsService.getAllByTenant(tenantId),
        batchesService.getAll(tenantId),
        purchaseBatchesService.getAll(tenantId),
      ])
      setSales(sData)
      setProducts(pData)
      setBatches(bData)
      setPurchaseBatches(pbData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentTenant?.id])

  // Check URL params for quick actions
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('aba') === 'loja' || params.get('tab') === 'loja') {
      setActiveTab('pedidos_loja')
    } else if (
      params.get('aba') === 'compras' ||
      params.get('aba') === 'pedidos_compra' ||
      params.get('tab') === 'compras' ||
      params.get('tab') === 'pedidos_compra'
    ) {
      setActiveTab('pedidos_compra')
    }
    if (params.get('nova') === 'true') {
      openNewSaleWizard()
    }
    const prodParam = params.get('produto')
    if (prodParam && products.length > 0) {
      handleProductChange(prodParam)
    }
    const detalheId = params.get('detalhe')
    if (detalheId) {
      handleOpenDetails(detalheId)
    }
  }, [location.search, products])

  // Realtime subscription
  useRealtime<Sale>('sales', () => {
    salesService.getAll(currentTenant?.id).then(setSales)
  })

  useRealtime<Batch>('batches', () => {
    batchesService.getAll(currentTenant?.id).then(setBatches)
  })

  useRealtime<PurchaseBatch>('purchase_batches', () => {
    purchaseBatchesService.getAll(currentTenant?.id).then(setPurchaseBatches)
  })

  useRealtime<Product>('products', () => {
    productsService.getAllByTenant(currentTenant?.id).then(setProducts)
  })

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchesSearch =
        s.customer_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        s.customer_contact?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        s.expand?.user_id?.name?.toLowerCase().includes(searchFilter.toLowerCase())

      const matchesStatus = statusFilter === 'all' || s.status === statusFilter

      const matchesDate = !dateFilter || s.created.startsWith(dateFilter)

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [sales, searchFilter, statusFilter, dateFilter])

  // Lotes de compra enriquecidos com equipamentos disponíveis
  const purchaseBatchesWithAvailability = useMemo(() => {
    return purchaseBatches.map((pbItem) => {
      // Equipamentos deste lote com status 'Disponível'
      const batchProds = products.filter((p) => p.purchase_batch_id === pbItem.id)
      const availableProds = batchProds.filter((p) => p.status === 'Disponível')
      const availableCount = availableProds.length

      // Preço médio sugerido de venda dos disponíveis (ou preço cadastrado de produto)
      const avgPrice =
        availableCount > 0
          ? Math.round(
              availableProds.reduce((sum, p) => sum + (Number(p.unit_price) || 0), 0) /
                availableCount,
            )
          : 0

      // Resumo de modelos disponíveis no lote (ex: "Dell Latitude 5420 (8), Lenovo T480 (2)")
      const modelCounts: Record<string, number> = {}
      for (const p of availableProds) {
        const label = [p.brand, p.model].filter(Boolean).join(' ') || p.name || 'Equipamento'
        modelCounts[label] = (modelCounts[label] || 0) + 1
      }
      const modelsSummary = Object.entries(modelCounts)
        .slice(0, 3)
        .map(([m, c]) => `${m} (${c})`)
        .join(', ')

      return {
        ...pbItem,
        availableCount,
        totalInventoried: batchProds.length,
        suggestedUnitPrice: avgPrice,
        modelsSummary,
        availableProds,
      }
    })
  }, [purchaseBatches, products])

  // Lote de compra atualmente selecionado no modo 'Por Lote'
  const activePurchaseBatchObj = useMemo(() => {
    return purchaseBatchesWithAvailability.find((b) => b.id === selectedPurchaseBatchId)
  }, [purchaseBatchesWithAvailability, selectedPurchaseBatchId])

  // Batches available for chosen product (Modo Por Equipamento)
  const availableBatchesForProduct = useMemo(() => {
    if (!selectedProductId) return []
    return batches.filter((b) => b.product_id === selectedProductId && b.quantity > 0)
  }, [batches, selectedProductId])

  // Selected batch object (Modo Por Equipamento)
  const activeBatchObj = useMemo(() => {
    return batches.find((b) => b.id === selectedBatchId)
  }, [batches, selectedBatchId])

  // When selected product changes, reset batch & pre-fill price
  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId)
    setSelectedBatchId('')
    setItemError(null)
    const prod = products.find((p) => p.id === prodId)
    if (prod) {
      setItemUnitPrice(prod.unit_price || 0)
    }
  }

  // When selected batch changes
  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId)
    setItemError(null)
  }

  // When selected purchase batch changes (Modo Por Lote)
  const handlePurchaseBatchChange = (pbId: string) => {
    setSelectedPurchaseBatchId(pbId)
    setBatchItemError(null)
    const found = purchaseBatchesWithAvailability.find((b) => b.id === pbId)
    if (found) {
      setBatchUnitPrice(found.suggestedUnitPrice || 0)
      setBatchQuantity(1)
    }
  }

  // Add Item to cart (Modo Por Equipamento)
  const handleAddItem = () => {
    setItemError(null)

    if (!selectedProductId) {
      setItemError('Selecione um produto.')
      return
    }
    if (!selectedBatchId) {
      setItemError('Selecione um lote com estoque disponível.')
      return
    }
    if (!itemQuantity || itemQuantity <= 0) {
      setItemError('A quantidade deve ser de pelo menos 1 unidade.')
      return
    }

    const prod = products.find((p) => p.id === selectedProductId)
    const batch = batches.find((b) => b.id === selectedBatchId)

    if (!prod || !batch) return

    // Check already carted quantity for this specific batch
    const alreadyInCart = cart
      .filter((c) => c.type === 'equipment' && c.batchId === selectedBatchId)
      .reduce((sum, c) => sum + c.quantity, 0)

    const totalDemanded = alreadyInCart + itemQuantity

    if (totalDemanded > batch.quantity) {
      setItemError(
        `Estoque insuficiente no lote ${batch.batch_number}! Disponível: ${batch.quantity} un (Já no carrinho: ${alreadyInCart} un).`,
      )
      return
    }

    const newItem: CartItem = {
      tempId: Math.random().toString(36).substring(7),
      type: 'equipment',
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      batchId: batch.id,
      batchNumber: batch.batch_number,
      availableStock: batch.quantity,
      quantity: itemQuantity,
      unitPrice: itemUnitPrice,
    }

    setCart([...cart, newItem])
    // Reset selection fields
    setSelectedBatchId('')
    setItemQuantity(1)
  }

  // Add Purchase Batch to cart (Modo Por Lote)
  const handleAddBatchToCart = () => {
    setBatchItemError(null)

    if (!selectedPurchaseBatchId) {
      setBatchItemError('Selecione um lote de compra.')
      return
    }
    if (!batchQuantity || batchQuantity <= 0) {
      setBatchItemError('A quantidade deve ser de pelo menos 1 unidade.')
      return
    }
    if (batchUnitPrice < 0) {
      setBatchItemError('O preço unitário não pode ser negativo.')
      return
    }

    const foundPb = purchaseBatchesWithAvailability.find((b) => b.id === selectedPurchaseBatchId)
    if (!foundPb) {
      setBatchItemError('Lote de compra não encontrado.')
      return
    }

    if (foundPb.availableCount <= 0) {
      setBatchItemError('Este lote não possui equipamentos com status Disponível no momento.')
      return
    }

    // Checar quantidade já adicionada ao carrinho para este lote de compra
    const alreadyInCart = cart
      .filter((c) => c.type === 'batch' && c.purchaseBatchId === selectedPurchaseBatchId)
      .reduce((sum, c) => sum + c.quantity, 0)

    const totalDemanded = alreadyInCart + batchQuantity

    if (totalDemanded > foundPb.availableCount) {
      setBatchItemError(
        `Quantidade solicitada (${totalDemanded} un) excede o estoque disponível (${foundPb.availableCount} un) no lote ${foundPb.supplier}! Já no carrinho: ${alreadyInCart} un.`,
      )
      return
    }

    const displayName = `${foundPb.supplier}${foundPb.invoice_number ? ` (NF ${foundPb.invoice_number})` : ''}`
    const descExtra = foundPb.modelsSummary ? ` — ${foundPb.modelsSummary}` : ''

    const newItem: CartItem = {
      tempId: Math.random().toString(36).substring(7),
      type: 'batch',
      purchaseBatchId: foundPb.id,
      purchaseBatchSupplier: foundPb.supplier,
      purchaseBatchInvoice: foundPb.invoice_number || '',
      productName: `Venda por Lote: ${displayName}${descExtra}`,
      batchNumber: foundPb.invoice_number
        ? `NF-${foundPb.invoice_number}`
        : `LOTE-${foundPb.id.slice(0, 6).toUpperCase()}`,
      availableStock: foundPb.availableCount,
      quantity: batchQuantity,
      unitPrice: batchUnitPrice,
    }

    setCart([...cart, newItem])
    // Reset selection
    setSelectedPurchaseBatchId('')
    setBatchQuantity(1)
    setBatchUnitPrice(0)
  }

  const handleRemoveCartItem = (tempId: string) => {
    setCart(cart.filter((c) => c.tempId !== tempId))
  }

  // Total cart calculation
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }, [cart])

  const openNewSaleWizard = () => {
    setCurrentStep(1)
    setCustomerName('')
    setCustomerContact('')
    setSaleNotes('')
    setCart([])
    setSelectionMode('batch')
    setSelectedProductId('')
    setSelectedBatchId('')
    setItemQuantity(1)
    setItemError(null)
    setSelectedPurchaseBatchId('')
    setBatchQuantity(1)
    setBatchUnitPrice(0)
    setBatchItemError(null)
    setWizardOpen(true)
  }

  // Step Navigations
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!customerName.trim()) {
        toast({
          title: 'Atenção',
          description: 'Informe o nome do cliente antes de prosseguir.',
          variant: 'destructive',
        })
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (cart.length === 0) {
        toast({
          title: 'Carrinho vazio',
          description: 'Adicione pelo menos um item/lote para continuar.',
          variant: 'destructive',
        })
        return
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      setCurrentStep(4)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as any)
    }
  }

  // Finalize Sale (Suporta modo Por Lote e modo Por Equipamento unificados)
  const handleFinalizeSale = async () => {
    setIsSubmitting(true)
    try {
      const equipmentItems = cart
        .filter((c) => c.type === 'equipment' && c.productId && c.batchId)
        .map((c) => ({
          product_id: c.productId!,
          batch_id: c.batchId!,
          quantity: c.quantity,
          unit_price: c.unitPrice,
        }))

      const batchLines = cart
        .filter((c) => c.type === 'batch' && c.purchaseBatchId)
        .map((c) => ({
          purchase_batch_id: c.purchaseBatchId!,
          quantity: c.quantity,
          unit_price: c.unitPrice,
        }))

      // Executa a finalização unificada com seleção estável dos N primeiros disponíveis e baixa no estoque
      await salesService.createSaleWithBatches({
        customer_name: customerName,
        customer_contact: customerContact,
        notes: saleNotes,
        user_id: user?.id,
        tenant_id: currentTenant?.id,
        equipmentItems,
        batchLines,
      })

      toast({
        title: 'Venda finalizada com sucesso!',
        description: 'Baixa de estoque e vínculo dos equipamentos efetuados com sucesso.',
      })

      setWizardOpen(false)
      // reload
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao finalizar venda',
        description:
          err?.message ||
          'Ocorreu uma falha na validação de estoque ou comunicação com o backend. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Details
  const handleOpenDetails = async (saleId: string) => {
    setLoadingDetails(true)
    try {
      const sale = await salesService.getById(saleId)
      const items = await salesService.getSaleItems(saleId)
      setDetailSale(sale)
      setDetailItems(items)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingDetails(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Gestão de Vendas & Pedidos
          </h2>
          <p className="text-sm text-slate-500">
            Fluxo completo de vendas internas com rastreabilidade por lote e pedidos online via
            Mercado Pago.
          </p>
        </div>
        {activeTab === 'vendas' && (
          <Button
            onClick={openNewSaleWizard}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Venda Interna
          </Button>
        )}
      </div>

      {/* Tabs Vendas Internas vs Pedidos de Compra vs Pedidos da Loja Pública */}
      <Tabs
        value={activeTab}
        onValueChange={(val: any) => setActiveTab(val)}
        className="w-full space-y-6"
      >
        <TabsList className="bg-slate-100 p-1 rounded-xl border border-slate-200">
          <TabsTrigger
            value="vendas"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs font-bold gap-2 px-4 py-2"
          >
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            Vendas Internas & Bancada
          </TabsTrigger>
          <TabsTrigger
            value="pedidos_compra"
            className="data-[state=active]:bg-white data-[state=active]:text-[#d9532f] text-xs font-bold gap-2 px-4 py-2"
          >
            <Boxes className="w-4 h-4 text-[#d9532f]" />
            Pedidos de Compra ({purchaseBatches.length})
          </TabsTrigger>
          <TabsTrigger
            value="pedidos_loja"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs font-bold gap-2 px-4 py-2"
          >
            <Package className="w-4 h-4 text-sky-600" />
            Pedidos Loja Pública (Mercado Pago)
          </TabsTrigger>
        </TabsList>

        {/* CONTEÚDO DA ABA 2: PEDIDOS DE COMPRA */}
        <TabsContent value="pedidos_compra" className="mt-0">
          <PurchaseOrdersTab />
        </TabsContent>

        {/* CONTEÚDO DA ABA 3: PEDIDOS DA LOJA PÚBLICA */}
        <TabsContent value="pedidos_loja" className="mt-0">
          <StoreOrdersTab />
        </TabsContent>

        {/* CONTEÚDO DA ABA 1: VENDAS INTERNAS */}
        <TabsContent value="vendas" className="mt-0 space-y-6">
          {/* Filter Toolbar */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative sm:col-span-2">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="Filtrar por cliente, contato ou vendedor..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200"
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Status da Venda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="completed">Concluída (Completo)</SelectItem>
                      <SelectItem value="draft">Pendente (Rascunho)</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date filter */}
                <div>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales List Table */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Contato</th>
                    <th className="py-3 px-4">Vendedor</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Nenhuma venda encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {new Date(sale.created).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(sale.created).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {sale.customer_name}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {sale.customer_contact || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {sale.expand?.user_id?.name || 'Equipe'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                          R${' '}
                          {Number(sale.total_amount).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {sale.status === 'completed' && (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none text-[11px] font-semibold gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Completo
                            </Badge>
                          )}
                          {sale.status === 'draft' && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-[11px] font-semibold gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Pendente
                            </Badge>
                          )}
                          {sale.status === 'cancelled' && (
                            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none text-[11px] font-semibold gap-1">
                              <XCircle className="w-3 h-3" />
                              Cancelado
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSaleToEmitNF({
                                  id: sale.id,
                                  client_name: sale.customer_name,
                                  total_value: sale.total_amount,
                                  product_description: `Venda #${sale.id} - Equipamentos de Informática`,
                                })
                                setEmitNFOpen(true)
                              }}
                              className="h-8 text-xs gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                              title="Emitir Nota Fiscal Eletrônica"
                              disabled={sale.status === 'cancelled'}
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              NF-e
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDetails(sale.id)}
                              className="h-8 text-xs gap-1 border-slate-200 hover:bg-slate-100"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver Itens
                            </Button>

                            {/* Menu de Ações: Editar e Cancelar */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                  title="Mais ações"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSaleToEdit(sale)
                                    setEditModalOpen(true)
                                  }}
                                  className="text-xs gap-2 cursor-pointer"
                                >
                                  <Edit className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Editar Venda</span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() => {
                                    setSaleToCancel(sale)
                                    setCancelModalOpen(true)
                                  }}
                                  disabled={sale.status === 'cancelled'}
                                  className={`text-xs gap-2 cursor-pointer ${
                                    sale.status === 'cancelled'
                                      ? 'text-slate-400 cursor-not-allowed'
                                      : 'text-rose-600 focus:text-rose-700 focus:bg-rose-50'
                                  }`}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>
                                    {sale.status === 'cancelled'
                                      ? 'Já Cancelada'
                                      : 'Cancelar Venda'}
                                  </span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* NEW SALE 4-STEP WIZARD MODAL */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              Nova Venda com Baixa por Lote
            </DialogTitle>
            <DialogDescription>
              Fluxo guiado em 4 etapas para emissão com rastreabilidade total de estoque.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Header */}
          <div className="py-3 border-y border-slate-100 my-2">
            <div className="grid grid-cols-4 text-xs font-semibold text-center">
              <div
                className={`flex flex-col items-center gap-1 ${
                  currentStep >= 1 ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    currentStep > 1
                      ? 'bg-emerald-600 text-white'
                      : currentStep === 1
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <span>Cliente</span>
              </div>

              <div
                className={`flex flex-col items-center gap-1 ${
                  currentStep >= 2 ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    currentStep > 2
                      ? 'bg-emerald-600 text-white'
                      : currentStep === 2
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <span>Seleção de Lotes</span>
              </div>

              <div
                className={`flex flex-col items-center gap-1 ${
                  currentStep >= 3 ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    currentStep > 3
                      ? 'bg-emerald-600 text-white'
                      : currentStep === 3
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentStep > 3 ? <Check className="w-4 h-4" /> : '3'}
                </div>
                <span>Revisão & Totais</span>
              </div>

              <div
                className={`flex flex-col items-center gap-1 ${
                  currentStep >= 4 ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    currentStep === 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  4
                </div>
                <span>Finalização</span>
              </div>
            </div>
          </div>

          {/* STEP 1: DADOS DO CLIENTE */}
          {currentStep === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="custName" className="text-slate-700 font-semibold">
                  Nome do Cliente / Empresa *
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    id="custName"
                    placeholder="Ex: Laboratório de Pesquisa Alfa Ltda"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custContact" className="text-slate-700">
                  Contato (Telefone / WhatsApp / E-mail)
                </Label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    id="custContact"
                    placeholder="Ex: contato@alfa.com.br - (11) 9988-7766"
                    value={customerContact}
                    onChange={(e) => setCustomerContact(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-slate-700">
                  Observações / Dados de Faturamento
                </Label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Textarea
                    id="notes"
                    placeholder="Instruções de entrega, nota fiscal ou calibração..."
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    className="pl-9 min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SELEÇÃO DE ITENS (DUPLO MODO: "POR LOTE" OU "POR EQUIPAMENTO") */}
          {currentStep === 2 && (
            <div className="space-y-5 py-2">
              {/* Seletor Dinâmico de Modo de Venda */}
              <div className="flex items-center justify-between p-2.5 bg-slate-100/90 rounded-xl border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 pl-1">
                  Modo de seleção de itens:
                </div>
                <div className="inline-flex rounded-lg bg-white p-1 border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setSelectionMode('batch')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                      selectionMode === 'batch'
                        ? 'bg-[#d9532f] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Por Lote (Recomendado / Venda em Quantidade)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode('equipment')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                      selectionMode === 'equipment'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    Por Equipamento Específico
                  </button>
                </div>
              </div>

              {/* MODO 1: POR LOTE DE COMPRA (NOVO FLUXO DINÂMICO) */}
              {selectionMode === 'batch' && (
                <div className="p-4 bg-orange-50/50 border border-orange-200/80 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#d9532f]" />
                      Adicionar por Lote de Compra
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      O sistema baixa automaticamente os N primeiros equipamentos disponíveis do
                      lote
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Seletor do Lote de Compra */}
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-700 font-semibold">
                        Lote de Compra (Fornecedor / NF / Estoque Disponível)
                      </Label>
                      <Select
                        value={selectedPurchaseBatchId}
                        onValueChange={handlePurchaseBatchChange}
                      >
                        <SelectTrigger className="bg-white border-slate-300">
                          <SelectValue placeholder="Selecione o lote de compra com estoque disponível..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {purchaseBatchesWithAvailability.map((pbItem) => {
                            const hasStock = pbItem.availableCount > 0
                            return (
                              <SelectItem
                                key={pbItem.id}
                                value={pbItem.id}
                                disabled={!hasStock}
                                className="py-2"
                              >
                                <div className="flex items-center justify-between gap-3 w-full">
                                  <span className="font-semibold text-slate-900">
                                    {pbItem.supplier}
                                    {pbItem.invoice_number ? ` (NF ${pbItem.invoice_number})` : ''}
                                  </span>
                                  <span className="text-xs font-mono font-bold ml-2">
                                    {hasStock ? (
                                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                        {pbItem.availableCount} un disponíveis
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic">Sem disponível</span>
                                    )}
                                  </span>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Card de Detalhes do Lote Selecionado */}
                    {activePurchaseBatchObj && (
                      <div className="p-3 bg-white border border-orange-200 rounded-lg text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <span className="text-slate-500">Lote: </span>
                            <strong className="text-slate-900 font-semibold">
                              {activePurchaseBatchObj.supplier}
                              {activePurchaseBatchObj.invoice_number
                                ? ` — NF ${activePurchaseBatchObj.invoice_number}`
                                : ''}
                            </strong>
                            {activePurchaseBatchObj.location && (
                              <span className="text-slate-500 ml-2">
                                (Local: {activePurchaseBatchObj.location})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold text-[11px]">
                              {activePurchaseBatchObj.availableCount} equipamento(s) disponível(is)
                            </span>
                          </div>
                        </div>

                        {activePurchaseBatchObj.modelsSummary && (
                          <div className="text-slate-600 text-[11px]">
                            <span className="font-semibold text-slate-700">Modelos no lote: </span>
                            <span>{activePurchaseBatchObj.modelsSummary}</span>
                          </div>
                        )}

                        {activePurchaseBatchObj.suggestedUnitPrice > 0 && (
                          <div className="text-[11px] text-slate-500">
                            Preço médio de cadastro do lote:{' '}
                            <strong className="text-slate-800">
                              R$ {activePurchaseBatchObj.suggestedUnitPrice.toFixed(2)}
                            </strong>{' '}
                            (sugerido automaticamente no campo de preço)
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inputs de Quantidade e Preço Unitário */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {/* Quantidade */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-700 font-medium">
                          Quantidade a Vender
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max={activePurchaseBatchObj?.availableCount || 1}
                          value={batchQuantity}
                          onChange={(e) => setBatchQuantity(parseInt(e.target.value) || 1)}
                          disabled={
                            !selectedPurchaseBatchId ||
                            (activePurchaseBatchObj?.availableCount || 0) <= 0
                          }
                          className="bg-white border-slate-300"
                        />
                        {activePurchaseBatchObj && (
                          <span className="text-[10px] text-slate-500">
                            Máximo: {activePurchaseBatchObj.availableCount} un
                          </span>
                        )}
                      </div>

                      {/* Preço Unitário Negociado */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-700 font-medium">
                          Preço Unitário Negociado (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={batchUnitPrice}
                          onChange={(e) => setBatchUnitPrice(parseFloat(e.target.value) || 0)}
                          disabled={!selectedPurchaseBatchId}
                          className="bg-white border-slate-300 font-mono"
                        />
                        <span className="text-[10px] text-slate-500">
                          Subtotal da linha: R$ {(batchQuantity * batchUnitPrice).toFixed(2)}
                        </span>
                      </div>

                      {/* Botão Adicionar Lote ao Pedido */}
                      <div className="flex flex-col justify-end">
                        <Button
                          type="button"
                          onClick={handleAddBatchToCart}
                          disabled={
                            !selectedPurchaseBatchId ||
                            (activePurchaseBatchObj?.availableCount || 0) <= 0 ||
                            batchQuantity <= 0
                          }
                          className="bg-[#d9532f] hover:bg-[#c24624] text-white w-full gap-1.5 font-bold shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar Lote ao Pedido
                        </Button>
                      </div>
                    </div>

                    {batchItemError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>{batchItemError}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MODO 2: POR EQUIPAMENTO (FLUXO TRADICIONAL INTOCADO) */}
              {selectionMode === 'equipment' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    Selecionar Equipamento & Lote Específico
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Produto */}
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">Produto</Label>
                      <Select value={selectedProductId} onValueChange={handleProductChange}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecione o equipamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => {
                            const isPending = p.status === 'Pendente de ativação'
                            return (
                              <SelectItem key={p.id} value={p.id} disabled={isPending}>
                                {p.name} ({p.sku})
                                {isPending ? ' — Pendente de ativação — insira o PN' : ''}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Lote */}
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">
                        Lote Físico (Disponibilidade)
                      </Label>
                      <Select
                        value={selectedBatchId}
                        onValueChange={handleBatchChange}
                        disabled={!selectedProductId}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue
                            placeholder={
                              !selectedProductId
                                ? 'Escolha o produto primeiro'
                                : availableBatchesForProduct.length === 0
                                  ? 'Sem lotes com estoque!'
                                  : 'Selecione o lote'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availableBatchesForProduct.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.batch_number} — {b.quantity} un disponíveis (
                              {b.location || 'Sem local'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {activeBatchObj && (
                    <div className="text-xs p-2.5 bg-blue-50/70 border border-blue-200/60 rounded text-blue-900 flex items-center justify-between">
                      <span>
                        <strong>Lote ativo:</strong> {activeBatchObj.batch_number} (Local:{' '}
                        {activeBatchObj.location || 'Depósito Geral'})
                      </span>
                      <span className="font-bold">Estoque Atual: {activeBatchObj.quantity} un</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Quantidade */}
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">Quantidade</Label>
                      <Input
                        type="number"
                        min="1"
                        max={activeBatchObj?.quantity || 1}
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                        className="bg-white"
                      />
                    </div>

                    {/* Preço Unitário */}
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">Preço Unitário (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemUnitPrice}
                        onChange={(e) => setItemUnitPrice(parseFloat(e.target.value) || 0)}
                        className="bg-white"
                      />
                    </div>

                    {/* Subtotal preview & Button */}
                    <div className="flex flex-col justify-end">
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedBatchId}
                        className="bg-slate-900 hover:bg-slate-800 text-white w-full gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar ao Pedido
                      </Button>
                    </div>
                  </div>

                  {itemError && (
                    <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{itemError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Current Cart Items Table (Unificada: aceita múltiplas linhas por lote e/ou por equipamento) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4 text-emerald-600" />
                    Carrinho do Pedido ({cart.length} linha{cart.length !== 1 ? 's' : ''} —{' '}
                    {cart.reduce((a, b) => a + b.quantity, 0)} unidades)
                  </h4>
                  <span className="text-sm font-bold text-slate-900">
                    Total: R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {cart.length === 0 ? (
                  <div className="p-6 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                    Nenhum item ou lote adicionado ainda. Escolha a opção &quot;Por Lote&quot; ou
                    &quot;Por Equipamento&quot; acima para incluir no pedido.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Modo / Origem</th>
                          <th className="py-2.5 px-3">Descrição / Lote</th>
                          <th className="py-2.5 px-3 text-center">Qtd</th>
                          <th className="py-2.5 px-3 text-right">Unitário</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                          <th className="py-2.5 px-3 text-center">Remover</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cart.map((item) => (
                          <tr key={item.tempId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {item.type === 'batch' ? (
                                <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px] font-bold gap-1">
                                  <Layers className="w-3 h-3" />
                                  Por Lote
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-bold gap-1">
                                  <Package className="w-3 h-3" />
                                  Individual
                                </Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-900 block">
                                {item.productName}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                Lote: {item.batchNumber}
                                {item.sku ? ` — SKU: ${item.sku}` : ''}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900 whitespace-nowrap">
                              {item.quantity} un
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                              R$ {item.unitPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              R$ {(item.quantity * item.unitPrice).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCartItem(item.tempId)}
                                className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: REVISÃO E PAGAMENTO */}
          {currentStep === 3 && (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Resumo Geral da Venda
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Cliente:</span>
                    <strong className="text-slate-800 text-sm">{customerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Contato:</span>
                    <strong className="text-slate-800">{customerContact || 'Não informado'}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Vendedor Responsável:</span>
                    <strong className="text-slate-800">{user?.name || 'Equipe Skip'}</strong>
                  </div>
                  {saleNotes && (
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Observações:</span>
                      <p className="text-slate-700 bg-white p-2 rounded border border-slate-200 mt-1">
                        {saleNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Itens e Lotes Selecionados ({cart.length} linha{cart.length !== 1 ? 's' : ''})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs bg-white">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="p-2.5">Tipo</th>
                        <th className="p-2.5">Descrição</th>
                        <th className="p-2.5">Lote / Ref</th>
                        <th className="p-2.5 text-center">Qtd</th>
                        <th className="p-2.5 text-right">Unitário</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cart.map((c) => (
                        <tr key={c.tempId}>
                          <td className="p-2.5">
                            {c.type === 'batch' ? (
                              <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px] font-bold">
                                Lote
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                                Item
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5 font-medium">{c.productName}</td>
                          <td className="p-2.5 font-mono">{c.batchNumber}</td>
                          <td className="p-2.5 text-center font-bold">{c.quantity}</td>
                          <td className="p-2.5 text-right font-mono">
                            R$ {c.unitPrice.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            R$ {(c.quantity * c.unitPrice).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Card */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
                    Valor Total a Pagar
                  </span>
                  <span className="text-xs text-emerald-700">
                    Forma de pagamento padrão: Faturado / À vista
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-800">
                  R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: FINALIZAÇÃO */}
          {currentStep === 4 && (
            <div className="space-y-5 py-4 text-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Pronto para finalizar o pedido!
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto mt-1">
                  Ao confirmar, o sistema registrará a venda e o backend executará imediatamente a
                  baixa de estoque nos <strong>{cart.length} lote(s) selecionado(s)</strong>,
                  vinculando cada equipamento aos respectivos lotes de compra e histórico.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 max-w-sm mx-auto text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <strong className="text-slate-800">{customerName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Linhas do Pedido:</span>
                  <strong className="text-slate-800">{cart.length} linha(s)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Qtd Total de Unidades:</span>
                  <strong className="text-slate-800">
                    {cart.reduce((a, b) => a + b.quantity, 0)} unidades
                  </strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-semibold">Valor Final:</span>
                  <strong className="text-emerald-700 font-mono text-sm">
                    R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-slate-100 pt-3">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={isSubmitting}
                  className="gap-1 text-slate-600"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setWizardOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-slate-900 hover:bg-slate-800 text-white gap-1"
                >
                  Avançar
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleFinalizeSale}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Baixando estoque...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Finalizar Venda & Baixar Lotes
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SALE DETAIL DIALOG */}
      <Dialog open={!!detailSale} onOpenChange={(open) => !open && setDetailSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center justify-between">
              <span>Detalhes da Venda</span>
              {detailSale?.status === 'completed' && (
                <Badge className="bg-emerald-100 text-emerald-800 border-none">Concluída</Badge>
              )}
              {detailSale?.status === 'draft' && (
                <Badge className="bg-amber-100 text-amber-800 border-none">Pendente</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Informações do comprador e lotes físicos associados a este pedido.
            </DialogDescription>
          </DialogHeader>

          {detailSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500 block">Cliente:</span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {detailSale.customer_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Contato:</span>
                  <span className="font-semibold text-slate-800">
                    {detailSale.customer_contact || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Data de Criação:</span>
                  <span className="font-mono text-slate-700">
                    {new Date(detailSale.created).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Vendedor:</span>
                  <span className="font-semibold text-slate-800">
                    {detailSale.expand?.user_id?.name || 'Equipe'}
                  </span>
                </div>
                {detailSale.notes && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Observações:</span>
                    <p className="text-slate-700 bg-white p-2 rounded border border-slate-200 mt-0.5">
                      {detailSale.notes}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Equipamentos & Lotes Faturados
                </h4>
                {loadingDetails ? (
                  <div className="p-4 text-center text-xs text-slate-500">Carregando itens...</div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                        <tr>
                          <th className="p-2.5">Equipamento</th>
                          <th className="p-2.5">Lote</th>
                          <th className="p-2.5 text-center">Qtd</th>
                          <th className="p-2.5 text-right">Unitário</th>
                          <th className="p-2.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailItems.map((item) => (
                          <tr key={item.id}>
                            <td className="p-2.5 font-medium text-slate-900">
                              {item.expand?.product_id?.name || 'Produto'}
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {item.expand?.product_id?.sku}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono text-slate-700 font-semibold">
                              {item.expand?.batch_id?.batch_number || 'Lote'}
                            </td>
                            <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                            <td className="p-2.5 text-right font-mono">
                              R$ {Number(item.unit_price).toFixed(2)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              R$ {Number(item.subtotal).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-100 rounded-lg flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Total da Venda</span>
                <span className="font-bold font-mono text-slate-900 text-base">
                  R${' '}
                  {Number(detailSale.total_amount).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Ações dentro do modal de detalhe */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {detailSale.status === 'cancelled' ? (
                    <span className="text-slate-500 italic">
                      Venda com estoque devolvido aos lotes
                    </span>
                  ) : (
                    <span>Ações de gestão da venda</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSaleToEdit(detailSale)
                      setEditModalOpen(true)
                    }}
                    className="h-8 text-xs gap-1.5 border-slate-300 hover:bg-slate-100"
                  >
                    <Edit className="w-3.5 h-3.5 text-blue-600" />
                    Editar Dados
                  </Button>

                  {detailSale.status !== 'cancelled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSaleToCancel(detailSale)
                        setCancelModalOpen(true)
                      }}
                      className="h-8 text-xs gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancelar Venda
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Venda */}
      <EditSaleModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        sale={saleToEdit}
        onSuccess={() => {
          loadData()
          if (detailSale && saleToEdit && detailSale.id === saleToEdit.id) {
            handleOpenDetails(detailSale.id)
          }
        }}
      />

      {/* Modal de Confirmação de Cancelamento de Venda */}
      <CancelSaleModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        sale={saleToCancel}
        onSuccess={() => {
          loadData()
          if (detailSale && saleToCancel && detailSale.id === saleToCancel.id) {
            handleOpenDetails(detailSale.id)
          }
        }}
      />

      {/* Modal de Emissão de Nota Fiscal Eletrônica */}
      <EmitirNFModal
        open={emitNFOpen}
        onOpenChange={setEmitNFOpen}
        originType="sale_internal"
        sale={saleToEmitNF}
        onSuccess={() => {
          loadData()
        }}
      />
    </div>
  )
}
