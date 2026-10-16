import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Boxes, Lock, Mail, Loader2, CheckCircle2, Building, Globe, Info } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('rodrigoifgx@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const { currentTenant, masterTenant, allTenants, switchTenant, resolvedBySubdomain } = useTenant()
  const navigate = useNavigate()
  const location = useLocation()

  const fromState = (location.state as { from?: { pathname?: string; search?: string } })?.from
  const fromPathname = fromState?.pathname || '/'
  const fromSearch = fromState?.search || ''
  const targetDestination = fromSearch ? `${fromPathname}${fromSearch}` : fromPathname

  // Capturar parâmetros de OAuth do Mercado Livre caso o usuário tenha chegado em /login diretamente com ?code=...
  useEffect(() => {
    try {
      const searchStr =
        location.search || (typeof window !== 'undefined' ? window.location.search : '')
      if (searchStr) {
        const sp = new URLSearchParams(searchStr)
        const code = sp.get('code')
        const state = sp.get('state')
        const error = sp.get('error')
        const errorDesc = sp.get('error_description')
        if (code) sessionStorage.setItem('ml_pending_oauth_code', code)
        if (state) sessionStorage.setItem('ml_pending_oauth_state', state)
        if (error) sessionStorage.setItem('ml_pending_oauth_error', error)
        if (errorDesc) sessionStorage.setItem('ml_pending_oauth_error_desc', errorDesc)
      }
    } catch (_) {
      /* intentionally ignored */
    }
  }, [location.search])

  const handleSuccessfulAuth = () => {
    // Se temos um code salvo em sessionStorage ou na URL original,
    // direcionar para /configuracoes para o exchange imediato acontecer.
    let pendingCode: string | null = null
    try {
      pendingCode = sessionStorage.getItem('ml_pending_oauth_code')
      if (!pendingCode) {
        const currentSearch =
          location.search || (typeof window !== 'undefined' ? window.location.search : '')
        if (currentSearch) {
          const sp = new URLSearchParams(currentSearch)
          pendingCode = sp.get('code')
        }
      }
    } catch {
      /* intentionally ignored */
    }

    if (pendingCode) {
      navigate('/configuracoes', { replace: true })
    } else {
      navigate(targetDestination, { replace: true })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email, password, currentTenant?.id)
      handleSuccessfulAuth()
    } catch (err: any) {
      console.error(err)
      const msg = err?.message || 'Credenciais inválidas. Verifique seu e-mail e senha.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickLogin = async (quickEmail: string) => {
    setEmail(quickEmail)
    setPassword('Skip@Pass')
    setError(null)
    setIsLoading(true)
    try {
      await login(quickEmail, 'Skip@Pass')
      handleSuccessfulAuth()
    } catch (err: any) {
      console.error(err)
      const msg = err?.message || 'Falha ao autenticar com as credenciais rápidas.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-slate-900 rounded-2xl shadow-lg mb-4 text-orange-400">
            <Boxes className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            <span className="text-orange-500">Ambicorp</span>Flow
          </h1>
          <p className="text-sm text-slate-600 mt-1">Controle de Lotes de Equipamentos & Vendas</p>
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <CardTitle className="text-xl font-semibold text-slate-800">
                Acesso ao Sistema
              </CardTitle>
              {currentTenant && (
                <Badge
                  variant="outline"
                  className="bg-orange-50 text-orange-700 border-orange-200 text-xs px-2.5 py-1 gap-1"
                >
                  <Building className="w-3 h-3 text-orange-500" />
                  {currentTenant.name}
                </Badge>
              )}
            </div>
            <CardDescription>
              {resolvedBySubdomain ? (
                <span className="flex items-center gap-1 text-slate-500 text-xs">
                  <Globe className="w-3 h-3 text-slate-400" />
                  Instância identificada via subdomínio:{' '}
                  <strong>{currentTenant?.slug}.ambicorp.com.br</strong>
                </span>
              ) : (
                'Informe suas credenciais para gerenciar estoque e realizar vendas.'
              )}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2 text-sm">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Seletor de Tenant com Fallback quando não resolvido por subdomínio */}
              {!resolvedBySubdomain && allTenants.length > 0 && (
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <Label
                    htmlFor="tenant-select"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    Empresa / Unidade de Acesso (Tenant)
                  </Label>
                  <Select
                    value={currentTenant?.id || masterTenant?.id || 'ambicorpmestre1'}
                    onValueChange={(val) => switchTenant(val)}
                  >
                    <SelectTrigger id="tenant-select" className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Selecione a empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {masterTenant && (
                        <SelectItem value={masterTenant.id} className="text-xs font-medium">
                          🏢 {masterTenant.name} (Matriz / Mestre)
                        </SelectItem>
                      )}
                      {allTenants
                        .filter((t) => t.id !== masterTenant?.id)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            🏬 {t.name} ({t.slug}.ambicorp.com.br)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-400">
                    Ao acessar por <em>cliente.ambicorp.com.br</em>, a empresa é detectada
                    automaticamente.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              {/* Esclarecimento sobre Login do Sistema vs Conexão Mercado Livre */}
              <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-lg text-xs text-amber-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Acesso ao sistema AmbicorpFlow</span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-amber-900">
                  Este login é exclusivo para acessar o painel do sistema{' '}
                  <strong>AmbicorpFlow</strong>. A conexão com a sua conta do{' '}
                  <strong>Mercado Livre (INFOPRECOBAIXO)</strong> é feita após entrar no sistema, em{' '}
                  <strong>Configurações &rarr; Integração Mercado Livre</strong>, na tela de
                  autorização oficial do próprio Mercado Livre.
                </p>
              </div>

              <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 space-y-2">
                <div className="font-semibold text-slate-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Credenciais de Teste / Acesso Rápido:
                </div>
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('rodrigoifgx@gmail.com')}
                    className="text-blue-600 hover:underline font-medium text-left"
                  >
                    • <strong>Admin:</strong> rodrigoifgx@gmail.com
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('operador@loteequip.com')}
                    className="text-slate-700 hover:underline font-medium text-left"
                  >
                    • <strong>Membro (Operação):</strong> operador@loteequip.com
                  </button>
                </div>
                <p className="text-slate-400 pt-0.5">Senha padrão: Skip@Pass</p>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar no Sistema'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-6 text-center space-y-2">
          <Link
            to="/loja"
            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 hover:underline"
          >
            &larr; Ver Catálogo / Loja Pública (sem login)
          </Link>
          <p className="text-xs text-slate-500">
            AmbicorpFlow • Controle Interno de Lotes e Vendas © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
