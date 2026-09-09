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
import { EtiquetaModal } from '@/components/EtiquetaModal'
import { CloneEquipmentModal } from '@/components/CloneEquipmentModal'
import { ZoomableImage } from '@/components/ZoomableImage'
import { ImageLightboxModal } from '@/components/ImageLightboxModal'
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import type {
  Product,
  Batch,
  EquipmentPart,
  EquipmentDeliverable,
  TechnicalChecklistItem,
  ProductStatus,
  ChecklistItemStatus,
} from '@/types/inventory'
import {
  CHECKLIST_CANONICAL_ITEMS,
  CHECKLIST_OPTIONS,
  normalizeChecklistStatus,
  normalizeChecklistItemName,
  getChecklistStatusStyles,
} from '@/lib/checklist'
import {
  CONDITION_TYPE_OPTIONS,
  CONDITION_GRADE_OPTIONS,
  resolveCondition,
  getConditionBadgeStyles,
  type ConditionType,
  type ConditionGrade,
} from '@/lib/condition'
import { SingleMLPublishModal } from '@/components/SingleMLPublishModal'
import { BackgroundRemovalModal } from '@/components/BackgroundRemovalModal'
import { PhotoReorderGrid, PhotoOrderItem } from '@/components/PhotoReorderGrid'
import {
  validateProductForML,
  mlService,
  deriveProductFamily,
  type MLItemResponse,
} from '@/services/mlService'
import { ShoppingBag, PauseCircle, PlayCircle, XCircle, Wand2 } from 'lucide-react'

export default function CatalogoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [parts, setParts] = useState<EquipmentPart[]>([])
  const [deliverables, setDeliverables] = useState<EquipmentDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)

  // Modais
  const [zoomModalOpen, setZoomModalOpen] = useState(false)
  const [etiquetaModalOpen, setEtiquetaModalOpen] = useState(false)
  const [mlPublishModalOpen, setMlPublishModalOpen] = useState(false)
  const [liveMLItem, setLiveMLItem] = useState<MLItemResponse | null>(null)
  const [updatingMLStatus, setUpdatingMLStatus] = useState(false)
  const [cloneModalOpen, setCloneModalOpen] = useState(false)
  const [deleteProductDialogOpen, setDeleteProductDialogOpen] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(false)

  // Checklist Edit Modal
  const [checklistModalOpen, setChecklistModalOpen] = useState(false)
  const [editChecklistItems, setEditChecklistItems] = useState<
    { item: string; status: ChecklistItemStatus; observation: string }[]
  >([])
  const [editInspectionStatus, setEditInspectionStatus] = useState<
    'Concluída' | 'Em andamento' | 'Pendente'
  >('Concluída')
  const [savingChecklist, setSavingChecklist] = useState(false)

  // Modal Editar Equipamento / Lote
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSku, setEditSku] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editPartNumber, setEditPartNumber] = useState('')
  const [editSerialNumber, setEditSerialNumber] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editCategory, setEditCategory] = useState('Notebooks')
  const [editProcessor, setEditProcessor] = useState('')
  const [editRam, setEditRam] = useState('')
  const [editStorage, setEditStorage] = useState('')
  const [editConditionType, setEditConditionType] = useState<ConditionType>('recondicionado')
  const [editConditionGrade, setEditConditionGrade] = useState<ConditionGrade | undefined>(
    'excelente',
  )
  const [editCondition, setEditCondition] = useState('Excelente')
  const [editAestheticGrade, setEditAestheticGrade] = useState('A - Excelente')
  const [editBatteryHealth, setEditBatteryHealth] = useState('100%')
  const [editScreenSize, setEditScreenSize] = useState('14"')
  const [editHasNumericKeypad, setEditHasNumericKeypad] = useState<boolean>(false)
  const [editIncludesCharger, setEditIncludesCharger] = useState<boolean>(true)
  const [editGtin, setEditGtin] = useState('')
  const [editUnitPrice, setEditUnitPrice] = useState<number>(0)
  const [editCostPrice, setEditCostPrice] = useState<number>(0)
  const [editStatus, setEditStatus] = useState<ProductStatus>('Disponível')
  const [editDescription, setEditDescription] = useState('')
  const [editBatchLocation, setEditBatchLocation] = useState('')
  const [editBatchQuantity, setEditBatchQuantity] = useState<number>(1)
  const [editBatchNumber, setEditBatchNumber] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Gerenciador de Fotos e IA de Remoção de Fundo
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [bgRemovalModalOpen, setBgRemovalModalOpen] = useState(false)
  const [bgRemovalTargetIndex, setBgRemovalTargetIndex] = useState(0)
  const [photoUrlInput, setPhotoUrlInput] = useState('')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [localModalPhotos, setLocalModalPhotos] = useState<
    Array<{ type: 'photo' | 'image'; value: string; originalIndex: number }>
  >([])
  const [isSavingPhotoOrder, setIsSavingPhotoOrder] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Peças & Trocas
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

  // Pendências de Entrega
  const [deliverableModalOpen, setDeliverableModalOpen] = useState(false)
  const [delivName, setDelivName] = useState('')
  const [delivStatus, setDelivStatus] = useState<'Pendente' | 'Resolvido'>('Pendente')
  const [delivNotes, setDelivNotes] = useState('')

  // Venda Rápida
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

  // Se o produto já possui anúncio no Mercado Livre, consultar o status ao vivo
  useEffect(() => {
    if (product?.ml_listing_id) {
      mlService
        .getItem(product.ml_listing_id)
        .then((res) => setLiveMLItem(res))
        .catch(() => setLiveMLItem(null))
    } else {
      setLiveMLItem(null)
    }
  }, [product?.ml_listing_id])

  const handleUpdateMLStatus = async (newStatus: 'active' | 'paused' | 'closed') => {
    if (!product?.ml_listing_id) return
    setUpdatingMLStatus(true)
    try {
      await mlService.updateItemStatus(product.ml_listing_id, newStatus, product.id)
      toast({
        title: 'Status atualizado no Mercado Livre!',
        description: `O anúncio foi marcado como "${newStatus}".`,
      })
      if (liveMLItem) {
        setLiveMLItem({ ...liveMLItem, status: newStatus })
      }
      setProduct((prev) => (prev ? { ...prev, ml_listing_status: newStatus } : null))
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status no Mercado Livre',
        description: err?.message || 'Não foi possível atualizar o anúncio.',
        variant: 'destructive',
      })
    } finally {
      setUpdatingMLStatus(false)
    }
  }

  // Lista combinada de fotos (uploads PocketBase + URLs json) respeitando photo_order se presente
  const photos = useMemo(() => {
    const list: string[] = []
    if (!product) {
      return [
        'https://img.usecurling.com/p/800/600?q=laptop',
        'https://img.usecurling.com/p/800/600?q=keyboard',
        'https://img.usecurling.com/p/800/600?q=ports',
      ]
    }

    // Se houver sequência salva explicitamente em photo_order, seguir essa ordem prioritariamente
    if (
      product.photo_order &&
      Array.isArray(product.photo_order) &&
      product.photo_order.length > 0
    ) {
      const validPhotosSet = new Set(Array.isArray(product.photos) ? product.photos : [])
      const validImagesSet = new Set(Array.isArray(product.images) ? product.images : [])
      const visitedPhotos = new Set<string>()
      const visitedImages = new Set<string>()

      for (const item of product.photo_order) {
        if (!item || !item.value) continue
        if (item.type === 'photo') {
          if (validPhotosSet.has(item.value)) {
            list.push(productsService.getFileUrl(product, item.value))
            visitedPhotos.add(item.value)
          }
        } else if (item.type === 'image') {
          if (validImagesSet.has(item.value) || item.value.startsWith('http')) {
            list.push(item.value.trim())
            visitedImages.add(item.value)
          }
        }
      }

      // Adicionar eventuais fotos ou imagens novas ainda não presentes no photo_order
      if (product.photos && Array.isArray(product.photos)) {
        for (const fn of product.photos) {
          if (fn && !visitedPhotos.has(fn)) {
            list.push(productsService.getFileUrl(product, fn))
          }
        }
      }
      if (product.images && Array.isArray(product.images)) {
        for (const url of product.images) {
          if (
            url &&
            typeof url === 'string' &&
            url.trim().length > 0 &&
            !visitedImages.has(url.trim())
          ) {
            list.push(url.trim())
          }
        }
      }

      if (list.length > 0) {
        return list
      }
    }

    if (product.photos && Array.isArray(product.photos)) {
      for (const fn of product.photos) {
        if (fn) {
          list.push(productsService.getFileUrl(product, fn))
        }
      }
    }

    if (product.images && Array.isArray(product.images)) {
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

  // Lote principal associado
  const primaryBatch = batches[0] || null

  // Abrir modal de edição do equipamento / lote
  const handleOpenEditModal = () => {
    if (!product) return
    setEditName(product.name || '')
    setEditSku(product.sku || '')
    setEditCode(product.code || '')
    setEditPartNumber(product.part_number || '')
    setEditSerialNumber(product.serial_number || '')
    setEditBrand(product.brand || 'Dell')
    setEditModel(product.model || '')
    setEditCategory(product.category || 'Notebooks')
    setEditProcessor(product.processor || '')
    setEditRam(product.ram || '')
    setEditStorage(product.storage || '')
    const resolved = resolveCondition(
      product.condition_type,
      product.condition_grade,
      product.condition,
    )
    setEditConditionType(resolved.type)
    setEditConditionGrade(
      resolved.grade || (resolved.type === 'recondicionado' ? 'excelente' : undefined),
    )
    setEditCondition(product.condition || 'Excelente')
    setEditAestheticGrade(product.aesthetic_grade || 'A - Excelente')
    setEditBatteryHealth(product.battery_health || '100%')
    setEditScreenSize(product.screen_size || '14"')
    setEditHasNumericKeypad(Boolean(product.has_numeric_keypad))
    setEditIncludesCharger(Boolean(product.includes_charger))
    setEditGtin(product.gtin || '')
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

  // Salvar alterações de edição
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return

    setSavingEdit(true)
    try {
      // Se estava 'Pendente de ativação' e recebeu Part Number, ativar automaticamente para 'Disponível'
      // a menos que o usuário tenha explicitamente escolhido outro status
      let finalStatus = editStatus
      if (
        product.status === 'Pendente de ativação' &&
        editPartNumber.trim() &&
        editStatus === 'Pendente de ativação'
      ) {
        finalStatus = 'Disponível'
      }

      const updatedProd = await productsService.update(product.id, {
        name: editName,
        sku: editSku,
        code: editCode || editSku,
        part_number: editPartNumber.trim() || undefined,
        serial_number: editSerialNumber.trim() || undefined,
        brand: editBrand,
        model: editModel,
        category: editCategory,
        processor: editProcessor,
        ram: editRam,
        storage: editStorage,
        condition_type: editConditionType,
        condition_grade: editConditionGrade || null,
        condition: editCondition,
        aesthetic_grade: editAestheticGrade,
        battery_health: editBatteryHealth,
        screen_size: editScreenSize,
        has_numeric_keypad: editHasNumericKeypad,
        includes_charger: editIncludesCharger,
        gtin: editGtin.trim() || '',
        unit_price: Number(editUnitPrice) || 0,
        cost_price: Number(editCostPrice) || 0,
        status: finalStatus,
        description: editDescription,
      })

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

  // Abertura do modal de remoção de fundo com IA
  const handleOpenBgRemoval = (photoIndex: number) => {
    setBgRemovalTargetIndex(photoIndex)
    setBgRemovalModalOpen(true)
  }

  // Callback ao salvar a imagem processada pela IA
  const handleSaveProcessedPhoto = async (
    newFile: File,
    photoIndex: number,
    replaceOriginal: boolean,
  ) => {
    if (!product) return

    setIsUploadingPhoto(true)
    try {
      const totalUploadedPhotos = Array.isArray(product.photos) ? product.photos.length : 0

      if (replaceOriginal && photoIndex < totalUploadedPhotos) {
        // Substituir um arquivo específico no PocketBase preservando todos os demais:
        // No PocketBase multipart/form-data:
        // - 'photos+' anexa o novo arquivo File
        // - 'photos-' remove especificamente o filename antigo
        // Ao enviar ambos no mesmo FormData, o PB faz a substituição cirúrgica sem apagar os outros
        const targetFilename = product.photos![photoIndex]
        const formData = new FormData()
        formData.append('photos+', newFile)
        formData.append('photos-', targetFilename)

        const updated = await productsService.update(product.id, formData)
        setProduct(updated)
        initLocalModalPhotos(updated)
      } else if (replaceOriginal && photoIndex >= totalUploadedPhotos) {
        // Substituindo uma imagem por URL externa
        const imgIndex = photoIndex - totalUploadedPhotos
        const currentImages = Array.isArray(product.images) ? [...product.images] : []
        currentImages.splice(imgIndex, 1)

        // Anexar novo arquivo em photos+ preservando os existentes e atualizar array de images externas
        const formData = new FormData()
        formData.append('photos+', newFile)
        formData.append('images', JSON.stringify(currentImages))
        const updated = await productsService.update(product.id, formData)
        setProduct(updated)
        initLocalModalPhotos(updated)
      } else {
        // Modo adicionar como nova foto: usar photos+ para garantir que apenas concatena
        const formData = new FormData()
        formData.append('photos+', newFile)
        const updated = await productsService.update(product.id, formData)
        setProduct(updated)
        initLocalModalPhotos(updated)
      }

      await loadData()
    } catch (err: any) {
      console.error('Erro ao atualizar foto processada no produto:', err)
      throw err
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Sincronizar estado local do modal sempre que o modal abre ou o produto muda
  const initLocalModalPhotos = (prod: Product | null) => {
    if (!prod) {
      setLocalModalPhotos([])
      return
    }
    const combined: Array<{ type: 'photo' | 'image'; value: string; originalIndex: number }> = []

    // Se já tiver photo_order salvo, usar essa sequência exata
    if (prod.photo_order && Array.isArray(prod.photo_order) && prod.photo_order.length > 0) {
      const validPhotosSet = new Set(Array.isArray(prod.photos) ? prod.photos : [])
      const validImagesSet = new Set(Array.isArray(prod.images) ? prod.images : [])
      const visitedPhotos = new Set<string>()
      const visitedImages = new Set<string>()

      prod.photo_order.forEach((item, idx) => {
        if (!item || !item.value) return
        if (item.type === 'photo' && validPhotosSet.has(item.value)) {
          combined.push({ type: 'photo', value: item.value, originalIndex: idx })
          visitedPhotos.add(item.value)
        } else if (
          item.type === 'image' &&
          (validImagesSet.has(item.value) || item.value.startsWith('http'))
        ) {
          combined.push({ type: 'image', value: item.value.trim(), originalIndex: idx })
          visitedImages.add(item.value)
        }
      })

      // Adicionar fotos que não estavam em photo_order
      if (prod.photos && Array.isArray(prod.photos)) {
        prod.photos.forEach((fn, idx) => {
          if (fn && !visitedPhotos.has(fn)) {
            combined.push({ type: 'photo', value: fn, originalIndex: combined.length + idx })
          }
        })
      }
      // Adicionar imagens que não estavam em photo_order
      if (prod.images && Array.isArray(prod.images)) {
        prod.images.forEach((url, idx) => {
          if (
            url &&
            typeof url === 'string' &&
            url.trim().length > 0 &&
            !visitedImages.has(url.trim())
          ) {
            combined.push({
              type: 'image',
              value: url.trim(),
              originalIndex: combined.length + idx,
            })
          }
        })
      }

      setLocalModalPhotos(combined)
      return
    }

    if (prod.photos && Array.isArray(prod.photos)) {
      prod.photos.forEach((fn, idx) => {
        if (fn) {
          combined.push({ type: 'photo', value: fn, originalIndex: idx })
        }
      })
    }
    if (prod.images && Array.isArray(prod.images)) {
      prod.images.forEach((url, idx) => {
        if (url && typeof url === 'string' && url.trim().length > 0) {
          combined.push({ type: 'image', value: url.trim(), originalIndex: idx })
        }
      })
    }
    setLocalModalPhotos(combined)
  }

  const handleOpenPhotoModal = () => {
    initLocalModalPhotos(product)
    setPhotoModalOpen(true)
  }

  // Upload de fotos
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !product) return

    setIsUploadingPhoto(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('photos+', files[i])
      }

      const updated = await productsService.update(product.id, formData)
      setProduct(updated)
      initLocalModalPhotos(updated)
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

  // Adicionar URL de imagem
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
      initLocalModalPhotos(updated)
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

  // Remover foto da galeria
  const handleRemovePhoto = async (index: number) => {
    if (!product) return

    // Se estivermos manipulando o modal com lista local, pegar o item correspondente da lista local
    const targetItem = localModalPhotos[index]
    if (!targetItem) return

    setIsUploadingPhoto(true)
    try {
      const remainingOrder = (product.photo_order || []).filter(
        (it) => !(it.type === targetItem.type && it.value === targetItem.value),
      )

      if (targetItem.type === 'photo') {
        const targetFilename = targetItem.value
        // Utilizar photos- no PocketBase para exclusão atômica e atualizar photo_order
        const updated = await productsService.update(product.id, {
          'photos-': [targetFilename],
          photo_order: remainingOrder,
        } as any)
        setProduct(updated)
        initLocalModalPhotos(updated)
      } else {
        const currentImages = Array.isArray(product.images) ? [...product.images] : []
        const filteredImages = currentImages.filter((img) => img !== targetItem.value)
        const updated = await productsService.update(product.id, {
          images: filteredImages,
          photo_order: remainingOrder,
        })
        setProduct(updated)
        initLocalModalPhotos(updated)
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

  // Salvar a reordenação das fotos (photos e images)
  const handleSavePhotoOrder = async () => {
    if (!product) return
    setIsSavingPhotoOrder(true)
    try {
      const newPhotosOrder: string[] = []
      const newImagesOrder: string[] = []
      const newPhotoOrderItems: Array<{ type: 'photo' | 'image'; value: string }> = []

      for (const item of localModalPhotos) {
        newPhotoOrderItems.push({ type: item.type, value: item.value })
        if (item.type === 'photo') {
          newPhotosOrder.push(item.value)
        } else if (item.type === 'image') {
          newImagesOrder.push(item.value)
        }
      }

      // Salva ordem passando nova lista ordenada e photo_order completo
      const updated = await productsService.reorderPhotos(
        product.id,
        newPhotosOrder,
        newImagesOrder,
        newPhotoOrderItems,
      )
      setProduct(updated)
      initLocalModalPhotos(updated)
      setPhotoModalOpen(false)
      await loadData()
      toast({
        title: 'Ordem das fotos atualizada!',
        description: 'A nova sequência das fotos foi gravada com sucesso.',
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar ordem das fotos',
        description: err?.message || 'Não foi possível persistir a nova ordem.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingPhotoOrder(false)
    }
  }

  // Checklist canônico com itens padronizados
  const rawChecklist = product?.technical_checklist || []
  const checklist = useMemo(() => {
    if (!rawChecklist || rawChecklist.length === 0) {
      return CHECKLIST_CANONICAL_ITEMS.map((name) => ({
        item: name,
        status: 'Não testado' as ChecklistItemStatus,
        observation: '',
      }))
    }
    const map = new Map<string, TechnicalChecklistItem>()
    for (const c of rawChecklist) {
      const normalizedName = normalizeChecklistItemName(c.item)
      map.set(normalizedName.toLowerCase().trim(), {
        ...c,
        item: normalizedName,
      })
    }
    const result: TechnicalChecklistItem[] = []
    for (const canon of CHECKLIST_CANONICAL_ITEMS) {
      const existing = map.get(canon.toLowerCase().trim())
      if (existing) {
        result.push(existing)
        map.delete(canon.toLowerCase().trim())
      } else {
        result.push({
          item: canon,
          status: 'Não testado',
          observation: '',
        })
      }
    }
    for (const remaining of map.values()) {
      result.push(remaining)
    }
    return result
  }, [rawChecklist])

  // Contadores coloridos do checklist
  const okCount = checklist.filter((i) => normalizeChecklistStatus(i.status) === 'Ok').length
  const warningCount = checklist.filter(
    (i) => normalizeChecklistStatus(i.status) === 'Atenção',
  ).length
  const failureCount = checklist.filter(
    (i) => normalizeChecklistStatus(i.status) === 'Falha',
  ).length
  const untestedCount = checklist.filter(
    (i) => normalizeChecklistStatus(i.status) === 'Não testado',
  ).length
  const naCount = checklist.filter((i) => normalizeChecklistStatus(i.status) === 'N/A').length

  // Variáveis financeiras
  const cost = Number(product?.cost_price) || 0
  const price = Number(product?.unit_price) || 0
  const totalPartsCost = parts.reduce((acc, p) => acc + (Number(p.cost) || 0), 0)
  const totalCostCombined = cost + totalPartsCost
  const marginCombined = price - totalCostCombined
  const marginPercent =
    totalCostCombined > 0 ? ((marginCombined / totalCostCombined) * 100).toFixed(1) : '100'

  // Estoque total do equipamento
  const totalStock = batches.reduce((acc, b) => acc + (b.quantity || 0), 0)

  // Abrir modal de edição do checklist
  const handleOpenChecklistModal = () => {
    setEditChecklistItems(
      checklist.map((it) => ({
        item: it.item,
        status: normalizeChecklistStatus(it.status),
        observation: it.observation || '',
      })),
    )
    setEditInspectionStatus('Concluída')
    setChecklistModalOpen(true)
  }

  const handleEditItemStatus = (
    idx: number,
    newStatus: 'Ok' | 'Atenção' | 'Falha' | 'Não testado' | 'N/A',
  ) => {
    setEditChecklistItems((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], status: newStatus }
      return copy
    })
  }

  const handleEditItemObs = (idx: number, obs: string) => {
    setEditChecklistItems((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], observation: obs }
      return copy
    })
  }

  const handleSetAllChecklistModal = (statusVal: 'Ok' | 'Não testado') => {
    setEditChecklistItems((prev) =>
      prev.map((it) => ({
        ...it,
        status: statusVal,
      })),
    )
  }

  const handleSaveChecklist = async () => {
    if (!product) return
    setSavingChecklist(true)
    try {
      const historyCopy = Array.isArray(product.history_events) ? [...product.history_events] : []
      historyCopy.unshift({
        title: `Checklist de Inspeção atualizado (${editInspectionStatus})`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      })

      const updated = await productsService.update(product.id, {
        technical_checklist: editChecklistItems,
        history_events: historyCopy,
      })
      setProduct(updated)
      setChecklistModalOpen(false)
      toast({
        title: 'Checklist atualizado com sucesso!',
        description: `Todos os ${checklist.length} itens técnicos foram salvos para ${product.name}.`,
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar checklist',
        description: err?.message || 'Não foi possível salvar o checklist.',
        variant: 'destructive',
      })
    } finally {
      setSavingChecklist(false)
    }
  }

  const handleInlineChangeStatus = async (
    itemIndex: number,
    newStatus: 'Ok' | 'Atenção' | 'Falha' | 'Não testado' | 'N/A',
  ) => {
    if (!product) return
    const updatedChecklist = checklist.map((it, idx) => {
      if (idx === itemIndex) {
        return { ...it, status: newStatus }
      }
      return it
    })
    try {
      const updated = await productsService.update(product.id, {
        technical_checklist: updatedChecklist,
      })
      setProduct(updated)
      toast({
        title: `Item "${checklist[itemIndex].item}" atualizado`,
        description: `Status alterado para ${newStatus}.`,
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao atualizar item',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  // Download do laudo e checklist em texto formatado
  const handleDownloadChecklist = () => {
    if (!product) return

    const checklistContent = checklist
      .map((item) => {
        const norm = normalizeChecklistStatus(item.status)
        return `[${norm.toUpperCase()}] ${item.item}${item.observation ? ` - Obs: ${item.observation}` : ''}`
      })
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

    const sep = '-----------------------------------------------------'
    const reportDivider = '*****************************************************'
    const reportText = [
      reportDivider,
      'LAUDO TÉCNICO E CHECKLIST DE INSPEÇÃO / REVISÃO',
      'AmbicorpFlow - Gestão de Equipamentos',
      reportDivider,
      `Equipamento: ${product.name}`,
      `Código / SKU: ${product.sku}`,
      `Lote Físico: ${primaryBatch ? primaryBatch.batch_number : 'Sem lote vinculado'}`,
      `Localização: ${primaryBatch?.location || 'Depósito Central'}`,
      `Marca / Modelo: ${product.brand || 'Dell'} ${product.model || ''}`,
      `Condição Geral: ${product.condition || 'Excelente'}`,
      `Nota Estética: ${product.aesthetic_grade || 'A'}`,
      `Saúde da Bateria: ${product.battery_health || '100%'}`,
      `Preço Sugerido: R$ ${price.toFixed(2)}`,
      `Data da Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
      '',
      sep,
      'ESPECIFICAÇÕES TÉCNICAS:',
      `- Processador: ${product.processor || 'N/A'}`,
      `- Memória RAM: ${product.ram || 'N/A'}`,
      `- Armazenamento: ${product.storage || 'N/A'}`,
      `- Tela: ${product.screen_size || 'N/A'}`,
      `- Carregador: ${product.includes_charger ? 'Sim (Acompanha)' : 'Não acompanha'}`,
      '',
      sep,
      `CHECKLIST DE INSPEÇÃO TÉCNICA (Total: ${checklist.length} itens)`,
      'Status Resumo:',
      `[OK (Verde)]: ${okCount} itens`,
      `[ATENÇÃO (Amarelo)]: ${warningCount} itens`,
      `[FALHA (Vermelho)]: ${failureCount} itens`,
      `[NÃO TESTADO (Azul)]: ${untestedCount} itens`,
      `[N/A (Roxo)]: ${naCount} itens`,
      '',
      checklistContent,
      '',
      sep,
      'PEÇAS E REPAROS REALIZADOS:',
      partsContent,
      '',
      sep,
      'ITENS E PENDÊNCIAS DE ENTREGA:',
      delivContent,
      reportDivider,
      'Relatório gerado via AmbicorpFlow. Equipamento testado e aprovado para comercialização.',
    ].join('\n')

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

  // Handlers de Peças
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

  // Handlers de Venda Rápida
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
      let targetBatch = primaryBatch
      if (!targetBatch) {
        targetBatch = await batchesService.create({
          product_id: product.id,
          batch_number: `LOTE-${product.sku || 'UN'}`,
          location: 'Venda Direta',
          quantity: 1,
        })
      }

      const fullNotes = [
        quickSaleNotes.trim(),
        quickSalePaymentMethod ? `Forma de pagamento: ${quickSalePaymentMethod}` : '',
        `Venda rápida direta da ficha (${product.sku})`,
      ]
        .filter(Boolean)
        .join(' | ')

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

  // Handlers de Pendências de Entrega
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

  // Excluir Equipamento
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

  // Alterar Status Rápido (Disponível, Reservado, Vendido)
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
      {/* Barra de Navegação e Ações Principais */}
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

        {/* Botões Operacionais */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Anunciar no Mercado Livre ou Badge se já anunciado */}
          {product.ml_listing_id ? (
            <div className="flex items-center gap-1.5 bg-[#ffe600]/20 border border-amber-400/80 px-2.5 py-1 rounded-md text-xs">
              <ShoppingBag className="w-4 h-4 text-slate-900" />
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-900">Anunciado no ML</span>
                {liveMLItem?.status && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${
                      liveMLItem.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : liveMLItem.status === 'paused'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    {liveMLItem.status === 'active'
                      ? 'Ativo'
                      : liveMLItem.status === 'paused'
                        ? 'Pausado'
                        : 'Finalizado'}
                  </Badge>
                )}
              </div>
              <a
                href={
                  product.ml_listing_url ||
                  `https://produto.mercadolivre.com.br/${product.ml_listing_id}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-900 hover:text-amber-900 ml-1 font-semibold flex items-center gap-0.5 underline text-[11px]"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            (() => {
              // Passar família derivada para que a validação não bloqueie a abertura do modal
              const derivedFamily = deriveProductFamily(product)
              const validation = validateProductForML(product, {
                familyName: derivedFamily,
              })
              return (
                <Button
                  size="sm"
                  onClick={() => setMlPublishModalOpen(true)}
                  disabled={!validation.eligible}
                  title={
                    validation.eligible
                      ? 'Publicar anúncio oficial no Mercado Livre'
                      : `Não publicável no ML:\n• ${validation.reasons.join('\n• ')}`
                  }
                  className={`text-xs h-9 gap-1.5 font-bold shadow-xs transition-all ${
                    validation.eligible
                      ? 'bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 border border-amber-400'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-slate-950" />
                  Anunciar no ML
                </Button>
              )
            })()
          )}

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
            onClick={() => handleOpenPhotoModal()}
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

      {/* Grid Principal: Galeria & Informações */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Coluna Esquerda: Galeria, Lote, Histórico, Peças, Pendências (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Galeria de Fotos */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div
              className="aspect-16/10 bg-slate-100 relative group overflow-hidden flex items-center justify-center"
              title="Passe o mouse para zoom estilo Mercado Livre ou clique para tela cheia"
            >
              <ZoomableImage
                src={photos[selectedPhotoIndex] || photos[0]}
                alt={product.name}
                showScaleControl={true}
                onClick={() => setZoomModalOpen(true)}
              />

              <div className="absolute top-3 left-28 sm:left-32 bg-slate-900/80 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-md font-mono font-semibold flex items-center gap-2 pointer-events-none z-10">
                <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                Foto {selectedPhotoIndex + 1} de {photos.length}
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setZoomModalOpen(true)
                  }}
                  className="bg-white/90 hover:bg-white text-slate-800 text-xs px-2.5 py-1 rounded-md font-semibold shadow flex items-center gap-1.5 transition-all opacity-90 group-hover:opacity-100"
                  title="Ampliar em tela cheia"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-emerald-600" />
                  Tela Cheia
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenBgRemoval(selectedPhotoIndex)
                  }}
                  className="bg-indigo-600/95 hover:bg-indigo-700 text-white text-xs px-2.5 py-1 rounded-md font-semibold shadow flex items-center gap-1.5 transition-all opacity-95 group-hover:opacity-100"
                  title="Remover fundo desta foto com IA no navegador e compor fundo branco (#FFFFFF)"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Remover Fundo (IA)
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenPhotoModal()
                  }}
                  className="bg-white/90 hover:bg-white text-slate-800 text-xs px-2.5 py-1 rounded-md font-semibold shadow flex items-center gap-1.5 transition-all opacity-90 group-hover:opacity-100"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  Gerenciar fotos
                </button>
              </div>

              {/* Setas de navegação direta sobre a imagem na galeria */}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-800 flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 z-10"
                    title="Foto anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-800 flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 z-10"
                    title="Próxima foto"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            {/* Miniaturas da Galeria */}
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
                      className="w-full h-full object-cover transition-all"
                    />
                  </button>
                ))}
              </div>
            )}{' '}
          </div>

          {/* Lote e Rastreabilidade Física */}
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

          {/* Histórico do Equipamento */}
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
                      <p className="text-[11px] text-slate-500">
                        Equipamento cadastrado e inspecionado
                      </p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                      <p className="text-xs font-semibold text-slate-800">
                        Equipamento preparado para anúncio
                      </p>
                      <p className="text-[11px] text-slate-500">Pronto no catálogo</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Peças & Trocas Vinculadas */}
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
                                ? 'text-slate-800 line-through opacity-70'
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

        {/* Coluna Direita: Preço, Venda Rápida, Custo x Venda, Especificações, Checklist (5 colunas) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card Principal: Preço e Venda */}
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

                  {/* Dropdown de Status */}
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

              {/* Preço Anunciado */}
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

              {/* Bloco de Gestão do Mercado Livre se já anunciado */}
              {product.ml_listing_id && (
                <div className="p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50/50 rounded-xl border border-amber-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-amber-600" />
                      Anúncio no Mercado Livre
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        (liveMLItem?.status || product.ml_listing_status) === 'active'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold'
                          : 'bg-amber-100 text-amber-800 border-amber-300 font-semibold'
                      }
                    >
                      {(liveMLItem?.status || product.ml_listing_status) === 'active'
                        ? 'Ativo no ML'
                        : (liveMLItem?.status || product.ml_listing_status) === 'paused'
                          ? 'Pausado'
                          : 'Encerrado'}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-slate-600 font-mono">
                    ID: {product.ml_listing_id}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <a
                      href={
                        product.ml_listing_url ||
                        `https://produto.mercadolivre.com.br/${product.ml_listing_id}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Abrir no Mercado Livre <ExternalLink className="w-3 h-3" />
                    </a>

                    {(liveMLItem?.status || product.ml_listing_status) === 'active' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateMLStatus('paused')}
                        disabled={updatingMLStatus}
                        className="text-xs h-7 gap-1 border-amber-300 text-amber-800 hover:bg-amber-100/50 ml-auto"
                      >
                        <PauseCircle className="w-3 h-3" />
                        Pausar anúncio
                      </Button>
                    ) : (liveMLItem?.status || product.ml_listing_status) === 'paused' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateMLStatus('active')}
                        disabled={updatingMLStatus}
                        className="text-xs h-7 gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 ml-auto"
                      >
                        <PlayCircle className="w-3 h-3" />
                        Reativar anúncio
                      </Button>
                    ) : null}

                    {(liveMLItem?.status || product.ml_listing_status) !== 'closed' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateMLStatus('closed')}
                        disabled={updatingMLStatus}
                        className="text-xs h-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        title="Encerrar o anúncio permanentemente no ML"
                      >
                        <XCircle className="w-3 h-3" />
                        Encerrar
                      </Button>
                    )}
                  </div>

                  {statusVal === 'Vendido' &&
                    (liveMLItem?.status || product.ml_listing_status) === 'active' && (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 flex items-center justify-between">
                        <span>
                          Equipamento vendido no sistema. Encerre o anúncio no ML para evitar
                          compras indevidas.
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateMLStatus('closed')}
                          disabled={updatingMLStatus}
                          className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] h-6 px-2"
                        >
                          Encerrar agora
                        </Button>
                      </div>
                    )}
                </div>
              )}

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
                    : statusVal === 'Pendente de ativação'
                      ? 'Equipamento pendente de ativação: insira o Part Number antes de vender.'
                      : 'Este equipamento já não está disponível em estoque físico.'}
                </p>
              </div>

              {/* Painel de Custo × Venda × Margem (Admin) */}
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

              {/* Especificações Técnicas */}
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
                      Tamanho da Tela
                    </span>
                    <span className="font-medium text-slate-800 block">
                      {product.screen_size || '14"'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Teclado Numérico
                    </span>
                    <span className="font-medium text-slate-800 block">
                      {product.has_numeric_keypad ? 'Sim' : 'Não'}
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
                      Condição & Grau ML
                    </span>
                    {(() => {
                      const resolved = resolveCondition(
                        product.condition_type,
                        product.condition_grade,
                        product.condition,
                      )
                      const badge = getConditionBadgeStyles(resolved.type, resolved.grade)
                      return (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-semibold ${badge.classes}`}
                          >
                            {badge.label}
                          </Badge>
                          {badge.gradeLabel && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-white text-slate-700 border-slate-200"
                            >
                              Grau: {badge.gradeLabel}
                            </Badge>
                          )}
                        </div>
                      )
                    })()}
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

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Part Number (P/N)
                    </span>
                    {product.part_number ? (
                      <span className="font-medium font-mono text-emerald-800 block truncate">
                        {product.part_number}
                      </span>
                    ) : (
                      <span className="text-amber-600 italic text-[11px] block">
                        Não cadastrado
                      </span>
                    )}
                  </div>

                  {product.serial_number && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        Número de Série (S/N)
                      </span>
                      <span className="font-medium font-mono text-slate-800 block truncate">
                        {product.serial_number}
                      </span>
                    </div>
                  )}

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Código de Barras (GTIN/EAN)
                    </span>
                    {product.gtin ? (
                      <span className="font-medium font-mono text-emerald-700 block truncate">
                        {product.gtin}
                      </span>
                    ) : (
                      <span className="text-amber-600 italic text-[11px] block">
                        Não cadastrado (recom. para ML)
                      </span>
                    )}
                  </div>
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

          {/* Checklist de Revisão Técnica */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Checklist de Revisão
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Inspecionado · Revisão do equipamento ({checklist.length} itens)
                  </CardDescription>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenChecklistModal}
                  className="h-8 text-xs font-semibold gap-1.5 border-[#d9532f]/40 text-[#d9532f] hover:bg-[#d9532f]/10"
                  title={`Editar todos os ${checklist.length} itens do checklist`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar Checklist
                </Button>
              </div>

              {/* Contadores Coloridos das 5 Opções */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2">
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {okCount} Ok
                </span>
                {warningCount > 0 && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {warningCount} Atenção
                  </span>
                )}
                {failureCount > 0 && (
                  <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {failureCount} Falha
                  </span>
                )}
                {untestedCount > 0 && (
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {untestedCount} Não testado
                  </span>
                )}
                {naCount > 0 && (
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    {naCount} N/A
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Lista dos itens com dropdown editável */}
              <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto pr-1">
                {checklist.map((c, i) => {
                  const normStatus = normalizeChecklistStatus(c.status)
                  const styles = getChecklistStatusStyles(normStatus)
                  return (
                    <div key={i} className="py-2.5 flex items-start justify-between gap-3 group">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-800 block text-xs">{c.item}</span>
                        {c.observation ? (
                          <p className="text-[11px] text-slate-500 mt-0.5 italic">
                            {c.observation}
                          </p>
                        ) : (
                          <span className="text-[10px] text-slate-300 italic group-hover:text-slate-400">
                            Sem observação
                          </span>
                        )}
                      </div>

                      {/* Dropdown com as 5 cores diretamente na linha */}
                      <div className="shrink-0">
                        <Select
                          value={normStatus}
                          onValueChange={(val: any) => handleInlineChangeStatus(i, val)}
                        >
                          <SelectTrigger
                            className={`h-7 px-2 text-[11px] font-semibold border rounded-md shadow-2xs transition-colors ${styles.select}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent align="end">
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
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Botões de Ações: Baixar Checklist, Clonar Equipamento, Excluir, Etiqueta */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDownloadChecklist}
                    className="text-xs font-medium gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 h-9"
                    title="Baixar laudo técnico e checklist"
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

                  <Link
                    to={`/loja/${product.code || product.sku || product.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      className="text-xs font-semibold gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-9 w-full"
                      title="Ver como o cliente visualiza este anúncio na loja pública"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver na Loja Pública
                    </Button>
                  </Link>

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

      {/* MODAL: EDITAR CHECKLIST DE INSPEÇÃO (ITENS COM OPÇÕES E CORES) */}
      <Dialog open={checklistModalOpen} onOpenChange={setChecklistModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-7 bg-[#faf8f5]">
          <DialogHeader className="pb-3 border-b border-orange-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Checklist de Inspeção Técnica
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Edite os {editChecklistItems.length} itens técnicos de bancada, defina o status e
                  observações detalhadas para{' '}
                  <strong className="text-slate-700">{product?.name}</strong>.
                </DialogDescription>
              </div>

              {/* Status Geral da Inspeção */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                  Checklist de Inspeção:
                </span>
                <Select
                  value={editInspectionStatus}
                  onValueChange={(val: any) => setEditInspectionStatus(val)}
                >
                  <SelectTrigger className="h-8 w-36 text-xs font-bold border-slate-300 text-slate-900 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Concluída">Concluída</SelectItem>
                    <SelectItem value="Em andamento">Em andamento</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ações Rápidas (Todos Ok / Limpar) */}
            <div className="flex items-center justify-between pt-3 gap-2 flex-wrap">
              <span className="text-xs text-slate-500">
                {editChecklistItems.length} itens verificados em bancada:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAllChecklistModal('Ok')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-md transition-colors"
                >
                  Marcar todos como Ok
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllChecklistModal('Não testado')}
                  className="text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1 rounded-md transition-colors"
                >
                  Resetar (Não testado)
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Cards dos Itens Técnicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 py-4">
            {editChecklistItems.map((item, idx) => {
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
                    onValueChange={(val: any) => handleEditItemStatus(idx, val)}
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
                    onChange={(e) => handleEditItemObs(idx, e.target.value)}
                    className="h-8 text-xs bg-slate-50/80 border-slate-200 text-slate-700 placeholder:text-slate-400 rounded-lg focus-visible:bg-white"
                  />
                </div>
              )
            })}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setChecklistModalOpen(false)}
              disabled={savingChecklist}
              className="bg-white border-slate-300 text-slate-700 text-xs h-9 px-4"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveChecklist}
              disabled={savingChecklist}
              className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs font-semibold h-9 px-5 gap-1.5 shadow-xs"
            >
              {savingChecklist ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Salvando checklist...
                </>
              ) : (
                'Salvar Checklist de Inspeção'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDITAR LOTE & EQUIPAMENTO */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-slate-700" />
              Editar Lote & Equipamento
            </DialogTitle>
            <DialogDescription>
              Altere identificador do lote, localização física, preços e especificações do notebook.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Dados do Lote Físico */}
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

            {/* Especificações do Equipamento */}
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
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">
                    Código de Barras (GTIN / EAN)
                  </Label>
                  <span className="text-[10px] text-slate-400">8 a 14 dígitos</span>
                </div>
                <Input
                  placeholder="Ex: 7891234567890 (código de fábrica)"
                  value={editGtin}
                  onChange={(e) => setEditGtin(e.target.value.replace(/\D/g, '').slice(0, 14))}
                  className="font-mono text-xs"
                  maxLength={14}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Teclado Numérico</Label>
                <Select
                  value={editHasNumericKeypad ? 'sim' : 'nao'}
                  onValueChange={(v) => setEditHasNumericKeypad(v === 'sim')}
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
                  value={editIncludesCharger ? 'sim' : 'nao'}
                  onValueChange={(v) => setEditIncludesCharger(v === 'sim')}
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

              {/* Tipo de Produto (Mercado Livre) */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Produto *</Label>
                <Select
                  value={editConditionType}
                  onValueChange={(val: ConditionType) => {
                    setEditConditionType(val)
                    const opt = CONDITION_TYPE_OPTIONS.find((t) => t.value === val)
                    if (!opt?.allowsGrade) {
                      setEditConditionGrade(undefined)
                    } else if (opt?.requiresGrade && !editConditionGrade) {
                      setEditConditionGrade('excelente')
                    }
                  }}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grau de Estado (Mercado Livre) */}
              {(() => {
                const opt = CONDITION_TYPE_OPTIONS.find((t) => t.value === editConditionType)
                const allows = opt ? opt.allowsGrade : false
                const requires = opt ? opt.requiresGrade : false

                return (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Grau de Estado {requires && <span className="text-orange-600">*</span>}
                    </Label>
                    <Select
                      value={editConditionGrade || 'none'}
                      onValueChange={(val: string) =>
                        setEditConditionGrade(val === 'none' ? undefined : (val as ConditionGrade))
                      }
                      disabled={!allows}
                    >
                      <SelectTrigger
                        className={`h-10 text-xs ${!allows ? 'opacity-60 bg-slate-100' : ''}`}
                      >
                        <SelectValue
                          placeholder={
                            !allows ? 'Não aplicável para este tipo' : 'Selecione o grau...'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {!requires && (
                          <SelectItem value="none" className="text-xs text-slate-400 italic">
                            Sem grau definido
                          </SelectItem>
                        )}
                        {CONDITION_GRADE_OPTIONS.map((g) => (
                          <SelectItem key={g.value} value={g.value} className="text-xs">
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })()}

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
                <Label className="text-xs font-semibold text-slate-700">Part Number (P/N)</Label>
                <Input
                  placeholder="Ex: PN-DELL-5320-01"
                  value={editPartNumber}
                  onChange={(e) => {
                    const val = e.target.value
                    setEditPartNumber(val)
                    // Se o item estava pendente e ganha PN, sugerir Disponível
                    if (editStatus === 'Pendente de ativação' && val.trim().length > 0) {
                      setEditStatus('Disponível')
                    }
                  }}
                  className="font-mono text-xs uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Número de Série (S/N)
                </Label>
                <Input
                  placeholder="Ex: 8BRXYZ1"
                  value={editSerialNumber}
                  onChange={(e) => setEditSerialNumber(e.target.value.toUpperCase())}
                  className="font-mono text-xs uppercase"
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
                    <SelectItem value="Pendente de ativação">Pendente de ativação</SelectItem>
                    <SelectItem value="Reservado">Reservado</SelectItem>
                    <SelectItem value="Vendido">Vendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

      {/* MODAL: ETIQUETA COM QR CODE */}
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
      <Dialog
        open={photoModalOpen}
        onOpenChange={(open) => {
          if (!open && !isSavingPhotoOrder) {
            // Cancelar descarta estado local somente se não estiver salvando
            initLocalModalPhotos(product)
          }
          setPhotoModalOpen(open)
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-orange-600" />
              Fotos do equipamento ({localModalPhotos.length})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Até 6 imagens JPEG, PNG ou WebP, com no máximo 5 MB cada. Altere a ordem arrastando as
              miniaturas ou selecionando a posição numérica desejada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Upload Direto */}
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Selecione fotos do seu computador / celular
              </p>
              <p className="text-[11px] text-slate-500">Suporta JPEG, PNG e WebP até 5 MB cada</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                id="photoFileInput"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto || localModalPhotos.length >= 6}
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

            {/* Adicionar por URL */}
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
                  disabled={isUploadingPhoto || localModalPhotos.length >= 6}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isUploadingPhoto || !photoUrlInput.trim() || localModalPhotos.length >= 6
                  }
                  className="bg-slate-900 text-white shrink-0 text-xs"
                >
                  Adicionar
                </Button>
              </div>
            </form>

            {/* Grid de Reordenação com Drag & Drop, Setas, Seletor 1..N e Tornar Capa */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Organização das Fotos ({localModalPhotos.length}/6)
                </Label>
                <span className="text-[11px] text-slate-500">
                  A foto #1 é a <strong>capa principal</strong> no catálogo e no PDF.
                </span>
              </div>

              {localModalPhotos.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <p className="text-xs text-slate-400">Nenhuma foto adicionada.</p>
                </div>
              ) : (
                <PhotoReorderGrid
                  items={localModalPhotos.map((item, idx) => {
                    const previewUrl =
                      item.type === 'photo' && product
                        ? productsService.getFileUrl(product, item.value)
                        : item.value
                    return {
                      id: `${item.value}-${idx}`,
                      url: previewUrl,
                      label: `Foto ${idx + 1}`,
                      isCover: idx === 0,
                    }
                  })}
                  onReorder={(newOrderItems) => {
                    // Mapeia os novos itens de volta para a lista localModalPhotos
                    const urlToItemMap = new Map<string, (typeof localModalPhotos)[0]>()
                    localModalPhotos.forEach((item) => {
                      const url =
                        item.type === 'photo' && product
                          ? productsService.getFileUrl(product, item.value)
                          : item.value
                      urlToItemMap.set(url, item)
                    })

                    const updatedList = newOrderItems
                      .map((oi) => urlToItemMap.get(oi.url))
                      .filter(Boolean) as typeof localModalPhotos

                    setLocalModalPhotos(updatedList)
                  }}
                  onRemove={(idx) => handleRemovePhoto(idx)}
                  onOpenBgRemoval={(idx) => handleOpenBgRemoval(idx)}
                  disabled={isUploadingPhoto || isSavingPhotoOrder}
                  maxPhotos={6}
                />
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="bg-white border-slate-300 text-slate-700 text-xs h-9 px-4"
              onClick={() => {
                // Cancelar descarta estado local
                initLocalModalPhotos(product)
                setPhotoModalOpen(false)
              }}
              disabled={isSavingPhotoOrder}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs font-semibold h-9 px-5 gap-1.5 shadow-sm"
              onClick={handleSavePhotoOrder}
              disabled={isSavingPhotoOrder || isUploadingPhoto}
            >
              {isSavingPhotoOrder ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Salvando alterações...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Salvar alterações
                </>
              )}
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

      {/* AlertDialog: Confirmação de Exclusão de Peça */}
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

      {/* Modal Anunciar no Mercado Livre */}
      {product && (
        <SingleMLPublishModal
          isOpen={mlPublishModalOpen}
          onClose={() => setMlPublishModalOpen(false)}
          product={product}
          onPublished={(updated) => {
            setProduct(updated)
            loadData()
          }}
        />
      )}

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

      {/* MODAL: REMOÇÃO DE FUNDO COM IA NO NAVEGADOR */}
      {photos[bgRemovalTargetIndex] && (
        <BackgroundRemovalModal
          open={bgRemovalModalOpen}
          onOpenChange={setBgRemovalModalOpen}
          originalImageUrl={photos[bgRemovalTargetIndex]}
          photoIndex={bgRemovalTargetIndex}
          equipmentName={product?.name}
          onSaveProcessedPhoto={handleSaveProcessedPhoto}
        />
      )}

      {/* DIALOG DE ZOOM / LIGHTBOX DE FOTOS EM TELA CHEIA COM AJUSTE DE LUZ */}
      <ImageLightboxModal
        open={zoomModalOpen}
        onOpenChange={setZoomModalOpen}
        photos={photos}
        currentIndex={selectedPhotoIndex}
        onIndexChange={setSelectedPhotoIndex}
        title={product?.name}
      />

      {/* AlertDialog: Confirmação de Exclusão de Equipamento */}
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
