import React, { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Phone,
  CheckCircle2,
  XCircle,
  Tag,
  Trash2,
  Edit2,
  FileSpreadsheet,
  AlertTriangle,
  Send,
  Building2,
  HelpCircle,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { marketingService, normalizePhoneBR } from '@/services/marketingService'
import type {
  MarketingContact,
  MarketingContactTipo,
  MarketingContactStatus,
  MarketingContactSource,
} from '@/types/marketing'

export function MarketingContactsTab() {
  const { toast } = useToast()

  const [contacts, setContacts] = useState<MarketingContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Modais
  const [modalNewOpen, setModalNewOpen] = useState(false)
  const [modalImportOpen, setModalImportOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<MarketingContact | null>(null)

  // Formulário Novo/Edição
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formTipo, setFormTipo] = useState<MarketingContactTipo>('revendedor')
  const [formSource, setFormSource] = useState<MarketingContactSource>('manual')
  const [formNotes, setFormNotes] = useState('')
  const [formStatus, setFormStatus] = useState<MarketingContactStatus>('ativo')
  const [formTags, setFormTags] = useState('')
  const [formOptIn, setFormOptIn] = useState(true)
  const [savingContact, setSavingContact] = useState(false)

  // Importação em massa
  const [importText, setImportText] = useState('')
  const [importDefaultTipo, setImportDefaultTipo] = useState<MarketingContactTipo>('revendedor')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number
    skipped: number
    errors: { line: number; raw: string; error: string }[]
  } | null>(null)

  const loadContacts = async () => {
    setLoading(true)
    try {
      const res = await marketingService.getContacts({
        search,
        tipo: tipoFilter,
        status: statusFilter,
        perPage: 500,
      })
      setContacts(res.items)
    } catch (err: any) {
      console.error('Erro ao listar contatos:', err)
      toast({
        title: 'Erro ao carregar contatos',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [tipoFilter, statusFilter])

  // Contadores
  const totalCount = contacts.length
  const activeCount = contacts.filter((c) => c.status === 'ativo' && c.opt_in !== false).length
  const revendedoresCount = contacts.filter((c) => c.tipo === 'revendedor').length
  const clientesCount = contacts.filter((c) => c.tipo === 'cliente').length
  const corporativosCount = contacts.filter((c) => c.tipo === 'corporativo').length

  const handleOpenNew = () => {
    setEditingContact(null)
    setFormName('')
    setFormPhone('')
    setFormTipo('revendedor')
    setFormSource('manual')
    setFormNotes('')
    setFormStatus('ativo')
    setFormTags('revenda')
    setFormOptIn(true)
    setModalNewOpen(true)
  }

  const handleOpenEdit = (c: MarketingContact) => {
    setEditingContact(c)
    setFormName(c.name)
    setFormPhone(c.phone)
    setFormTipo(c.tipo)
    setFormSource(c.source)
    setFormNotes(c.notes || '')
    setFormStatus(c.status)
    setFormTags(Array.isArray(c.tags) ? c.tags.join(', ') : '')
    setFormOptIn(c.opt_in !== false)
    setModalNewOpen(true)
  }

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formPhone.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome e o número de WhatsApp.',
        variant: 'destructive',
      })
      return
    }

    const norm = normalizePhoneBR(formPhone)
    if (!norm.valid) {
      toast({
        title: 'Telefone inválido',
        description: norm.error || 'Formato incorreto.',
        variant: 'destructive',
      })
      return
    }

    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    setSavingContact(true)
    try {
      if (editingContact) {
        await marketingService.updateContact(editingContact.id, {
          name: formName.trim(),
          phone: norm.e164,
          tipo: formTipo,
          tags: tagsArray,
          notes: formNotes,
          status: formStatus,
          opt_in: formOptIn,
        })
        toast({ title: 'Contato atualizado com sucesso!' })
      } else {
        await marketingService.createContact({
          name: formName.trim(),
          phone: norm.e164,
          tipo: formTipo,
          source: formSource,
          tags: tagsArray,
          notes: formNotes,
          status: formStatus,
          opt_in: formOptIn,
        })
        toast({ title: 'Contato adicionado com sucesso!' })
      }
      setModalNewOpen(false)
      loadContacts()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar contato',
        description: err?.message || 'Verifique se o telefone já não está cadastrado.',
        variant: 'destructive',
      })
    } finally {
      setSavingContact(false)
    }
  }

  const handleDeleteContact = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente remover o contato "${name}"?`)) return
    try {
      await marketingService.deleteContact(id)
      toast({ title: 'Contato removido' })
      loadContacts()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover contato',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  const handleImportBatch = async () => {
    if (!importText.trim()) {
      toast({
        title: 'Lista vazia',
        description: 'Cole ao menos uma linha com Nome e Telefone.',
        variant: 'destructive',
      })
      return
    }

    setImporting(true)
    setImportResult(null)
    try {
      const res = await marketingService.importContactsBatch(importText, importDefaultTipo)
      setImportResult(res)
      toast({
        title: 'Importação concluída!',
        description: `${res.imported} contatos novos cadastrados. ${res.skipped} já existentes ignorados.`,
      })
      loadContacts()
    } catch (err: any) {
      toast({
        title: 'Erro na importação',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cards de Métricas de Contatos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Total Contatos</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              {activeCount} ativos com opt-in
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Revendedores</span>
              <Tag className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{revendedoresCount}</div>
            <p className="text-[11px] text-slate-400 mt-1">Compradores frequentes</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Clientes Finais</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{clientesCount}</div>
            <p className="text-[11px] text-slate-400 mt-1">Varejo & Loja pública</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Corporativos</span>
              <Building2 className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-700 mt-1">{corporativosCount}</div>
            <p className="text-[11px] text-slate-400 mt-1">Empresas e Cotações</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Ações & Filtros */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar contato por nome, telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadContacts()}
                  className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
                />
              </div>

              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="revendedor">Revendedor</SelectItem>
                  <SelectItem value="cliente">Cliente Final</SelectItem>
                  <SelectItem value="corporativo">Corporativo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={loadContacts}
                className="h-9 w-9 text-slate-500 hover:text-slate-900"
                title="Atualizar lista"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportText('')
                  setImportResult(null)
                  setModalImportOpen(true)
                }}
                className="text-xs h-9 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                Importar Lista
              </Button>

              <Button
                size="sm"
                onClick={handleOpenNew}
                className="text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Novo Contato
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Contatos */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nome / Empresa</th>
                <th className="py-3 px-4">WhatsApp (E.164)</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Tags</th>
                <th className="py-3 px-4">Último Disparo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    Carregando contatos...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">Nenhum contato encontrado.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Cadastre seus contatos: clique em <strong>"Novo Contato"</strong> ou cole a
                      lista em <strong>"Importar Lista"</strong>.
                    </p>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const norm = normalizePhoneBR(c.phone)
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        {c.notes && (
                          <div className="text-[11px] text-slate-400 line-clamp-1 truncate max-w-xs">
                            {c.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {norm.formatted}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            c.tipo === 'revendedor'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                              : c.tipo === 'corporativo'
                                ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                                : 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                          }
                        >
                          {c.tipo === 'revendedor'
                            ? 'Revendedor'
                            : c.tipo === 'corporativo'
                              ? 'Corporativo'
                              : 'Cliente Final'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-500 capitalize">{c.source}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {Array.isArray(c.tags) && c.tags.length > 0 ? (
                            c.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {c.last_sent_at ? (
                          new Date(c.last_sent_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <span className="text-slate-300">Nunca</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {c.status === 'ativo' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold text-[10px]">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]"
                            >
                              Inativo
                            </Badge>
                          )}
                          {!c.opt_in && (
                            <span
                              className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                              title="Contato solicitou não receber mensagens (opt-out)"
                            >
                              Opt-out
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(c)}
                            className="h-7 w-7 text-slate-500 hover:text-slate-900"
                            title="Editar contato"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteContact(c.id, c.name)}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600"
                            title="Remover contato"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Criar / Editar Contato */}
      <Dialog open={modalNewOpen} onOpenChange={setModalNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
            <DialogDescription>
              {editingContact
                ? 'Atualize os dados cadastrais do contato de marketing.'
                : 'Cadastre um novo revendedor ou cliente para campanhas de WhatsApp.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveContact} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-slate-700">Nome / Razão Social *</Label>
              <Input
                placeholder="Ex: João Silva ou InfoTech Informática"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-slate-700">Telefone / WhatsApp (com DDD) *</Label>
              <Input
                placeholder="Ex: (31) 99231-0866 ou 31992310866"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                required
                className="h-9 text-xs font-mono"
              />
              <p className="text-[11px] text-slate-400">
                Formato aceito: com ou sem máscara. Será gravado em padrão internacional E.164.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-700">Tipo de Contato</Label>
                <Select
                  value={formTipo}
                  onValueChange={(v) => setFormTipo(v as MarketingContactTipo)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revendedor">Revendedor</SelectItem>
                    <SelectItem value="cliente">Cliente Final</SelectItem>
                    <SelectItem value="corporativo">Corporativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-slate-700">Status</Label>
                <Select
                  value={formStatus}
                  onValueChange={(v) => setFormStatus(v as MarketingContactStatus)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-slate-700">Tags (separadas por vírgula)</Label>
              <Input
                placeholder="Ex: revenda, bh, dell, thinkpad"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-slate-700">Observações / Histórico</Label>
              <Textarea
                rows={2}
                placeholder="Ex: Comprou lote de 5 ThinkPads em janeiro"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="text-xs resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="opt_in"
                checked={formOptIn}
                onChange={(e) => setFormOptIn(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="opt_in" className="text-slate-700 font-medium cursor-pointer">
                Contato autorizou recebimento de comunicados (Opt-in ativo)
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNewOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingContact}
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {savingContact ? 'Salvando...' : editingContact ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Importação em Massa */}
      <Dialog open={modalImportOpen} onOpenChange={setModalImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Importação em Massa de Contatos
            </DialogTitle>
            <DialogDescription>
              Cole abaixo sua lista de clientes ou revendedores (de planilhas Excel, Google Sheets
              ou bloco de notas).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-slate-600">
              <p className="font-semibold text-slate-900">
                Formato aceito (uma linha por contato):
              </p>
              <p className="font-mono text-[11px] text-emerald-800">
                Nome do Cliente; 31992310866; revendedor
              </p>
              <p className="font-mono text-[11px] text-emerald-800">
                Maria Informática; (11) 98765-4321
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Separador por ponto-e-vírgula (;), vírgula (,) ou tabulação de planilha. O sistema
                removerá duplicidades e validará os DDDs brasileiros automaticamente.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-slate-700">Tipo padrão para novos contatos desta lista:</Label>
              <Select
                value={importDefaultTipo}
                onValueChange={(v) => setImportDefaultTipo(v as MarketingContactTipo)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revendedor">Revendedor (Lotes & atacado)</SelectItem>
                  <SelectItem value="cliente">Cliente Final (Consumidor)</SelectItem>
                  <SelectItem value="corporativo">Corporativo (Empresa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-slate-700">Cole a lista aqui:</Label>
              <Textarea
                rows={8}
                placeholder={`TechStore BH; 31992310866; revendedor\nCarlos Informática; 11987654321; cliente\nEmpresa Alpha; 21976543210; corporativo`}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="font-mono text-xs resize-y"
              />
            </div>

            {/* Resultado da importação */}
            {importResult && (
              <div className="p-3 rounded-xl border bg-slate-50 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-700">
                    Importados com sucesso: {importResult.imported}
                  </span>
                  <span className="text-slate-500">
                    Duplicados ignorados: {importResult.skipped}
                  </span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="text-[11px] text-rose-600 space-y-1 max-h-28 overflow-y-auto">
                    <p className="font-bold">Linhas com erro ({importResult.errors.length}):</p>
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <p key={i}>
                        Linha {err.line}: {err.error} ({err.raw})
                      </p>
                    ))}
                    {importResult.errors.length > 5 && (
                      <p>... e mais {importResult.errors.length - 5} erros.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalImportOpen(false)}
                className="text-xs"
              >
                Fechar
              </Button>
              <Button
                type="button"
                onClick={handleImportBatch}
                disabled={importing}
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Processando lista...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Processar Importação
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
