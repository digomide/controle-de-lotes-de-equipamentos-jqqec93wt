import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
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
  KeyRound,
  Users,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { MercadoLivreConfigCard } from '@/components/MercadoLivreConfigCard'
import { MercadoPagoConfigCard } from '@/components/MercadoPagoConfigCard'
import { KabumConfigCard } from '@/components/KabumConfigCard'

export default function Configuracoes() {
  const { user, isAdmin, logout } = useAuth()

  // Estados do formulário de troca de senha
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSuccess('')
    setPasswordError('')

    if (!user?.id) {
      setPasswordError('Usuário não identificado.')
      return
    }

    if (!oldPassword.trim()) {
      setPasswordError('Por favor, informe a senha atual.')
      return
    }

    if (!newPassword || newPassword.length < 8) {
      setPasswordError('A nova senha deve possuir no mínimo 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação da nova senha não coincide.')
      return
    }

    if (oldPassword === newPassword) {
      setPasswordError('A nova senha deve ser diferente da senha atual.')
      return
    }

    setIsChangingPassword(true)

    try {
      await pb.collection('users').update(user.id, {
        oldPassword: oldPassword,
        password: newPassword,
        passwordConfirm: confirmPassword,
      })

      setPasswordSuccess('Senha alterada com sucesso! Utilize a nova senha no próximo acesso.')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      console.error('[Configuracoes] Erro ao alterar senha:', err)
      let msg = 'Erro ao alterar a senha. Verifique os dados informados.'

      const rawMsg = err?.data?.message || err?.message || ''
      const dataErrors = err?.data?.data || {}

      if (
        dataErrors?.oldPassword ||
        rawMsg.toLowerCase().includes('old password') ||
        rawMsg.toLowerCase().includes('invalid old password')
      ) {
        msg = 'A senha atual está incorreta. Verifique e tente novamente.'
      } else if (dataErrors?.password || dataErrors?.passwordConfirm) {
        msg =
          dataErrors?.password?.message ||
          dataErrors?.passwordConfirm?.message ||
          'A nova senha não atende aos requisitos do sistema.'
      } else if (rawMsg) {
        msg = rawMsg
      }

      setPasswordError(msg)
    } finally {
      setIsChangingPassword(false)
    }
  }

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
                  isAdmin
                    ? 'Administrador (Acesso Total Imune a Todos os Módulos)'
                    : 'Membro / Operador com Permissões por Módulo'
                }
                readOnly
                className="bg-slate-100 font-medium"
              />
            </div>
          </div>

          {/* Seção de Alteração de Senha */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-orange-600" />
              <h4 className="text-sm font-semibold text-slate-900">Alterar Minha Senha</h4>
            </div>

            {passwordSuccess && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="old-password" className="text-xs text-slate-700">
                    Senha Atual
                  </Label>
                  <div className="relative">
                    <Input
                      id="old-password"
                      type={showOldPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="pr-8 text-xs h-9 bg-white"
                      disabled={isChangingPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showOldPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new-password" className="text-xs text-slate-700">
                    Nova Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-8 text-xs h-9 bg-white"
                      disabled={isChangingPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="confirm-password" className="text-xs text-slate-700">
                    Confirmar Nova Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-8 text-xs h-9 bg-white"
                      disabled={isChangingPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">Requisito: mínimo 8 caracteres.</span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isChangingPassword || !oldPassword || !newPassword || !confirmPassword}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-8 gap-1.5"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Salvar Nova Senha
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Seção Usuários & Acessos (Acesso Admin) */}
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-orange-50/50 rounded-xl border border-orange-200/80">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-600 text-white rounded-lg flex-shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Gestão de Usuários & Acessos por Módulo
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Configure permissões individuais por módulo (ex: usuário com acesso exclusivo
                      ao Explorador de Catálogo), crie novos colaboradores e resete senhas.
                    </p>
                  </div>
                </div>
                <Link to="/usuarios" className="sm:self-center flex-shrink-0">
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-8 gap-1.5 shadow-xs"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Gerenciar Usuários & Acessos
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs ml-auto"
            >
              Encerrar Sessão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integração Mercado Pago Checkout Pro */}
      <MercadoPagoConfigCard />

      {/* Integração Kabum Marketplace (Mirakl) */}
      <KabumConfigCard />

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
