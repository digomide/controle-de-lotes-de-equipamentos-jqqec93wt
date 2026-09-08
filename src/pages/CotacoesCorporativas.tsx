import React, { useState, useEffect } from 'react'
import {
  Building2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  ExternalLink,
  Laptop,
  Layers,
  User,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { corporateLeadsService } from '@/services/corporateLeads'
import type { CorporateLead, CorporateLeadStatus } from '@/types/inventory'

export default function CotacoesCorporativas() {
  const { toast } = useToast()
  const [leads, setLeads] = useState<CorporateLead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CorporateLeadStatus>('all')

  const loadLeads = async () => {
    setLoading(true)
    try {
      const records = await corporateLeadsService.getAll()
      setLeads(records)
    } catch (err: any) {
      console.error('Erro ao buscar cotações:', err)
      toast({
        title: 'Erro ao carregar cotações',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeads()
  }, [])

  const handleToggleStatus = async (lead: CorporateLead) => {
    const newStatus: CorporateLeadStatus = lead.status === 'novo' ? 'atendido' : 'novo'
    try {
      await corporateLeadsService.updateStatus(lead.id, newStatus)
      toast({
        title: newStatus === 'atendido' ? 'Cotação marcada como atendida!' : 'Cotação reaberta',
      })
      loadLeads()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar status',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir este lead de cotação?')) return
    try {
      await corporateLeadsService.delete(id)
      toast({ title: 'Lead removido' })
      loadLeads()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        variant: 'destructive',
      })
    }
  }

  const filteredLeads = leads.filter((item) => {
    const q = search.toLowerCase().trim()
    const matchesSearch =
      !q ||
      item.company.toLowerCase().includes(q) ||
      item.contact_name.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.phone.toLowerCase().includes(q) ||
      (item.interest && item.interest.toLowerCase().includes(q))

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const newLeadsCount = leads.filter((l) => l.status === 'novo').length

  const getWhatsAppChatUrl = (phone: string, company: string, name: string) => {
    const digits = phone.replace(/\D/g, '')
    const target = digits.startsWith('55') ? digits : `55${digits}`
    const text = encodeURIComponent(
      `Olá ${name}! Sou da AmbicorpFlow, recebemos sua cotação de lote para a empresa ${company}.`,
    )
    return `https://wa.me/${target}?text=${text}`
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Cotações Corporativas & Lotes
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Gerencie os contatos de empresas e revendedores recebidos pela página pública de
                Vendas Corporativas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {newLeadsCount > 0 && (
            <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1 text-xs">
              {newLeadsCount} {newLeadsCount === 1 ? 'novo lead' : 'novos leads'} pendentes
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={loadLeads}
            className="text-xs font-semibold gap-1.5 border-slate-300"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Buscar por empresa, contato ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <Select
            value={statusFilter}
            onValueChange={(val: 'all' | CorporateLeadStatus) => setStatusFilter(val)}
          >
            <SelectTrigger className="w-36 h-9 text-xs bg-slate-50 border-slate-200 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({leads.length})</SelectItem>
              <SelectItem value="novo">
                Novos ({leads.filter((l) => l.status === 'novo').length})
              </SelectItem>
              <SelectItem value="atendido">
                Atendidos ({leads.filter((l) => l.status === 'atendido').length})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Leads */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
          Carregando cotações recebidas...
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Nenhuma cotação encontrada</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Quando clientes preencherem o formulário na página pública de Vendas Corporativas, as
            solicitações aparecerão listadas aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLeads.map((item) => {
            const isNovo = item.status === 'novo'

            return (
              <Card
                key={item.id}
                className={`border rounded-xl shadow-xs transition-all flex flex-col justify-between ${
                  isNovo
                    ? 'border-emerald-300 bg-white ring-1 ring-emerald-400/20'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {item.profile}
                      </span>
                      <CardTitle className="text-base font-bold text-slate-900 leading-snug">
                        {item.company}
                      </CardTitle>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        isNovo
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      }`}
                    >
                      {isNovo ? 'Novo' : 'Atendido'}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <User className="w-3 h-3 text-slate-400" />
                    {item.contact_name}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2 text-xs border-t border-slate-100 pt-2.5">
                    {/* Contatos */}
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a
                        href={`mailto:${item.email}`}
                        className="truncate hover:text-emerald-700 hover:underline"
                      >
                        {item.email}
                      </a>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono font-semibold">{item.phone}</span>
                    </div>

                    {/* Interesse e Quantidade */}
                    <div className="p-2.5 rounded-lg bg-slate-100/70 border border-slate-200/80 space-y-1">
                      <div className="text-[11px] text-slate-500">
                        Interesse:{' '}
                        <strong className="text-slate-800">
                          {item.interest || 'Lote variado'}
                        </strong>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Volume:{' '}
                        <strong className="text-slate-800">{item.quantity || 'A combinar'}</strong>
                      </div>
                    </div>

                    {/* Mensagem se houver */}
                    {item.message && (
                      <p className="text-xs text-slate-600 italic bg-amber-50/50 p-2 rounded border border-amber-100">
                        "{item.message}"
                      </p>
                    )}

                    <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                      <Clock className="w-3 h-3" />
                      Recebido em:{' '}
                      {new Date(item.created).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <a
                      href={getWhatsAppChatUrl(item.phone, item.company, item.contact_name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={isNovo ? 'default' : 'outline'}
                        onClick={() => handleToggleStatus(item)}
                        className={`text-xs h-8 ${
                          isNovo
                            ? 'bg-slate-900 hover:bg-slate-800 text-white'
                            : 'border-slate-300 text-slate-700'
                        }`}
                      >
                        {isNovo ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Marcar
                            Atendido
                          </>
                        ) : (
                          'Reabrir'
                        )}
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600"
                        title="Excluir cotação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
