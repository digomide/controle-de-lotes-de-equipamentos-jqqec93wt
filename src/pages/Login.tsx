import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
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
import { Boxes, Lock, Mail, Loader2, CheckCircle2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('rodrigoifgx@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      console.error(err)
      setError('Credenciais inválidas. Verifique seu e-mail e senha.')
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
    } catch {
      setError('Falha ao autenticar com as credenciais rápidas.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-slate-900 rounded-2xl shadow-lg mb-4 text-emerald-400">
            <Boxes className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">LoteEquip Gestão</h1>
          <p className="text-sm text-slate-600 mt-1">Controle de Lotes de Equipamentos & Vendas</p>
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-slate-800">
              Acesso ao Sistema
            </CardTitle>
            <CardDescription>
              Informe suas credenciais para gerenciar estoque e realizar vendas.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2 text-sm">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
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

              <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Contas de Acesso Rápido (Demonstração):
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('rodrigoifgx@gmail.com')}
                    className="text-blue-600 hover:underline font-medium text-left"
                  >
                    • Admin: rodrigoifgx@gmail.com
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('vendedor@skip.internal')}
                    className="text-blue-600 hover:underline font-medium text-left"
                  >
                    • Vendedor: vendedor@skip.internal
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

        <p className="text-center text-xs text-slate-500 mt-6">
          LoteEquip • Controle Interno de Lotes e Vendas © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
