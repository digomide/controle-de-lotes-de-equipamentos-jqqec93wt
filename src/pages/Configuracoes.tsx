import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import {
  User,
  ShieldCheck,
  Mail,
  Database,
  Server,
  CheckCircle2,
  Lock,
  Send,
  Megaphone,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { MercadoLivreConfigCard } from '@/components/MercadoLivreConfigCard'
import { MercadoPagoConfigCard } from '@/components/MercadoPagoConfigCard'

export default function Configuracoes() {
  const { user, isAdmin, logout } = useAuth()

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Configurações do Sistema
        </h2>
        <p className="text-sm text-slate-500">
          Dados do usuário conectado, perfil de permissão e parâmetros do servidor.
        </p>
      </div>

      {/* User profile card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-600" />
            Perfil do Usuário Atual
          </CardTitle>
          <CardDescription>Sessão autenticada ativa no PocketBase / Skip Cloud</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-16 h-16 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-xl uppercase shadow">
              {user?.name?.slice(0, 2) || 'US'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-lg">{user?.name}</h3>
                <Badge
                  variant="outline"
                  className={
                    isAdmin
                      ? 'bg-amber-100 text-amber-800 border-amber-300 font-semibold'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold'
                  }
                >
                  {isAdmin ? 'Administrador' : 'Membro de Vendas'}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user?.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <Label className="text-slate-600">ID da Conta</Label>
              <Input value={user?.id || ''} readOnly className="font-mono bg-slate-100" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-600">Nível de Acesso (Papel)</Label>
              <Input
                value={
                  isAdmin ? 'Acesso Total (Ajuste de Estoque + Vendas)' : 'Operador (Apenas Vendas)'
                }
                readOnly
                className="bg-slate-100 font-medium"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="outline"
              onClick={logout}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              Encerrar Sessão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integração Mercado Pago Checkout Pro */}
      <MercadoPagoConfigCard />

      {/* Integração Mercado Livre */}
      <MercadoLivreConfigCard />

      {/* Integração Marketing Automatizado & WhatsApp Meta */}
      <Card className="border-emerald-200/80 shadow-xs bg-gradient-to-b from-emerald-50/20 to-white">
        <CardHeader className="border-b border-emerald-100/60 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Marketing Automatizado & WhatsApp Meta Cloud API
                </CardTitle>
                <CardDescription className="text-xs">
                  Disparos diretos para revendedores, gestão de contatos e conexão oficial com a
                  Meta
                </CardDescription>
              </div>
            </div>

            <Link to="/marketing">
              <Button
                size="sm"
                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Acessar Módulo de Marketing
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4 text-xs text-slate-600 space-y-2">
          <p>
            Configure seu <strong>META_WA_TOKEN</strong>, <strong>ID do Número WhatsApp</strong> e{' '}
            <strong>Instagram Graph API</strong> na aba dedicada de configurações do Marketing.
          </p>
          <div className="flex items-center gap-2 pt-1 text-emerald-800 font-semibold">
            <span>Número oficial cadastrado:</span>
            <span className="font-mono bg-emerald-100 px-2 py-0.5 rounded">(31) 99231-0866</span>
          </div>
        </CardContent>
      </Card>

      {/* Database & Integrations Status */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-600" />
            Parâmetros de Integração & Backend
          </CardTitle>
          <CardDescription>
            Conexões com serviços de banco de dados e rotinas ativas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="font-semibold text-slate-800">Skip Cloud / PocketBase Backend</p>
                <p className="text-slate-500">
                  Coleções sincronizadas: products, batches, sales, inventory_adjustments
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Operacional
            </Badge>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-semibold text-slate-800">Hooks de Baixa Automatizada</p>
                <p className="text-slate-500">
                  Atualização atômica de lotes na criação de itens de venda e auditoria de
                  inventário
                </p>
              </div>
            </div>
            <Badge className="bg-blue-100 text-blue-800 border-none font-semibold gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Ativo
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
