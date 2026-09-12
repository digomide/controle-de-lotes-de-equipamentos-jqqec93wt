import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { toast } from '@/hooks/use-toast'
import { taxRulesService, type TaxRule, type CreateTaxRuleInput } from '@/services/taxRulesService'
import {
  Sliders,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Sparkles,
  Info,
  RefreshCw,
} from 'lucide-react'

interface TaxRulesTabProps {
  rules: TaxRule[]
  loading: boolean
  onReload: () => void
}

const DEFAULT_FORM: CreateTaxRuleInput = {
  categoria: '',
  cfop_dentro: '5405',
  cfop_fora: '6404',
  csosn: '500',
  cst: '',
  origem: 0,
  ncm_sugerido: '',
  cest_sugerido: '',
  ativo: true,
}

export function TaxRulesTab({ rules, loading, onReload }: TaxRulesTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null)
  const [form, setForm] = useState<CreateTaxRuleInput>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  // Exclusão
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<TaxRule | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Abrir modal de criação
  const handleOpenCreate = () => {
    setEditingRule(null)
    setForm(DEFAULT_FORM)
    setModalOpen(true)
  }

  // Abrir modal de edição
  const handleOpenEdit = (rule: TaxRule) => {
    setEditingRule(rule)
    setForm({
      categoria: rule.categoria,
      cfop_dentro: rule.cfop_dentro || '5405',
      cfop_fora: rule.cfop_fora || '6404',
      csosn: rule.csosn || '500',
      cst: rule.cst || '',
      origem: typeof rule.origem === 'number' ? rule.origem : 0,
      ncm_sugerido: rule.ncm_sugerido || '',
      cest_sugerido: rule.cest_sugerido || '',
      ativo: rule.ativo !== false,
    })
    setModalOpen(true)
  }

  // Salvar (criar ou editar)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.categoria.trim()) {
      toast({
        title: 'Categoria obrigatória',
        description: 'Informe o nome da categoria da regra fiscal.',
        variant: 'destructive',
      })
      return
    }

    if (!form.cfop_dentro.trim() || !form.cfop_fora.trim()) {
      toast({
        title: 'CFOPs obrigatórios',
        description: 'Informe os CFOPs para operações dentro e fora do estado.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      if (editingRule?.id) {
        await taxRulesService.update(editingRule.id, form)
        toast({
          title: 'Regra atualizada!',
          description: `Regra fiscal para "${form.categoria}" salva com sucesso.`,
        })
      } else {
        await taxRulesService.create(form)
        toast({
          title: 'Regra cadastrada!',
          description: `Regra fiscal para "${form.categoria}" criada com sucesso.`,
        })
      }
      setModalOpen(false)
      onReload()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar regra',
        description: err.message || 'Falha ao gravar regra fiscal.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Alternar ativo/inativo direto na tabela
  const handleToggleAtivo = async (rule: TaxRule, novoAtivo: boolean) => {
    if (!rule.id) return
    try {
      await taxRulesService.update(rule.id, { ativo: novoAtivo })
      toast({
        title: novoAtivo ? 'Regra ativada' : 'Regra desativada',
        description: `Regra "${rule.categoria}" foi atualizada.`,
      })
      onReload()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (!deleteRuleTarget?.id) return
    setDeleting(true)
    try {
      await taxRulesService.delete(deleteRuleTarget.id)
      toast({
        title: 'Regra excluída',
        description: `A regra para "${deleteRuleTarget.categoria}" foi removida.`,
      })
      setDeleteRuleTarget(null)
      onReload()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Filtragem por busca
  const filteredRules = rules.filter((r) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      r.categoria.toLowerCase().includes(term) ||
      r.cfop_dentro.includes(term) ||
      r.cfop_fora.includes(term) ||
      (r.csosn && r.csosn.includes(term)) ||
      (r.ncm_sugerido && r.ncm_sugerido.includes(term)) ||
      (r.cest_sugerido && r.cest_sugerido.includes(term))
    )
  })

  return (
    <div className="space-y-4">
      {/* Banner Explicativo */}
      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-950 space-y-1">
            <p className="font-semibold text-sm">
              Regras Fiscais Dinâmicas por Categoria de Produto
            </p>
            <p className="leading-relaxed">
              O sistema compara a UF da sua empresa com a UF do destinatário para aplicar
              automaticamente o CFOP correto (<strong>cfop_dentro</strong> ou{' '}
              <strong>cfop_fora</strong>). A regra carrega automaticamente{' '}
              <strong>CFOP, CSOSN e Origem</strong>. NCM e CEST sugeridos são pré-preenchidos para
              agilizar, mas permanecem sempre <strong>100% editáveis</strong> item a item.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Barra de Ações e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            placeholder="Buscar por categoria, CFOP, NCM sugerido ou CSOSN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onReload}
            disabled={loading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Regra Fiscal
          </Button>
        </div>
      </div>

      {/* Tabela de Regras */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Categoria</TableHead>
                <TableHead className="w-[120px] text-center">CFOP Dentro UF</TableHead>
                <TableHead className="w-[120px] text-center">CFOP Fora UF</TableHead>
                <TableHead className="w-[100px] text-center">CSOSN / CST</TableHead>
                <TableHead className="w-[90px] text-center">Origem</TableHead>
                <TableHead className="w-[140px]">NCM Sugerido</TableHead>
                <TableHead className="w-[130px]">CEST Sugerido</TableHead>
                <TableHead className="w-[90px] text-center">Ativo</TableHead>
                <TableHead className="w-[110px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-500 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Carregando regras fiscais...
                  </TableCell>
                </TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-500 text-xs">
                    <Sliders className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Nenhuma regra fiscal cadastrada. Clique em "Nova Regra Fiscal" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => (
                  <TableRow key={rule.id} className="text-xs">
                    <TableCell className="font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{rule.categoria}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium text-emerald-700 bg-emerald-50/40">
                      {rule.cfop_dentro}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium text-blue-700 bg-blue-50/40">
                      {rule.cfop_fora}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      <Badge variant="outline" className="text-[11px] font-mono">
                        {rule.csosn ? `CSOSN ${rule.csosn}` : rule.cst ? `CST ${rule.cst}` : '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-slate-600">
                      {rule.origem !== undefined ? rule.origem : 0}
                    </TableCell>
                    <TableCell className="font-mono text-slate-700">
                      {rule.ncm_sugerido ? (
                        <span className="text-[11px]">{rule.ncm_sugerido}</span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-slate-700">
                      {rule.cest_sugerido ? (
                        <span className="text-[11px]">{rule.cest_sugerido}</span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.ativo !== false}
                        onCheckedChange={(val) => handleToggleAtivo(rule, val)}
                        aria-label="Ativar ou desativar regra"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(rule)}
                          className="h-7 w-7 p-0 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                          title="Editar regra"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteRuleTarget(rule)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Excluir regra"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Criar / Editar Regra */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {editingRule
                    ? `Editar Regra: ${editingRule.categoria}`
                    : 'Nova Regra Fiscal por Categoria'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Configure o CFOP estadual e interestadual, CSOSN/CST e sugestões de NCM/CEST.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold">Categoria de Produto *</Label>
              <Input
                className="mt-1 h-9 text-xs"
                value={form.categoria}
                onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
                placeholder="Ex: Memória, Notebook, HD/SSD, Monitor, Processador"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Nome ou termo que identificará os itens desta categoria no sistema.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-emerald-800">
                  CFOP Dentro do Estado (Mesma UF) *
                </Label>
                <Input
                  className="mt-1 h-9 text-xs font-mono bg-emerald-50/30 border-emerald-200"
                  value={form.cfop_dentro}
                  onChange={(e) => setForm((p) => ({ ...p, cfop_dentro: e.target.value }))}
                  placeholder="5405"
                  required
                />
                <span className="text-[10px] text-slate-500">Padrão: 5405 (Subst. Tributária)</span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-blue-800">
                  CFOP Fora do Estado (Outra UF) *
                </Label>
                <Input
                  className="mt-1 h-9 text-xs font-mono bg-blue-50/30 border-blue-200"
                  value={form.cfop_fora}
                  onChange={(e) => setForm((p) => ({ ...p, cfop_fora: e.target.value }))}
                  placeholder="6404"
                  required
                />
                <span className="text-[10px] text-slate-500">Padrão: 6404 (Interestadual ST)</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">CSOSN (Simples)</Label>
                <Input
                  className="mt-1 h-9 text-xs font-mono"
                  value={form.csosn || ''}
                  onChange={(e) => setForm((p) => ({ ...p, csosn: e.target.value }))}
                  placeholder="500"
                />
                <span className="text-[10px] text-slate-500">Default: 500</span>
              </div>

              <div>
                <Label className="text-xs font-semibold">CST (Regime Normal)</Label>
                <Input
                  className="mt-1 h-9 text-xs font-mono"
                  value={form.cst || ''}
                  onChange={(e) => setForm((p) => ({ ...p, cst: e.target.value }))}
                  placeholder="Ex: 60 ou 00"
                />
                <span className="text-[10px] text-slate-500">Opcional para Presumido/Real</span>
              </div>

              <div>
                <Label className="text-xs font-semibold">Origem da Mercadoria</Label>
                <select
                  aria-label="Origem da Mercadoria"
                  value={form.origem ?? 0}
                  onChange={(e) => setForm((p) => ({ ...p, origem: parseInt(e.target.value, 10) }))}
                  className="w-full mt-1 h-9 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-medium"
                >
                  <option value={0}>0 - Nacional</option>
                  <option value={1}>1 - Estrangeira (Importação direta)</option>
                  <option value={2}>2 - Estrangeira (Adquirida mercado interno)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">NCM Sugerido (Editável por item)</Label>
                <Input
                  className="mt-1 h-9 text-xs font-mono"
                  value={form.ncm_sugerido || ''}
                  onChange={(e) => setForm((p) => ({ ...p, ncm_sugerido: e.target.value }))}
                  placeholder="Ex: 84733042"
                />
                <span className="text-[10px] text-slate-500">
                  Sugestão automática ao selecionar a regra
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold">CEST Sugerido (Opcional)</Label>
                <Input
                  className="mt-1 h-9 text-xs font-mono"
                  value={form.cest_sugerido || ''}
                  onChange={(e) => setForm((p) => ({ ...p, cest_sugerido: e.target.value }))}
                  placeholder="Ex: 21.035.00"
                />
                <span className="text-[10px] text-slate-500">Código CEST se sujeito a ST</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="ativo-switch"
                checked={form.ativo}
                onCheckedChange={(val) => setForm((p) => ({ ...p, ativo: val }))}
              />
              <Label htmlFor="ativo-switch" className="text-xs cursor-pointer">
                Regra ativa para sugestão automática no modal de emissão
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Salvar Regra
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!deleteRuleTarget} onOpenChange={(o) => !o && setDeleteRuleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Excluir Regra Fiscal?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Tem certeza que deseja remover a regra fiscal para a categoria{' '}
              <strong>"{deleteRuleTarget?.categoria}"</strong>? Os produtos vinculados passarão a
              exigir preenchimento manual ou outra regra ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir regra'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
