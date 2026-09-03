import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Download,
  Share2,
  Cpu,
  CircuitBoard,
  HardDrive,
  Battery,
  ShieldCheck,
  Tag,
  Wrench,
  Clock,
  Layers,
  Send,
  Plus,
  Trash2,
  Check,
  Loader2,
  DollarSign,
  TrendingUp,
  PackageCheck,
  AlertCircle,
  Edit2,
  Camera,
  Upload,
  Image as ImageIcon,
  MapPin,
  X,
  ExternalLink,
  Boxes,
  Printer,
  QrCode,
  Copy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { batchesService } from '@/services/batches'
import { equipmentService } from '@/services/equipment'
import { salesService } from '@/services/sales'
import { EtiquetaModal, type EtiquetaData } from '@/components/EtiquetaModal'
import { CloneEquipmentModal } from '@/components/CloneEquipmentModal'
import type {
  Product,
  Batch,
  EquipmentPart,
  EquipmentDeliverable,
  TechnicalChecklistItem,
  ProductStatus,
} from '@/types/inventory'

export default function CatalogoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [parts, setParts] = useState<EquipmentPart[]>([])
  const [deliverables, setDeliverables] = useState<EquipmentDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)

  // Etiqueta Modal State
  const [etiquetaModalOpen, setEtiquetaModalOpen] = useState(false)
  const [cloneModalOpen, setCloneModalOpen] = useState(false)
  const [deleteProductDialogOpen, setDeleteProductDialogOpen] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(false)

  // Edit Equipment / Lote Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSku, setEditSku] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editCategory, setEditCategory] = useState('Notebooks')
  const [editProcessor, setEditProcessor] = useState('')
  const [editRam, setEditRam] = useState('')
  const [editStorage, setEditStorage] = useState('')
  const [editCondition, setEditCondition] = useState('Excelente')
  const [editAestheticGrade, setEditAestheticGrade] = useState('A - Excelente')
  const [editBatteryHealth, setEditBatteryHealth] = useState('100%')
  const [editScreenSize, setEditScreenSize] = useState('14"')
  const [editUnitPrice, setEditUnitPrice] = useState<number>(0)
  const [editCostPrice, setEditCostPrice] = useState<number>(0)
  const [editStatus, setEditStatus] = useState<ProductStatus>('Disponível')
  const [editDescription, setEditDescription] = useState('')
  const [editBatchLocation, setEditBatchLocation] = useState('')
  const [editBatchQuantity, setEditBatchQuantity] = useState<number>(1)
  const [editBatchNumber, setEditBatchNumber] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Photo Management Modal
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [photoUrlInput, setPhotoUrlInput] = useState('')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modais de Peças e Pendências
  const [partModalOpen, setPartModalOpen] = useState(false)
  const [editingPart, setEditingPart] = useState<EquipmentPart | null>(null)
  const [partName, setPartName] = useState('')
  const [partCost, setPartCost] = useState<number>(0)
  const [partSupplier, setPartSupplier] = useState('')
  const [partPurchaseDate, setPartPurchaseDate] = useState('')
  const [partStatus, setPartStatus] = useState<'Pendente' | 'Trocado' | 'Instalado' | 'Danificado'>(
    'Instalado',
  )
  const [partNotes, setPartNotes] = useState('')
  const [partToDelete, setPartToDelete] = useState<EquipmentPart | null>(null)
  const [deletingPart, setDeletingPart] = useState(false)

  const [deliverableModalOpen, setDeliverableModalOpen] = useState(false)
  const [delivName, setDelivName] = useState('')
  const [delivStatus, setDelivStatus] = useState<'Pendente' | 'Resolvido'>('Pendente')
  const [delivNotes, setDelivNotes] = useState('')

  // Modal Venda Rápida
  const [quickSaleModalOpen, setQuickSaleModalOpen] = useState(false)
  const [quickSaleCustomer, setQuickSaleCustomer] = useState('')
  const [quickSaleContact, setQuickSaleContact] = useState('')
  const [quickSalePrice, setQuickSalePrice] = useState<number>(0)
  const [quickSalePaymentMethod, setQuickSalePaymentMethod] = useState('PIX')
  const [quickSaleNotes, setQuickSaleNotes] = useState('')
  const [submittingQuickSale, setSubmittingQuickSale] = useState(false)

  const [savingAction, setSavingAction] = useState(false)

  const { toast } = useToast()
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const loadData = async () => {
    if (!id) return
    try {
      const prod = await productsService.getByCodeOrSku(id)
      if (!prod) {
        setProduct(null)
        return
      }
      setProduct(prod)

      const [batchList, partList, delivList] = await Promise.all([
        batchesService.getAll(),
        equipmentService.getPartsByProduct(prod.id),
        equipmentService.getDeliverablesByProduct(prod.id),
      ])

      const linkedBatches = batchList.filter((b) => b.product_id === prod.id)
      setBatches(linkedBatches)
      setParts(partList)
      setDeliverables(delivList)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  // Photos calculation (combination of direct file uploads via PB + external image URLs)
  const photos = useMemo(() => {
    const list: string[] = []

    // 1. Files uploaded directly to PB 'photos' field
    if (product?.photos && Array.isArray(product.photos)) {
      for (const fn of product.photos) {
        if (fn) {
          list.push(productsService.getFileUrl(product, fn))
        }
      }
    }

    // 2. Images stored in json 'images' array
    if (product?.images && Array.isArray(product.images)) {
      for (const url of product.images) {
        if (url && typeof url === 'string' && url.trim().length > 0) {
          list.push(url.trim())
        }
      }
    }

    if (list.length > 0) {
      return list
    }

    return [
      'https://img.usecurling.com/p/800/600?q=laptop',
      'https://img.usecurling.com/p/800/600?q=keyboard',
      'https://img.usecurling.com/p/800/600?q=ports',
    ]
  }, [product])

  // Primary Batch
  const primaryBatch = batches[0] || null

  // Open Edit Modal with pre-filled state
  const handleOpenEditModal = () => {
    if (!product) return
    setEditName(product.name || '')
    setEditSku(product.sku || '')
    setEditCode(product.code || '')
    setEditBrand(product.brand || 'Dell')
    setEditModel(product.model || '')
    setEditCategory(product.category || 'Notebooks')
    setEditProcessor(product.processor || '')
    setEditRam(product.ram || '')
    setEditStorage(product.storage || '')
    setEditCondition(product.condition || 'Excelente')
    setEditAestheticGrade(product.aesthetic_grade || 'A - Excelente')
    setEditBatteryHealth(product.battery_health || '100%')
    setEditScreenSize(product.screen_size || '14"')
    setEditUnitPrice(Number(product.unit_price) || 0)
    setEditCostPrice(Number(product.cost_price) || 0)
    setEditStatus(product.status || 'Disponível')
    setEditDescription(product.description || '')

    if (primaryBatch) {
      setEditBatchNumber(primaryBatch.batch_number)
      setEditBatchLocation(primaryBatch.location || '')
      setEditBatchQuantity(primaryBatch.quantity ?? 1)
    } else {
      setEditBatchNumber(`LOTE-${product.sku || 'UN'}`)
      setEditBatchLocation('Prateleira A-1')
      setEditBatchQuantity(1)
    }

    setEditModalOpen(true)
  }

  // Save Edit (Equipamento / Lote)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return

    setSavingEdit(true)
    try {
      // 1. Update product
      const updatedProd = await productsService.update(product.id, {
        name: editName,
        sku: editSku,
        code: editCode || editSku,
        brand: editBrand,
        model: editModel,
        category: editCategory,
        processor: editProcessor,
        ram: editRam,
        storage: editStorage,
        condition: editCondition,
        aesthetic_grade: editAestheticGrade,
        battery_health: editBatteryHealth,
        screen_size: editScreenSize,
        unit_price: Number(editUnitPrice) || 0,
        cost_price: Number(editCostPrice) || 0,
        status: editStatus,
        description: editDescription,
      })

      // 2. Update or create batch
      if (primaryBatch) {
        await batchesService.update(primaryBatch.id, {
          batch_number: editBatchNumber.trim(),
          location: editBatchLocation.trim(),
          quantity: Math.max(0, editBatchQuantity),
        })
      } else {
        await batchesService.create({
          product_id: product.id,
          batch_number: editBatchNumber.trim() || `LOTE-${product.sku}`,
          location: editBatchLocation.trim(),
          quantity: Math.max(0, editBatchQuantity),
        })
      }

      setProduct(updatedProd)
      toast({
        title: 'Equipamento e lote atualizados!',
        description: 'Todas as alterações foram salvas com sucesso.',
      })
      setEditModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar alterações',
        description: err?.message || 'Verifique os dados informados.',
        variant: 'destructive',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  // Handle Photo File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !product) return

    setIsUploadingPhoto(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('photos', files[i])
      }

      const updated = await productsService.update(product.id, formData)
      setProduct(updated)
      toast({
        title: 'Foto(s) adicionada(s)!',
        description: `${files.length} imagem(ns) enviada(s) para o equipamento.`,
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Falha no upload da imagem',
        description: err?.message || 'Verifique o formato da imagem (PNG, JPG, WebP).',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Handle Adding Photo by URL
  const handleAddPhotoUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product || !photoUrlInput.trim()) return

    setIsUploadingPhoto(true)
    try {
      const currentImages = Array.isArray(product.images) ? [...product.images] : []
      currentImages.push(photoUrlInput.trim())

      const updated = await productsService.update(product.id, {
        images: currentImages,
      })
      setProduct(updated)
      setPhotoUrlInput('')
      toast({
        title: 'URL de foto adicionada!',
        description: 'A imagem foi vinculada à galeria do equipamento.',
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao adicionar imagem',
        description: err?.message || 'Não foi possível salvar a URL da imagem.',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Remove Photo (File or URL)
  const handleRemovePhoto = async (index: number) => {
    if (!product) return

    setIsUploadingPhoto(true)
    try {
      const totalUploadedPhotos = Array.isArray(product.photos) ? product.photos.length : 0

      if (index < totalUploadedPhotos) {
        // It's a file in photos
        const targetFilename = product.photos![index]
        const remaining = product.photos!.filter((fn) => fn !== targetFilename)
        const updated = await productsService.update(product.id, {
          photos: remaining,
        })
        setProduct(updated)
      } else {
        // It's a URL in images
        const imgIndex = index - totalUploadedPhotos
        const currentImages = Array.isArray(product.images) ? [...product.images] : []
        currentImages.splice(imgIndex, 1)
        const updated = await productsService.update(product.id, {
          images: currentImages,
        })
        setProduct(updated)
      }

      if (selectedPhotoIndex >= photos.length - 1) {
        setSelectedPhotoIndex(Math.max(0, photos.length - 2))
      }

      toast({
        title: 'Foto removida',
        description: 'A foto foi excluída da galeria.',
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao remover foto',
        description: err?.message || 'Falha ao atualizar o equipamento.',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Checklist counts
  const checklist = product?.technical_checklist || []
  const okCount = checklist.filter((i) => i.status === 'OK').length
  const warningCount = checklist.filter((i) => i.status === 'Atenção').length
  const untestedCount = checklist.filter((i) => i.status === 'Não testado').length

  // Financeiro
  const cost = Number(product?.cost_price) || 0
  const price = Number(product?.unit_price) || 0
  const totalPartsCost = parts.reduce((acc, p) => acc + (Number(p.cost) || 0), 0)
  const totalCostCombined = cost + totalPartsCost
  const marginCombined = price - totalCostCombined
  const marginPercent =
    totalCostCombined > 0 ? ((marginCombined / totalCostCombined) * 100).toFixed(1) : '100'

  // Total stock
  const totalStock = batches.reduce((acc, b) => acc + (b.quantity || 0), 0)

  // Download Técnico (gerador de documento / relatório texto para impressão)
  const handleDownloadChecklist = () => {
    if (!product) return

    const checklistContent = checklist
      .map(
        (item) =>
          `[${item.status}] ${item.item}${item.observation ? ` - Obs: ${item.observation}` : ''}`,
      )
      .join('\n')

    const partsContent =
      parts.length > 0
        ? parts
            .map((p) => `- ${p.name} (${p.status}) R$ ${Number(p.cost || 0).toFixed(2)}`)
            .join('\n')
        : 'Nenhuma peça vinculada.'

    const delivContent =
      deliverables.length > 0
        ? deliverables
            .map((d) => `- [${d.status}] ${d.item_name} ${d.notes ? `(${d.notes})` : ''}`)
            .join('\n')
        : 'Sem pendências de entrega.'

    const reportText = `=====================================================
LAUDO TÉCNICO E CHECKLIST DE REVISÃO
LoteEquip Gestão de Equipamentos
=====================================================
Equipamento: ${product.name}
Código / SKU: ${product.sku}
Lote Físico: ${primaryBatch ? primaryBatch.batch_number : 'Sem lote vinculado'}
Localização: ${primaryBatch?.location || 'Depósito Central'}
Marca / Modelo: ${product.brand || 'Dell'} ${product.model || ''}
Condição Geral: ${product.condition || 'Excelente'}
Nota Estética: ${product.aesthetic_grade || 'A'}
Saúde da Bateria: ${product.battery_health || '100%'}
Preço Sugerido: R$ ${price.toFixed(2)}
Data da Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}

-----------------------------------------------------
ESPECIFICAÇÕES TÉCNICAS:
- Processador: ${product.processor || 'N/A'}
- Memória RAM: ${product.ram || 'N/A'}
- Armazenamento: ${product.storage || 'N/A'}
- Tela: ${product.screen_size || 'N/A'}

-----------------------------------------------------
CHECKLIST DE INSPEÇÃO (Total: ${checklist.length} itens)
Itens OK: ${okCount} | Atenção: ${warningCount} | Não testados: ${untestedCount}

${checklistContent}

-----------------------------------------------------
PEÇAS E REPAROS REALIZADOS:
${partsContent}

-----------------------------------------------------
ITENS E PENDÊNCIAS DE ENTREGA:
${delivContent}
=====================================================
Relatório gerado via LoteEquip. Equipamento testado e aprovado para comercialização.
`

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Checklist-Tecnico-${product.sku || 'equipamento'}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Checklist baixado',
      description: 'O arquivo com o laudo de revisão foi salvo no seu computador.',
    })
  }

  // Part actions
  const handleOpenAddPartModal = () => {
    setEditingPart(null)
    setPartName('')
    setPartCost(0)
    setPartSupplier('')
    setPartPurchaseDate(new Date().toISOString().split('T')[0])
    setPartStatus('Instalado')
    setPartNotes('')
    setPartModalOpen(true)
  }

  const handleOpenEditPartModal = (p: EquipmentPart) => {
    setEditingPart(p)
    setPartName(p.name || '')
    setPartCost(Number(p.cost) || 0)
    setPartSupplier(p.supplier || '')
    setPartPurchaseDate(p.purchase_date ? p.purchase_date.split(' ')[0].split('T')[0] : '')
    setPartStatus(p.status || 'Instalado')
    setPartNotes(p.notes || '')
    setPartModalOpen(true)
  }

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product || !partName.trim()) return

    setSavingAction(true)
    try {
      const payload: any = {
        name: partName.trim(),
        cost: Number(partCost) || 0,
        status: partStatus,
        notes: partNotes.trim(),
        supplier: partSupplier.trim(),
        purchase_date: partPurchaseDate ? new Date(partPurchaseDate).toISOString() : undefined,
        product_id: product.id,
        purchase_batch_id: product.purchase_batch_id || undefined,
      }

      if (editingPart) {
        await equipmentService.updatePart(editingPart.id, payload)
        toast({
          title: 'Peça atualizada',
          description: 'A peça e seu custo foram alterados com sucesso.',
        })
      } else {
        await equipmentService.createPart(payload)
        toast({
          title: 'Peça adicionada',
          description: 'A peça e seu custo foram vinculados ao equipamento e ao lote.',
        })
      }
      setPartModalOpen(false)
      const updatedParts = await equipmentService.getPartsByProduct(product.id)
      setParts(updatedParts)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar peça',
        variant: 'destructive',
      })
    } finally {
      setSavingAction(false)
    }
  }

  const handleConfirmDeletePart = async () => {
    if (!partToDelete) return
    setDeletingPart(true)
    try {
      await equipmentService.deletePart(partToDelete.id)
      setParts(parts.filter((p) => p.id !== partToDelete.id))
      toast({ title: 'Peça removida com sucesso' })
      setPartToDelete(null)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao remover peça',
        variant: 'destructive',
      })
    } finally {
      setDeletingPart(false)
    }
  }

  // Quick Sale Actions
  const handleOpenQuickSaleModal = () => {
    if (!product) return
    if (product.status !== 'Disponível') {
      toast({
        title: 'Equipamento indisponível para venda',
        description: `O status atual deste item é "${product.status}". Apenas equipamentos "Disponível" podem ser vendidos.`,
        variant: 'destructive',
      })
      return
    }
    setQuickSaleCustomer('')
    setQuickSaleContact('')
    setQuickSalePrice(Number(product.unit_price) || 0)
    setQuickSalePaymentMethod('PIX')
    setQuickSaleNotes('')
    setQuickSaleModalOpen(true)
  }

  const handleConfirmQuickSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product || !quickSaleCustomer.trim()) return

    setSubmittingQuickSale(true)
    try {
      // Find batch or create fallback batch if needed
      let targetBatch = primaryBatch
      if (!targetBatch) {
        // Create an inventory batch for tracking
        targetBatch = await batchesService.create({
          product_id: product.id,
          batch_number: `LOTE-${product.sku || 'UN'}`,
          location: 'Venda Direta',
          quantity: 1,
        })
      }

      // Combine payment method into notes if provided
      const fullNotes = [
        quickSaleNotes.trim(),
        quickSalePaymentMethod ? `Forma de pagamento: ${quickSalePaymentMethod}` : '',
        `Venda rápida direta da ficha (${product.sku})`,
      ]
        .filter(Boolean)
        .join(' | ')

      // Call salesService.createSale with user_id to ensure seller audit
      await salesService.createSale({
        customer_name: quickSaleCustomer.trim(),
        customer_contact: quickSaleContact.trim(),
        notes: fullNotes,
        user_id: user?.id,
        items: [
          {
            product_id: product.id,
            batch_id: targetBatch.id,
            quantity: 1,
            unit_price: Number(quickSalePrice) || 0,
          },
        ],
      })

      // Also ensure status is explicitly 'Vendido' in case batches logic was bypassed
      await productsService.updateStatus(product.id, 'Vendido')

      toast({
        title: 'Venda rápida realizada com sucesso!',
        description: `O equipamento ${product.name} foi marcado como Vendido e baixado do estoque.`,
      })

      setQuickSaleModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao registrar venda rápida',
        description: err?.message || 'Falha ao salvar a venda no sistema.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingQuickSale(false)
    }
  }

  // Deliverable actions
  const handleAddDeliverable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product || !delivName.trim()) return

    setSavingAction(true)
    try {
      await equipmentService.createDeliverable({
        product_id: product.id,
        item_name: delivName.trim(),
        status: delivStatus,
        notes: delivNotes.trim(),
      })
      toast({
        title: 'Item de entrega adicionado',
        description: 'Pendência registrada com sucesso.',
      })
      setDeliverableModalOpen(false)
      setDelivName('')
      setDelivNotes('')
      const updated = await equipmentService.getDeliverablesByProduct(product.id)
      setDeliverables(updated)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao registrar item',
        variant: 'destructive',
      })
    } finally {
      setSavingAction(false)
    }
  }

  const handleToggleDeliverableStatus = async (item: EquipmentDeliverable) => {
    const nextStatus = item.status === 'Resolvido' ? 'Pendente' : 'Resolvido'
    try {
      await equipmentService.updateDeliverable(item.id, { status: nextStatus })
      setDeliverables(
        deliverables.map((d) => (d.id === item.id ? { ...d, status: nextStatus } : d)),
      )
      toast({
        title: `Item marcado como ${nextStatus}`,
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteDeliverable = async (delivId: string) => {
    try {
      await equipmentService.deleteDeliverable(delivId)
      setDeliverables(deliverables.filter((d) => d.id !== delivId))
      toast({ title: 'Item removido' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteProduct = async () => {
    if (!product) return
    setDeletingProduct(true)
    try {
      await productsService.delete(product.id)
      toast({
        title: 'Equipamento excluído com sucesso',
        description: 'O item foi removido do catálogo e do estoque.',
      })
      if (product.purchase_batch_id) {
        navigate(`/lotes-entrada/${product.purchase_batch_id}`)
      } else {
        navigate('/produtos')
      }
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao excluir equipamento',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setDeletingProduct(false)
      setDeleteProductDialogOpen(false)
    }
  }

  // Quick Status Change
  const handleChangeStatus = async (newStatus: 'Disponível' | 'Reservado' | 'Vendido') => {
    if (!product) return
    try {
      await productsService.updateStatus(product.id, newStatus)
      setProduct({ ...product, status: newStatus })
      toast({
        title: 'Status atualizado',
        description: `O equipamento agora está marcado como "${newStatus}".`,
      })
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Carregando lote e detalhes do equipamento...</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Lote ou equipamento não encontrado</h2>
        <p className="text-sm text-slate-500">
          O código ou identificador informado não corresponde a nenhum lote ou notebook cadastrado.
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/estoque">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Ver Estoque / Lotes
            </Button>
          </Link>
          <Link to="/produtos">
            <Button className="bg-slate-900 text-white">Ver Catálogo</Button>
          </Link>
        </div>
      </div>
    )
  }

  const statusVal = product.status || 'Disponível'

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top action and navigation bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/estoque"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar aos Lotes
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            to="/produtos"
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
          >
            Catálogo Geral
          </Link>
        </div>

        {/* Operational buttons: Imprimir Etiqueta, Editar Lote/Equipamento, Gerenciar Fotos */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="default"
            size="sm"
            onClick={() => setEtiquetaModalOpen(true)}
            className="text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold"
            title="Gerar e imprimir etiqueta com QR Code e Serial do equipamento"
          >
            <QrCode className="w-4 h-4" />
            Imprimir Etiqueta
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPhotoModalOpen(true)}
            className="text-xs h-9 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            Fotos ({photos.length})
          </Button>

          {isAdmin && (
            <Button
              onClick={handleOpenEditModal}
              size="sm"
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 gap-1.5 shadow-sm"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Editar Equipamento
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Gallery & Main Info (Replicando o visual do Replit com detalhes de ponta) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Photos & History (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Photo Display with Photo Manager Action */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="aspect-16/10 bg-slate-100 relative group overflow-hidden flex items-center justify-center">
              <img
                src={photos[selectedPhotoIndex] || photos[0]}
                alt={product.name}
                className="w-full h-full object-cover object-center transition-all duration-300"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'https://img.usecurling.com/p/800/600?q=laptop'
                }}
              />
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-md font-mono font-semibold flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                Foto {selectedPhotoIndex + 1} de {photos.length}
              </div>

              {/* Floating button to manage photos */}
              <button
                type="button"
                onClick={() => setPhotoModalOpen(true)}
                className="absolute top-3 right-3 bg-white/90 hover:bg-white text-slate-800 text-xs px-2.5 py-1 rounded-md font-semibold shadow flex items-center gap-1.5 transition-all opacity-90 group-hover:opacity-100"
              >
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                Gerenciar fotos
              </button>
            </div>

            {/* Thumbnail Gallery Strip */}
            {photos.length > 1 && (
              <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex gap-2.5 overflow-x-auto">
                {photos.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                      selectedPhotoIndex === idx
                        ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Thumb ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lote e Rastreabilidade Física (Destaque do Lote individual) */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-r from-slate-50/50 to-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Rastreabilidade do Lote Físico
                </CardTitle>
                <CardDescription className="text-xs">
                  Dados de armazenagem e identificação individual deste equipamento.
                </CardDescription>
              </div>
              {primaryBatch && (
                <Badge variant="outline" className="font-mono bg-white text-slate-800 font-bold">
                  {primaryBatch.batch_number}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    Identificador do Lote
                  </span>
                  <span className="font-mono font-bold text-slate-900 block mt-0.5">
                    {primaryBatch?.batch_number || 'Sem lote'}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" /> Localização Física
                  </span>
                  <span className="font-semibold text-slate-800 block mt-0.5 truncate">
                    {primaryBatch?.location || 'Depósito Central'}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    Saldo no Lote
                  </span>
                  <span
                    className={`font-mono font-bold block mt-0.5 ${
                      (primaryBatch?.quantity ?? 0) > 0 ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {primaryBatch?.quantity ?? 0} unidade(s)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico do Equipamento (igual ao Replit) */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Histórico do Equipamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {product.history_events && product.history_events.length > 0 ? (
                  product.history_events.map((ev, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-white" />
                      <p className="text-xs font-semibold text-slate-800">{ev.title}</p>
                      <p className="text-[11px] text-slate-500">{ev.date}</p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-white" />
                      <p className="text-xs font-semibold text-slate-800">
                        Inspeção e testes registrados
                      </p>
                      <p className="text-[11px] text-slate-500">2 de setembro de 2026 às 08:16</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                      <p className="text-xs font-semibold text-slate-800">
                        Equipamento preparado para anúncio
                      </p>
                      <p className="text-[11px] text-slate-500">2 de setembro de 2026 às 08:16</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Peças e Manutenções Vinculadas */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  Peças & Trocas Vinculadas
                </CardTitle>
                <CardDescription className="text-xs">
                  Registro de peças instaladas (tela, bateria, upgrade de SSD) com composição de
                  custo.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenAddPartModal}
                className="text-xs h-8 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Peça
              </Button>
            </CardHeader>
            <CardContent>
              {parts.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                  Nenhuma peça ou troca vinculada a este equipamento.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border rounded-lg overflow-hidden">
                  {parts.map((p) => (
                    <div key={p.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{p.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              p.status === 'Instalado'
                                ? 'bg-emerald-50 text-emerald-700'
                                : p.status === 'Pendente'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[11px]">
                          {p.supplier && <span>Forn: {p.supplier}</span>}
                          {p.supplier && p.purchase_date && <span>•</span>}
                          {p.purchase_date && (
                            <span>{new Date(p.purchase_date).toLocaleDateString('pt-BR')}</span>
                          )}
                          {p.notes && <span>({p.notes})</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700 mr-1">
                          R${' '}
                          {Number(p.cost || 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditPartModal(p)}
                          className="text-slate-400 hover:text-orange-600 p-1"
                          title="Editar peça"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPartToDelete(p)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remover peça"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="p-2.5 bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>Custo Adicional em Peças:</span>
                    <span className="font-mono text-amber-700">
                      R$ {totalPartsCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pendências de Entrega */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  Pendências de Entrega & Acessórios
                </CardTitle>
                <CardDescription className="text-xs">
                  Controle de itens que devem acompanhar o produto (ex: carregador, fonte, cabo,
                  manual).
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeliverableModalOpen(true)}
                className="text-xs h-8 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Item
              </Button>
            </CardHeader>
            <CardContent>
              {deliverables.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                  Nenhum item pendente registrado para este notebook.
                </p>
              ) : (
                <div className="space-y-2">
                  {deliverables.map((d) => (
                    <div
                      key={d.id}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs transition-colors ${
                        d.status === 'Resolvido'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-amber-50/40 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleDeliverableStatus(d)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            d.status === 'Resolvido'
                              ? 'bg-emerald-600 text-white'
                              : 'border border-amber-400 bg-white text-transparent hover:text-amber-500'
                          }`}
                          title="Alternar resolvido / pendente"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <div>
                          <p
                            className={`font-semibold ${
                              d.status === 'Resolvido'
                                ? 'text-slate-800 line-through text-slate-500'
                                : 'text-slate-900'
                            }`}
                          >
                            {d.item_name}
                          </p>
                          {d.notes && <p className="text-[11px] text-slate-500">{d.notes}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 border-none font-semibold ${
                            d.status === 'Resolvido'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {d.status}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => handleDeleteDeliverable(d.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Specifications, Financial Box, Checklist (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Title, Code & Price Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {product.sku}
                    </span>
                    {product.serial_number && (
                      <span className="font-mono text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        S/N: {product.serial_number}
                      </span>
                    )}
                    {product.purchase_batch_id && (
                      <Link
                        to={`/lotes-entrada/${product.purchase_batch_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded border border-orange-200 transition-colors"
                      >
                        <Boxes className="w-3 h-3" />
                        Lote de Origem
                      </Link>
                    )}
                    <Badge variant="outline" className="text-xs bg-slate-50">
                      {product.category || 'Notebooks'}
                    </Badge>
                  </div>

                  {/* Status Dropdown */}
                  <Select
                    value={statusVal}
                    onValueChange={(val: 'Disponível' | 'Reservado' | 'Vendido') =>
                      handleChangeStatus(val)
                    }
                  >
                    <SelectTrigger className="w-32 h-7 text-xs font-bold bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Disponível">Disponível</SelectItem>
                      <SelectItem value="Reservado">Reservado</SelectItem>
                      <SelectItem value="Vendido">Vendido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
                    {product.name}
                  </h1>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenEditModal}
                      className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-1">
                  {product.brand} · {product.model || product.category}
                </p>
              </div>

              {/* Price Banner */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Preço anunciado
                </span>
                <div className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                  R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    Estoque no lote: <strong className="text-slate-800">{totalStock} un</strong>
                  </span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      statusVal === 'Disponível'
                        ? 'bg-emerald-100 text-emerald-800'
                        : statusVal === 'Reservado'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {statusVal}
                  </span>
                </div>
              </div>

              {/* Ações de Venda */}
              <div className="space-y-2">
                <Button
                  onClick={handleOpenQuickSaleModal}
                  disabled={statusVal !== 'Disponível'}
                  className={`w-full font-bold h-11 shadow-sm gap-2 text-sm transition-all ${
                    statusVal === 'Disponível'
                      ? 'bg-[#d9532f] hover:bg-[#c24624] text-white shadow-orange-500/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title={
                    statusVal === 'Disponível'
                      ? 'Venda rápida imediata com baixa de estoque'
                      : `Indisponível para venda (${statusVal})`
                  }
                >
                  <DollarSign className="w-4 h-4" />
                  {statusVal === 'Disponível' ? '⚡ Venda Rápida' : `Equipamento ${statusVal}`}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate(`/vendas?nova=true&produto=${product.id}`)}
                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-50 font-medium h-9 text-xs gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  Abrir Proposta Completa (Vendas)
                </Button>

                <p className="text-[11px] text-center text-slate-400">
                  {statusVal === 'Disponível'
                    ? 'A Venda Rápida dá baixa imediata no lote físico e atualiza o status para Vendido.'
                    : 'Este equipamento já não está disponível em estoque físico.'}
                </p>
              </div>

              {/* Painel de CUSTO x VENDA x MARGEM (Visível para Admin) */}
              {isAdmin && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-900 text-white space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      Controle Financeiro (Admin)
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenEditModal}
                      className="text-[10px] text-emerald-400 hover:underline"
                    >
                      Editar preços
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Custo Aquisição:</span>
                      <span className="font-mono font-semibold text-slate-200">
                        R$ {cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Peças / Reparos:</span>
                      <span className="font-mono font-semibold text-slate-200">
                        R$ {totalPartsCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Margem Bruta (R$):</span>
                      <span className="font-mono font-extrabold text-emerald-400 text-sm">
                        R$ {marginCombined.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[11px]">Margem (%):</span>
                      <span className="font-mono font-extrabold text-emerald-400 text-sm">
                        {marginPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Especificações Técnicas (igual ao Replit) */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Especificações</h3>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleOpenEditModal}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Alterar specs
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Processador
                    </span>
                    <span className="font-medium text-slate-800 block truncate">
                      {product.processor || 'Core I7'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Memória RAM
                    </span>
                    <span className="font-medium text-slate-800 block">
                      {product.ram || '16GB DDR4'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Armazenamento
                    </span>
                    <span className="font-medium text-slate-800 block">
                      {product.storage || 'SSD 256GB'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Bateria
                    </span>
                    <span className="font-medium text-slate-800 block">
                      {product.battery_health || '100%'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Condição Geral
                    </span>
                    <span className="font-medium text-slate-800 block">
                      {product.condition || 'Excelente'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Nota Estética
                    </span>
                    <span className="font-medium text-slate-800 block">
                      {product.aesthetic_grade || 'A - Excelente'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Carregador
                    </span>
                    <span className="font-medium text-slate-800 block">
                      {product.includes_charger ? 'Sim (Acompanha)' : 'Não acompanha'}
                    </span>
                  </div>

                  {product.serial_number && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        Número de Série
                      </span>
                      <span className="font-medium font-mono text-slate-800 block truncate">
                        {product.serial_number}
                      </span>
                    </div>
                  )}
                </div>

                {product.bench_notes && (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs mt-2">
                    <span className="font-bold text-amber-800 block mb-1">Notas da Bancada:</span>
                    <p className="text-slate-700 whitespace-pre-wrap">{product.bench_notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Checklist de Revisão Técnica (replicando exatamente o layout do Replit) */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Checklist de Revisão
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Inspecionado · Revisão do equipamento
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {okCount} OK
                  </span>
                  {warningCount > 0 && (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {warningCount} Atenção
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto pr-1">
                {checklist.map((c, i) => (
                  <div key={i} className="py-2.5 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-800">{c.item}</span>
                      {c.observation && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{c.observation}</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold border-none px-2 py-0.5 whitespace-nowrap ${
                        c.status === 'OK'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'Atenção'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.status}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Botões de Ações: Baixar Checklist, Clonar Equipamento, Excluir (Identico ao Screenshot 1 do Replit) */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDownloadChecklist}
                    className="text-xs font-medium gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 h-9"
                    title="Baixar checklist"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar checklist
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setCloneModalOpen(true)}
                    className="text-xs font-semibold gap-1.5 border-[#d9532f]/40 text-[#d9532f] hover:bg-[#d9532f]/10 h-9"
                    title="Clonar equipamento"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Clonar equipamento
                  </Button>

                  {isAdmin && (
                    <Button
                      variant="outline"
                      onClick={() => setDeleteProductDialogOpen(true)}
                      className="text-xs font-medium gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50 h-9"
                      title="Excluir equipamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setEtiquetaModalOpen(true)}
                  className="w-full text-xs font-semibold gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-9"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir etiqueta com QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL: EDITAR LOTE & EQUIPAMENTO COMPLETO */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-slate-700" />
              Editar Lote & Equipamento
            </DialogTitle>
            <DialogDescription>
              Altere identificador do lote, localização física, preços, fotos e especificações do
              notebook.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Seção 1: Dados do Lote Físico */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <Layers className="w-4 h-4 text-emerald-600" />
                Dados do Lote Físico
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Identificador do Lote *
                  </Label>
                  <Input
                    placeholder="Ex: LOTE-NOT-2026-01"
                    value={editBatchNumber}
                    onChange={(e) => setEditBatchNumber(e.target.value.toUpperCase())}
                    className="font-mono text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Localização Físico</Label>
                  <Input
                    placeholder="Ex: Prateleira N-01"
                    value={editBatchLocation}
                    onChange={(e) => setEditBatchLocation(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Quantidade Físico</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editBatchQuantity}
                    onChange={(e) => setEditBatchQuantity(parseInt(e.target.value) || 0)}
                    className="text-xs font-mono"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Especificações do Equipamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Nome do Equipamento *
                </Label>
                <Input
                  placeholder="Nome completo do notebook..."
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Código Único / SKU *</Label>
                <Input
                  placeholder="Ex: FS0V6K3"
                  value={editSku}
                  onChange={(e) => setEditSku(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Código Sistema</Label>
                <Input
                  placeholder="EQ-2026-..."
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Marca</Label>
                <Input
                  placeholder="Dell, Lenovo, HP..."
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Modelo</Label>
                <Input
                  placeholder="Latitude 5320..."
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Processador</Label>
                <Input
                  placeholder="Core I7 11ª Geração"
                  value={editProcessor}
                  onChange={(e) => setEditProcessor(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Memória RAM</Label>
                <Input
                  placeholder="16GB DDR4"
                  value={editRam}
                  onChange={(e) => setEditRam(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Armazenamento</Label>
                <Input
                  placeholder="SSD 256GB"
                  value={editStorage}
                  onChange={(e) => setEditStorage(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tela / Display</Label>
                <Input
                  placeholder='14", 15.6"'
                  value={editScreenSize}
                  onChange={(e) => setEditScreenSize(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Condição</Label>
                <Select value={editCondition} onValueChange={setEditCondition}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Excelente">Excelente</SelectItem>
                    <SelectItem value="Bom">Bom</SelectItem>
                    <SelectItem value="Regular">Regular</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nota Estética</Label>
                <Input
                  placeholder="A - Excelente, B - Bom"
                  value={editAestheticGrade}
                  onChange={(e) => setEditAestheticGrade(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Saúde Bateria</Label>
                <Input
                  placeholder="100%, 92%"
                  value={editBatteryHealth}
                  onChange={(e) => setEditBatteryHealth(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={(val: ProductStatus) => setEditStatus(val)}
                >
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

              {/* Precificação / Custo */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Custo de Aquisição (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editCostPrice}
                  onChange={(e) => setEditCostPrice(parseFloat(e.target.value) || 0)}
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
                  value={editUnitPrice}
                  onChange={(e) => setEditUnitPrice(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditModalOpen(false)}
                disabled={savingEdit}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white"
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ETIQUETA COM QR CODE MODAL */}
      <EtiquetaModal
        open={etiquetaModalOpen}
        onOpenChange={setEtiquetaModalOpen}
        data={{
          product,
          batch: primaryBatch,
          batchNumber: primaryBatch?.batch_number,
          location: primaryBatch?.location,
          status: product?.status,
          price: Number(product?.unit_price) || 0,
          serialNumber: product?.serial_number || product?.sku,
          sku: product?.sku,
          productName: product?.name,
          brand: product?.brand,
          model: product?.model,
        }}
      />

      {/* MODAL: GERENCIAR FOTOS DO EQUIPAMENTO */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              Fotos do Equipamento ({photos.length})
            </DialogTitle>
            <DialogDescription>
              Faça upload de fotos do notebook ou adicione links de imagens para compor o anúncio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Opção 1: Upload Direto de Arquivo */}
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Selecione fotos do seu computador / celular
              </p>
              <p className="text-[11px] text-slate-500">Suporta JPG, PNG e WebP até 10MB</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                accept="image/*"
                className="hidden"
                id="photoFileInput"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="text-xs bg-white border-slate-300"
              >
                {isUploadingPhoto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Enviando foto...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Escolher Fotos
                  </>
                )}
              </Button>
            </div>

            {/* Opção 2: Adicionar por URL */}
            <form onSubmit={handleAddPhotoUrl} className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Ou informe a URL da foto
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  className="text-xs font-mono"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUploadingPhoto || !photoUrlInput.trim()}
                  className="bg-slate-900 text-white shrink-0 text-xs"
                >
                  Adicionar
                </Button>
              </div>
            </form>

            {/* Grid de Fotos Atuais */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 block mb-2">
                Fotos Cadastradas ({photos.length})
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-100"
                  >
                    <img
                      src={url}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src =
                          'https://img.usecurling.com/p/400/400?q=laptop'
                      }}
                    />
                    <div className="absolute top-1.5 left-1.5 bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                      #{idx + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      disabled={isUploadingPhoto}
                      className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-md opacity-80 group-hover:opacity-100 transition-opacity"
                      title="Excluir foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="bg-slate-900 text-white"
              onClick={() => setPhotoModalOpen(false)}
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Adicionar / Editar Peça */}
      <Dialog open={partModalOpen} onOpenChange={setPartModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              {editingPart ? 'Editar Peça / Troca' : 'Adicionar Peça ou Troca'}
            </DialogTitle>
            <DialogDescription>
              Vincule peças trocadas (ex: tela nova, bateria, expansão de SSD) com o respectivo
              custo, compondo o custo deste equipamento e do lote de origem.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePart} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Nome da Peça *</Label>
              <Input
                placeholder="Ex: Bateria Original Dell 4-cell"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Custo da Peça (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={partCost}
                  onChange={(e) => setPartCost(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select value={partStatus} onValueChange={(val: any) => setPartStatus(val)}>
                  <SelectTrigger className="text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Instalado">Instalado</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Trocado">Trocado</SelectItem>
                    <SelectItem value="Danificado">Danificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Fornecedor (Opcional)
                </Label>
                <Input
                  placeholder="Ex: KaBuM!, Mercado Livre"
                  value={partSupplier}
                  onChange={(e) => setPartSupplier(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Data da Compra</Label>
                <Input
                  type="date"
                  value={partPurchaseDate}
                  onChange={(e) => setPartPurchaseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Observações / Detalhes</Label>
              <Input
                placeholder="Ex: Trocada na revisão de entrada"
                value={partNotes}
                onChange={(e) => setPartNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setPartModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingAction}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {savingAction ? 'Salvando...' : editingPart ? 'Atualizar Peça' : 'Salvar Peça'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão de Peça */}
      <AlertDialog open={!!partToDelete} onOpenChange={(open) => !open && setPartToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover peça vinculada?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja remover a peça &quot;{partToDelete?.name}&quot; no valor de{' '}
              {(Number(partToDelete?.cost) || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
              ? Esta alteração deduzirá o custo deste equipamento e do lote.
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

      {/* MODAL: Adicionar Pendência de Entrega */}
      <Dialog open={deliverableModalOpen} onOpenChange={setDeliverableModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              Registrar Pendência de Entrega
            </DialogTitle>
            <DialogDescription>
              Acompanhe itens que devem acompanhar o produto (fonte, cabo, manual, adaptador).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddDeliverable} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Item / Acessório *</Label>
              <Input
                placeholder="Ex: Carregador Dell 65W Original"
                value={delivName}
                onChange={(e) => setDelivName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Estado Inicial</Label>
              <Select value={delivStatus} onValueChange={(val: any) => setDelivStatus(val)}>
                <SelectTrigger className="text-xs h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Resolvido">Resolvido (Pronto/Incluso)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Observações</Label>
              <Input
                placeholder="Ex: Separado na caixa com o equipamento"
                value={delivNotes}
                onChange={(e) => setDelivNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setDeliverableModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingAction}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {savingAction ? 'Salvando...' : 'Salvar Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Venda Rápida */}
      <Dialog open={quickSaleModalOpen} onOpenChange={setQuickSaleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#d9532f]" />
              Venda Rápida de Equipamento
            </DialogTitle>
            <DialogDescription>
              Emita a venda deste equipamento imediatamente. O status será marcado como{' '}
              <strong>Vendido</strong> e a baixa no estoque do lote será concluída automaticamente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmQuickSale} className="space-y-4 py-2">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-slate-800">{product.name}</div>
              <div className="text-slate-500 font-mono">
                SKU: {product.sku} {product.serial_number ? `• S/N: ${product.serial_number}` : ''}
              </div>
              <div className="text-slate-500">
                Lote de estoque:{' '}
                <strong>{primaryBatch?.batch_number || `LOTE-${product.sku}`}</strong>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Nome do Cliente *</Label>
              <Input
                placeholder="Ex: João da Silva / Tech Soluções"
                value={quickSaleCustomer}
                onChange={(e) => setQuickSaleCustomer(e.target.value)}
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Contato (WhatsApp / Telefone / E-mail)
              </Label>
              <Input
                placeholder="Ex: (11) 98765-4321 / cliente@email.com"
                value={quickSaleContact}
                onChange={(e) => setQuickSaleContact(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Preço Praticado (R$) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={quickSalePrice}
                  onChange={(e) => setQuickSalePrice(parseFloat(e.target.value) || 0)}
                  className="font-mono text-sm font-semibold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Forma de Pagamento</Label>
                <Select
                  value={quickSalePaymentMethod}
                  onValueChange={(val) => setQuickSalePaymentMethod(val)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                    <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                    <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Observações da Venda</Label>
              <Textarea
                rows={2}
                placeholder="Ex: Garantia de balcão 90 dias, entregue em mãos"
                value={quickSaleNotes}
                onChange={(e) => setQuickSaleNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickSaleModalOpen(false)}
                disabled={submittingQuickSale}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingQuickSale}
                className="bg-[#d9532f] hover:bg-[#c24624] text-white font-semibold"
              >
                {submittingQuickSale ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finalizando Venda...
                  </>
                ) : (
                  'Confirmar e Dar Baixa'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CLONAR EQUIPAMENTO */}
      <CloneEquipmentModal
        open={cloneModalOpen}
        onOpenChange={setCloneModalOpen}
        product={product}
        onSuccess={(count, targetBatchId) => {
          loadData()
          if (targetBatchId) {
            navigate(`/lotes-entrada/${targetBatchId}`)
          }
        }}
      />

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE EQUIPAMENTO */}
      <AlertDialog open={deleteProductDialogOpen} onOpenChange={setDeleteProductDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">
              Excluir este equipamento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente o item <strong>{product?.name}</strong> (
              {product?.sku || product?.serial_number}) do catálogo e do lote de estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProduct}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteProduct()
              }}
              disabled={deletingProduct}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {deletingProduct ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Sim, excluir equipamento'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
