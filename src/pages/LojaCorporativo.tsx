import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  Receipt,
  FileCheck2,
  TrendingDown,
  Layers,
  MessageSquare,
  Send,
  Sparkles,
  ArrowRight,
  Headphones,
  Laptop,
  Lock,
  Phone,
  Mail,
  User,
  Hash,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { PublicStoreHeader, PublicStoreFooter } from '@/components/PublicStoreLayout'
import { STORE_CONFIG } from '@/lib/storeConfig'
import { CHECKLIST_CANONICAL_ITEMS } from '@/lib/checklist'
import { corporateLeadsService } from '@/services/corporateLeads'
import type { CorporateLeadProfile } from '@/types/inventory'
import pb from '@/lib/pocketbase/client'

export default function LojaCorporativo() {
  const { toast } = useToast()

  // Lista de equipamentos disponíveis para o select de interesse
  const [catalogItems, setCatalogItems] = useState<{ id: string; label: string }[]>([])

  // Formulário de Cotação
  const [company, setCompany] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [profile, setProfile] = useState<CorporateLeadProfile>('Revendedor')
  const [interest, setInterest] = useState('Lote variado (Notebooks corporativos)')
  const [quantity, setQuantity] = useState('5 a 10 unidades')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Carregar produtos para preencher opções de interesse
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const records = await pb.collection('products').getFullList({
          filter: 'status = "Disponível"',
          fields: 'id,brand,model,name',
          sort: 'brand,model',
        })
        const items = records.map((p) => ({
          id: p.id,
          label: `${p.brand || ''} ${p.model || p.name}`.trim(),
        }))
        // Remover duplicados por nome do modelo
        const unique = Array.from(new Set(items.map((i) => i.label))).map((lbl) => ({
          id: lbl,
          label: lbl,
        }))
        setCatalogItems(unique)
      } catch (e) {
        // Fallback silencioso
      }
    }
    fetchCatalog()
  }, [])

  // Gerar link direto wa.me para WhatsApp Corporativo
  const whatsappCorporativoLink = () => {
    const rawNumber = STORE_CONFIG.whatsappNumber.replace(/\D/g, '')
    const target = rawNumber.startsWith('55') ? rawNumber : `55${rawNumber}`
    const text = encodeURIComponent(
      `Olá! Tenho interesse em compras corporativas / lotes de notebooks na AMbicorpFlow. Gostaria de solicitar uma cotação por volume.`,
    )
    return `https://wa.me/${target}?text=${text}`
  }

  // Envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!company.trim() || !contactName.trim() || !email.trim() || !phone.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha nome da empresa, contato, e-mail e WhatsApp.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      await corporateLeadsService.submitLead({
        company: company.trim(),
        contact_name: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        profile,
        interest,
        quantity,
        message: message.trim(),
        status: 'novo',
      })

      setSubmitted(true)
      toast({
        title: 'Cotação enviada com sucesso!',
        description: 'Nossa equipe de vendas corporativas entrará em contato em breve.',
      })
    } catch (err: any) {
      console.error('Erro ao enviar cotação:', err)
      toast({
        title: 'Erro ao enviar cotação',
        description: err?.message || 'Tente novamente ou fale direto pelo WhatsApp.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <PublicStoreHeader />

      <main className="flex-1 w-full">
        {/* HERO SECTION */}
        <section className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white py-16 sm:py-24 overflow-hidden border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-3xl space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Atendimento Corporativo & Vendas em Lotes
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Compras por Volume para Empresas & Revendedores
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                Lotes de notebooks recondicionados de linhas profissionais (Dell Latitude, Lenovo
                ThinkPad e HP EliteBook). Equipamentos padronizados, com nota fiscal, garantia e
                desconto progressivo por volume.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <a
                  href="#formulario-cotacao"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg hover:shadow-emerald-900/40 transition-all"
                >
                  <Send className="w-4 h-4" />
                  Solicitar Cotação de Lote
                </a>

                <a
                  href={whatsappCorporativoLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  WhatsApp Comercial ({STORE_CONFIG.whatsappDisplay})
                </a>
              </div>
            </div>
          </div>

          {/* Efeito decorativo sutil */}
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-radial from-emerald-500/10 via-transparent to-transparent pointer-events-none hidden md:block" />
        </section>

        {/* BENEFÍCIOS SECTION */}
        <section className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs uppercase tracking-wider font-bold"
              >
                Vantagens B2B
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Por que adquirir lotes com a AMbicorpFlow?
              </h2>
              <p className="text-sm text-slate-500">
                Segurança técnica e previsibilidade financeira para o seu negócio ou parque de TI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Desconto Progressivo */}
              <Card className="border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Desconto por Volume
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600 leading-relaxed">
                  Tabelas exclusivas para compras a partir de 3, 5 ou 10+ unidades. Margens
                  atrativas para revenda e economia direta para empresas.
                </CardContent>
              </Card>

              {/* Card 2: 16 Itens Testados */}
              <Card className="border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Checklist de 16 Itens
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600 leading-relaxed">
                  Cada notebook é testado individualmente em bancada: BIOS, tela, portas, bateria,
                  teclado, webcam e estresse de componentes. Zero surpresas.
                </CardContent>
              </Card>

              {/* Card 3: Nota Fiscal & Garantia */}
              <Card className="border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-2">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Nota Fiscal & Garantia
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600 leading-relaxed">
                  Emissão de NF-e completa para pessoa jurídica. Equipamentos com garantia formal de
                  balcão e suporte técnico direto para seu time.
                </CardContent>
              </Card>

              {/* Card 4: Padrão Corporativo */}
              <Card className="border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-2">
                    <Layers className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Lotes Homogêneos
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600 leading-relaxed">
                  Máquinas do mesmo modelo e configuração facilitam a imagem de SO da sua TI,
                  manutenção preventiva e reposição de peças.
                </CardContent>
              </Card>
            </div>

            {/* Checklist de 16 itens — Demonstração */}
            <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Protocolo de Inspeção em 16 Etapas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Todos os equipamentos do lote saem pré-testados com o seguinte checklist:
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-full shrink-0">
                  100% de Aprovação Técnica
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                {CHECKLIST_CANONICAL_ITEMS.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-200/80"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FORMULÁRIO DE COTAÇÃO & CONTATO */}
        <section id="formulario-cotacao" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Informações de Apoio (5 colunas) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-3">
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold uppercase"
                >
                  Cotação Personalizada
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Conte-nos a necessidade do seu lote
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Preencha o formulário ao lado com o perfil de compra da sua empresa. Retornamos
                  rapidamente com a disponibilidade de estoque e tabela de preços com desconto
                  progressivo.
                </p>
              </div>

              {/* Card de Atendimento Direto */}
              <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 border border-slate-800">
                <h4 className="font-bold text-sm uppercase tracking-wider text-emerald-400">
                  Precisa de retorno imediato?
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Fale diretamente com nosso setor de vendas corporativas pelo WhatsApp comercial.
                  Podemos separar unidades e enviar fotos em tempo real.
                </p>

                <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp: {STORE_CONFIG.whatsappDisplay}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    <span>E-mail: {STORE_CONFIG.email}</span>
                  </div>
                </div>

                <a
                  href={whatsappCorporativoLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  Abrir WhatsApp Corporativo
                </a>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Seus dados serão utilizados exclusivamente para elaboração e envio da cotação.
                </span>
              </div>
            </div>

            {/* Formulário (7 colunas) */}
            <div className="lg:col-span-7">
              <Card className="border-slate-200 shadow-md">
                <CardHeader className="p-6 border-b border-slate-100">
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Solicitação de Cotação de Lote
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Preencha os dados abaixo para receber uma proposta comercial sob medida.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6">
                  {submitted ? (
                    <div className="py-12 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">
                        Cotação recebida com sucesso!
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                        Agradecemos o contato. Nossa equipe comercial analisará a disponibilidade de
                        lote e entrará em contato pelo WhatsApp e e-mail informados.
                      </p>
                      <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Button
                          onClick={() => {
                            setSubmitted(false)
                            setMessage('')
                          }}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          Enviar outra solicitação
                        </Button>
                        <a
                          href={whatsappCorporativoLink()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Avisar no WhatsApp
                        </a>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Linha 1: Empresa & Perfil */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">
                            Nome da Empresa / Razão Social *
                          </Label>
                          <Input
                            placeholder="Ex: Tech Solutions Ltda"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            required
                            className="text-xs bg-slate-50 border-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">
                            Perfil do Comprador *
                          </Label>
                          <Select
                            value={profile}
                            onValueChange={(val: CorporateLeadProfile) => setProfile(val)}
                          >
                            <SelectTrigger className="text-xs bg-slate-50 border-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Revendedor">
                                Revendedor (compras para revenda)
                              </SelectItem>
                              <SelectItem value="Empresa — uso interno">
                                Empresa — uso interno (TI / equipe)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Linha 2: Contato, E-mail, Telefone */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">
                            Nome do Responsável *
                          </Label>
                          <Input
                            placeholder="Seu nome completo"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            required
                            className="text-xs bg-slate-50 border-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">
                            E-mail Corporativo *
                          </Label>
                          <Input
                            type="email"
                            placeholder="contato@suaempresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="text-xs bg-slate-50 border-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">
                            WhatsApp / Telefone *
                          </Label>
                          <Input
                            type="tel"
                            placeholder="(31) 99999-9999"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            className="text-xs bg-slate-50 border-slate-200"
                          />
                        </div>
                      </div>

                      {/* Linha 3: Equipamento de Interesse & Quantidade */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">
                            Equipamento de Interesse
                          </Label>
                          <Select value={interest} onValueChange={setInterest}>
                            <SelectTrigger className="text-xs bg-slate-50 border-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Lote variado (Notebooks corporativos)">
                                Lote variado (Mix Dell, ThinkPad, HP)
                              </SelectItem>
                              {catalogItems.map((item) => (
                                <SelectItem key={item.id} value={item.label}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">
                            Quantidade Estimada
                          </Label>
                          <Select value={quantity} onValueChange={setQuantity}>
                            <SelectTrigger className="text-xs bg-slate-50 border-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3 a 5 unidades">3 a 5 unidades</SelectItem>
                              <SelectItem value="5 a 10 unidades">5 a 10 unidades</SelectItem>
                              <SelectItem value="10 a 20 unidades">10 a 20 unidades</SelectItem>
                              <SelectItem value="Mais de 20 unidades">
                                Mais de 20 unidades
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Mensagem Livre */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">
                          Mensagem / Requisitos Adicionais (opcional)
                        </Label>
                        <Textarea
                          placeholder="Informe requisitos específicos, prazos de entrega ou configurações desejadas (ex: mínimo 16GB RAM, SSD 512GB, teclado numérico)..."
                          rows={3}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="text-xs bg-slate-50 border-slate-200 resize-none"
                        />
                      </div>

                      {/* Nota de Privacidade & Enviar */}
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className="text-[11px] text-slate-400">
                          Respeitamos sua privacidade. Seus dados nunca serão compartilhados.
                        </p>

                        <Button
                          type="submit"
                          disabled={submitting}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-6 gap-2 shrink-0 shadow-sm"
                        >
                          {submitting ? (
                            'Enviando cotação...'
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" /> Enviar Cotação
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <PublicStoreFooter />
    </div>
  )
}
