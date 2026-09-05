import React, { useState, useEffect } from 'react'
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Building,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { mercadoPagoService, type MPTestConnectionResponse } from '@/services/storeOrders'
import type { MercadoPagoSettings } from '@/types/inventory'

export function MercadoPagoConfigCard() {
  const { toast } = useToast()

  const [settings, setSettings] = useState<MercadoPagoSettings | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [mpEnabled, setMpEnabled] = useState(false)
  const [storeTitle, setStoreTitle] = useState('AMbicorpFlow Store')
  const [statementDescriptor, setStatementDescriptor] = useState('AMBICORPFLOW')
  const [webhookSecret, setWebhookSecret] = useState('')

  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testProgress, setTestProgress] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<MPTestConnectionResponse | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await mercadoPagoService.getSettings()
      if (data) {
        setSettings(data)
        setAccessToken(data.mp_access_token || '')
        setPublicKey(data.mp_public_key || '')
        setMpEnabled(Boolean(data.mp_enabled))
        setStoreTitle(data.store_title || 'AMbicorpFlow Store')
        setStatementDescriptor(data.statement_descriptor || 'AMBICORPFLOW')
        setWebhookSecret(data.webhook_secret || '')
      }
    } catch (err) {
      console.error('Erro ao carregar dados do Mercado Pago:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setSaving(true)
    try {
      const saved = await mercadoPagoService.saveSettings({
        id: settings?.id,
        mp_access_token: accessToken.trim(),
        mp_public_key: publicKey.trim(),
        mp_enabled: mpEnabled,
        store_title: storeTitle.trim(),
        statement_descriptor: statementDescriptor.trim(),
        webhook_secret: webhookSecret.trim(),
      })
      setSettings(saved)
      toast({
        title: 'Configurações salvas!',
        description: 'Parâmetros do Mercado Pago atualizados com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Falha ao salvar configurações no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    const tokenToTest = accessToken.trim()
    if (!tokenToTest) {
      toast({
        title: 'Token não informado',
        description: 'Cole o Access Token de Produção antes de verificar a conexão.',
        variant: 'destructive',
      })
      return
    }

    setTesting(true)
    setTestResult(null)
    setTestProgress('Iniciando verificação na API oficial do Mercado Pago...')
    try {
      // Envia o token digitado na tela (não exige salvar antes)
      const res = await mercadoPagoService.testConnection(tokenToTest, (msg) => {
        setTestProgress(msg)
      })
      setTestResult(res)
      if (res.ok) {
        const holderName = [res.data?.first_name, res.data?.last_name].filter(Boolean).join(' ')
        const displayNick = res.data?.nickname || holderName || 'Conta Ativa'
        toast({
          title: 'Conexão validada com sucesso!',
          description: `Mercado Pago autenticado: ${displayNick} (ID: ${res.data?.id || '—'})`,
        })
      } else {
        toast({
          title: 'Falha na validação do Mercado Pago',
          description: res.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      const errMsg = err.message || 'Erro inesperado durante o teste de conexão.'
      setTestResult({
        ok: false,
        configured: true,
        message: errMsg,
      })
      toast({
        title: 'Falha na conexão',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
      setTestProgress(null)
    }
  }

  return (
    <Card className="border-sky-200/90 shadow-sm bg-gradient-to-b from-sky-50/20 to-white">
      <CardHeader className="border-b border-sky-100/70 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900">
                  Mercado Pago Checkout Pro (Loja Pública)
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    mpEnabled && accessToken
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]'
                      : 'bg-slate-100 text-slate-600 border-slate-300 text-[10px]'
                  }
                >
                  {mpEnabled && accessToken ? 'Ativo na Loja' : 'Desativado / Em Configuração'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Receba via Pix automático, Cartão de Crédito e Boleto na loja pública com baixa de
                estoque
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !accessToken.trim()}
              className="text-xs h-9 border-sky-300 text-sky-800 hover:bg-sky-50 gap-1.5 font-semibold"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  {testProgress || 'Verificando...'}
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                  Verificar Conexão
                </>
              )}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleSave()}
              disabled={saving}
              className="text-xs h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold gap-1.5 shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Toggle Ativação e Modo Degradado */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">
                Ativar Mercado Pago na Loja Pública
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                (Exibe botão "Comprar com Mercado Pago")
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              Quando desativado ou sem credenciais, a loja opera automaticamente no{' '}
              <strong>modo degradado</strong>, redirecionando o comprador para o fluxo seguro do
              WhatsApp com mensagem pronta.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch checked={mpEnabled} onCheckedChange={setMpEnabled} id="mp-enabled-switch" />
            <Label
              htmlFor="mp-enabled-switch"
              className="text-xs font-bold text-slate-700 cursor-pointer"
            >
              {mpEnabled ? 'Ativado' : 'Desativado'}
            </Label>
          </div>
        </div>

        {/* Campos de Credenciais */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                Access Token de Produção (APP_USR-...) *
              </Label>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showToken ? 'Ocultar' : 'Exibir'}
              </button>
            </div>
            <Input
              type={showToken ? 'text' : 'password'}
              placeholder="Ex: APP_USR-1234567890123456-..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="font-mono text-xs h-10 bg-white border-slate-200"
            />
            <p className="text-[11px] text-slate-500">
              Obtido no{' '}
              <a
                href="https://www.mercadopago.com.br/developers/panel/app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 font-semibold hover:underline inline-flex items-center gap-0.5"
              >
                Painel de Desenvolvedores do Mercado Pago
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              na sua Aplicação &gt; Credenciais de produção.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Public Key (Chave Pública)</Label>
              <Input
                placeholder="Ex: APP_USR-xxxxxxxx-xxxx-xxxx-..."
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                className="font-mono text-xs h-10 bg-white border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Identificador na Fatura do Cartão (Statement Descriptor)
              </Label>
              <Input
                placeholder="Ex: AMBICORPFLOW"
                maxLength={16}
                value={statementDescriptor}
                onChange={(e) => setStatementDescriptor(e.target.value.toUpperCase())}
                className="font-mono text-xs h-10 bg-white border-slate-200"
              />
              <p className="text-[10px] text-slate-400">Máximo 16 caracteres, sem acentos.</p>
            </div>
          </div>
        </div>

        {/* Feedback do Teste de Conexão */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2.5 ${
              testResult.ok
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
                : 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <span className="font-bold block text-[13px] leading-snug">
                  {testResult.ok
                    ? 'Conexão validada com sucesso!'
                    : 'Atenção na validação de credenciais'}
                </span>
                <p className="text-xs leading-relaxed opacity-95">{testResult.message}</p>
                {!testResult.ok && (
                  <div className="pt-1.5 text-[11px] text-rose-800/90 border-t border-rose-200/60 mt-1.5 space-y-1">
                    <p className="font-semibold text-rose-900">💡 Como resolver:</p>
                    <ul className="list-disc list-inside space-y-0.5 pl-1">
                      <li>
                        Acesse o{' '}
                        <a
                          href="https://www.mercadopago.com.br/developers/panel/app"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-bold hover:text-rose-950"
                        >
                          Painel do Mercado Pago Developers
                        </a>{' '}
                        e abra a aplicação correspondente (ex: <em>Loja Infoprecobaixo</em>).
                      </li>
                      <li>
                        No menu lateral esquerdo, vá em <strong>Credenciais de produção</strong>.
                      </li>
                      <li>
                        Certifique-se de que clicou no botão{' '}
                        <strong>Ativar credenciais de produção</strong> (preenchendo categoria e
                        site).
                      </li>
                      <li>
                        Copie novamente o <strong>Access Token</strong> (que inicia com{' '}
                        <code>APP_USR-</code>) e cole acima sem espaços extras.
                      </li>
                      <li>
                        Lembre-se de clicar em <strong>Salvar</strong> no topo deste card para
                        persistir os dados no sistema.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {testResult.ok && testResult.data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 font-mono text-[11px] text-emerald-900 border-t border-emerald-200/80 mt-2">
                <div>
                  <span className="text-emerald-700 block text-[10px] uppercase font-sans font-semibold">
                    ID do Usuário:
                  </span>
                  <span>{testResult.data.id}</span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[10px] uppercase font-sans font-semibold">
                    Apelido / Loja:
                  </span>
                  <span>{testResult.data.nickname || '—'}</span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[10px] uppercase font-sans font-semibold">
                    Titular:
                  </span>
                  <span>
                    {[testResult.data.first_name, testResult.data.last_name]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[10px] uppercase font-sans font-semibold">
                    País / Site:
                  </span>
                  <span>{testResult.data.site_id || 'MLB (Brasil)'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* URL do Webhook para colar no painel do Mercado Pago */}
        <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              URL Oficial do Webhook de Notificações
            </span>
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px]">
              Pronto para uso
            </Badge>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Cadastre esta URL no Mercado Pago &gt; Webhooks &gt; Notificações de Pagamentos
            (Pagamentos / Pedidos) para baixa de estoque instantânea:
          </p>
          <div className="p-2.5 bg-black/40 rounded-lg font-mono text-emerald-300 text-[11px] select-all break-all border border-slate-800">
            https://controle-de-lotes-de-equipamentos-25024.shrd00.internal.goskip.dev/api/store/mp/webhook
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
