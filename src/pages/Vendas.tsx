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
  Layers,
  ArrowRight,
  ArrowLeft,
  Check,
  Package,
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
import { useRealtime } from '@/hooks/use-realtime'
import { salesService } from '@/services/sales'
import { productsService } from '@/services/products'
import { batchesService } from '@/services/batches'
import type { Sale, Product, Batch, SaleItem } from '@/types/inventory'

interface CartItem {
  tempId: string
  productId: string
  productName: string
  sku: string
  batchId: string
  batchNumber: string
  availableStock: number
  quantity: number
  unitPrice: number
}

export default function Vendas() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

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

  // Step 2: Item Selection
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [itemQuantity, setItemQuantity] = useState<number>(1)
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0)
  const [itemError, setItemError] = useState<string | null>(null)

  // Details Modal
  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [detailItems, setDetailItems] = useState<SaleItem[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  const { toast } = useToast()
  const { user } = useAuth()
  const location = useLocation()

  const loadData = async () => {
    try {
      const [sData, pData, bData] = await Promise.all([
        salesService.getAll(),
        productsService.getAll(),
        batchesService.getAll(),
      ])
      setSales(sData)
      setProducts(pData)
      setBatches(bData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Check URL params for quick actions
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('nova') === 'true') {
      openNewSaleWizard()
    }
    const detalheId = params.get('detalhe')
    if (detalheId) {
      handleOpenDetails(detalheId)
    }
  }, [location.search])

  // Realtime subscription
  useRealtime<Sale>('sales', () => {
    salesService.getAll().then(setSales)
  })

  useRealtime<Batch>('batches', () => {
    batchesService.getAll().then(setBatches)
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

  // Batches available for chosen product
  const availableBatchesForProduct = useMemo(() => {
    if (!selectedProductId) return []
    return batches.filter((b) => b.product_id === selectedProductId && b.quantity > 0)
  }, [batches, selectedProductId])

  // Selected batch object
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

  // Add Item to cart
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
      .filter((c) => c.batchId === selectedBatchId)
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
    setSelectedProductId('')
    setSelectedBatchId('')
    setItemQuantity(1)
    setItemError(null)
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

  // Finalize Sale
  const handleFinalizeSale = async () => {
    setIsSubmitting(true)
    try {
      await salesService.createSale({
        customer_name: customerName,
        customer_contact: customerContact,
        notes: saleNotes,
        items: cart.map((c) => ({
          product_id: c.productId,
          batch_id: c.batchId,
          quantity: c.quantity,
          unit_price: c.unitPrice,
        })),
      })

      toast({
        title: 'Venda finalizada com sucesso!',
        description: 'Baixa de estoque realizada automaticamente nos lotes vinculados.',
      })

      setWizardOpen(false)
      // reload
      await loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao finalizar venda',
        description: 'Ocorreu uma falha na comunicação com o backend. Tente novamente.',
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Gestão de Vendas</h2>
          <p className="text-sm text-slate-500">
            Fluxo completo de vendas com rastreabilidade por lote e baixa automática no estoque.
          </p>
        </div>
        <Button
          onClick={openNewSaleWizard}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Venda
        </Button>
      </div>

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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetails(sale.id)}
                        className="h-8 text-xs gap-1 border-slate-200 hover:bg-slate-100"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Itens
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

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

          {/* STEP 2: SELEÇÃO DE ITENS (PRODUTO -> LOTE ESPECÍFICO -> QUANTIDADE) */}
          {currentStep === 2 && (
            <div className="space-y-5 py-2">
              {/* Item Adder Box */}
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
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Lote */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Lote Físico (Disponibilidade)</Label>
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

              {/* Current Cart Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Itens no Pedido ({cart.length})
                  </h4>
                  <span className="text-sm font-bold text-slate-900">
                    Total: R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {cart.length === 0 ? (
                  <div className="p-6 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                    Nenhum item adicionado ainda. Selecione o equipamento e o lote acima para
                    incluir no pedido.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold uppercase">
                        <tr>
                          <th className="py-2 px-3">Produto</th>
                          <th className="py-2 px-3">Lote Vinculado</th>
                          <th className="py-2 px-3 text-center">Qtd</th>
                          <th className="py-2 px-3 text-right">Unitário</th>
                          <th className="py-2 px-3 text-right">Subtotal</th>
                          <th className="py-2 px-3 text-center">Remover</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cart.map((item) => (
                          <tr key={item.tempId} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-slate-900">
                              {item.productName}
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {item.sku}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700 font-semibold">
                              {item.batchNumber}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-slate-900">
                              {item.quantity} un
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              R$ {item.unitPrice.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              R$ {(item.quantity * item.unitPrice).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
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
                  Itens Selecionados ({cart.length})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="p-2">Item</th>
                        <th className="p-2">Lote</th>
                        <th className="p-2 text-center">Qtd</th>
                        <th className="p-2 text-right">Unitário</th>
                        <th className="p-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cart.map((c) => (
                        <tr key={c.tempId}>
                          <td className="p-2 font-medium">{c.productName}</td>
                          <td className="p-2 font-mono">{c.batchNumber}</td>
                          <td className="p-2 text-center font-bold">{c.quantity}</td>
                          <td className="p-2 text-right font-mono">R$ {c.unitPrice.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold">
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
                  baixa de estoque nos <strong>{cart.length} lote(s) selecionado(s)</strong>.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-w-sm mx-auto text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <strong className="text-slate-800">{customerName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Qtd Total de Itens:</span>
                  <strong className="text-slate-800">
                    {cart.reduce((a, b) => a + b.quantity, 0)} unidades
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valor Final:</span>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
