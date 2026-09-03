import React, { useState, useEffect, useMemo } from 'react'
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
import type {
  Product,
  Batch,
  EquipmentPart,
  EquipmentDeliverable,
  TechnicalChecklistItem,
} from '@/types/inventory'

export default function CatalogoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [parts, setParts] = useState<EquipmentPart[]>([])
  const [deliverables, setDeliverables] = useState<EquipmentDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)

  // Modais de Peças e Pendências
  const [partModalOpen, setPartModalOpen] = useState(false)
  const [partName, setPartName] = useState('')
  const [partCost, setPartCost] = useState<number>(0)
  const [partStatus, setPartStatus] = useState<'Pendente' | 'Trocado' | 'Instalado' | 'Danificado'>(
    'Instalado',
  )
  const [partNotes, setPartNotes] = useState('')

  const [deliverableModalOpen, setDeliverableModalOpen] = useState(false)
  const [delivName, setDelivName] = useState('')
  const [delivStatus, setDelivStatus] = useState<'Pendente' | 'Resolvido'>('Pendente')
  const [delivNotes, setDelivNotes] = useState('')

  const [savingAction, setSavingAction] = useState(false)

  const { toast } = useToast()
  const { isAdmin } = useAuth()
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

      setBatches(batchList.filter((b) => b.product_id === prod.id))
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

  // Photos
  const photos = useMemo(() => {
    if (product?.images && product.images.length > 0) {
      return product.images
    }
    return [
      'https://img.usecurling.com/p/800/600?q=laptop',
      'https://img.usecurling.com/p/800/600?q=keyboard',
      'https://img.usecurling.com/p/800/600?q=ports',
    ]
  }, [product])

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
Código do Sistema: ${product.code || 'N/A'}
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
  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product || !partName.trim()) return

    setSavingAction(true)
    try {
      await equipmentService.createPart({
        product_id: product.id,
        name: partName.trim(),
        cost: Number(partCost) || 0,
        status: partStatus,
        notes: partNotes.trim(),
      })
      toast({
        title: 'Peça adicionada',
        description: 'A peça e seu custo foram vinculados ao equipamento.',
      })
      setPartModalOpen(false)
      setPartName('')
      setPartCost(0)
      setPartNotes('')
      const updatedParts = await equipmentService.getPartsByProduct(product.id)
      setParts(updatedParts)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao adicionar peça',
        variant: 'destructive',
      })
    } finally {
      setSavingAction(false)
    }
  }

  const handleDeletePart = async (partId: string) => {
    try {
      await equipmentService.deletePart(partId)
      setParts(parts.filter((p) => p.id !== partId))
      toast({ title: 'Peça removida' })
    } catch (err) {
      console.error(err)
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

  // Status Change
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
        <p className="text-sm text-slate-500">Carregando detalhes do equipamento...</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Equipamento não encontrado</h2>
        <p className="text-sm text-slate-500">
          O código ou identificador informado não corresponde a nenhum notebook cadastrado.
        </p>
        <Link to="/produtos">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao catálogo
          </Button>
        </Link>
      </div>
    )
  }

  const statusVal = product.status || 'Disponível'

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top back navigation */}
      <div>
        <Link
          to="/produtos"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao catálogo
        </Link>
      </div>

      {/* Main Grid: Gallery & Main Info (Replicando o visual do Replit com detalhes de ponta) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Photos & History (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Photo Display */}
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
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-md font-mono font-semibold">
                Foto {selectedPhotoIndex + 1} de {photos.length}
              </div>
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

          {/* Peças e Manutenções Vinculadas (NOVO - foco do pedido) */}
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
                onClick={() => setPartModalOpen(true)}
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
                        {p.notes && <p className="text-slate-500 text-[11px] mt-0.5">{p.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-700">
                          R${' '}
                          {Number(p.cost || 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeletePart(p.id)}
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

          {/* Pendências de Entrega (NOVO - foco do pedido) */}
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
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {product.sku}
                    </span>
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

                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
                  {product.name}
                </h1>
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
                    Estoque em lote: <strong className="text-slate-800">{totalStock} un</strong>
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
                  onClick={() => navigate('/vendas?nova=true')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-sm gap-2 text-sm"
                >
                  <Send className="w-4 h-4" />
                  Adicionar à proposta / Vender
                </Button>
                <p className="text-[11px] text-center text-slate-400">
                  Sem compromisso de compra imediata. Baixa automática no estoque ao finalizar.
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
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                      Custo × Venda
                    </span>
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
                <h3 className="text-sm font-bold text-slate-900">Especificações</h3>
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
                </div>
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
                    Inspecionado · Última inspeção em 02/09/2026
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

              {/* Botão Baixar Checklist Técnico (igual ao Replit) */}
              <Button
                variant="outline"
                onClick={handleDownloadChecklist}
                className="w-full text-xs font-semibold gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar checklist técnico
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL: Adicionar Peça */}
      <Dialog open={partModalOpen} onOpenChange={setPartModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              Adicionar Peça ou Troca
            </DialogTitle>
            <DialogDescription>
              Vincule peças trocadas (ex: tela nova, bateria, expansão de SSD) com o respectivo
              custo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddPart} className="space-y-3">
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
                {savingAction ? 'Salvando...' : 'Salvar Peça'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
    </div>
  )
}
