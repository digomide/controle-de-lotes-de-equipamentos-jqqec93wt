import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { magaluService, MagaluStatusResponse } from '@/services/magaluService'
import {
  ShoppingBag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Key,
  Copy,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react'

export function MagaluConfigCard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus] = useState<MagaluStatusResponse | null>(null)

  // Campos do formulário
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [redirectUri, setRedirectUri] = useState(
    'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes',
  )
  const [channelId, setChannelId] = useState('9fe0d853-732b-4e4a-a0b0-cff988ed043d')
  const [branchId, setBranchId] = useState('')
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production')
  const [sellerName, setSellerName] = useState('')

  // Código de autorização manual
  const [manualCode, setManualCode] = useState('')

  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await magaluService.getStatus()
      setStatus(res)
      if (res.client_id) setClientId(res.client_id)
      if (res.redirect_uri) setRedirectUri(res.redirect_uri)
      if (res.channel_id) setChannelId(res.channel_id)
      if (res.branch_id) setBranchId(res.branch_id)
      if (res.environment) setEnvironment(res.environment)
      if (res.seller_name) setSellerName(res.seller_name)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar dados do Magalu',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    // Checa se veio ?code= do OAuth ID Magalu na URL
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    if (code && (!state || state.includes('magalu'))) {
      handleExchangeCode(code)
    }
  }, [])

  const handleExchangeCode = async (codeToUse: string) => {
    setConnecting(true)
    try {
      toast({
        title: 'Conectando ao Magalu',
        description: 'Trocando código de autorização por credenciais seguras...',
      })
      const res = await magaluService.exchangeOAuthCode(codeToUse, redirectUri)
      if (res.success) {
        toast({
          title: 'Magalu Conectado com Sucesso!',
          description: 'Sua conta de Seller Magalu Marketplace está ativa no AmbicorpFlow.',
        })
        // Limpa query params da barra de endereço
        const cleanUrl = window.location.origin + window.location.pathname
        window.history.replaceState({}, document.title, cleanUrl)
        setManualCode('')
        await loadStatus()
      } else {
        toast({
          title: 'Erro na autorização do Magalu',
          description: res.error || 'Não foi possível validar o código.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      toast({
        title: 'Falha na conexão',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setConnecting(false)
    }
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!clientId.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o Client ID gerado no Portal de Desenvolvedores do Magalu.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await magaluService.saveCredentials({
        client_id: clientId,
        client_secret: clientSecret.trim() ? clientSecret.trim() : undefined,
        redirect_uri: redirectUri,
        channel_id: channelId,
        branch_id: branchId,
        environment: environment,
        seller_name: sellerName,
      })

      toast({
        title: 'Configurações salvas',
        description: 'As credenciais do Magalu Marketplace foram salvas com sucesso.',
      })
      setClientSecret('')
      await loadStatus()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleConnectOAuth = () => {
    if (!clientId.trim()) {
      toast({
        title: 'Client ID ausente',
        description: 'Preencha e salve o Client ID antes de iniciar a autorização.',
        variant: 'destructive',
      })
      return
    }

    const authUrl = magaluService.getOAuthAuthorizationUrl(clientId.trim(), redirectUri.trim())
    window.location.href = authUrl
  }

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar a conta do Magalu Marketplace deste sistema?')) {
      return
    }
    setDisconnecting(true)
    try {
      await magaluService.disconnect()
      toast({
        title: 'Magalu desconectado',
        description: 'A sessão com a API do Magalu foi encerrada.',
      })
      await loadStatus()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao desconectar',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setDisconnecting(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copiado para a área de transferência',
      description: `${label} copiado. Cole no portal de desenvolvedores do Magalu.`,
    })
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm flex items-center justify-center">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-slate-900 dark:text-slate-100">
                Magalu Marketplace
                {loading ? (
                  <Badge variant="outline" className="text-xs">
                    Verificando...
                  </Badge>
                ) : status?.connected ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Conectado Oficial
                  </Badge>
                ) : status?.configured ? (
                  <Badge className="bg-amber-600 hover:bg-amber-600 text-white flex items-center gap-1 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" /> Pronto p/ Autorizar
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-slate-500 flex items-center gap-1 text-xs"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Não Conectado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Integração direta com a Open API Magalu (dev.magalu.com) para anúncios, estoque,
                preços e pedidos.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadStatus}
              disabled={loading}
              className="text-xs h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Status
            </Button>
            {status?.connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              >
                Desconectar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Banner Informativo / Status da Conexão */}
        {status?.connected ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-emerald-900 dark:text-emerald-300 text-sm">
                  Conta Magalu Ativa e Autenticada
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-400">
                Seller:{' '}
                <strong className="font-medium">{status.seller_name || 'Vendedor Magalu'}</strong>
                {status.seller_id ? ` (ID: ${status.seller_id})` : ''} • Canal:{' '}
                <span className="font-mono text-[11px]">{status.channel_id}</span>
              </p>
              {status.token_expires_at && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-500">
                  Renovação automática ativa (Token expira em:{' '}
                  {new Date(status.token_expires_at).toLocaleString('pt-BR')})
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => (window.location.href = '/anuncios-ml?channel=magalu')}
                className="text-xs bg-white dark:bg-slate-900 border-emerald-300 text-emerald-900 dark:text-emerald-200 font-medium"
              >
                <Layers className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Abrir Gestor de Anúncios Magalu
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-3">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 dark:text-blue-300 space-y-1.5">
                <p className="font-semibold">Como obter as credenciais de API no Portal Magalu:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-400 pl-1">
                  <li>
                    Acesse o Portal de Desenvolvedores em{' '}
                    <a
                      href="https://developers.magalu.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium hover:text-blue-950 inline-flex items-center gap-0.5"
                    >
                      developers.magalu.com <ExternalLink className="w-3 h-3 ml-0.5 inline" />
                    </a>{' '}
                    com sua conta de Seller Magalu.
                  </li>
                  <li>
                    Crie uma aplicação (ou selecione a existente) e copie o{' '}
                    <strong>Client ID</strong> e o <strong>Client Secret</strong>.
                  </li>
                  <li>
                    Cadastre a <strong>Redirect URI</strong> abaixo nas configurações da sua
                    aplicação no Magalu.
                  </li>
                  <li>
                    Salve as credenciais e clique em <strong>Conectar via ID Magalu</strong>.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Formulário de Configuração */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Client ID (Magalu Application ID) *</span>
              </Label>
              <Input
                type="text"
                placeholder="Ex: a1b2c3d4-e5f6-7890-..."
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="font-mono text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Client Secret (Segredo da Aplicação)</span>
                {status?.client_secret_configured && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-600 border-emerald-200"
                  >
                    Configurado com segurança
                  </Badge>
                )}
              </Label>
              <Input
                type="password"
                placeholder={
                  status?.client_secret_configured
                    ? '•••••••••••••••••••• (deixe em branco p/ manter atual)'
                    : 'Cole o client_secret do portal Magalu'
                }
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Redirect URI Oficial (Cadastrar no Magalu)</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(redirectUri, 'Redirect URI')}
                  className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  <Copy className="w-3 h-3" /> Copiar
                </button>
              </Label>
              <Input
                type="text"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                className="font-mono text-xs bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome de Exibição do Seller / Loja
              </Label>
              <Input
                type="text"
                placeholder="Ex: Info Preço Baixo - Magalu"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Sales Channel ID (Padrão Magalu)
              </Label>
              <Input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="font-mono text-[11px]"
              />
              <span className="text-[10px] text-slate-400">
                Padrão Magalu: 9fe0d853-732b-4e4a-a0b0-cff988ed043d
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Branch ID (Opcional - Filial/CD de Expedição)
              </Label>
              <Input
                type="text"
                placeholder="Ex: 001 ou UUID da filial"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="font-mono text-[11px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Ambiente da API
              </Label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as 'production' | 'sandbox')}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="production">Produção Oficial (api.magalu.com)</option>
                <option value="sandbox">Sandbox / Homologação</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              <Key className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar Credenciais Magalu'}
            </Button>

            {!status?.connected && (
              <Button
                type="button"
                onClick={handleConnectOAuth}
                disabled={connecting || !clientId}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Conectar via ID Magalu (OAuth 2.0)
              </Button>
            )}
          </div>
        </form>

        {/* Autorização manual caso o redirect automático precise de cópia de code */}
        {!status?.connected && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Ou cole o Código de Autorização retornado pelo Magalu (code):
            </Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Cole o parâmetro 'code' retornado na barra de endereço após autorizar"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!manualCode.trim() || connecting}
                onClick={() => handleExchangeCode(manualCode.trim())}
                className="text-xs shrink-0"
              >
                {connecting ? 'Processando...' : 'Validar Código'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
