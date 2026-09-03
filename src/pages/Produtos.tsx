import React, { useState, useEffect, useMemo } from 'react'
import {
  Package,
  Plus,
  Search,
  Layers,
  Edit2,
  Trash2,
  DollarSign,
  Tag,
  Check,
  AlertTriangle,
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
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { productsService } from '@/services/products'
import { batchesService } from '@/services/batches'
import type { Product, Batch } from '@/types/inventory'
import { Link } from 'react-router-dom'

export default function Produtos() {
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Modal State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { toast } = useToast()
  const { isAdmin } = useAuth()

  const loadData = async () => {
    try {
      const [prodData, batchData] = await Promise.all([
        productsService.getAll(),
        batchesService.getAll(),
      ])
      setProducts(prodData)
      setBatches(batchData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set)
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesCat = categoryFilter === 'all' || p.category === categoryFilter

      return matchesSearch && matchesCat
    })
  }, [products, searchTerm, categoryFilter])

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

  const handleOpenCreate = () => {
    setEditingProduct(null)
    setName('')
    setSku('')
    setCategory('Instrumentação & Medição')
    setUnitPrice(0)
    setDescription('')
    setDialogOpen(true)
  }

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p)
    setName(p.name)
    setSku(p.sku)
    setCategory(p.category || '')
    setUnitPrice(p.unit_price || 0)
    setDescription(p.description || '')
    setDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !sku) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome e o código SKU do equipamento.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      if (editingProduct) {
        await productsService.update(editingProduct.id, {
          name,
          sku,
          category,
          unit_price: unitPrice,
          description,
        })
        toast({
          title: 'Produto atualizado',
          description: `Os dados de "${name}" foram salvos com sucesso.`,
        })
      } else {
        await productsService.create({
          name,
          sku,
          category,
          unit_price: unitPrice,
          description,
        })
        toast({
          title: 'Produto cadastrado',
          description: `O equipamento "${name}" foi inserido no catálogo.`,
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
        `Tem certeza que deseja excluir o produto "${prodName}"? Todos os lotes vinculados também serão removidos.`,
      )
    ) {
      return
    }

    try {
      await productsService.delete(id)
      toast({
        title: 'Produto removido',
        description: `"${prodName}" foi excluído.`,
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Catálogo de Equipamentos
          </h2>
          <p className="text-sm text-slate-500">
            Cadastre novos equipamentos, defina preços sugeridos e acompanhe a disponibilidade
            global.
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={handleOpenCreate}
            className="bg-slate-900 hover:bg-slate-800 text-white shadow gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Equipamento
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar por nome do equipamento, SKU ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200"
              />
            </div>
            <div className="w-full sm:w-64">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700"
              >
                <option value="all">Todas as Categorias</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Equipamento</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-right">Preço Unitário</th>
                <th className="py-3 px-4 text-center">Lotes Físicos</th>
                <th className="py-3 px-4 text-center">Estoque Total</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum produto cadastrado ou correspondente à busca.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const stockInfo = productStockMap.get(p.id) || { totalQty: 0, batchCount: 0 }
                  const isLow = stockInfo.totalQty <= 5

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.name}
                        {p.description && (
                          <span className="block text-xs text-slate-500 font-normal line-clamp-1 max-w-sm">
                            {p.description}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        <Badge variant="outline" className="font-mono bg-slate-50 text-slate-700">
                          {p.sku}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs whitespace-nowrap">
                        {p.category || 'Geral'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                        R${' '}
                        {Number(p.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Link
                          to={`/estoque?produto=${p.id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          {stockInfo.batchCount} {stockInfo.batchCount === 1 ? 'lote' : 'lotes'}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            stockInfo.totalQty === 0
                              ? 'bg-slate-100 text-slate-500'
                              : isLow
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {stockInfo.totalQty} un
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <Link to={`/estoque?produto=${p.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-slate-600 hover:text-slate-900"
                            title="Ver lotes deste produto"
                          >
                            Lotes
                          </Button>
                        </Link>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(p)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                              title="Editar produto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(p.id, p.name)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                              title="Excluir produto"
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

      {/* CREATE / EDIT PRODUCT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-slate-700" />
              {editingProduct ? 'Editar Equipamento' : 'Novo Equipamento'}
            </DialogTitle>
            <DialogDescription>Preencha as informações cadastrais do produto.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="pName" className="text-xs font-semibold text-slate-700">
                Nome do Equipamento *
              </Label>
              <Input
                id="pName"
                placeholder="Ex: Multímetro Digital True RMS"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="pSku" className="text-xs font-semibold text-slate-700">
                  Código SKU *
                </Label>
                <Input
                  id="pSku"
                  placeholder="EQP-MULT-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pPrice" className="text-xs font-semibold text-slate-700">
                  Preço Sugerido (R$) *
                </Label>
                <Input
                  id="pPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="pCat" className="text-xs font-semibold text-slate-700">
                Categoria
              </Label>
              <Input
                id="pCat"
                placeholder="Ex: Instrumentação & Medição"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pDesc" className="text-xs font-semibold text-slate-700">
                Descrição Técnica
              </Label>
              <Textarea
                id="pDesc"
                placeholder="Especificações, voltagem, faixa de operação..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
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
