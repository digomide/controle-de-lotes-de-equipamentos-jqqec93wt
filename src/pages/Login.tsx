import React, { useState } from 'react'
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
import { Boxes, Lock, Mail, Loader2, CheckCircle2, Building, Globe } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('rodrigoifgx@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const { currentTenant, masterTenant, allTenants, switchTenant, resolvedBySubdomain } = useTenant()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email, password, currentTenant?.id)
      navigate(from, { replace: true })
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
      navigate(from, { replace: true })
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
