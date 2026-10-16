import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useTenant } from '@/contexts/TenantContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  mlService,
  CANONICAL_ML_REDIRECT_URI,
  buildMLAuthUrl,
  type MLStatusResponse,
} from '@/services/mlService'
import {
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  KeyRound,
  Unplug,
  Loader2,
  HelpCircle,
  Sparkles,
  BookOpen,
  QrCode,
  Smartphone,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { ManualMLModal } from '@/components/ManualMLModal'

export function MercadoLivreConfigCard() {
  const { toast } = useToast()
  const { currentTenant } = useTenant()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus] = useState<MLStatusResponse | null>(null)
  const [exchangeProgress, setExchangeProgress] = useState<string | null>(null)

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showInstructions, setShowInstructions] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [authErrorDetails, setAuthErrorDetails] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const isCurrentOriginPreview =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('--preview') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1'))

  // Client ID ativo (prioriza status salvo no backend se preenchido, com fallback para o input local)
  const effectiveClientId = (status?.client_id || clientId).trim()
  const hasCredentialsAvailable = Boolean(effectiveClientId)

  // URL canônica de autorização completa — calculada de forma estável para ser a MESMA no botão, QR Code e cópia
  const authorizationUrl = effectiveClientId
    ? buildMLAuthUrl(effectiveClientId, CANONICAL_ML_REDIRECT_URI)
    : ''

  // Verificação de escopo de escrita de anúncios/ofertas
  const currentScopes = (status?.scopes || '').toLowerCase()
  const hasWriteOfferScope =
    currentScopes.includes('urn:ml:mktp:offers:/read-write') ||
    (currentScopes.includes('write') && !currentScopes.includes('offers:/read-only'))
  const isMissingWritePermissions = Boolean(status?.connected && !hasWriteOfferScope)

  const formatLocalExpiry = (utcIso?: string | null) => {
    if (!utcIso) return null
    try {
      const d = new Date(utcIso)
      if (isNaN(d.getTime())) return null
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return null
    }
  }

  const loadStatus = async () => {
    try {
      const data = await mlService.getStatus()
      setStatus(data)
      if (data.client_id) {
        setClientId(data.client_id)
      }
    } catch (err: any) {
      console.error('Erro ao consultar status ML:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isCancelled = false

    const init = async () => {
      // 1. Carrega dados salvos da integração
      try {
        const data = await mlService.getStatus()
        if (isCancelled) return
        setStatus(data)
        if (data.client_id) {
          setClientId((prev) => (prev ? prev : data.client_id || ''))
        }
      } catch (err) {
        console.error('Erro ao consultar status ML inicial:', err)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }

      // 2. Verificar se a página recebeu ?code= ou ?error= do callback OAuth do Mercado Livre
      // ou se havia um pendente salvo no sessionStorage antes do redirecionamento do login
      const urlParams = new URLSearchParams(window.location.search)
      let authCode = urlParams.get('code')
      let oauthError = urlParams.get('error')
      let oauthErrorDescription = urlParams.get('error_description')

      // Se não veio na URL direta, verificar sessionStorage
      try {
        if (!authCode) {
          authCode = sessionStorage.getItem('ml_pending_oauth_code')
        }
        if (!oauthError) {
          oauthError = sessionStorage.getItem('ml_pending_oauth_error')
          oauthErrorDescription = sessionStorage.getItem('ml_pending_oauth_error_desc')
        }
      } catch {
        /* intentionally ignored */
      }

      // Limpar sessionStorage e URL para não duplicar chamadas
      try {
        sessionStorage.removeItem('ml_pending_oauth_code')
        sessionStorage.removeItem('ml_pending_oauth_state')
        sessionStorage.removeItem('ml_pending_oauth_error')
        sessionStorage.removeItem('ml_pending_oauth_error_desc')
      } catch {
        /* intentionally ignored */
      }

      if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }

      if (oauthError) {
        const errMsg = oauthErrorDescription
          ? `${oauthError}: ${oauthErrorDescription}`
          : `O Mercado Livre recusou a autorização (${oauthError}).`
        setAuthErrorDetails(errMsg)
        toast({
          title: 'Autorização recusada no Mercado Livre',
          description: errMsg,
          variant: 'destructive',
        })
        return
      }

      if (authCode) {
        await handleExchangeCode(authCode)
      }
    }

    init()

    return () => {
      isCancelled = true
    }
  }, [currentTenant?.id, currentTenant?.slug])

  const handleExchangeCode = async (code: string) => {
    setLoading(true)
    setAuthErrorDetails(null)
    setExchangeProgress('Iniciando processamento da autorização...')
    try {
      const res = await mlService.exchangeAuthCode(
        code,
        CANONICAL_ML_REDIRECT_URI,
        (progressMsg) => {
          setExchangeProgress(progressMsg)
        },
      )
      toast({
        title: 'Mercado Livre conectado com sucesso!',
        description: res.nickname
          ? `Conta vinculada como vendedor "${res.nickname}".`
          : 'Conta vinculada com sucesso!',
      })
      await loadStatus()
    } catch (err: any) {
      console.error('Erro detalhado no callback OAuth ML:', err)
      let message = err?.message || 'Código de autorização inválido ou expirado.'
      if (err?.data && typeof err.data === 'object') {
        const detailParts = Object.entries(err.data)
          .map(([k, v]: [string, any]) => `${k}: ${v?.message || JSON.stringify(v)}`)
          .join('; ')
        if (detailParts) {
          message += ` (${detailParts})`
        }
      }
      setAuthErrorDetails(message)
      toast({
        title: 'Falha na conexão com Mercado Livre',
        description: message,
        variant: 'destructive',
      })
      // Recarrega o status atual para manter a interface consistente
      try {
        await loadStatus()
      } catch {
        /* intentionally ignored */
      }
    } finally {
      setExchangeProgress(null)
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetClientId = clientId.trim() || status?.client_id?.trim() || ''
    if (!targetClientId) {
      toast({
        title: 'Preencha o Client ID',
        description: 'O Client ID (App ID) é obrigatório.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await mlService.saveConfig(targetClientId, clientSecret.trim(), CANONICAL_ML_REDIRECT_URI)
      toast({
        title: 'Configurações salvas!',
        description: 'Credenciais da aplicação Mercado Livre armazenadas com sucesso.',
      })
      setClientSecret('') // Limpar campo por segurança
      await loadStatus()
    } catch (err: any) {
      console.error('Erro ao salvar credenciais ML:', err)
      toast({
        title: 'Erro ao salvar credenciais',
        description: err?.message || 'Não foi possível registrar os dados.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleConnectOAuth = () => {
    if (!user) {
      toast({
        title: 'Sessão do sistema necessária',
        description:
          'Sua sessão no AmbicorpFlow expirou ou você não está logado. Faça login no sistema antes de conectar ao Mercado Livre.',
        variant: 'destructive',
      })
      return
    }
    const activeClientId = clientId.trim() || status?.client_id?.trim()
    if (!activeClientId) {
      toast({
        title: 'Client ID não configurado',
        description: 'Preencha e salve o Client ID antes de iniciar a conexão.',
        variant: 'destructive',
      })
      return
    }
    // Sempre usa rigorosamente a mesma URL de autorização da URI canônica homologada no portal de Developers do ML
    const authUrl = authorizationUrl || buildMLAuthUrl(activeClientId, CANONICAL_ML_REDIRECT_URI)
    window.location.href = authUrl
  }

  const handleCopyAuthUrl = async () => {
    if (!authorizationUrl) {
      toast({
        title: 'Client ID não configurado',
        description: 'Preencha ou salve o Client ID antes de copiar o link.',
        variant: 'destructive',
      })
      return
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(authorizationUrl)
      } else {
        // Fallback textarea para ambientes restritos
        const textArea = document.createElement('textarea')
        textArea.value = authorizationUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 3000)
      toast({
        title: 'Link copiado!',
        description:
          'Link de autorização completo copiado para a área de transferência. Envie para o celular e abra lá!',
      })
    } catch (err) {
      console.error('Erro ao copiar URL de autorização:', err)
      toast({
        title: 'Não foi possível copiar',
        description: 'Selecione e copie manualmente o link de autorização.',
        variant: 'destructive',
      })
    }
  }

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Deseja realmente desconectar sua conta do Mercado Livre? Os anúncios publicados permanecerão no ar.',
      )
    ) {
      return
    }
    setDisconnecting(true)
    try {
      await mlService.disconnect()
      toast({
        title: 'Conta desconectada',
        description: 'A integração com o Mercado Livre foi desvinculada.',
      })
      await loadStatus()
    } catch (err: any) {
      toast({
        title: 'Erro ao desconectar',
        description: err?.message || 'Falha ao remover a autenticação.',
        variant: 'destructive',
      })
    } finally {
      setDisconnecting(false)
    }
  }

  const handleCopyUri = () => {
    navigator.clipboard.writeText(CANONICAL_ML_REDIRECT_URI)
    toast({
      title: 'Redirect URI copiada!',
      description:
        'Cole esta URL no campo "Redirect URI" da sua aplicação no Mercado Livre Developers.',
    })
  }

  return (
    <Card className="border-amber-200/80 shadow-sm bg-gradient-to-b from-amber-50/30 to-white overflow-hidden">
      <CardHeader className="border-b border-amber-100 bg-amber-50/50 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#ffe600] border border-amber-400 flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Integração Oficial Mercado Livre
                {status?.connected ? (
                  <Badge className="bg-emerald-600 text-white font-semibold text-[11px] gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Sem conexão ML
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Publicação de anúncios de notebooks diretamente no Mercado Livre via API oficial
                {currentTenant && (
                  <span className="block text-[11px] font-medium text-orange-700 mt-0.5">
                    Tenant ativo: <strong>{currentTenant.name}</strong> ({currentTenant.slug})
                  </span>
                )}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowManualModal(true)}
              className="text-xs bg-white hover:bg-amber-100/70 text-amber-950 border-amber-300 font-semibold gap-1.5 h-8 shadow-2xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              Manual do Cliente
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-xs text-amber-900 hover:bg-amber-100/60 gap-1.5 h-8"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              {showInstructions ? 'Ocultar instruções' : 'Criar App'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            {exchangeProgress ? (
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-amber-900">{exchangeProgress}</p>
                <p className="text-[11px] text-slate-500">
                  Aguardando confirmação do servidor e troca de credenciais com o Mercado Livre...
                </p>
              </div>
            ) : (
              <span className="text-xs">Consultando status da integração...</span>
            )}
          </div>
        ) : (
          <>
            {/* Alerta de erro detalhado na conexão OAuth */}
            {authErrorDetails && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-xs space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Erro ao finalizar autenticação OAuth</span>
                </div>
                <p className="text-rose-700 break-words leading-relaxed">{authErrorDetails}</p>
                <div className="pt-1 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAuthErrorDetails(null)}
                    className="h-7 text-[11px] text-rose-800 border-rose-300 hover:bg-rose-100"
                  >
                    Dispensar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConnectOAuth}
                    className="h-7 text-[11px] bg-rose-600 hover:bg-rose-700 text-white font-medium"
                  >
                    Tentar autorizar novamente
                  </Button>
                </div>
              </div>
            )}

            {/* Aviso de escopo de escrita ausente (PolicyAgent 403) */}
            {isMissingWritePermissions && (
              <div className="p-4 bg-amber-500/10 border-2 border-amber-500/80 rounded-xl text-xs space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-950 text-sm">
                        Conexão sem permissão de edição — reconecte a conta para renovar permissões
                      </p>
                      <p className="text-amber-900 leading-relaxed">
                        O token OAuth atual possui apenas permissões de leitura (
                        <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px] text-amber-900">
                          offers:/read-only
                        </code>
                        ). Toda tentativa de alterar preços, estoques ou dados de anúncios será
                        bloqueada pelo Mercado Livre com erro{' '}
                        <strong>403 PolicyAgent (PA_UNAUTHORIZED_RESULT_FROM_POLICIES)</strong>.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleConnectOAuth}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 gap-1.5 shrink-0 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Reconectar para Liberar Edição
                  </Button>
                </div>

                {status?.scopes && (
                  <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 space-y-1">
                    <span className="text-[10.5px] font-semibold text-slate-600 uppercase tracking-wide">
                      Escopos concedidos atualmente pelo Mercado Livre:
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {status.scopes.split(/\s+/).map((s) => {
                        const isRead = s.includes('read-only') || s === 'read'
                        const isWrite = s.includes('read-write') || s === 'write'
                        return (
                          <Badge
                            key={s}
                            variant="outline"
                            className={`text-[10px] font-mono py-0 px-1.5 ${
                              isWrite
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : isRead
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : 'bg-slate-50 text-slate-700 border-slate-300'
                            }`}
                          >
                            {s}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bloco de Status da Conta Conectada */}
            {status?.connected ? (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow">
                    {status.nickname ? status.nickname.slice(0, 2).toUpperCase() : 'ML'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        Conectado como {status.nickname || '—'}
                      </span>
                      <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                        Oficial Mercado Livre
                      </Badge>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>
                        ID de Vendedor:{' '}
                        <span className="font-mono font-medium text-slate-800">
                          {status.user_id_ml || '—'}
                        </span>
                      </span>
                      {status.token_expires_at && formatLocalExpiry(status.token_expires_at) && (
                        <span>
                          • Token válido até:{' '}
                          <strong className="font-medium text-slate-800">
                            {formatLocalExpiry(status.token_expires_at)}
                          </strong>{' '}
                          (horário local)
                        </span>
                      )}
                      {status.permalink_seller && (
                        <span>
                          •{' '}
                          <a
                            href={status.permalink_seller}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                          >
                            Ver perfil no ML <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </span>
                      )}
                    </p>
                    {status.scopes && !isMissingWritePermissions && (
                      <p className="text-[10.5px] text-emerald-800 mt-1 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        Permissões de leitura e escrita ativas no Mercado Livre
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Link to="/anuncios-ml">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 border-amber-300 text-amber-950 bg-amber-50 hover:bg-amber-100 font-semibold gap-1.5"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                      Ver Anúncios ML
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAuthUrl}
                    className="text-xs h-8 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-medium gap-1"
                    title="Copiar URL completa de autorização para conectar pelo celular"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Link copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-700" />
                        <span>Copiar link</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleConnectOAuth}
                    className="text-xs h-8 border-slate-300 text-slate-700 hover:bg-slate-100"
                    title="Renovar autorização no Mercado Livre"
                  >
                    Reconectar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5"
                  >
                    {disconnecting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Unplug className="w-3.5 h-3.5" />
                    )}
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : hasCredentialsAvailable ? (
              <div className="p-4 bg-amber-50/90 rounded-xl border-2 border-amber-300 space-y-4 text-xs shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-amber-950 text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        Pronto para conectar ao Mercado Livre
                      </p>
                      <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                        Credenciais salvas no sistema
                      </Badge>
                    </div>
                    <p className="text-amber-900 text-xs leading-relaxed">
                      App ID ativo:{' '}
                      <strong className="font-mono font-bold text-slate-900 bg-amber-100/80 px-1.5 py-0.5 rounded">
                        {effectiveClientId}
                      </strong>
                      . Toque no botão amarelo abaixo para iniciar a autorização OAuth oficial. Não
                      é necessário redigitar nada.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                    <Button
                      type="button"
                      onClick={handleConnectOAuth}
                      className="bg-[#ffe600] hover:bg-[#ebd300] active:scale-[0.98] text-slate-950 font-bold text-xs h-11 sm:h-9 shadow-md w-full sm:w-auto gap-2 justify-center"
                    >
                      <ShoppingBag className="w-4 h-4 shrink-0 text-slate-900" />
                      Iniciar Conexão OAuth com Mercado Livre
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyAuthUrl}
                      className="border-amber-400 bg-white hover:bg-amber-100/70 text-amber-950 font-bold text-xs h-11 sm:h-9 gap-1.5 w-full sm:w-auto shadow-2xs"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Link copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-amber-800" />
                          <span>Copiar link de conexão</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Painel com QR Code e instrução para levar ao celular */}
                <div className="bg-white/95 rounded-xl border border-amber-200/90 p-3.5 shadow-2xs">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shrink-0 shadow-2xs flex flex-col items-center">
                      <QRCodeSVG value={authorizationUrl} size={128} level="M" marginSize={2} />
                      <span className="text-[10px] text-slate-500 font-medium mt-1.5 flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-slate-400" />
                        QR Code de Autorização
                      </span>
                    </div>

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                        <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Escaneie com a câmera do celular para conectar por lá — o token fica salvo
                          no sistema
                        </span>
                      </div>

                      <p className="text-slate-600 text-[11.5px] leading-relaxed">
                        Se o seu computador não abre a tela do Mercado Livre, escaneie o código ou
                        envie o link copiado para o seu celular (ex.: por WhatsApp para você mesmo)
                        e conclua a conexão por lá. A conexão vale para a conta inteira.
                      </p>

                      <div className="pt-1 flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleCopyAuthUrl}
                          className="h-7 text-[11px] gap-1.5 bg-amber-100/80 hover:bg-amber-200 text-amber-950 font-medium border border-amber-300"
                        >
                          {copiedLink ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              Link copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-amber-800" />
                              Copiar URL completa de autorização
                            </>
                          )}
                        </Button>
                        <span className="text-[10.5px] text-slate-500 font-mono select-all truncate max-w-xs sm:max-w-md">
                          {authorizationUrl}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900 text-sm sm:text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    Cadastre suas Credenciais ML
                  </p>
                  <p className="text-slate-600 text-xs sm:text-[11px] mt-0.5">
                    Preencha o Client ID (App ID) e Client Secret abaixo e clique em "Salvar
                    Credenciais" para liberar a autorização.
                  </p>
                </div>
              </div>
            )}

            {/* Painel de Instruções Expansível */}
            {showInstructions && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  <span>Passo a passo para obter as credenciais:</span>
                  <a
                    href="https://developers.mercadolivre.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Abrir painel Developers <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                  <li>
                    Acesse o portal{' '}
                    <strong className="text-slate-800">developers.mercadolivre.com.br</strong> e
                    entre com sua conta Mercado Livre.
                  </li>
                  <li>
                    Vá em <strong className="text-slate-800">Minhas Aplicações</strong> e clique em{' '}
                    <strong className="text-slate-800">Criar Nova Aplicação</strong>.
                  </li>
                  <li>
                    Em <em>Nome</em>, defina ex: "AmbicorpFlow Anúncios".
                  </li>
                  <li>
                    No campo <strong className="text-slate-800">Redirect URI</strong>, copie e cole
                    exatamente a URL abaixo:
                    <div className="mt-1 flex items-center gap-2">
                      <code className="bg-white px-2 py-1 rounded border border-slate-300 font-mono text-[11px] text-slate-800 select-all break-all">
                        {CANONICAL_ML_REDIRECT_URI}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyUri}
                        className="h-7 text-[11px] gap-1 px-2"
                      >
                        <Copy className="w-3 h-3" /> Copiar
                      </Button>
                    </div>
                  </li>
                  <li>
                    Em <em>Escopos (Scopes)</em>, garanta as permissões de{' '}
                    <strong>leitura (read)</strong> e <strong>escrita (write)</strong>.
                  </li>
                  <li>
                    Após salvar, copie o{' '}
                    <strong className="text-slate-800">App ID (Client ID)</strong> e o{' '}
                    <strong className="text-slate-800">Client Secret</strong> gerados e cole nos
                    campos abaixo. Normalmente o App ID padrão do sistema é{' '}
                    <strong>253167816099623</strong>.
                  </li>
                </ol>
                <div className="pt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowManualModal(true)}
                    className="h-7 text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-medium gap-1"
                  >
                    <BookOpen className="w-3 h-3 text-amber-700" />
                    Abrir Manual de Configuração Completo
                  </Button>
                  <Link
                    to="/manual-ml"
                    className="text-xs text-amber-800 underline hover:text-amber-950"
                  >
                    Ver página dedicada
                  </Link>
                </div>
              </div>
            )}
            {/* Formulário de Configuração das Credenciais */}
            <form onSubmit={handleSaveConfig} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      Client ID (App ID)
                    </span>
                    {status?.client_id && (
                      <span className="text-[10.5px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Salvo: {status.client_id}
                      </span>
                    )}
                  </Label>
                  <Input
                    placeholder={status?.client_id ? status.client_id : 'Ex: 253167816099623'}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="font-mono bg-white text-xs h-9"
                  />
                  <p className="text-[11px] text-slate-500">
                    {status?.client_id
                      ? `App ID salvo no backend (${status.client_id}). Preencha apenas se desejar substituir.`
                      : 'Identificador numérico do seu app no ML Developers (padrão: 253167816099623)'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-semibold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    Client Secret
                  </Label>
                  <Input
                    type="password"
                    placeholder={
                      status?.client_secret_configured || status?.configured
                        ? '•••••••• (configurado)'
                        : 'Cole o Client Secret aqui'
                    }
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="font-mono bg-white text-xs h-9"
                  />
                  <p className="text-[11px] text-slate-400">
                    {status?.client_secret_configured || status?.configured
                      ? 'Chave salva com segurança no backend. Preencha apenas se desejar substituir.'
                      : 'Chave secreta privada (salva com criptografia no backend)'}
                  </p>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-slate-700 font-semibold flex items-center justify-between">
                    <span>Redirect URI Canônica (Callback de Retorno)</span>
                    <button
                      type="button"
                      onClick={handleCopyUri}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-normal"
                    >
                      <Copy className="w-3 h-3" /> Copiar URI
                    </button>
                  </Label>
                  <Input
                    value={CANONICAL_ML_REDIRECT_URI}
                    readOnly
                    className="font-mono bg-slate-100/80 text-xs h-9 text-slate-700 cursor-default select-all"
                  />
                  <p className="text-[11px] text-slate-500">
                    URI canônica única cadastrada na sua aplicação no portal Mercado Livre
                    Developers.
                  </p>

                  {/* Aviso contextual quando acessando pelo domínio de preview */}
                  {isCurrentOriginPreview && (
                    <div className="p-3 bg-blue-50/80 rounded-lg border border-blue-200/80 text-[11px] text-blue-900 space-y-1 mt-2">
                      <div className="flex items-center gap-1.5 font-semibold text-blue-950">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Aviso de Ambiente de Homologação / Preview</span>
                      </div>
                      <p className="leading-relaxed text-blue-800">
                        Você está acessando pelo domínio de preview (
                        <code>{window.location.hostname}</code>). A aplicação OAuth homologada no
                        Mercado Livre Developers está configurada para a URI canônica de produção:
                      </p>
                      <p className="font-mono font-medium text-blue-950 bg-white/80 p-1.5 rounded border border-blue-200 select-all break-all">
                        {CANONICAL_ML_REDIRECT_URI}
                      </p>
                      <p className="text-blue-700 text-[10.5px]">
                        As operações de anúncios, perguntas e pedidos operam normalmente em todos os
                        ambientes via backend oficial.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-2 border-t border-slate-100 gap-2.5">
                {!status?.connected && hasCredentialsAvailable ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 order-1 w-full sm:w-auto">
                    <Button
                      type="button"
                      id="btn-conectar-ml"
                      onClick={handleConnectOAuth}
                      className="bg-[#ffe600] hover:bg-[#ebd300] active:scale-[0.98] text-slate-950 font-bold text-xs sm:text-xs h-12 sm:h-10 shadow-md gap-2 w-full sm:w-auto text-center justify-center transition-all"
                    >
                      <ShoppingBag className="w-4 h-4 shrink-0 text-slate-900" />
                      <span>Iniciar Conexão OAuth com Mercado Livre</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyAuthUrl}
                      className="border-amber-400 bg-white hover:bg-amber-100/70 text-amber-950 font-bold text-xs h-12 sm:h-10 gap-1.5 w-full sm:w-auto shadow-2xs"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Link copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-amber-800" />
                          <span>Copiar link de conexão</span>
                        </>
                      )}
                    </Button>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={saving}
                  variant={!status?.connected && hasCredentialsAvailable ? 'outline' : 'default'}
                  className={`font-semibold text-xs h-10 sm:h-9 gap-1.5 w-full sm:w-auto ${
                    !status?.connected && hasCredentialsAvailable
                      ? 'border-slate-300 text-slate-700 hover:bg-slate-100 order-2'
                      : 'bg-slate-900 hover:bg-slate-800 text-white order-1'
                  }`}
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Salvar Credenciais
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>

      {/* Modal Dedicado do Manual de Configuração ML */}
      <ManualMLModal
        open={showManualModal}
        onOpenChange={setShowManualModal}
        currentTenantName={currentTenant?.name}
        currentTenantSlug={currentTenant?.slug}
      />
    </Card>
  )
}
