import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Boxes,
  Plus,
  DollarSign,
  TrendingUp,
  Wrench,
  CheckCircle2,
  Clock,
  Layers,
  Laptop,
  Check,
  AlertCircle,
  AlertTriangle,
  FileText,
  Calendar,
  ChevronRight,
  ExternalLink,
  Edit2,
  Trash2,
  Loader2,
  Sparkles,
  Edit3,
  ArrowRightLeft,
  Copy,
  MapPin,
  Printer,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { EditBatchModal } from '@/components/EditBatchModal'
import { DeletePurchaseBatchModal } from '@/components/DeletePurchaseBatchModal'
import { TransferEquipmentModal } from '@/components/TransferEquipmentModal'
import { CloneEquipmentModal } from '@/components/CloneEquipmentModal'
import { EtiquetaModal, type EtiquetaData } from '@/components/EtiquetaModal'
import { BatchEquipmentPriceStatusModal } from '@/components/BatchEquipmentPriceStatusModal'
import { BatchReportModal } from '@/components/BatchReportModal'
import { LayoutGrid, ListFilter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { purchaseBatchesService } from '@/services/purchaseBatches'
import { productsService } from '@/services/products'
import { equipmentService } from '@/services/equipment'
import type { PurchaseBatch, Product, EquipmentPart, EquipmentPartStatus } from '@/types/inventory'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

export default function LoteEntradaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [batch, setBatch] = useState<PurchaseBatch | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [parts, setParts] = useState<EquipmentPart[]>([])
  const [loading, setLoading] = useState(true)

  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const { currentTenant } = useTenant()
  const navigate = useNavigate()

  // Modal de Adicionar / Editar Peça
  const [partModalOpen, setPartModalOpen] = useState(false)
  const [editingPart, setEditingPart] = useState<EquipmentPart | null>(null)
  const [partName, setPartName] = useState('')
  const [partCost, setPartCost] = useState<number>(0)
  const [partQuantity, setPartQuantity] = useState<number>(1)
  const [partSupplier, setPartSupplier] = useState('')
  const [partPurchaseDate, setPartPurchaseDate] = useState('')
  const [partProductId, setPartProductId] = useState<string>('batch') // 'batch' ou ID de produto
  const [partStatus, setPartStatus] = useState<EquipmentPartStatus>('Comprada')
  const [partNotes, setPartNotes] = useState('')
  const [savingPart, setSavingPart] = useState(false)

  // Diálogo de Confirmação para Remover Peça
  const [partToDelete, setPartToDelete] = useState<EquipmentPart | null>(null)
  const [deletingPart, setDeletingPart] = useState(false)

  // 1. Edição Completa do Lote e Exclusão Segura
  const [editBatchModalOpen, setEditBatchModalOpen] = useState(false)
  const [deleteBatchModalOpen, setDeleteBatchModalOpen] = useState(false)

  // 2. Transferência de Equipamentos (Seleção Múltipla)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [transferModalOpen, setTransferModalOpen] = useState(false)

  // 3. Clonagem de Equipamento dentro do Lote
  const [cloneModalOpen, setCloneModalOpen] = useState(false)
  const [productToClone, setProductToClone] = useState<Product | null>(null)

  // 4. Ativação Rápida de Equipamento (Pendente de ativação -> Disponível com PN)
  const [activateModalOpen, setActivateModalOpen] = useState(false)
  const [productToActivate, setProductToActivate] = useState<Product | null>(null)
  const [activatePartNumber, setActivatePartNumber] = useState('')
  const [activateSerialNumber, setActivateSerialNumber] = useState('')
  const [activatingProduct, setActivatingProduct] = useState(false)

  // 5. Filtro de pendentes de ativação
  const [filterOnlyPending, setFilterOnlyPending] = useState(false)

  // 6. Exclusão em Massa de Equipamentos
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  // 7. Impressão de Etiquetas em Massa
  const [etiquetaModalOpen, setEtiquetaModalOpen] = useState(false)

  // 8. Criação em Massa de Part Numbers Internos (AMB0001, AMB0002...)
  const [bulkInternalPnModalOpen, setBulkInternalPnModalOpen] = useState(false)
  const [generatingBulkPn, setGeneratingBulkPn] = useState(false)

  // 9. Alteração em Massa de Preço / Status
  const [bulkPriceStatusModalOpen, setBulkPriceStatusModalOpen] = useState(false)

  // 10. Alternância entre Visão Individual e Visão Agrupada por Modelo/Config
  const [viewMode, setViewMode] = useState<'individual' | 'grouped'>('individual')

  // 11. Modal de Relatório Executivo do Lote
  const [reportModalOpen, setReportModalOpen] = useState(false)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const batchData = await purchaseBatchesService.getById(id)

      // Verificação de isolamento multi-tenant: se o lote pertencer a outro tenant, bloquear exibição
      const activeTenantId = currentTenant?.id
      if (activeTenantId && batchData.tenant_id && batchData.tenant_id !== activeTenantId) {
        setBatch(null)
        setProducts([])
        setParts([])
        return
      }

      setBatch(batchData)

      const batchProducts = await purchaseBatchesService.getProductsByBatchId(id)
      setProducts(batchProducts)

      // 1. Busca peças diretamente vinculadas a este lote (1 query única)
      const batchDirectParts = await equipmentService.getPartsByBatch(id)

      // 2. Busca peças vinculadas a qualquer produto deste lote de forma agregada em lote (SEM N+1)
      const productIds = batchProducts.map((p) => p.id)
      const allProductParts = await equipmentService.getPartsByProductIds(productIds)

      // Merge evitando duplicatas caso uma peça aponte tanto para purchase_batch_id quanto product_id
      const seen = new Set<string>()
      const mergedParts: EquipmentPart[] = []
      for (const p of [...batchDirectParts, ...allProductParts]) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          mergedParts.push(p)
        }
      }
      setParts(mergedParts)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao carregar detalhes do lote',
        description: err?.message || 'Lote não encontrado.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id, currentTenant?.id])

  // Calculations
  const expectedQty = Number(batch?.expected_quantity) || 1
  const inventoriedCount = products.length
  const missingCount = Math.max(0, expectedQty - inventoriedCount)
  const progressPct = Math.min(100, Math.round((inventoriedCount / expectedQty) * 100))

  const acquisitionCost = Number(batch?.total_cost) || 0
  // Custo de peças calculado por (custo unitário × quantidade)
  const partsAndServicesCost = parts.reduce(
    (acc, part) => acc + (Number(part.cost) || 0) * (Number(part.quantity) || 1),
    0,
  )
  const totalPartsQuantity = parts.reduce((acc, part) => acc + (Number(part.quantity) || 1), 0)
  const totalCostOverall = acquisitionCost + partsAndServicesCost
  // Custo-base por item do lote (custo total do lote ÷ quantidade esperada/total de itens)
  const averageUnitCost = expectedQty > 0 ? totalCostOverall / expectedQty : 0
  const baseCostPerExpectedItem = expectedQty > 0 ? acquisitionCost / expectedQty : 0

  // Divisor para rateio das peças: usa a quantidade de notebooks inventariados se houver itens,
  // ou a quantidade esperada do lote para estimativas prévias
  const divisorEquipamentos = products.length > 0 ? products.length : expectedQty

  // Custo de peças rateado por equipamento (para compor o custo efetivo de aquisição)
  const partsSharePerNotebook =
    divisorEquipamentos > 0 ? partsAndServicesCost / divisorEquipamentos : 0

  // Modal de ativação/desativação em massa dedicado
  const [bulkStatusTarget, setBulkStatusTarget] = useState<'Disponível' | 'Pendente de ativação'>(
    'Disponível',
  )

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedProductIds.length === displayedProducts.length && displayedProducts.length > 0) {
      setSelectedProductIds([])
    } else {
      setSelectedProductIds(displayedProducts.map((p) => p.id))
    }
  }

  const toggleSelectOne = (prodId: string) => {
    if (selectedProductIds.includes(prodId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== prodId))
    } else {
      setSelectedProductIds([...selectedProductIds, prodId])
    }
  }

  const selectedProductsList = useMemo(() => {
    return products.filter((p) => selectedProductIds.includes(p.id))
  }, [products, selectedProductIds])

  // Equipamentos selecionados que realmente estão pendentes de ativação e sem PN
  const selectedPendingActivationProducts = useMemo(() => {
    return selectedProductsList.filter(
      (p) => p.status === 'Pendente de ativação' && (!p.part_number || !p.part_number.trim()),
    )
  }, [selectedProductsList])

  const selectedAlreadyActiveCount = useMemo(() => {
    return selectedProductsList.length - selectedPendingActivationProducts.length
  }, [selectedProductsList, selectedPendingActivationProducts])

  const selectedEtiquetasData = useMemo<EtiquetaData[]>(() => {
    return selectedProductsList.map((p) => ({
      product: p,
      batchNumber: batch?.supplier
        ? `${batch.supplier}${batch.invoice_number ? ` - NF ${batch.invoice_number}` : ''}`
        : undefined,
      location: batch?.location || undefined,
      status: p.status,
      price: Number(p.unit_price) || 0,
      serialNumber: p.serial_number || p.part_number || p.sku,
      sku: p.sku,
      productName:
        p.name || [p.brand, p.model, p.processor].filter(Boolean).join(' ') || 'Equipamento',
      brand: p.brand,
      model: p.model,
    }))
  }, [selectedProductsList, batch])

  const handleOpenCloneSingle = (p: Product) => {
    setProductToClone(p)
    setCloneModalOpen(true)
  }

  const handleOpenCloneSelected = () => {
    if (selectedProductsList.length === 1) {
      setProductToClone(selectedProductsList[0])
      setCloneModalOpen(true)
    }
  }

  // Handlers para Ativação Rápida
  const handleOpenActivateModal = (p: Product) => {
    setProductToActivate(p)
    setActivatePartNumber(p.part_number || '')
    setActivateSerialNumber(p.serial_number || '')
    setActivateModalOpen(true)
  }

  const handleConfirmActivation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productToActivate) return
    if (!activatePartNumber.trim()) {
      toast({
        title: 'Part Number obrigatório',
        description: 'Informe o Part Number para ativar o equipamento.',
        variant: 'destructive',
      })
      return
    }

    setActivatingProduct(true)
    try {
      await productsService.update(productToActivate.id, {
        part_number: activatePartNumber.trim(),
        serial_number: activateSerialNumber.trim() || undefined,
        status: 'Disponível',
      })
      toast({
        title: 'Equipamento ativado com sucesso!',
        description: `${productToActivate.name} agora está Disponível com o Part Number ${activatePartNumber.trim()}.`,
      })
      setActivateModalOpen(false)
      setProductToActivate(null)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao ativar equipamento',
        description: err?.message || 'Não foi possível salvar o Part Number.',
        variant: 'destructive',
      })
    } finally {
      setActivatingProduct(false)
    }
  }

  // Contagem de pendentes de ativação
  const pendingActivationCount = useMemo(() => {
    return products.filter((p) => p.status === 'Pendente de ativação').length
  }, [products])

  // Produtos filtrados se o filtro de pendentes estiver ativo
  const displayedProducts = useMemo(() => {
    if (filterOnlyPending) {
      return products.filter((p) => p.status === 'Pendente de ativação')
    }
    return products
  }, [products, filterOnlyPending])

  // Agrupamento de equipamentos por modelo / variante / specs idênticos
  interface ProductGroup {
    groupKey: string
    title: string
    brand: string
    model: string
    specs: string
    condition: string
    items: Product[]
    count: number
    availableCount: number
    reservedCount: number
    pendingCount: number
    soldCount: number
    avgUnitPrice: number
    minUnitPrice: number
    maxUnitPrice: number
    avgCostPrice: number
    avgEffectiveCostPrice: number
    avgEstimatedProfit: number
    avgMarginPct: number
  }

  const groupedProducts = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, Product[]>()

    displayedProducts.forEach((p) => {
      // Cria chave baseada em modelo, marca, processador, ram, storage e estética
      const b = (p.brand || '').trim().toLowerCase()
      const m = (p.model || '').trim().toLowerCase()
      const proc = (p.processor || '').trim().toLowerCase()
      const r = (p.ram || '').trim().toLowerCase()
      const st = (p.storage || '').trim().toLowerCase()
      const cond = (p.aesthetic_grade || p.condition || '').trim().toLowerCase()

      // Chave única para o conjunto idêntico
      const key = `${b}|${m}|${proc}|${r}|${st}|${cond}`
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(p)
    })

    const groups: ProductGroup[] = []
    map.forEach((items, groupKey) => {
      const first = items[0]
      const count = items.length

      const availableCount = items.filter((i) => i.status === 'Disponível').length
      const reservedCount = items.filter((i) => i.status === 'Reservado').length
      const pendingCount = items.filter((i) => i.status === 'Pendente de ativação').length
      const soldCount = items.filter((i) => i.status === 'Vendido').length

      const prices = items.map((i) => Number(i.unit_price) || 0)
      const sumPrice = prices.reduce((a, b) => a + b, 0)
      const avgUnitPrice = count > 0 ? sumPrice / count : 0
      const minUnitPrice = prices.length > 0 ? Math.min(...prices) : 0
      const maxUnitPrice = prices.length > 0 ? Math.max(...prices) : 0

      // Custo base (equipamento sem peças ou com rateio do lote se 0)
      const rawCosts = items.map((i) => {
        const c = Number(i.cost_price) || 0
        return c > 0 ? c : divisorEquipamentos > 0 ? acquisitionCost / divisorEquipamentos : 0
      })
      const sumCost = rawCosts.reduce((a, b) => a + b, 0)
      const avgCostPrice = count > 0 ? sumCost / count : 0

      // Custo efetivo com a parcela proporcional das peças distribuída
      const avgEffectiveCostPrice = avgCostPrice + partsSharePerNotebook
      const avgEstimatedProfit = avgUnitPrice - avgEffectiveCostPrice
      const avgMarginPct =
        avgEffectiveCostPrice > 0 ? (avgEstimatedProfit / avgEffectiveCostPrice) * 100 : 0

      const specsParts = [first.processor, first.ram, first.storage, first.screen_size].filter(
        Boolean,
      )

      groups.push({
        groupKey,
        title: first.name || `${first.brand || ''} ${first.model || ''}`.trim() || 'Equipamento',
        brand: first.brand || 'Não inf.',
        model: first.model || '',
        specs: specsParts.join(' • ') || 'Configuração padrão',
        condition: first.aesthetic_grade || first.condition || 'Bom',
        items,
        count,
        availableCount,
        reservedCount,
        pendingCount,
        soldCount,
        avgUnitPrice,
        minUnitPrice,
        maxUnitPrice,
        avgCostPrice,
        avgEffectiveCostPrice,
        avgEstimatedProfit,
        avgMarginPct,
      })
    })

    // Ordena do maior grupo para o menor
    return groups.sort((a, b) => b.count - a.count)
  }, [displayedProducts, divisorEquipamentos, acquisitionCost, partsSharePerNotebook])

  // Helper para selecionar todos os itens de um grupo
  const toggleSelectGroup = (groupItems: Product[]) => {
    const groupIds = groupItems.map((p) => p.id)
    const allSelected = groupIds.every((id) => selectedProductIds.includes(id))

    if (allSelected) {
      // Remove todos do grupo da seleção
      setSelectedProductIds(selectedProductIds.filter((id) => !groupIds.includes(id)))
    } else {
      // Adiciona todos do grupo que ainda não estão
      const newSelected = [...selectedProductIds]
      groupIds.forEach((id) => {
        if (!newSelected.includes(id)) newSelected.push(id)
      })
      setSelectedProductIds(newSelected)
    }
  }

  // Handler de exclusão em massa
  const handleConfirmBulkDelete = async () => {
    if (selectedProductIds.length === 0) return
    setDeletingBulk(true)
    try {
      const result = await productsService.deleteBulk(selectedProductIds)

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
      setSelectedProductIds([])
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

  // Handler para Geração em Massa de PNs Internos
  const handleConfirmBulkInternalPn = async () => {
    if (selectedPendingActivationProducts.length === 0) {
      toast({
        title: 'Nenhum equipamento elegível',
        description:
          'Todos os equipamentos selecionados já possuem PN ou já estão ativados. Nenhum PN real foi modificado.',
        variant: 'destructive',
      })
      setBulkInternalPnModalOpen(false)
      return
    }

    setGeneratingBulkPn(true)
    try {
      const idsToProcess = selectedPendingActivationProducts.map((p) => p.id)
      const result = await productsService.generateInternalPartNumbersBulk(idsToProcess)

      const totalIgnored = (result.ignoredAlreadyActiveCount || 0) + selectedAlreadyActiveCount
      const totalCreated = result.activatedCount || 0

      if (totalCreated > 0) {
        toast({
          title: 'PNs Internos criados com sucesso!',
          description: `${totalCreated} PN(s) interno(s) criado(s) e ativado(s) como Disponível.${
            totalIgnored > 0 ? ` ${totalIgnored} ignorado(s) por já possuírem PN.` : ''
          }`,
        })
      } else {
        toast({
          title: 'Nenhum PN criado',
          description: `0 PNs criados, ${totalIgnored} ignorados (já possuíam PN ou já estavam ativos).`,
        })
      }

      setBulkInternalPnModalOpen(false)
      setSelectedProductIds([])
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao gerar PNs internos',
        description: err?.message || 'Falha ao processar os códigos automáticos.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingBulkPn(false)
    }
  }

  // Estimated sales revenue and profit/deficit
  // 1. Preço de venda total estimado (soma dos preços de venda cadastrados)
  const totalTargetSales = products.reduce((acc, p) => acc + (Number(p.unit_price) || 0), 0)

  // 2. Custo efetivo real dos notebooks inventariados:
  // Se o produto tiver cost_price cadastrado explicitamente, soma esse custo + a parcela de peças rateada.
  // Caso cost_price seja 0 ou não informado, utiliza o custo base proporcional do lote (acquisitionCost ÷ divisor) + parcela de peças.
  const totalEffectiveEquipmentsCost = products.reduce((acc, p) => {
    const rawCost = Number(p.cost_price) || 0
    const baseCost =
      rawCost > 0 ? rawCost : divisorEquipamentos > 0 ? acquisitionCost / divisorEquipamentos : 0
    return acc + (baseCost + partsSharePerNotebook)
  }, 0)

  // Custo de referência considerado no lote: se todos os notebooks estiverem inventariados,
  // totalEffectiveEquipmentsCost equivale exatamente a totalCostOverall.
  const costReferenceForProfit =
    products.length > 0 ? totalEffectiveEquipmentsCost : totalCostOverall

  // Lucro = Estimativa de Venda − Custo Total Real (equipamentos + peças)
  const estimatedProfit = totalTargetSales - costReferenceForProfit

  // Margem percentual estimada: Lucro ÷ Custo (ou Lucro ÷ Venda se custo for 0)
  const estimatedMarginPct =
    costReferenceForProfit > 0
      ? (estimatedProfit / costReferenceForProfit) * 100
      : totalTargetSales > 0
        ? 100
        : 0

  // Margem sobre a venda (Markup vs Margem bruta de venda)
  const estimatedGrossMarginPct =
    totalTargetSales > 0 ? (estimatedProfit / totalTargetSales) * 100 : 0

  const handleOpenAddPartModal = () => {
    setEditingPart(null)
    setPartName('')
    setPartCost(0)
    setPartQuantity(1)
    setPartSupplier(batch?.supplier || '')
    setPartPurchaseDate(new Date().toISOString().split('T')[0])
    setPartProductId('batch')
    setPartStatus('Comprada')
    setPartNotes('')
    setPartModalOpen(true)
  }

  const handleOpenEditPartModal = (part: EquipmentPart) => {
    setEditingPart(part)
    setPartName(part.name || '')
    setPartCost(Number(part.cost) || 0)
    setPartQuantity(Math.max(1, Number(part.quantity) || 1))
    setPartSupplier(part.supplier || '')
    setPartPurchaseDate(part.purchase_date ? part.purchase_date.split(' ')[0].split('T')[0] : '')
    setPartProductId(part.product_id || 'batch')
    setPartStatus(part.status || 'Comprada')
    setPartNotes(part.notes || '')
    setPartModalOpen(true)
  }

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !partName.trim()) return

    setSavingPart(true)
    try {
      const activeTenant = currentTenant?.id || batch?.tenant_id
      const payload: any = {
        name: partName.trim(),
        cost: Number(partCost) || 0,
        quantity: Math.max(1, Number(partQuantity) || 1),
        supplier: partSupplier.trim(),
        purchase_date: partPurchaseDate ? new Date(partPurchaseDate).toISOString() : undefined,
        status: partStatus,
        notes: partNotes.trim(),
        purchase_batch_id: id,
        product_id: partProductId !== 'batch' ? partProductId : null,
        tenant_id: activeTenant,
      }

      let savedRecord: EquipmentPart
      if (editingPart) {
        savedRecord = await equipmentService.updatePart(editingPart.id, payload)
        // Atualização otimista imediata sem F5
        setParts((prev) =>
          prev.map((p) => (p.id === editingPart.id ? { ...p, ...savedRecord } : p)),
        )
        toast({
          title: 'Peça atualizada com sucesso!',
          description: `Os dados e custos da peça foram recalculados no lote.`,
        })
      } else {
        savedRecord = await equipmentService.createPart(payload)
        // Inserção otimista imediata sem F5
        setParts((prev) => [savedRecord, ...prev])
        toast({
          title: 'Peça adicionada ao lote!',
          description: `Custo de R$ ${((Number(payload.cost) || 0) * (Number(payload.quantity) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vinculado ao lote.`,
        })
      }

      setPartModalOpen(false)
      // Recarrega em segundo plano para garantir consistência
      loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar peça',
        description: err?.message || 'Falha ao gravar os dados da peça.',
        variant: 'destructive',
      })
    } finally {
      setSavingPart(false)
    }
  }

  const handleConfirmDeletePart = async () => {
    if (!partToDelete) return
    setDeletingPart(true)
    const targetId = partToDelete.id
    try {
      await equipmentService.deletePart(targetId)
      // Remoção otimista imediata sem F5
      setParts((prev) => prev.filter((p) => p.id !== targetId))
      toast({
        title: 'Peça removida',
        description: 'A peça e o respectivo custo foram deduzidos do lote.',
      })
      setPartToDelete(null)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao remover peça',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setDeletingPart(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!batch) return
    const nextStatus = batch.status === 'concluido' ? 'em_processamento' : 'concluido'
    try {
      const updated = await purchaseBatchesService.update(batch.id, { status: nextStatus })
      setBatch(updated)
      toast({
        title: nextStatus === 'concluido' ? 'Lote concluído!' : 'Lote reaberto',
        description: `O status do lote foi alterado para ${
          nextStatus === 'concluido' ? 'Concluído' : 'Em processamento'
        }.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center max-w-7xl mx-auto">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-500">Carregando detalhes do lote...</p>
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="max-w-7xl mx-auto text-center py-16">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Lote de Compra não encontrado</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          O lote solicitado não existe ou foi removido.
        </p>
        <Link to="/lotes-entrada">
          <Button variant="outline">Voltar para Compra de Lotes</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link
              to="/lotes-entrada"
              className="hover:text-orange-600 font-medium flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Compra de Lotes
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-700">
              {batch.invoice_number ? `NF ${batch.invoice_number}` : batch.supplier}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {batch.supplier}
            </h1>
            {batch.status === 'concluido' ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-none font-medium hover:bg-emerald-100">
                Concluído
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-none font-medium hover:bg-amber-100">
                Em processamento
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            {batch.invoice_number && (
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 text-xs">
                Nota Fiscal: {batch.invoice_number}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              Adquirido em:{' '}
              {batch.purchase_date
                ? new Date(batch.purchase_date).toLocaleDateString('pt-BR')
                : new Date(batch.created).toLocaleDateString('pt-BR')}
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Gerar Relatório (Destaque) */}
          <Button
            onClick={() => setReportModalOpen(true)}
            className="text-xs h-10 bg-slate-900 hover:bg-slate-800 text-white shadow-xs gap-1.5 font-bold px-3.5"
            title="Gerar relatório financeiro e executivo deste lote com gráficos e estimativas"
          >
            <FileText className="w-4 h-4 text-orange-400" />
            Gerar Relatório
          </Button>

          {/* Botão Editar Lote */}
          <Button
            variant="outline"
            onClick={() => setEditBatchModalOpen(true)}
            className="text-xs h-10 border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5 font-medium"
            title="Editar dados cadastrais, fornecedor, quantidade esperada e custos do lote"
          >
            <Edit3 className="w-4 h-4 text-[#d9532f]" />
            Editar Lote
          </Button>

          {/* Botão Excluir Lote com Validação de Segurança */}
          <Button
            variant="outline"
            onClick={() => setDeleteBatchModalOpen(true)}
            className="text-xs h-10 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1.5 font-medium"
            title="Excluir este pedido de compra com verificação de segurança contábil"
          >
            <Trash2 className="w-4 h-4" />
            Excluir Lote
          </Button>

          <Button
            variant="outline"
            onClick={handleToggleStatus}
            className="text-xs h-10 border-slate-300"
          >
            {batch.status === 'concluido' ? 'Reabrir Lote' : 'Marcar como Concluído'}
          </Button>

          <Link to={`/lotes-entrada/${batch.id}/inventariar`}>
            <Button className="bg-[#d9532f] hover:bg-[#c24624] text-white shadow-sm gap-2 h-10 font-semibold px-4">
              <Plus className="w-4 h-4" />+ Inventariar equipamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Info / Localização & Observações adicionais do Lote */}
      {(batch.location || batch.notes) && (
        <div className="bg-[#faf8f5] border border-orange-200/60 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex items-center gap-4 flex-wrap">
            {batch.location && (
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin className="w-4 h-4 text-[#d9532f]" />
                Localização: <strong className="text-slate-900">{batch.location}</strong>
              </span>
            )}
            {batch.notes && (
              <span className="text-slate-600">
                Observações: <span className="italic">{batch.notes}</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditBatchModalOpen(true)}
            className="text-[11px] text-[#d9532f] hover:underline font-semibold"
          >
            Alterar detalhes
          </button>
        </div>
      )}

      {/* KPI Cards (Baseados na Tela 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Custo Aquisição */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Custo Aquisição
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-slate-900">
                {acquisitionCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-xs text-slate-400 mt-1">Valor base da nota / compra</p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Custos Peças / Componentes */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Peças no Lote
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-amber-700">
                {partsAndServicesCost.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {parts.length} tipo(s) • {totalPartsQuantity} item(ns) total
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Custo Total Consolidado do Lote & Rateio Unitário */}
        <Card className="border-slate-200 shadow-xs bg-white ring-1 ring-orange-200/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Custo Total Consolidado
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-slate-900">
                {totalCostOverall.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                Rateio:{' '}
                <span className="font-bold text-slate-800">
                  {baseCostPerExpectedItem.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>{' '}
                <span className="text-[11px] text-slate-400 font-normal">(equip.)</span> +{' '}
                <span className="font-bold text-amber-700">
                  {partsSharePerNotebook.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>{' '}
                <span className="text-[11px] text-slate-400 font-normal">(peças/note)</span>
              </p>
              <div className="mt-1 text-[11px] text-slate-500 bg-slate-50 rounded px-1.5 py-0.5 inline-block">
                = Custo efetivo médio:{' '}
                <strong className="text-slate-900">
                  {averageUnitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  /un
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Lucro Estimado & Margem Real */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Lucro Estimado (Venda − Custo)
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  estimatedProfit >= 0
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <div
                  className={`text-2xl font-extrabold ${
                    estimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {estimatedProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs font-bold ${
                    estimatedProfit >= 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {estimatedMarginPct >= 0 ? '+' : ''}
                  {estimatedMarginPct.toFixed(1)}% margem
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Estimativa venda:{' '}
                <strong className="text-slate-800">
                  {totalTargetSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Custo base + peças:{' '}
                {costReferenceForProfit.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Triagem Progress Bar Banner */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#d9532f]" />
                Progresso de Triagem e Testes
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {inventoriedCount} de {expectedQty} equipamentos cadastrados e inspecionados.
                {missingCount > 0 ? (
                  <span className="text-[#d9532f] font-semibold ml-1">
                    Faltam {missingCount} equipamentos para concluir este lote.
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold ml-1">
                    Todos os itens esperados foram inventariados!
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-[#d9532f]">{progressPct}%</span>
            </div>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPct >= 100 ? 'bg-emerald-500' : 'bg-[#d9532f]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seção Peças & Custos Vinculada ao Lote */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-600" />
                Controle de Compra & Peças do Lote ({parts.length})
              </h2>
              <Badge
                variant="outline"
                className="text-xs bg-amber-50 text-amber-800 border-amber-200"
              >
                Peças:{' '}
                {partsAndServicesCost.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}{' '}
                ({totalPartsQuantity} itens)
              </Badge>
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">
                Custo Total Lote:{' '}
                {totalCostOverall.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </Badge>
              {partsAndServicesCost > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs bg-orange-50 text-orange-800 border-orange-200"
                >
                  Rateio no notebook: +
                  {partsSharePerNotebook.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                  /un
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Compre e vincule peças (memórias, SSDs, telas) com quantidade e status (Orçada,
              Comprada, Recebida, Instalada). O valor total das peças é distribuído igualmente no
              custo de cada notebook do lote.
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleOpenAddPartModal}
            className="bg-[#d9532f] hover:bg-[#c24624] text-white shadow-xs text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />+ Comprar / Adicionar Peça
          </Button>
        </div>

        {parts.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 bg-white">
            <CardContent className="py-10 text-center">
              <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-semibold text-slate-700 text-sm">
                Nenhuma peça ou custo extra registrado neste lote
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Adicione memórias, SSDs, telas ou peças de reposição com quantidade para compor o
                custo real do lote.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddPartModal}
                className="mt-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Registrar primeira peça
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Peça / Componente</th>
                    <th className="py-3 px-4">Vinculado a</th>
                    <th className="py-3 px-4">Fornecedor</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Status Compra</th>
                    <th className="py-3 px-4 text-center">Qtd</th>
                    <th className="py-3 px-4">Custo Unitário</th>
                    <th className="py-3 px-4 font-bold text-slate-900">Custo Total</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parts.map((p) => {
                    const linkedProduct = products.find((prod) => prod.id === p.product_id)
                    const qty = Math.max(1, Number(p.quantity) || 1)
                    const unitCost = Number(p.cost) || 0
                    const lineTotal = unitCost * qty

                    // Estilo de badge de status de compra
                    let badgeClass = 'bg-slate-100 text-slate-800'
                    if (p.status === 'Orçada') {
                      badgeClass = 'bg-sky-100 text-sky-800'
                    } else if (p.status === 'Comprada') {
                      badgeClass = 'bg-amber-100 text-amber-800'
                    } else if (p.status === 'Recebida') {
                      badgeClass = 'bg-purple-100 text-purple-800'
                    } else if (p.status === 'Instalada' || p.status === 'Instalado') {
                      badgeClass = 'bg-emerald-100 text-emerald-800'
                    } else if (p.status === 'Danificado') {
                      badgeClass = 'bg-rose-100 text-rose-800'
                    } else if (p.status === 'Trocado') {
                      badgeClass = 'bg-blue-100 text-blue-800'
                    }

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          {p.notes && <div className="text-xs text-slate-400">{p.notes}</div>}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          {linkedProduct ? (
                            <Link
                              to={`/catalogo/${linkedProduct.sku || linkedProduct.code || linkedProduct.id}`}
                              className="text-orange-600 hover:underline font-medium inline-flex items-center gap-1"
                            >
                              {linkedProduct.name}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
                              Lote Geral
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">{p.supplier || '—'}</td>

                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {p.purchase_date
                            ? new Date(p.purchase_date).toLocaleDateString('pt-BR')
                            : p.created
                              ? new Date(p.created).toLocaleDateString('pt-BR')
                              : '—'}
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold border-none ${badgeClass}`}
                          >
                            {p.status || 'Comprada'}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                            {qty}x
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {unitCost.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-900 text-xs">
                          {lineTotal.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-orange-600"
                              onClick={() => handleOpenEditPartModal(p)}
                              title="Editar peça"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600"
                              onClick={() => setPartToDelete(p)}
                              title="Remover peça"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Equipamentos Já Inventariados Neste Lote com Seleção Múltipla, Transferência e Clonagem */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900">
              Equipamentos no Lote ({inventoriedCount})
            </h2>
            <Badge variant="outline" className="text-xs">
              {inventoriedCount} / {expectedQty}
            </Badge>

            {/* Chip clicável de pendentes de ativação */}
            {pendingActivationCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterOnlyPending((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                  filterOnlyPending
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
                title={
                  filterOnlyPending
                    ? 'Clique para ver todos os equipamentos'
                    : 'Clique para filtrar apenas os equipamentos que aguardam Part Number'
                }
              >
                <span>⚠️</span>
                <span>
                  {pendingActivationCount} pendente{pendingActivationCount > 1 ? 's' : ''} de
                  ativação
                </span>
                {filterOnlyPending && (
                  <span className="ml-1 text-[10px] bg-amber-700 text-white rounded-full px-1.5">
                    filtro ativo ✕
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Lista Individual vs Agrupado */}
            <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center text-xs">
              <button
                type="button"
                onClick={() => setViewMode('individual')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === 'individual'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Exibir cada equipamento individual com serial e ações"
              >
                <ListFilter className="w-3.5 h-3.5" />
                Lista Individual
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === 'grouped'
                    ? 'bg-[#d9532f] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Agrupar equipamentos idênticos (mesmo modelo, configuração e estética)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Agrupados ({groupedProducts.length})
              </button>
            </div>

            {filterOnlyPending && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFilterOnlyPending(false)}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Limpar filtro
              </Button>
            )}
            <Link to={`/lotes-entrada/${batch.id}/inventariar`}>
              <Button
                size="sm"
                className="bg-[#d9532f] hover:bg-[#c24624] text-white shadow-xs text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />+ Inventariar equipamento
              </Button>
            </Link>
          </div>
        </div>

        {/* Barra de Ações em Massa quando houver seleção */}
        {selectedProductIds.length > 0 && (
          <div className="bg-[#f5ede4] border border-[#edd5c3] rounded-xl p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#d9532f] bg-white px-2 py-0.5 rounded-md border border-[#edd5c3]">
                {selectedProductIds.length} selecionado(s)
              </span>
              <span className="text-slate-600">Ações em massa para os equipamentos marcados:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Botão Ativar em Massa (Ativa para 'Disponível') */}
              <Button
                size="sm"
                onClick={() => {
                  setBulkStatusTarget('Disponível')
                  setBulkPriceStatusModalOpen(true)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8 gap-1.5 shadow-xs"
                title="Ativar os equipamentos selecionados para 'Disponível' para venda imediata"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ativar em massa ({selectedProductIds.length})
              </Button>

              {/* Botão Desativar em Massa (Coloca em 'Pendente de ativação') */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkStatusTarget('Pendente de ativação')
                  setBulkPriceStatusModalOpen(true)
                }}
                className="bg-white border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-semibold h-8 gap-1.5 shadow-xs"
                title="Colocar os equipamentos selecionados em 'Pendente de ativação'"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Desativar / Pendente ({selectedProductIds.length})
              </Button>

              {/* Botão Alterar Preço / Status em Massa */}
              <Button
                size="sm"
                onClick={() => {
                  setBulkStatusTarget('Disponível')
                  setBulkPriceStatusModalOpen(true)
                }}
                className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs font-semibold h-8 gap-1.5 shadow-xs"
                title="Alterar preço unitário ou status dos equipamentos selecionados em lote"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Alterar Preço ({selectedProductIds.length})
              </Button>

              {/* Botão Criar PNs Internos em Massa */}
              <Button
                size="sm"
                onClick={() => setBulkInternalPnModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-8 gap-1.5 shadow-xs"
                title="Gerar código interno automático (AMB0001...) e ativar equipamentos pendentes para venda"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Criar PNs Internos ({selectedProductIds.length})
              </Button>

              {/* Botão Imprimir Etiquetas em Massa */}
              <Button
                size="sm"
                onClick={() => setEtiquetaModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8 gap-1.5 shadow-xs"
                title="Imprimir etiquetas identificadoras dos equipamentos selecionados"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir etiquetas ({selectedProductIds.length})
              </Button>

              {/* Botão Transferir para Lote (Qualquer quantidade selecionada >= 1) */}
              <Button
                size="sm"
                onClick={() => setTransferModalOpen(true)}
                className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs font-semibold h-8 gap-1.5 shadow-xs"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Transferir para lote ({selectedProductIds.length})
              </Button>

              {/* Botão Clonar Equipamento (quando exatamente 1 equipamento estiver selecionado) */}
              {selectedProductIds.length === 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenCloneSelected}
                  className="bg-white hover:bg-orange-50 border-orange-300 text-[#d9532f] text-xs font-semibold h-8 gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Clonar equipamento
                </Button>
              )}

              {/* Botão Excluir Selecionados em Massa (apenas admin) */}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkDeleteModalOpen(true)}
                  className="bg-white hover:bg-rose-50 border-rose-300 text-rose-600 hover:text-rose-700 text-xs font-semibold h-8 gap-1.5"
                  title="Excluir permanentemente os equipamentos selecionados"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  Excluir selecionados ({selectedProductIds.length})
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedProductIds([])}
                className="text-slate-500 hover:text-slate-800 text-xs h-8"
              >
                Desmarcar todos
              </Button>
            </div>
          </div>
        )}

        {products.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 bg-white">
            <CardContent className="py-12 text-center">
              <Laptop className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-700">
                Nenhum equipamento inventariado ainda
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Clique no botão abaixo para preencher a ficha de inventário do primeiro equipamento
                deste lote.
              </p>
              <Link to={`/lotes-entrada/${batch.id}/inventariar`}>
                <Button className="mt-4 bg-[#d9532f] hover:bg-[#c24624] text-white text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />+ Inventariar Primeiro Equipamento
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : viewMode === 'grouped' ? (
          /* TABELA DE VISÃO AGRUPADA POR MODELO / ESPECIFICAÇÕES IDÊNTICAS */
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">
                  {groupedProducts.length} grupo(s) de equipamentos idênticos
                </span>
                <span className="text-slate-400">•</span>
                <span>Total de {displayedProducts.length} itens</span>
              </div>
              <span className="text-slate-500 text-[11px]">
                Marque a caixa do grupo para selecionar todos os equipamentos daquele modelo para
                alteração em lote
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3 w-10 text-center">
                      <Checkbox
                        checked={
                          selectedProductIds.length === displayedProducts.length &&
                          displayedProducts.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todos os equipamentos visíveis"
                      />
                    </th>
                    <th className="py-3 px-4">Modelo / Especificação do Grupo</th>
                    <th className="py-3 px-4 text-center">Quantidade</th>
                    <th className="py-3 px-4">Status no Grupo</th>
                    <th className="py-3 px-4">Estética</th>
                    <th className="py-3 px-4">Custo Efetivo (+ Peças)</th>
                    <th className="py-3 px-4">Preço Médio Venda</th>
                    <th className="py-3 px-4">Lucro Estimado</th>
                    <th className="py-3 px-4 text-right">Ação em Grupo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedProducts.map((grp) => {
                    const groupIds = grp.items.map((i) => i.id)
                    const selectedCountInGroup = groupIds.filter((id) =>
                      selectedProductIds.includes(id),
                    ).length
                    const isAllInGroupSelected =
                      selectedCountInGroup === grp.items.length && grp.items.length > 0
                    const isPartiallySelected =
                      selectedCountInGroup > 0 && selectedCountInGroup < grp.items.length

                    return (
                      <tr
                        key={grp.groupKey}
                        className={`transition-colors ${
                          isAllInGroupSelected
                            ? 'bg-orange-50/60 hover:bg-orange-50/90'
                            : isPartiallySelected
                              ? 'bg-amber-50/30 hover:bg-amber-50/60'
                              : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <Checkbox
                            checked={
                              isAllInGroupSelected
                                ? true
                                : isPartiallySelected
                                  ? 'indeterminate'
                                  : false
                            }
                            onCheckedChange={() => toggleSelectGroup(grp.items)}
                            aria-label={`Selecionar todos os ${grp.count} itens de ${grp.title}`}
                          />
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{grp.title}</div>
                          <div className="text-xs text-slate-500 font-medium">{grp.specs}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Marca: {grp.brand} {grp.model ? `• Modelo: ${grp.model}` : ''}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <Badge
                            variant="secondary"
                            className="bg-slate-100 text-slate-900 font-bold px-2.5 py-1 text-xs"
                          >
                            {grp.count} {grp.count === 1 ? 'unidade' : 'unidades'}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 text-[11px]">
                            {grp.availableCount > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-none font-medium">
                                {grp.availableCount} disp.
                              </Badge>
                            )}
                            {grp.reservedCount > 0 && (
                              <Badge className="bg-amber-100 text-amber-800 border-none font-medium">
                                {grp.reservedCount} reserv.
                              </Badge>
                            )}
                            {grp.pendingCount > 0 && (
                              <Badge className="bg-amber-50 text-amber-900 border-amber-300 font-medium">
                                ⚠️ {grp.pendingCount} pend.
                              </Badge>
                            )}
                            {grp.soldCount > 0 && (
                              <Badge className="bg-slate-200 text-slate-700 border-none font-medium">
                                {grp.soldCount} vendido(s)
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                          {grp.condition}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-bold text-slate-900">
                            {grp.avgEffectiveCostPrice.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </div>
                          {partsSharePerNotebook > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {grp.avgCostPrice.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}{' '}
                              +{' '}
                              <span className="text-amber-700 font-semibold">
                                {partsSharePerNotebook.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}{' '}
                                peças
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-bold text-emerald-700">
                            {grp.avgUnitPrice.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </div>
                          {grp.minUnitPrice !== grp.maxUnitPrice && (
                            <div className="text-[10px] text-slate-400">
                              (faixa R$ {grp.minUnitPrice.toFixed(0)} - R${' '}
                              {grp.maxUnitPrice.toFixed(0)})
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <div
                            className={`font-bold ${grp.avgEstimatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                          >
                            {grp.avgEstimatedProfit.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </div>
                          <div
                            className={`text-[10px] font-semibold ${grp.avgMarginPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                          >
                            {grp.avgMarginPct >= 0 ? '+' : ''}
                            {grp.avgMarginPct.toFixed(1)}% margem
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Seleciona apenas este grupo e abre a modal de preço
                                setSelectedProductIds(groupIds)
                                setBulkStatusTarget('Disponível')
                                setBulkPriceStatusModalOpen(true)
                              }}
                              className="h-7 px-2.5 text-xs text-[#d9532f] border-orange-200 hover:bg-orange-50 font-semibold gap-1"
                              title="Alterar preço e status de todas as unidades deste grupo"
                            >
                              <DollarSign className="w-3 h-3" />
                              Alterar Preço ({grp.count})
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TABELA DE VISÃO INDIVIDUAL */
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3 w-10 text-center">
                      <Checkbox
                        checked={
                          selectedProductIds.length === displayedProducts.length &&
                          displayedProducts.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todos os equipamentos visíveis"
                      />
                    </th>
                    <th className="py-3 px-4">Equipamento</th>
                    <th className="py-3 px-4">Serial / SKU</th>
                    <th className="py-3 px-4">Configuração</th>
                    <th className="py-3 px-4">Estética / Bateria</th>
                    <th className="py-3 px-4">Carregador</th>
                    <th className="py-3 px-4">Custo (+ Peças)</th>
                    <th className="py-3 px-4">Preço Venda</th>
                    <th className="py-3 px-4">Lucro Estimado</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedProducts.map((p) => {
                    const rawCost = Number(p.cost_price) || 0
                    const baseCost =
                      rawCost > 0
                        ? rawCost
                        : divisorEquipamentos > 0
                          ? acquisitionCost / divisorEquipamentos
                          : 0
                    const effectiveCost = baseCost + partsSharePerNotebook
                    const unitPrice = Number(p.unit_price) || 0
                    const unitProfit = unitPrice - effectiveCost
                    const unitMarginPct = effectiveCost > 0 ? (unitProfit / effectiveCost) * 100 : 0

                    const isSelected = selectedProductIds.includes(p.id)
                    const isPendingActivation = p.status === 'Pendente de ativação'
                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-orange-50/50 hover:bg-orange-50/80'
                            : isPendingActivation
                              ? 'bg-amber-50/40 hover:bg-amber-50/70'
                              : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectOne(p.id)}
                            aria-label={`Selecionar ${p.name}`}
                          />
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-400">
                            {p.brand} {p.model ? `• ${p.model}` : ''}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs">
                          {p.part_number && (
                            <div className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-sans">PN:</span>
                              {p.part_number}
                            </div>
                          )}
                          <div className="text-slate-800 font-semibold">
                            {p.serial_number ? (
                              <span>SN: {p.serial_number}</span>
                            ) : (
                              <span className="text-slate-500">{p.sku}</span>
                            )}
                          </div>
                          {p.code && <div className="text-[11px] text-slate-400">{p.code}</div>}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          <div>{p.processor || 'Não inf.'}</div>
                          <div className="text-slate-400">
                            {p.ram || '8GB'} • {p.storage || 'SSD 256GB'}
                            {p.screen_size ? ` • ${p.screen_size}` : ''}
                            {p.has_numeric_keypad ? ' • Tecl. Num.' : ''}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-medium text-slate-800">
                            {p.aesthetic_grade || p.condition || 'Bom'}
                          </div>
                          <div className="text-slate-400">Bat: {p.battery_health || 'OK'}</div>
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          {p.includes_charger ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Sim
                            </span>
                          ) : (
                            <span className="text-slate-400">Não</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-bold text-slate-900">
                            {effectiveCost.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </div>
                          {partsSharePerNotebook > 0 && (
                            <div className="text-[10px] text-slate-400">
                              Base:{' '}
                              {baseCost.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}{' '}
                              +{' '}
                              <span className="text-amber-700 font-medium">
                                {partsSharePerNotebook.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}{' '}
                                peças
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-emerald-700 text-xs">
                          {unitPrice.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <div
                            className={`font-bold ${unitProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                          >
                            {unitProfit.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </div>
                          <div
                            className={`text-[10px] font-semibold ${unitMarginPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                          >
                            {unitMarginPct >= 0 ? '+' : ''}
                            {unitMarginPct.toFixed(1)}% margem
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isPendingActivation ? (
                            <Badge
                              variant="outline"
                              className="text-xs font-semibold bg-amber-100 text-amber-900 border-amber-300 gap-1 flex items-center w-fit"
                            >
                              <span>⚠️</span>
                              Pendente de ativação
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-xs font-normal border-none ${
                                p.status === 'Disponível'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.status === 'Reservado'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {p.status || 'Disponível'}
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão de Destaque: Ativar / Inserir PN para pendentes */}
                            {isPendingActivation && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenActivateModal(p)}
                                className="h-7 px-2.5 text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-1 shadow-xs"
                                title="Inserir Part Number e ativar este notebook"
                              >
                                <Sparkles className="w-3 h-3" />
                                Ativar / Inserir PN
                              </Button>
                            )}

                            {/* Botão de Clonar Rápido Linha */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenCloneSingle(p)}
                              className="h-7 px-2 text-xs text-slate-600 hover:text-[#d9532f] hover:bg-orange-50 gap-1"
                              title="Clonar este equipamento"
                            >
                              <Copy className="w-3 h-3" />
                              Clonar
                            </Button>

                            <Link
                              to={`/catalogo/${p.sku || p.code || p.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded transition-colors"
                            >
                              Ver Ficha
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}{' '}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Alteração em Massa de Preço e Status */}
      <BatchEquipmentPriceStatusModal
        open={bulkPriceStatusModalOpen}
        onOpenChange={setBulkPriceStatusModalOpen}
        selectedProducts={selectedProductsList}
        initialChangeStatus={true}
        initialTargetStatus={bulkStatusTarget}
        onSuccess={async () => {
          setSelectedProductIds([])
          await loadData()
        }}
      />

      {/* Modal de Confirmação: Criar PNs Internos em Massa */}
      <Dialog open={bulkInternalPnModalOpen} onOpenChange={setBulkInternalPnModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
              <Sparkles className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Criar PNs Internos em Massa
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Gere códigos sequenciais automáticos (ex:{' '}
              <code className="font-mono font-semibold text-slate-800">AMB0001</code>,{' '}
              <code className="font-mono font-semibold text-slate-800">AMB0002</code>...) e ative os
              equipamentos diretamente para venda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-700">Total selecionado:</span>
                <span className="font-mono text-slate-900">
                  {selectedProductsList.length} equipamento(s)
                </span>
              </div>
              <div className="flex items-center justify-between font-semibold text-amber-800 border-t border-amber-200/60 pt-1.5">
                <span>Elegíveis para PN interno:</span>
                <span className="font-bold bg-amber-100 px-2 py-0.5 rounded text-amber-900">
                  {selectedPendingActivationProducts.length} pendente(s)
                </span>
              </div>
              {selectedAlreadyActiveCount > 0 && (
                <div className="flex items-center justify-between text-slate-500 border-t border-amber-200/60 pt-1.5 text-[11px]">
                  <span>Já ativados / com PN real (serão ignorados):</span>
                  <span>{selectedAlreadyActiveCount} equipamento(s)</span>
                </div>
              )}
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[11px] space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Regras de proteção do sistema:
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                <li>
                  O sistema buscará o próximo código global disponível (padrão{' '}
                  <code className="font-mono">AMB0001</code>).
                </li>
                <li>
                  Equipamentos que já possuem PN ativo ou status concluído{' '}
                  <strong>não serão sobrescritos</strong>.
                </li>
                <li>
                  O status dos pendentes passará automaticamente para <strong>Disponível</strong>{' '}
                  para venda.
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkInternalPnModalOpen(false)}
              disabled={generatingBulkPn}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmBulkInternalPn}
              disabled={generatingBulkPn || selectedPendingActivationProducts.length === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
            >
              {generatingBulkPn ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Gerando PNs...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Gerar PNs ({selectedPendingActivationProducts.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar / Editar Peça */}
      <Dialog open={partModalOpen} onOpenChange={setPartModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPart ? 'Editar Peça / Custo' : 'Adicionar Peça ao Lote'}
            </DialogTitle>
            <DialogDescription>
              Vincule peças de reposição, upgrades ou custos de manutenção a este lote.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePart} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Nome da Peça *</Label>
              <Input
                required
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="Ex: Memória 8GB DDR4 Notebook, SSD 256GB NVMe, Bateria Dell"
                className="mt-1 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Quantidade *</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={partQuantity}
                  onChange={(e) => setPartQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="1"
                  className="mt-1 text-sm font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Custo Unitário (R$) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={partCost}
                  onChange={(e) => setPartCost(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Status da Peça</Label>
                <Select value={partStatus} onValueChange={(val: any) => setPartStatus(val)}>
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Orçada">Orçada</SelectItem>
                    <SelectItem value="Comprada">Comprada</SelectItem>
                    <SelectItem value="Recebida">Recebida</SelectItem>
                    <SelectItem value="Instalada">Instalada</SelectItem>
                    <SelectItem value="Instalado">Instalado (Legado)</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Trocado">Trocado</SelectItem>
                    <SelectItem value="Danificado">Danificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Totalizador prévio */}
            <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-center justify-between text-xs text-amber-900">
              <span>Custo total calculado para o lote:</span>
              <strong className="text-sm font-bold">
                {((Number(partCost) || 0) * (Number(partQuantity) || 1)).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </strong>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Equipamento Destino</Label>
              <Select value={partProductId} onValueChange={(val) => setPartProductId(val)}>
                <SelectTrigger className="mt-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="batch">Lote Geral (Custo compartilhado no lote)</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.serial_number || p.sku || 'Sem serial'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400 mt-1">
                Você pode vincular diretamente a um notebook do lote ou deixar como custo geral do
                lote.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Fornecedor da Peça</Label>
                <Input
                  value={partSupplier}
                  onChange={(e) => setPartSupplier(e.target.value)}
                  placeholder="Ex: Mercado Livre, KaBuM!"
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Data da Compra</Label>
                <Input
                  type="date"
                  value={partPurchaseDate}
                  onChange={(e) => setPartPurchaseDate(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Observações / Detalhes</Label>
              <Textarea
                rows={2}
                value={partNotes}
                onChange={(e) => setPartNotes(e.target.value)}
                placeholder="Ex: Peça nova com garantia de 3 meses, instalada no slot secundário"
                className="mt-1 text-sm"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPartModalOpen(false)}
                disabled={savingPart}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#d9532f] hover:bg-[#c24624] text-white font-medium"
                disabled={savingPart}
              >
                {savingPart ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : editingPart ? (
                  'Salvar Alterações'
                ) : (
                  'Adicionar Peça'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão de Peça */}
      <AlertDialog open={!!partToDelete} onOpenChange={(open) => !open && setPartToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover peça / custo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja remover a peça &quot;{partToDelete?.name}&quot; (
              {Math.max(1, Number(partToDelete?.quantity) || 1)}x de{' '}
              {(Number(partToDelete?.cost) || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
              , total:{' '}
              {(
                (Number(partToDelete?.cost) || 0) * Math.max(1, Number(partToDelete?.quantity) || 1)
              ).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
              )? Esta ação deduzirá o custo do lote e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPart}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDeletePart()
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              disabled={deletingPart}
            >
              {deletingPart ? 'Removendo...' : 'Sim, remover peça'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 1. MODAL: EDITAR LOTE DE ENTRADA COMPLETO */}
      <EditBatchModal
        open={editBatchModalOpen}
        onOpenChange={setEditBatchModalOpen}
        batch={batch}
        onSuccess={() => {
          loadData()
        }}
      />

      {/* MODAL: EXCLUSÃO SEGURA DO LOTE */}
      <DeletePurchaseBatchModal
        open={deleteBatchModalOpen}
        onOpenChange={setDeleteBatchModalOpen}
        batch={batch}
        onSuccess={() => {
          navigate('/lotes-entrada')
        }}
      />

      {/* 2. MODAL: TRANSFERIR EQUIPAMENTOS ENTRE LOTES */}
      <TransferEquipmentModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        currentBatchId={batch.id}
        selectedProducts={selectedProductsList}
        onSuccess={() => {
          setSelectedProductIds([])
          loadData()
        }}
      />

      {/* 3. MODAL: CLONAR EQUIPAMENTO */}
      <CloneEquipmentModal
        open={cloneModalOpen}
        onOpenChange={setCloneModalOpen}
        product={productToClone}
        onSuccess={(count, targetBatchId) => {
          setSelectedProductIds([])
          loadData()
        }}
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO EM MASSA */}
      <AlertDialog
        open={bulkDeleteModalOpen}
        onOpenChange={(open) => !deletingBulk && setBulkDeleteModalOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="w-5 h-5 text-rose-600" />
              Excluir {selectedProductIds.length}{' '}
              {selectedProductIds.length === 1 ? 'equipamento' : 'equipamentos'} em lote?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 space-y-2 pt-1 text-xs sm:text-sm">
              <p>
                Você está prestes a excluir permanentemente{' '}
                <strong className="text-slate-900">{selectedProductIds.length}</strong>{' '}
                equipamento(s) selecionado(s) deste lote.
              </p>
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                ⚠️ <strong>Aviso permanente:</strong> Esta ação não pode ser desfeita. Todos os
                dados técnicos, histórico, fotos e registros vinculados serão excluídos.
                Equipamentos já vendidos ou com faturamento registrado serão preservados para manter
                a integridade fiscal e financeira.
              </div>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50 text-xs text-slate-700">
                <ul className="list-disc pl-4 space-y-0.5">
                  {selectedProductsList.slice(0, 8).map((p) => (
                    <li key={p.id} className="truncate">
                      {p.name} ({p.sku || p.serial_number || 'Sem serial'})
                    </li>
                  ))}
                  {selectedProductsList.length > 8 && (
                    <li className="text-slate-400 italic">
                      + {selectedProductsList.length - 8} outro(s)...
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
                  Sim, excluir {selectedProductIds.length} equipamento(s)
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 4. MODAL: IMPRESSÃO DE ETIQUETAS EM MASSA */}
      <EtiquetaModal
        open={etiquetaModalOpen}
        onOpenChange={setEtiquetaModalOpen}
        items={selectedEtiquetasData}
      />

      {/* 5. MODAL: ATIVAÇÃO RÁPIDA (Inserir Part Number e ativar como Disponível) */}
      <Dialog open={activateModalOpen} onOpenChange={setActivateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <span className="text-amber-500 text-lg">⚠️</span>
              Ativar Equipamento do Lote
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe o Part Number exclusivo desta peça física para tirá-la de &quot;Pendente de
              ativação&quot; e disponibilizá-la para venda.
            </DialogDescription>
          </DialogHeader>

          {productToActivate && (
            <form onSubmit={handleConfirmActivation} className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-slate-900">{productToActivate.name}</div>
                <div className="text-slate-500 font-mono">
                  SKU: <strong>{productToActivate.sku}</strong>
                  {productToActivate.brand && ` • ${productToActivate.brand}`}
                  {productToActivate.model && ` ${productToActivate.model}`}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Part Number (P/N) *</Label>
                <Input
                  required
                  autoFocus
                  placeholder="Ex: PN-DELL-5320-01"
                  value={activatePartNumber}
                  onChange={(e) => setActivatePartNumber(e.target.value.toUpperCase())}
                  className="font-mono text-xs uppercase"
                />
                <p className="text-[11px] text-slate-400">
                  Identificador de peça do equipamento físico montado/pintado.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Número de Série (S/N) (Opcional)
                </Label>
                <Input
                  placeholder="Ex: 8BRXYZ1"
                  value={activateSerialNumber}
                  onChange={(e) => setActivateSerialNumber(e.target.value.toUpperCase())}
                  className="font-mono text-xs uppercase"
                />
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Ao salvar, o status do notebook mudará automaticamente para{' '}
                  <strong>Disponível</strong>.
                </span>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActivateModalOpen(false)}
                  disabled={activatingProduct}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={activatingProduct || !activatePartNumber.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                >
                  {activatingProduct ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Ativando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Ativar Equipamento
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 10. MODAL DE RELATÓRIO DO LOTE COM ESTIMATIVAS E GRÁFICOS */}
      <BatchReportModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        batch={batch}
        products={products}
        parts={parts}
        tenantName={currentTenant?.name}
      />
    </div>
  )
}
