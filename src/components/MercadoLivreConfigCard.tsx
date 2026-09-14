import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  mlService,
  getDefaultMLRedirectUri,
  buildMLAuthUrl,
  type MLStatusResponse,
} from '@/services/mlService'
import {
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  KeyRound,
  Unplug,
  Loader2,
  HelpCircle,
  Sparkles,
} from 'lucide-react'

export function MercadoLivreConfigCard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus] = useState<MLStatusResponse | null>(null)
  const [exchangeProgress, setExchangeProgress] = useState<string | null>(null)

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [showInstructions, setShowInstructions] = useState(false)
  const [authErrorDetails, setAuthErrorDetails] = useState<string | null>(null)

  const defaultRedirect = getDefaultMLRedirectUri()

  const isCurrentOriginPreview =
    typeof window !== 'undefined' && window.location.hostname.includes('--preview')

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
      setClientId(data.client_id || '')
      // Sempre prioriza a URI gravada no banco como canônica
      setRedirectUri(data.redirect_uri || defaultRedirect)
    } catch (err: any) {
      console.error('Erro ao consultar status ML:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      // 1. Carrega dados salvos primeiro para ter certeza do redirect_uri canônico gravado no banco
      let currentRedirect = defaultRedirect
      try {
        const data = await mlService.getStatus()
        setStatus(data)
        setClientId(data.client_id || '')
        if (data.redirect_uri) {
          currentRedirect = data.redirect_uri
          setRedirectUri(data.redirect_uri)
        } else {
          setRedirectUri(defaultRedirect)
        }
      } catch (err) {
        console.error('Erro ao consultar status ML inicial:', err)
      } finally {
        setLoading(false)
      }

      // 2. Verificar se a página recebeu ?code= ou ?error= do callback OAuth do Mercado Livre
      const urlParams = new URLSearchParams(window.location.search)
      const authCode = urlParams.get('code')
      const oauthError = urlParams.get('error')
      const oauthErrorDescription = urlParams.get('error_description')

      if (oauthError) {
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname)
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
        // Limpar da URL para não reenviar em F5
        window.history.replaceState({}, document.title, window.location.pathname)
        await handleExchangeCode(authCode, currentRedirect)
      }
    }

    init()
  }, [])

  const handleExchangeCode = async (code: string, explicitRedirect?: string) => {
    setLoading(true)
    setAuthErrorDetails(null)
    setExchangeProgress('Iniciando processamento da autorização...')
    try {
      const targetRedirect = explicitRedirect || redirectUri || defaultRedirect
      const res = await mlService.exchangeAuthCode(code, targetRedirect, (progressMsg) => {
        setExchangeProgress(progressMsg)
      })
      toast({
        title: 'Mercado Livre conectado com sucesso!',
        description: res.nickname
          ? `Conta vinculada como vendedor "${res.nickname}".`
          : 'Conta vinculada com sucesso!',
      })
      await loadStatus()
    } catch (err: any) {
      console.error('Erro detalhado no callback OAuth ML:', err)
      const message = err?.message || 'Código de autorização inválido ou expirado.'
      setAuthErrorDetails(message)
      toast({
        title: 'Falha na conexão com Mercado Livre',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setExchangeProgress(null)
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId.trim()) {
      toast({
        title: 'Preencha o Client ID',
        description: 'O Client ID (App ID) é obrigatório.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await mlService.saveConfig(
        clientId.trim(),
        clientSecret.trim(),
        redirectUri.trim() || defaultRedirect,
      )
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
    if (!clientId.trim()) {
      toast({
        title: 'Client ID não configurado',
        description: 'Preencha e salve o Client ID antes de iniciar a conexão.',
        variant: 'destructive',
      })
      return
    }
    const finalRedirect = redirectUri.trim() || defaultRedirect
    const authUrl = buildMLAuthUrl(clientId.trim(), finalRedirect)
    window.location.href = authUrl
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
    navigator.clipboard.writeText(redirectUri || defaultRedirect)
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
                    className="bg-slate-100 text-slate-600 text-[11px] gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Não conectado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Publicação de anúncios de notebooks diretamente no Mercado Livre via API oficial
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs text-amber-900 hover:bg-amber-100/60 gap-1.5 h-8"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
            {showInstructions ? 'Ocultar instruções' : 'Como criar o app no ML'}
          </Button>
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
                        Conectado como {status.nickname || 'INFOPRECOBAIXO'}
                      </span>
                      <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                        Oficial Mercado Livre
                      </Badge>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>
                        ID de Vendedor:{' '}
                        <span className="font-mono font-medium text-slate-800">
                          {status.user_id_ml || '626774396'}
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
            ) : (
              <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Pronto para conectar ao Mercado Livre
                  </p>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    Após cadastrar suas credenciais abaixo, clique no botão Conectar para autorizar
                    o envio de anúncios.
                  </p>
                </div>

                {status?.configured && (
                  <Button
                    type="button"
                    onClick={handleConnectOAuth}
                    className="bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 font-bold text-xs h-9 shadow-sm shrink-0"
                  >
                    Conectar Mercado Livre
                  </Button>
                )}
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
                        {redirectUri || defaultRedirect}
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
                    campos abaixo.
                  </li>
                </ol>
              </div>
            )}

            {/* Formulário de Configuração das Credenciais */}
            <form onSubmit={handleSaveConfig} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-semibold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    Client ID (App ID)
                  </Label>
                  <Input
                    placeholder="Ex: 4458888970304935"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="font-mono bg-white text-xs h-9"
                  />
                  <p className="text-[11px] text-slate-400">
                    Identificador numérico do seu app no ML Developers
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
                    value={redirectUri}
                    onChange={(e) => setRedirectUri(e.target.value)}
                    className="font-mono bg-slate-50 text-xs h-9 text-slate-700"
                  />
                  <p className="text-[11px] text-slate-400">
                    Esta mesma URL deve ser cadastrada nas configurações do seu app no portal do
                    Mercado Livre.
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
                        {status?.redirect_uri ||
                          redirectUri ||
                          'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes'}
                      </p>
                      <p className="text-blue-700 text-[10.5px]">
                        As operações de anúncios, perguntas e pedidos operam normalmente em todos os
                        ambientes via backend oficial.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-9 gap-1.5"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Salvar Credenciais
                </Button>

                {!status?.connected && clientId.trim() && (
                  <Button
                    type="button"
                    onClick={handleConnectOAuth}
                    className="bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 font-bold text-xs h-9 shadow-sm gap-2"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Iniciar Conexão OAuth com Mercado Livre
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  )
}
